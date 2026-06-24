# StaReplays Spec

## 목적

이 문서는 현재 `stareplays`가 제공하는 기능과 도메인 규칙을 명세합니다. 구현 계획이 아니라 현재 동작을 기준으로 합니다.

소스 오브 트루스:

- 라우트: `backend/cmd/server/main.go`
- API 동작: `backend/internal/api/handlers/replay_handler.go`
- 스키마: `backend/ent/schema/game.go`, `backend/ent/schema/replay_file.go`, `backend/ent/schema/game_analysis.go`
- snapshot 서비스: `backend/internal/services/ranking/service.go`, `backend/internal/services/analyzer/service.go`

## 제품 범위

현재 기준 제품은 아래를 제공합니다.

1. Brood War replay 업로드/파싱/저장
2. 동일 게임 다중 업로드 기반 reliability 모델
3. 게임 목록/상세/시각화 조회
4. 플레이어 통계 및 사용자 이름 suggestion
5. snapshot 기반 3v3 랭킹
6. snapshot 기반 종족 조합 승률 분석
7. 비동기 replay analyzer 상태/결과 조회
8. 시즌 라벨 설정과 시즌별 전적 조회
9. Next.js 대시보드와 MCP/LLM용 팀 분석 raw endpoint

현재 범위 밖:

- 기존 DB 데이터 일괄 backfill
- analyzer 자동 polling

## 현재 운영 UI

- 운영 웹 엔트리포인트는 Railway `stareplays-next` 서비스의 `frontend/app-next`입니다.
- `frontend/web`은 legacy UI 참고용으로 유지합니다.
- `Analyzer` 화면은 polling 없이 수동 새로고침으로 analyzer 상태를 갱신합니다.
- `/api/team-analysis/raw`는 MCP/LLM 분석용 raw JSON을 제공합니다.

## 도메인 규칙

### 1. 게임 식별

- `games`는 `host + start_time`으로 unique 식별합니다.
- 이 규칙에 따라 같은 게임의 다중 업로드를 하나의 `game` row에 합칩니다.

### 2. 플레이어 저장 규칙

- observer는 저장하지 않습니다.
- `players`는 `game + player_id`가 unique 입니다.

### 3. 업로드 이력과 reliability

- `replay_files`는 업로드 이력입니다.
- `game + uploader`가 unique 이므로 같은 유저의 같은 게임 중복 업로드는 거부합니다.
- 다른 업로더가 같은 게임을 업로드하면 `upload_count`가 증가합니다.
- reliability 표현은 `m/N`이며:
  - `m = upload_count`
  - `N = player_count`

### 4. analyzer 상태 모델

- `game_analyses`는 게임당 1 row를 유지합니다.
- 상태 값:
  - `not_requested`
  - `queued`
  - `running`
  - `succeeded`
  - `failed`

### 5. analyzer 재큐잉 규칙

- 통합 이전 DB의 기존 게임에 대해 자동 backfill 하지 않습니다.
- 신규 업로드 replay만 analyzer 대상입니다.
- 현재 구현 기준 재큐잉은 아래 경우에만 발생합니다.
  - `same game_id + same file_hash + different analyzer_version`
- 아래 경우에는 중복 큐잉하지 않습니다.
  - `same game_id + same file_hash + same analyzer_version`
- `same game_id + different file_hash`는 현재 자동 재큐잉 조건으로 사용하지 않습니다.
- 여기서 `analyzer_version`은 `REPLAY_ANALYZER_VERSION`으로 enqueue된 DB/job 버전입니다.
- 현재 worker는 이 값을 `replay_analyzer -analyzer-version`으로 전달하지 않으므로, analyzer 산출물 `metadata.json.analyzer_version`은 별도 값일 수 있습니다.

## API 표면

기본 prefix:

- `/api/v1`

### 1. Health Check

- `GET /health`
- 응답: `{"status":"ok"}`

### 2. Replay Upload Preview

- `POST /api/v1/games/upload/preview`
- multipart form-data
  - `replay_file` 또는 `replay_files`
- 목적:
  - 실제 저장 전 replay 메타와 플레이어 이름을 preview

### 3. Replay Upload

- `POST /api/v1/games/upload`
- multipart form-data
  - `replay_file` 또는 `replay_files`
  - `uploader_name`

동작:

- replay를 파싱합니다.
- `games`, `players`, `game_details`, `replay_files`, `users`를 반영합니다.
- replay 원본을 bucket에 저장합니다.
- 필요 시 `game_analyses`를 enqueue 합니다.

주요 규칙:

- 같은 유저의 같은 게임 재업로드는 `409`
- 다른 유저의 같은 게임 업로드는 허용
- 같은 replay/analyzer version이면 analyzer 중복 큐잉 안 함

### 4. Local Parse Dev Endpoint

- `POST /api/v1/games/parse`
- `DISABLE_LOCAL_PARSE=false`일 때만 노출됩니다.
- 운영에서는 비활성화하는 것이 기본 정책입니다.

### 5. List Games

- `GET /api/v1/games`
- query:
  - `limit` 기본 `10`, 최대 `100`
  - `offset` 기본 `0`
  - `user_name` 선택
  - `season_label` 선택

응답 특성:

- `games`
- `total`
- `reliability_summaries`
- `analysis_statuses`

### 5-1. List Replay File Hashes

- `GET /api/v1/games/replay-file-hashes`
- 목적:
  - 대량 업로드 도구가 이미 업로드된 replay hash를 확인해 중복 업로드를 피할 수 있게 합니다.

### 6. Get Game

- `GET /api/v1/games/:id`
- 응답:
  - `game`
  - `reliability_m_of_n`
  - `reliability`

### 7. Get Game Detail

- `GET /api/v1/games/:id/detail`
- 응답에는 시각화 데이터와 함께 아래가 포함됩니다.
  - `detail`
  - `analysis_status`
  - `tech_tree`
  - `unit_production`
  - `unit_production_versions`
  - `resource_spend`

### 8. Get Game Analyzer

- `GET /api/v1/games/:id/analyzer`

응답 규칙:

- 게임이 없으면 `404`
- analyzer row가 없으면 `200` + `status=not_requested`
- analyzer row가 있으면 아래 메타를 반환
  - `analyzer_version`
    - DB/job 버전(`REPLAY_ANALYZER_VERSION`)
    - analyzer 산출물 `metadata.json.analyzer_version`에서 읽은 값은 아님
  - `status`
  - `progress_message`
  - `attempt_count`
  - `last_error`
  - `requested_at`
  - `started_at`
  - `finished_at`
  - `updated_at`
  - `next_retry_at`
  - `next_refresh_hint=manual_refresh`
- `succeeded`일 때만 `result.quality_report`, `result.summary`, `result.analysis_phase`를 포함합니다.
- analyzer 산출물 `metadata.json.analysis_contract_version`, `metadata.json.analyzer_version`은 현재 API 응답에 별도 노출되지 않습니다.
- 운영 정합성을 위해 worker는 `replay_analyzer` 실행 시 `-analyzer-version "$REPLAY_ANALYZER_VERSION"`를 전달해야 합니다.

### 9. Delete Game

- `DELETE /api/v1/games/:id`

### 10. Player Stats

- `GET /api/v1/players/:name/stats`
- 플레이어 단위 통계와 최근 게임/맵/매치업 관련 데이터를 반환합니다.

### 11. User Suggestions

- `GET /api/v1/users/suggest`
- query:
  - `q`
  - `limit` 기본 `5`, 최대 `5`
- 동작:
  - 사용자 이름 자동완성용
  - prefix 기준으로 최대 5개 반환

### 12. 3v3 Rankings

- `GET /api/v1/rankings/3v3`
- query:
  - `page` 기본 `1`
  - `page_size` 기본 `20`, 최대 `100`
  - `limit` legacy 하위호환. 주어지면 `page_size=limit`, `page=1`
  - `min_games` 기본 `0`
  - `sort_by` 기본 `win_rate`
  - `sort_dir` 기본 `desc`

주의:

- 이 API는 raw 게임을 실시간 집계하지 않습니다.
- `ranking_3v3` snapshot 테이블이 비어 있으면 결과도 비거나 `503`이 날 수 있습니다.

### 13. Race Matchup Analyzer

- `GET /api/v1/analyzer/race-matchups`
- query:
  - `team_size` 기본 `0`
  - `page` 기본 `1`
  - `page_size` 기본 `50`, 최대 `500`
  - `limit` legacy 하위호환
  - `sort_by` 기본 `games`
  - `sort_dir` 기본 `desc`

주의:

- 이 API도 snapshot 기반입니다.
- `analyzer_race_matchups`가 준비되지 않으면 `503`이 날 수 있습니다.

### 14. Seasons

- `GET /api/v1/seasons`
- 목적:
  - 시즌 라벨이 있는 게임을 시즌별로 묶어 반환합니다.
  - 각 시즌의 경기 목록, 승패, replay analyzer 기반 시즌 분석 지표를 포함합니다.
  - 현재 설정된 시즌도 함께 반환합니다.

### 15. Set Current Season

- `PUT /api/v1/seasons/current`
- 요청 body:

```json
{
  "season_label": "시즌8",
  "season_no": 8
}
```

- 목적:
  - 이후 replay 업로드 시 기본 적용할 시즌을 설정합니다.

### 16. Set Game Season

- `PUT /api/v1/games/:id/season`
- 요청 body:

```json
{
  "season_label": "시즌8",
  "season_no": 8
}
```

- 목적:
  - 이미 저장된 특정 게임의 시즌 메타데이터를 수정합니다.

## Next raw endpoint

Next.js 앱은 MCP/LLM 분석용 raw endpoint를 제공합니다.

- `GET /api/team-analysis/raw`
- `GET /api/team-analysis/raw?season_label=시즌7`

특성:

- Fiber `/api/v1`가 아니라 `stareplays-next`의 Next route입니다.
- 현재 별도 인증 없이 JSON을 반환합니다.
- 응답에는 `schemaVersion`, `generatedAt`, `scope`, `source`, `analysis`, `llm`이 포함됩니다.
- 상세 데이터 계약은 `mcp/stareplays-mcp/README.md`에서 관리합니다.

## 백그라운드 작업 명세

### 1. Replay Analyzer Worker

실행 엔트리포인트:

- `backend/cmd/replay-analyzer-worker`

기본 동작:

- PostgreSQL `LISTEN/NOTIFY` 수신
- poll fallback
- `FOR UPDATE SKIP LOCKED`로 queue claim
- bucket download
- analyzer 실행
- 성공/실패/재시도 반영

기본 env:

- `REPLAY_ANALYZER_WORKER_LISTEN_CHANNEL=replay_analysis_jobs`
- `REPLAY_ANALYZER_WORKER_POLL_INTERVAL_SEC=10`
- `REPLAY_ANALYZER_WORKER_EXEC_TIMEOUT_SEC=1200`
- `REPLAY_ANALYZER_WORKER_MAX_ATTEMPTS=3`
- `REPLAY_ANALYZER_WORKER_RETRY_BACKOFF_SEC=60`

### 2. Ranking Job

실행 엔트리포인트:

- `backend/cmd/ranking-job`

모드:

- `RANKING_JOB_MODE=once`
- `RANKING_JOB_MODE=daemon`

기본값:

- `RANKING_MIN_GAMES=20`
- `RANKING_JOB_INTERVAL=10m`

### 3. Analyzer Job

실행 엔트리포인트:

- `backend/cmd/analyzer-job`

모드:

- `ANALYZER_JOB_MODE=once`
- `ANALYZER_JOB_MODE=daemon`

기본값:

- `ANALYZER_JOB_INTERVAL=10m`

## 운영 제약

1. API와 replay analyzer worker는 동일한 bucket 설정을 공유해야 합니다.
2. 운영 worker는 `/data/mpq` MPQ 자산이 반드시 필요합니다.
3. 운영 bucket은 `REPLAY_BUCKET_PATH_STYLE=false` 기준입니다.
4. 로컬 MinIO 검증에서는 `REPLAY_BUCKET_PATH_STYLE=true`를 사용합니다.
5. replay analyzer worker Docker build는 private GitHub repo 접근 token이 필요할 수 있습니다.

## 현재 완료 상태

- replay analyzer 운영 통합 완료
- Railway bucket 연결 완료
- 운영 worker 기동 및 실제 업로드 `job succeeded` 확인 완료
- legacy web에서 Recent Games / Analyzer 수동 새로고침 UX 확인 완료
