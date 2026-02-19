#!/usr/bin/env bash
set -euo pipefail

BEFORE_FILE=""
AFTER_FILE=""

usage() {
  cat <<'USAGE'
Usage:
  compare_bench_results.sh --before <csv> --after <csv>

Input CSV format:
  label,endpoint,requests,success,fail,min_ms,p50_ms,p95_ms,p99_ms,avg_ms,max_ms

Behavior:
  - reads the last non-header row from each CSV
  - prints before/after and delta for key latency metrics
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --before)
      BEFORE_FILE="$2"
      shift 2
      ;;
    --after)
      AFTER_FILE="$2"
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

if [[ -z "$BEFORE_FILE" || -z "$AFTER_FILE" ]]; then
  echo "--before and --after are required" >&2
  usage >&2
  exit 1
fi
if [[ ! -f "$BEFORE_FILE" ]]; then
  echo "before file not found: $BEFORE_FILE" >&2
  exit 1
fi
if [[ ! -f "$AFTER_FILE" ]]; then
  echo "after file not found: $AFTER_FILE" >&2
  exit 1
fi

BEFORE_LINE="$(awk 'NR>1{line=$0} END{print line}' "$BEFORE_FILE")"
AFTER_LINE="$(awk 'NR>1{line=$0} END{print line}' "$AFTER_FILE")"

if [[ -z "$BEFORE_LINE" || -z "$AFTER_LINE" ]]; then
  echo "one of the files has no data rows" >&2
  exit 1
fi

IFS=',' read -r b_label b_endpoint b_requests b_success b_fail b_min b_p50 b_p95 b_p99 b_avg b_max <<<"$BEFORE_LINE"
IFS=',' read -r a_label a_endpoint a_requests a_success a_fail a_min a_p50 a_p95 a_p99 a_avg a_max <<<"$AFTER_LINE"

delta_line() {
  local name="$1"
  local before="$2"
  local after="$3"
  awk -v n="$name" -v b="$before" -v a="$after" 'BEGIN{
    d = a - b
    p = (b == 0) ? 0 : (d * 100.0 / b)
    printf "%-8s before=%8.3f  after=%8.3f  delta=%+8.3f  delta%%=%+7.2f%%\n", n, b, a, d, p
  }'
}

echo "endpoint(before): $b_endpoint"
echo "endpoint(after):  $a_endpoint"
echo "requests(before/after): $b_requests / $a_requests"
echo "success(before/after):  $b_success / $a_success"
echo "fail(before/after):     $b_fail / $a_fail"
echo
delta_line "p50_ms" "$b_p50" "$a_p50"
delta_line "p95_ms" "$b_p95" "$a_p95"
delta_line "p99_ms" "$b_p99" "$a_p99"
delta_line "avg_ms" "$b_avg" "$a_avg"
delta_line "max_ms" "$b_max" "$a_max"
