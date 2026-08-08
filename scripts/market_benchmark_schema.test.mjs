import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  AJV_FORMATS_VERSION,
  AJV_VERSION,
  METHODOLOGY_CATALOG_PATH,
  REGISTRY_PATH,
  ROOT,
  SCHEMA_PATH,
  canonicalJson,
  compileSchema,
  readJson,
  validateCanonicalRegistry,
} from "./lib/market_benchmark_registry.mjs";

const registry = readJson(REGISTRY_PATH);
const schema = readJson(SCHEMA_PATH);
const validate = compileSchema(schema);
const CLI_PATH = path.join(ROOT, "scripts/validate_market_benchmark_registry.mjs");

const clone = value => structuredClone(value);

function assertSchemaInvalid(candidate, expectedFragment) {
  assert.equal(validate(candidate), false, "hostile candidate must fail JSON Schema validation");
  assert.ok(
    validate.errors.some(error => `${error.instancePath}|${error.schemaPath}|${error.message}`.includes(expectedFragment)),
    `expected schema error containing ${expectedFragment}; got ${JSON.stringify(validate.errors)}`,
  );
}

function runCli(candidate) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gaep-market-schema-"));
  const registryPath = path.join(directory, "registry.json");
  try {
    fs.writeFileSync(registryPath, canonicalJson(candidate));
    return spawnSync(process.execPath, [CLI_PATH, "--registry", registryPath, "--schema", SCHEMA_PATH, "--methodology-catalog", METHODOLOGY_CATALOG_PATH], { cwd: ROOT, encoding: "utf8" });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("canonical P02 registry validates actual committed artifacts", () => {
  const result = validateCanonicalRegistry();
  assert.equal(result.valid, true, result.errors.join("\n"));
});

test("canonical P02 CLI begins from and validates the actual registry", () => {
  const result = spawnSync(process.execPath, [CLI_PATH], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /15 products, 49 evidence records, 220 support assertions, 450 benchmark cells/);
});

test("JSON Schema is strict Draft 2020-12 and compiles offline", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(typeof compileSchema(schema), "function");
  assert.match(AJV_VERSION, /^8\./);
  assert.match(AJV_FORMATS_VERSION, /^3\./);
});

test("hostile malformed identifier is rejected", () => {
  const hostile = clone(registry);
  hostile.products[0].productId = "bad-id";
  assertSchemaInvalid(hostile, "/products/0/productId");
});

test("hostile missing required property is rejected", () => {
  const hostile = clone(registry);
  delete hostile.evidence[0].publisher;
  assertSchemaInvalid(hostile, "required");
});

test("hostile additional property is rejected", () => {
  const hostile = clone(registry);
  hostile.uncontrolledTruth = true;
  assertSchemaInvalid(hostile, "additionalProperties");
});

test("hostile non-HTTPS official URI is rejected", () => {
  const hostile = clone(registry);
  hostile.evidence[0].officialUri = "http://example.com";
  assertSchemaInvalid(hostile, "/evidence/0/officialUri");
});

test("hostile impossible date is rejected", () => {
  const hostile = clone(registry);
  hostile.evidence[0].asOfDate = "2026-02-30";
  assertSchemaInvalid(hostile, "/evidence/0/asOfDate");
});

test("hostile benchmark support enum is rejected", () => {
  const hostile = clone(registry);
  hostile.benchmarkRows[0].cells[0].supportLevel = "yes";
  assertSchemaInvalid(hostile, "/benchmarkRows/0/cells/0/supportLevel");
});

test("hostile malformed Evidence assertion identifier is rejected", () => {
  const hostile = clone(registry);
  hostile.evidenceAssertions[0].assertionId = "bad-assertion";
  assertSchemaInvalid(hostile, "/evidenceAssertions/0/assertionId");
});

test("hostile taxonomy cardinality below 30 is rejected by Schema", () => {
  const hostile = clone(registry);
  hostile.capabilities.pop();
  assertSchemaInvalid(hostile, "/capabilities");
});

test("hostile benchmark row with fewer than 30 cells is rejected by Schema", () => {
  const hostile = clone(registry);
  hostile.benchmarkRows[0].cells.pop();
  assertSchemaInvalid(hostile, "/benchmarkRows/0/cells");
});

test("hostile Product status enum is rejected", () => {
  const hostile = clone(registry);
  hostile.products[0].status = "latest";
  assertSchemaInvalid(hostile, "/products/0/status");
});

test("hostile registry passed through CLI fails closed deterministically", () => {
  const hostile = clone(registry);
  hostile.evidence[0].officialUri = "http://example.com";
  const first = runCli(hostile);
  const second = runCli(hostile);
  assert.notEqual(first.status, 0);
  assert.equal(first.stderr, second.stderr);
  assert.match(first.stderr, /validation failed/i);
});

test("aggregate P02 test command starts with canonical validation", () => {
  const packageJson = readJson(path.join(ROOT, "package.json"));
  assert.match(packageJson.scripts["test:market-benchmark"] ?? "", /^npm run validate:market-benchmark && /);
});
