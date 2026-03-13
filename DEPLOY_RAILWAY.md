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

## 6-0. Replay Analyzer Worker 배포

`replay_analyzer` 통합은 API 서비스만으로 끝나지 않습니다. queue consumer는 별도 worker 프로세스이며, 운영에서는 기존 `replay_analyzer` 서비스를 아래 방식으로 재사용하는 것을 권장합니다.

- [ ] `replay_analyzer` 서비스의 Source Repo를 `stareplays`로 전환
- [ ] Builder를 `Dockerfile`로 변경
- [ ] Dockerfile Path를 `backend/Dockerfile.replay-analyzer-worker`로 설정
- [ ] Build/Start Command는 비움 (Dockerfile `ENTRYPOINT`/`CMD` 사용)
- [ ] 기존 `replay_analyzer-volume`를 계속 붙이고 mount path를 `/data`로 유지
- [ ] volume 안에 `/data/mpq/Patch_rt.mpq`, `/data/mpq/BrooDat.mpq`, `/data/mpq/StarDat.mpq` 존재 확인
- [ ] worker Variables에 `DATABASE_URL`, `REPLAY_BUCKET_*`, `REPLAY_ANALYZER_*`, `OPENBW_*` 설정
- [ ] `REPLAY_BUCKET_PATH_STYLE=false`로 우선 적용
- [ ] `openbw-core`, `openbw-bwapi-core`가 private repo면 build-time GitHub token 변수 추가
  - 공통 토큰: `GITHUB_TOKEN`
  - 또는 repo별 토큰: `OPENBW_CORE_GIT_TOKEN`, `OPENBW_BWAPI_GIT_TOKEN`
  - `backend/docker/fetch_openbw_sources.sh`가 `https://github.com/...` URL에 대해 token 인증을 붙여 clone

권장 worker 변수 예시:

```bash
ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}

REPLAY_BUCKET_NAME=${{replay-bucket.BUCKET}}
REPLAY_BUCKET_ENDPOINT=${{replay-bucket.ENDPOINT}}
REPLAY_BUCKET_REGION=${{replay-bucket.REGION}}
REPLAY_BUCKET_ACCESS_KEY_ID=${{replay-bucket.ACCESS_KEY_ID}}
REPLAY_BUCKET_SECRET_ACCESS_KEY=${{replay-bucket.SECRET_ACCESS_KEY}}
REPLAY_BUCKET_PATH_STYLE=false

REPLAY_ANALYZER_VERSION=v1
REPLAY_ANALYZER_BIN=/app/.bin/replay_analyzer
REPLAY_ANALYZER_SIMULATOR=openbw
REPLAY_ANALYZER_WORKER_LISTEN_CHANNEL=replay_analysis_jobs
REPLAY_ANALYZER_WORKER_POLL_INTERVAL_SEC=10
REPLAY_ANALYZER_WORKER_RETRY_BACKOFF_SEC=60
REPLAY_ANALYZER_WORKER_MAX_ATTEMPTS=3
REPLAY_ANALYZER_WORKER_TMP_DIR=/tmp/stareplays/replays
REPLAY_ANALYZER_WORKER_OUTPUT_ROOT=/tmp/stareplays/analysis_jobs

REPLAY_ANALYZER_PROJECT_ROOT=/app
REPLAY_ANALYZER_OPENBW_SIDECAR_BIN=/app/.bin/openbw_sidecar
REPLAY_ANALYZER_OPENBW_EXPORTER_BIN=/app/.bin/openbw_exporter_openbw
REPLAY_ANALYZER_OPENBW_BRIDGE_BIN=/app/.bin/openbw_bridge_bwapijsonl
REPLAY_ANALYZER_FORCE_MPQ_CHECK=1

OPENBW_BWAPI_RUN_DIR=/data/mpq
OPENBW_BWAPI_LAUNCHER_BIN=/app/.bin/BWAPILauncher
OPENBW_BWAPI_JSONL_MODULE_BIN=/app/.bin/openbw_bwapi_jsonl_module.so
REPLAY_ANALYZER_OPENBW_BRIDGE_ARGS=--replay {replay_path} --bwapi-launcher /app/.bin/BWAPILauncher --module /app/.bin/openbw_bwapi_jsonl_module.so --cwd /data/mpq --timeout-sec 90
```

private OpenBW fork를 쓰는 경우 추가:

```bash
GITHUB_TOKEN=<github_pat_with_repo_read>
```

또는 repo별로 분리:

```bash
OPENBW_CORE_GIT_TOKEN=<github_pat_with_repo_read>
OPENBW_BWAPI_GIT_TOKEN=<github_pat_with_repo_read>
```

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
