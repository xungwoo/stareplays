# TODO Frontend Refactor Plan (Next.js + Fastify)

## Goal
- Keep existing `frontend/web` service unchanged during migration.
- Build a new frontend under `frontend/` with:
  - Next.js (App Router) + Fastify
  - TypeScript
  - Recharts
  - TanStack Table
  - Tailwind CSS + shadcn/ui
- Switch traffic only after full local parity validation.

## Scope
- In scope:
  - New frontend app implementation with feature parity.
  - Parallel run with existing `frontend/web`.
  - Local validation and cutover readiness.
- Out of scope:
  - Immediate production replacement before parity completion.
  - Removing legacy `frontend/web` in this phase.

## Proposed Directory Layout
```text
frontend/
  web/                        # legacy frontend (keep as-is)
  app-next/                   # new frontend app
    app/                      # Next.js App Router pages
    components/               # reusable UI components
    lib/                      # api client, utils
    server/                   # fastify custom server
    tests/                    # playwright smoke tests
    types/
```

## Page/Feature Mapping
1. `frontend/web/index.html` -> `frontend/app-next/app/page.tsx`
2. `frontend/web/rankings.html` -> `frontend/app-next/app/rankings/page.tsx`
3. `frontend/web/analyzer.html` -> `frontend/app-next/app/analyzer/page.tsx`

## Execution Plan

### Phase 0. Baseline Freeze
- [x] Extract and freeze current feature checklist from legacy `frontend/web`.
- [x] Freeze API endpoint contracts used by frontend (`/api/v1/...`).
- [x] Define parity acceptance criteria per page.

### Phase 1. New App Bootstrap
- [x] Initialize `frontend/app-next` with Next.js + TypeScript + Tailwind.
- [x] Integrate shadcn/ui style configuration.
- [x] Add Fastify custom server to host Next app.
- [x] Add scripts:
  - [x] `dev` for Next/Fastify (port 3100)
  - [x] `build`
  - [x] `start`

### Phase 2. Shared Foundation
- [x] Implement typed API client (`lib/api-client.ts`).
- [x] Define domain types (`types/api.ts`).
- [x] Add TanStack Query for async state/cache.
- [x] Add global UI/filter state store (Zustand).
- [x] Add error/loading/empty-state common components.

### Phase 3. UI System
- [x] Build shared layout and navigation.
- [x] Build design tokens and reusable primitives:
  - [x] card, tabs, badge, table wrappers, button/input
- [x] Implement consistent page shell for dashboard/rankings/analyzer.

### Phase 4. Charts Layer
- [x] Create chart wrapper (`ChartCard`) with loading/error/empty handling.
- [x] Implement Recharts primitives for:
  - [x] line chart (APM)
  - [x] radar chart (performance polygon)
  - [x] bar/composed chart (resource spend)

### Phase 5. Table Layer
- [x] Introduce TanStack Table base table component.
- [x] Implement sorting/pagination behavior.
- [x] Migrate rankings/analyzer/recent games table rendering to TanStack Table.

### Phase 6. Page Migration (Parity-first)
- [x] Rankings page migration
  - [x] 3v3 rankings tab
  - [x] race composition tab
  - [x] sorting/filter parity
- [x] Analyzer page migration
  - [x] game selector/paging
  - [x] top summary strip
  - [x] tabbed visualization workspace
  - [x] player deep dive/event inspector
- [x] Dashboard (Replay Vault) migration
  - [x] upload flow
  - [x] recent games
  - [x] game detail visualization tabs

### Phase 7. Parallel Run and Validation
- [x] Run legacy and new frontend in parallel:
  - [x] legacy: existing path
  - [x] new: `http://localhost:3100`
- [x] Add regression test skeleton (Playwright smoke).
- [ ] Verify full feature parity against frozen checklist (manual execution pending).
- [ ] Resolve visual/behavior mismatches (follow-up during validation cycle).

### Phase 8. Cutover Preparation
- [x] Prepare rollback/cutover runbook (`TODO_FRONTEND_REFACTOR_CUTOVER_RUNBOOK.md`).
- [ ] Execute local rehearsal with full checklist.
- [ ] Approve production cutover only after all checks pass.

## Local Development Convention
- Legacy frontend remains untouched in `frontend/web`.
- New frontend runs independently on port `3100`.
- Use environment variable:
  - `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000`

## Deliverables Checklist
- [x] `frontend/app-next` scaffold committed
- [x] three pages implemented with parity-oriented structure
- [x] chart/table abstraction completed
- [ ] local test checklist fully passed (manual + e2e 실행 필요)
- [x] cutover runbook documented
