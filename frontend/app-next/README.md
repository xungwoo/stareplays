# StaReplays App Next

Figma-first Next.js frontend for StaReplays.

## Overview

- App Router based frontend for the 4 Figma routes: `/`, `/vault`, `/analyzer`, `/rankings`
- Server route files load data first, then pass stable page models into client-only interactive views
- Fiber backend remains unchanged and is consumed through `lib/loaders/*` and `lib/api/client.ts`
- When the API is unavailable, the UI falls back to local fixtures so the Figma-based experience stays renderable

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm test`
- `npm run typecheck`

## Ports

- frontend: `3100`
- existing Fiber API: `3000`

## Environment

- copy `.env.example` to `.env.local`
- `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000`
