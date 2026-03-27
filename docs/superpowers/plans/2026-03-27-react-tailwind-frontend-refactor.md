# React Tailwind Frontend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `frontend/app-next`를 legacy parity를 유지한 채 React + Tailwind 구조에 더 맞는 컴포넌트 분리와 스타일 시스템으로 리팩토링한다.

**Architecture:** 상태 ownership은 각 page container에 유지하고, 순수 presentation block만 feature-local component로 분리한다. 반복 inline style은 shared constant/primitive로 이동하고, Tailwind로 안전하게 표현 가능한 부분만 class로 전환한다. loader/adapter/action 경계와 legacy reset semantics는 이번 단계에서 바꾸지 않는다.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, TypeScript, Vitest, Testing Library

## Execution Status

- Completed on `2026-03-27`
- Result commits:
  - `809945a` `refactor: add shared panel primitives`
  - `634ffaa` `refactor: extract analyzer summary strip`
  - `aa8d656` `refactor: extract analyzer tab views`
  - `e09bac1` `refactor: extract analyzer player deep dive`
  - `a34f43f` `refactor: extract vault presentation components`
  - `a50a73e` `refactor: extract dashboard stat views`
  - `6f109ed` `refactor: extract rankings table views`
  - `4f6e40c` `refactor: adopt shared panel primitives`
- Final verification:
  - `npm test` -> `16 files, 117 tests`
  - `npm run typecheck`
  - `npm run build`

---

## File Structure

### Existing files to modify

- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/vault/vault-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/dashboard/dashboard-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/rankings/rankings-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/shared/*.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/constants/ui-styles.ts`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/*.test.tsx`

### New files expected

- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-tabs.tsx`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-summary-strip.tsx`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-player-deep-dive.tsx`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/vault/vault-detail-panel.tsx`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/vault/vault-game-row.tsx`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/dashboard/dashboard-stat-card.tsx`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/dashboard/dashboard-stats-table.tsx`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/rankings/rankings-tables.tsx`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/shared/panel.tsx`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/shared/section-accent.tsx`

### Reference docs

- Refactor scope: `/Users/seongwoo/StarProjects/stareplays/docs/TODO_frontend_refactors_after_parity.md`
- Current architecture: `/Users/seongwoo/StarProjects/stareplays/docs/frontend-next-architecture.md`
- Legacy parity plan: `/Users/seongwoo/StarProjects/stareplays/docs/superpowers/plans/2026-03-24-legacy-frontend-parity-implementation.md`

## Task 1: Extract Shared Panel Primitives

**Files:**
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/shared/panel.tsx`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/shared/section-accent.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/constants/ui-styles.ts`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/shared-primitives.test.tsx`
- Test: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/shared-primitives.test.tsx`

- [ ] **Step 1: Write failing tests for shared panel primitives**

Add tests for:
- reusable cyan panel wrapper preserving current border/background values
- inner panel wrapper preserving current dark panel values
- section accent bar rendering consistent dimensions/colors

- [ ] **Step 2: Run the shared primitive test file**

Run: `npm test -- tests/shared-primitives.test.tsx`
Expected: FAIL because the new shared primitives do not exist yet.

- [ ] **Step 3: Implement minimal shared primitive components**

Implement:
- `Panel` with variants for `cyan`, `inner`, `innerStrong`
- `SectionAccent` for the left cyan marker used in rankings/vault/dashboard
- keep exact existing rendered styles

- [ ] **Step 4: Re-run the shared primitive tests**

Run: `npm test -- tests/shared-primitives.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/components/shared/panel.tsx frontend/app-next/components/shared/section-accent.tsx frontend/app-next/lib/constants/ui-styles.ts frontend/app-next/tests/shared-primitives.test.tsx
git commit -m "refactor: add shared panel primitives"
```

> Execution note: Task 1 may already be completed in the working tree when this plan is being executed. In that case, keep the tests as the regression baseline and continue from Task 2.

## Task 2: Extract Analyzer Summary Strip

**Files:**
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-summary-strip.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/analyzer-page.test.tsx`
- Test: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/analyzer-page.test.tsx`

- [ ] **Step 1: Add failing analyzer tests that lock summary-strip extraction**

Add tests asserting:
- summary strip still renders the start-grid layout
- summary metadata blocks still render `MAP`, `PLAY TIME`, `START`
- summary strip still uses the same start-position side ordering

- [ ] **Step 2: Run analyzer tests**

Run: `npm test -- tests/analyzer-page.test.tsx`
Expected: PASS before extraction, then use as regression guard while extracting.

- [ ] **Step 3: Extract pure presentation components**

Extract only:
- summary strip and start-grid player cards

Keep in container:
- selected game state
- selected game routing sync
- selected player state
- refresh/reanalyze state

- [ ] **Step 4: Re-run analyzer tests**

Run: `npm test -- tests/analyzer-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/components/analyzer/analyzer-summary-strip.tsx frontend/app-next/components/analyzer/analyzer-page.tsx frontend/app-next/tests/analyzer-page.test.tsx
git commit -m "refactor: extract analyzer summary strip"
```

## Task 3: Extract Analyzer Tabs And Tab Bodies

**Files:**
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-tabs.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/analyzer-page.test.tsx`
- Test: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/analyzer-page.test.tsx`

- [ ] **Step 1: Tighten analyzer tests around tab behavior**

Add tests asserting:
- tab switching still exposes the same six legacy tabs
- match-flow pager reset still works after extraction
- APM hide/show semantics are preserved

- [ ] **Step 2: Run analyzer tests**

Run: `npm test -- tests/analyzer-page.test.tsx`
Expected: PASS before extraction, then use as regression guard.

- [ ] **Step 3: Extract tab navigation and tab bodies**

Extract only:
- tab switcher
- match-flow tab
- economy tab
- apm tab
- production tab
- tech tab
- combat tab

Keep in container:
- selected game state
- selected player state
- refresh/reanalyze state
- selector pagination and reset semantics
- active tab state
- apm hidden player state

- [ ] **Step 4: Re-run analyzer tests**

Run: `npm test -- tests/analyzer-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/components/analyzer/analyzer-tabs.tsx frontend/app-next/components/analyzer/analyzer-page.tsx frontend/app-next/tests/analyzer-page.test.tsx
git commit -m "refactor: extract analyzer tab views"
```

## Task 4: Extract Analyzer Player Deep Dive

**Files:**
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-player-deep-dive.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/analyzer-page.test.tsx`
- Test: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/analyzer-page.test.tsx`

- [ ] **Step 1: Tighten analyzer tests around deep-dive behavior**

Lock:
- `All Players` summary
- focused-player stats
- selected-game key/worst player behavior
- selected-player persistence across game switches

- [ ] **Step 2: Run analyzer tests**

Run: `npm test -- tests/analyzer-page.test.tsx`
Expected: PASS before extraction.

- [ ] **Step 3: Extract the deep-dive panel**

Extract only:
- player list
- focused-player card
- all-players summary

Keep in container:
- focused player state
- selection toggles
- route/game sync semantics

- [ ] **Step 4: Re-run analyzer tests**

Run: `npm test -- tests/analyzer-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/components/analyzer/analyzer-player-deep-dive.tsx frontend/app-next/components/analyzer/analyzer-page.tsx frontend/app-next/tests/analyzer-page.test.tsx
git commit -m "refactor: extract analyzer player deep dive"
```

## Task 5: Split Vault Presentation Components

**Files:**
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/vault/vault-detail-panel.tsx`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/vault/vault-game-row.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/vault/vault-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/vault-page.test.tsx`
- Test: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/vault-page.test.tsx`

- [ ] **Step 1: Add or tighten failing vault regression tests**

Lock:
- row re-click collapse
- analyzer deep-link rendering
- selected detail panel with current viz tab
- 3x3 start-grid board rendering

- [ ] **Step 2: Run vault tests**

Run: `npm test -- tests/vault-page.test.tsx`
Expected: PASS before extraction, then use as regression guard during extraction.

- [ ] **Step 3: Extract pure presentation blocks**

Extract only:
- game row rendering
- selected detail panel
- board player cards / visual wrappers

Keep in container:
- selected row state
- fullscreen state
- tech focus / highlighted player state
- detail fetch orchestration

- [ ] **Step 4: Re-run vault tests**

Run: `npm test -- tests/vault-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/components/vault frontend/app-next/tests/vault-page.test.tsx
git commit -m "refactor: split vault presentation components"
```

## Task 6: Split Dashboard Presentation Components

**Files:**
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/dashboard/dashboard-stat-card.tsx`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/dashboard/dashboard-stats-table.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/dashboard/dashboard-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/dashboard-page.test.tsx`
- Test: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/dashboard-page.test.tsx`

- [ ] **Step 1: Tighten dashboard regression coverage**

Lock:
- `NO_PREVIEW` / `READY`
- preview success terminal
- upload CTA/link rendering
- player stats tables and win-rate progress

- [ ] **Step 2: Run dashboard tests**

Run: `npm test -- tests/dashboard-page.test.tsx`
Expected: PASS before extraction, then use as regression guard.

- [ ] **Step 3: Extract pure presentation blocks**

Extract only:
- stat card
- stats table
- follow-up CTA block

Keep in container:
- current user persistence
- preview/upload/query state
- suggestion debounce/fetch
- router sync logic

- [ ] **Step 4: Re-run dashboard tests**

Run: `npm test -- tests/dashboard-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/components/dashboard frontend/app-next/tests/dashboard-page.test.tsx
git commit -m "refactor: split dashboard presentation components"
```

## Task 7: Normalize Rankings Structure

**Files:**
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/rankings/rankings-tables.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/rankings/rankings-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/rankings-page.test.tsx`
- Test: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/rankings-page.test.tsx`

- [ ] **Step 1: Use rankings tests as regression lock**

Run: `npm test -- tests/rankings-page.test.tsx`
Expected: PASS before extraction.

- [ ] **Step 2: Extract table-only presentation blocks**

Extract:
- rankings table
- race composition table
- win-rate bar

Keep in page container:
- tab state
- sort state
- tie-break logic

- [ ] **Step 3: Re-run rankings tests**

Run: `npm test -- tests/rankings-page.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/app-next/components/rankings frontend/app-next/tests/rankings-page.test.tsx
git commit -m "refactor: normalize rankings presentation structure"
```

## Task 8: Tailwind Alignment Cleanup

**Files:**
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/**/*`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/constants/ui-styles.ts`
- Test: affected page tests

- [ ] **Step 1: Write or tighten assertions around class-level structure**

Target:
- panel wrappers use shared primitives
- repeated accent/button/layout wrappers use Tailwind-friendly class names
- no behavior changes

- [ ] **Step 2: Run targeted page tests**

Run: `npm test -- tests/dashboard-page.test.tsx tests/vault-page.test.tsx tests/analyzer-page.test.tsx tests/rankings-page.test.tsx`
Expected: PASS before cleanup.

- [ ] **Step 3: Replace repeated JSX wrappers with shared primitive usage**

Do:
- convert repeated wrapper blocks to `Panel` / `SectionAccent`
- replace safe repeated accent/spacing wrappers with Tailwind classes where the output is already covered by tests
- keep pixel-sensitive inline values only where Tailwind cannot safely express them

Avoid:
- changing state ownership
- changing request flows
- changing reset semantics

- [ ] **Step 4: Re-run targeted page tests**

Run: `npm test -- tests/dashboard-page.test.tsx tests/vault-page.test.tsx tests/analyzer-page.test.tsx tests/rankings-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/components frontend/app-next/lib/constants/ui-styles.ts
git commit -m "refactor: align frontend structure with react and tailwind"
```

## Task 9: Full Verification and Docs

**Files:**
- Modify: `/Users/seongwoo/StarProjects/stareplays/docs/frontend-next-architecture.md`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/README.md`
- Modify: `/Users/seongwoo/StarProjects/stareplays/docs/TODO_frontend_refactors_after_parity.md`
- Test: full app

- [ ] **Step 1: Run full verification**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Update docs**

Document:
- extracted presentation components
- retained container/state boundaries
- remaining post-refactor work still intentionally deferred

- [ ] **Step 5: Commit**

```bash
git add docs/frontend-next-architecture.md frontend/app-next/README.md docs/TODO_frontend_refactors_after_parity.md
git commit -m "docs: record react tailwind refactor status"
```
