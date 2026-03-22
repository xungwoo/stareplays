# Next Frontend API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect `frontend/app-next` to the existing Fiber API for both read and write flows, including replay preview/upload, current-user persistence, Vault-to-Analyzer deep-linking, and refresh-based analyzer operation.

**Architecture:** Keep the current `loader -> adapter -> page model` design for reads, add a focused client-side API action layer for writes, and centralize `current user` persistence through cookie-aware helpers. Page components should consume stable page models and action states rather than backend response shapes.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library, existing Fiber API

---

### Task 1: Add cookie-aware session and action-capable API client helpers

**Files:**
- Modify: `frontend/app-next/lib/api/client.ts`
- Create: `frontend/app-next/lib/api/actions.ts`
- Create: `frontend/app-next/lib/utils/current-user-session.ts`
- Test: `frontend/app-next/tests/api-client-actions.test.ts`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

### Task 2: Make loaders resolve real current-user state before fixture fallback

**Files:**
- Modify: `frontend/app-next/lib/loaders/dashboard.ts`
- Modify: `frontend/app-next/lib/loaders/vault.ts`
- Modify: `frontend/app-next/lib/loaders/analyzer.ts`
- Modify: `frontend/app-next/lib/loaders/rankings.ts`
- Modify: `frontend/app-next/app/page.tsx`
- Modify: `frontend/app-next/app/vault/page.tsx`
- Modify: `frontend/app-next/app/analyzer/page.tsx`
- Modify: `frontend/app-next/app/rankings/page.tsx`
- Test: `frontend/app-next/tests/api-loaders.test.ts`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

### Task 3: Restore Dashboard preview/upload/query write flows

**Files:**
- Modify: `frontend/app-next/components/dashboard/dashboard-page.tsx`
- Modify: `frontend/app-next/types/api.ts`
- Modify: `frontend/app-next/types/dashboard.ts`
- Modify: `frontend/app-next/components/shared/error-state.tsx`
- Modify: `frontend/app-next/components/shared/loading-state.tsx`
- Test: `frontend/app-next/tests/dashboard-page.test.tsx`

- [ ] **Step 1: Write the failing interaction tests**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

### Task 4: Add shared current-user persistence across pages

**Files:**
- Modify: `frontend/app-next/components/shell/current-user-chip.tsx`
- Modify: `frontend/app-next/components/shell/app-header.tsx`
- Modify: `frontend/app-next/components/vault/vault-page.tsx`
- Modify: `frontend/app-next/components/analyzer/analyzer-page.tsx`
- Modify: `frontend/app-next/components/rankings/rankings-page.tsx`
- Test: `frontend/app-next/tests/app-shell-smoke.test.tsx`
- Test: `frontend/app-next/tests/app-shell-layout.test.tsx`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

### Task 5: Add Vault-to-Analyzer deep-link and route-driven selection

**Files:**
- Modify: `frontend/app-next/components/vault/vault-page.tsx`
- Modify: `frontend/app-next/components/analyzer/analyzer-page.tsx`
- Modify: `frontend/app-next/lib/loaders/analyzer.ts`
- Modify: `frontend/app-next/types/analyzer.ts`
- Test: `frontend/app-next/tests/vault-page.test.tsx`
- Test: `frontend/app-next/tests/analyzer-page.test.tsx`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

### Task 6: Add manual analyzer refresh and reanalyze entry point

**Files:**
- Modify: `frontend/app-next/components/analyzer/analyzer-page.tsx`
- Modify: `frontend/app-next/lib/api/actions.ts`
- Modify: `frontend/app-next/types/api.ts`
- Test: `frontend/app-next/tests/analyzer-page.test.tsx`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

### Task 7: Tighten fallback behavior and finish verification

**Files:**
- Modify: `frontend/app-next/README.md`
- Modify: `docs/frontend-next-architecture.md`
- Test: `frontend/app-next/tests/api-loaders.test.ts`
- Test: `frontend/app-next/tests/dashboard-page.test.tsx`
- Test: `frontend/app-next/tests/vault-page.test.tsx`
- Test: `frontend/app-next/tests/analyzer-page.test.tsx`

- [ ] **Step 1: Run focused tests**
- [ ] **Step 2: Run `npm test`**
- [ ] **Step 3: Run `npm run typecheck`**
- [ ] **Step 4: Run `npm run build`**
- [ ] **Step 5: Commit**
