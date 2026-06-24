# StaReplays

StarCraft: Brood War replay 파싱/저장 API 서버입니다.

## 문서

- 현재 시스템 구조: `docs/architecture.md`
- 현재 기능 명세: `docs/spec.md`
- Next 프런트 현재 구조/legacy parity 상태: `docs/frontend-next-architecture.md`
- 완료된 작업 기록/검증 runbook: `docs/histories/`
- 상세 API 예시(보조 문서): `API_USAGE.md`
- Claude/Codex MCP 로컬 커넥터 설치: `mcp/stareplays-mcp/README.md`

## 핵심 기능

- Replay 파싱 후 `Game`, `Player`, `GameDetail`, `ReplayFile`, `User` 저장
- `observer:false` 플레이어만 저장
- 게임 식별 키: `host + start_time` (unique)
- 동일 게임 복수 업로드 지원 (`m/N` 신뢰도 모델)
- 동일 replay 재업로드 시 파싱 데이터는 유지하고 `upload_count`(신뢰도)만 갱신
- replay analyzer는 `same game_id + same file_hash + same analyzer_version`이면 중복 큐잉하지 않고, analyzer 버전이 달라질 때만 재큐잉
- `REPLAY_ANALYZER_VERSION`는 `game_analyses.analyzer_version`과 재큐잉 판단 기준입니다.
- 현재 worker는 이 값을 `replay_analyzer -analyzer-version`으로 전달하지 않으므로, analyzer 산출물 `metadata.json.analyzer_version`은 별도 값(기본 `dev`)일 수 있습니다.

## 프런트 상태

- legacy `frontend/web` 동작을 기준으로 한 Next App Router 프런트는 `frontend/app-next`에 있습니다.
- 현재 `Dashboard / Vault / Analyzer / Rankings`의 주요 legacy behavior parity가 복원된 상태입니다.
- `currentUser`는 query 우선, cookie 보조, Dashboard의 `localStorage` 복원을 함께 사용합니다.
- analyzer status는 polling 없이 수동 refresh 기준입니다.
- `Vault -> Analyzer`는 `gameId` deep-link를 유지합니다.

## 신뢰도 모델

- `m/N = upload_count/player_count`
- `N/N`이면 100%
- `upload_count`는 서로 다른 업로더가 해당 게임 replay를 업로드할 때 증가
- 같은 업로더의 같은 게임 중복 업로드는 거부(409)

## API

기본 URL: `http://localhost:3000/api/v1`

### 1) Replay 업로드/저장

`POST /games/upload`

multipart/form-data:
- `replay_file` 또는 `replay_files`: `.rep` 파일
- `uploader_name`: 업로더 이름

업로드 파일은 서버의 temp 디렉토리에 저장 후 파싱되고, 처리 완료 시 즉시 삭제됩니다.

### 1-1) Replay 미리보기(업로더 선택용)

`POST /games/upload/preview`

multipart/form-data:
- `replay_file` 또는 `replay_files`: `.rep` 파일

### 2) 게임 목록

`GET /games?limit=10&offset=0`

- 응답에 `reliability_summaries` 포함 (`m_of_n`, `reliability`)

### 3) 게임 상세

`GET /games/:id`

- 응답에 `reliability_m_of_n`, `reliability` 포함

### 4) 게임 시각화 데이터

`GET /games/:id/detail`

- `APM timeline`, `build orders`, `chat messages`

### 4-1) Replay Analyzer 상태/결과

`GET /games/:id/analyzer`

- 상태: `not_requested | queued | running | succeeded | failed`
- API 응답의 `analyzer_version`은 DB/job 버전(`REPLAY_ANALYZER_VERSION`)입니다.
- analyzer 산출물 `metadata.json`의 `analyzer_version`, `analysis_contract_version`은 현재 API에 별도 노출되지 않습니다.
- `succeeded`일 때 `quality_report`, `summary`, `analysis_phase` 요약 반환
- `analyzer.html`은 polling 없이 새로고침 버튼으로 상태를 갱신

### 5) 게임 삭제

`DELETE /games/:id`

### 6) 플레이어 통계

`GET /players/:name/stats`

### 7) 헬스체크

`GET /health`

### 7-1) 사용자 이름 자동완성

`GET /users/suggest?q=<prefix>&limit=5`

### 8) 3v3 랭킹 조회 (snapshot 기반)

`GET /rankings/3v3?page=1&page_size=20&sort_by=win_rate&sort_dir=desc&min_games=10`

- 기본 정렬: `win_rate desc`
- 정렬 키: `win_rate`, `wins`, `games`, `avg_apm`, `avg_eapm`, `name`
- snapshot 데이터가 비어 있으면 랭킹 결과도 비어 있습니다.

### 9) 종족 조합 승률 분석

`GET /analyzer/race-matchups?team_size=3&limit=200`

- snapshot 기반 조회 (실시간 전체 집계 아님)
- 정렬/페이징 파라미터:
  - `sort_by`: `games`, `team_a_win_rate`, `team_b_win_rate`, `matchup`
  - `sort_dir`: `asc` | `desc`
  - `page`, `page_size` (`limit`도 하위호환으로 지원)

## 실행

환경변수 설정 후:

```bash
cd backend && go run ./cmd/server
```

또는

```bash
make run
```

## Claude/Codex MCP 로컬 커넥터

Stareplays 팀 분석 raw data를 개인 Claude/Codex에서 MCP 도구처럼 조회하려면 아래 가이드를 참고하세요.

- 설치 가이드: `mcp/stareplays-mcp/README.md`
- 운영 raw endpoint: `https://stareplays-next-production.up.railway.app/api/team-analysis/raw`

빠른 설치:

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client both
```

기본 설치는 운영 API, 로컬 캐시 TTL 300초, API 타임아웃 10초, Node TLS용 CA bundle 자동 감지를 함께 설정합니다.

설치 후 Claude Desktop 또는 Codex를 재시작하면 `get_team_analysis_raw`, `get_team_analysis_prompt_bundle`, `analyze_team_matchups`를 사용할 수 있습니다.

### 로컬 서버 운영 규칙 (필수)

- 로컬 서버는 항상 `127.0.0.1:3000` 리스닝 상태를 유지합니다.
- 서버 시작/재시작은 아래 방식(`nohup` + PID/로그 파일)으로 고정합니다.

```bash
mkdir -p /tmp/stareplays/uploads
if [ -f /tmp/stareplays_server.pid ]; then kill "$(cat /tmp/stareplays_server.pid)" 2>/dev/null || true; fi
lsof -tiTCP:3000 -sTCP:LISTEN | xargs -I{} kill {} 2>/dev/null || true
cd backend && go build -o bin/server ./cmd/server/main.go
nohup env PORT=3000 REPLAY_UPLOAD_DIR=/tmp/stareplays/uploads DISABLE_LOCAL_PARSE=true ./bin/server > /tmp/stareplays_server.log 2>&1 &
echo $! > /tmp/stareplays_server.pid
```

- 기동 확인:

```bash
curl -sS http://127.0.0.1:3000/health
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

### 운영 권장 환경변수

- `REPLAY_UPLOAD_DIR` (기본: `/tmp/stareplays/uploads`)
  - multipart 업로드 파일의 임시 저장 디렉토리
- `REPLAY_MAX_SIZE_MB` (기본: `30`)
  - 업로드 파일 최대 크기(MB), Fiber BodyLimit에도 동일 반영
- `REPLAY_BUCKET_NAME`, `REPLAY_BUCKET_ENDPOINT`, `REPLAY_BUCKET_REGION`
- `REPLAY_BUCKET_ACCESS_KEY_ID`, `REPLAY_BUCKET_SECRET_ACCESS_KEY`
- `REPLAY_BUCKET_PATH_STYLE` (기본: `true`)
  - 신규 업로드 replay 원본을 Railway Bucket(`replays/{file_hash}.rep`)에 저장
- `REPLAY_ANALYZER_VERSION` (기본: `v1`)
  - 동일 replay hash라도 analyzer 버전이 달라지면 재큐잉 판단에 사용
  - worker는 동일 값을 `replay_analyzer -analyzer-version`으로도 전달해야 산출물 `metadata.json.analyzer_version`과 일치함
- `DISABLE_LOCAL_PARSE` (기본: `false`)
  - `true`면 `/api/v1/games/parse` 로컬 경로 파싱 API 비활성화
- `RANKING_MIN_GAMES` (기본: `20`)
  - 랭킹 snapshot 생성 시 최소 게임 수 필터
- `RANKING_JOB_MODE` (기본: `once`)
  - `once` 또는 `daemon`
- `RANKING_JOB_INTERVAL` (기본: `10m`)
  - `daemon` 모드일 때 실행 주기
- `ANALYZER_JOB_MODE` (기본: `once`)
  - `once` 또는 `daemon`
- `ANALYZER_JOB_INTERVAL` (기본: `10m`)
  - analyzer daemon 모드 실행 주기
- `REPLAY_ANALYZER_WORKER_LISTEN_CHANNEL` (기본: `replay_analysis_jobs`)
- `REPLAY_ANALYZER_WORKER_POLL_INTERVAL_SEC` (기본: `10`)
- `REPLAY_ANALYZER_WORKER_EXEC_TIMEOUT_SEC` (기본: `1200`)
- `REPLAY_ANALYZER_WORKER_MAX_ATTEMPTS` (기본: `3`)
- `REPLAY_ANALYZER_WORKER_RETRY_BACKOFF_SEC` (기본: `60`)
- `REPLAY_ANALYZER_WORKER_TMP_DIR` (기본: `/tmp/stareplays/replays`)
- `REPLAY_ANALYZER_WORKER_OUTPUT_ROOT` (기본: `/tmp/stareplays/analysis_jobs`)
- `REPLAY_ANALYZER_BIN` (기본: `replay_analyzer`)
- `REPLAY_ANALYZER_SIMULATOR` (기본: `openbw`)

### 로컬 전체 스택 점검

로컬에서 업로드, bucket 저장, analyzer worker까지 한 번에 점검하려면:

```bash
./scripts/start_local_stack.sh
./scripts/status_local_stack.sh
```

기본값은 로컬 파일시스템 bucket 입니다.

```env
REPLAY_BUCKET_LOCAL_DIR=.local/replay-bucket
```

즉 MinIO 없이도 신규 업로드와 analyzer worker까지 점검할 수 있습니다. 로컬 서버는 기본적으로 `DISABLE_RATE_LIMITER=true`로 실행되므로 UI 점검 중 `429 Too many requests`에 덜 걸리게 구성되어 있습니다.

개별 제어:

```bash
./scripts/start_local_minio.sh
./scripts/start_local_server.sh
./scripts/start_local_replay_analyzer_worker.sh
```

로컬 worker는 `stub`와 `real` 두 모드를 명시적으로 지원합니다.

기본값은 `stub`입니다.

```env
LOCAL_REPLAY_ANALYZER_MODE=stub
```

실제 `replay_analyzer`까지 포함해 점검하려면:

```env
LOCAL_REPLAY_ANALYZER_MODE=real
REPLAY_ANALYZER_REAL_ROOT=/Users/seongwoo/StarProjects/replay_analyzer
OPENBW_BWAPI_ROOT=/Users/seongwoo/StarProjects/openbw-bwapi
```

실행 예시:

```bash
LOCAL_REPLAY_ANALYZER_MODE=real \
DATABASE_URL='postgres://seongwoo@127.0.0.1:5432/starcraft_stats?sslmode=disable' \
./scripts/start_local_replay_analyzer_worker.sh
```

`real` 모드 동작:

- `replay_analyzer` repo의 Go 바이너리들을 `/tmp/stareplays/replay_analyzer_real_bin`에 자동 빌드
- `BWAPILauncher`: `${OPENBW_BWAPI_ROOT}/build/bin/BWAPILauncher`
- OpenBW module: `${REPLAY_ANALYZER_REAL_ROOT}/.bin/openbw_bwapi_jsonl_module.dylib`
- MPQ runtime dir: `${REPLAY_ANALYZER_REAL_ROOT}/mpq`

전제:

- `${REPLAY_ANALYZER_REAL_ROOT}`가 로컬에 checkout 되어 있어야 함
- `${OPENBW_BWAPI_ROOT}`가 로컬에 checkout/build 되어 있어야 함
- `${REPLAY_ANALYZER_REAL_ROOT}/mpq` 아래에 `Patch_rt.mpq`, `BrooDat.mpq`, `StarDat.mpq`가 있어야 함

S3 호환 bucket(MinIO)로도 점검하고 싶다면 아래 값을 같이 넣고 `./scripts/start_local_minio.sh`를 실행하면 됩니다.

```env
REPLAY_BUCKET_NAME=stareplays-local
REPLAY_BUCKET_ENDPOINT=http://127.0.0.1:9000
REPLAY_BUCKET_REGION=us-east-1
REPLAY_BUCKET_ACCESS_KEY_ID=minioadmin
REPLAY_BUCKET_SECRET_ACCESS_KEY=minioadmin
REPLAY_BUCKET_PATH_STYLE=true
```

로컬 worker 상태 확인:

```bash
tail -n 40 /tmp/stareplays_replay_analyzer_worker.log
cat /tmp/stareplays_replay_analyzer_worker.pid
ps -p "$(cat /tmp/stareplays_replay_analyzer_worker.pid)" -o pid=,stat=,command=
```

분석 큐 상태 확인:

```bash
psql -h 127.0.0.1 -d starcraft_stats -Atc \
  "select id, game_id, status, attempt_count, requested_at, started_at, finished_at from game_analyses order by id desc limit 8;"
```

특정 게임 analyzer 결과 확인:

```bash
curl -s "http://127.0.0.1:3000/api/v1/games/9/analyzer" | jq '{status, analyzer_version, artifacts: .artifacts.result_dir}'
```

운영/디버깅 메모:

- 로컬에서 새 업로드가 계속 `queued`에 머무르면 먼저 worker 프로세스가 실제로 떠 있는지 확인합니다.
- `LOCAL_REPLAY_ANALYZER_MODE=real`일 때는 OpenBW bridge 인자가 공백/placeholder를 포함하므로, worker 시작 스크립트는 문자열 eval이 아니라 `env`로 직접 주입해야 합니다.
- 실패 원인은 우선 `/tmp/stareplays_replay_analyzer_worker.log`의 최신 `job claimed` 이후 stderr를 확인하는 것이 가장 빠릅니다.

정지:

```bash
./scripts/stop_local_stack.sh
```

## 랭킹 스케줄 잡 실행

1회 실행:

```bash
cd backend && RANKING_JOB_MODE=once RANKING_MIN_GAMES=20 go run ./cmd/ranking-job
```

데몬 실행:

```bash
cd backend && RANKING_JOB_MODE=daemon RANKING_MIN_GAMES=20 RANKING_JOB_INTERVAL=10m go run ./cmd/ranking-job
```

## Analyzer 스케줄 잡 실행

1회 실행:

```bash
cd backend && ANALYZER_JOB_MODE=once go run ./cmd/analyzer-job
```

데몬 실행:

```bash
cd backend && ANALYZER_JOB_MODE=daemon ANALYZER_JOB_INTERVAL=10m go run ./cmd/analyzer-job
```

## 참고 문서

- 현재 시스템 구조: `docs/architecture.md`
- 현재 기능 명세: `docs/spec.md`
- 상세 API 예시: `API_USAGE.md`
- 완료된 운영 배포/검증 기록: `docs/histories/DEPLOY_RAILWAY.md`

## 성능 벤치 스크립트

- `scripts/perf/bench_player_stats.sh`
  - `/api/v1/players/:name/stats` 응답시간 p50/p95/p99 측정
- `scripts/perf/bench_batch_upload.sh`
  - `/api/v1/games/upload` 배치 업로드 p50/p95/p99 측정
- `scripts/perf/compare_bench_results.sh`
  - before/after CSV 결과 비교

예시:

```bash
# player stats 벤치
bash scripts/perf/bench_player_stats.sh \
  --base-url http://127.0.0.1:3000 \
  --player jjang9-pil \
  --requests 120 \
  --concurrency 8 \
  --summary-file others/perf-results/player_stats_before.csv

# batch upload 벤치
bash scripts/perf/bench_batch_upload.sh \
  --base-url http://127.0.0.1:3000 \
  --replay-file /path/to/sample.rep \
  --uploader-names "jjang9-pil,player2,player3" \
  --batch-size 4 \
  --requests 60 \
  --concurrency 4 \
  --summary-file others/perf-results/batch_upload_before.csv

# 코드 변경 후 동일 명령을 *_after.csv 로 다시 측정 후 비교
bash scripts/perf/compare_bench_results.sh \
  --before others/perf-results/player_stats_before.csv \
  --after others/perf-results/player_stats_after.csv
```
