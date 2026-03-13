#!/usr/bin/env bash
set -euo pipefail

mkdir -p /data/mpq \
  "${REPLAY_ANALYZER_WORKER_TMP_DIR:-/tmp/stareplays/replays}" \
  "${REPLAY_ANALYZER_WORKER_OUTPUT_ROOT:-/tmp/stareplays/analysis_jobs}"

missing=0
for file in Patch_rt.mpq BrooDat.mpq StarDat.mpq; do
  if [[ ! -f "/data/mpq/${file}" ]]; then
    echo "[worker] warning: missing /data/mpq/${file}" >&2
    missing=1
  fi
done

if [[ "${missing}" -eq 1 ]]; then
  echo "[worker] OpenBW runtime assets are incomplete. Attach a Railway volume mounted at /data and upload Patch_rt.mpq, BrooDat.mpq, StarDat.mpq before processing live jobs." >&2
fi

exec /app/replay-analyzer-worker
