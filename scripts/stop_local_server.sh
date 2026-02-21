#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
PID_FILE="${PID_FILE:-/tmp/stareplays_server.pid}"

echo "[stop] project: ${ROOT_DIR}"
echo "[stop] port: ${PORT}"
echo "[stop] pid_file: ${PID_FILE}"

if [[ -f "${PID_FILE}" ]]; then
  PID_FROM_FILE="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${PID_FROM_FILE}" ]] && kill -0 "${PID_FROM_FILE}" 2>/dev/null; then
    echo "[stop] stopping pid from file: ${PID_FROM_FILE}"
    kill "${PID_FROM_FILE}" 2>/dev/null || true
  fi
fi

LISTEN_PIDS="$(lsof -ti tcp:${PORT} -sTCP:LISTEN || true)"
if [[ -n "${LISTEN_PIDS}" ]]; then
  echo "[stop] stopping listener pid(s): ${LISTEN_PIDS}"
  for pid in ${LISTEN_PIDS}; do
    kill "${pid}" 2>/dev/null || true
  done
  sleep 1
fi

STILL_UP="$(lsof -ti tcp:${PORT} -sTCP:LISTEN || true)"
if [[ -n "${STILL_UP}" ]]; then
  echo "[stop] force killing remaining pid(s): ${STILL_UP}"
  for pid in ${STILL_UP}; do
    kill -9 "${pid}" 2>/dev/null || true
  done
  sleep 1
fi

rm -f "${PID_FILE}"
echo "[stop] done"
