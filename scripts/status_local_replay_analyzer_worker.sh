#!/usr/bin/env bash

set -euo pipefail

PID_FILE="${PID_FILE:-/tmp/stareplays_replay_analyzer_worker.pid}"
LOG_FILE="${LOG_FILE:-/tmp/stareplays_replay_analyzer_worker.log}"

PID_FROM_FILE=""
RUNNING="no"

if [[ -f "${PID_FILE}" ]]; then
  PID_FROM_FILE="$(cat "${PID_FILE}" 2>/dev/null || true)"
fi

if [[ -n "${PID_FROM_FILE}" ]] && kill -0 "${PID_FROM_FILE}" 2>/dev/null; then
  RUNNING="yes"
fi

echo "[worker:status] pid_file: ${PID_FILE}"
echo "[worker:status] pid_from_file: ${PID_FROM_FILE:-none}"
echo "[worker:status] running: ${RUNNING}"
echo "[worker:status] log_file: ${LOG_FILE}"

if [[ -f "${LOG_FILE}" ]]; then
  echo "[worker:status] log tail:"
  tail -n 20 "${LOG_FILE}" || true
fi

if [[ "${RUNNING}" == "yes" ]]; then
  exit 0
fi
exit 1
