# VinylDeck Landing Page

Static Vite + React + TypeScript marketing page for VinylDeck. It is optional: the desktop app and its docs do not depend on it.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

## Deploy

Static-host ready. Netlify can deploy directly from the repository using the root `netlify.toml`:

```txt
Base: landing
Build command: npm run build
Publish directory: dist
```

## Download links

All download URLs live in `src/content/downloads.ts` and point at the stable release asset names:

```txt
vinyldeck-setup-windows-x64.exe
vinyldeck-windows-x64.msi
vinyldeck-linux-x64.AppImage
vinyldeck-linux-x64.deb
```

Keep them version-free so `releases/latest/download/...` always resolves to the newest build. Bump `release.version` when a new tag is published.

## Visual notes

The V5 polish pass fixed desktop hero crowding, hardened responsive layouts at narrow desktop, tablet and phone widths, and made the system-flow strip, shell comparison, mode cards, native panel, download block and footer adapt predictably.

Wording stays safe: VinylDeck works with any app that exposes a Windows SMTC or Linux MPRIS session, not with a fixed list of players.
