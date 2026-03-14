#!/usr/bin/env bash

set -euo pipefail

MINIO_HOST="${MINIO_HOST:-127.0.0.1}"
MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-9001}"
LOG_FILE="${LOG_FILE:-/tmp/stareplays_minio.log}"
PID_FILE="${PID_FILE:-/tmp/stareplays_minio.pid}"
HEALTH_URL="http://${MINIO_HOST}:${MINIO_PORT}/minio/health/live"

PID_FROM_FILE=""
if [[ -f "${PID_FILE}" ]]; then
  PID_FROM_FILE="$(cat "${PID_FILE}" 2>/dev/null || true)"
fi

LISTENER_PID="$(lsof -ti tcp:${MINIO_PORT} -sTCP:LISTEN | head -n 1 || true)"
HEALTH_BODY="$(curl -sS "${HEALTH_URL}" 2>/dev/null || true)"

echo "[minio:status] pid_file: ${PID_FILE}"
echo "[minio:status] pid_from_file: ${PID_FROM_FILE:-none}"
echo "[minio:status] listener_pid: ${LISTENER_PID:-none}"
echo "[minio:status] api: http://${MINIO_HOST}:${MINIO_PORT}"
echo "[minio:status] console: http://${MINIO_HOST}:${MINIO_CONSOLE_PORT}"
echo "[minio:status] health: ${HEALTH_BODY:-unreachable}"
echo "[minio:status] log_file: ${LOG_FILE}"

if [[ -f "${LOG_FILE}" ]]; then
  echo "[minio:status] log tail:"
  tail -n 10 "${LOG_FILE}" || true
fi

if [[ -n "${LISTENER_PID}" ]] && [[ -n "${HEALTH_BODY}" ]]; then
  exit 0
fi
exit 1
