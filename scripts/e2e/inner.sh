#!/usr/bin/env bash
# Runs inside `firebase emulators:exec` (see run.sh): starts the fake model API, runs the
# runner scenarios, builds and starts the app, then runs the browser checks.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"

export E2E_OUT="${E2E_OUT:-$ROOT/e2e-results}"
export E2E_PORT="${E2E_PORT:-3917}"
export E2E_BASE_URL="http://localhost:$E2E_PORT"
export FAKE_ANTHROPIC_PORT="${FAKE_ANTHROPIC_PORT:-8099}"
# Separate build output: the e2e build bakes in placeholder NEXT_PUBLIC_* values.
export NEXT_DIST_DIR=.next-e2e
mkdir -p "$E2E_OUT"

# Local services must bypass any outbound proxy.
export NO_PROXY="127.0.0.1,localhost${NO_PROXY:+,$NO_PROXY}"
export no_proxy="$NO_PROXY"

# Emulators (emulators:exec sets these too; ports come from firebase.json).
export FIRESTORE_EMULATOR_HOST="${FIRESTORE_EMULATOR_HOST:-127.0.0.1:8085}"
export FIREBASE_AUTH_EMULATOR_HOST="${FIREBASE_AUTH_EMULATOR_HOST:-127.0.0.1:9099}"

# Placeholder app config. The Admin SDK requires a service-account key even against the
# emulators, so generate a throwaway one per run; it is never valid anywhere.
export NEXT_PUBLIC_FIREBASE_API_KEY=e2e-placeholder
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-askpanel
export NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:0000000000000000
export NEXT_PUBLIC_APP_URL="$E2E_BASE_URL"
export FIREBASE_ADMIN_CLIENT_EMAIL=e2e@demo-askpanel.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="$(node -e "const { generateKeyPairSync } = require('node:crypto'); process.stdout.write(generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }))")"
export FIREBASE_ADMIN_PRIVATE_KEY
export ANTHROPIC_BASE_URL="http://127.0.0.1:$FAKE_ANTHROPIC_PORT"
export ANTHROPIC_API_KEY=e2e-placeholder

# Let `require('playwright')` fall back to a global install.
NODE_PATH="$(npm root -g)${NODE_PATH:+:$NODE_PATH}"
export NODE_PATH

PGIDS=()
cleanup() {
  for pgid in "${PGIDS[@]}"; do kill -- "-$pgid" 2>/dev/null || true; done
}
trap cleanup EXIT

# Each background service gets its own process group, so cleanup also stops the
# `next-server` process that `next start` re-executes into.
start() { local log="$1"; shift; setsid "$@" >"$log" 2>&1 & PGIDS+=("$!"); }

wait_for() {
  local url="$1" name="$2"
  for _ in $(seq 1 120); do
    if curl -s -o /dev/null --max-time 2 "$url"; then return 0; fi
    sleep 0.5
  done
  echo "$name did not start; log:" >&2
  cat "$3" >&2 || true
  return 1
}

start "$E2E_OUT/fake-anthropic.log" node "$HERE/fake-anthropic.mjs"
wait_for "http://127.0.0.1:$FAKE_ANTHROPIC_PORT/__stats" "fake Anthropic API" "$E2E_OUT/fake-anthropic.log"

echo "── Runner scenarios"
node --import "$HERE/register.mjs" "$HERE/scenarios.mjs"

if [[ "${E2E_SKIP_BUILD:-}" != "1" ]]; then
  echo "── Building the app"
  node node_modules/next/dist/bin/next build >"$E2E_OUT/next-build.log" 2>&1 || { tail -40 "$E2E_OUT/next-build.log"; exit 1; }
fi

echo "── Browser checks"
start "$E2E_OUT/next.log" node node_modules/next/dist/bin/next start -p "$E2E_PORT"
wait_for "$E2E_BASE_URL/login" "next start" "$E2E_OUT/next.log"
node "$HERE/browser.mjs"
