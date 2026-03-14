#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"${ROOT_DIR}/scripts/start_local_server.sh"
"${ROOT_DIR}/scripts/start_local_replay_analyzer_worker.sh"
