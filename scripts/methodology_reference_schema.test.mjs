import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CATALOG_PATH,
  ROOT,
  SCHEMA_PATH,
  assertCatalogSchemaBinding,
  compileMethodologySchema,
  readJson,
  validateCanonicalCatalog,
  validateCatalogWithSchema,
} from "./lib/methodology_reference_schema.mjs";

const catalog = readJson(CATALOG_PATH);
const schema = readJson(SCHEMA_PATH);
const CLI_PATH = fileURLToPath(new URL("./validate_methodology_reference_schema.mjs", import.meta.url));

function clone(value) {
  return structuredClone(value);
}

function assertInvalid(candidate, expectedPath) {
  const result = validateCatalogWithSchema(candidate, schema);
  assert.equal(result.valid, false, "hostile fixture must fail JSON Schema validation");
  assert.ok(
    result.errors.some((error) => error.instancePath.includes(expectedPath) || error.schemaPath.includes(expectedPath)),
    `expected an Ajv error containing ${expectedPath}; received ${JSON.stringify(result.errors)}`,
  );
}

function runCli({ catalogValue = catalog, schemaValue = schema } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gaep-methodology-schema-"));
  const catalogPath = path.join(directory, "catalog.json");
  const schemaPath = path.join(directory, "schema.json");
  try {
    fs.writeFileSync(catalogPath, `${JSON.stringify(catalogValue, null, 2)}\n`);
    fs.writeFileSync(schemaPath, `${JSON.stringify(schemaValue, null, 2)}\n`);
    return spawnSync(
      process.execPath,
      [CLI_PATH, "--catalog", catalogPath, "--schema", schemaPath],
      { cwd: ROOT, encoding: "utf8" },
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("canonical methodology catalog validates successfully", () => {
  assert.deepEqual(validateCanonicalCatalog(), { valid: true, errors: [] });
});

test("canonical validation CLI exits zero", () => {
  const result = spawnSync(process.execPath, [CLI_PATH], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /validation: PASS/);
});

test("hostile catalog passed to the validation CLI exits non-zero", () => {
  const hostile = clone(catalog);
  hostile.unexpected = true;
  const result = runCli({ catalogValue: hostile });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /validation: FAIL/);
  assert.match(result.stderr, /additional properties/);
});

test("test:methodology-catalog explicitly starts with canonical validation", () => {
  const packageJson = readJson(path.join(ROOT, "package.json"));
  assert.match(
    packageJson.scripts["test:methodology-catalog"],
    /^npm run validate:methodology-schema && /,
  );
});

test("catalog and schema ID binding must be exact", () => {
  const hostileSchema = clone(schema);
  hostileSchema.$id = "https://gaep.example/schemas/different.json";
  assert.throws(() => assertCatalogSchemaBinding(catalog, hostileSchema), /does not equal schema \$id/);
  const result = runCli({ schemaValue: hostileSchema });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not equal schema \$id/);
});

test("catalog and schema version binding must be exact", () => {
  const hostileSchema = clone(schema);
  hostileSchema.properties.schemaVersion.const = "9.9.9";
  assert.throws(() => assertCatalogSchemaBinding(catalog, hostileSchema), /does not equal schema version/);
  const result = runCli({ schemaValue: hostileSchema });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not equal schema version/);
});

test("schema compilation failure makes the validation CLI exit non-zero", () => {
  const hostileSchema = clone(schema);
  hostileSchema.unknownStrictKeyword = true;
  const result = runCli({ schemaValue: hostileSchema });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /strict mode|unknown keyword/);
});

test("validation CLI errors are deterministic and fail closed", () => {
  const hostile = clone(catalog);
  hostile.unexpected = true;
  const first = runCli({ catalogValue: hostile });
  const second = runCli({ catalogValue: hostile });
  assert.notEqual(first.status, 0);
  assert.equal(first.stderr, second.stderr);
});

test("JSON Schema compiles under strict Draft 2020-12 settings", () => {
  assert.equal(typeof compileMethodologySchema(schema), "function");
});

test("JSON Schema compilation failure is fail-closed", () => {
  const hostile = clone(schema);
  hostile.unknownStrictKeyword = true;
  assert.throws(() => compileMethodologySchema(hostile), /strict mode|unknown keyword/);
});

test("JSON Schema rejects a missing required field", () => {
  const hostile = clone(catalog);
  delete hostile.catalogId;
  assertInvalid(hostile, "required");
});

test("JSON Schema rejects an extra field", () => {
  const hostile = clone(catalog);
  hostile.unexpected = true;
  assertInvalid(hostile, "additionalProperties");
});

test("JSON Schema rejects an invalid enum", () => {
  const hostile = clone(catalog);
  hostile.references[0].status = "latest";
  assertInvalid(hostile, "/references/0/status");
});

test("JSON Schema rejects uncertain assessed version certainty", () => {
  const hostile = clone(catalog);
  hostile.references[0].versionCertainty = "uncertain";
  assertInvalid(hostile, "/references/0/versionCertainty");
});

test("JSON Schema rejects an exact reference with a non-null snapshot date", () => {
  const hostile = clone(catalog);
  hostile.references[0].snapshotDate = "2026-08-07";
  assertInvalid(hostile, "/references/0/snapshotDate");
});

test("JSON Schema rejects a snapshot-bound reference without a snapshot date", () => {
  const hostile = clone(catalog);
  const reference = hostile.references.find((entry) => entry.versionCertainty === "snapshot-bound");
  reference.snapshotDate = null;
  const result = validateCatalogWithSchema(hostile, schema);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.instancePath.endsWith("/snapshotDate")));
});

test("JSON Schema rejects an unverifiable reference with a current status", () => {
  const hostile = clone(catalog);
  const reference = hostile.references[0];
  reference.versionCertainty = "unverifiable";
  reference.status = "current";
  reference.evidenceStatus = "unverified";
  assertInvalid(hostile, "/references/0/status");
});

test("JSON Schema rejects an unverifiable reference with verified evidence", () => {
  const hostile = clone(catalog);
  const reference = hostile.references[0];
  reference.versionCertainty = "unverifiable";
  reference.status = "unverifiable";
  reference.evidenceStatus = "primary-source-verified";
  assertInvalid(hostile, "/references/0/evidenceStatus");
});

test("JSON Schema rejects an invalid assessed reference ID", () => {
  const hostile = clone(catalog);
  hostile.references[0].referenceId = "bad-id";
  assertInvalid(hostile, "/references/0/referenceId");
});

test("JSON Schema rejects a malformed deferred reference ID", () => {
  const hostile = clone(catalog);
  hostile.deferredCandidates[0].referenceId = "GAEP-DEFERRED-1";
  assertInvalid(hostile, "/deferredCandidates/0/referenceId");
});

test("JSON Schema rejects a malformed full date", () => {
  const hostile = clone(catalog);
  hostile.references[0].publicationDate = "2026-8-7";
  assertInvalid(hostile, "/references/0/publicationDate");
});

test("JSON Schema rejects an impossible full date", () => {
  const hostile = clone(catalog);
  hostile.references[0].publicationDate = "2026-02-30";
  assertInvalid(hostile, "/references/0/publicationDate");
});

test("JSON Schema rejects an invalid URI", () => {
  const hostile = clone(catalog);
  hostile.references[0].officialUri = "https://[invalid";
  assertInvalid(hostile, "/references/0/officialUri");
});

test("JSON Schema rejects a syntactically valid HTTP official URI", () => {
  const hostile = clone(catalog);
  hostile.references[0].officialUri = "http://example.com/source";
  assertInvalid(hostile, "/references/0/officialUri");
});

test("JSON Schema rejects a syntactically valid FTP official URI", () => {
  const hostile = clone(catalog);
  hostile.references[0].officialUri = "ftp://example.com/source";
  assertInvalid(hostile, "/references/0/officialUri");
});

test("JSON Schema accepts a syntactically valid HTTPS official URI", () => {
  const positive = clone(catalog);
  positive.references[0].officialUri = "https://example.com/source";
  assert.equal(validateCatalogWithSchema(positive, schema).valid, true);
});

test("JSON Schema rejects invalid nullability", () => {
  const hostile = clone(catalog);
  hostile.references[0].publicationDate = 20260807;
  assertInvalid(hostile, "/references/0/publicationDate");
});

test("JSON Schema rejects schema version mismatch", () => {
  const hostile = clone(catalog);
  hostile.schemaVersion = "1.0.0";
  assertInvalid(hostile, "/schemaVersion");
});

test("JSON Schema rejects malformed nested mapping governance", () => {
  const hostile = clone(catalog);
  delete hostile.mappings[0].assessment.assessor;
  assertInvalid(hostile, "/mappings/0/assessment");
});

test("JSON Schema rejects malformed access state", () => {
  const hostile = clone(catalog);
  hostile.references[0].access = {
    status: "not-accessed",
    date: "2026-08-07",
    evidence: "official-publication",
    reason: null,
  };
  assertInvalid(hostile, "/references/0/access");
});

test("JSON Schema rejects reviewed content when accessed evidence has no access date", () => {
  const hostile = clone(catalog);
  hostile.references[0].access.date = null;
  assertInvalid(hostile, "/references/0/access/date");
});

test("JSON Schema rejects malformed content-review state", () => {
  const hostile = clone(catalog);
  hostile.references[0].contentReview = {
    status: "not-reviewed",
    date: "2026-08-07",
    depth: "official-publication",
    reason: null,
  };
  assertInvalid(hostile, "/references/0/contentReview");
});

test("JSON Schema rejects invalid rights status", () => {
  const hostile = clone(catalog);
  hostile.references[0].rightsStatus = "probably-permitted";
  assertInvalid(hostile, "/references/0/rightsStatus");
});

test("JSON Schema rejects a schema-only violation intentionally outside Ruby semantics", () => {
  const hostile = clone(catalog);
  hostile.approval.unexpected = true;
  assertInvalid(hostile, "/approval");

  const ruby = spawnSync(
    "ruby",
    [
      "-rjson",
      "-I",
      "scripts",
      "-e",
      'require "lib/methodology_reference_catalog"; catalog=JSON.parse(STDIN.read); puts MethodologyReferenceCatalog.validate(catalog).length',
    ],
    { cwd: process.cwd(), encoding: "utf8", input: JSON.stringify(hostile) },
  );
  assert.equal(ruby.status, 0, ruby.stderr);
  assert.equal(ruby.stdout.trim(), "0", "Ruby must remain a semantic validator rather than duplicating schema shape checks");
});
