// Artwork URIs from the Rust backend look like `vinyldeck://art/<hash>`.
// Tauri serves that scheme, but each webview wants its own spelling of the
// URL (Windows uses http://<scheme>.localhost), so convert at the edge.

import { convertFileSrc, isTauri } from "@tauri-apps/api/core";

export const ARTWORK_SCHEME_PREFIX = "vinyldeck://art/";

export function resolveArtworkSrc(src: string | null): string | null {
  if (!src || !src.startsWith(ARTWORK_SCHEME_PREFIX)) return src;
  if (!isTauri()) return src;

  return convertFileSrc(src.slice(ARTWORK_SCHEME_PREFIX.length), "vinyldeck");
}
