#!/usr/bin/env bash
set -euo pipefail

export MY_PASS_USE_FIREBASE_EMULATORS=1
export FIREBASE_TEST_PROJECT_ID="${FIREBASE_TEST_PROJECT_ID:-demo-my-pass-test}"

hub_url="${FIREBASE_EMULATOR_HUB:-127.0.0.1:4400}"
if [[ "$hub_url" != http://* && "$hub_url" != https://* ]]; then
  hub_url="http://$hub_url"
fi
if [[ "$hub_url" != */emulators ]]; then
  hub_url="${hub_url%/}/emulators"
fi

if ! emulator_json="$(curl -fsS "$hub_url" 2>/dev/null)"; then
  cat <<'EOF'
Firebase emulators are not running.

Start them in another terminal:
  npm run emulators

Then run:
  npm run test:e2e
EOF
  exit 1
fi

for emulator in auth firestore storage; do
  if ! grep -q "\"$emulator\"" <<<"$emulator_json"; then
    echo "Firebase $emulator emulator is not available. Start auth, firestore, and storage before running e2e tests."
    exit 1
  fi
done

npx jest --config jest.e2e.config.ts --runInBand "$@"
