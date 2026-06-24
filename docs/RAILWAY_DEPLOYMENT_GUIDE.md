# Railway 운영 배포 가이드

이 문서는 StaReplays Railway production 배포의 기준 문서입니다. Claude와 Codex는 배포 전에 반드시 이 문서를 읽고, 여기에 있는 절차만 사용합니다.

기본 운영 배포 경로는 **GitHub `main` push -> Railway GitHub Autodeploy**입니다. Railway CLI는 팀 공용 경로가 아니며, 운영자 복구용 예외 수단입니다.

Dashboard 설정표는 [RAILWAY_GITHUB_DEPLOYMENT_SETUP.md](RAILWAY_GITHUB_DEPLOYMENT_SETUP.md)를 기준으로 합니다.

## 운영 배포 원칙

운영 배포는 항상 `main` 기준입니다.

필수 순서:

1. `origin/main`을 최신 상태로 가져옵니다.
2. 작업별 feature branch에서 변경합니다.
3. feature branch에서 테스트와 빌드를 완료합니다.
4. feature branch를 `main`에 병합합니다.
5. `main`을 push합니다.
6. `main` push로 Railway GitHub Autodeploy를 발생시킵니다.
7. Railway Dashboard에서 배포 상태와 운영 endpoint를 확인합니다.

feature branch를 main에 병합하지 않은 상태로 운영 배포하지 않습니다. `main`에서 직접 작업 후 배포하지 않습니다.

## 사전 확인

```bash
git status --short --branch
git fetch origin
git switch main
git pull --ff-only origin main
git log --oneline --decorate -3
```

배포 직전 `HEAD`와 `origin/main`이 같은 커밋이어야 합니다.

```bash
git status --short --branch
```

예상:

```text
## main...origin/main
```

## GitHub Autodeploy 운영 방식

팀원은 Railway CLI 없이 배포합니다.

필수 Dashboard 설정:

- 모든 service source repo: `xungwoo/stareplays`
- 모든 service trigger branch: `main`
- Autodeploy: Enable
- 가능하면 Wait for CI: Enable
- 서비스별 Root Directory와 Railway Config File: [RAILWAY_GITHUB_DEPLOYMENT_SETUP.md](RAILWAY_GITHUB_DEPLOYMENT_SETUP.md)의 설정표와 일치

서비스별 핵심 설정:

| Service | Root Directory | Railway Config File |
| --- | --- | --- |
| `stareplays-next` | `frontend/app-next` | `/frontend/app-next/railway.toml` |
| `stareplays` | 비움 | `/railway.api.toml` |
| `ranking-job` | 비움 | `/railway.ranking.toml` |
| `analyzer-job` | 비움 | `/railway.analyzer.toml` |
| `replay_analyzer` | 비움 | `/railway.replay-analyzer-worker.toml` |
| `migration-job` | 비움 | `/railway.migration.toml` |

`stareplays-next`는 반드시 Root Directory를 `frontend/app-next`로 둡니다. Railway Config File은 `/frontend/app-next/railway.toml`을 먼저 사용합니다. Dashboard UI가 Root Directory 기준 상대 경로만 허용하면 `railway.toml`로 설정한 뒤 deployment details에서 설정 출처가 `frontend/app-next/railway.toml`인지 확인합니다.

자동 배포가 꺼져 있거나 webhook이 누락되면 Railway Dashboard에서 `CMD + K` -> `Deploy Latest Commit`을 실행합니다. 이 동작도 연결된 `main`의 최신 커밋을 배포해야 합니다.

## CLI 복구 명령

아래 명령은 팀 공용 배포 경로가 아닙니다. Railway CLI 권한이 있는 운영자가 잘못된 배포를 복구하거나 Dashboard trigger 장애를 우회할 때만 사용합니다.

서비스별 archive root와 Railway config 위치가 다릅니다. 모든 서비스를 같은 `railway up` 명령으로 배포하지 않습니다.

### `stareplays-next`

Next.js 운영 대시보드입니다.

반드시 `frontend/app-next`를 archive root로 배포합니다.

```bash
railway up frontend/app-next \
  --path-as-root \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "<main commit summary>"
```

임시 worktree처럼 Railway project link가 없거나 불명확하면 project id를 명시합니다.

```bash
railway up frontend/app-next \
  --path-as-root \
  --project 838683d6-9fb8-41d6-ad8a-1075e4d00196 \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "<main commit summary>"
```

정상 배포 기대값:

- config file: `frontend/app-next/railway.toml`이 archive root에서 `/railway.toml`로 인식
- builder: `NIXPACKS`
- build command: `npm run build`
- start command: `npm run start`
- healthcheck path: `/team-analysis`

금지:

```bash
railway up --service stareplays-next --environment production
railway up . --service stareplays-next --environment production
```

위처럼 레포 루트에서 배포하면 `frontend/app-next/railway.toml`을 읽지 못하고 Railpack 기본 감지로 실패할 수 있습니다.

### `stareplays`

Go API 서버입니다. 레포 루트에서 `railway.api.toml` 기준으로 배포합니다.

```bash
railway up \
  --service stareplays \
  --environment production \
  --detach \
  --message "<main commit summary>"
```

정상 배포 기대값:

- config file: `railway.api.toml`
- builder: `DOCKERFILE`
- dockerfile path: `backend/Dockerfile.api`
- start command: `/app/server`
- healthcheck path: `/health`

### `ranking-job`

랭킹 snapshot job입니다. 필요한 경우에만 명시적으로 배포합니다.

```bash
railway up \
  --service ranking-job \
  --environment production \
  --detach \
  --message "<main commit summary>"
```

설정 파일: `railway.ranking.toml`

### `analyzer-job`

종족 조합 snapshot job입니다. 필요한 경우에만 명시적으로 배포합니다.

```bash
railway up \
  --service analyzer-job \
  --environment production \
  --detach \
  --message "<main commit summary>"
```

설정 파일: `railway.analyzer.toml`

### `replay_analyzer`

Replay analyzer worker입니다. OpenBW/replay analyzer 의존성이 있으므로 Dockerfile과 환경 변수를 같이 확인한 뒤 배포합니다.

```bash
railway up \
  --service replay_analyzer \
  --environment production \
  --detach \
  --message "<main commit summary>"
```

설정 파일: `railway.replay-analyzer-worker.toml`

## 배포 상태 확인

팀원은 Railway Dashboard의 service -> Deployments 탭에서 상태가 `SUCCESS`인지 확인합니다.

CLI 권한이 있는 운영자는 서비스별 상태를 명령으로 확인할 수 있습니다.

```bash
railway service status --service stareplays --environment production
railway service status --service stareplays-next --environment production
```

최근 배포:

```bash
railway deployment list --service stareplays --environment production
railway deployment list --service stareplays-next --environment production
```

운영 endpoint:

```bash
curl -sS -I https://stareplays-production.up.railway.app/health
curl -sS -I https://stareplays-next-production.up.railway.app/team-analysis
curl -sS -I https://stareplays-next-production.up.railway.app/seasons
curl -sS -I https://stareplays-next-production.up.railway.app/rankings
```

성능/응답 크기 확인:

```bash
curl -sS -o /tmp/stareplays-team-analysis.html \
  -w 'team-analysis total=%{time_total} ttfb=%{time_starttransfer} size=%{size_download}\n' \
  https://stareplays-next-production.up.railway.app/team-analysis

curl -sS -o /tmp/stareplays-seasons.html \
  -w 'seasons total=%{time_total} ttfb=%{time_starttransfer} size=%{size_download}\n' \
  https://stareplays-next-production.up.railway.app/seasons
```

Raw endpoint:

```bash
curl -sS -D - -o /tmp/stareplays-team-analysis-raw.json \
  -w '\nHTTP=%{http_code}\nTIME_TOTAL=%{time_total}\nSIZE=%{size_download}\n' \
  'https://stareplays-next-production.up.railway.app/api/team-analysis/raw?season_label=%EC%8B%9C%EC%A6%8C8'
```

기대:

```text
HTTP=200
cache-control: public, s-maxage=60, stale-while-revalidate=300
```

## 배포 실패 복구

### `stareplays-next` root 오류

증상:

- `No start command detected`
- builder가 `RAILPACK`
- deployment manifest가 비어 있음
- `frontend/app-next/railway.toml`을 읽지 못함

원인:

- 레포 루트에서 `stareplays-next`를 배포함

복구:

```bash
railway up frontend/app-next \
  --path-as-root \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "Recover frontend deployment root"
```

복구 후 확인:

```bash
railway service status --service stareplays-next --environment production
railway deployment list --service stareplays-next --environment production
curl -sS -I https://stareplays-next-production.up.railway.app/team-analysis
```

### 잘못된 서비스 배포

서비스명을 빼고 배포했거나 현재 linked service가 헷갈린 경우:

```bash
railway status
railway deployment list --service stareplays --environment production
railway deployment list --service stareplays-next --environment production
```

이후 올바른 `--service`와 archive root를 명시해서 다시 배포합니다.

## 배포 전 최종 체크리스트

- [ ] 현재 브랜치가 `main`이다.
- [ ] `main`이 `origin/main`과 같다.
- [ ] feature branch 변경이 main에 병합되어 있다.
- [ ] 필요한 테스트와 빌드가 통과했다.
- [ ] 배포할 Railway service를 명시했다.
- [ ] `stareplays-next`는 `frontend/app-next --path-as-root`로 배포한다.
- [ ] API는 레포 루트에서 `--service stareplays`로 배포한다.
- [ ] 배포 후 `railway service status`가 `SUCCESS`다.
- [ ] 운영 endpoint가 200 또는 정상 redirect/header를 반환한다.
