#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
REPLAY_UPLOAD_DIR="${REPLAY_UPLOAD_DIR:-/tmp/stareps/uploads}"
DISABLE_LOCAL_PARSE="${DISABLE_LOCAL_PARSE:-true}"
LOG_FILE="${LOG_FILE:-/tmp/stareplays_server.log}"
PID_FILE="${PID_FILE:-/tmp/stareplays_server.pid}"
BIN_PATH="${BIN_PATH:-${ROOT_DIR}/backend/bin/server}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
REPLAY_BUCKET_LOCAL_DIR="${REPLAY_BUCKET_LOCAL_DIR:-${ROOT_DIR}/.local/replay-bucket}"

echo "[start] project: ${ROOT_DIR}"
echo "[start] port: ${PORT}"
echo "[start] replay_upload_dir: ${REPLAY_UPLOAD_DIR}"
echo "[start] log_file: ${LOG_FILE}"
echo "[start] bin_path: ${BIN_PATH}"
echo "[start] env_file: ${ENV_FILE}"

mkdir -p "$(dirname "${LOG_FILE}")" "$(dirname "${BIN_PATH}")" "${REPLAY_UPLOAD_DIR}"

if [[ -f "${ENV_FILE}" ]]; then
  echo "[start] loading env from ${ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="${DATABASE_URL//localhost/127.0.0.1}"
fi

REPLAY_BUCKET_NAME="${REPLAY_BUCKET_NAME:-stareplays-local}"
REPLAY_BUCKET_ENDPOINT="${REPLAY_BUCKET_ENDPOINT:-http://127.0.0.1:9000}"
REPLAY_BUCKET_REGION="${REPLAY_BUCKET_REGION:-us-east-1}"
REPLAY_BUCKET_ACCESS_KEY_ID="${REPLAY_BUCKET_ACCESS_KEY_ID:-minioadmin}"
REPLAY_BUCKET_SECRET_ACCESS_KEY="${REPLAY_BUCKET_SECRET_ACCESS_KEY:-minioadmin}"
REPLAY_BUCKET_PATH_STYLE="${REPLAY_BUCKET_PATH_STYLE:-true}"
REPLAY_ANALYZER_VERSION="${REPLAY_ANALYZER_VERSION:-v1}"
DISABLE_RATE_LIMITER="${DISABLE_RATE_LIMITER:-true}"

echo "[start] replay_bucket_name: ${REPLAY_BUCKET_NAME}"
echo "[start] replay_bucket_endpoint: ${REPLAY_BUCKET_ENDPOINT}"
echo "[start] replay_bucket_region: ${REPLAY_BUCKET_REGION}"
echo "[start] replay_bucket_path_style: ${REPLAY_BUCKET_PATH_STYLE}"
echo "[start] replay_bucket_local_dir: ${REPLAY_BUCKET_LOCAL_DIR}"
echo "[start] replay_analyzer_version: ${REPLAY_ANALYZER_VERSION}"
echo "[start] disable_rate_limiter: ${DISABLE_RATE_LIMITER}"

mkdir -p "${REPLAY_BUCKET_LOCAL_DIR}"

LISTENER_PID="$(lsof -ti tcp:${PORT} -sTCP:LISTEN | head -n 1 || true)"
if [[ -n "${LISTENER_PID}" ]]; then
  echo "[start] already listening on :${PORT} (pid=${LISTENER_PID})"
  echo "${LISTENER_PID}" > "${PID_FILE}"
  exit 0
fi

echo "[start] building binary..."
cd "${ROOT_DIR}/backend"
go build -o "${BIN_PATH}" ./cmd/server

echo "[start] launching binary..."
echo "" >> "${LOG_FILE}"
echo "===== start $(date '+%Y-%m-%d %H:%M:%S') =====" >> "${LOG_FILE}"
LAUNCH_CMD="cd '${ROOT_DIR}' && exec env \
PORT='${PORT}' \
DATABASE_URL='${DATABASE_URL:-}' \
REPLAY_UPLOAD_DIR='${REPLAY_UPLOAD_DIR}' \
DISABLE_LOCAL_PARSE='${DISABLE_LOCAL_PARSE}' \
REPLAY_BUCKET_NAME='${REPLAY_BUCKET_NAME}' \
REPLAY_BUCKET_ENDPOINT='${REPLAY_BUCKET_ENDPOINT}' \
REPLAY_BUCKET_REGION='${REPLAY_BUCKET_REGION}' \
REPLAY_BUCKET_ACCESS_KEY_ID='${REPLAY_BUCKET_ACCESS_KEY_ID}' \
REPLAY_BUCKET_SECRET_ACCESS_KEY='${REPLAY_BUCKET_SECRET_ACCESS_KEY}' \
REPLAY_BUCKET_PATH_STYLE='${REPLAY_BUCKET_PATH_STYLE}' \
REPLAY_BUCKET_LOCAL_DIR='${REPLAY_BUCKET_LOCAL_DIR}' \
REPLAY_ANALYZER_VERSION='${REPLAY_ANALYZER_VERSION}' \
DISABLE_RATE_LIMITER='${DISABLE_RATE_LIMITER}' \
'${BIN_PATH}' >>'${LOG_FILE}' 2>&1"
nohup /bin/sh -c "${LAUNCH_CMD}" >/dev/null 2>&1 &
SERVER_PID=$!
echo "${SERVER_PID}" > "${PID_FILE}"

for _ in {1..40}; do
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    echo "[start] failed: process exited early (pid=${SERVER_PID})"
    tail -n 120 "${LOG_FILE}" || true
    exit 1
  fi
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    LISTENER_PID="$(lsof -ti tcp:${PORT} -sTCP:LISTEN | head -n 1 || true)"
    if [[ -n "${LISTENER_PID}" ]]; then
      echo "${LISTENER_PID}" > "${PID_FILE}"
    fi
    echo "[start] server is healthy: http://127.0.0.1:${PORT}"
    echo "[start] server_pid: ${LISTENER_PID:-${SERVER_PID}}"
    tail -n 20 "${LOG_FILE}" || true
    exit 0
  fi
  sleep 1
done

echo "[start] failed: health check timeout"
tail -n 120 "${LOG_FILE}" || true
exit 1
