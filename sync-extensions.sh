#!/usr/bin/env bash
#
# One-way sync of the LIVE pi extensions into this config repo.
# Source of truth: ~/.pi/agent/extensions  (where pi actually loads from)
# Mirror:          ./extensions            (versioned here for backup)
#
# This is non-destructive: it copies/updates from live -> repo but never
# deletes anything, so extra upstream extension folders kept in the repo
# (bash-guard, web-fetch, web-search, ...) are preserved.
#
# Usage:  ./sync-extensions.sh
set -euo pipefail

LIVE="${PI_EXTENSIONS_LIVE:-$HOME/.pi/agent/extensions}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/extensions"

if [[ ! -d "$LIVE" ]]; then
  echo "ERROR: live extensions dir not found: $LIVE" >&2
  exit 1
fi

mkdir -p "$REPO"

rsync -a \
  --exclude 'node_modules/' \
  --exclude 'auth.json' \
  --exclude 'browser/.profile/' \
  "$LIVE/" "$REPO/"

echo "Synced $LIVE -> $REPO"
