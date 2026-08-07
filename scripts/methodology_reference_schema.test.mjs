import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  CATALOG_PATH,
  SCHEMA_PATH,
  compileMethodologySchema,
  readJson,
  validateCatalogWithSchema,
} from "./lib/methodology_reference_schema.mjs";

const catalog = readJson(CATALOG_PATH);
const schema = readJson(SCHEMA_PATH);

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
