# YouTube Client (TV Interface)

## Native ad-blocking fork

This fork adds Ghostery's Electron blocker (network filtering, cosmetic filters,
and scriptlets). Filters refresh before navigation on every launch; bundled
filters are used if downloading fails. Actual YouTube ad-blocking effectiveness
is left to manual testing and is not guaranteed for every ad format.

Development/build tools run in the Steam Deck's `dev` distrobox. The installed
app runs natively, with no runtime container or Node/npm dependency on the host.

- Build inside `dev`: `npm ci`, `node node_modules/electron/install.js`, then `npm run build:linux`.
- Install on the host: `sh scripts/install-linux.sh`.
- Launch: `~/.local/bin/youtube-tv`, or **YouTube TV (Adblock)** in the app menu.
- Native app: `~/Applications/youtube-tv-client/`.
- Profile/sign-in data: `~/.config/youtube-tv-client/`.
- For Gaming Mode, add `~/.local/bin/youtube-tv` as a non-Steam game (no Proton).
- Sign in manually inside the app if YouTube requires it. Never send credentials.

The launcher disables only the setuid sandbox helper; renderer sandboxing stays
on using unprivileged user namespaces. No root-owned helper or `--no-sandbox`
is required on the Steam Deck. The launcher also clears `LD_PRELOAD` for this app
only: Steam's overlay injection prevents Electron's GPU subprocess from starting.
GPU acceleration and renderer sandboxing remain enabled.

## Development-only blocking diagnostics

Logging is off by default. To enable locally, create the empty file
`~/.config/youtube-tv-client/adblock-debug.enabled`, then restart the app.
Alternatively launch with `--adblock-debug`. Remove the marker and any flag,
then restart, to disable. Enabling this changes no filtering rules.

Counts are written to `~/.config/youtube-tv-client/adblock-debug.jsonl` and the
app's console. Records contain only a timestamp, random session ID, event name,
and cumulative counts: `blockedRequests` and `redirectedRequests` are Ghostery's
network decisions; `clientCancelledRequests` observes Chromium's actual
`net::ERR_BLOCKED_BY_CLIENT` errors. These can include trackers, not just ads.
No URLs, domains, video IDs, filter text or request headers are recorded.

The first activity is recorded immediately; later changes are batched every
10 seconds and once at normal exit. The private log rotates at 256 KiB with one
backup. Counts restart each session; they do not measure cosmetic/scriptlet
ad removal or prove every video-ad format is blocked. A zero counter is not
proof those other mechanisms failed. Logging failures do not stop filtering.
Run `npm run test:logging` inside the development container for the logger-only
unit checks; their synthetic fixtures are not evidence of real blocked ads.

## Upstream instructions

A simple electron app that gives access to the YouTube TV interface similar to the AndroidTV App. 

## Installation 
### Windows + Linux
* Download the Executable or AppImage from releases
* Run downloaded file
### Steam Deck (Gaming Mode)
* Enter Desktop Mode
* Download AppImage from releases
* Move file to desired directory
* Right click file
* Click ```properties``` and go to ```permissions``` tab
* Check ```Is Executable``` is ticked and click ```OK```
* Right click again, now select ```Add to Steam```
* Open Steam, find the application
* For this fork, launch `~/.local/bin/youtube-tv`; do not add `--no-sandbox`
* Launch Game Mode
* Go to the YouTube non steam game
* Select Community Control Layout ```YouTube TV Client```
* You can now launch the app and navigate with controller
* (Optional) Add artwork using ```SteamGridDB```

# Build from source
* Clone git repository
* Open the project folder in your IDE
* run ```npm install```
* run ```npm run build```
* Built app can be located at ```./dist/```

## Credit
Icon: https://www.flaticon.com/free-icons/youtube