# CLAUDE.md

이 파일은 Claude Code가 이 레포지토리에서 작업할 때 따르는 루트 지침입니다. Codex는 `AGENTS.md`, Claude는 이 파일을 주로 읽지만, 두 파일의 작업 사이클과 배포 규칙은 동일합니다.

## 최우선 작업 사이클

운영에 반영되는 모든 변경은 feature branch에서 작업한 뒤 `main`에 병합하고, `main` 기준으로만 배포합니다.

필수 순서:

1. `main`을 최신 원격 기준으로 맞춥니다.
2. 작업별 feature branch를 생성합니다.
3. feature branch에서 구현과 검증을 완료합니다.
4. feature branch를 `main`에 병합합니다.
5. `main`을 `origin/main`에 push합니다.
6. Railway production은 GitHub `main` push 기반 Autodeploy로 배포합니다.
7. 배포 후 Railway Dashboard와 운영 endpoint를 확인합니다.

예시:

```bash
git status --short --branch
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feat/<short-task-name>

# work + tests

git switch main
git pull --ff-only origin main
git merge --no-ff feat/<short-task-name>
git push origin main
```

`main`에서 직접 작업하거나, feature branch를 main에 병합하지 않은 상태로 운영 배포하지 않습니다.

## Railway 배포 필수 규칙

배포 전 반드시 `docs/RAILWAY_DEPLOYMENT_GUIDE.md`와 `docs/RAILWAY_GITHUB_DEPLOYMENT_SETUP.md`를 읽습니다.

절대 규칙:

- 운영 배포 기준은 `origin/main`입니다.
- 기본 배포 경로는 Railway CLI가 아니라 GitHub `main` push -> Railway Autodeploy입니다.
- 팀원용 안내에서 Railway CLI를 기본 배포 수단으로 제시하지 않습니다.
- 서비스명을 명시하지 않은 `railway up`은 운영자 복구 상황에서도 사용하지 않습니다.
- `stareplays-next`는 반드시 `frontend/app-next`를 archive root로 배포합니다.
- `stareplays-next`를 레포 루트에서 배포하지 않습니다. 루트에서 올리면 `frontend/app-next/railway.toml`을 못 읽고 Railpack 기본 감지로 실패합니다.
- API `stareplays`는 레포 루트의 `railway.api.toml` 기준으로 배포합니다.

GitHub Autodeploy 필수 Dashboard 설정:

- 모든 service source repo: `xungwoo/stareplays`
- 모든 service trigger branch: `main`
- `stareplays-next` Root Directory: `frontend/app-next`
- `stareplays-next` Railway Config File: `/frontend/app-next/railway.toml`
- API `stareplays` Railway Config File: `/railway.api.toml`

Railway CLI 권한이 있는 운영자 복구용 프런트 배포:

```bash
railway up frontend/app-next \
  --path-as-root \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "<main commit summary>"
```

임시 worktree에서 Railway link가 없으면 project id를 명시합니다.

```bash
railway up frontend/app-next \
  --path-as-root \
  --project 838683d6-9fb8-41d6-ad8a-1075e4d00196 \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "<main commit summary>"
```

Railway CLI 권한이 있는 운영자 복구용 API 배포:

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
curl -sS -I https://stareplays-next-production.up.railway.app/team-analysis
```

`stareplays-next` 배포에서 `No start command detected`, `RAILPACK`, 빈 manifest가 보이면 잘못된 root로 배포한 것입니다. 즉시 위 프런트 배포 명령으로 재배포합니다.

## 현재 시스템 구조

StaReplays는 StarCraft replay 기반 3x3 전적/분석 시스템입니다.

주요 구성:

- `backend`: Go/Fiber API, Ent ORM, PostgreSQL, replay upload/parser, analyzer/ranking snapshot endpoint
- `frontend/app-next`: Next.js 운영 대시보드
- `mcp/stareplays-mcp`: Claude/Codex MCP 로컬 커넥터
- `railway.*.toml`: Railway 서비스별 배포 설정
- `docs`: 구조, 명세, 배포, 운영 문서

주요 운영 서비스:

- `stareplays-next`: Next.js 운영 대시보드
- `stareplays`: Go API
- `ranking-job`: 랭킹 snapshot job
- `analyzer-job`: 종족 조합 snapshot job
- `replay_analyzer`: replay analyzer worker
- `Postgres`: Railway managed database

## 개발 명령

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
go build -o bin/server ./cmd/server/main.go
```

문서만 변경해도 배포 명령, 서비스명, endpoint, 경로가 실제 코드와 맞는지 확인합니다.

## 코드 작업 원칙

- 사용자 변경을 임의로 되돌리지 않습니다.
- 관련 테스트를 먼저 보강하고 실패를 확인한 뒤 구현합니다.
- 기능 변경과 문서 변경은 현재 코드/운영 상태를 기준으로 맞춥니다.
- 배포 방식, endpoint, MCP/raw data 계약이 바뀌면 `README.md`, `docs/RAILWAY_DEPLOYMENT_GUIDE.md`, `frontend/app-next/README.md`, `mcp/stareplays-mcp/README.md`를 함께 확인합니다.
- 운영 관련 답변은 가능한 한 검증 명령과 실제 결과를 함께 남깁니다.
