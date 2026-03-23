# StaReplays App Next

Next.js App Router frontend for StaReplays. The existing Fiber backend stays in place and this app consumes it directly.

## Overview

- App Router frontend for the 4 product routes: `/`, `/vault`, `/analyzer`, `/rankings`
- Server route files load API-backed page models first, then pass stable props into interactive client components
- The app is now API-first. Fixtures are used only when the backend is unavailable or a required read path fails
- Current user state is shared across routes through a cookie, with query params preserved where deep-linking matters

## Implemented API Flows

### Read paths

- `Dashboard`: rankings, current user stats, user suggestions, recent games
- `Vault`: current user game list and selected game detail
- `Analyzer`: game list, selected game detail, analyzer payload, route-driven selected game
- `Rankings`: 3v3 rankings and race composition win rates

### Write paths

- replay preview upload via `POST /api/v1/games/upload/preview`
- replay upload via `POST /api/v1/games/upload`
- manual analyzer reanalyze via `POST /api/v1/analyzer/reanalyze`

## UX Rules

- `Vault -> Analyzer` keeps the selected game through `gameId`
- manual refresh is supported
- polling is intentionally not used
- fixture fallback is an outage fallback, not the normal render mode

## Scripts

- `npm run dev` - Next dev server on `3100`
- `npm run build` - production build using `.next-prod`
- `npm run start` - production server on `3100`
- `npm run preview` - production preview server on `3201`
- `npm test`
- `npm run typecheck`

## Ports

- Next dev: `3100`
- Next preview: `3201`
- existing Fiber API: `3000`

## Environment

- copy `.env.example` to `.env.local`
- set `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000`

## Key Directories

- `app/*` - route entry points
- `components/*` - shell, shared primitives, and page-level UI
- `lib/loaders/*` - route-specific API read orchestration
- `lib/api/*` - shared fetch and write-action helpers
- `lib/adapters/*` - raw Fiber response to UI page-model conversion
- `types/*` - raw API and page-model types
