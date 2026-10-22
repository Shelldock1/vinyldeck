import { describe, expect, it } from "vitest";
import { nextTrapIndex } from "./useFocusTrap";

describe("nextTrapIndex", () => {
  it("moves forward and wraps to the first item", () => {
    expect(nextTrapIndex(3, 0, false)).toBe(1);
    expect(nextTrapIndex(3, 2, false)).toBe(0);
  });

  it("moves backward and wraps to the last item", () => {
    expect(nextTrapIndex(3, 1, true)).toBe(0);
    expect(nextTrapIndex(3, 0, true)).toBe(2);
  });

  it("pulls focus back in from outside the surface", () => {
    expect(nextTrapIndex(3, -1, false)).toBe(0);
    expect(nextTrapIndex(3, -1, true)).toBe(2);
  });

  it("has nowhere to go in an empty surface", () => {
    expect(nextTrapIndex(0, -1, false)).toBe(-1);
  });
});
