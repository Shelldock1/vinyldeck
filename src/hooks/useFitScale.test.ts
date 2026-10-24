import { describe, expect, it } from "vitest";
import { fitScale } from "./useFitScale";

describe("fitScale", () => {
  it("never enlarges a deck that already fits", () => {
    expect(fitScale({ width: 500, height: 700 }, { width: 1200, height: 900 })).toBe(1);
  });

  it("shrinks by the tighter axis", () => {
    expect(fitScale({ width: 500, height: 728 }, { width: 852, height: 620 })).toBeCloseTo(0.852, 3);
    expect(fitScale({ width: 1000, height: 400 }, { width: 500, height: 900 })).toBe(0.5);
  });

  it("clamps tiny windows and ignores unmeasured nodes", () => {
    expect(fitScale({ width: 500, height: 728 }, { width: 100, height: 100 })).toBe(0.5);
    expect(fitScale({ width: 0, height: 0 }, { width: 100, height: 100 })).toBe(1);
  });
});
