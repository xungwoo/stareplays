#!/usr/bin/env bash

set -euo pipefail

PORT="${PORT:-3000}"
PID_FILE="${PID_FILE:-/tmp/stareplays_server.pid}"
HEALTH_URL="http://127.0.0.1:${PORT}/health"

PID_FROM_FILE=""
if [[ -f "${PID_FILE}" ]]; then
  PID_FROM_FILE="$(cat "${PID_FILE}" 2>/dev/null || true)"
fi

LISTENER_PID="$(lsof -ti tcp:${PORT} -sTCP:LISTEN | head -n 1 || true)"
HEALTH_BODY="$(curl -sS "${HEALTH_URL}" 2>/dev/null || true)"

echo "[status] port: ${PORT}"
echo "[status] pid_file: ${PID_FILE}"
echo "[status] pid_from_file: ${PID_FROM_FILE:-none}"
echo "[status] listener_pid: ${LISTENER_PID:-none}"
echo "[status] health: ${HEALTH_BODY:-unreachable}"

if [[ -n "${LISTENER_PID}" ]] && [[ -n "${HEALTH_BODY}" ]]; then
  exit 0
fi
exit 1
