import { describe, expect, it } from "vitest";
import {
  GROOVE_END_DEG,
  GROOVE_START_DEG,
  angleToPosition,
  formatDropTime,
  isOffRecord,
  positionToAngle,
} from "./index";

describe("needle drop geometry", () => {
  it("maps track start and end to the outer and inner grooves", () => {
    expect(positionToAngle(0, 240)).toBe(GROOVE_START_DEG);
    expect(positionToAngle(240, 240)).toBe(GROOVE_END_DEG);
  });

  it("round-trips positions through the arm angle", () => {
    const angle = positionToAngle(150, 247);
    expect(angleToPosition(angle, 247)).toBeCloseTo(150, 6);
  });

  it("clamps out-of-range positions and angles", () => {
    expect(positionToAngle(-5, 100)).toBe(GROOVE_START_DEG);
    expect(positionToAngle(500, 100)).toBe(GROOVE_END_DEG);
    expect(angleToPosition(GROOVE_START_DEG - 3, 100)).toBe(0);
    expect(angleToPosition(GROOVE_END_DEG + 3, 100)).toBe(100);
  });

  it("treats unknown duration as the start groove", () => {
    expect(positionToAngle(30, 0)).toBe(GROOVE_START_DEG);
  });

  it("detects a drop beyond the rim as off-record", () => {
    expect(isOffRecord(GROOVE_START_DEG)).toBe(false);
    expect(isOffRecord(-20)).toBe(true);
  });

  it("formats the drop-time label as m:ss", () => {
    expect(formatDropTime(0)).toBe("0:00");
    expect(formatDropTime(65.9)).toBe("1:05");
    expect(formatDropTime(-3)).toBe("0:00");
  });
});
