#!/usr/bin/env node
// Prints the CHANGELOG section for the version in package.json, so a tag
// release reuses the hand-written notes instead of GitHub's generic summary.
//
// Usage: node scripts/changelog-section.mjs > release-notes.md

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
const changelog = await readFile(path.join(repoRoot, "CHANGELOG.md"), "utf8");

const escaped = pkg.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const heading = new RegExp(`^## \\[?v?${escaped}\\]?[^\\n]*$`, "m");
const match = heading.exec(changelog);

if (!match) {
  console.error(`No CHANGELOG section found for version ${pkg.version}.`);
  console.error("Add a '## [" + pkg.version + "]' heading before tagging.");
  process.exit(1);
}

const start = match.index + match[0].length;
const rest = changelog.slice(start);
const next = /^## /m.exec(rest);
const body = (next ? rest.slice(0, next.index) : rest).trim();

process.stdout.write(`# VinylDeck v${pkg.version}\n\n${body}\n`);
