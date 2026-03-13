#!/usr/bin/env bash

set -euo pipefail

PID_FILE="${PID_FILE:-/tmp/stareplays_replay_analyzer_worker.pid}"

echo "[worker:stop] pid_file: ${PID_FILE}"

if [[ -f "${PID_FILE}" ]]; then
  PID_FROM_FILE="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${PID_FROM_FILE}" ]] && kill -0 "${PID_FROM_FILE}" 2>/dev/null; then
    echo "[worker:stop] stopping pid: ${PID_FROM_FILE}"
    kill "${PID_FROM_FILE}" 2>/dev/null || true
    sleep 1
    if kill -0 "${PID_FROM_FILE}" 2>/dev/null; then
      echo "[worker:stop] force killing pid: ${PID_FROM_FILE}"
      kill -9 "${PID_FROM_FILE}" 2>/dev/null || true
    fi
  fi
fi

rm -f "${PID_FILE}"
echo "[worker:stop] done"

