# Railway GitHub 배포 설정

이 문서는 팀원이 Railway CLI 권한 없이도 운영 배포를 사용할 수 있도록 Railway Dashboard에서 맞춰야 하는 설정표입니다.

운영 배포의 기본 경로는 **GitHub `main` push -> Railway GitHub Autodeploy**입니다. Railway CLI는 관리자 복구용 예외 수단입니다.

참고 공식 문서:

- Railway GitHub Autodeploys: https://docs.railway.com/deployments/github-autodeploys
- Railway Monorepo: https://docs.railway.com/deployments/monorepo

## 공통 원칙

- 모든 운영 서비스의 GitHub source는 `xungwoo/stareplays`입니다.
- 모든 운영 서비스의 trigger branch는 `main`입니다.
- feature branch는 Railway production에 직접 배포하지 않습니다.
- `main`에 merge 후 `origin/main`에 push되면 Railway가 자동 배포합니다.
- 자동 배포가 꺼져 있으면 Railway Dashboard에서 `CMD + K` -> `Deploy Latest Commit`으로 현재 연결 브랜치의 최신 커밋을 배포합니다.
- 가능하면 `Wait for CI`를 켭니다. GitHub Actions가 실패하면 Railway 배포가 skip되어야 합니다.
- Watch Paths는 런타임에 영향을 주는 코드/설정 파일만 포함합니다.

## 서비스별 Dashboard 설정표

Railway Dashboard에서 각 service -> Settings 기준으로 확인합니다.

| Service | Source Repo | Branch | Root Directory | Railway Config File | Watch Paths 권장값 |
| --- | --- | --- | --- | --- | --- |
| `stareplays-next` | `xungwoo/stareplays` | `main` | `frontend/app-next` | `/frontend/app-next/railway.toml` | `/frontend/app-next/**` |
| `stareplays` | `xungwoo/stareplays` | `main` | 비움 | `/railway.api.toml` | `/backend/**`, `/railway.api.toml`, `/go.mod`, `/go.sum` |
| `ranking-job` | `xungwoo/stareplays` | `main` | 비움 | `/railway.ranking.toml` | `/backend/**`, `/railway.ranking.toml`, `/go.mod`, `/go.sum` |
| `analyzer-job` | `xungwoo/stareplays` | `main` | 비움 | `/railway.analyzer.toml` | `/backend/**`, `/railway.analyzer.toml`, `/go.mod`, `/go.sum` |
| `replay_analyzer` | `xungwoo/stareplays` | `main` | 비움 | `/railway.replay-analyzer-worker.toml` | `/backend/**`, `/railway.replay-analyzer-worker.toml`, `/go.mod`, `/go.sum` |
| `migration-job` | `xungwoo/stareplays` | `main` | 비움 | `/railway.migration.toml` | `/backend/**`, `/railway.migration.toml`, `/go.mod`, `/go.sum` |

주의:

- Railway Config as Code는 deployment trigger 시 repo의 설정 파일을 읽고 Dashboard 설정과 병합하며, 코드 설정이 Dashboard 값보다 우선합니다.
- Railway Dashboard에서 Config File을 입력할 때 `stareplays-next`는 `/frontend/app-next/railway.toml`을 먼저 사용합니다. Dashboard가 Root Directory 기준 상대 경로만 허용하는 UI로 바뀐 경우에는 `railway.toml`을 입력하고, 첫 배포의 deployment details에서 설정 출처가 `frontend/app-next/railway.toml`인지 확인합니다.
- `stareplays-next`의 Root Directory를 비워두면 `frontend/app-next/railway.toml`을 읽지 못하거나 잘못된 root에서 build될 수 있습니다.
- Root Directory를 `frontend/app-next`로 지정하면 Railway가 해당 디렉터리만 deployment source로 사용합니다.
- 문서 변경만으로 프런트 배포 이벤트가 생기지 않도록 `stareplays-next` watch paths에는 `/docs/**`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `mcp/**`를 넣지 않습니다.

## GitHub Autodeploy 설정 절차

1. Railway Dashboard에서 production project를 엽니다.
2. 대상 service를 선택합니다.
3. Settings -> Source에서 GitHub repo가 `xungwoo/stareplays`인지 확인합니다.
4. Trigger branch를 `main`으로 설정합니다.
5. Root Directory와 Railway Config File을 위 표대로 설정합니다.
6. Autodeploy를 Enable합니다.
7. GitHub Actions가 있다면 Wait for CI를 Enable합니다.
8. Watch Paths를 쓰는 service는 위 표의 권장값을 넣습니다.
9. Watch Paths에 포함되는 코드/설정 변경을 `main`에 push하거나 Dashboard에서 `Deploy Latest Commit`을 실행해 trigger 동작을 확인합니다.

## 배포하는 사람의 절차

팀원은 Railway CLI를 쓰지 않습니다.

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

이후 Railway Dashboard에서 해당 service의 Deployments 탭을 확인합니다.

## 검증

Dashboard에서 배포 상태가 `SUCCESS`인지 확인한 뒤 운영 endpoint를 확인합니다.

```bash
curl -sS -I https://stareplays-production.up.railway.app/health
curl -sS -I https://stareplays.up.railway.app/team-analysis
curl -sS -I https://stareplays.up.railway.app/seasons
curl -sS -I https://stareplays.up.railway.app/rankings
```

팀 분석 raw endpoint:

```bash
curl -sS -D - -o /tmp/stareplays-team-analysis-raw.json \
  -w '\nHTTP=%{http_code}\nTIME_TOTAL=%{time_total}\nSIZE=%{size_download}\n' \
  'https://stareplays.up.railway.app/api/team-analysis/raw?season_label=%EC%8B%9C%EC%A6%8C8'
```

기대:

```text
HTTP=200
cache-control: public, s-maxage=60, stale-while-revalidate=300
```

## 배포가 안 걸릴 때

- service가 GitHub repo에 연결되어 있는지 확인합니다.
- trigger branch가 `main`인지 확인합니다.
- Autodeploy가 Enable인지 확인합니다.
- Railway GitHub App이 repo 접근 권한을 갖고 있는지 확인합니다.
- Watch Paths가 이번 변경 파일을 포함하는지 확인합니다.
- GitHub Actions 대기 상태라면 Actions가 성공했는지 확인합니다.
- 자동 배포가 막혔다면 Dashboard에서 `CMD + K` -> `Deploy Latest Commit`을 실행합니다.

## 잘못 배포됐을 때

`stareplays-next`에서 아래 증상이 보이면 Dashboard 설정이 잘못된 것입니다.

- `No start command detected`
- builder가 `RAILPACK`
- deployment manifest가 비어 있음
- `frontend/app-next/railway.toml`을 읽지 못함

복구:

1. `stareplays-next` Settings에서 Root Directory가 `frontend/app-next`인지 확인합니다.
2. Railway Config File이 `/frontend/app-next/railway.toml`인지 확인합니다. Dashboard UI가 Root Directory 기준 상대 경로만 허용하면 `railway.toml`로 설정한 뒤 deployment details에서 설정 출처를 확인합니다.
3. Dashboard에서 `Deploy Latest Commit`을 실행합니다.

CLI 권한이 있는 운영자는 `docs/RAILWAY_DEPLOYMENT_GUIDE.md`의 CLI 복구 명령을 사용할 수 있습니다.
