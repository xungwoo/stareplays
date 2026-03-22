# Next Frontend API Integration Design

**Goal:** Replace fixture-first behavior in `frontend/app-next` with real Fiber API reads and writes, while preserving the current Next.js page structure and the no-polling refresh workflow.

## Scope

This design covers the first full API integration pass for the Next frontend:

- read paths move to real API by default
- write paths from the legacy dashboard are restored
- `Vault` and `Analyzer` share deep-link behavior
- `current user` persists across routes and refreshes
- polling is explicitly excluded

## Legacy Features To Preserve

The legacy web already supported these behaviors and they must be preserved:

- replay preview upload
- replay upload
- parsed player selection after preview
- current user selection and reuse
- player stats query
- user suggestion lookup
- recent games query
- rankings query
- race composition query
- game detail query
- analyzer detail query

## New Features Included In This Pass

These are not strict legacy parity, but are required for practical operation in the new frontend:

- `Vault -> Analyzer` deep-link using `gameId`
- `Analyzer` initial selection from query params
- manual refresh-only workflow for stale analyzer state
- manual reanalyze action entry point in the UI
- cookie-backed `current user` persistence for App Router loaders
- fixture fallback only when API access actually fails

## Non-Goals

- no polling
- no backend route redesign
- no websocket or streaming status updates
- no additional design overhaul

## Architecture

The existing `loader -> adapter -> page model` boundary stays in place.

### Read Path

Each route continues to load data through a route-specific loader:

- `dashboard.ts`
- `vault.ts`
- `analyzer.ts`
- `rankings.ts`

Loaders call a shared API client, adapters convert raw Fiber responses to page models, and page components remain mostly unaware of backend response shape.

### Write Path

Write actions are added in a thin client-side API layer:

- upload preview
- upload replay
- optional reanalyze request if a supported endpoint exists or can be represented as a refresh-triggering action

These actions should not bypass shared error handling or current-user state.

### Current User State

`current user` becomes a shared session concept with two carriers:

- primary: cookie
- secondary: query param where deep-linking is useful

This allows:

- server loaders to resolve the current user on initial render
- client actions to update the same identity without relying on local-only state
- page reloads to stay consistent

## Page-Level Design

### Dashboard

Dashboard becomes the primary write surface.

It will support:

- preview replay upload via `POST /api/v1/games/upload/preview`
- replay upload via `POST /api/v1/games/upload`
- current user selection from parsed player preview results
- player stats query via `GET /api/v1/players/:name/stats`
- user suggest via `GET /api/v1/users/suggest`
- recent games query via `GET /api/v1/games`

Dashboard should expose clear action states:

- idle
- submitting
- success
- error

Successful upload should make it easy to continue into `Vault` or `Analyzer`.

### Vault

Vault stays primarily read-oriented, but becomes a navigation bridge.

It will support:

- current-user-scoped games list
- manual refresh
- selected game detail rendering from real API data
- `GAME ANALYZER` deep-link with `gameId`

### Analyzer

Analyzer remains read-heavy but gets operational hooks:

- initial game selection from `gameId`
- manual refresh behavior
- optional reanalyze trigger
- explicit status rendering for `not_requested`, `queued`, `running`, `failed`, `succeeded`

No waiting loop is introduced. The user refreshes manually.

### Rankings

Rankings remains read-only and should load entirely from API when available:

- `GET /api/v1/rankings/3v3`
- `GET /api/v1/analyzer/race-matchups`

## Error Handling

Each action and loader should distinguish:

- loading
- empty
- unavailable backend
- request validation failure
- upload failure
- analyzer unavailable or not ready

Fallback fixtures remain only as an outage fallback, not as the normal mode.

## Testing Strategy

Implementation should use TDD for each new behavior:

- API client request construction tests
- loader tests for cookie/query-driven current user resolution
- Dashboard interaction tests for preview and upload flows
- Vault deep-link tests
- Analyzer query-param selection tests
- session persistence tests for current user

## Success Criteria

- Dashboard can preview and upload real replay files
- current user persists across route changes and refreshes
- Vault and Analyzer read real data by default
- Analyzer can open directly from a selected Vault row
- fixture fallback only activates on actual API failure
- no polling is introduced
