import { describe, expect, it } from "vitest";
import { isRepeatMode, nextRepeatMode } from "./controls";

describe("hardware repeat lever cycle", () => {
  it("cycles off -> all -> one -> off", () => {
    expect(nextRepeatMode("off")).toBe("all");
    expect(nextRepeatMode("all")).toBe("one");
    expect(nextRepeatMode("one")).toBe("off");
  });

  it("recognizes only the three backend repeat modes", () => {
    expect(isRepeatMode("off")).toBe(true);
    expect(isRepeatMode("all")).toBe(true);
    expect(isRepeatMode("one")).toBe(true);
    expect(isRepeatMode("sometimes")).toBe(false);
    expect(isRepeatMode(undefined)).toBe(false);
  });
});
