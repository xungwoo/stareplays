# TODO Frontend Figma UI-First Migration

## Goal

- Migrate the legacy HTML frontend to a maintainable Next.js App Router frontend under `frontend/app-next`.
- Keep the existing Fiber backend and API contracts unchanged.
- Rebuild the UI from the Figma Make reference instead of copying legacy HTML structure.
- Complete first-pass implementations for the four Figma-defined core pages:
  - `/`
  - `/vault`
  - `/rankings`
  - `/analyzer`

## Approved Direction

- Frontend-only migration
- Existing Fiber server remains as the backend API provider
- New frontend runs in parallel on a separate port during migration
- Figma-first, UI-first approach
- Four pages reach first-pass completion in the initial implementation cycle
- Use fixtures first, then connect to the real Fiber API in a later phase

## Current Project Analysis Summary

### Legacy frontend structure

- The current frontend lives in `frontend/web`.
- It is composed of static HTML files:
  - `index.html`
  - `rankings.html`
  - `analyzer.html`
- Styling is a mix of CDN Tailwind and custom CSS in `styles.css`.
- Behavior is implemented in large page-level scripts:
  - `app.js`
  - `rankings.js`
  - `analyzer.js`

### Existing page types

- Dashboard / replay vault hybrid page in legacy
  - replay upload
  - simple current-user selection
  - player stats query
  - recent games table
  - selected game detail and visualization
- Rankings
  - 3v3 rankings tab
  - race composition win-rate tab
- Analyzer
  - game selector
  - summary strip
  - tabbed analysis workspace
  - player deep dive

### Common UI patterns in legacy frontend

- top navigation with current-user indicator
- bordered card-like panels
- compact uppercase labels
- tables with sortable columns
- status/race badges
- tab rows
- chart panels
- inline detail expansion

### Legacy data flow

- Page scripts fetch directly from Fiber endpoints using `fetch`
- DOM nodes are queried globally and mutated imperatively
- Shared state is page-global and loosely structured
- Rendering, formatting, and data access are coupled

### Legacy CSS / JS dependencies

- CDN Tailwind
- custom stylesheet
- vanilla JS page controllers
- no reusable React component boundaries

### Keep vs remove

Reusable concepts to keep:
- route/page breakdown
- rankings and analyzer feature concepts
- existing API contract assumptions
- core domain presentation patterns such as race badges, status badges, summary strips, and replay/game tables

Implementation patterns to remove:
- page-global DOM mutation
- duplicated markup across pages
- imperative rendering logic mixed with fetch logic
- layout and state coupled to HTML files

## Figma Design Analysis Summary

Source:
- `https://www.figma.com/make/s8uusi7rnCRyYVPse8kOLC/StaReplays`

### Global design direction

- Dark, high-contrast dashboard interface
- Neon cyan primary highlight with secondary blue, emerald, amber, red, and violet accents
- Rounded cards and soft panel borders
- Dense but structured data presentation
- Clear hierarchy between shell, summary panels, tables, and detailed workspaces

### Figma page map

- `DASHBOARD` -> `/`
- `REPLAY VAULT` -> `/vault`
- `GAME ANALYZER` -> `/analyzer`
- `RANKINGS` -> `/rankings`

The new frontend should follow this four-page Figma information architecture, not the three-page legacy structure.

### Core layout patterns

- Sticky top app shell with logo, nav, and current user chip
- Centered page container with generous horizontal breathing room
- Card-based sections with thin cyan-tinted borders
- Rankings and analyzer use wide data workspaces
- Dashboard is a standalone landing page
- Replay Vault is a separate operational workspace

### Visual tokens identified from Figma

Background and surfaces:
- app background around `#080e1f`
- card surface around `#0d1833`
- inset/chart background around `#0a1428`

Primary accents:
- cyan `#22d3ee`
- blue `#60a5fa`
- emerald `#10b981` to `#34d399`
- amber `#f59e0b`
- red `#ef4444` / `#f87171`
- violet `#a78bfa`

Typography:
- branded heading style with display treatment in shell
- mono-like dense UI labeling for tables, chips, and metrics
- uppercase section labels with wide tracking

Shape:
- card radius around `12px`
- inner controls around `8px`
- thin borders with low-opacity cyan/white

### Shared component candidates from Figma

- app shell
- top navigation
- current user chip
- section header with accent bar
- status badge
- race badge and race group
- metric/stat card
- table shell
- tab switcher
- chart card
- empty, loading, and error states

### Responsive intent

- Desktop-first wide dashboards
- Tablet keeps stacked cards and compressed tables
- Mobile collapses wide grids into vertical stacks while preserving section order

## Architecture Decision

Recommended approach:
- Figma-centered UI-first migration

Why:
- It best matches the user priority of visual fidelity and structural redesign
- It avoids dragging legacy DOM structure into React
- It provides a stable design system before the real API integration phase

Not chosen:
- legacy parity-first React port
- incremental one-page-only migration as the primary milestone

## Target Frontend Architecture

### Application shape

- New app under `frontend/app-next`
- Next.js App Router
- TypeScript strict mode
- Tailwind CSS with explicit design tokens
- React component architecture with server-first page entry points
- Client components only for local interactivity such as tabs, sorting, paging, and chart state

### Route scope for first implementation pass

- `app/page.tsx`
- `app/vault/page.tsx`
- `app/rankings/page.tsx`
- `app/analyzer/page.tsx`
- shared `app/layout.tsx`

### Directory proposal

```text
frontend/app-next/
  app/
    layout.tsx
    page.tsx
    vault/page.tsx
    rankings/page.tsx
    analyzer/page.tsx
    globals.css
  components/
    shell/
    dashboard/
    vault/
    rankings/
    analyzer/
    shared/
  lib/
    fixtures/
    adapters/
    constants/
    utils/
  styles/
  types/
  tests/
```

### Component boundaries

`shell/`
- `AppHeader`
- `AppNav`
- `CurrentUserChip`
- `PageContainer`

`shared/`
- `SectionHeader`
- `MetricCard`
- `StatusBadge`
- `RaceBadge`
- `RaceGroup`
- `DataTable`
- `LoadingState`
- `EmptyState`
- `ErrorState`

`dashboard/`
- dashboard hero and summary surfaces
- dashboard quick navigation
- dashboard summary modules

`vault/`
- upload module card
- player stats query card
- recent games table
- selected game detail panel

`rankings/`
- rankings tab switcher
- rankings table
- race composition table
- rankings summary metrics

`analyzer/`
- game selector table
- game summary strip
- timeline workspace
- analysis tabs
- player deep dive panel

## Data Flow Design

### Phase 1 data strategy

- UI first
- fixtures first
- no live Fiber API dependency in the first implementation pass

### Page data pipeline

```text
fixture source -> adapter/view model -> page component -> feature components
```

### Why this shape

- It prevents page components from coupling to raw fixture shape
- It prepares for later API integration by isolating the data source boundary
- It makes adapter logic testable

### Planned adapter boundary

Later API connection should primarily change:
- `lib/api/*`
- `lib/adapters/*`

It should not require a broad rewrite of page structure or shared components.

## Interaction and State Policy

- Local page state first
- Avoid introducing unnecessary global state in the first pass
- Keep query-string synchronization minimal
- Use client components only where user interaction requires state on the client

Primary client-side interactions:
- dashboard quick navigation
- vault selection and expansion
- rankings tab switching
- rankings sorting
- analyzer game switching
- analyzer tab switching
- analyzer focused-player selection

## Accessibility and SEO Baseline

- semantic layout tags
- keyboard-focusable buttons/tabs/table controls
- aria labels for sort buttons, tabs, and navigation
- page metadata for title/description/Open Graph
- loading, empty, and error states available from the start

## Implementation Order

1. Set up `frontend/app-next` with Next.js + Tailwind + TypeScript strict mode
2. Define global tokens and shell styles from Figma
3. Build shared primitives
4. Implement dashboard page
5. Implement rankings page to stabilize table/card/badge patterns
6. Implement replay vault page
7. Implement analyzer page
8. Add responsive and accessibility polish
9. Add adapter/test scaffolding for later API integration

## Testing and Verification Strategy

Automated test focus:
- adapters
- formatters
- page-model mapping
- critical client interactions

Manual verification focus:
- Figma visual fidelity
- desktop/tablet/mobile layout
- loading/empty/error states
- accessibility pass

## Explicitly Out of Scope for This Phase

- replacing Fiber with Fastify
- backend route/service restructuring
- removing `frontend/web`
- real upload execution against Fiber
- live API wiring

## Done Criteria for This Phase

- `frontend/app-next` boots independently
- `/`, `/vault`, `/rankings`, `/analyzer` all have first-pass Figma-aligned implementations
- shared design system is in place
- fixture-driven page models are in place
- stateful interactions work
- later Fiber API integration can be isolated to data-loading layers
