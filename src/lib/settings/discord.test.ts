import { describe, expect, it } from "vitest";
import { normalizeDiscordClientId, validateSettings } from "./index";

describe("discordClientId setting", () => {
  it("keeps digits only and caps the snowflake length", () => {
    expect(normalizeDiscordClientId(" 1234-5678 ")).toBe("12345678");
    expect(normalizeDiscordClientId("x".repeat(40) + "42")).toBe("42");
  });

  it("sanitizes persisted values and defaults to disabled", () => {
    expect(validateSettings({ discordClientId: "12 34 56" }).discordClientId).toBe(
      "123456",
    );
    expect(validateSettings({}).discordClientId).toBe("");
  });
});
