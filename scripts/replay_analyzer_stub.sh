#!/usr/bin/env bash

set -euo pipefail

OUT_DIR=""
REPLAY_PATH=""
SIMULATOR=""
MODE="${REPLAY_ANALYZER_STUB_MODE:-success}"
DELAY_SEC="${REPLAY_ANALYZER_STUB_DELAY_SEC:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -out)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    -replay)
      REPLAY_PATH="${2:-}"
      shift 2
      ;;
    -simulator)
      SIMULATOR="${2:-}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "${OUT_DIR}" ]]; then
  echo "[stub] missing -out argument" >&2
  exit 2
fi

if ! [[ "${DELAY_SEC}" =~ ^[0-9]+$ ]]; then
  echo "[stub] REPLAY_ANALYZER_STUB_DELAY_SEC must be an integer" >&2
  exit 2
fi

if [[ "${DELAY_SEC}" -gt 0 ]]; then
  sleep "${DELAY_SEC}"
fi

if [[ "${MODE}" == "fail" ]]; then
  echo "[stub] forced failure by REPLAY_ANALYZER_STUB_MODE=fail" >&2
  exit 1
fi

RESULT_DIR="${OUT_DIR}/stub_result"
mkdir -p "${RESULT_DIR}"

REPLAY_BASENAME="$(basename "${REPLAY_PATH:-unknown.rep}")"
GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cat > "${RESULT_DIR}/quality_report.json" <<EOF
{
  "stub": true,
  "generated_at": "${GENERATED_AT}",
  "replay_file": "${REPLAY_BASENAME}",
  "simulator": "${SIMULATOR}",
  "metric_confidence": {
    "kd": 0.987
  },
  "coverage": {
    "destroy_events_with_killer_ratio": 0.913
  }
}
EOF

cat > "${RESULT_DIR}/summary.json" <<EOF
{
  "stub": true,
  "generated_at": "${GENERATED_AT}",
  "players": 6,
  "notes": [
    "local_e2e_stub",
    "queue_bucket_api_ui_smoke"
  ]
}
EOF

cat > "${RESULT_DIR}/analysis_phase.json" <<EOF
{
  "stub": true,
  "generated_at": "${GENERATED_AT}",
  "phases": [
    {
      "name": "opening",
      "status": "ok"
    },
    {
      "name": "midgame",
      "status": "ok"
    },
    {
      "name": "late_game",
      "status": "ok"
    }
  ]
}
EOF

echo "[stub] generated analyzer outputs under ${RESULT_DIR}"

