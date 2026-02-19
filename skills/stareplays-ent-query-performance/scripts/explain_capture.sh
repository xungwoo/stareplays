#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || "$#" -lt 1 ]]; then
  cat <<USAGE
Usage: $(basename "$0") <sql-file> [output-file]

Run EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT) for SQL in <sql-file>.
Requires DATABASE_URL and psql.
USAGE
  exit 0
fi

sql_file="$1"
out_file="${2:-}"

if [[ ! -f "$sql_file" ]]; then
  echo "SQL file not found: $sql_file" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required" >&2
  exit 1
fi

query="EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT) $(cat "$sql_file")"

if [[ -n "$out_file" ]]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$query" | tee "$out_file"
else
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$query"
fi
