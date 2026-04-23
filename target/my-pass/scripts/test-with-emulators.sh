#!/usr/bin/env bash
set -euo pipefail

coverage=0
if [[ "${1:-}" == "--coverage" ]]; then
  coverage=1
  shift
fi

export MY_PASS_USE_FIREBASE_EMULATORS=1
export FIREBASE_TEST_PROJECT_ID="${FIREBASE_TEST_PROJECT_ID:-demo-my-pass-test}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-/tmp/firebase-config}"

build_jest_args() {
  local args=""
  local quoted
  for arg in "$@"; do
    printf -v quoted "%q" "$arg"
    args+=" $quoted"
  done
  printf "%s" "$args"
}

jest_args="$(build_jest_args "$@")"
test_command="npm run test:unit --"
if [[ "$coverage" == "1" ]]; then
  test_command+=" --coverage"
fi
test_command+="$jest_args && npm run test:e2e --$jest_args"

npx firebase emulators:exec \
  --only auth,firestore,storage \
  --project "$FIREBASE_TEST_PROJECT_ID" \
  "$test_command"
