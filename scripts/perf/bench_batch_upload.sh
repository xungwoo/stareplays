#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://127.0.0.1:3000"
REPLAY_FILE=""
UPLOADER_NAMES=""
BATCH_SIZE=4
REQUESTS=40
CONCURRENCY=4
WARMUP=4
LABEL="batch-upload"
SUMMARY_FILE=""

usage() {
  cat <<'USAGE'
Usage:
  bench_batch_upload.sh --replay-file <path> --uploader-names <a,b,c> [options]

Options:
  --base-url <url>        Base URL (default: http://127.0.0.1:3000)
  --replay-file <path>    Replay file path (.rep) used in multipart upload (required)
  --uploader-names <csv>  Comma-separated uploader names (required)
  --batch-size <n>        replay_files count per request (default: 4)
  --requests <n>          Number of measured requests (default: 40)
  --concurrency <n>       Concurrent workers (default: 4)
  --warmup <n>            Warmup requests before measurement (default: 4)
  --label <text>          Label stored in summary row (default: batch-upload)
  --summary-file <path>   Append CSV summary row to file
  -h, --help              Show this help

Notes:
  - uploader names should be participants in the replay to avoid 400/409 saturation.
  - this benchmark targets POST /api/v1/games/upload.

CSV columns:
  label,endpoint,requests,success,fail,min_ms,p50_ms,p95_ms,p99_ms,avg_ms,max_ms
USAGE
}

require_positive_int() {
  local value="$1"
  local name="$2"
  if ! [[ "$value" =~ ^[0-9]+$ ]] || [[ "$value" -le 0 ]]; then
    echo "invalid $name: $value" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --replay-file)
      REPLAY_FILE="$2"
      shift 2
      ;;
    --uploader-names)
      UPLOADER_NAMES="$2"
      shift 2
      ;;
    --batch-size)
      BATCH_SIZE="$2"
      shift 2
      ;;
    --requests)
      REQUESTS="$2"
      shift 2
      ;;
    --concurrency)
      CONCURRENCY="$2"
      shift 2
      ;;
    --warmup)
      WARMUP="$2"
      shift 2
      ;;
    --label)
      LABEL="$2"
      shift 2
      ;;
    --summary-file)
      SUMMARY_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$REPLAY_FILE" ]]; then
  echo "--replay-file is required" >&2
  usage >&2
  exit 1
fi
if [[ ! -f "$REPLAY_FILE" ]]; then
  echo "replay file not found: $REPLAY_FILE" >&2
  exit 1
fi
if [[ -z "$UPLOADER_NAMES" ]]; then
  echo "--uploader-names is required" >&2
  usage >&2
  exit 1
fi

require_positive_int "$BATCH_SIZE" "batch-size"
require_positive_int "$REQUESTS" "requests"
require_positive_int "$CONCURRENCY" "concurrency"
if [[ "$WARMUP" =~ ^[0-9]+$ ]] && [[ "$WARMUP" -lt 0 ]]; then
  echo "invalid warmup: $WARMUP" >&2
  exit 1
fi

for cmd in curl awk sort; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "required command not found: $cmd" >&2
    exit 1
  fi
done

IFS=',' read -r -a UPLOADERS <<< "$UPLOADER_NAMES"
if [[ "${#UPLOADERS[@]}" -eq 0 ]]; then
  echo "no uploader parsed from --uploader-names" >&2
  exit 1
fi

ENDPOINT="${BASE_URL%/}/api/v1/games/upload"
RAW_FILE="$(mktemp)"
SORTED_FILE="$(mktemp)"
trap 'rm -f "$RAW_FILE" "$SORTED_FILE"' EXIT

run_upload_once() {
  local idx="$1"
  local uploader_idx=$(( (idx - 1) % ${#UPLOADERS[@]} ))
  local uploader="${UPLOADERS[$uploader_idx]}"
  local curl_cmd=(curl -sS -o /dev/null -w "%{time_total} %{http_code}" -X POST "$ENDPOINT" -F "uploader_name=$uploader")
  local i
  for ((i = 0; i < BATCH_SIZE; i++)); do
    curl_cmd+=(-F "replay_files=@${REPLAY_FILE}")
  done
  local output
  if output="$("${curl_cmd[@]}" 2>/dev/null)"; then
    printf "%s\n" "$output"
  else
    printf "0.000 000\n"
  fi
}

echo "[batch-upload] endpoint=$ENDPOINT warmup=$WARMUP requests=$REQUESTS concurrency=$CONCURRENCY batch_size=$BATCH_SIZE"

if [[ "$WARMUP" -gt 0 ]]; then
  for i in $(seq 1 "$WARMUP"); do
    run_upload_once "$i" >/dev/null
  done
fi

declare -a PIDS=()
for i in $(seq 1 "$REQUESTS"); do
  run_upload_once "$i" >>"$RAW_FILE" &
  PIDS+=("$!")
  if [[ "${#PIDS[@]}" -ge "$CONCURRENCY" ]]; then
    wait "${PIDS[0]}"
    PIDS=("${PIDS[@]:1}")
  fi
done
for pid in "${PIDS[@]}"; do
  wait "$pid"
done

awk '
  $1 ~ /^[0-9.]+$/ && $2 ~ /^[0-9]+$/ {
    printf "%.3f %s\n", $1 * 1000.0, $2
  }
' "$RAW_FILE" | sort -n >"$SORTED_FILE"

SUMMARY_LINE="$(awk -v label="$LABEL" -v endpoint="$ENDPOINT" '
  function pct_idx(p, n, idx) {
    idx = int(p * n)
    if (idx < p * n) idx++
    if (idx < 1) idx = 1
    if (idx > n) idx = n
    return idx
  }
  {
    vals[NR] = $1
    codes[$2]++
    sum += $1
  }
  END {
    n = NR
    if (n == 0) {
      exit 2
    }
    ok = 0
    for (c in codes) {
      if (c + 0 >= 200 && c + 0 < 300) ok += codes[c]
    }
    fail = n - ok
    min = vals[1]
    max = vals[n]
    avg = sum / n
    p50 = vals[pct_idx(0.50, n)]
    p95 = vals[pct_idx(0.95, n)]
    p99 = vals[pct_idx(0.99, n)]
    printf "%s,%s,%d,%d,%d,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f\n", label, endpoint, n, ok, fail, min, p50, p95, p99, avg, max
  }
' "$SORTED_FILE")"

STATUS_BREAKDOWN="$(awk '
  {
    codes[$2]++
  }
  END {
    for (c in codes) {
      printf "%s %d\n", c, codes[c]
    }
  }
' "$RAW_FILE" | sort -n | awk '{printf "%s=%s ", $1, $2}')"

echo "summary_csv: $SUMMARY_LINE"
echo "status_counts: ${STATUS_BREAKDOWN:-none}"

if [[ -n "$SUMMARY_FILE" ]]; then
  mkdir -p "$(dirname "$SUMMARY_FILE")"
  if [[ ! -f "$SUMMARY_FILE" ]]; then
    echo "label,endpoint,requests,success,fail,min_ms,p50_ms,p95_ms,p99_ms,avg_ms,max_ms" >"$SUMMARY_FILE"
  fi
  echo "$SUMMARY_LINE" >>"$SUMMARY_FILE"
  echo "written: $SUMMARY_FILE"
fi
