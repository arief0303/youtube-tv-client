#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source="$root/dist/linux-unpacked"
destination="$HOME/Applications/youtube-tv-client"
test -x "$source/youtube-tv-client" || { printf '%s\n' 'Build first: npm run build:linux'; exit 1; }
mkdir -p "$destination" "$HOME/.local/bin" "$HOME/.local/share/applications"
cp -a "$source/." "$destination/"
install -m755 "$root/scripts/youtube-tv" "$HOME/.local/bin/youtube-tv"
install -Dm644 "$root/img/icon/youtube.png" "$HOME/.local/share/icons/hicolor/512x512/apps/youtube-tv-client.png"
printf '%s\n' '[Desktop Entry]' 'Type=Application' 'Name=YouTube TV (Adblock)' \
    'Comment=Native YouTube TV client with built-in ad blocking' \
    "Exec=\"$HOME/.local/bin/youtube-tv\"" 'Icon=youtube-tv-client' \
    'Terminal=false' 'Categories=AudioVideo;Video;' \
    > "$HOME/.local/share/applications/youtube-tv-client.desktop"
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications"
fi
printf 'Installed native app: %s\nLauncher: %s\n' "$destination" "$HOME/.local/bin/youtube-tv"
