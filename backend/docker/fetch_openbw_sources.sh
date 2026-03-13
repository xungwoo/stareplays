#!/usr/bin/env sh
set -eu

: "${OPENBW_REPO_URL:?OPENBW_REPO_URL is required}"
: "${OPENBW_BWAPI_REPO_URL:?OPENBW_BWAPI_REPO_URL is required}"
: "${OPENBW_REF:?OPENBW_REF is required}"
: "${OPENBW_BWAPI_REF:?OPENBW_BWAPI_REF is required}"

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
fetch_repo /opt/openbw "${OPENBW_REPO_URL}" "${OPENBW_REF}"
fetch_repo /opt/openbw-bwapi "${OPENBW_BWAPI_REPO_URL}" "${OPENBW_BWAPI_REF}"

test -f /opt/openbw-bwapi/CMakeLists.txt
