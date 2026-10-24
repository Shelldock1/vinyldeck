import { describe, expect, it, vi, afterEach } from "vitest";
import { resolveArtworkSrc } from "./artwork";

const HASH = "0123456789abcdef";
const BACKEND_URL = `vinyldeck://art/${HASH}`;
const globals = globalThis as unknown as Record<string, unknown>;

afterEach(() => {
  vi.unstubAllGlobals();
  delete globals.isTauri;
  delete globals.__TAURI_INTERNALS__;
});

describe("resolveArtworkSrc", () => {
  it("leaves data URLs and null untouched", () => {
    expect(resolveArtworkSrc(null)).toBeNull();
    expect(resolveArtworkSrc("data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
  });

  it("keeps the backend URL outside Tauri", () => {
    expect(resolveArtworkSrc(BACKEND_URL)).toBe(BACKEND_URL);
  });

  it("converts the artwork scheme through Tauri", () => {
    vi.stubGlobal("window", globalThis);
    globals.isTauri = true;
    globals.__TAURI_INTERNALS__ = {
      convertFileSrc: (path: string, protocol: string) =>
        `${protocol}://localhost/${path}`,
    };

    expect(resolveArtworkSrc(BACKEND_URL)).toBe(
      `vinyldeck://localhost/${HASH}`,
    );
  });
});
