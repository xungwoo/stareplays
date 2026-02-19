#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<USAGE
Usage: $(basename "$0") <base-url> <uploader-name> <replay-file> [concurrency] [requests]

Example:
  $(basename "$0") http://localhost:3000 tester ./sample.rep 4 20
USAGE
  exit 0
fi

base_url="${1:-}"
uploader="${2:-}"
replay_file="${3:-}"
concurrency="${4:-2}"
requests="${5:-10}"

if [[ -z "$base_url" || -z "$uploader" || -z "$replay_file" ]]; then
  echo "missing required arguments" >&2
  exit 1
fi
if [[ ! -f "$replay_file" ]]; then
  echo "replay file not found: $replay_file" >&2
  exit 1
fi

endpoint="${base_url%/}/api/v1/games/upload"

echo "Running load test: endpoint=$endpoint concurrency=$concurrency requests=$requests"

seq "$requests" | xargs -I{} -P "$concurrency" sh -c '
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "'"$endpoint"'" \
    -F "replay_file=@'"$replay_file"'" \
    -F "uploader_name='"$uploader"'")
  echo "$code"
' | sort | uniq -c
