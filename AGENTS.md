# StaReplays Agent Instructions

이 문서는 Codex와 다른 자동화 에이전트가 이 레포지토리에서 작업할 때 반드시 따르는 루트 작업 계약입니다.

## 프로젝트 맥락 먼저 읽기

이 레포는 단일 프런트 앱이 아니라 운영 API, Next 대시보드, replay analyzer worker, snapshot job, MCP 커넥터를 함께 관리하는 통합 운영 레포다. 작업을 시작하면 README의 전체 구조를 이 파일의 요약과 함께 해석한다.

작업 전 최소 확인 문서:

- `README.md`: 제품 기능, 시스템 구조, 운영 URL, 주요 디렉터리
- `docs/DEVELOPMENT_GUIDE.md`: 동료용 개발/배포 시작 가이드
- `docs/architecture.md`: 현재 런타임 구조와 요청 흐름
- `docs/spec.md`: 현재 API와 기능 명세
- `docs/metrics/reliability-and-time-bucket-stats.md`: 분석 지표 신뢰도와 사용 가능/불가 기준

전체 맥락을 놓치기 쉬운 작업에서는 README를 다시 열고, 변경 파일이 어느 런타임 서비스에 영향을 주는지 먼저 적는다.

## 현재 시스템 구조

```text
Browser
  -> stareplays-next (Next.js dashboard + /api/team-analysis/raw)
       -> stareplays API

stareplays API (Go/Fiber)
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

- 운영 웹 UI는 `frontend/app-next`의 Next App Router 앱이다.
- legacy `frontend/web`은 동작/표현 참고용이며 새 화면의 운영 기준이 아니다.
- `stareplays-next`는 화면과 MCP/LLM용 `/api/team-analysis/raw`를 제공한다.
- `stareplays`는 Go/Fiber 공개 API이며 `/api/v1`을 제공한다.
- 랭킹과 종족 조합은 snapshot job 결과를 읽는다. 업로드 직후에는 job 주기 때문에 잠시 늦을 수 있다.
- replay analyzer는 업로드 요청 경로와 분리된 worker에서 비동기로 처리한다.
- 시즌/팀 분석은 3x3 공식전 데이터만 소스로 사용한다.

## 주요 디렉터리와 책임

| 경로 | 책임 |
| --- | --- |
| `backend` | Go/Fiber API, Ent schema, replay upload/parser, snapshot 조회 API |
| `backend/cmd/ranking-job` | 3x3 랭킹 snapshot 생성 |
| `backend/cmd/analyzer-job` | 종족 조합 승률 snapshot 생성 |
| `backend/cmd/replay-analyzer-worker` | replay 분석 worker 실행 래퍼 |
| `frontend/app-next` | 운영 Next.js 대시보드와 raw endpoint |
| `frontend/web` | legacy UI 참고용 |
| `mcp/stareplays-mcp` | Claude Desktop, Claude Code, Codex용 MCP 로컬 커넥터 |
| `railway.*.toml` | Railway 서비스별 배포 설정 |
| `docs` | 구조, 명세, 운영, 작업 기록 |

## 변경 영향 범위 판단

작업 전 변경 파일 기준으로 영향을 받는 서비스와 검증 대상을 결정한다.

| 변경 영역 | 영향 서비스 | 반드시 확인할 것 |
| --- | --- | --- |
| `frontend/app-next/**` | `stareplays-next` | page model, route cache, `/api/team-analysis/raw`, 화면 build |
| `frontend/app-next/app/api/**` | `stareplays-next` | Next route cache, MCP raw 계약, 응답 크기/시간 |
| `backend/**` | `stareplays`, job/worker 일부 | API 응답 계약, Ent schema, DB migration, list/detail payload 크기 |
| `backend/cmd/ranking-job`, `backend/internal/services/ranking` | `ranking-job`, 랭킹 화면 | snapshot 재생성 타이밍과 랭킹 API |
| `backend/cmd/analyzer-job`, `backend/internal/services/analyzer` | `analyzer-job`, 종족 조합 화면 | race matchup snapshot |
| `backend/cmd/replay-analyzer-worker`, analyzer 연동 | `replay_analyzer` | worker queue, replay bucket, analyzer artifact |
| `mcp/**`, `/api/team-analysis/raw` | MCP 사용자와 LLM 분석 | raw schema, 인증 여부, 설치 가이드 |
| `docs`, `README.md`, `AGENTS.md`, `CLAUDE.md` | 배포 없음이 원칙 | 현재 코드/서비스명/URL과 불일치 여부 |

## 데이터/지표 가드레일

- 사용자-facing 분석 수치는 hardcoded 운영 값이 아니라 API/model 값으로 계산한다.
- 미수집, 전원 0, 전원 동일, 표본 부족 지표를 의미 있는 역량 점수처럼 보정하지 않는다.
- 불완전한 analyzer 지표는 UI/인사이트에 쓰기 전에 `docs/metrics/reliability-and-time-bucket-stats.md` 기준으로 사용 가능 여부를 확인한다.
- `GameDetail` 같은 heavy raw payload는 list API에 직접 노출하지 않는다. 목록은 필요한 파생 summary만 내려주고, 원문은 `/api/v1/games/:id/detail`에서 조회한다.
- 표본 부족 종족/조합은 “최강” 판정에서 제외하거나 별도 표본 부족 표기를 한다.

## 캐시와 빠른 운영 검증

Next route와 API fetch는 `revalidateSeconds`, `Cache-Control`, Railway edge cache 영향을 받는다. 운영 배포 직후 검증할 때 캐시 때문에 오래된 값이 보일 수 있으므로 아래 순서로 확인한다.

1. 백엔드 직접 API를 먼저 확인한다.
   ```bash
   curl -sS -w '\nHTTP %{http_code} bytes %{size_download} time %{time_total}\n' \
     'https://stareplays-production.up.railway.app/api/v1/games?limit=100&offset=0&cache_bust=<commit>' \
     -o /tmp/stareplays-games.json
   ```
2. Next raw endpoint는 cache-busting query를 붙여 확인한다.
   ```bash
   curl -sS -w '\nHTTP %{http_code} bytes %{size_download} time %{time_total}\n' \
     'https://stareplays.up.railway.app/api/team-analysis/raw?cache_bust=<commit>' \
     -o /tmp/stareplays-team-analysis-raw.json
   ```
3. 캐시 갱신 기능이 필요한 변경이면 별도 feature branch에서 명시적 refresh endpoint나 `refresh=1` no-store 경로를 테스트와 함께 추가한다.
4. 검증 결과에는 HTTP status, response size, time, 핵심 JSON 필드 값을 함께 남긴다.

캐시 때문에 값이 늦게 보이는 문제를 코드 문제로 단정하지 않는다. 먼저 백엔드 직접 응답과 Next raw 응답을 분리해서 비교한다.

## 절대 작업 사이클

운영에 반영되는 모든 코드/문서 변경은 아래 순서를 지킵니다.

1. `main`을 최신 원격 기준으로 맞춘다.
2. 작업별 feature branch를 만든다.
3. feature branch에서 구현, 테스트, 문서 갱신을 끝낸다.
4. feature branch를 `main`에 병합한다.
5. `main`을 원격에 push한다.
6. Railway production은 GitHub `main` push 기반 Autodeploy로만 배포한다.
7. 배포 후 Railway Dashboard와 운영 endpoint를 확인한다.

작업 중 바로 `main`에서 수정하거나, feature branch 변경을 main 병합 없이 배포하지 않는다. 긴급 수정도 feature branch를 만들고 검증 후 main에 병합한다.

## 시작 체크리스트

작업 시작 시 항상 확인한다.

```bash
git status --short --branch
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feat/<short-task-name>
```

이미 다른 작업이 진행 중인 브랜치라면 변경을 덮어쓰지 않는다. 독립 작업은 새 branch 또는 worktree에서 진행한다.

## 검증 기준

변경 범위가 좁아도 관련 테스트를 먼저 돌리고, 배포 전에는 최소 아래를 확인한다.

프런트 변경:

```bash
cd frontend/app-next
npm test -- --run <관련 테스트 파일>
npm run typecheck
npm run build
```

백엔드 변경:

```bash
cd backend
go test ./...
```

문서만 변경한 경우에도 링크, 명령, 서비스명, 경로가 현재 코드와 맞는지 `rg`로 확인한다.

## Main 병합

feature branch 검증 후 main에 병합한다.

```bash
git switch main
git pull --ff-only origin main
git merge --no-ff <feature-branch>
git push origin main
```

충돌이 있으면 충돌 내용을 읽고 현재 main 기준으로 해결한다. 사용자 변경을 임의로 되돌리지 않는다.

## Railway 배포 원칙

배포 전 반드시 [docs/RAILWAY_DEPLOYMENT_GUIDE.md](docs/RAILWAY_DEPLOYMENT_GUIDE.md)를 읽는다.

중요 규칙:

- 운영 배포 기준은 항상 `origin/main`이다.
- 기본 배포 경로는 Railway CLI가 아니라 GitHub `main` push -> Railway Autodeploy다.
- Dashboard 설정은 [docs/RAILWAY_GITHUB_DEPLOYMENT_SETUP.md](docs/RAILWAY_GITHUB_DEPLOYMENT_SETUP.md)의 서비스별 표와 일치해야 한다.
- `stareplays-next`는 반드시 `frontend/app-next`를 archive root로 배포한다.
- `stareplays-next`를 레포 루트에서 `railway up`으로 배포하지 않는다. 이 경우 `frontend/app-next/railway.toml`을 못 읽고 Railpack 기본 감지로 실패한다.
- API `stareplays`는 레포 루트에서 `railway.api.toml` 기준으로 배포한다.
- Railway CLI 명령은 운영자 복구용이다. 팀원용 배포 안내에서는 CLI를 기본 경로로 제시하지 않는다.
- CLI를 사용할 때도 서비스명을 명시하지 않은 `railway up`은 사용하지 않는다.

GitHub Autodeploy 필수 설정:

- 모든 service source repo: `xungwoo/stareplays`
- 모든 service trigger branch: `main`
- `stareplays-next` Root Directory: `frontend/app-next`
- `stareplays-next` Railway Config File: `/frontend/app-next/railway.toml`
- API `stareplays` Railway Config File: `/railway.api.toml`

CLI 권한이 있는 운영자 복구용 프런트 배포:

```bash
railway up frontend/app-next \
  --path-as-root \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "<main commit summary>"
```

임시 worktree에서 프로젝트 링크가 없으면 project id를 함께 명시한다.

```bash
railway up frontend/app-next \
  --path-as-root \
  --project 838683d6-9fb8-41d6-ad8a-1075e4d00196 \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "<main commit summary>"
```

CLI 권한이 있는 운영자 복구용 API 배포:

```bash
railway up \
  --service stareplays \
  --environment production \
  --detach \
  --message "<main commit summary>"
```

CLI 권한이 있는 운영자 확인:

```bash
railway service status --service stareplays --environment production
railway service status --service stareplays-next --environment production
railway deployment list --service stareplays --environment production
railway deployment list --service stareplays-next --environment production
curl -sS -I https://stareplays-production.up.railway.app/health
curl -sS -I https://stareplays.up.railway.app/team-analysis
```

## 실패 복구

`stareplays-next` 배포가 `No start command detected`, `RAILPACK`, 빈 manifest, 또는 `frontend/app-next/railway.toml` 누락 증상을 보이면 잘못된 root로 배포한 것이다. 즉시 올바른 명령으로 재배포한다.

```bash
railway up frontend/app-next \
  --path-as-root \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "Recover frontend deployment root"
```

## 문서 동기화

배포 방식, 서비스명, endpoint, MCP/raw data 계약을 바꾸면 아래 문서를 함께 갱신한다.

- `CLAUDE.md`
- `README.md`
- `docs/RAILWAY_DEPLOYMENT_GUIDE.md`
- `frontend/app-next/README.md`
- `mcp/stareplays-mcp/README.md`

Claude와 Codex는 이 파일과 `CLAUDE.md`의 작업 사이클/배포 규칙을 동일하게 취급한다.
