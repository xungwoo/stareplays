# Local Replay Analyzer E2E Runbook

`replay_analyzer` 통합을 로컬에서 bucket 포함으로 검증하기 위한 실행 문서입니다.

## 현재 기준

- 기준 날짜: `2026-03-13`
- 운영 웹 기준: `frontend/web` (legacy web)
- `frontend/app-next` 전환은 현재 보류
- 운영 Railway Bucket은 아직 생성되지 않음
- 따라서 replay analyzer 운영 E2E는 아직 로컬/스테이징 검증이 먼저 필요

## 목적

아래 항목을 로컬에서 한 번에 검증합니다.

- `POST /api/v1/games/upload` 시 bucket object 생성
- `game_analyses` row 생성 및 `queued -> running -> succeeded|failed` 전이
- worker의 `LISTEN/NOTIFY + poll fallback` 경로
- `GET /api/v1/games`의 `analysis_statuses`
- `GET /api/v1/games/:id/analyzer`
- legacy web의 Recent Games / Analyzer 수동 새로고침 UX

## 전제 조건

- 로컬 PostgreSQL 실행 중
- 프로젝트 `.env`에 DB 접속 정보 설정 완료
- `go`, `curl`, `docker` 사용 가능
- 샘플 `.rep` 파일 1개 이상 보유

주의:

- replay analyzer E2E는 반드시 `POST /api/v1/games/upload` 기준으로 검증해야 합니다.
- `POST /api/v1/games/parse`는 `replayData=nil` 경로라 bucket 업로드와 분석 enqueue를 검증하지 못합니다.

## 추가된 지원 파일

- [scripts/replay_analyzer_stub.sh](/Users/seongwoo/StarProjects/stareplays/scripts/replay_analyzer_stub.sh)
- [scripts/start_local_replay_analyzer_worker.sh](/Users/seongwoo/StarProjects/stareplays/scripts/start_local_replay_analyzer_worker.sh)
- [scripts/stop_local_replay_analyzer_worker.sh](/Users/seongwoo/StarProjects/stareplays/scripts/stop_local_replay_analyzer_worker.sh)
- [scripts/status_local_replay_analyzer_worker.sh](/Users/seongwoo/StarProjects/stareplays/scripts/status_local_replay_analyzer_worker.sh)

## 시나리오 A: Fake Analyzer Stub 기반 스모크 E2E

이 경로가 1차 권장입니다. bucket, queue, API, UI wiring을 빠르게 검증할 수 있습니다.

### 1) MinIO 실행

```bash
docker rm -f stareplays-minio >/dev/null 2>&1 || true
docker run -d \
  --name stareplays-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

MinIO bucket 생성:

macOS / Docker Desktop:

```bash
docker run --rm minio/mc sh -c \
  "mc alias set local http://host.docker.internal:9000 minioadmin minioadmin && mc mb --ignore-existing local/stareplays-local"
```

Linux:

```bash
docker run --rm --network host minio/mc sh -c \
  "mc alias set local http://127.0.0.1:9000 minioadmin minioadmin && mc mb --ignore-existing local/stareplays-local"
```

### 2) bucket / worker env 준비

현재 셸에 아래 env를 export 합니다.

```bash
export REPLAY_BUCKET_NAME=stareplays-local
export REPLAY_BUCKET_ENDPOINT=http://127.0.0.1:9000
export REPLAY_BUCKET_REGION=us-east-1
export REPLAY_BUCKET_ACCESS_KEY_ID=minioadmin
export REPLAY_BUCKET_SECRET_ACCESS_KEY=minioadmin
export REPLAY_BUCKET_PATH_STYLE=true

export REPLAY_ANALYZER_BIN="$(pwd)/scripts/replay_analyzer_stub.sh"
export REPLAY_ANALYZER_WORKER_TMP_DIR=/tmp/stareplays/replays
export REPLAY_ANALYZER_WORKER_OUTPUT_ROOT=/tmp/stareplays/analysis_jobs
export REPLAY_ANALYZER_WORKER_POLL_INTERVAL_SEC=10
export REPLAY_ANALYZER_WORKER_RETRY_BACKOFF_SEC=10
export REPLAY_ANALYZER_STUB_MODE=success
```

옵션:

- `REPLAY_ANALYZER_STUB_MODE=fail`
  - worker retry / 최종 실패 경로 검증용
- `REPLAY_ANALYZER_STUB_DELAY_SEC=3`
  - `queued -> running` 상태를 UI에서 보기 쉽게 늦추는 용도

### 3) API 서버 실행

```bash
./scripts/start_local_server.sh
./scripts/status_local_server.sh
```

### 4) replay analyzer worker 실행

```bash
./scripts/start_local_replay_analyzer_worker.sh
./scripts/status_local_replay_analyzer_worker.sh
```

### 5) replay 업로드

`SAMPLE_REPLAY`를 실제 파일 경로로 바꿉니다.

```bash
export SAMPLE_REPLAY="/absolute/path/to/sample.rep"

curl -sS -X POST http://127.0.0.1:3000/api/v1/games/upload \
  -F "replay_file=@${SAMPLE_REPLAY}" \
  -F "uploader_name=e2e-local-user"
```

### 6) bucket object 확인

macOS / Docker Desktop:

```bash
docker run --rm minio/mc sh -c \
  "mc alias set local http://host.docker.internal:9000 minioadmin minioadmin && mc ls --recursive local/stareplays-local"
```

Linux:

```bash
docker run --rm --network host minio/mc sh -c \
  "mc alias set local http://127.0.0.1:9000 minioadmin minioadmin && mc ls --recursive local/stareplays-local"
```

### 7) API 상태 확인

최근 게임 목록:

```bash
curl -sS "http://127.0.0.1:3000/api/v1/games?limit=10&offset=0"
```

특정 게임 analyzer 상태:

```bash
curl -sS "http://127.0.0.1:3000/api/v1/games/<GAME_ID>/analyzer"
```

DB 직접 확인:

```bash
psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" \
  -c "select id, game_id, status, attempt_count, requested_at, started_at, finished_at, next_retry_at from game_analyses order by id desc limit 10;"
```

### 8) legacy web 확인

브라우저에서 아래를 확인합니다.

- `http://127.0.0.1:3000/`
- `http://127.0.0.1:3000/analyzer.html`

확인 포인트:

- Recent Games 배지가 `QUEUED`, `RUNNING`, `DONE`, `FAILED`로 바뀌는지
- Analyzer 페이지에서 `Refresh Status`로 상태가 갱신되는지
- 성공 시 stub 결과의 `KD_CONFIDENCE`, `DESTROY_WITH_KILLER`가 렌더링되는지

## 시나리오 B: 실제 replay_analyzer 포함 풀 E2E

시나리오 A를 통과한 뒤 진행합니다.

### 차이점

- `REPLAY_ANALYZER_BIN`만 실제 바이너리로 교체합니다.
- 나머지 bucket / API / worker 경로는 그대로 둡니다.

```bash
export REPLAY_ANALYZER_BIN="/absolute/path/to/replay_analyzer"
export REPLAY_ANALYZER_SIMULATOR=openbw
unset REPLAY_ANALYZER_STUB_MODE
unset REPLAY_ANALYZER_STUB_DELAY_SEC
```

이후 아래만 다시 수행하면 됩니다.

```bash
./scripts/stop_local_replay_analyzer_worker.sh
./scripts/start_local_replay_analyzer_worker.sh
```

버전 확인 메모:

```bash
LATEST_RESULT_DIR="$(find /tmp/stareplays/analysis_jobs -mindepth 2 -maxdepth 2 -type d | tail -n 1)"
jq '{analysis_contract_version, analyzer_version, ruleset_version: .parser.ruleset_version}' "$LATEST_RESULT_DIR/metadata.json"
```

- API의 `analyzer_version`은 DB/job 버전(`REPLAY_ANALYZER_VERSION`)입니다.
- analyzer 산출물 `metadata.json.analyzer_version`은 worker가 `-analyzer-version`을 전달해야 일치합니다. 현재 코드 기준으로는 기본값 `dev`가 찍힐 수 있습니다.

## 검증 체크리스트

### 스모크 완료 조건

- [ ] 업로드 직후 MinIO에 `replays/{file_hash}.rep` 오브젝트 생성
- [ ] `game_analyses` row 생성
- [ ] worker가 row를 claim해서 `running` 전이
- [ ] 성공 시 `quality_report_json`, `summary_json`, `analysis_phase_json` 저장
- [ ] `GET /api/v1/games`의 `analysis_statuses`에 상태 반영
- [ ] `GET /api/v1/games/:id/analyzer` 응답이 UI와 일치
- [ ] legacy web Analyzer에서 수동 새로고침으로 상태 변화 확인

### 실패 / retry 검증

- [ ] `REPLAY_ANALYZER_STUB_MODE=fail` 설정 시 실패 재현
- [ ] 실패 후 `attempt_count` 증가 및 `queued` 재등록 확인
- [ ] 최대 시도 초과 후 최종 `failed` 확인
- [ ] `last_error`가 API에 노출되는지 확인

### notify / poll 검증

- [ ] worker 실행 중 업로드 시 즉시 처리되는지 확인
- [ ] worker를 잠시 내렸다가 다시 올려도 남은 `queued` 작업을 잡는지 확인

## 정리 명령

```bash
./scripts/stop_local_replay_analyzer_worker.sh
./scripts/stop_local_server.sh
docker rm -f stareplays-minio
```

## 트러블슈팅

### worker가 바로 죽는 경우

- `.env`의 DB 접속 정보 확인
- bucket env export 여부 확인
- worker 로그 확인:

```bash
tail -n 100 /tmp/stareplays_replay_analyzer_worker.log
```

### 업로드는 되는데 analyzer row가 안 생기는 경우

- `POST /api/v1/games/upload`를 사용했는지 확인
- `/api/v1/games/parse`로 테스트하지 않았는지 확인
- bucket env 누락 여부 확인

### MinIO bucket 확인이 안 되는 경우

- macOS Docker Desktop이면 `host.docker.internal` 사용
- Linux면 `--network host` 사용

