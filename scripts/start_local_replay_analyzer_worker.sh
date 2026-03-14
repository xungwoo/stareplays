#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${LOG_FILE:-/tmp/stareplays_replay_analyzer_worker.log}"
PID_FILE="${PID_FILE:-/tmp/stareplays_replay_analyzer_worker.pid}"
BIN_PATH="${BIN_PATH:-${ROOT_DIR}/backend/bin/replay-analyzer-worker}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
REPLAY_ANALYZER_WORKER_TMP_DIR="${REPLAY_ANALYZER_WORKER_TMP_DIR:-/tmp/stareplays/replays}"
REPLAY_ANALYZER_WORKER_OUTPUT_ROOT="${REPLAY_ANALYZER_WORKER_OUTPUT_ROOT:-/tmp/stareplays/analysis_jobs}"
REPLAY_BUCKET_LOCAL_DIR="${REPLAY_BUCKET_LOCAL_DIR:-${ROOT_DIR}/.local/replay-bucket}"
LOCAL_REPLAY_ANALYZER_MODE="${LOCAL_REPLAY_ANALYZER_MODE:-stub}"
REPLAY_ANALYZER_REAL_ROOT="${REPLAY_ANALYZER_REAL_ROOT:-/Users/seongwoo/StarProjects/replay_analyzer}"
OPENBW_BWAPI_ROOT="${OPENBW_BWAPI_ROOT:-/Users/seongwoo/StarProjects/openbw-bwapi}"
REAL_BIN_DIR="${REAL_BIN_DIR:-/tmp/stareplays/replay_analyzer_real_bin}"

build_real_analyzer_binaries() {
  local source_root="$1"
  local out_dir="$2"

  mkdir -p "${out_dir}"
  (
    cd "${source_root}"
    go build -o "${out_dir}/replay_analyzer" ./cmd/replay_analyzer
    go build -o "${out_dir}/openbw_sidecar" ./cmd/openbw_sidecar
    go build -o "${out_dir}/openbw_exporter_openbw" ./cmd/openbw_exporter_openbw
    go build -o "${out_dir}/openbw_bridge_bwapijsonl" ./cmd/openbw_bridge_bwapijsonl
  )
}

configure_analyzer_mode() {
  case "${LOCAL_REPLAY_ANALYZER_MODE}" in
    stub)
      REPLAY_ANALYZER_BIN="${REPLAY_ANALYZER_BIN:-${ROOT_DIR}/scripts/replay_analyzer_stub.sh}"
      ;;
    real)
      if [[ ! -d "${REPLAY_ANALYZER_REAL_ROOT}" ]]; then
        echo "[worker:start] missing REPLAY_ANALYZER_REAL_ROOT: ${REPLAY_ANALYZER_REAL_ROOT}" >&2
        exit 1
      fi
      if [[ ! -d "${OPENBW_BWAPI_ROOT}" ]]; then
        echo "[worker:start] missing OPENBW_BWAPI_ROOT: ${OPENBW_BWAPI_ROOT}" >&2
        exit 1
      fi

      build_real_analyzer_binaries "${REPLAY_ANALYZER_REAL_ROOT}" "${REAL_BIN_DIR}"

      REPLAY_ANALYZER_BIN="${REPLAY_ANALYZER_BIN:-${REAL_BIN_DIR}/replay_analyzer}"
      REPLAY_ANALYZER_SIMULATOR="${REPLAY_ANALYZER_SIMULATOR:-openbw}"
      REPLAY_ANALYZER_PROJECT_ROOT="${REPLAY_ANALYZER_PROJECT_ROOT:-${REPLAY_ANALYZER_REAL_ROOT}}"
      REPLAY_ANALYZER_OPENBW_SIDECAR_BIN="${REPLAY_ANALYZER_OPENBW_SIDECAR_BIN:-${REAL_BIN_DIR}/openbw_sidecar}"
      REPLAY_ANALYZER_OPENBW_EXPORTER_BIN="${REPLAY_ANALYZER_OPENBW_EXPORTER_BIN:-${REAL_BIN_DIR}/openbw_exporter_openbw}"
      REPLAY_ANALYZER_OPENBW_BRIDGE_BIN="${REPLAY_ANALYZER_OPENBW_BRIDGE_BIN:-${REAL_BIN_DIR}/openbw_bridge_bwapijsonl}"
      OPENBW_BWAPI_LAUNCHER_BIN="${OPENBW_BWAPI_LAUNCHER_BIN:-${OPENBW_BWAPI_ROOT}/build/bin/BWAPILauncher}"
      OPENBW_BWAPI_JSONL_MODULE_BIN="${OPENBW_BWAPI_JSONL_MODULE_BIN:-${REPLAY_ANALYZER_REAL_ROOT}/.bin/openbw_bwapi_jsonl_module.dylib}"
      OPENBW_BWAPI_RUN_DIR="${OPENBW_BWAPI_RUN_DIR:-${REPLAY_ANALYZER_REAL_ROOT}/mpq}"
      if [[ -z "${REPLAY_ANALYZER_OPENBW_BRIDGE_ARGS:-}" ]]; then
        REPLAY_ANALYZER_OPENBW_BRIDGE_ARGS="--replay {replay_path} --bwapi-launcher ${OPENBW_BWAPI_LAUNCHER_BIN} --module ${OPENBW_BWAPI_JSONL_MODULE_BIN} --cwd ${OPENBW_BWAPI_RUN_DIR} --timeout-sec 90"
      fi
      DYLD_LIBRARY_PATH="${DYLD_LIBRARY_PATH:-}"
      LD_LIBRARY_PATH="${LD_LIBRARY_PATH:-}"
      if [[ -d "${OPENBW_BWAPI_ROOT}/build/lib" ]]; then
        DYLD_LIBRARY_PATH="${OPENBW_BWAPI_ROOT}/build/lib${DYLD_LIBRARY_PATH:+:${DYLD_LIBRARY_PATH}}"
        LD_LIBRARY_PATH="${OPENBW_BWAPI_ROOT}/build/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
      fi

      if [[ ! -x "${REPLAY_ANALYZER_BIN}" ]]; then
        echo "[worker:start] real analyzer binary missing: ${REPLAY_ANALYZER_BIN}" >&2
        exit 1
      fi
      if [[ ! -x "${REPLAY_ANALYZER_OPENBW_SIDECAR_BIN}" ]]; then
        echo "[worker:start] real sidecar binary missing: ${REPLAY_ANALYZER_OPENBW_SIDECAR_BIN}" >&2
        exit 1
      fi
      if [[ ! -x "${REPLAY_ANALYZER_OPENBW_EXPORTER_BIN}" ]]; then
        echo "[worker:start] real exporter binary missing: ${REPLAY_ANALYZER_OPENBW_EXPORTER_BIN}" >&2
        exit 1
      fi
      if [[ ! -x "${REPLAY_ANALYZER_OPENBW_BRIDGE_BIN}" ]]; then
        echo "[worker:start] real bridge binary missing: ${REPLAY_ANALYZER_OPENBW_BRIDGE_BIN}" >&2
        exit 1
      fi
      if [[ ! -x "${OPENBW_BWAPI_LAUNCHER_BIN}" ]]; then
        echo "[worker:start] BWAPILauncher missing: ${OPENBW_BWAPI_LAUNCHER_BIN}" >&2
        exit 1
      fi
      if [[ ! -f "${OPENBW_BWAPI_JSONL_MODULE_BIN}" ]]; then
        echo "[worker:start] OpenBW module missing: ${OPENBW_BWAPI_JSONL_MODULE_BIN}" >&2
        exit 1
      fi
      for file in Patch_rt.mpq BrooDat.mpq StarDat.mpq; do
        if [[ ! -f "${OPENBW_BWAPI_RUN_DIR}/${file}" ]]; then
          echo "[worker:start] missing MPQ runtime asset: ${OPENBW_BWAPI_RUN_DIR}/${file}" >&2
          exit 1
        fi
      done
      ;;
    *)
      echo "[worker:start] unsupported LOCAL_REPLAY_ANALYZER_MODE=${LOCAL_REPLAY_ANALYZER_MODE} (expected: stub|real)" >&2
      exit 1
      ;;
  esac
}

echo "[worker:start] project: ${ROOT_DIR}"
echo "[worker:start] log_file: ${LOG_FILE}"
echo "[worker:start] pid_file: ${PID_FILE}"
echo "[worker:start] bin_path: ${BIN_PATH}"
echo "[worker:start] env_file: ${ENV_FILE}"
echo "[worker:start] analyzer_mode: ${LOCAL_REPLAY_ANALYZER_MODE}"

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

configure_analyzer_mode

echo "[worker:start] replay_bucket_name: ${REPLAY_BUCKET_NAME}"
echo "[worker:start] replay_bucket_endpoint: ${REPLAY_BUCKET_ENDPOINT}"
echo "[worker:start] replay_bucket_path_style: ${REPLAY_BUCKET_PATH_STYLE}"
echo "[worker:start] replay_bucket_local_dir: ${REPLAY_BUCKET_LOCAL_DIR}"
echo "[worker:start] replay_analyzer_version: ${REPLAY_ANALYZER_VERSION}"
echo "[worker:start] analyzer_bin: ${REPLAY_ANALYZER_BIN}"
if [[ "${LOCAL_REPLAY_ANALYZER_MODE}" == "real" ]]; then
  echo "[worker:start] replay_analyzer_real_root: ${REPLAY_ANALYZER_REAL_ROOT}"
  echo "[worker:start] openbw_bwapi_root: ${OPENBW_BWAPI_ROOT}"
  echo "[worker:start] openbw_bwapi_run_dir: ${OPENBW_BWAPI_RUN_DIR}"
fi

mkdir -p "${REPLAY_BUCKET_LOCAL_DIR}"

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
START_LINE=0
if [[ -f "${LOG_FILE}" ]]; then
  START_LINE="$(wc -l < "${LOG_FILE}" | tr -d ' ')"
fi
echo "" >> "${LOG_FILE}"
echo "===== worker start $(date '+%Y-%m-%d %H:%M:%S') =====" >> "${LOG_FILE}"
nohup env \
REPLAY_ANALYZER_BIN="${REPLAY_ANALYZER_BIN}" \
REPLAY_ANALYZER_WORKER_TMP_DIR="${REPLAY_ANALYZER_WORKER_TMP_DIR}" \
REPLAY_ANALYZER_WORKER_OUTPUT_ROOT="${REPLAY_ANALYZER_WORKER_OUTPUT_ROOT}" \
DATABASE_URL="${DATABASE_URL:-}" \
REPLAY_BUCKET_NAME="${REPLAY_BUCKET_NAME}" \
REPLAY_BUCKET_ENDPOINT="${REPLAY_BUCKET_ENDPOINT}" \
REPLAY_BUCKET_REGION="${REPLAY_BUCKET_REGION}" \
REPLAY_BUCKET_ACCESS_KEY_ID="${REPLAY_BUCKET_ACCESS_KEY_ID}" \
REPLAY_BUCKET_SECRET_ACCESS_KEY="${REPLAY_BUCKET_SECRET_ACCESS_KEY}" \
REPLAY_BUCKET_PATH_STYLE="${REPLAY_BUCKET_PATH_STYLE}" \
REPLAY_BUCKET_LOCAL_DIR="${REPLAY_BUCKET_LOCAL_DIR}" \
REPLAY_ANALYZER_VERSION="${REPLAY_ANALYZER_VERSION}" \
REPLAY_ANALYZER_SIMULATOR="${REPLAY_ANALYZER_SIMULATOR:-}" \
REPLAY_ANALYZER_PROJECT_ROOT="${REPLAY_ANALYZER_PROJECT_ROOT:-}" \
REPLAY_ANALYZER_OPENBW_SIDECAR_BIN="${REPLAY_ANALYZER_OPENBW_SIDECAR_BIN:-}" \
REPLAY_ANALYZER_OPENBW_EXPORTER_BIN="${REPLAY_ANALYZER_OPENBW_EXPORTER_BIN:-}" \
REPLAY_ANALYZER_OPENBW_BRIDGE_BIN="${REPLAY_ANALYZER_OPENBW_BRIDGE_BIN:-}" \
REPLAY_ANALYZER_OPENBW_BRIDGE_ARGS="${REPLAY_ANALYZER_OPENBW_BRIDGE_ARGS:-}" \
OPENBW_BWAPI_LAUNCHER_BIN="${OPENBW_BWAPI_LAUNCHER_BIN:-}" \
OPENBW_BWAPI_JSONL_MODULE_BIN="${OPENBW_BWAPI_JSONL_MODULE_BIN:-}" \
OPENBW_BWAPI_RUN_DIR="${OPENBW_BWAPI_RUN_DIR:-}" \
DYLD_LIBRARY_PATH="${DYLD_LIBRARY_PATH:-}" \
LD_LIBRARY_PATH="${LD_LIBRARY_PATH:-}" \
bash -lc 'cd "$1" && exec "$2"' _ "${ROOT_DIR}" "${BIN_PATH}" >> "${LOG_FILE}" 2>&1 &
WORKER_PID=$!
echo "${WORKER_PID}" > "${PID_FILE}"

for _ in {1..15}; do
  if ! kill -0 "${WORKER_PID}" 2>/dev/null; then
    echo "[worker:start] failed: process exited early (pid=${WORKER_PID})"
    tail -n 120 "${LOG_FILE}" || true
    exit 1
  fi
  if tail -n +"$((START_LINE + 1))" "${LOG_FILE}" 2>/dev/null | grep -q "worker started:"; then
    echo "[worker:start] worker started (pid=${WORKER_PID})"
    tail -n 20 "${LOG_FILE}" || true
    exit 0
  fi
  sleep 1
done

echo "[worker:start] worker is running but start marker was not found yet"
tail -n 40 "${LOG_FILE}" || true
exit 0
