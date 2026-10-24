import { describe, expect, it } from "vitest";
import { parseAudioReactivity } from "./useAudioReactivity";

describe("parseAudioReactivity", () => {
  it("accepts a full payload and clamps it", () => {
    expect(
      parseAudioReactivity({ level: 0.4, bass: 2, mid: -1, treble: 0.25 }),
    ).toEqual({ level: 0.4, bass: 1, mid: 0, treble: 0.25 });
  });

  it("rejects malformed payloads", () => {
    expect(parseAudioReactivity(null)).toBeNull();
    expect(parseAudioReactivity("loud")).toBeNull();
    expect(parseAudioReactivity({ level: 0.5, bass: 0.2 })).toBeNull();
    expect(
      parseAudioReactivity({ level: 0.5, bass: 0.2, mid: 0.1, treble: NaN }),
    ).toBeNull();
  });
});
