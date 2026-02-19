#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<USAGE
Usage: $(basename "$0") [min-games]

Run ranking and analyzer jobs once and print elapsed durations.
USAGE
  exit 0
fi

min_games="${1:-20}"

echo "[benchmark] ranking job start"
start=$(date +%s)
RANKING_JOB_MODE=once RANKING_MIN_GAMES="$min_games" go run ./cmd/ranking-job >/tmp/ranking-job-bench.log 2>&1 || {
  cat /tmp/ranking-job-bench.log
  exit 1
}
end=$(date +%s)
echo "[benchmark] ranking job elapsed: $((end-start))s"

echo "[benchmark] analyzer job start"
start=$(date +%s)
ANALYZER_JOB_MODE=once go run ./cmd/analyzer-job >/tmp/analyzer-job-bench.log 2>&1 || {
  cat /tmp/analyzer-job-bench.log
  exit 1
}
end=$(date +%s)
echo "[benchmark] analyzer job elapsed: $((end-start))s"
