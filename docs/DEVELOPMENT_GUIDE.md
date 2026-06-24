# 개발 시작 가이드

이 문서는 StaReplays 개발을 시작할 때 필요한 최소 운영/작업 규칙만 정리합니다.

## 레포지토리 역할

| Repo | 역할 |
| --- | --- |
| `xungwoo/stareplays` | 운영 서비스 중심 레포입니다. Go API, Next.js 대시보드, Railway 설정, snapshot job, MCP 커넥터가 들어 있습니다. 대부분의 제품 개발은 여기서 합니다. |
| `xungwoo/replay_analyzer` | Brood War replay 분석 엔진입니다. OpenBW/BWAPI 기반 분석 결과 JSON을 생성합니다. |
| `xungwoo/openbw-bwapi-core` | replay analyzer가 사용하는 OpenBW backend용 BWAPI fork입니다. |
| `xungwoo/openbw-core` | OpenBW core snapshot입니다. replay analyzer 실행 체인의 하위 의존성입니다. |

## `stareplays` 주요 디렉터리

| 경로 | 역할 |
| --- | --- |
| `backend` | Go/Fiber API, Ent schema, replay upload/parser, snapshot 조회 API |
| `backend/cmd/ranking-job` | 3x3 랭킹 snapshot 생성 job |
| `backend/cmd/analyzer-job` | 종족 조합 승률 snapshot 생성 job |
| `backend/cmd/replay-analyzer-worker` | replay 분석 worker 실행 래퍼 |
| `frontend/app-next` | 운영 Next.js 대시보드 |
| `frontend/web` | legacy UI 참고용 |
| `mcp/stareplays-mcp` | Claude Desktop, Claude Code, Codex용 MCP 로컬 커넥터 |
| `railway.*.toml` | Railway 서비스별 배포 설정 |
| `docs` | 구조, 배포, 운영 문서 |

## 로컬 실행

API:

```bash
cd backend
go run ./cmd/server
```

Next 대시보드:

```bash
cd frontend/app-next
npm install
cp .env.example .env.local
npm run dev
```

기본 주소:

- API: `http://127.0.0.1:3000`
- Next: `http://127.0.0.1:3100`

## 작업 방식

운영 반영 작업은 항상 feature branch에서 시작하고, 검증 후 `main`에 병합합니다.

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

규칙:

- `main`에서 직접 작업하지 않습니다.
- feature branch를 `main`에 병합하지 않은 상태로 운영 배포하지 않습니다.
- 사용자나 다른 터미널의 변경을 임의로 되돌리지 않습니다.
- 변경한 영역의 테스트를 돌린 뒤 병합합니다.

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

MCP:

```bash
cd mcp/stareplays-mcp
npm test
```

## 운영 배포 방식

운영 배포는 Railway CLI가 아니라 **GitHub `main` push -> Railway Autodeploy**가 기본입니다.

주요 서비스:

| Railway service | 역할 | 배포 기준 |
| --- | --- | --- |
| `stareplays-next` | Next.js 운영 대시보드 | repo `xungwoo/stareplays`, branch `main`, root `frontend/app-next`, config `/frontend/app-next/railway.toml` |
| `stareplays` | Go API 서버 | repo `xungwoo/stareplays`, branch `main`, config `/railway.api.toml` |
| `ranking-job` | 3x3 랭킹 snapshot job | repo `xungwoo/stareplays`, branch `main`, config `/railway.ranking.toml` |
| `analyzer-job` | 종족 조합 snapshot job | repo `xungwoo/stareplays`, branch `main`, config `/railway.analyzer.toml` |
| `replay_analyzer` | replay 분석 worker | repo `xungwoo/stareplays`, branch `main`, config `/railway.replay-analyzer-worker.toml` |

운영 URL:

- 웹 대시보드: `https://stareplays.up.railway.app`
- API health: `https://stareplays-production.up.railway.app/health`
- MCP raw endpoint: `https://stareplays.up.railway.app/api/team-analysis/raw`

권장 watch path:

- `stareplays-next`: `/frontend/app-next/**`
- API/job/worker: `/backend/**`, 해당 `railway.*.toml`, `go.mod`, `go.sum`

문서 변경만으로 프런트 배포가 걸리지 않도록 `stareplays-next` watch path에는 `/docs/**`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `mcp/**`를 넣지 않습니다.

## 배포 확인

Railway Dashboard에서 대상 service의 latest deployment가 `SUCCESS`인지 확인합니다.

운영 endpoint:

```bash
curl -I https://stareplays.up.railway.app/team-analysis
curl -I https://stareplays.up.railway.app/seasons
curl -I https://stareplays.up.railway.app/rankings
curl -I https://stareplays-production.up.railway.app/health
```

Raw endpoint:

```bash
curl -sS -D - -o /tmp/stareplays-team-analysis-raw.json \
  -w '\nHTTP=%{http_code}\nTIME_TOTAL=%{time_total}\nSIZE=%{size_download}\n' \
  'https://stareplays.up.railway.app/api/team-analysis/raw?season_label=%EC%8B%9C%EC%A6%8C8'
```

## MCP

MCP는 백엔드 API가 아니라 Next raw endpoint를 봅니다. 이유는 LLM용 데이터 계약과 화면의 team-analysis page model을 일치시키기 위해서입니다.

설치와 문제 해결은 [`../mcp/stareplays-mcp/README.md`](../mcp/stareplays-mcp/README.md)를 기준으로 합니다.
