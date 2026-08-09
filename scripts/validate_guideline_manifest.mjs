#!/usr/bin/env node
import process from "node:process";

import { loadProjectionContext, validateCanonicalProjection } from "./lib/guideline_projection.mjs";

const context = loadProjectionContext();
const result = validateCanonicalProjection(context);
if (!result.valid) {
  process.stderr.write(`GAEP Guideline projection validation failed:\n- ${result.errors.join("\n- ")}\n`);
  process.exit(1);
}

process.stdout.write(`GAEP Guideline projection manifest valid: ${context.manifest.requiredSections.length} sections, ${context.manifest.requiredVisuals.length} vertical visuals, ${context.manifest.lifecycleNodes.length} lifecycle nodes, ${context.market.capabilities.length} capabilities, ${context.catalog.references.length} assessed references.\n`);
