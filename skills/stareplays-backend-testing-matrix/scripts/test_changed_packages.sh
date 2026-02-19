#!/usr/bin/env bash
set -euo pipefail

base_ref="${1:-HEAD~1}"

if [[ "${base_ref}" == "-h" || "${base_ref}" == "--help" ]]; then
  cat <<USAGE
Usage: $(basename "$0") [base-ref]

Run go test for packages changed since base-ref (default: HEAD~1).
USAGE
  exit 0
fi

changed_files=$(git diff --name-only "$base_ref"...HEAD -- '*.go' || true)
changed_pkgs=$(printf "%s\n" "$changed_files" \
  | sed '/^$/d' \
  | awk '{
      if ($0 ~ /\//) {
        sub(/\/[^/]+$/, "", $0);
        print "./" $0;
      } else {
        print ".";
      }
    }' \
  | sort -u)

if [[ -z "${changed_pkgs:-}" ]]; then
  echo "No changed Go packages detected; running go test ./..."
  go test ./...
  exit 0
fi

echo "Testing changed packages:"
echo "$changed_pkgs"
# shellcheck disable=SC2086
go test $changed_pkgs
