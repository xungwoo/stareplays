# Production Migration Plan: Invalid Short Games (<= 2 min)

## Goal
- Treat games with `game_length <= 120` seconds as invalid/draw.
- Ensure these games are excluded from ranking/analyzer/user stats.
- Normalize existing production data:
  - `games.winner_team = 0`
  - `players.is_winner = false`
  - `players.result = 'draw'`

## Scope
- Tables: `games`, `players`
- Snapshot refresh: `ranking_3v3`, `analyzer_race_matchups` via jobs

## Preconditions
- New server code is already deployed (runtime rule + aggregation exclusions).
- DB credentials available in production environment.
- Job commands available:
  - `go run ./cmd/ranking-job/main.go`
  - `go run ./cmd/analyzer-job/main.go`

## Safe Rollout Strategy
1. Pre-check (read-only)
- Run:
  - `./scripts/migrate_short_games_invalid.sh`
- Confirm expected target counts (`short_games`, `players_need_normalize`).

2. Snapshot backup (recommended)
- Export current rows before migration:
  - `pg_dump --data-only --table=games --table=players ... > pre_short_game_migration.sql`
- Optional lightweight backup:
  - Copy only target rows with `game_length <= 120` to temp tables.

3. Apply migration (transactional)
- Run:
  - `./scripts/migrate_short_games_invalid.sh --apply`
- This script uses a single transaction and is idempotent.

4. Rebuild snapshots
- Run:
  - `./scripts/migrate_short_games_invalid.sh --apply --refresh-snapshots`
  - or run ranking/analyzer jobs separately once.

5. Post-check
- Validate:
  - No short game has `winner_team <> 0`
  - No player row in short games has `is_winner=true` or non-draw result
  - `qualified_games` in ranking/analyzer are reduced as expected

## SQL Verification Queries
```sql
SELECT COUNT(*)
FROM games
WHERE COALESCE(game_length,0) > 0
  AND game_length <= 120
  AND winner_team <> 0;

SELECT COUNT(*)
FROM players p
JOIN games g ON g.id = p.game_players
WHERE COALESCE(g.game_length,0) > 0
  AND g.game_length <= 120
  AND (p.is_winner = TRUE OR lower(coalesce(p.result,'')) <> 'draw');
```

## Rollback Strategy
- If post-check fails:
  - Restore from backup dump for `games`/`players`, then rerun snapshots.
- Because migration is deterministic/idempotent, rerun is safe after issue fix.

## Operational Notes
- This migration is low-lock impact (small targeted updates by condition).
- For very large datasets, run during low traffic window.
- Keep cron jobs paused during migration window, then resume after snapshot refresh.
