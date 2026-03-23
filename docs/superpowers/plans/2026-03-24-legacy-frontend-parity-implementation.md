# Legacy Frontend Behavior Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `frontend/app-next`가 `frontend/web`의 상세 행동을 `Dashboard`, `Vault`, `Analyzer`, `Rankings` 전 영역에서 parity 수준으로 이식하도록 구현한다.

**Architecture:** legacy behavior는 `frontend/web` 실제 동작을 기준으로 복원하고, `app-next`의 `loader -> adapter -> page model -> component` 구조는 유지한다. 구현은 큰 구조 변경보다 behavior parity를 우선하며, 지금 바로 해도 되는 안전한 리팩토링만 병행한다.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, TypeScript, Vitest, Testing Library

---

## File Structure

### Existing files to modify

- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/dashboard/dashboard-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/vault/vault-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/rankings/rankings-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/api/actions.ts`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/api/client.ts`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/loaders/*.ts`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/adapters/*.ts`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/*.test.tsx`

### New files expected

- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/dashboard/*` presentation splits as needed
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/vault/*` presentation splits as needed
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/*` presentation splits as needed
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/rankings/*` presentation splits as needed
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/constants/*` shared visual style constants if needed

### Reference docs

- Spec: `/Users/seongwoo/StarProjects/stareplays/docs/superpowers/specs/2026-03-24-legacy-frontend-behavior-parity-design.md`
- Safe refactors TODO: `/Users/seongwoo/StarProjects/stareplays/docs/TODO_frontend_refactors_safe_now.md`
- Post-parity refactors TODO: `/Users/seongwoo/StarProjects/stareplays/docs/TODO_frontend_refactors_after_parity.md`

## Task 1: Lock Safe-Now Refactor Boundaries

**Files:**
- Modify: `/Users/seongwoo/StarProjects/stareplays/docs/TODO_frontend_refactors_safe_now.md`
- Modify: `/Users/seongwoo/StarProjects/stareplays/docs/TODO_frontend_refactors_after_parity.md`
- Test: N/A

- [ ] **Step 1: Verify TODO docs reflect current repo state**

Run: `sed -n '1,240p' /Users/seongwoo/StarProjects/stareplays/docs/TODO_frontend_refactors_safe_now.md`
Expected: Immediate-only refactors listed, no large architecture rewrites.

- [ ] **Step 2: Verify deferred TODO doc clearly excludes parity blockers**

Run: `sed -n '1,260p' /Users/seongwoo/StarProjects/stareplays/docs/TODO_frontend_refactors_after_parity.md`
Expected: Token redesign, state model cleanup, large file decomposition listed as post-parity work.

- [ ] **Step 3: Commit if docs were adjusted**

```bash
git add docs/TODO_frontend_refactors_safe_now.md docs/TODO_frontend_refactors_after_parity.md
git commit -m "docs: define frontend refactor boundaries"
```

## Task 2: Dashboard Legacy Upload and Query Parity

**Files:**
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/dashboard/dashboard-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/dashboard-page.test.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/api/actions.ts`
- Test: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/dashboard-page.test.tsx`

- [ ] **Step 1: Write failing tests for legacy preview summary parity**

Add tests for:
- initial `NO_PREVIEW`
- preview success terminal summary
- invalid current-user preserved after preview mismatch
- upload blocked with legacy-style failure when current user is not a common participant

- [ ] **Step 2: Run dashboard tests to see failures**

Run: `npm test -- tests/dashboard-page.test.tsx`
Expected: FAIL on missing legacy terminal summary / invalid-user persistence behavior.

- [ ] **Step 3: Implement minimal Dashboard parity fixes**

Implement:
- exact preview initial state
- preview summary terminal behavior
- invalid current user persistence after preview mismatch
- legacy-style upload failure messages

- [ ] **Step 4: Re-run dashboard tests**

Run: `npm test -- tests/dashboard-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Dashboard parity chunk**

```bash
git add frontend/app-next/components/dashboard/dashboard-page.tsx frontend/app-next/tests/dashboard-page.test.tsx frontend/app-next/lib/api/actions.ts
git commit -m "feat: align dashboard legacy upload parity"
```

## Task 3: Vault Selection Toggle and Inline Viz Parity

**Files:**
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/vault/vault-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/vault-page.test.tsx`
- Test: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/vault-page.test.tsx`

- [ ] **Step 1: Write failing tests for row re-click collapse and hidden detail behavior**

Add tests for:
- clicking selected row clears selection
- detail section hides instead of showing a visible no-selection panel
- current inline viz tabs match legacy set where applicable

- [ ] **Step 2: Run vault tests**

Run: `npm test -- tests/vault-page.test.tsx`
Expected: FAIL on collapse/hidden-detail parity assertions.

- [ ] **Step 3: Implement minimal Vault parity fixes**

Implement:
- row re-click collapse semantics
- hidden detail behavior when nothing selected
- inline viz tab parity progress without large state rewrites

- [ ] **Step 4: Re-run vault tests**

Run: `npm test -- tests/vault-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Vault parity chunk**

```bash
git add frontend/app-next/components/vault/vault-page.tsx frontend/app-next/tests/vault-page.test.tsx
git commit -m "feat: align vault selection parity"
```

## Task 4: Analyzer List, Status, and Tab Parity

**Files:**
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/loaders/analyzer.ts`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/analyzer-page.test.tsx`
- Test: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/analyzer-page.test.tsx`

- [ ] **Step 1: Write failing tests for analyzer no-user list load and status semantics**

Add tests for:
- analyzer loads games even without current user filter
- status panel keeps prior state until new fetch resolves when that matches legacy
- tab set parity (`match-flow`, `economy`, `apm`, `production`, `tech`, `combat`)

- [ ] **Step 2: Run analyzer tests**

Run: `npm test -- tests/analyzer-page.test.tsx`
Expected: FAIL on legacy tab or status parity assertions.

- [ ] **Step 3: Implement minimal Analyzer parity fixes**

Implement:
- optional `user_name` filtering semantics
- legacy tab naming/set parity
- status refresh semantics
- timeline synthesis parity where currently simplified

- [ ] **Step 4: Re-run analyzer tests**

Run: `npm test -- tests/analyzer-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Analyzer parity chunk**

```bash
git add frontend/app-next/components/analyzer/analyzer-page.tsx frontend/app-next/lib/loaders/analyzer.ts frontend/app-next/tests/analyzer-page.test.tsx
git commit -m "feat: align analyzer legacy behavior parity"
```

## Task 5: Rankings Client-Side Sort Parity

**Files:**
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/rankings/rankings-page.tsx`
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/rankings-page.test.tsx`
- Test: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests/rankings-page.test.tsx`

- [ ] **Step 1: Write failing tests for ranking sort arrows and tie-break rules**

Add tests for:
- win-rate / avg_apm / avg_eapm sort toggle
- race composition `games` / `team_a_win_rate` toggle
- arrow indicator semantics
- current user row highlight semantics

- [ ] **Step 2: Run rankings tests**

Run: `npm test -- tests/rankings-page.test.tsx`
Expected: FAIL on missing client-side sort behavior.

- [ ] **Step 3: Implement minimal Rankings parity fixes**

Implement:
- client-side sort states
- arrow indicators
- tie-break rules
- tab behavior parity

- [ ] **Step 4: Re-run rankings tests**

Run: `npm test -- tests/rankings-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Rankings parity chunk**

```bash
git add frontend/app-next/components/rankings/rankings-page.tsx frontend/app-next/tests/rankings-page.test.tsx
git commit -m "feat: align rankings client-side parity"
```

## Task 6: Apply Safe-Now Refactors During Parity Work

**Files:**
- Modify: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/**/*`
- Create: `/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/constants/*`
- Test: affected page tests

- [ ] **Step 1: Extract repeated style constants without changing rendered output**

Candidate values:
- panel background `#0d1833`
- inner panel `#0a1428`
- cyan border variants
- repeated refresh button styles

- [ ] **Step 2: Split pure presentation blocks from 500+ line files**

Do only:
- stat cards
- panel headers
- board player cards
- chart wrappers

Avoid:
- changing state ownership
- changing reset semantics

- [ ] **Step 3: Run page-level tests after each extraction**

Run: `npm test -- tests/dashboard-page.test.tsx tests/vault-page.test.tsx tests/analyzer-page.test.tsx tests/rankings-page.test.tsx`
Expected: PASS after each micro-refactor.

- [ ] **Step 4: Commit safe-now refactor chunk**

```bash
git add frontend/app-next/components frontend/app-next/lib/constants
git commit -m "refactor: extract safe shared frontend primitives"
```

## Task 7: Full Verification and Gap Review

**Files:**
- Modify: `/Users/seongwoo/StarProjects/stareplays/docs/frontend-next-architecture.md`
- Modify: `/Users/seongwoo/StarProjects/stareplays/README.md`
- Test: full app

- [ ] **Step 1: Run full frontend verification**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Update docs to reflect completed parity scope**

Document:
- restored legacy behaviors
- intentionally deferred post-parity refactors
- remaining known gaps if any

- [ ] **Step 5: Commit verification/docs**

```bash
git add docs/frontend-next-architecture.md README.md
git commit -m "docs: record legacy parity implementation status"
```

## Task 8: Browser Validation Pass

**Files:**
- Modify: as needed from findings
- Test: local running app

- [ ] **Step 1: Start or confirm local services**

Run:
- `curl -s http://127.0.0.1:3000/health`
- `curl -I http://127.0.0.1:3100`

Expected:
- backend healthy
- frontend reachable

- [ ] **Step 2: Manually verify critical legacy flows**

Checklist:
- Dashboard preview/upload/query
- Vault row select/re-click collapse
- Vault inline viz tabs
- Analyzer game selection, tabs, refresh status, selected player behavior
- Rankings client-side sort arrows

- [ ] **Step 3: Apply any final parity fixes discovered**

Run targeted tests for only the touched page before re-running full verification.

- [ ] **Step 4: Final commit**

```bash
git add frontend/app-next docs
git commit -m "feat: complete legacy frontend behavior parity"
```

