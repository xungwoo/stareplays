#!/usr/bin/env bash

set -euo pipefail

MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-9001}"
PID_FILE="${PID_FILE:-/tmp/stareplays_minio.pid}"

echo "[minio:stop] pid_file: ${PID_FILE}"

if [[ -f "${PID_FILE}" ]]; then
  PID_FROM_FILE="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${PID_FROM_FILE}" ]] && kill -0 "${PID_FROM_FILE}" 2>/dev/null; then
    echo "[minio:stop] stopping pid from file: ${PID_FROM_FILE}"
    kill "${PID_FROM_FILE}" 2>/dev/null || true
  fi
fi

for port in "${MINIO_PORT}" "${MINIO_CONSOLE_PORT}"; do
  LISTEN_PIDS="$(lsof -ti tcp:${port} -sTCP:LISTEN || true)"
  if [[ -n "${LISTEN_PIDS}" ]]; then
    echo "[minio:stop] stopping listener pid(s) on :${port}: ${LISTEN_PIDS}"
    for pid in ${LISTEN_PIDS}; do
      kill "${pid}" 2>/dev/null || true
    done
  fi
done

sleep 1
rm -f "${PID_FILE}"
echo "[minio:stop] done"
