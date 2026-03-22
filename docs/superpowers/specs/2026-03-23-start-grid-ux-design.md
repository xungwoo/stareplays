# Start Grid UX Restoration Design

**Goal:** Restore the original 3v3 starting-point intent from the legacy StaReplays web inside the current Next.js dark UI.

## Problem

The current `Vault` and `Analyzer` surfaces present teams as winner/loser lists. That preserves outcome, but it drops the original replay-reading intent: a 3v3 game should be understood as a board-shaped matchup anchored by player start positions.

Legacy behavior used `start_location_x` and `start_location_y` to reconstruct:

- left-side and right-side team ordering
- vertical player ordering within each side
- a center matchup block that explains the game as a `3v3` board, not just two arrays

## Design

The restored UX keeps the current dark visual language, but reintroduces a shared `start grid` model:

- `VaultPlayer` will carry optional `startLocationX` and `startLocationY`
- API adapters and fixtures will populate those fields
- a shared utility will derive:
  - left column players
  - right column players
  - center matchup races
  - stable fallback ordering when coordinates are missing

Two screens will consume this shared model:

- `Vault` selected game detail:
  - replace simple left/right card columns with a board-centric layout
  - preserve player stat cards, but position them according to start grid order
- `Analyzer` summary strip:
  - replace symmetric winner/loser list rendering with the same board model
  - center panel remains the informational hub for matchup and play time

## Boundaries

- No backend contract change is required immediately; frontend supports optional coordinates.
- Existing dark styling, race badges, result badges, and current user labels stay intact.
- Timeline, deep-dive, and chart tabs are unchanged in this pass.

## Success Criteria

- A user can visually infer 3v3 board structure from both `Vault` and `Analyzer`
- start-position ordering is shared between both pages
- when coordinates are absent, the UI still renders with deterministic fallback order
