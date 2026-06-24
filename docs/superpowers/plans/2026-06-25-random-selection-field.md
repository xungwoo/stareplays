# Random Selection Field Implementation Plan

> Superseded: this plan incorrectly modeled random selection as a game-level field. The active contract is player-level `players.is_random_selected`; game-level random selection fields are intentionally removed.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superseded historical plan; do not use this as the active random-selection contract.

**Architecture:** The active design stores random selection on `players.is_random_selected` only. Game-level random selection fields and summaries are intentionally removed to avoid ambiguous interpretation.

**Tech Stack:** Go/Fiber/Ent/Postgres, Next.js TypeScript adapters, Node MCP stdio connector.

---

### Task 1: Backend DB/API Field

**Files:**
- Modify: `backend/ent/schema/game.go`
- Generate: `backend/ent/**`
- Modify: `backend/internal/api/handlers/replay_handler.go`
- Test: `backend/internal/api/handlers/replay_handler_season_upload_test.go`

- [x] Add `is_random_selected` bool with default false to `Game`.
- [x] Regenerate Ent code.
- [x] Include `IsRandomSelected bool json:"is_random_selected"` in game DTOs.
- [x] Add focused tests for season summary game data.

### Task 2: CSV Backfill

**Files:**
- Create: `backend/internal/randomselect/csv.go`
- Create: `backend/cmd/random-selection-backfill/main.go`
- Test: `backend/internal/randomselect/csv_test.go`

- [x] Parse Korean season CSV rows and detect `랜` markers.
- [x] Force seasons 7 and 8 to random selected.
- [x] Implement dry-run/update DB command matching games by season and chronological order.
- [x] Test CSV parsing against representative rows.

### Task 3: Frontend Raw Contract

**Files:**
- Modify: `frontend/app-next/types/api.ts`
- Modify: `frontend/app-next/types/team-analysis.ts`
- Modify: `frontend/app-next/lib/adapters/team-analysis.ts`
- Modify: `frontend/app-next/lib/adapters/team-analysis-raw.ts`
- Test: `frontend/app-next/tests/team-analysis-raw.test.ts`

- [x] Add `is_random_selected` to API game summaries.
- [x] Carry random-selection counts and recent-match flags into team-analysis model.
- [x] Bump raw schema to v2 and add `features`/`compatibility`.
- [x] Add LLM guidance for random-selection interpretation.

### Task 4: MCP Flexibility

**Files:**
- Modify: `mcp/stareplays-mcp/lib/prompt-bundle.mjs`
- Modify: `mcp/stareplays-mcp/tests/server.test.mjs`
- Modify: `mcp/stareplays-mcp/README.md`

- [x] Let prompt bundle render API-provided `llm.analysisGuidance`/sections if present.
- [x] Keep raw JSON pass-through unchanged.
- [x] Document that optional schema additions are automatically available in raw tool.

### Task 5: Verification

- [x] Run backend focused tests.
- [x] Run frontend focused tests.
- [x] Run MCP tests.
- [x] Report any DB backfill command not run against production.
