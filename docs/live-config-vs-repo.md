# Live config vs. this repo — source of truth

This document explains how the extensions in this repo relate to the extensions
pi actually loads from your machine, and which side is the source of truth.

## TL;DR

- **`~/.pi/agent/extensions` is the source of truth.** It is the live directory pi
  loads extensions from.
- **`extensions/` in this repo is a backup mirror.** It is kept in sync *from* live,
  never the other way around.
- There is **no symlink** between the two — they are separate, independent copies.

## The two directories

| Path | Role |
| --- | --- |
| `~/.pi/agent/extensions` | **Live / source of truth** — what pi actually loads at startup |
| `~/.../pi-config/extensions` | Mirror / backup — versioned in this repo for reference |

## Sync direction: one-way (live → repo)

`sync-extensions.sh` does a one-way rsync from live into the repo:

```bash
LIVE="${PI_EXTENSIONS_LIVE:-$HOME/.pi/agent/extensions}"   # ← source of truth
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/extensions"   # ← mirror
rsync -a \
  --exclude 'node_modules/' \
  --exclude '.git/' \
  --exclude 'auth.json' \
  --exclude 'browser/.profile/' \
  "$LIVE/" "$REPO/"
```

The sync is **non-destructive** on the repo side: it copies/updates files but never
deletes, so extra folders kept in the repo (e.g. `observational-memory/`,
`prompt-snippets/`) are preserved even if they no longer exist in live.

## Auto-sync on commit

The repo ships a `pre-commit` hook (`.git/hooks/pre-commit`) that runs
`sync-extensions.sh` and stages the result, so every commit brings `extensions/`
up to date with live automatically.

## What is and isn't backed up

Deliberately **excluded** from the mirror (secrets / machine-specific state):

- `auth.json` (e.g. `web-search/auth.json` — credentials)
- `browser/.profile/` (browser profile)
- `node_modules/` (reinstall locally)

**Repo-only folders** that exist here but not in live (e.g. `observational-memory/`,
`prompt-snippets/`) are leftovers and are **not loaded** by pi.

## Golden rule

> **Edit files under `~/.pi/agent/extensions`, not under the repo's `extensions/`.**
> Any change you make in the repo copy will be **overwritten** by the next sync/commit.

Workflow:

1. Edit the live file in `~/.pi/agent/extensions/`.
2. Restart pi or run `/reload` to pick it up.
3. Run `./sync-extensions.sh` (or just commit — the pre-commit hook does it for you)
   to back the change up into this repo.
