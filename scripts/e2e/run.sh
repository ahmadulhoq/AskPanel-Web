#!/usr/bin/env bash
# End-to-end suite: Firestore + Auth emulators, a fake Anthropic API, the built app,
# and a real Chromium. Needs no real credentials and never calls a paid service.
#
#   npm run e2e                      # build + run everything
#   E2E_SKIP_BUILD=1 npm run e2e     # reuse the previous e2e build (.next-e2e)
#
# Requirements: Java 21+ (Firestore emulator), Playwright with Chromium
# (`npm i --no-save playwright` + `npx playwright install chromium`, or a global install).
# FIREBASE_CLI overrides how the Firebase CLI is invoked (default: npx firebase-tools).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/../.."

FIREBASE_CLI="${FIREBASE_CLI:-npx --yes firebase-tools@15.34.2}"
# `demo-` projects are emulator-only: the CLI never touches a real Firebase project.
exec $FIREBASE_CLI emulators:exec --only firestore,auth --project demo-askpanel "bash $HERE/inner.sh"
