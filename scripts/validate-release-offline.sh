#!/usr/bin/env bash
# Offline validation of the RELEASE code path (the one users get).
#
# GitHub is replaced by two local stand-ins, so no network access is needed:
#   * the working tree is copied into a throw-away git repository and tagged
#     (stand-in for github.com), fetched through the remote `packages:` url
#   * fonts/ is served over plain HTTP (stand-in for raw.githubusercontent.com),
#     fetched through the `type: web` font source
#
# The user YAML is examples/release.yaml with only those two endpoints pointed
# at the stand-ins; every package file, substitution, pin and glyph list stays
# exactly as released.
#
# Usage: scripts/validate-release-offline.sh [tag] [--keep]
#   tag    version to tag the snapshot with (default: value of `ref:` in
#          examples/release.yaml, so the script fails when the pin is stale)
#   --keep keep the temporary directory for inspection
#
# Exit code 0 means: packages fetched at the pinned tag, all five web fonts
# downloaded, config valid, C++ generated with the C++ headers included.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REF="${1:-$(sed -n 's/^[[:space:]]*ref:[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}[[:space:]]*$/\1/p' "$REPO_ROOT/examples/release.yaml" | head -1)}"
KEEP="${2:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/max7219-release-XXXXXX")"
FONT_PORT="${FONT_PORT:-8799}"
ESPHOME="${ESPHOME:-esphome}"

cleanup() {
  [[ -n "${FONT_PID:-}" ]] && kill "$FONT_PID" 2>/dev/null || true
  if [[ "$KEEP" == "--keep" ]]; then
    echo "kept: $WORK"
  else
    rm -rf "$WORK"
  fi
}
trap cleanup EXIT

echo "== release path validation (emulated GitHub + font host) =="
echo "repository : $REPO_ROOT"
echo "release tag: $REF"
echo "working dir: $WORK"

# 1. Snapshot of the working tree as a tagged git repository.
mkdir -p "$WORK/repo" "$WORK/config"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude '.git' --exclude '.esphome' --exclude '.tmp' --exclude '__pycache__' "$REPO_ROOT/" "$WORK/repo/"
else
  tar --exclude='.git' --exclude='.esphome' --exclude='.tmp' --exclude='__pycache__' -C "$REPO_ROOT" -cf - . | tar -C "$WORK/repo" -xf -
fi
git -C "$WORK/repo" init -q .
git -C "$WORK/repo" add -A
git -C "$WORK/repo" -c user.email=validation@example.invalid -c user.name=validation \
  commit -q -m "release snapshot $REF"
git -C "$WORK/repo" tag "$REF"

# 2. Fake secrets (obvious placeholders, valid key length).
python3 - "$WORK/config/secrets.yaml" <<'PY'
import base64, sys, pathlib
pathlib.Path(sys.argv[1]).write_text(
    'wifi_ssid: "ValidationSSID"\n'
    'wifi_password: "ValidationPassword123"\n'
    f'api_encryption_key: "{base64.b64encode(bytes(range(32))).decode()}"\n'
    'fallback_ap_password: "ValidationFallback123"\n'
    'web_server_username: "validation"\n'
    'web_server_password: "ValidationWebPassword123"\n')
PY

# 3. User YAML: the released example, only the two endpoints swapped.
python3 - "$WORK/config" "$REPO_ROOT/examples/release.yaml" "$WORK/repo" "$FONT_PORT" <<'PY'
import pathlib, sys
work_config, example, repo, port = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
example = pathlib.Path(example)
out = pathlib.Path(work_config) / example.name.replace("release", "max7219-clock")
text = example.read_text()
text = text.replace("https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock",
                    f"file://{repo}")
text = text.replace("  project_ref:", f"  fonts_base_url: http://127.0.0.1:{port}\n  project_ref:", 1)
out.write_text(text)
print(f"user YAML: {out}")
PY

# 4. Local font host.
( cd "$REPO_ROOT/fonts" && exec python3 -m http.server "$FONT_PORT" --bind 127.0.0.1 ) \
  > "$WORK/fonthost.log" 2>&1 &
FONT_PID=$!
sleep 1

# 5. Validate + generate C++ exactly like a user would.
cd "$WORK/config"
# ESPHome logs to stderr, the dumped config to stdout: capture both.
set +e
"$ESPHOME" config max7219-clock.yaml > "$WORK/config.log" 2>&1
CONFIG_STATUS=$?
set -e
grep -E "Cloning|Downloading|Configuration is valid" "$WORK/config.log" || true
[[ $CONFIG_STATUS -eq 0 ]] || {
  echo "FAILED: config exit code $CONFIG_STATUS"
  tail -n 80 "$WORK/config.log"
  exit 1
}
grep -q "Configuration is valid" "$WORK/config.log" || { echo "FAILED: config invalid"; exit 1; }

set +e
"$ESPHOME" compile max7219-clock.yaml > "$WORK/compile.log" 2>&1
COMPILE_STATUS=$?
set -e
grep -E "Generating C\+\+ source" "$WORK/compile.log" || { echo "FAILED: no code generation"; exit 1; }

MAIN_CPP=$(find "$WORK/config/.esphome/build" -name main.cpp -print -quit)
SRC_DIR=$(dirname "$MAIN_CPP")
grep -q '#include "max7219_clock_esphome.h"' "$MAIN_CPP" || { echo "FAILED: renderer header not included"; exit 1; }
[[ -f "$SRC_DIR/max7219_clock_esphome.h" && -f "$SRC_DIR/max7219_clock_renderer.h" ]] \
  || { echo "FAILED: package headers not copied into the build"; exit 1; }

FONTS=$(find "$WORK/config/.esphome/font" -name font.ttf 2>/dev/null | wc -l | tr -d ' ')
[[ "$FONTS" -eq 5 ]] || { echo "FAILED: expected exactly 5 web fonts, downloaded $FONTS"; exit 1; }

echo
echo "RESULT: release path OK (tag $REF)"
echo "  packages fetched from  : file://$WORK/repo@$REF"
echo "  web fonts downloaded   : $FONTS"
echo "  generated main.cpp     : $MAIN_CPP ($(wc -l < "$MAIN_CPP") lines)"
echo "  headers copied to src/ : max7219_clock_renderer.h, max7219_clock_esphome.h"
echo "  compile exit code      : $COMPILE_STATUS (non-zero is expected when the"
echo "                           PlatformIO toolchain cannot be installed)"
