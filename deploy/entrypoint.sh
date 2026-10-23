#!/usr/bin/env bash
set -euo pipefail
umask 077
node /opt/xiaoyun/deploy/configure.mjs
export VOICE_LIVE_INGEST_TOKEN="$(cat "${DSH_HOME:-/data}/.live-ingest-token")"
exec dsh --profile web --host 127.0.0.1 --port "${DSH_PORT:-13081}" --no-open --trusted-host "$PUBLIC_HOST"
