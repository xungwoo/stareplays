# StaReplays

StarCraft: Brood War replay 파싱/저장 API 서버입니다.

## 문서

- 현재 시스템 구조: `docs/architecture.md`
- 현재 기능 명세: `docs/spec.md`
- 완료된 작업 기록/검증 runbook: `docs/histories/`
- 상세 API 예시(보조 문서): `API_USAGE.md`

## 핵심 기능

- Replay 파싱 후 `Game`, `Player`, `GameDetail`, `ReplayFile`, `User` 저장
- `observer:false` 플레이어만 저장
- 게임 식별 키: `host + start_time` (unique)
- 동일 게임 복수 업로드 지원 (`m/N` 신뢰도 모델)
- 동일 replay 재업로드 시 파싱 데이터는 유지하고 `upload_count`(신뢰도)만 갱신
- replay analyzer는 `same game_id + same file_hash + same analyzer_version`이면 중복 큐잉하지 않고, analyzer 버전이 달라질 때만 재큐잉

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
- 결과 메타에 `analyzer_version` 포함
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
