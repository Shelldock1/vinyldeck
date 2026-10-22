import { describe, expect, it } from "vitest";
import { validateSettings } from "./index";
import { isSchemeId } from "../themes/applier";

describe("scheme setting", () => {
  it("defaults to dark when missing or unknown", () => {
    expect(validateSettings({ theme: "noir" }).scheme).toBe("dark");
    expect(validateSettings({ theme: "noir", scheme: "neon" }).scheme).toBe("dark");
  });

  it("keeps known schemes independent of the shell", () => {
    const settings = validateSettings({ theme: "glass", scheme: "halloween" });
    expect(settings.theme).toBe("glass");
    expect(settings.scheme).toBe("halloween");
  });

  it("recognises only light, dark and halloween", () => {
    expect(["light", "dark", "halloween"].every(isSchemeId)).toBe(true);
    expect(isSchemeId("noir")).toBe(false);
  });
});
