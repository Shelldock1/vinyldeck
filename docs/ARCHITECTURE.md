# VinylDeck Architecture

VinylDeck is split into a platform-neutral React visual engine and a Windows-specific Tauri backend. The central rule is simple: React renders; Rust owns native integration, durable settings, and real system media access.

## System Overview

```mermaid
flowchart TB
  subgraph Windows["Windows Runtime"]
    Player["Spotify / Browser / VLC"]
    SMTC["GlobalSystemMediaTransportControls"]
  end

  subgraph Backend["Tauri Rust Backend"]
    Poller["SMTC poller\n500ms light poll"]
    Cache["Metadata/artwork cache"]
    Commands["cmd_smtc_* commands"]
    Settings["Settings authority"]
    Window["Window/tray lifecycle"]
  end

  subgraph Frontend["React Frontend"]
    Source["PlaybackSource\nMockSource or TauriSource"]
    Store["Zustand cache"]
    Views["MainView / MiniView"]
    Components["Vinyl, controls, settings, shells"]
  end

  Player --> SMTC
  SMTC --> Poller
  Poller --> Cache
  Poller -->|"media-state-changed"| Source
  Commands --> SMTC
  Source --> Store
  Store --> Views
  Views --> Components
  Components -->|"control intent"| Source
  Source --> Commands
  Components -->|"settings intent"| Settings
  Settings -->|"settings-changed"| Store
  Window --> Views
```

## Playback Flow

```mermaid
sequenceDiagram
  participant App as App.tsx
  participant Source as TauriSource
  participant Rust as Rust media commands
  participant Poller as SMTC poller
  participant UI as React views
  participant SMTC as Windows SMTC

  App->>Source: createPlaybackSource().start()
  Source->>Rust: cmd_smtc_snapshot()
  Rust->>SMTC: read current session
  Rust-->>Source: MediaSnapshot or null
  Source-->>UI: PlaybackState
  loop every 500ms
    Poller->>SMTC: read lightweight timeline/capabilities
    Poller->>SMTC: read metadata/artwork on semantic change
    Poller-->>Source: media-state-changed
    Source-->>UI: PlaybackState
  end
  UI->>Source: play/pause/next/previous/seek intent
  Source->>Rust: cmd_smtc_* command
  Rust->>SMTC: request action
```

The poller emits semantic changes immediately and position resyncs periodically. Artwork is cached by source, track, artist, album, and duration so it is not decoded every poll.

## State Ownership

| State | Authority | Frontend role |
| --- | --- | --- |
| Playback in browser dev | `MockSource` | Visual development only |
| Playback in Tauri | Windows SMTC through Rust | Render cache and command intent |
| Persisted settings | Rust settings authority | Optimistic UI plus backend-approved snapshots |
| Runtime QA flags | Zustand | Local only |
| Window mode and lifecycle | Rust window/tray modules | Request mode changes |
| Theme application | CSS custom properties | Apply backend-approved setting |

## Current Visual Surface

The current app exposes two active shells: Noir and Glass. Older Aurora, Vapor, and Paper values remain migration inputs only. Album art still drives the vinyl pressing material and optional Art Ambient glow.

The active vinyl renderer is the CSS/DOM renderer. WebGL vinyl code remains in the repo as a dormant experiment with its feature flag hardcoded off. The center spindle hole is intentionally absent so album artwork remains unobscured.

## Settings Flow

```mermaid
flowchart LR
  UI["Settings UI"] --> Adapter["frontend settings adapter"]
  Adapter --> Invoke["cmd_settings_update/reset"]
  Invoke --> Rust["Rust validation + migration"]
  Rust --> Store["tauri-plugin-store"]
  Rust --> Event["settings-changed"]
  Event --> Zustand["Zustand settings cache"]
  Zustand --> Theme["CSS theme application"]
```

Rust clamps and normalizes settings before persistence. Frontend validation is defensive only; WebViews are views/controllers, not durable storage authorities. Mini Transparency is part of the same Rust-owned settings contract: changing `miniTransparentMode` persists the value and, if Mini is open, immediately applies or clears the native Acrylic window effect.

## Window And Lifecycle Model

```mermaid
stateDiagram-v2
  [*] --> Main
  Main --> Fullscreen: set_window_mode(fullscreen)
  Fullscreen --> Main: set_window_mode(main)
  Main --> Mini: set_window_mode(mini)
  Mini --> Main: set_window_mode(main)
  Main --> HiddenTray: close request
  Mini --> HiddenTray: close request
  HiddenTray --> Main: tray open / left click
  HiddenTray --> [*]: tray quit / Ctrl+Q
```

Main and fullscreen reuse the `main` window. Mini is a separate frameless, transparent-capable, always-on-top WebView window. It starts at `280x280`, can shrink down to a small `140x140` floor, cannot expand beyond the original square, can opt into native Windows Acrylic blur-through through `miniTransparentMode`, and is destroyed when returning to main/fullscreen. Close requests hide to tray; explicit quit destroys windows and exits.

## Implementation Boundaries

- Real in-app playback uses SMTC through `cmd_smtc_*`.
- Browser mode remains mock-only by design.
- Shortcut editing UI and splash screen are not implemented.
- Public installer validation is tracked separately from architecture work.
- Tray playback menu code still uses the older backend media command path and should be unified with SMTC before distribution-grade release validation.
