# Railway Deployment Guide

This is the operational deployment guide for StaReplays Railway production services.

## Required Rule

Do not deploy every service from the repository root with the same `railway up` command.

Each service has its own Railway root/config expectation. Using the wrong root can make Railway miss the intended `railway.toml`, fall back to default Railpack detection, and create a failed deployment.

## Production Services

### `stareplays-next`

Next.js frontend service.

Deploy from `frontend/app-next` as the archive root:

```bash
railway up frontend/app-next \
  --path-as-root \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "Describe the deployment"
```

Expected deployment metadata:

- `configFile`: `/railway.toml`
- `build.builder`: `NIXPACKS`
- `build.buildCommand`: `npm run build`
- `deploy.healthcheckPath`: `/team-analysis`
- `deploy.startCommand`: `npm run start`

Never deploy `stareplays-next` from the repository root. The service config lives at `frontend/app-next/railway.toml`; root deployment causes Railway to miss it.

### `stareplays`

Go backend API service.

Deploy from repository root:

```bash
railway up \
  --service stareplays \
  --environment production \
  --detach \
  --message "Describe the deployment"
```

Expected deployment metadata:

- `configFile`: `/railway.api.toml`
- `build.builder`: `DOCKERFILE`
- `build.dockerfilePath`: `backend/Dockerfile.api`
- `deploy.healthcheckPath`: `/health`
- `deploy.startCommand`: `/app/server`

## Verification

After deployment, verify service status:

```bash
railway service status --all --environment production --json
```

Verify latest deployments:

```bash
railway deployment list --service stareplays-next --environment production --json --limit 2
railway deployment list --service stareplays --environment production --json --limit 2
```

Verify production endpoints:

```bash
curl -sS -D - -o /tmp/stareplays-team-analysis.json \
  -w '\nHTTP=%{http_code}\nTIME_TOTAL=%{time_total}\nSIZE=%{size_download}\n' \
  'https://stareplays-next-production.up.railway.app/api/team-analysis/raw?season_label=%EC%8B%9C%EC%A6%8C8'

curl -sS -D - -o /tmp/stareplays-health.json \
  -w '\nHTTP=%{http_code}\nTIME_TOTAL=%{time_total}\nSIZE=%{size_download}\n' \
  'https://stareplays-production.up.railway.app/health'
```

For the raw team-analysis endpoint, expect:

```text
cache-control: public, s-maxage=60, stale-while-revalidate=300
HTTP=200
```

## Failed Deployment Recovery

If a `stareplays-next` deployment shows empty `fileServiceManifest` or builder `RAILPACK`, it was uploaded from the wrong root. Immediately redeploy with:

```bash
railway up frontend/app-next \
  --path-as-root \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "Recover frontend deployment root"
```

Then re-check `railway deployment list --service stareplays-next --environment production --json --limit 2`.
