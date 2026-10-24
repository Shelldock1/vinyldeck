import { describe, expect, it } from "vitest";
import { emptyWrapped, formatWrappedDay, formatWrappedMonth } from "./wrapped";

describe("Crate Wrapped helpers", () => {
  it("builds an empty current-month card for browser development", () => {
    const stats = emptyWrapped(new Date(2026, 9, 24));
    expect(stats.month).toBe("2026-10");
    expect(stats.totalPlays).toBe(0);
    expect(stats.topRecords).toEqual([]);
    expect(stats.availableMonths).toEqual([]);
    expect(stats.label.length).toBeGreaterThan(0);
  });

  it("formats backend dates and falls back on garbage", () => {
    expect(formatWrappedDay("2026-10-01").length).toBeGreaterThan(0);
    expect(formatWrappedMonth("2026-10").length).toBeGreaterThan(0);
    expect(formatWrappedDay("not-a-date")).toBe("not-a-date");
    expect(formatWrappedMonth("2026-99")).toBe("2026-99");
  });
});
