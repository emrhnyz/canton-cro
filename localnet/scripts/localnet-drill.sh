#!/usr/bin/env bash
# LocalNet prerequisite drill: Canton OSS 2-participant ping (not Splice compose).
# Proves two independent participants can see each other — recovery PoC gate.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VER="${CANTON_VERSION:-3.5.8}"
VENDOR="$ROOT/vendor"
NAME="canton-open-source-${VER}"
ARCHIVE="${NAME}.tar.gz"
URL="https://github.com/digital-asset/canton/releases/download/v${VER}/${ARCHIVE}"

mkdir -p "$VENDOR"
if [[ ! -x "$VENDOR/$NAME/bin/canton" ]]; then
  echo "Downloading Canton OSS ${VER}..."
  curl -fsSL -o "$VENDOR/$ARCHIVE" "$URL"
  tar -xzf "$VENDOR/$ARCHIVE" -C "$VENDOR"
fi

export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:--Duser.language=en -Duser.country=US -Dfile.encoding=UTF-8}"
cd "$VENDOR/$NAME"
rm -f log/canton.log
./bin/canton run examples/01-simple-topology/simple-ping.canton \
  -c examples/01-simple-topology/simple-topology.conf \
  --log-level-stdout=WARN

if ! grep -q "Observed archival of ping contract" log/canton.log; then
  echo "localnet-drill FAIL: ping archival not found in canton.log"
  exit 1
fi

mkdir -p "$ROOT/localnet/out"
grep -E "Starting ping|responding to a ping|Observed archival of ping|Shutdown complete" log/canton.log \
  | tee "$ROOT/localnet/out/ci-ping-proof.txt"
echo "localnet-drill OK (2-participant ping)"
