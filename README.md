# StaReplays

StarCraft: Brood War replay를 업로드하고, 3x3 시즌 전적과 팀 매치업을 분석하는 웹 대시보드입니다.

이 저장소는 운영 API, replay 분석 worker, snapshot job, Next.js 대시보드, MCP 로컬 커넥터를 함께 관리합니다. 새로 참여하는 동료는 아래 순서로 보면 전체 구조를 빠르게 잡을 수 있습니다.

## 빠른 링크

- 개발 시작 가이드: [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md)
- MCP 설치 가이드: [`mcp/stareplays-mcp/README.md`](mcp/stareplays-mcp/README.md)
- 지표 신뢰도/통계 설계: [`docs/metrics/reliability-and-time-bucket-stats.md`](docs/metrics/reliability-and-time-bucket-stats.md)

1. 제품 화면은 `frontend/app-next`에서 확인합니다.
2. API와 데이터 저장 규칙은 `backend`에서 확인합니다.
3. 주기 집계는 `ranking-job`, `analyzer-job` snapshot을 기준으로 확인합니다.
4. 개인 Claude Desktop/Claude Code/Codex 연동은 `mcp/stareplays-mcp`에서 확인합니다.

## 제공 기능

### Replay 수집과 분석

- Brood War `.rep` 파일 업로드와 replay 메타 파싱
- 3x3 공식전 기준 게임/플레이어/종족/팀 정보 저장
- 3x3이 아닌 플레이어가 포함된 게임은 시즌 분석 대상에서 제외
- 동일 게임 다중 업로드 기반 reliability 모델 (`m/N`)
- Replay 원본 bucket 저장 후 비동기 analyzer worker 큐잉
- analyzer/detail 결과 기반 APM/EAPM, 빌드/타임라인, 품질 리포트 조회

### 웹 대시보드

- `/` Dashboard: 최근 게임, 주요 지표, 업로드 진입점
- `/vault`: 게임 목록과 상세 replay 분석 뷰
- `/analyzer`: 선택 게임의 분석 결과, 피지컬/전투/생산 관련 지표
- `/rankings`: snapshot 기반 3v3 랭킹과 종족 조합 승률
- `/team-analysis`: 시즌/전체 3x3 팀 매치업 분석 대시보드
- `/seasons`: 시즌별 전적, 플레이어 승패/승률 추이, 경기 목록

### 팀 전적 인사이트

- Bradley-Terry, TrueSkill 기반 선수 역량 비교
- 승패 감각, 종족 역량, replay 피지컬 오각형
- 플레이어별 고정 컬러 뱃지와 종족별 고정 컬러 조합 뱃지
- BEST/위험 조합, duo 궁합, 강점/약점 insight card
- 표본이 부족한 종족 조합은 “최강” 판정에서 제외하거나 별도 표기

### LLM/MCP 연동

- `/api/team-analysis/raw`로 팀 분석 raw data 제공
- `mcp/stareplays-mcp`를 통해 Claude Desktop, Claude Code, Codex에서 raw data를 도구처럼 조회
- API key 없이 로컬 MCP connector가 개인 LLM 클라이언트와 웹 데이터를 이어주는 구조
- 소스코드 checkout 없이 설치 가능: `mcp/stareplays-mcp/README.md`

## 시스템 구조

```text
Browser
  -> stareplays-next (Next.js dashboard)
       -> stareplays API

stareplays API (Fiber)
  -> Postgres
  -> replay-bucket
  -> pg_notify(replay_analysis_jobs)

replay_analyzer worker
  -> Postgres LISTEN/NOTIFY + poll fallback
  -> replay-bucket replay 다운로드
  -> replay_analyzer/openbw 실행
  -> game_analyses 결과 저장

ranking-job
  -> ranking_3v3 snapshot 재생성

analyzer-job
  -> analyzer_race_matchups snapshot 재생성
```

핵심 원칙:

- 웹 화면은 API 실시간 전수 집계가 아니라 snapshot과 page model을 읽습니다.
- 무거운 집계는 cron job이 snapshot 테이블로 재생성합니다.
- replay analyzer는 업로드 요청 경로와 분리된 worker에서 비동기로 처리합니다.
- 시즌/팀 분석은 3x3 공식전 데이터만 소스로 사용합니다.

## 주요 디렉터리

| 경로 | 역할 |
| --- | --- |
| `frontend/app-next` | 운영 Next.js 대시보드 |
| `frontend/web` | legacy static UI. 동작 참고용으로 유지 |
| `backend/cmd/server` | Fiber API 서버 |
| `backend/cmd/ranking-job` | 3v3 랭킹 snapshot 생성 |
| `backend/cmd/analyzer-job` | 종족 조합 승률 snapshot 생성 |
| `backend/cmd/replay-analyzer-worker` | replay analyzer worker |
| `backend/ent/schema` | Postgres schema 정의 |
| `backend/internal/api/handlers` | HTTP API handler |
| `backend/internal/services` | ranking/analyzer/migration 서비스 로직 |
| `mcp/stareplays-mcp` | Claude Desktop/Claude Code/Codex MCP 로컬 커넥터 |
| `scripts` | 로컬 서버/worker/stack 실행 스크립트 |
| `docs` | 구조, 명세, 작업 기록 |

## 로컬 개발 빠른 시작

### 1. API 서버

```bash
cd backend
go run ./cmd/server
```

기본 API URL은 `http://127.0.0.1:3000/api/v1`입니다.

### 2. Next 대시보드

```bash
cd frontend/app-next
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`의 기본 API 주소:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
```

Next dev 서버는 `http://127.0.0.1:3100`에서 실행됩니다.

### 3. 로컬 전체 스택

업로드, bucket 저장, analyzer worker까지 같이 점검하려면:

```bash
./scripts/start_local_stack.sh
./scripts/status_local_stack.sh
```

중지:

```bash
./scripts/stop_local_stack.sh
```

## 검증 명령

프런트:

```bash
cd frontend/app-next
npm test
npm run typecheck
npm run build
```

백엔드:

```bash
cd backend
go test ./...
```

변경 범위가 좁아도 최소한 관련 테스트, typecheck, production build는 통과시킨 뒤 main에 올립니다.

## 작업 사이클

운영 반영 작업은 항상 feature branch에서 진행한 뒤 main에 병합합니다. Claude/Codex 공통 지침은 루트의 `AGENTS.md`와 `CLAUDE.md`를 기준으로 합니다.

필수 흐름:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feat/<short-task-name>

# work + verify

git switch main
git pull --ff-only origin main
git merge --no-ff feat/<short-task-name>
git push origin main
```

운영 배포는 `origin/main`에 병합된 커밋만 대상으로 합니다. feature branch를 main에 병합하지 않은 상태로 배포하지 않습니다.

## 운영 배포

운영은 Railway production environment를 사용합니다.

기본 배포 경로는 **GitHub `main` push -> Railway Autodeploy**입니다. 팀원은 Railway CLI 권한 없이 feature branch를 `main`에 병합하고 push하는 방식으로 운영 배포를 발생시킵니다.

배포 상세와 복구 절차는 [docs/RAILWAY_DEPLOYMENT_GUIDE.md](docs/RAILWAY_DEPLOYMENT_GUIDE.md)를 기준으로 합니다. Railway Dashboard 설정표는 [docs/RAILWAY_GITHUB_DEPLOYMENT_SETUP.md](docs/RAILWAY_GITHUB_DEPLOYMENT_SETUP.md)를 기준으로 합니다. 이 문서들이 README보다 우선합니다.

| Railway service | 소스/빌드 | 역할 |
| --- | --- | --- |
| `stareplays-next` | Root `frontend/app-next`, config `/frontend/app-next/railway.toml` | 운영 웹 대시보드 |
| `stareplays` | Root 비움, config `/railway.api.toml` | 공개 API |
| `ranking-job` | Root 비움, config `/railway.ranking.toml` | 랭킹 snapshot cron/job |
| `analyzer-job` | Root 비움, config `/railway.analyzer.toml` | 종족 조합 snapshot cron/job |
| `replay_analyzer` | Root 비움, config `/railway.replay-analyzer-worker.toml` | replay analyzer worker |
| `Postgres` | Railway managed Postgres | 영속 저장소 |

### GitHub Autodeploy 준비

Railway Dashboard에서 각 service의 source repo를 `xungwoo/stareplays`, trigger branch를 `main`으로 설정합니다. `stareplays-next`는 반드시 Root Directory를 `frontend/app-next`, Railway Config File을 `/frontend/app-next/railway.toml`로 둡니다.

자동 배포가 켜져 있으면 `git push origin main` 이후 Railway가 production deployment를 생성합니다. 자동 배포가 꺼져 있다면 Dashboard에서 `CMD + K` -> `Deploy Latest Commit`으로 연결된 `main` 최신 커밋을 배포합니다.

### CLI 복구용 프런트 배포

아래 명령은 팀 공용 경로가 아니라 Railway CLI 권한이 있는 운영자 복구용입니다. main에 변경을 푸시한 뒤 Next 앱만 수동 복구 배포할 때 사용합니다.

```bash
railway up frontend/app-next \
  --path-as-root \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "Deploy dashboard update"
```

임시 worktree에서 배포할 때는 project id를 명시합니다.

```bash
railway up frontend/app-next \
  --path-as-root \
  --project 838683d6-9fb8-41d6-ad8a-1075e4d00196 \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "Deploy dashboard update"
```

배포 확인:

```bash
railway service status --service stareplays-next --environment production
railway deployment list --service stareplays-next --environment production
curl -I https://stareplays.up.railway.app/team-analysis
curl -I https://stareplays.up.railway.app/seasons
curl -I https://stareplays.up.railway.app/rankings
```

### CLI 복구용 API/worker/job 배포

아래 명령은 팀 공용 경로가 아니라 Railway CLI 권한이 있는 운영자 복구용입니다. API, job, worker는 서비스별 Railway 설정이 다릅니다. 해당 서비스만 지정해서 배포하고, API schema나 snapshot 로직을 건드렸다면 운영 데이터 확인까지 같이 합니다.

```bash
railway up --service stareplays --environment production --detach --message "Deploy API update"
railway up --service ranking-job --environment production --detach --message "Deploy ranking job update"
railway up --service analyzer-job --environment production --detach --message "Deploy analyzer job update"
```

worker는 replay analyzer/openbw 의존성이 있으므로 Dockerfile과 Railway env를 함께 확인해야 합니다.

## 데이터와 시즌 운영 메모

- 시즌 페이지와 팀 분석 페이지는 같은 3x3 공식전 소스를 바라봐야 합니다.
- 랭킹은 `ranking_3v3` snapshot 기준이므로 업로드 직후에는 job 실행 전까지 경기 수가 잠시 뒤처질 수 있습니다.
- 종족 조합 인사이트는 표본 수가 낮은 조합을 과대표현하지 않도록 최소 표본 기준을 둡니다.
- 플레이어 표기는 앱 전반에서 한국어 별칭을 우선 사용합니다.
  - `3x3_mh`: 민혁
  - `3x3_smwoo`: 성민
  - `3x3_Kiyong`: 기용
  - `3x3_syntax`: 명진
  - `3x3_pil`: 필균
  - `3x3_GG`: 성우

## 개발 규칙

- main이 운영 배포 기준입니다.
- 기능 변경은 작은 단위로 커밋하고, 변경 이유와 검증 결과를 커밋 메시지에 남깁니다.
- 사용자-facing 분석 수치에는 hardcoded 운영 값 대신 API/model 값을 사용합니다.
- UI에서 플레이어/종족을 반복 표기할 때는 공용 `PlayerBadge`, `RaceBadge`, `RaceCompositionBadges`를 우선 사용합니다.
- 새 dependency는 꼭 필요할 때만 추가합니다.
- legacy UI는 동작/표현 참고용으로 볼 수 있지만, 새 화면은 `frontend/app-next`에서 일관된 디자인 시스템으로 구현합니다.

## 문서

- 현재 시스템 구조: `docs/architecture.md`
- 현재 기능 명세: `docs/spec.md`
- StarProjects 레포지토리와 Railway 배포 모듈 개요: `docs/starprojects-railway-overview.md`
- Railway GitHub Dashboard 배포 설정: `docs/RAILWAY_GITHUB_DEPLOYMENT_SETUP.md`
- Railway 운영 배포/복구 가이드: `docs/RAILWAY_DEPLOYMENT_GUIDE.md`
- Next 프런트 현재 구조/legacy parity 상태: `docs/frontend-next-architecture.md`
- 완료된 작업 기록/검증 runbook: `docs/histories/`
- 상세 API 예시(보조 문서): `API_USAGE.md`
- Claude Desktop/Claude Code/Codex MCP 로컬 커넥터 설치: `mcp/stareplays-mcp/README.md`

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

- 운영 프런트는 Next App Router 기반 `frontend/app-next`입니다.
- legacy `frontend/web`은 동작과 표현을 참고하기 위한 parity 기준으로 유지합니다.
- 현재 `Dashboard / Vault / Analyzer / Rankings / Team Analysis / Seasons`의 주요 화면이 Next 앱에 구성되어 있습니다.
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

`GET /games?limit=10&offset=0&season_label=시즌8`

- 응답에 `reliability_summaries` 포함 (`m_of_n`, `reliability`)
- `season_label`로 시즌 게임만 조회 가능

### 2-1) Replay hash 목록

`GET /games/replay-file-hashes`

- 대량 업로드 도구가 이미 업로드된 replay hash를 확인하는 용도

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
- Next `/analyzer` 화면은 polling 없이 새로고침/수동 reanalyze 버튼으로 상태를 갱신

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

### 10) 시즌 목록

`GET /seasons`

- 시즌 라벨이 있는 게임을 시즌별로 묶어 반환
- 현재 설정된 시즌과 시즌별 경기 목록/분석 요약 포함

### 11) 현재 시즌 설정

`PUT /seasons/current`

```json
{
  "season_label": "시즌8",
  "season_no": 8
}
```

- 이후 replay 업로드에 기본 적용할 시즌 설정

### 12) 게임 시즌 수정

`PUT /games/:id/season`

```json
{
  "season_label": "시즌8",
  "season_no": 8
}
```

- 이미 저장된 게임의 시즌 메타데이터 수정

## Next raw endpoint

기본 URL: `http://localhost:3100`

`GET /api/team-analysis/raw`

`GET /api/team-analysis/raw?season_label=시즌7`

- MCP/LLM 분석용 raw JSON
- 현재 별도 인증 없음
- 응답 계약과 MCP 도구 매핑은 `mcp/stareplays-mcp/README.md` 기준
- raw v2는 선수별 `is_random_selected`를 원천으로 사용하며, 경기 단위 랜덤 선택 요약 필드는 제공하지 않는다.

## 실행

환경변수 설정 후:

```bash
cd backend && go run ./cmd/server
```

또는

```bash
make run
```

## Claude Desktop/Claude Code/Codex MCP 로컬 커넥터

Stareplays 팀 분석 raw data를 개인 Claude Desktop, Claude Code, Codex에서 MCP 도구처럼 조회하려면 아래 가이드를 참고하세요.

- 설치 가이드: `mcp/stareplays-mcp/README.md`
- 운영 raw endpoint: `https://stareplays.up.railway.app/api/team-analysis/raw`

소스코드 checkout 없는 GitHub npx 설치:

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client all --api-base-url https://stareplays.up.railway.app
```

GitHub npx가 로컬 인증서 문제로 실패할 때 대체 설치:

```bash
curl -fsSL https://raw.githubusercontent.com/xungwoo/stareplays/main/mcp/stareplays-mcp/bin/stareplays-mcp-remote-install.mjs \
  | node - --client all --api-base-url https://stareplays.up.railway.app
```

저장소를 clone한 개발자용 설치:

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client all
```

기본 설치는 운영 API, 로컬 캐시 TTL 300초, API 타임아웃 10초, Node TLS용 CA bundle 자동 감지를 함께 설정합니다.

설치 후 Claude Desktop, Claude Code, Codex를 재시작하면 `get_team_analysis_raw`, `get_team_analysis_prompt_bundle`, `get_mcp_update_status`, `analyze_team_matchups`를 사용할 수 있습니다. 기존 호환 옵션인 `--client both`는 Claude Desktop + Codex만 설정합니다.
raw endpoint 데이터 구조, 설치 방식 선택, 수동 설정, 제거, 문제 해결은 `mcp/stareplays-mcp/README.md`를 기준으로 관리합니다.

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
