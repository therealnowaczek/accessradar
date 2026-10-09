#!/usr/bin/env bash
# Removes the development-only spike/self-test code before a production build and deploy.
# Run in CI only (it edits the working tree).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -f src/spike/probe.ts src/spike/selftest.ts
cp scripts/prod/spike-index.ts src/spike/index.ts
cp scripts/prod/SpikePanel.tsx static/app/src/views/SpikePanel.tsx
if grep -rqE "runProbes|devSelfTest|formatProbeLog" src static/app/src; then
  echo "spike code still referenced after strip" >&2
  exit 1
fi
echo "spike code stripped"
