# Dashboard Exact Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Next.js Dashboard render as close as possible to the exported Figma/Vite Dashboard before expanding the same workflow to the other pages.

**Architecture:** Treat the exported Figma/Vite source as the visual source of truth and keep the Next.js route/data boundaries only where required. Port the page structure and style expressions with minimal abstraction, then verify parity with targeted UI tests and full app verification.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, TypeScript, Vitest, Testing Library

---

### Task 1: Lock Dashboard Exact-Port Acceptance Tests

**Files:**
- Modify: `frontend/app-next/tests/dashboard-page.test.tsx`
- Reference: `/Users/seongwoo/Downloads/Starcraft Replay Analysis Site/src/app/pages/Dashboard.tsx`

- [ ] **Step 1: Write the failing test**

Add assertions for the exported-source style expressions that are still approximate in the Next dashboard:
- current-user chip uses inline cyan chip styles
- win-rate progress rail uses direct inline background color
- progress fill uses inline gradient background

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/dashboard-page.test.tsx`
Expected: FAIL on the newly added style parity assertions

- [ ] **Step 3: Write minimal implementation**

Update `frontend/app-next/components/dashboard/dashboard-page.tsx` so the Dashboard uses the same style-object expressions as the exported source for the failing areas.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/dashboard-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/tests/dashboard-page.test.tsx frontend/app-next/components/dashboard/dashboard-page.tsx
git commit -m "test: lock dashboard exact-port styles"
```

### Task 2: Reduce Dashboard Abstraction to Source-Level Expressions

**Files:**
- Modify: `frontend/app-next/components/dashboard/dashboard-page.tsx`
- Reference: `/Users/seongwoo/Downloads/Starcraft Replay Analysis Site/src/app/pages/Dashboard.tsx`

- [ ] **Step 1: Write the failing test**

Extend the Dashboard test to catch one more source-parity target that should remain direct rather than utility-approximated:
- stat-card value color expression
- upload status icon/text state expression
- helper card gradient/border expression

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/dashboard-page.test.tsx`
Expected: FAIL on at least one newly added assertion

- [ ] **Step 3: Write minimal implementation**

Bring the remaining Dashboard style and structure closer to the exported source while keeping current Next data bindings intact.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/dashboard-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/components/dashboard/dashboard-page.tsx frontend/app-next/tests/dashboard-page.test.tsx
git commit -m "refactor: exact-port dashboard source expressions"
```

### Task 3: Re-verify Shell and Neighboring Pages for Regression

**Files:**
- Modify: `frontend/app-next/tests/app-shell-layout.test.tsx` if shell parity expectations need tightening
- Verify only: `frontend/app-next/components/shell/*`, `frontend/app-next/components/rankings/*`, `frontend/app-next/components/vault/*`, `frontend/app-next/components/analyzer/*`

- [ ] **Step 1: Write the failing test**

Only if needed, add a shell/layout regression assertion that proves the Dashboard exact-port changes did not regress shared shell output.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/app-shell-layout.test.tsx`
Expected: FAIL only if a new regression assertion was added

- [ ] **Step 3: Write minimal implementation**

Adjust shared shell code only if the new assertion reveals an actual mismatch.

- [ ] **Step 4: Run focused verification**

Run:
- `npm test -- tests/dashboard-page.test.tsx`
- `npm test -- tests/app-shell-layout.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app-next/tests/app-shell-layout.test.tsx frontend/app-next/components/shell
git commit -m "test: preserve shell parity during dashboard exact port"
```

### Task 4: Full Verification Gate

**Files:**
- Verify only: `frontend/app-next`

- [ ] **Step 1: Run full tests**

Run: `npm test`
Expected: PASS with all test files green

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: exit code 0 with successful static generation/build summary

- [ ] **Step 4: Manual local check**

Run: `curl -I http://localhost:3100`
Expected: `HTTP/1.1 200 OK`

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-03-22-dashboard-exact-port.md
git commit -m "docs: add dashboard exact-port plan"
```
