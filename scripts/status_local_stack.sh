#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"${ROOT_DIR}/scripts/status_local_server.sh" || true
"${ROOT_DIR}/scripts/status_local_replay_analyzer_worker.sh" || true
