# pi-dictate: Setup and Troubleshooting Log

This documents the full journey of installing [pi-dictate](https://github.com/amosblomqvist/pi-dictate) (real-time voice dictation inside pi) on a Linux (Ubuntu) machine and getting it to actually work. The extension itself was fine — **every problem was environment configuration**, and the hardest one was a mute switch.

If you hit "it listens but produces nothing," skip straight to [§4 Root causes](#4-root-causes).

---

## 1. Install

```bash
pi install git:github.com/amosblomqvist/pi-dictate
```

This cloned the repo to `~/.pi/agent/git/github.com/amosblomqvist/pi-dictate` and registered it in `~/.pi/agent/settings.json` under `packages`.

The extension has two platform-specific dependencies on Linux:

| Dependency | Purpose | Linux install |
|---|---|---|
| `rec` (sox) | 16 kHz / 16-bit / mono audio capture | `sudo apt install sox` |
| clipboard tool | fallback when no input is focused | `xclip` (X11) / `wl-copy` (Wayland) |

The upstream `index.ts` used macOS-only `pbcopy` for the clipboard fallback; we patched it to auto-select `wl-copy` / `xclip` / `pbcopy` by platform.

**Usage:** `alt+m` start/stop, `alt+n` cancel. Works inside any focused input (chat, popups, `ask_user_question`, …).

---

## 2. Problem: `DEEPGRAM_API_KEY not set in environment`

The extension reads the key from `process.env.DEEPGRAM_API_KEY` at startup. The error meant the env var simply wasn't visible to the pi process.

Two layers of root cause here:

### 2a. Wrong shell rc file
- We first added the export to `~/.bashrc`.
- But the terminal runs a **login shell**, which sources `~/.bash_profile` / `~/.profile` — **not** `~/.bashrc`.
- Because `~/.bash_profile` exists, it overrides `~/.profile` (which is what normally loads `.bashrc`).
- **Fix:** add `export DEEPGRAM_API_KEY=...` directly to `~/.bash_profile`.

### 2b. Stale tmux shell
- pi was launched **inside a tmux session** (`workspace`).
- The bash shell in that tmux window was started at boot, **before** the env var existed — so even restarting pi re-ran it under the same stale environment.
- Restarting pi alone never helped; the parent shell itself had to re-source.
- **Fix:** in the tmux window, run `source ~/.bash_profile` (or `tmux setenv -g DEEPGRAM_API_KEY ...` for future windows), then relaunch pi.

**Diagnostic tip:** verify the var is visible to the running process:

```bash
echo ${DEEPGRAM_API_KEY:+set}          # should print "set" in the shell
tr '\0' '\n' < /proc/$(pgrep -x pi)/environ | grep DEEPGRAM   # should show it in pi's env
```

---

## 3. Problem: listening works, Deepgram logs the request, but nothing appears (empty transcripts)

The classic symptom: the meter shows recording, the Deepgram console shows the request, but after `alt+m` stop, nothing is inserted into the editor.

Debug logging (`DICTATE_DEBUG=1` → `/tmp/dictate-debug.log`) revealed the real story:

```
ws msg: type=Results is_final=true transcript=""
ws msg: type=Results is_final=true transcript=""
flush: finals=[[]] → EMPTY text, aborting
```

**The transcript was empty.** Delivery code was never the problem — Deepgram received audio but transcribed nothing because the audio contained no speech.

Two sub-causes, in order:

### 3a. Microphone was MUTED (the big one)
- The PipeWire source `alsa_input.pci-0000_04_00.6.analog-stereo` was `Mute: yes`.
- `rec` streamed pure digital silence (all zeros, RMS `0.0000`) to Deepgram.
- Deepgram ran fine, logged the request, but had no speech → empty transcripts.

**Fix:**
```bash
pactl set-source-mute @DEFAULT_SOURCE@ 0
```

### 3b. Volume too high → clipping noise
- After unmuting, we set volume to 100%. The mic has a high base gain, so it **hard-clipped** — constant peak `1.0`, noise floor RMS ~0.9 even with nobody speaking.
- That clipping/feedback noise again confused Deepgram into empty transcripts (intermittent: "worked once, then empty again").

**Fix — back the gain down until it stops clipping** (50% was clean on this machine):
```bash
pactl set-source-volume @DEFAULT_SOURCE@ 50%
```

Measure the noise floor with nobody speaking to confirm it's reasonable (aim for RMS well below clipping, e.g. no `peak=1.0000`):

```bash
cd /tmp && timeout 3 rec -q -r 16000 -c 1 -b 16 -e signed-integer -t raw t.raw 2>/dev/null
python3 -c "
import struct, math
d=open('/tmp/t.raw','rb').read(); n=len(d)//2
s=struct.unpack('<%dh'%n, d[:n*2])
rms=math.sqrt(sum(x*x for x in s)/n)/32768
print(f'rms={rms:.4f} ({20*math.log10(rms+1e-9):.1f} dB) peak={max(abs(x) for x in s)/32768:.4f}')
"
```

---

## 4. Root causes

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | `DEEPGRAM_API_KEY not set` | Key added to `.bashrc` but terminal is a login shell that reads `.bash_profile` | Put the export in `~/.bash_profile` |
| 2 | `DEEPGRAM_API_KEY not set` after restart | pi runs in a tmux shell started before the export existed | `source ~/.bash_profile` in the tmux window, then relaunch pi |
| 3 | Listens + Deepgram logs, but nothing appears | Mic **muted** in PipeWire → pure silence → empty transcripts | `pactl set-source-mute @DEFAULT_SOURCE@ 0` |
| 4 | Intermittent "worked once, then empty" | Mic volume 100% → **clipping noise** → empty transcripts | `pactl set-source-volume @DEFAULT_SOURCE@ 50%` |

**General principle:** "listening works and the Deepgram log exists" only proves audio reached the API — it says nothing about whether the audio contained intelligible speech. When transcripts come back empty, suspect the mic signal (muted, silent, or clipping), not the delivery code.

---

## 5. Persistence caveat

The `pactl` mute/volume settings are **not persistent** across reboots/suspends. If dictation silently stops working later, re-apply:

```bash
pactl set-source-mute @DEFAULT_SOURCE@ 0
pactl set-source-volume @DEFAULT_SOURCE@ 50%
```

This repo's machine also has an autostart entry that does this automatically at every session start:

- `~/.local/bin/fix-mic.sh` — waits for PipeWire, then unmutes and sets 50%
- `~/.config/autostart/fix-mic.desktop` — runs the script on login

---

## 6. Diagnostic tools recap

- **Extension logging:** run pi with `DICTATE_DEBUG=1` to append lifecycle + transcript events to `/tmp/dictate-debug.log`.
- **Check pi's actual env:** `tr '\0' '\n' < /proc/$(pgrep -x pi)/environ | grep -E 'DEEPGRAM|DICTATE'`
- **Check mic mute/volume:** `pactl get-source-mute @DEFAULT_SOURCE@` / `pactl get-source-volume @DEFAULT_SOURCE@`
- **Verify mic captures real audio:** record a clip and inspect RMS (see [§3b](#3b-volume-too-high--clipping-noise)).
