#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { loadProjectionContext, projectionDriftErrors, validateCanonicalProjection } from "./lib/guideline_projection.mjs";

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
const decisionSupportOutputPath = path.join(context.root, context.manifest.generation.decisionSupportOutputPath);
if (mode === "--write") {
  fs.writeFileSync(outputPath, result.rendered);
  fs.writeFileSync(decisionSupportOutputPath, result.renderedDecisionSupport);
  process.stdout.write(`Wrote deterministic GAEP Guideline to ${context.manifest.generation.outputPath} and complete decision support to ${context.manifest.generation.decisionSupportOutputPath}.\n`);
  process.exit(0);
}

const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
const actualDecisionSupport = fs.existsSync(decisionSupportOutputPath) ? fs.readFileSync(decisionSupportOutputPath, "utf8") : "";
if (projectionDriftErrors(actual, result.rendered).length > 0 || projectionDriftErrors(actualDecisionSupport, result.renderedDecisionSupport).length > 0) {
  process.stderr.write(`Generated Guideline drift: run npm run render:guideline and commit ${context.manifest.generation.outputPath} plus ${context.manifest.generation.decisionSupportOutputPath}.\n`);
  process.exit(1);
}
process.stdout.write(`GAEP Guideline projections are current: ${context.manifest.generation.outputPath}; ${context.manifest.generation.decisionSupportOutputPath}.\n`);
