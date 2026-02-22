# MIGRATION_JOB

## Purpose
- Normalize existing short games (`game_length <= 120s`) as invalid draw:
  - `games.winner_team = 0`
  - `players.is_winner = false`
  - `players.result = 'draw'`
- Optional snapshot refresh for:
  - `ranking_3v3`
  - `analyzer_race_matchups`

## Run Once (Local/Production)
```bash
cd backend && go run ./cmd/migration-job/main.go
```

## Environment Variables
- `MIGRATION_SHORT_GAME_MAX_SECONDS`:
  - default: `120`
- `MIGRATION_REFRESH_SNAPSHOTS`:
  - default: `true`
  - set `false` to skip ranking/analyzer refresh
- `RANKING_MIN_GAMES`:
  - used only when ranking snapshot refresh runs

## Example (Railway Cron once command)
```bash
cd backend && MIGRATION_SHORT_GAME_MAX_SECONDS=120 MIGRATION_REFRESH_SNAPSHOTS=true go run ./cmd/migration-job/main.go
```

