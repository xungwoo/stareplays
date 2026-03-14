# StaReplays Architecture

## 목적

이 문서는 현재 `stareplays`의 실제 런타임 구조를 설명합니다. 기준은 코드와 운영 배포이며, 중간 구현 과정이 아니라 현재 구조 자체를 기록합니다.

소스 오브 트루스:

- `backend/cmd/server/main.go`
- `backend/cmd/replay-analyzer-worker/main.go`
- `backend/internal/api/handlers/replay_handler.go`
- `backend/internal/services/ranking/service.go`
- `backend/internal/services/analyzer/service.go`
- `backend/ent/schema/*.go`

## 현재 운영 범위

- 운영 웹 UI는 `frontend/web`만 사용합니다.
- `frontend/app-next`는 저장소에 존재하지만 현재 운영 트래픽을 받지 않습니다.
- replay analyzer 통합은 운영 연결 및 실제 업로드 E2E 검증까지 완료된 상태입니다.

## 상위 구조

```text
Browser
  -> stareplays (public API + legacy web static hosting)
       -> Postgres
       -> replay-bucket (S3-compatible Railway Bucket)
       -> pg_notify(replay_analysis_jobs)

replay_analyzer (private worker service)
  -> Postgres LISTEN/NOTIFY + poll fallback
  -> replay-bucket 에서 replay 원본 다운로드
  -> /data/mpq 의 MPQ 자산 사용
  -> replay_analyzer/openbw 실행
  -> Postgres game_analyses 결과 저장

ranking-job (cron)
  -> Postgres ranking_3v3 snapshot 재생성

analyzer-job (cron)
  -> Postgres analyzer_race_matchups snapshot 재생성
```

## Railway 운영 배포 구조

현재 steady-state 기준 서비스는 아래와 같습니다.

1. `stareplays`
- 공개 서비스입니다.
- Fiber API 서버를 실행합니다.
- `frontend/web` 정적 파일을 `/` 아래에서 함께 제공합니다.
- 신규 replay 업로드를 받아 DB 저장, bucket 저장, analyzer enqueue를 담당합니다.

2. `Postgres`
- 핵심 영속 저장소입니다.
- 게임, 플레이어, 상세 데이터, 업로드 이력, analyzer queue/result, snapshot 데이터를 보관합니다.

3. `replay-bucket`
- 신규 업로드 replay 원본 저장소입니다.
- object key는 `replays/{file_hash}.rep` 형식입니다.

4. `replay_analyzer`
- 공개 서비스가 아닌 private worker 서비스입니다.
- 기존 analyzer 전용 서비스를 `stareplays`의 worker 이미지로 재목적화했습니다.
- `backend/Dockerfile.replay-analyzer-worker`로 빌드합니다.
- `replay_analyzer-volume`을 `/data`에 mount 하고, MPQ 자산은 `/data/mpq`에서 재사용합니다.

5. `ranking-job`
- snapshot 기반 3v3 랭킹 데이터를 주기적으로 재생성합니다.

6. `analyzer-job`
- snapshot 기반 종족 조합 승률 데이터를 주기적으로 재생성합니다.

7. `migration-job`
- steady-state 필수 서비스는 아니며, 필요 시에만 사용하는 유지보수/마이그레이션용 서비스입니다.

## 핵심 저장 모델

1. `games`
- 게임의 대표 메타 row입니다.
- 식별 규칙은 `host + start_time` unique 입니다.

2. `players`
- observer를 제외한 참가자 정보와 통계입니다.
- `game + player_id`가 unique 입니다.

3. `game_details`
- 시각화용 상세 데이터입니다.
- build order, resource, APM timeline, chat 등의 분석 결과를 가집니다.

4. `replay_files`
- 업로드 이력입니다.
- `game + uploader`가 unique 이므로, 같은 유저의 같은 게임 중복 업로드는 막습니다.
- `file_hash`는 인덱스만 있고 전역 unique는 아닙니다.

5. `game_analyses`
- replay analyzer queue + 결과 저장 테이블입니다.
- `game_id`가 unique 이므로 게임당 1개의 현재 analyzer 상태만 유지합니다.

6. `ranking_3v3`, `analyzer_race_matchups`
- cron job이 재생성하는 snapshot 테이블입니다.
- API는 이 테이블을 직접 읽습니다.

## 요청/작업 흐름

### 1. Replay 업로드

```text
Client
  -> POST /api/v1/games/upload
  -> replay parse
  -> games / players / game_details / replay_files 저장
  -> replay-bucket 에 replays/{file_hash}.rep 저장
  -> game_analyses upsert
  -> pg_notify(replay_analysis_jobs)
```

핵심 규칙:

- 같은 게임을 다른 업로더가 올리면 `replay_files`만 추가되고 `upload_count`가 증가합니다.
- 같은 유저가 같은 게임을 다시 올리면 `409`입니다.
- analyzer 재큐잉은 `same game_id + same file_hash + different analyzer_version`일 때만 발생합니다.

### 2. Replay Analyzer 처리

```text
worker started
  -> LISTEN replay_analysis_jobs
  -> 주기 poll fallback
  -> game_analyses 에서 FOR UPDATE SKIP LOCKED claim
  -> replay-bucket 에서 원본 replay 다운로드
  -> replay_analyzer(openbw) 실행
  -> quality_report / summary / analysis_phase 저장
  -> status succeeded | failed 갱신
```

설계 포인트:

- durable queue는 `game_analyses` 테이블입니다.
- wake-up 신호는 PostgreSQL `LISTEN/NOTIFY`입니다.
- notify 누락에 대비해 poll fallback을 유지합니다.

### 3. Snapshot Cron 작업

1. `ranking-job`
- strict 3v3 조건을 만족하는 게임만 집계합니다.
- 결과를 `ranking_3v3`에 전체 재작성합니다.

2. `analyzer-job`
- 종족 조합 승률 snapshot을 계산합니다.
- 결과를 `analyzer_race_matchups`에 전체 재작성합니다.

## 서비스별 책임

### `stareplays`

- HTTP API
- legacy web 제공
- replay 업로드 파싱
- reliability 모델 계산
- bucket 업로드
- analyzer enqueue

### `replay_analyzer`

- replay analysis queue 소비
- bucket 다운로드
- analyzer 실행
- 성공/실패/재시도 상태 전이

### Cron jobs

- 실시간 전체 집계가 아니라 snapshot 재생성 전용
- read API latency를 낮추기 위한 분리 구조

## 운영상 중요한 제약

1. bucket 설정은 API와 worker 둘 다 필요합니다.
- API는 업로드 시 원본을 저장합니다.
- worker는 실행 시 원본을 다시 다운로드합니다.

2. worker는 `/data/mpq` 자산이 필요합니다.
- `OPENBW_BWAPI_RUN_DIR=/data/mpq`
- `REPLAY_ANALYZER_OPENBW_BRIDGE_ARGS`도 동일 경로를 사용해야 합니다.

3. Railway 운영 bucket은 현재 `REPLAY_BUCKET_PATH_STYLE=false` 기준입니다.
- 로컬 MinIO에서는 `true`를 사용합니다.

4. 운영에서는 `DISABLE_LOCAL_PARSE=true`를 권장합니다.
- `/api/v1/games/parse`는 로컬 파일 경로 기반 dev endpoint 입니다.

5. replay analyzer worker 이미지는 build 시 private GitHub repo에 접근합니다.
- `GITHUB_TOKEN` 또는 repo별 token이 Docker build 단계까지 전달되어야 합니다.

## 현재 상태 요약

- replay analyzer 통합은 코드/로컬/운영 E2E까지 완료되었습니다.
- 운영 UI는 `frontend/web` 기준입니다.
- Next.js 전환은 별도 작업이며 현재 아키텍처의 production path에 포함되지 않습니다.
