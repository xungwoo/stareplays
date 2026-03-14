# Ranking Job 요약

이 문서는 `Rankings_3v3` 스냅샷 생성 잡의 목적, 동작 방식, 실행 방법을 정리합니다.

## 1. 목적

- `Rankings_3v3` 조회 시 매번 전체 게임/플레이어를 집계하지 않고,
- 사전 집계된 스냅샷(`ranking_3v3` 테이블)을 조회해 응답 성능을 안정화합니다.

## 2. 동작 구조

- 실행 엔트리: `backend/cmd/ranking-job/main.go`
- 집계 서비스: `backend/internal/services/ranking/service.go`
- 저장 테이블(Ent): `backend/ent/schema/ranking3v3.go` (`ranking_3v3`)
- 조회 API: `GET /api/v1/rankings/3v3` (snapshot 기반 조회)

집계 플로우:

1. Postgres advisory lock 획득 (`pg_try_advisory_xact_lock`)  
2. strict 3v3 게임만 선별 (6명, 2팀, 각 팀 3명)  
3. 유저별 집계 (games/wins/losses/draws/avg_apm/avg_eapm/win_rate)  
4. 최소 게임 수(`min_games`) 필터 적용  
5. 기존 `ranking_3v3` 전체 삭제 후 새 스냅샷 bulk insert  

## 3. 최소 게임 수 기본값

- 운영(`ENV=production|prod`): 기본 `20`
- 로컬/기타 환경: 기본 `1`
- 환경변수 `RANKING_MIN_GAMES` 지정 시 해당 값 우선

## 4. 실행 모드

### once 모드 (1회 실행 후 종료)

```bash
cd backend && RANKING_JOB_MODE=once RANKING_MIN_GAMES=20 go run ./cmd/ranking-job
```

로컬 기본값으로 실행:

```bash
cd backend && RANKING_JOB_MODE=once go run ./cmd/ranking-job
```

### daemon 모드 (주기 실행)

```bash
cd backend && RANKING_JOB_MODE=daemon RANKING_MIN_GAMES=20 RANKING_JOB_INTERVAL=10m go run ./cmd/ranking-job
```

## 5. Railway Cron 권장 실행

Railway cron에서는 `once` 모드로 주기 실행 권장:

```bash
cd backend && RANKING_JOB_MODE=once RANKING_MIN_GAMES=20 go run ./cmd/ranking-job
```

예시 스케줄: `*/10 * * * *` (10분마다)

## 6. 주요 환경변수

- `RANKING_JOB_MODE`: `once` | `daemon` (기본 `once`)
- `RANKING_MIN_GAMES`: 최소 게임 수 필터
- `RANKING_JOB_INTERVAL`: daemon 실행 주기 (기본 `10m`)
- `ENV` 또는 `APP_ENV`: 운영/로컬 기본 min_games 결정에 사용
- DB 연결 변수: `DATABASE_URL` 또는 `DB_*`

## 7. 검증 방법

1. 잡 실행 로그 확인
   - `Ranking job started (...)`
   - `Ranking snapshot completed: rows=..., qualified_games=...`

2. API 확인

```bash
curl -sS "http://127.0.0.1:3000/api/v1/rankings/3v3?page=1&page_size=20&sort_by=win_rate&sort_dir=desc"
```

응답의 `items`/`rankings`가 스냅샷 데이터입니다.

## 8. 참고

- Make 타겟:
  - `make ranking-job`
  - `make ranking-job-daemon`
- 관련 문서:
  - `README.md`
  - `docs/architecture.md`
  - `docs/histories/DEPLOY_RAILWAY.md`
