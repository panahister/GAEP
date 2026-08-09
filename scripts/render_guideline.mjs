#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { loadProjectionContext, validateCanonicalProjection } from "./lib/guideline_projection.mjs";

const mode = process.argv[2];
if (!["--check", "--write"].includes(mode)) {
  process.stderr.write("usage: node scripts/render_guideline.mjs --check|--write\n");
  process.exit(64);
}

const context = loadProjectionContext();
const result = validateCanonicalProjection(context);
if (!result.valid) {
  process.stderr.write(`GAEP Guideline projection validation failed:\n- ${result.errors.join("\n- ")}\n`);
  process.exit(1);
}

const outputPath = path.join(context.root, context.manifest.generation.outputPath);
if (mode === "--write") {
  fs.writeFileSync(outputPath, result.rendered);
  process.stdout.write(`Wrote deterministic GAEP Guideline to ${context.manifest.generation.outputPath}.\n`);
  process.exit(0);
}

const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
if (actual !== result.rendered) {
  process.stderr.write(`Generated Guide drift: run npm run render:guideline and commit ${context.manifest.generation.outputPath}.\n`);
  process.exit(1);
}
process.stdout.write(`GAEP Guideline projection is current: ${context.manifest.generation.outputPath}.\n`);
