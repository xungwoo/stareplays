# Railway 배포 체크리스트

이 문서는 `stareplays` API를 Railway에 배포할 때 필요한 최소 단계를 정리한 체크리스트입니다.

## 0. 사전 확인 (로컬)

- [ ] `go test ./...` 통과 확인
- [ ] `/health` 응답 확인 (`GET /health`)
- [ ] DB 접속 환경변수 세트 확인 (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`)

## 1. Railway 프로젝트 생성

- [ ] Railway에서 새 프로젝트 생성
- [ ] PostgreSQL 서비스 추가 (`Add Service -> Database -> PostgreSQL`)
- [ ] API 서비스 추가 (`Deploy from GitHub Repo`로 현재 저장소 연결)

## 2. API 서비스 설정

- [ ] Root Directory가 저장소 루트(`/`)인지 확인
- [ ] `railway.toml`가 적용되는지 확인
- [ ] Health Check 경로를 `/health`로 확인

## 3. 환경변수 설정 (API 서비스)

Railway API 서비스 Variables에 아래 값 설정:

- [ ] `ENV=production`
- [ ] `PORT`는 Railway 기본 주입값 사용 (별도 고정값 불필요)
- [ ] `DB_HOST=${{Postgres.PGHOST}}`
- [ ] `DB_PORT=${{Postgres.PGPORT}}`
- [ ] `DB_USER=${{Postgres.PGUSER}}`
- [ ] `DB_PASSWORD=${{Postgres.PGPASSWORD}}`
- [ ] `DB_NAME=${{Postgres.PGDATABASE}}`
- [ ] `DB_SSLMODE=disable` (문제 발생 시 `require`로 전환)
- [ ] `JWT_SECRET=<충분히 긴 랜덤 문자열>`
- [ ] `STORAGE_PATH=/app/uploads` (업로드 저장 경로를 쓸 경우)

## 4. 네트워크/보안

- [ ] API와 Postgres를 같은 Railway 프로젝트 내부 private network로 연결
- [ ] DB를 public으로 열지 않고 내부 연결 우선 사용
- [ ] 필요 시 API 서비스 Public Networking만 활성화

## 5. 첫 배포 검증

- [ ] 배포 로그에서 `Database connected successfully` 확인
- [ ] 배포 로그에서 `Schema migration completed` 확인
- [ ] 배포 후 `GET /health`가 `200` + `{\"status\":\"ok\"}` 반환하는지 확인
- [ ] `GET /api/v1/replays` 호출 시 `500` 없이 응답되는지 확인

## 6. 운영 안정화

- [ ] PostgreSQL Daily Backup 활성화
- [ ] Railway Spending Limit 또는 Usage Alert 설정
- [ ] 최소 1개 실제 replay로 업로드/조회/삭제 플로우 점검

## 6-1. Rankings Cron Job (권장)

`rankings_3v3`는 snapshot 기반 조회이므로, 주기적 집계 job을 별도 실행해야 합니다.

- [ ] Railway에서 별도 서비스(Worker) 또는 Cron Job 생성
- [ ] 실행 커맨드:

```bash
cd backend && RANKING_JOB_MODE=once RANKING_MIN_GAMES=20 go run ./cmd/ranking-job
```

- [ ] 스케줄 예시: 10분 간격 (`*/10 * * * *`)
- [ ] 동일 DB 환경변수(`DB_*` 또는 `DATABASE_URL`)를 API 서비스와 동일하게 설정
- [ ] `RANKING_MIN_GAMES`는 운영 중 값 변경 가능 (예: 20 -> 30)

## 6-2. Analyzer Cron Job (권장)

`Game_Analyzer : Race_Composition_WinRate`도 snapshot 기반 조회이므로, 주기적 집계 job 실행을 권장합니다.

- [ ] Railway Cron Job 생성
- [ ] 실행 커맨드:

```bash
cd backend && ANALYZER_JOB_MODE=once go run ./cmd/analyzer-job
```

- [ ] 스케줄 예시: 10분 간격 (`*/10 * * * *`)
- [ ] 동일 DB 환경변수(`DB_*` 또는 `DATABASE_URL`)를 API 서비스와 동일하게 설정

## 7. 현재 코드 기준 주의사항

- [ ] 현재 일부 문서와 엔드포인트 구현이 다를 수 있으니, 실제 라우트는 `backend/cmd/server/main.go` 기준으로 확인
- [ ] 로컬 경로(`file_path`) 기반 파싱 API를 운영에서 사용할 경우, 서버에서 접근 가능한 파일만 처리 가능
- [ ] 외부 사용자 업로드를 받으려면 multipart 업로드 엔드포인트로 전환 권장

## 8. 장애 대응 기본 절차

- [ ] 앱 로그에서 DB 연결 에러 확인 (`DB_*` 변수 누락/오타 우선 점검)
- [ ] 헬스체크 실패 시 `PORT` 충돌 여부 확인
- [ ] 배포 직후 5xx 발생 시 최근 배포 버전 롤백
