#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MINIO_BIN="${MINIO_BIN:-/opt/homebrew/bin/minio}"
MC_BIN="${MC_BIN:-/opt/homebrew/bin/mc}"
MINIO_HOST="${MINIO_HOST:-127.0.0.1}"
MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-9001}"
MINIO_DATA_DIR="${MINIO_DATA_DIR:-${ROOT_DIR}/.local/minio-data}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
REPLAY_BUCKET_NAME="${REPLAY_BUCKET_NAME:-stareplays-local}"
LOG_FILE="${LOG_FILE:-/tmp/stareplays_minio.log}"
PID_FILE="${PID_FILE:-/tmp/stareplays_minio.pid}"

echo "[minio:start] project: ${ROOT_DIR}"
echo "[minio:start] minio_bin: ${MINIO_BIN}"
echo "[minio:start] mc_bin: ${MC_BIN}"
echo "[minio:start] endpoint: http://${MINIO_HOST}:${MINIO_PORT}"
echo "[minio:start] console: http://${MINIO_HOST}:${MINIO_CONSOLE_PORT}"
echo "[minio:start] data_dir: ${MINIO_DATA_DIR}"
echo "[minio:start] bucket: ${REPLAY_BUCKET_NAME}"
echo "[minio:start] log_file: ${LOG_FILE}"

if [[ ! -x "${MINIO_BIN}" ]]; then
  echo "[minio:start] error: minio binary not found at ${MINIO_BIN}"
  echo "[minio:start] install with: brew install minio/stable/minio minio/stable/mc"
  exit 1
fi
if [[ ! -x "${MC_BIN}" ]]; then
  echo "[minio:start] error: mc binary not found at ${MC_BIN}"
  echo "[minio:start] install with: brew install minio/stable/minio minio/stable/mc"
  exit 1
fi

mkdir -p "${MINIO_DATA_DIR}" "$(dirname "${LOG_FILE}")"

LISTENER_PID="$(lsof -ti tcp:${MINIO_PORT} -sTCP:LISTEN | head -n 1 || true)"
if [[ -n "${LISTENER_PID}" ]]; then
  echo "[minio:start] already listening on :${MINIO_PORT} (pid=${LISTENER_PID})"
  echo "${LISTENER_PID}" > "${PID_FILE}"
else
  echo "" >> "${LOG_FILE}"
  echo "===== minio start $(date '+%Y-%m-%d %H:%M:%S') =====" >> "${LOG_FILE}"
  LAUNCH_CMD="cd '${ROOT_DIR}' && exec env MINIO_ROOT_USER='${MINIO_ROOT_USER}' MINIO_ROOT_PASSWORD='${MINIO_ROOT_PASSWORD}' '${MINIO_BIN}' server '${MINIO_DATA_DIR}' --address '${MINIO_HOST}:${MINIO_PORT}' --console-address '${MINIO_HOST}:${MINIO_CONSOLE_PORT}' >>'${LOG_FILE}' 2>&1"
  nohup /bin/sh -c "${LAUNCH_CMD}" >/dev/null 2>&1 &
  MINIO_PID=$!
  echo "${MINIO_PID}" > "${PID_FILE}"

  for _ in {1..30}; do
    if ! kill -0 "${MINIO_PID}" 2>/dev/null; then
      echo "[minio:start] failed: process exited early (pid=${MINIO_PID})"
      tail -n 80 "${LOG_FILE}" || true
      exit 1
    fi
    if curl -fsS "http://${MINIO_HOST}:${MINIO_PORT}/minio/health/live" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

"${MC_BIN}" alias set local "http://${MINIO_HOST}:${MINIO_PORT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null
"${MC_BIN}" mb --ignore-existing "local/${REPLAY_BUCKET_NAME}" >/dev/null

echo "[minio:start] ready: http://${MINIO_HOST}:${MINIO_PORT}"
echo "[minio:start] bucket ensured: ${REPLAY_BUCKET_NAME}"
tail -n 10 "${LOG_FILE}" || true
