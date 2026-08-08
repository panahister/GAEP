import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  DELIVERY_STATES,
  GAEP_MATURITY_STATES,
  REGISTRY_PATH,
  ROOT,
  SCHEMA_PATH,
  SUPPORT_LEVELS,
  canonicalJson,
  readJson,
  semanticErrors,
} from "./lib/market_benchmark_registry.mjs";

const registry = readJson(REGISTRY_PATH);
const methodologyCatalog = readJson(path.join(ROOT, "docs/next/99_Registries_and_References/011_METHODOLOGY_REFERENCE_CATALOG.json"));
const schema = readJson(SCHEMA_PATH);
const clone = value => structuredClone(value);

function errorsFor(candidate, rawText = canonicalJson(candidate)) {
  return semanticErrors(candidate, { methodologyCatalog, rawText });
}

function assertError(candidate, fragment, rawText) {
  const errors = errorsFor(candidate, rawText);
  assert.ok(errors.some(error => error.includes(fragment)), `expected ${fragment}; got:\n${errors.join("\n")}`);
}

const firstUnknownCell = candidate => candidate.benchmarkRows.flatMap(row => row.cells.map(cell => ({ row, cell }))).find(entry => entry.cell.supportLevel === "unknown");
const firstSupportedCell = candidate => candidate.benchmarkRows.flatMap(row => row.cells.map(cell => ({ row, cell }))).find(entry => ["verified-supported", "partially-supported"].includes(entry.cell.supportLevel));

test("canonical semantic registry is valid", () => {
  assert.deepEqual(errorsFor(registry), []);
});

test("hostile duplicate stable IDs are rejected", () => {
  const hostile = clone(registry);
  hostile.products[1].productId = hostile.products[0].productId;
  assertError(hostile, "duplicate IDs");
});

test("hostile unknown evidence reference is rejected", () => {
  const hostile = clone(registry);
  hostile.products[0].evidenceIds = ["GAEP-EVD-999"];
  assertError(hostile, "unknown evidence GAEP-EVD-999");
});

test("hostile unknown Product reference is rejected", () => {
  const hostile = clone(registry);
  hostile.benchmarkRows[0].productId = "GAEP-PRD-999";
  assertError(hostile, "unknown Product");
});

test("hostile unknown capability reference is rejected", () => {
  const hostile = clone(registry);
  hostile.claims[0].gaepCapabilityIds = ["GAEP-CAP-999"];
  assertError(hostile, "unknown GAEP capability GAEP-CAP-999");
});

test("hostile stale benchmark snapshot binding is rejected", () => {
  const hostile = clone(registry);
  hostile.benchmarkRows[0].cells[0].asOfDate = "2026-08-07";
  assertError(hostile, "stale or mismatched as-of binding");
});

test("hostile impossible evidence chronology is rejected", () => {
  const hostile = clone(registry);
  hostile.evidence[0].nextReviewAt = "2020-01-01";
  assertError(hostile, "next review precedes evidence as-of date");
});

test("hostile contradictory Product status is rejected", () => {
  const hostile = clone(registry);
  hostile.products[0].knownUnknowns = ["Product is discontinued"];
  assertError(hostile, "contradictory Product status");
});

test("hostile noncanonical identifier ordering is rejected", () => {
  const hostile = clone(registry);
  hostile.capabilities.reverse();
  assertError(hostile, "capabilities must use canonical ID ordering");
});

test("hostile noncanonical JSON serialization is rejected", () => {
  const hostile = clone(registry);
  assertError(hostile, "serialization is noncanonical", JSON.stringify(hostile));
});

test("hostile noncanonical lexical string-set ordering is rejected", () => {
  const hostile = clone(registry);
  hostile.marketCategories[0].inclusionCriteria.reverse();
  assertError(hostile, "serialization is noncanonical", `${JSON.stringify(hostile, null, 2)}\n`);
});

test("hostile one-sided supersession is rejected", () => {
  const hostile = clone(registry);
  hostile.evidence[0].supersededBy = [hostile.evidence[1].evidenceId];
  assertError(hostile, "missing reciprocal supersession");
});

test("hostile unsupported strong superiority claim is rejected", () => {
  const hostile = clone(registry);
  hostile.claims[0].wording = "GAEP is superior to every alternative.";
  assertError(hostile, "unsupported strong claim is not prohibited");
});

for (const wording of [
  "GAEP is enterprise-ready.",
  "GAEP is secure and compliant.",
  "GAEP is certified.",
  "GAEP guarantees quality.",
  "GAEP delivers 40% ROI and time savings.",
]) {
  test(`hostile prohibited authority or outcome wording is blocked: ${wording}`, () => {
    const hostile = clone(registry);
    hostile.claims[0].wording = wording;
    assertError(hostile, "unsupported strong claim is not prohibited");
  });
}

test("hostile GAEP roadmap capability presented as shipped is rejected", () => {
  const hostile = clone(registry);
  const maturity = hostile.gaepMaturity.find(entry => entry.maturityState === "planned-deferred-coming-soon");
  maturity.rationale = "Implemented current capability shipped to users.";
  assertError(hostile, "roadmap capability presented as shipped");
});

test("hostile competitor unsupported state inferred from missing documentation is rejected", () => {
  const hostile = clone(registry);
  const { cell } = firstUnknownCell(hostile);
  cell.supportLevel = "unsupported-by-reviewed-evidence";
  cell.evidenceIds = [hostile.evidence[0].evidenceId];
  cell.rationale = "No public documentation was found.";
  assertError(hostile, "missing public evidence cannot prove unsupported");
});

test("hostile unknown converted to false or No is rejected", () => {
  const hostile = clone(registry);
  const { cell } = firstUnknownCell(hostile);
  cell.limitation = "No capability exists.";
  assertError(hostile, "unknown must remain explicit");
});

test("hostile methodology classified as Product is rejected", () => {
  const hostile = clone(registry);
  hostile.products[0].canonicalName = hostile.seedResolutions[0].selectedIdentity;
  assertError(hostile, "methodology classified as Product");
});

test("hostile Product classified as methodology is rejected", () => {
  const hostile = clone(registry);
  const seed = hostile.seedResolutions[0];
  seed.selectedIdentity = hostile.products[0].canonicalName;
  assertError(hostile, "methodology classified as Product");
});

test("hostile benchmark cell without evidence is rejected", () => {
  const hostile = clone(registry);
  const { cell } = firstSupportedCell(hostile);
  cell.evidenceIds = [];
  assertError(hostile, "benchmark support state requires evidence");
});

test("hostile stale generated projection binding is rejected", () => {
  const hostile = clone(registry);
  hostile.projection.registryVersion = "9.9.9";
  assertError(hostile, "projection registryVersion differs");
});

test("hostile unauthorized Approved or Published state is rejected", () => {
  const hostile = clone(registry);
  hostile.approval.state = "approved";
  assertError(hostile, "unauthorized Approved/Published state");
});

test("hostile exact quotation beyond copyright boundary is rejected", () => {
  const hostile = clone(registry);
  hostile.claims[0].wording = `"${Array.from({ length: 26 }, (_, index) => `word${index}`).join(" ")}"`;
  assertError(hostile, "exact quotation exceeds");
});

test("hostile invented aggregate score or ranking is rejected", () => {
  const hostile = clone(registry);
  hostile.totalScore = 99;
  assertError(hostile, "invented total score or ranking field", canonicalJson(hostile));
});

test("hostile ambiguous Product identity silently resolved is rejected", () => {
  const hostile = clone(registry);
  const seed = hostile.seedResolutions.find(entry => entry.resolutionState === "resolved-project");
  seed.rationale = "This is the identity.";
  assertError(hostile, "ambiguous identity was silently resolved");
});

test("hostile duplicate Product truth conflicting with GAEP-REG-011 is rejected", () => {
  const hostile = clone(registry);
  hostile.products[0].canonicalName = methodologyCatalog.references[0].canonicalName;
  assertError(hostile, "duplicates GAEP-REG-011 methodology truth");
});

test("schema, semantic constants, and serializer remain in parity", () => {
  assert.deepEqual([...schema.$defs.benchmarkCell.properties.supportLevel.enum].sort(), SUPPORT_LEVELS);
  assert.deepEqual([...schema.$defs.benchmarkCell.properties.deliveryState.enum].sort(), DELIVERY_STATES);
  assert.deepEqual([...schema.$defs.gaepMaturity.properties.maturityState.enum].sort(), GAEP_MATURITY_STATES);
  assert.equal(canonicalJson(registry), fs.readFileSync(REGISTRY_PATH, "utf8"));
});
