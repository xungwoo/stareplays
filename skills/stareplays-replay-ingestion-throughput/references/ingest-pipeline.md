# Ingest Pipeline

## Current Stages

1. Parse multipart form.
2. Save each file to temp directory.
3. Parse replay.
4. Resolve uploader.
5. Find existing replay/game.
6. Insert replay/game/player/detail rows in transactions.

## Improvement Targets

- Reduce duplicate DB lookups per file.
- Add worker pool for parse stage.
- Keep DB writes serialized per game key when needed.
