# Start Grid UX Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the legacy start-position-based 3v3 board intent in the Next.js `Vault` and `Analyzer` pages.

**Architecture:** Extend the existing `VaultGame` / `VaultPlayer` model with optional start-location metadata, derive a shared board model in a utility, then render both `Vault` and `Analyzer` from that model. Keep the current visual system, but move the core information architecture back to a start-grid-centered board.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest, Testing Library

---

### Task 1: Add start-location data support

**Files:**
- Modify: `stareplays/frontend/app-next/types/api.ts`
- Modify: `stareplays/frontend/app-next/types/vault.ts`
- Modify: `stareplays/frontend/app-next/lib/adapters/vault.ts`
- Modify: `stareplays/frontend/app-next/lib/fixtures/vault.ts`
- Test: `stareplays/frontend/app-next/tests/start-grid-board.test.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Build a shared start-grid helper

**Files:**
- Create: `stareplays/frontend/app-next/lib/utils/start-grid-board.ts`
- Test: `stareplays/frontend/app-next/tests/start-grid-board.test.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 3: Rebuild the vault selected-game area around the board

**Files:**
- Modify: `stareplays/frontend/app-next/components/vault/vault-page.tsx`
- Test: `stareplays/frontend/app-next/tests/vault-page.test.tsx`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 4: Rebuild the analyzer summary strip around the same board

**Files:**
- Modify: `stareplays/frontend/app-next/components/analyzer/analyzer-page.tsx`
- Modify: `stareplays/frontend/app-next/lib/utils/analyzer-player-order.ts`
- Test: `stareplays/frontend/app-next/tests/analyzer-page.test.tsx`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 5: Verify full flow

**Files:**
- Test: `stareplays/frontend/app-next/tests/start-grid-board.test.ts`
- Test: `stareplays/frontend/app-next/tests/vault-page.test.tsx`
- Test: `stareplays/frontend/app-next/tests/analyzer-page.test.tsx`

- [ ] **Step 1: Run focused tests**
- [ ] **Step 2: Run `npm run typecheck`**
- [ ] **Step 3: Run `npm run build`**
