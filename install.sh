#!/usr/bin/env bash
# VinylDeck one-line installer for Linux x64.
#
#   curl -fsSL https://github.com/Shelldock1/vinyldeck/releases/latest/download/install.sh | bash
#
# Installs the AppImage as a normal user (no sudo):
#   ~/.local/bin/vinyldeck
#   ~/.local/share/applications/vinyldeck.desktop
#   ~/.local/share/icons/hicolor/256x256/apps/vinyldeck.png
#
# Environment overrides:
#   VINYLDECK_VERSION=v0.2.0     install a specific release instead of latest
#   VINYLDECK_INSTALL_DIR=...    binary destination (default: ${XDG_BIN_HOME:-~/.local/bin})
#   VINYLDECK_SKIP_DESKTOP=1     do not write the desktop entry or icon
#   VINYLDECK_NO_PATH_UPDATE=1   do not touch ~/.profile
set -euo pipefail

REPO="Shelldock1/vinyldeck"
ARTIFACT="vinyldeck-linux-x64.AppImage"

say() { printf '==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  die "run this as your normal user, not with sudo (it installs into your home directory)."
fi

case "$(uname -s)" in
  Linux) ;;
  *)
    die "this installer is for Linux. Windows users: irm https://github.com/${REPO}/releases/latest/download/install.ps1 | iex"
    ;;
esac

case "$(uname -m)" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64)
    die "there is no ARM64 Linux build yet. Build from source: https://github.com/${REPO}#build-from-source"
    ;;
  *)
    die "unsupported architecture: $(uname -m)"
    ;;
esac

if [[ -n "${VINYLDECK_VERSION:-}" ]]; then
  BASE="https://github.com/${REPO}/releases/download/${VINYLDECK_VERSION}"
else
  BASE="https://github.com/${REPO}/releases/latest/download"
fi
# Optional mirror/offline override (used by tests and air-gapped installs).
BASE="${VINYLDECK_RELEASE_BASE:-$BASE}"

# Resolve ~ and relative paths.
INSTALL_DIR="${VINYLDECK_INSTALL_DIR:-${XDG_BIN_HOME:-$HOME/.local/bin}}"
case "$INSTALL_DIR" in
  "~") INSTALL_DIR="$HOME" ;;
  "~/"*) INSTALL_DIR="$HOME/${INSTALL_DIR#\~/}" ;;
esac
INSTALL_DIR="${INSTALL_DIR%/}"

command -v curl >/dev/null 2>&1 || die "curl is required. Install it and rerun."

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

say "Downloading VinylDeck for Linux ${ARCH}"
curl -fL --retry 3 --retry-delay 2 --connect-timeout 20 \
  -o "$tmp/$ARTIFACT" "$BASE/$ARTIFACT" \
  || die "download failed: $BASE/$ARTIFACT"

if command -v sha256sum >/dev/null 2>&1; then
  if curl -fsSL --retry 2 -o "$tmp/SHA256SUMS.txt" "$BASE/SHA256SUMS.txt" 2>/dev/null; then
    expected="$(grep -E "[ *]${ARTIFACT}$" "$tmp/SHA256SUMS.txt" | awk '{print $1}' | head -n1)"
    if [[ -n "$expected" ]]; then
      actual="$(sha256sum "$tmp/$ARTIFACT" | awk '{print $1}')"
      if [[ "$expected" != "$actual" ]]; then
        die "checksum mismatch for $ARTIFACT (expected $expected, got $actual)"
      fi
      say "Checksum verified"
    fi
  fi
fi

chmod 755 "$tmp/$ARTIFACT"

mkdir -p "$INSTALL_DIR"
# Rename into place so a running copy keeps its inode and never sees a
# half-written binary.
mv -f "$tmp/$ARTIFACT" "$INSTALL_DIR/.vinyldeck.new"
mv -f "$INSTALL_DIR/.vinyldeck.new" "$INSTALL_DIR/vinyldeck"
say "Installed binary: $INSTALL_DIR/vinyldeck"

if [[ "${VINYLDECK_SKIP_DESKTOP:-0}" != "1" ]]; then
  data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
  icon_dir="$data_home/icons/hicolor/256x256/apps"
  apps_dir="$data_home/applications"
  mkdir -p "$icon_dir" "$apps_dir"

  # The icon lives in the repository (the AppImage is a single file). A
  # missing icon is not fatal; launchers fall back to a generic one.
  if curl -fsSL --retry 2 \
    -o "$icon_dir/vinyldeck.png" \
    "https://raw.githubusercontent.com/${REPO}/main/app-screenshots/icon.png" 2>/dev/null; then
    chmod 644 "$icon_dir/vinyldeck.png"
  else
    warn "could not download the icon; the desktop entry will use a fallback"
  fi

  desktop_quote() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    printf '"%s"' "$value"
  }

  desktop_file="$apps_dir/vinyldeck.desktop"
  cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=VinylDeck
Comment=A cinematic vinyl experience for your desktop
Exec=$(desktop_quote "$INSTALL_DIR/vinyldeck")
Icon=vinyldeck
Terminal=false
Categories=AudioVideo;Audio;Player;
StartupWMClass=vinyldeck
EOF
  chmod 644 "$desktop_file"
  say "Desktop entry: $desktop_file"

  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$apps_dir" >/dev/null 2>&1 || true
  fi
  if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t "$data_home/icons/hicolor" >/dev/null 2>&1 || true
  fi
fi

# Put the binary on PATH for future login shells. Never duplicate the block.
if [[ "${VINYLDECK_NO_PATH_UPDATE:-0}" != "1" ]] && [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  profile="$HOME/.profile"
  marker="# Added by the VinylDeck installer"
  if [[ -f "$profile" ]] && grep -qF "$marker" "$profile"; then
    :
  else
    {
      printf '\n%s\n' "$marker"
      printf 'export PATH="%s:$PATH"\n' "$INSTALL_DIR"
    } >> "$profile"
    say "Added $INSTALL_DIR to PATH in $profile (open a new terminal or run: export PATH=\"$INSTALL_DIR:\$PATH\")"
  fi
fi

if ! command -v fusermount3 >/dev/null 2>&1 && ! command -v fusermount >/dev/null 2>&1; then
  warn "FUSE was not found. If the AppImage does not start, install fuse/libfuse2,"
  warn "or run it with APPIMAGE_EXTRACT_AND_RUN=1 vinyldeck."
fi

printf '\nVinylDeck is installed.\n'
printf '  launch:  %s/vinyldeck\n' "$INSTALL_DIR"
printf '  or open "VinylDeck" from your application menu.\n'
printf '  media metadata needs a running player (Spotify, a browser, VLC, ...).\n'
