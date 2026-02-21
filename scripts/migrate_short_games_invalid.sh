#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
MAX_SECONDS="${MAX_SECONDS:-120}"
MODE="dry-run"
REFRESH_SNAPSHOTS="false"

for arg in "$@"; do
  case "$arg" in
    --apply)
      MODE="apply"
      ;;
    --refresh-snapshots)
      REFRESH_SNAPSHOTS="true"
      ;;
    --help|-h)
      cat <<USAGE
Usage: ./scripts/migrate_short_games_invalid.sh [--apply] [--refresh-snapshots]

Rules:
  - game_length > 0 and <= MAX_SECONDS(default:120) => invalid short game
  - games.winner_team -> 0
  - players.is_winner -> false
  - players.result -> draw

Options:
  --apply               Execute updates (default is dry-run)
  --refresh-snapshots   Run ranking/analyzer jobs after apply
USAGE
      exit 0
      ;;
    *)
      echo "[migrate] unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-postgres}"

export PGPASSWORD="${DB_PASSWORD}"

PSQL=(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1)

echo "[migrate] mode=${MODE} max_seconds=${MAX_SECONDS} db=${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo "[migrate] pre-check"
"${PSQL[@]}" -c "
SELECT
  (SELECT COUNT(*) FROM games WHERE COALESCE(game_length,0) > 0 AND game_length <= ${MAX_SECONDS}) AS short_games,
  (SELECT COUNT(*) FROM games WHERE COALESCE(game_length,0) > 0 AND game_length <= ${MAX_SECONDS} AND winner_team <> 0) AS short_games_nonzero_winner,
  (SELECT COUNT(*) FROM players p JOIN games g ON g.id=p.game_players WHERE COALESCE(g.game_length,0) > 0 AND g.game_length <= ${MAX_SECONDS}) AS players_on_short_games,
  (SELECT COUNT(*) FROM players p JOIN games g ON g.id=p.game_players WHERE COALESCE(g.game_length,0) > 0 AND g.game_length <= ${MAX_SECONDS} AND (p.is_winner = TRUE OR lower(coalesce(p.result,'')) <> 'draw')) AS players_need_normalize;
"

if [[ "${MODE}" != "apply" ]]; then
  echo "[migrate] dry-run only. use --apply to execute migration"
  exit 0
fi

echo "[migrate] applying updates"
"${PSQL[@]}" <<SQL
BEGIN;

WITH target_games AS (
  SELECT id
  FROM games
  WHERE COALESCE(game_length,0) > 0
    AND game_length <= ${MAX_SECONDS}
)
UPDATE games g
SET winner_team = 0,
    updated_at = NOW()
WHERE g.id IN (SELECT id FROM target_games)
  AND g.winner_team <> 0;

WITH target_games AS (
  SELECT id
  FROM games
  WHERE COALESCE(game_length,0) > 0
    AND game_length <= ${MAX_SECONDS}
)
UPDATE players p
SET is_winner = FALSE,
    result = 'draw'
WHERE p.game_players IN (SELECT id FROM target_games)
  AND (p.is_winner = TRUE OR lower(coalesce(p.result,'')) <> 'draw');

COMMIT;
SQL

echo "[migrate] post-check"
"${PSQL[@]}" -c "
SELECT
  (SELECT COUNT(*) FROM games WHERE COALESCE(game_length,0) > 0 AND game_length <= ${MAX_SECONDS} AND winner_team <> 0) AS short_games_nonzero_winner_after,
  (SELECT COUNT(*) FROM players p JOIN games g ON g.id=p.game_players WHERE COALESCE(g.game_length,0) > 0 AND g.game_length <= ${MAX_SECONDS} AND (p.is_winner = TRUE OR lower(coalesce(p.result,'')) <> 'draw')) AS players_need_normalize_after;
"

if [[ "${REFRESH_SNAPSHOTS}" == "true" ]]; then
  echo "[migrate] refreshing snapshots"
  (cd "${ROOT_DIR}" && RANKING_JOB_MODE=once go run ./cmd/ranking-job/main.go)
  (cd "${ROOT_DIR}" && ANALYZER_JOB_MODE=once go run ./cmd/analyzer-job/main.go)
fi

echo "[migrate] done"
