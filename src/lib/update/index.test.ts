import { describe, expect, it } from "vitest";
import { normalizeUpdateStatus } from "./index";

const valid = {
  currentVersion: "0.2.0",
  latestVersion: "v0.3.0",
  updateAvailable: true,
  releaseUrl: "https://github.com/Shelldock1/vinyldeck/releases/tag/v0.3.0",
  publishedAt: "2026-11-01T10:00:00Z",
};

describe("normalizeUpdateStatus", () => {
  it("keeps a complete backend payload", () => {
    expect(normalizeUpdateStatus(valid)).toEqual(valid);
  });

  it("accepts a missing publish date", () => {
    expect(normalizeUpdateStatus({ ...valid, publishedAt: null }).publishedAt).toBeNull();
  });

  it("rejects non-object payloads", () => {
    expect(() => normalizeUpdateStatus(null)).toThrow();
    expect(() => normalizeUpdateStatus("latest")).toThrow();
  });

  it("rejects missing versions or availability", () => {
    expect(() => normalizeUpdateStatus({ ...valid, currentVersion: undefined })).toThrow();
    expect(() => normalizeUpdateStatus({ ...valid, updateAvailable: "yes" })).toThrow();
  });

  it("rejects release URLs outside the project", () => {
    expect(() =>
      normalizeUpdateStatus({ ...valid, releaseUrl: "https://example.com/v0.3.0" }),
    ).toThrow();
  });
});
