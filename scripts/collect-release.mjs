#!/usr/bin/env node
// Collects the Tauri bundle output into release/ with stable, version-free
// file names so that releases/latest/download/<file> keeps working:
//
//   vinyldeck-setup-windows-x64.exe   (NSIS, Windows)
//   vinyldeck-windows-x64.msi         (MSI, Windows)
//   vinyldeck-linux-x64.AppImage      (AppImage, Linux)
//   vinyldeck-linux-x64.deb           (Debian package, Linux)
//
// Runs on both operating systems, so CI and local builds use one code path.
//
// Usage:
//   node scripts/collect-release.mjs [windows|linux]

import { copyFile, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const platform =
  process.argv[2] ?? (process.platform === "win32" ? "windows" : "linux");

if (!["windows", "linux"].includes(platform)) {
  console.error(`Unknown platform "${platform}". Use "windows" or "linux".`);
  process.exit(1);
}

const bundleRoot = path.join(repoRoot, "src-tauri", "target", "release", "bundle");
const outDir = path.join(repoRoot, "release");

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

const definitions =
  platform === "windows"
    ? [
        { bundle: "nsis", extension: ".exe", output: "vinyldeck-setup-windows-x64.exe", required: true },
        { bundle: "msi", extension: ".msi", output: "vinyldeck-windows-x64.msi", required: false },
      ]
    : [
        { bundle: "appimage", extension: ".AppImage", output: "vinyldeck-linux-x64.AppImage", required: true },
        { bundle: "deb", extension: ".deb", output: "vinyldeck-linux-x64.deb", required: false },
      ];

if (!(await exists(bundleRoot))) {
  console.error(`No bundle output at ${bundleRoot}. Run "npm run tauri build" first.`);
  process.exit(1);
}

const bundled = await listFiles(bundleRoot);
const collected = [];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const definition of definitions) {
  const needle = `${path.sep}${definition.bundle}${path.sep}`;
  const match = bundled
    .filter((file) => file.includes(needle) && file.endsWith(definition.extension))
    .sort()[0];

  if (!match) {
    if (definition.required) {
      console.error(
        `Missing required ${definition.bundle} bundle (${definition.extension}) under ${bundleRoot}.`,
      );
      process.exit(1);
    }
    console.warn(`Skipping optional ${definition.bundle} bundle: not found.`);
    continue;
  }

  const base = path.basename(match);
  if (platform === "windows" && !/x64|x86_64/i.test(base)) {
    console.error(`Refusing to name a non-x64 Windows artifact as x64: ${base}`);
    process.exit(1);
  }
  if (platform === "linux" && !/amd64|x86_64/i.test(base)) {
    console.error(`Refusing to name a non-x64 Linux artifact as x64: ${base}`);
    process.exit(1);
  }

  await copyFile(match, path.join(outDir, definition.output));
  collected.push(definition.output);
  console.log(`${base} -> release/${definition.output}`);
}

// The one-line install scripts travel with the release so
// releases/latest/download/install.sh and install.ps1 stay in sync with the
// artifacts they install.
for (const script of ["install.sh", "install.ps1"]) {
  const source = path.join(repoRoot, script);
  if (await exists(source)) {
    await copyFile(source, path.join(outDir, script));
    collected.push(script);
    console.log(`${script} -> release/${script}`);
  }
}

const version = JSON.parse(
  await readFile(path.join(repoRoot, "package.json"), "utf8"),
).version;

console.log(`\nCollected ${collected.length} files for v${version} (${platform}).`);
console.log(collected.map((file) => `  release/${file}`).join("\n"));
