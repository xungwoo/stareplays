# StaReplays Agent Instructions

이 문서는 Codex와 다른 자동화 에이전트가 이 레포지토리에서 작업할 때 반드시 따르는 루트 작업 계약입니다.

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
curl -sS -I https://stareplays-next-production.up.railway.app/team-analysis
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
