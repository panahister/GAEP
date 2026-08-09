import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import {
  AJV_FORMATS_VERSION,
  AJV_VERSION,
  MANIFEST_PATH,
  ROOT,
  SCHEMA_PATH,
  compileSchema,
  loadProjectionContext,
  readJson,
  validateProjectionContext,
} from "./lib/guideline_projection.mjs";

const context = loadProjectionContext();
const manifest = readJson(MANIFEST_PATH);
const schema = readJson(SCHEMA_PATH);
const validate = compileSchema(schema);
const clone = value => structuredClone(value);

function assertSchemaInvalid(candidate, fragment) {
  assert.equal(validate(candidate), false, "hostile manifest must fail strict JSON Schema validation");
  assert.ok(validate.errors.some(error => `${error.instancePath}|${error.schemaPath}|${error.message}`.includes(fragment)), JSON.stringify(validate.errors));
}

test("canonical P03 manifest and bound projection context validate", () => {
  assert.deepEqual(validateProjectionContext(context), []);
});

test("canonical P03 validation CLI uses actual committed inputs", () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/validate_guideline_manifest.mjs")], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /13 sections, 9 vertical visuals, 19 lifecycle nodes, 30 capabilities, 16 assessed references/);
});

test("Guideline Schema is strict Draft 2020-12 and compiles offline", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(typeof compileSchema(schema), "function");
  assert.match(AJV_VERSION, /^8\./);
  assert.match(AJV_FORMATS_VERSION, /^3\./);
});

test("hostile additional root property is rejected", () => {
  const candidate = clone(manifest);
  candidate.manualAuthority = true;
  assertSchemaInvalid(candidate, "additionalProperties");
});

test("hostile missing source digest is rejected", () => {
  const candidate = clone(manifest);
  delete candidate.canonicalSources[0].sha256;
  assertSchemaInvalid(candidate, "required");
});

test("hostile malformed digest is rejected", () => {
  const candidate = clone(manifest);
  candidate.canonicalSources[0].sha256 = "latest";
  assertSchemaInvalid(candidate, "/canonicalSources/0/sha256");
});

test("hostile unsafe repository path is rejected", () => {
  const candidate = clone(manifest);
  candidate.canonicalSources[0].path = "../outside.json";
  assertSchemaInvalid(candidate, "/canonicalSources/0/path");
});

test("hostile fifth audience layer is rejected", () => {
  const candidate = clone(manifest);
  candidate.audienceLayers.push(clone(candidate.audienceLayers[0]));
  assertSchemaInvalid(candidate, "/audienceLayers");
});

test("hostile lifecycle with only eighteen nodes is rejected", () => {
  const candidate = clone(manifest);
  candidate.lifecycleNodes.pop();
  assertSchemaInvalid(candidate, "/lifecycleNodes");
});

test("hostile horizontal visual direction is rejected", () => {
  const candidate = clone(manifest);
  candidate.requiredVisuals[0].direction = "LR";
  assertSchemaInvalid(candidate, "/requiredVisuals/0/direction");
});

test("hostile approval inflation is rejected", () => {
  const candidate = clone(manifest);
  candidate.approval.state = "approved";
  assertSchemaInvalid(candidate, "/approval/state");
});
