#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || "$#" -lt 1 ]]; then
  cat <<USAGE
Usage: $(basename "$0") <feature-name>

Print a backend endpoint scaffold plan for this repository.
Example:
  $(basename "$0") replay-upload
USAGE
  exit 0
fi

feature="$1"
slug="$(echo "$feature" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed -E 's/^-+//; s/-+$//')"
if [[ -z "$slug" ]]; then
  slug="feature"
fi

cat <<PLAN
[Scaffold Plan] $slug
- handler file: internal/api/handlers/${slug}_handler.go
- service file: internal/services/${slug}/service.go
- repository file: internal/repositories/${slug}_repository.go
- tests:
  - internal/api/handlers/${slug}_handler_test.go
  - internal/services/${slug}/service_test.go
  - internal/repositories/${slug}_repository_test.go
PLAN
