#!/usr/bin/env bash
set -euo pipefail

server_file="backend/cmd/server/main.go"
docs=("README.md" "API_USAGE.md")

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<USAGE
Usage: $(basename "$0")

Print routes found in backend/cmd/server/main.go and missing mentions in key docs.
USAGE
  exit 0
fi

if [[ ! -f "$server_file" ]]; then
  echo "missing $server_file" >&2
  exit 1
fi

routes=$(rg 'api\.(Get|Post|Put|Delete)\("[^"]+"' "$server_file" -o \
  | sed -E 's/.*\("([^"]+)"/\1/' \
  | sort -u)

echo "[routes]"
echo "$routes"
echo

for doc in "${docs[@]}"; do
  if [[ ! -f "$doc" ]]; then
    continue
  fi
  echo "[check] $doc"
  while IFS= read -r route; do
    if [[ -z "$route" ]]; then
      continue
    fi
    if ! rg -F "$route" "$doc" >/dev/null 2>&1; then
      echo "  missing: $route"
    fi
  done <<< "$routes"
  echo
 done
