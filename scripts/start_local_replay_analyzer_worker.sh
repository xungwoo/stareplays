#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${LOG_FILE:-/tmp/stareplays_replay_analyzer_worker.log}"
PID_FILE="${PID_FILE:-/tmp/stareplays_replay_analyzer_worker.pid}"
BIN_PATH="${BIN_PATH:-${ROOT_DIR}/backend/bin/replay-analyzer-worker}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
REPLAY_ANALYZER_BIN="${REPLAY_ANALYZER_BIN:-${ROOT_DIR}/scripts/replay_analyzer_stub.sh}"
REPLAY_ANALYZER_WORKER_TMP_DIR="${REPLAY_ANALYZER_WORKER_TMP_DIR:-/tmp/stareplays/replays}"
REPLAY_ANALYZER_WORKER_OUTPUT_ROOT="${REPLAY_ANALYZER_WORKER_OUTPUT_ROOT:-/tmp/stareplays/analysis_jobs}"

echo "[worker:start] project: ${ROOT_DIR}"
echo "[worker:start] log_file: ${LOG_FILE}"
echo "[worker:start] pid_file: ${PID_FILE}"
echo "[worker:start] bin_path: ${BIN_PATH}"
echo "[worker:start] env_file: ${ENV_FILE}"
echo "[worker:start] analyzer_bin: ${REPLAY_ANALYZER_BIN}"

mkdir -p \
  "$(dirname "${LOG_FILE}")" \
  "$(dirname "${BIN_PATH}")" \
  "${REPLAY_ANALYZER_WORKER_TMP_DIR}" \
  "${REPLAY_ANALYZER_WORKER_OUTPUT_ROOT}"

if [[ -f "${ENV_FILE}" ]]; then
  echo "[worker:start] loading env from ${ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

if [[ -f "${PID_FILE}" ]]; then
  PID_FROM_FILE="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${PID_FROM_FILE}" ]] && kill -0 "${PID_FROM_FILE}" 2>/dev/null; then
    echo "[worker:start] already running (pid=${PID_FROM_FILE})"
    exit 0
  fi
fi

echo "[worker:start] building binary..."
cd "${ROOT_DIR}/backend"
go build -o "${BIN_PATH}" ./cmd/replay-analyzer-worker

echo "[worker:start] launching binary..."
echo "" >> "${LOG_FILE}"
echo "===== worker start $(date '+%Y-%m-%d %H:%M:%S') =====" >> "${LOG_FILE}"
LAUNCH_CMD="cd '${ROOT_DIR}' && exec env REPLAY_ANALYZER_BIN='${REPLAY_ANALYZER_BIN}' REPLAY_ANALYZER_WORKER_TMP_DIR='${REPLAY_ANALYZER_WORKER_TMP_DIR}' REPLAY_ANALYZER_WORKER_OUTPUT_ROOT='${REPLAY_ANALYZER_WORKER_OUTPUT_ROOT}' '${BIN_PATH}' >>'${LOG_FILE}' 2>&1"
nohup /bin/sh -c "${LAUNCH_CMD}" >/dev/null 2>&1 &
WORKER_PID=$!
echo "${WORKER_PID}" > "${PID_FILE}"

for _ in {1..15}; do
  if ! kill -0 "${WORKER_PID}" 2>/dev/null; then
    echo "[worker:start] failed: process exited early (pid=${WORKER_PID})"
    tail -n 120 "${LOG_FILE}" || true
    exit 1
  fi
  if grep -q "worker started:" "${LOG_FILE}" 2>/dev/null; then
    echo "[worker:start] worker started (pid=${WORKER_PID})"
    tail -n 20 "${LOG_FILE}" || true
    exit 0
  fi
  sleep 1
done

echo "[worker:start] worker is running but start marker was not found yet"
tail -n 40 "${LOG_FILE}" || true
exit 0

