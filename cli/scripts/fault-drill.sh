#!/usr/bin/env bash
# ACS fault-injection drill (broken + partial). Expects deps already installed.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run cro -- init --run ci-fault-broken
npm run cro -- drill --run ci-fault-broken --fault broken-acs-import
npm run cro -- init --run ci-fault-partial
npm run cro -- drill --run ci-fault-partial --fault partial-acs-import
echo "fault-drill OK"
