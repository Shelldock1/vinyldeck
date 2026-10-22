#!/usr/bin/env bash
# Install a release build of VinylDeck for the current user (no sudo).
#
# The panel/desktop launcher should point at a stable binary in ~/.local/bin,
# not at src-tauri/target/release, because that path is replaced on rebuild.
#
# Usage:
#   npm run install:linux
#   SKIP_BUILD=1 npm run install:linux          # reuse an existing release binary
#   VINYLDECK_INSTALL_ROOT=/tmp/test npm run install:linux   # safe sandbox install
#
# Env:
#   SKIP_BUILD=1               skip `npm run tauri build`, reuse existing binary
#   VINYLDECK_INSTALL_ROOT     install prefix (default: $HOME)
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
cd "$repo_root"

root="${VINYLDECK_INSTALL_ROOT:-$HOME}"
case "$root" in
  "~") root="$HOME" ;;
  "~/"*) root="$HOME/${root#\~/}" ;;
esac
root="${root%/}"
root="${root:-/}"

bin_dir="$root/.local/bin"
icon_theme_dir="$root/.local/share/icons/hicolor"
icon_dir="$icon_theme_dir/256x256/apps"
apps_dir="$root/.local/share/applications"
release_binary="$repo_root/src-tauri/target/release/vinyldeck"

if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  echo "SKIP_BUILD=1: reusing existing release binary"
else
  if [[ -f "$repo_root/linux-env.sh" ]]; then
    # Local user-level sysroot for GTK/WebKit headers (gitignored).
    # shellcheck disable=SC1091
    source "$repo_root/linux-env.sh"
  fi
  echo "Building release binary (no bundle)…"
  npm run tauri build -- --no-bundle
fi

if [[ ! -f "$release_binary" ]]; then
  echo "error: release binary not found: $release_binary" >&2
  echo "       run without SKIP_BUILD=1 first." >&2
  exit 1
fi

icon_src=""
for candidate in \
  "$repo_root/src-tauri/icons/128x128@2x.png" \
  "$repo_root/src-tauri/icons/icon.png"; do
  if [[ -f "$candidate" ]]; then
    icon_src="$candidate"
    break
  fi
done
if [[ -z "$icon_src" ]]; then
  echo "error: no source icon found under src-tauri/icons/" >&2
  exit 1
fi

mkdir -p "$bin_dir" "$icon_dir" "$apps_dir"
install -m 755 "$release_binary" "$bin_dir/vinyldeck"
install -m 644 "$icon_src" "$icon_dir/vinyldeck.png"

# Desktop Entry spec: double-quote arguments, escaping backslashes and quotes.
desktop_quote() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

exec_path="$bin_dir/vinyldeck"
desktop_file="$apps_dir/vinyldeck.desktop"
{
  printf '[Desktop Entry]\n'
  printf 'Type=Application\n'
  printf 'Version=1.0\n'
  printf 'Name=VinylDeck\n'
  printf 'Comment=\n'
  printf 'Exec=%s\n' "$(desktop_quote "$exec_path")"
  printf 'Icon=vinyldeck\n'
  printf 'Terminal=false\n'
  printf 'Categories=AudioVideo;Audio;Player;\n'
  printf 'StartupWMClass=vinyldeck\n'
} > "$desktop_file"
chmod 644 "$desktop_file"

# Optional desktop/icon cache refresh; missing tools are not an error.
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$apps_dir" >/dev/null 2>&1 || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q -t "$icon_theme_dir" >/dev/null 2>&1 || true
fi

echo "Installed:"
echo "  binary  $bin_dir/vinyldeck"
echo "  icon    $icon_dir/vinyldeck.png"
echo "  desktop $desktop_file"
