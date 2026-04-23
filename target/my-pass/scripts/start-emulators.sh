#!/usr/bin/env bash
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"

emulator_data="./emulator-data"
firestore_metadata="$emulator_data/firestore_export/firestore_export.overall_export_metadata"

if command -v lsof >/dev/null 2>&1; then
  firestore_pid="$(lsof -tiTCP:8080 -sTCP:LISTEN || true)"
  if [[ -n "$firestore_pid" ]]; then
    echo "Port 8080 is already in use, so the Firestore emulator cannot start."
    echo "Stop the existing process first:"
    echo "  kill $firestore_pid"
    exit 1
  fi
fi

args=(
  emulators:start
  --only auth,firestore,storage
  --export-on-exit="$emulator_data"
)

if [[ -f "$firestore_metadata" ]]; then
  args+=(--import="$emulator_data")
else
  echo "No valid Firestore emulator export found; starting with empty emulator data."
fi

npx firebase "${args[@]}"
