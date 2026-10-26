import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SeasonalLayer } from "./index";

function readCss(relativePath: string): string {
  const url = new URL(relativePath, import.meta.url);
  url.search = "";
  url.hash = "";
  return readFileSync(fileURLToPath(url), "utf8");
}

const seasonalCss = readCss("./SeasonalLayer.css");
const schemesCss = readCss("../../styles/schemes.css");

describe("SeasonalLayer", () => {
  it("renders cobwebs, pumpkins, the ghost and the spider in the main window", () => {
    const html = renderToStaticMarkup(<SeasonalLayer />);

    expect(html).toContain("seasonal__web--left");
    expect(html).toContain("seasonal__web--right");
    expect(html).toContain("seasonal__spider");
    expect(html).toContain("seasonal__drop-thread");
    expect(html).toContain("seasonal__ghost");
    expect(html.match(/seasonal__pumpkin--/g)).toHaveLength(3);
    expect(html).not.toContain("seasonal--compact");
  });

  it("keeps the mini player to cobwebs only", () => {
    const html = renderToStaticMarkup(<SeasonalLayer compact />);

    expect(html).toContain("seasonal--compact");
    expect(html).toContain("seasonal__web--left");
    expect(html).toContain("seasonal__web--right");
    expect(html).not.toContain("seasonal__spider");
    expect(html).not.toContain("seasonal__pumpkin");
    expect(html).not.toContain("seasonal__ghost");
  });

  it("lowers the spider on its thread and climbs back up", () => {
    expect(seasonalCss).toMatch(
      /\.seasonal__drop-spider\s*\{[^}]*animation:\s*seasonalSpiderDrop/,
    );
    expect(seasonalCss).toMatch(
      /\.seasonal__drop-thread\s*\{[^}]*animation:\s*seasonalThread/,
    );

    const drop = seasonalCss.slice(seasonalCss.indexOf("@keyframes seasonalSpiderDrop"));
    expect(drop).toContain("translateY(0)");
    expect(drop).toContain("translateY(-92%)");

    const thread = seasonalCss.slice(seasonalCss.indexOf("@keyframes seasonalThread"));
    expect(thread).toContain("scaleY(1)");
    expect(thread).toContain("scaleY(0.08)");
  });

  it("is hidden unless the Halloween scheme is active", () => {
    expect(seasonalCss).toMatch(/display:\s*var\(--seasonal-display,\s*none\)/);
    expect(schemesCss).toMatch(
      /:root\[data-scheme="halloween"\][\s\S]*?--seasonal-display:\s*block/,
    );
    expect(schemesCss.match(/--seasonal-display:\s*block/g)).toHaveLength(1);
  });
});
