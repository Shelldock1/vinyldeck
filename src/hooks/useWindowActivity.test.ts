import { describe, expect, it } from "vitest";
import { isWindowSuspended } from "./useWindowActivity";

describe("isWindowSuspended", () => {
  it("suspends when the document is hidden", () => {
    expect(isWindowSuspended(true, false)).toBe(true);
  });

  it("suspends when the native window is minimized", () => {
    expect(isWindowSuspended(false, true)).toBe(true);
  });

  it("does not suspend when visible and restored, even if another app has focus", () => {
    expect(isWindowSuspended(false, false)).toBe(false);
  });

  it("stays suspended when both signals agree", () => {
    expect(isWindowSuspended(true, true)).toBe(true);
  });
});
