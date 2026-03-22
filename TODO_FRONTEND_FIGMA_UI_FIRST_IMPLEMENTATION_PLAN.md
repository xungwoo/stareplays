# StaReplays Frontend Figma UI-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new fixture-driven Next.js App Router frontend under `frontend/app-next` that reproduces the Figma design system and delivers first-pass implementations for the dashboard, replay vault, rankings, and analyzer pages without changing the existing Fiber backend.

**Architecture:** The new app is an isolated frontend that consumes fixture-backed page models first and keeps the data-loading boundary separate from page components. Shared shell, primitives, and feature components are built before the four page implementations so later API integration can be isolated to adapters and loaders.

**Tech Stack:** Next.js App Router, React, TypeScript strict mode, Tailwind CSS, Vitest, Testing Library

---

### Task 1: Audit Existing `frontend/app-next` State And Preserve User Intent

**Files:**
- Inspect: `frontend/app-next/`
- Inspect: `TODO_FRONTEND_FIGMA_UI_FIRST_MIGRATION.md`
- Inspect: `TODO_FRONTEND_FIGMA_UI_FIRST_IMPLEMENTATION_PLAN.md`

- [ ] **Step 1: Inspect the deleted working tree state**

Run: `git status --short frontend/app-next`
Expected: existing deleted files are visible and treated as current worktree context, not automatically reverted

- [ ] **Step 2: Inspect whether `frontend/app-next` still exists on disk**

Run: `ls -la frontend && ls -la frontend/app-next`
Expected: directory either exists partially or is absent; outcome informs bootstrap path

- [ ] **Step 3: Decide bootstrap mode**

If `frontend/app-next` is missing or incomplete, recreate it cleanly. If files still exist and are compatible, reuse only what aligns with the approved plan.

- [ ] **Step 4: Commit**

```bash
git add TODO_FRONTEND_FIGMA_UI_FIRST_MIGRATION.md TODO_FRONTEND_FIGMA_UI_FIRST_IMPLEMENTATION_PLAN.md
git commit -m "docs: add frontend figma-first migration plan"
```

### Task 2: Bootstrap The New Next.js Frontend Skeleton

**Files:**
- Create: `frontend/app-next/package.json`
- Create: `frontend/app-next/tsconfig.json`
- Create: `frontend/app-next/next.config.mjs`
- Create: `frontend/app-next/postcss.config.mjs`
- Create: `frontend/app-next/next-env.d.ts`
- Create: `frontend/app-next/app/layout.tsx`
- Create: `frontend/app-next/app/page.tsx`
- Create: `frontend/app-next/app/vault/page.tsx`
- Create: `frontend/app-next/app/rankings/page.tsx`
- Create: `frontend/app-next/app/analyzer/page.tsx`
- Create: `frontend/app-next/app/globals.css`
- Create: `frontend/app-next/.env.example`
- Create: `frontend/app-next/README.md`

- [ ] **Step 1: Write the failing bootstrap smoke test**

Test file:
- `frontend/app-next/tests/app-shell-smoke.test.tsx`

Test should assert:
- root layout exports metadata
- home, vault, rankings, analyzer pages import successfully

- [ ] **Step 2: Run the bootstrap test and verify it fails**

Run: `npm test -- --run tests/app-shell-smoke.test.tsx`
Expected: FAIL because app files do not exist yet

- [ ] **Step 3: Create the minimal Next.js app scaffold**

Implement:
- package scripts for `dev`, `build`, `start`, `test`
- strict TypeScript config
- app router layout and four page entry files

- [ ] **Step 4: Re-run the bootstrap test**

Run: `npm test -- --run tests/app-shell-smoke.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next
git commit -m "feat: bootstrap next frontend shell"
```

### Task 3: Build Figma-Based Design Tokens And Global Shell

**Files:**
- Create: `frontend/app-next/components/shell/app-header.tsx`
- Create: `frontend/app-next/components/shell/app-nav.tsx`
- Create: `frontend/app-next/components/shell/current-user-chip.tsx`
- Create: `frontend/app-next/components/shell/page-container.tsx`
- Create: `frontend/app-next/lib/constants/navigation.ts`
- Modify: `frontend/app-next/app/layout.tsx`
- Modify: `frontend/app-next/app/globals.css`

- [ ] **Step 1: Write a failing shell rendering test**

Test file:
- `frontend/app-next/tests/app-shell-layout.test.tsx`

Cover:
- header renders navigation labels
- current user chip renders fixture user
- layout wraps page content

- [ ] **Step 2: Run the shell test and verify it fails**

Run: `npm test -- --run tests/app-shell-layout.test.tsx`
Expected: FAIL because shell components are missing

- [ ] **Step 3: Implement tokens and shell**

Implement:
- CSS variables and Tailwind-compatible global utilities matching the Figma visual language
- shared shell components
- nav highlighting and page container structure

- [ ] **Step 4: Re-run the shell test**

Run: `npm test -- --run tests/app-shell-layout.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/app frontend/app-next/components frontend/app-next/lib/constants
git commit -m "feat: add figma-based app shell"
```

### Task 4: Add Shared Fixtures, Types, Formatters, And Adapters

**Files:**
- Create: `frontend/app-next/types/common.ts`
- Create: `frontend/app-next/types/dashboard.ts`
- Create: `frontend/app-next/types/rankings.ts`
- Create: `frontend/app-next/types/analyzer.ts`
- Create: `frontend/app-next/lib/fixtures/dashboard.ts`
- Create: `frontend/app-next/lib/fixtures/rankings.ts`
- Create: `frontend/app-next/lib/fixtures/analyzer.ts`
- Create: `frontend/app-next/lib/adapters/dashboard.ts`
- Create: `frontend/app-next/lib/adapters/rankings.ts`
- Create: `frontend/app-next/lib/adapters/analyzer.ts`
- Create: `frontend/app-next/lib/utils/format.ts`

- [ ] **Step 1: Write failing adapter and formatter tests**

Test files:
- `frontend/app-next/tests/rankings-adapter.test.ts`
- `frontend/app-next/tests/dashboard-adapter.test.ts`
- `frontend/app-next/tests/analyzer-adapter.test.ts`
- `frontend/app-next/tests/formatters.test.ts`

Cover:
- race/status normalization
- summary metrics mapping
- page-model shape generation
- time/date formatting

- [ ] **Step 2: Run adapter/formatter tests and verify they fail**

Run: `npm test -- --run tests/rankings-adapter.test.ts tests/dashboard-adapter.test.ts tests/analyzer-adapter.test.ts tests/formatters.test.ts`
Expected: FAIL because adapters and types do not exist yet

- [ ] **Step 3: Implement types, fixtures, formatters, and adapters**

Keep page-facing view models stable and independent from raw fixture shape.

- [ ] **Step 4: Re-run adapter/formatter tests**

Run: `npm test -- --run tests/rankings-adapter.test.ts tests/dashboard-adapter.test.ts tests/analyzer-adapter.test.ts tests/formatters.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/types frontend/app-next/lib
git commit -m "feat: add fixture models and adapters"
```

### Task 5: Build Shared UI Primitives

**Files:**
- Create: `frontend/app-next/components/shared/section-header.tsx`
- Create: `frontend/app-next/components/shared/race-badge.tsx`
- Create: `frontend/app-next/components/shared/status-badge.tsx`
- Create: `frontend/app-next/components/shared/metric-card.tsx`
- Create: `frontend/app-next/components/shared/data-table.tsx`
- Create: `frontend/app-next/components/shared/loading-state.tsx`
- Create: `frontend/app-next/components/shared/empty-state.tsx`
- Create: `frontend/app-next/components/shared/error-state.tsx`
- Create: `frontend/app-next/components/shared/tab-switcher.tsx`

- [ ] **Step 1: Write a failing component test for shared primitives**

Test file:
- `frontend/app-next/tests/shared-primitives.test.tsx`

Cover:
- badge variants render correctly
- section header and metric card render expected labels
- loading/empty/error states render accessibly

- [ ] **Step 2: Run the shared primitive test and verify it fails**

Run: `npm test -- --run tests/shared-primitives.test.tsx`
Expected: FAIL because shared components are missing

- [ ] **Step 3: Implement shared UI primitives**

Use Figma tokens, avoid excessive abstraction, and keep components composable.

- [ ] **Step 4: Re-run the shared primitive test**

Run: `npm test -- --run tests/shared-primitives.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/components/shared
git commit -m "feat: add shared frontend primitives"
```

### Task 6: Implement The Rankings Page First

**Files:**
- Create: `frontend/app-next/components/rankings/rankings-page.tsx`
- Create: `frontend/app-next/components/rankings/rankings-table.tsx`
- Create: `frontend/app-next/components/rankings/race-composition-table.tsx`
- Create: `frontend/app-next/components/rankings/rankings-summary.tsx`
- Modify: `frontend/app-next/app/rankings/page.tsx`

- [ ] **Step 1: Write failing rankings interaction tests**

Test file:
- `frontend/app-next/tests/rankings-page.test.tsx`

Cover:
- default rankings tab renders
- switching to race composition works
- sorting controls update visible order or sort state

- [ ] **Step 2: Run rankings tests and verify they fail**

Run: `npm test -- --run tests/rankings-page.test.tsx`
Expected: FAIL because rankings page components are not implemented

- [ ] **Step 3: Implement rankings UI**

Reproduce:
- tab switcher
- rankings table
- race composition table
- summary cards
- desktop/tablet/mobile layout behavior

- [ ] **Step 4: Re-run rankings tests**

Run: `npm test -- --run tests/rankings-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/app/rankings frontend/app-next/components/rankings
git commit -m "feat: implement rankings page"
```

### Task 7: Implement The Dashboard Page

**Files:**
- Create: `frontend/app-next/components/dashboard/dashboard-page.tsx`
- Modify: `frontend/app-next/app/page.tsx`

- [ ] **Step 1: Write failing dashboard tests**

Test file:
- `frontend/app-next/tests/dashboard-page.test.tsx`

Cover:
- dashboard summary sections render from the page model
- dashboard quick navigation renders available destinations
- dashboard page preserves the Figma landing-page information architecture

- [ ] **Step 2: Run dashboard tests and verify they fail**

Run: `npm test -- --run tests/dashboard-page.test.tsx`
Expected: FAIL because dashboard page components are missing

- [ ] **Step 3: Implement dashboard UI**

Keep upload logic fixture-only in this phase and focus on visual fidelity plus component boundaries.

- [ ] **Step 4: Re-run dashboard tests**

Run: `npm test -- --run tests/dashboard-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/app/page.tsx frontend/app-next/components/dashboard
git commit -m "feat: implement dashboard page"
```

### Task 8: Implement The Replay Vault Page

**Files:**
- Create: `frontend/app-next/components/vault/vault-page.tsx`
- Create: `frontend/app-next/components/vault/upload-card.tsx`
- Create: `frontend/app-next/components/vault/player-stats-card.tsx`
- Create: `frontend/app-next/components/vault/recent-games-table.tsx`
- Create: `frontend/app-next/components/vault/game-detail-panel.tsx`
- Modify: `frontend/app-next/app/vault/page.tsx`

- [ ] **Step 1: Write failing replay vault tests**

Test file:
- `frontend/app-next/tests/vault-page.test.tsx`

Cover:
- upload card renders selected-file state shell
- recent games rows render from page model
- selecting or expanding a game shows detail content

- [ ] **Step 2: Run replay vault tests and verify they fail**

Run: `npm test -- --run tests/vault-page.test.tsx`
Expected: FAIL because replay vault components are missing

- [ ] **Step 3: Implement replay vault UI**

Keep upload logic fixture-only in this phase and focus on visual fidelity plus component boundaries.

- [ ] **Step 4: Re-run replay vault tests**

Run: `npm test -- --run tests/vault-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/app/vault frontend/app-next/components/vault
git commit -m "feat: implement replay vault page"
```

### Task 9: Implement The Analyzer Page

**Files:**
- Create: `frontend/app-next/components/analyzer/analyzer-page.tsx`
- Create: `frontend/app-next/components/analyzer/game-selector.tsx`
- Create: `frontend/app-next/components/analyzer/summary-strip.tsx`
- Create: `frontend/app-next/components/analyzer/timeline-workspace.tsx`
- Create: `frontend/app-next/components/analyzer/player-deep-dive.tsx`
- Modify: `frontend/app-next/app/analyzer/page.tsx`

- [ ] **Step 1: Write failing analyzer interaction tests**

Test file:
- `frontend/app-next/tests/analyzer-page.test.tsx`

Cover:
- game selector changes selected game
- workspace tab switching works
- focused player panel updates when a player is chosen

- [ ] **Step 2: Run analyzer tests and verify they fail**

Run: `npm test -- --run tests/analyzer-page.test.tsx`
Expected: FAIL because analyzer components are not implemented

- [ ] **Step 3: Implement analyzer UI**

Include:
- selector list/table
- summary strip
- timeline workspace tabs
- right-side deep dive panel

- [ ] **Step 4: Re-run analyzer tests**

Run: `npm test -- --run tests/analyzer-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/app/analyzer frontend/app-next/components/analyzer
git commit -m "feat: implement analyzer page"
```

### Task 10: Add Loading, Empty, Error, Metadata, And Responsive Polish

**Files:**
- Modify: `frontend/app-next/app/layout.tsx`
- Modify: `frontend/app-next/app/page.tsx`
- Modify: `frontend/app-next/app/vault/page.tsx`
- Modify: `frontend/app-next/app/rankings/page.tsx`
- Modify: `frontend/app-next/app/analyzer/page.tsx`
- Modify: shared state components as needed

- [ ] **Step 1: Write failing metadata and state tests**

Test files:
- `frontend/app-next/tests/metadata.test.ts`
- `frontend/app-next/tests/page-states.test.tsx`

Cover:
- each route exports expected metadata
- loading/empty/error components render in page composition points

- [ ] **Step 2: Run metadata/state tests and verify they fail**

Run: `npm test -- --run tests/metadata.test.ts tests/page-states.test.tsx`
Expected: FAIL where metadata/state wiring is missing

- [ ] **Step 3: Implement metadata and state integration**

Ensure:
- title/description/OG baseline
- state placeholders exist
- mobile/tablet layout regressions are corrected

- [ ] **Step 4: Re-run metadata/state tests**

Run: `npm test -- --run tests/metadata.test.ts tests/page-states.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/app frontend/app-next/components/shared
git commit -m "feat: add metadata and resilient page states"
```

### Task 11: End-To-End Verification For The Frontend Slice

**Files:**
- Create: `frontend/app-next/tests/smoke.spec.ts`
- Modify: `frontend/app-next/README.md`

- [ ] **Step 1: Write a failing smoke test**

Smoke should cover:
- shell navigation renders
- dashboard page loads
- replay vault page loads
- rankings page loads
- analyzer page loads

- [ ] **Step 2: Run smoke test and verify it fails**

Run: `npm test -- --run tests/smoke.spec.ts`
Expected: FAIL until final wiring and scripts are complete

- [ ] **Step 3: Add the minimal smoke harness and docs**

Document:
- install
- dev port
- how fixtures are wired
- how future API integration should happen

- [ ] **Step 4: Run the frontend test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Run a production build**

Run: `npm run build`
Expected: PASS with no type errors

- [ ] **Step 6: Commit**

```bash
git add frontend/app-next
git commit -m "test: verify figma-first frontend migration slice"
```

### Task 12: Prepare The API Integration Hand-Off Boundary

**Files:**
- Create: `frontend/app-next/lib/api/client.ts`
- Create: `frontend/app-next/lib/api/dashboard.ts`
- Create: `frontend/app-next/lib/api/rankings.ts`
- Create: `frontend/app-next/lib/api/analyzer.ts`
- Modify: `frontend/app-next/README.md`

- [ ] **Step 1: Write failing API client boundary tests**

Test file:
- `frontend/app-next/tests/api-client-boundary.test.ts`

Cover:
- endpoint modules exist
- API layer is separate from fixtures

- [ ] **Step 2: Run boundary test and verify it fails**

Run: `npm test -- --run tests/api-client-boundary.test.ts`
Expected: FAIL because API layer does not exist yet

- [ ] **Step 3: Implement placeholder API modules**

Do not wire live requests yet. Export typed function signatures and TODO comments for next phase.

- [ ] **Step 4: Re-run boundary test**

Run: `npm test -- --run tests/api-client-boundary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/lib/api frontend/app-next/README.md
git commit -m "chore: prepare frontend api integration boundary"
```
