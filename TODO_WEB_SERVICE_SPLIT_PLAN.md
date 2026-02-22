# TODO Web Service Split Plan

## Objective
- Separate web UI serving from the API service in Railway.
- Keep API focused on `/api/*` and `/health`.
- Deploy web as an independent static service for safer releases and scaling.

## Why This Split
- Current coupling makes API deployment sensitive to static asset path/layout.
- `Root Directory` differences (`/` vs `backend`) cause runtime path mismatches.
- Separate services simplify rollback and reduce blast radius.

## Target Architecture
- `api` service (Railway): Go backend only (`backend` root)
- `web` service (Railway): static files from `frontend/web`
- Browser traffic:
  - `app.<domain>` -> web service
  - `api.<domain>` -> api service

## Phase 1: Prepare Code (No Behavior Break)
- [ ] Add `API_BASE_URL` usage in `frontend/web/*.js` (fallback to same-origin).
- [ ] Add `SERVE_WEB_UI` env toggle in backend (default `true` for transition).
- [ ] Keep current static fallback logic until web service cutover is complete.
- [ ] Document local run steps for split mode.

## Phase 2: Provision Railway Web Service
- [ ] Create new Railway service: `web`.
- [ ] Set `Root Directory` to `frontend/web`.
- [ ] Configure static server start command (Caddy/Nginx/http-server).
- [ ] Set web env: `API_BASE_URL=https://api.<domain>`.
- [ ] Verify `/`, `/rankings.html`, `/analyzer.html` render correctly.

## Phase 3: API Service Decouple
- [ ] Set API `Root Directory=backend`.
- [ ] Remove API dependence on `frontend/web` path for normal operation.
- [ ] Set API CORS to allow only `https://app.<domain>` (+ local dev origin).
- [ ] Validate all API endpoints used by web UI.

## Phase 4: Traffic Cutover
- [ ] Point web domain to new `web` service.
- [ ] Keep old API `/` fallback for one release window.
- [ ] Monitor 4xx/5xx, static asset cache behavior, and CORS errors.
- [ ] Remove fallback once stable.

## Phase 5: Cleanup
- [ ] Disable backend web serving by default (`SERVE_WEB_UI=false`).
- [ ] Remove static route code from API after deprecation period.
- [ ] Update docs/runbooks (deploy, incident, rollback).

## Rollback Plan
- If `web` service fails, temporarily route users to API-hosted fallback page.
- Keep API unchanged during initial cutover to minimize rollback time.
- Re-enable previous domain mapping until static service is healthy.

## Success Criteria
- API deploys never fail due to web static path issues.
- Web deploys do not restart or affect API service.
- All user-facing pages load from `web` service and call API via `API_BASE_URL`.
