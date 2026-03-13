#!/usr/bin/env sh
set -eu

: "${OPENBW_REPO_URL:?OPENBW_REPO_URL is required}"
: "${OPENBW_BWAPI_REPO_URL:?OPENBW_BWAPI_REPO_URL is required}"
: "${OPENBW_REF:?OPENBW_REF is required}"
: "${OPENBW_BWAPI_REF:?OPENBW_BWAPI_REF is required}"

normalize_github_url() {
  url="$1"
  token="${2:-}"

  if [ -z "$token" ]; then
    printf '%s' "$url"
    return
  fi

  case "$url" in
    https://github.com/*)
      path="${url#https://github.com/}"
      printf 'https://x-access-token:%s@github.com/%s' "$token" "$path"
      ;;
    *)
      printf '%s' "$url"
      ;;
  esac
}

fetch_repo() {
  dest="$1"
  url="$2"
  ref="$3"

  git init "$dest"
  git -C "$dest" remote add origin "$url"
  git -C "$dest" fetch --depth 1 origin "$ref"
  git -C "$dest" checkout --detach FETCH_HEAD
}

rm -rf /opt/openbw /opt/openbw-bwapi

core_token="${OPENBW_CORE_GIT_TOKEN:-${GITHUB_TOKEN:-}}"
bwapi_token="${OPENBW_BWAPI_GIT_TOKEN:-${GITHUB_TOKEN:-}}"

fetch_repo /opt/openbw "$(normalize_github_url "${OPENBW_REPO_URL}" "${core_token}")" "${OPENBW_REF}"
fetch_repo /opt/openbw-bwapi "$(normalize_github_url "${OPENBW_BWAPI_REPO_URL}" "${bwapi_token}")" "${OPENBW_BWAPI_REF}"

test -f /opt/openbw-bwapi/CMakeLists.txt
