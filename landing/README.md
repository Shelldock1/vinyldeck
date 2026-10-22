# VinylDeck Landing Page

Static Vite + React + TypeScript landing page for VinylDeck.

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

This project is static-host ready. Netlify can deploy directly from the repo using:

```txt
Build command: npm run build
Publish directory: dist
```

`netlify.toml` is included.

## Download links

Update installer links in:

```txt
src/content/downloads.ts
```

The current URLs intentionally use `YOUR_USERNAME` placeholders until the GitHub Releases path is finalized.

## V5 polish notes

V5 is the final fit-and-responsive pass over V4:

- fixed the desktop hero horizontal crowding between headline and product mockup
- preserved the V4 navigation sizing and behavior
- hardened responsive layouts at narrow desktop, tablet, and phone widths
- improved hero object staging without letting mockups collide with copy
- made the system-flow strip, shell comparison, mode cards, native panel, download block, and footer adapt more predictably
- kept compatibility wording safe around compatible Windows media sessions
