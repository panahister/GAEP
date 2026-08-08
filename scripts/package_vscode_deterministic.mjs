#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vsixPath = path.join(root, "apps/vscode/dist/gaep-vscode.vsix");
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gaep-vsix-normalize-"));
const extractedDirectory = path.join(temporaryDirectory, "extracted");
const normalizedPath = path.join(temporaryDirectory, "gaep-vscode.vsix");
const fixedTime = new Date("2000-01-01T00:00:00.000Z");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  }
  if (options.stdio !== "inherit") process.stdout.write(result.stdout ?? "");
  return result;
}

function entries(directory, relative = "") {
  const current = path.join(directory, relative);
  return fs.readdirSync(current, { withFileTypes: true }).flatMap(entry => {
    const child = path.join(relative, entry.name);
    return entry.isDirectory() ? entries(directory, child) : [child];
  });
}

try {
  run("npm", ["run", "package", "-w", "gaep-vscode"], { stdio: "inherit" });
  fs.mkdirSync(extractedDirectory);
  run("/usr/bin/unzip", ["-q", vsixPath, "-d", extractedDirectory]);

  const files = entries(extractedDirectory).sort((left, right) => left.localeCompare(right));
  for (const relative of files) fs.utimesSync(path.join(extractedDirectory, relative), fixedTime, fixedTime);
  for (const relative of [...new Set(files.flatMap(file => {
    const parts = file.split(path.sep);
    return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join(path.sep));
  }))].sort((left, right) => right.length - left.length)) {
    fs.utimesSync(path.join(extractedDirectory, relative), fixedTime, fixedTime);
  }

  run("/usr/bin/zip", ["-X", "-q", normalizedPath, "-@"], {
    cwd: extractedDirectory,
    input: `${files.join("\n")}\n`,
  });
  fs.renameSync(normalizedPath, vsixPath);
  console.log(`Normalized deterministic file order, metadata, and timestamps in ${path.relative(root, vsixPath)}.`);
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
