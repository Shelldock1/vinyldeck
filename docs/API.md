# Tauri API Reference

This is the command and event contract between the React frontend and the Rust backend. The `cmd_smtc_*` names are kept for compatibility on every platform; on Linux they drive MPRIS, on Windows they drive SMTC.

All payloads use `camelCase` keys. Timestamps are Unix milliseconds. Positions and durations are seconds (floating point).

## Media snapshot

`MediaSnapshot` maps to the frontend `PlaybackState`.

| Field | Type | Notes |
| --- | --- | --- |
| `track` | `string` | Empty when no media or metadata is missing |
| `artist` | `string` | Empty when unavailable |
| `album` | `string` | Empty when unavailable |
| `artworkDataUrl` | `string \| null` | `vinyldeck://art/<hash>` reference, not base64 image data |
| `duration` | `number` | Seconds; may be `0` when unknown |
| `position` | `number` | Seconds |
| `isPlaying` | `boolean` | Current playback state |
| `sourceName` | `string` | Friendly source label |
| `sourceId` | `string` | Stable platform handle: MPRIS bus name or SMTC AUMID |
| `canSeek` | `boolean` | Enables seek UI and shortcuts |
| `canSkip` | `boolean` | Enables previous/next |
| `canControl` | `boolean` | Enables play/pause |
| `canRepeat` | `boolean` | Shows the repeat lever |
| `canShuffle` | `boolean` | Shows the shuffle lever |
| `repeatMode` | `"off" \| "all" \| "one"` | Current repeat state |
| `shuffle` | `boolean` | Current shuffle state |

`MediaPlayer` (player picker):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | Same value as `MediaSnapshot.sourceId` |
| `name` | `string` | Display fallback |
| `isPlaying` | `boolean` | Used to order the list |

## Events

| Event | Payload | Meaning |
| --- | --- | --- |
| `media-state-changed` | `MediaSnapshot` | Track, metadata, artwork hash, play state, repeat/shuffle or capabilities changed, or the clean empty state |
| `media-position-changed` | `{ position: number }` | Periodic position resync (about every 2 s) without metadata; the store merges it onto the last snapshot |
| `settings-changed` | `PersistedSettings` | Backend-approved settings after an update or reset |
| `collection-changed` | `CollectedRecord` | A record was pressed or a counted play landed |
| `sleep-timer-changed` | `SleepTimerSnapshot \| null` | Timer started, replaced or cancelled |
| `sleep-timer-fired` | `{ mode: string }` | Timer elapsed; playback was paused and the tonearm parked |
| `audio-reactivity` | `{ level, bass, mid, treble }` | Smoothed three-band levels at roughly 30 Hz |

Command responses are not the UI source of truth. The frontend sends intent, then accepts poller events as canonical state.

## Media commands

| Command | Args | Return |
| --- | --- | --- |
| `cmd_media_players` | none | `MediaPlayer[]` |
| `cmd_smtc_snapshot` | none | `MediaSnapshot \| null` |
| `cmd_smtc_play` | none | `MediaSnapshot \| null` |
| `cmd_smtc_pause` | none | `MediaSnapshot \| null` |
| `cmd_smtc_toggle_play_pause` | none | `MediaSnapshot \| null` |
| `cmd_smtc_next` | none | `MediaSnapshot \| null` |
| `cmd_smtc_previous` | none | `MediaSnapshot \| null` |
| `cmd_smtc_seek` | `seconds: number` | `MediaSnapshot \| null` |
| `cmd_media_set_repeat` | `mode: "off" \| "all" \| "one"` | `MediaSnapshot \| null` |
| `cmd_media_set_shuffle` | `enabled: boolean` | `MediaSnapshot \| null` |

Transport commands wake the poller immediately. The returned snapshot is a convenience; the next event is authoritative.

## Playback authority

`PlaybackAuthority` is managed Rust state holding the last platform snapshot written by the poller. The tray subscribes to it for its tooltip, Play/Pause/Previous/Next labels and the selected source, and dispatches through the same platform bridge as `cmd_smtc_*`. The legacy mock-backed `cmd_media_*` command set was removed.

## Settings

| Command | Args | Return |
| --- | --- | --- |
| `cmd_settings_snapshot` | none | `PersistedSettings` |
| `cmd_settings_update` | `patch: SettingsPatch` | `PersistedSettings` |
| `cmd_settings_reset` | none | `PersistedSettings` (defaults) |

`SettingsPatch` contains only the fields being changed. Unknown values are clamped or normalized by Rust before persistence.

Persisted fields:

`theme` (`noir \| glass`), `scheme` (`light \| dark \| halloween`), `ambientMode`, `artAmbient` (legacy mirror), `vinylWobble`, `filmGrain`, `leanBackMode`, `cursorHide`, `idleTimeoutSeconds`, `alwaysOnTop`, `keyboardShortcutsEnabled`, `quitToTray`, `startWithWindows`, `windowMode` (`main \| fullscreen \| mini`), `miniTransparentMode`, `playerSourceId`, `playerSourceName`, `discordClientId`, `language` (`auto \| en \| ru`), and the schema `version`.

Notes:

- Changing `startWithWindows` synchronizes the OS autostart registration (registry Run key on Windows, XDG autostart on Linux).
- Changing `miniTransparentMode` applies or clears the effect on a live Mini window.
- `playerSourceId` is empty for Auto. Unknown saved IDs stay in settings so the picker can show "Saved source - not running".
- Legacy `theme` values (`aurora`, `vapor`, `paper`) migrate into the current shell/scheme model.

## Collection (The Crate)

| Command | Args | Return |
| --- | --- | --- |
| `cmd_collection_snapshot` | none | `CollectedRecord[]` |
| `cmd_collection_press` | `{ input: PressInput }` | `{ record, newlyPressed }` |
| `cmd_collection_wrapped` | `{ month?, source?, utcOffsetMinutes? }` | `WrappedStats` |
| `cmd_collection_play_times` | `{ source? }` | `number[]` (Unix ms) |

`PressInput`:

```ts
{
  artist: string;
  album: string;
  recipe: string;
  pressingType: string;
  pressingName: string;
  colors: { primary: string; secondary: string; accent: string };
  thumbnail?: string | null;
  sourceId?: string;
  sourceName?: string;
}
```

- `album` falls back to the track title for singles.
- The record key is `lowercase(artist) + "|" + lowercase(album or track)`.
- Pressing is idempotent: the first press assigns `pressingNumber`, `firstPressedAt` and the pressing recipe; later presses only fill missing fields (for example a late thumbnail).
- `thumbnail` must be a `data:image/` URL of at most 48 KB.
- A play can be counted before the artwork/pressing exists. Such a record has `recipe: null` until the frontend presses it, and `newlyPressed` is still `true`.

`CollectedRecord`:

| Field | Type | Notes |
| --- | --- | --- |
| `key` | `string` | Stable identity |
| `artist`, `album` | `string` | Display metadata |
| `pressingNumber` | `number` | Collection order |
| `firstPressedAt` | `number` | Unix ms |
| `lastPlayedAt` | `number \| null` | Unix ms |
| `playCount` | `number` | Counted listens |
| `recipe`, `pressingType`, `pressingName` | `string \| null` | Visual pressing data |
| `colors` | `{ primary, secondary, accent } \| null` | Extracted palette |
| `thumbnail` | `string \| null` | Small data URL |
| `sourceKind` | `"app" \| "browser" \| null` | Music app vs browser; null for old records with no history |
| `sourceName` | `string \| null` | Last player that fed the record |

Play counting is owned by the media poller: half the track or 120 seconds of playing wall-clock time, whichever comes first; tracks under 30 seconds never count. The play history is bounded to 10,000 events.

`WrappedStats`:

| Field | Type | Notes |
| --- | --- | --- |
| `month` | `string` | `YYYY-MM` in the viewer's local time |
| `label` | `string` | Display label, e.g. `October 2026` |
| `totalPlays` | `number` | Counted listens |
| `uniqueAlbums`, `uniqueArtists`, `uniqueTracks` | `number` | Distinct counts |
| `topRecords` | `WrappedAlbum[]` | Up to five |
| `topTrack`, `topArtist`, `rarest` | object \| null | May be empty |
| `busiestDay` | `{ date, plays } \| null` | `YYYY-MM-DD`, local time |
| `availableMonths` | `string[]` | Months with listens, newest first, max 24 |

`cmd_collection_play_times` returns every counted listen's timestamp for the selected source bucket, used for the local-calendar streak.

## Window and lifecycle

| Command | Args | Meaning |
| --- | --- | --- |
| `cmd_set_window_mode` | `mode: "main" \| "fullscreen" \| "mini"` | Switch render/window mode |
| `cmd_set_always_on_top` | `enabled: boolean` | Apply native always-on-top |
| `cmd_quit` | none | Explicit process quit |

Close-button behavior is handled by Rust window events and hides app windows to the tray when `quitToTray` is on. When it is off, closing requests an explicit quit. Mini creates a separate transparent-capable, frameless, always-on-top WebView capped at 280x280 with a 140x140 floor; entering main/fullscreen destroys it.

## Sleep timer

| Command | Args | Return |
| --- | --- | --- |
| `cmd_sleep_timer_start` | `{ mode: "minutes" \| "endOfTrack", minutes?: number }` | `SleepTimerSnapshot` |
| `cmd_sleep_timer_cancel` | none | `null` |
| `cmd_sleep_timer_snapshot` | none | `SleepTimerSnapshot \| null` |

`SleepTimerSnapshot` is `{ mode, endsAt: number \| null, track: string \| null }`. Minute timers accept 5-240 minutes; the UI offers 15/30/45/60. Timers are intentionally not persisted across launches.

## Updates

| Command | Args | Return |
| --- | --- | --- |
| `cmd_update_check` | none | `UpdateStatus` |
| `cmd_open_release` | `{ url: string }` | `null` |

`UpdateStatus` is `{ currentVersion, latestVersion, updateAvailable, releaseUrl, publishedAt }`. The check reads `https://api.github.com/repos/Shelldock1/vinyldeck/releases/latest` in Rust with a 10-second timeout and a 256 KiB response cap, then compares the numeric version cores. `cmd_open_release` accepts only URLs under `https://github.com/Shelldock1/vinyldeck/releases` and hands them to the system browser. Nothing is downloaded or installed by either command.

## Artwork scheme

Covers are stored in a bounded in-process cache and served at `vinyldeck://art/<hash>`. The frontend converts that to the platform URL (`http://vinyldeck.localhost/...` on Windows) at the edge. The scheme handler returns `Content-Type`, a one-year immutable cache header and a 404 for unknown hashes.

## Overlay HTTP API

The overlay is a separate loopback HTTP server, not a Tauri command surface:

| Path | Response |
| --- | --- |
| `/overlay` | Transparent HTML browser source |
| `/state` | Current playback snapshot as JSON |
| `/artwork` | Cached cover bytes |

Only `Host: 127.0.0.1:43110` and `Host: localhost:43110` are accepted. Requests are capped at 8 KiB.

## Capabilities

Permissions are declared in `src-tauri/capabilities/default.json`. Adding a plugin command requires the matching capability entry; bundled builds enforce the CSP described in [DEVELOPMENT.md](./DEVELOPMENT.md#content-security-policy).
