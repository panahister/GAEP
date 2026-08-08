import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ASSERTION_POLARITIES,
  ASSERTION_STRENGTHS,
  ASSERTION_TYPES,
  DELIVERY_STATES,
  EXPECTED_CAPABILITY_COUNT,
  GAEP_MATURITY_STATES,
  REGISTRY_PATH,
  REQUIRED_CAPABILITIES,
  REQUIRED_CAPABILITY_NAMES,
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

function cell(candidate, productId, capabilityId) {
  return candidate.benchmarkRows.find(row => row.productId === productId).cells.find(entry => entry.capabilityId === capabilityId);
}

function assertion(candidate, assertionId) {
  return candidate.evidenceAssertions.find(entry => entry.assertionId === assertionId);
}

const firstUnknownCell = candidate => candidate.benchmarkRows.flatMap(row => row.cells.map(entry => ({ row, cell: entry }))).find(entry => entry.cell.supportLevel === "unknown");
const firstSupportedCell = candidate => candidate.benchmarkRows.flatMap(row => row.cells.map(entry => ({ row, cell: entry }))).find(entry => ["verified-supported", "partially-supported"].includes(entry.cell.supportLevel));
const firstVerifiedCell = candidate => candidate.benchmarkRows.flatMap(row => row.cells.map(entry => ({ row, cell: entry }))).find(entry => entry.cell.supportLevel === "verified-supported");

test("canonical semantic registry is valid", () => {
  assert.deepEqual(errorsFor(registry), []);
});

test("hostile unknown Evidence assertion ID is rejected", () => {
  const hostile = clone(registry);
  firstSupportedCell(hostile).cell.supportAssertionIds = ["GAEP-AST-999"];
  assertError(hostile, "unknown Evidence assertion GAEP-AST-999");
});

test("hostile wrong-Product assertion is rejected", () => {
  const hostile = clone(registry);
  const target = firstSupportedCell(hostile);
  assertion(hostile, target.cell.supportAssertionIds[0]).productId = hostile.products.find(product => product.productId !== target.row.productId).productId;
  assertError(hostile, "wrong-Product Evidence assertion");
});

test("hostile Kiro cell backed by excluded SAP evidence is rejected", () => {
  const hostile = clone(registry);
  const kiro = cell(hostile, "GAEP-PRD-001", "GAEP-CAP-125");
  kiro.supportAssertionIds = hostile.excludedIdentities.find(item => item.canonicalName.includes("SAP")).assertionIds;
  assertError(hostile, "wrong-Product Evidence assertion");
});

test("hostile wrong-capability assertion is rejected", () => {
  const hostile = clone(registry);
  const target = firstSupportedCell(hostile);
  assertion(hostile, target.cell.supportAssertionIds[0]).capabilityId = hostile.capabilities.find(capability => capability.capabilityId !== target.cell.capabilityId).capabilityId;
  assertError(hostile, "wrong-capability Evidence assertion");
});

test("hostile unavailable Evidence cannot support a cell", () => {
  const hostile = clone(registry);
  const target = firstSupportedCell(hostile);
  const support = assertion(hostile, target.cell.supportAssertionIds[0]);
  const evidence = hostile.evidence.find(entry => entry.evidenceId === support.evidenceId);
  evidence.accessResult = "unavailable";
  evidence.contentReviewState = "access-unavailable";
  evidence.reviewDepth = "unavailable";
  assertError(hostile, "unusable or insufficient-strength Evidence assertion");
});

test("hostile identity-only evidence used as feature support is rejected", () => {
  const hostile = clone(registry);
  const target = firstSupportedCell(hostile);
  const identityId = hostile.products.find(product => product.productId === target.row.productId).identityAssertionIds[0];
  target.cell.supportAssertionIds = [identityId];
  assertError(hostile, "incompatible assertion type identity");
});

test("hostile empty support proposition is rejected", () => {
  const hostile = clone(registry);
  assertion(hostile, firstSupportedCell(hostile).cell.supportAssertionIds[0]).proposition = " ";
  assertError(hostile, "supported proposition is empty");
});

test("hostile partial review cannot establish verified support", () => {
  const hostile = clone(registry);
  const target = firstVerifiedCell(hostile);
  assertion(hostile, target.cell.supportAssertionIds[0]).supportStrength = "partial";
  assertError(hostile, "unusable or insufficient-strength Evidence assertion");
});

test("hostile stale assertion is rejected", () => {
  const hostile = clone(registry);
  assertion(hostile, firstSupportedCell(hostile).cell.supportAssertionIds[0]).asOfDate = "2026-08-07";
  assertError(hostile, "stale assertion does not match registry snapshot");
});

test("hostile superseded assertion cannot support a current cell", () => {
  const hostile = clone(registry);
  const target = firstSupportedCell(hostile);
  const support = assertion(hostile, target.cell.supportAssertionIds[0]);
  support.status = "superseded";
  assertError(hostile, "unusable or insufficient-strength Evidence assertion");
});

test("hostile shipped state without exact availability assertion is rejected", () => {
  const hostile = clone(registry);
  const target = firstSupportedCell(hostile);
  target.cell.deliveryState = "shipped";
  target.cell.availabilityAssertionIds = [];
  assertError(hostile, "shipped state requires official availability assertion");
});

test("hostile unrelated Evidence assertion cannot substantiate a comparative claim", () => {
  const hostile = clone(registry);
  const claim = hostile.claims.find(entry => entry.claimClass === "evidence-bounded-comparison");
  claim.supportAssertionIds = [hostile.excludedIdentities[0].assertionIds[0]];
  assertError(hostile, "multi-Product comparison missing Product-specific support");
});

test("hostile multi-Product comparison missing one subject-specific assertion is rejected", () => {
  const hostile = clone(registry);
  const claim = hostile.claims.find(entry => entry.claimClass === "evidence-bounded-comparison" && entry.productIds.length > 1);
  claim.supportAssertionIds = claim.supportAssertionIds.filter(id => assertion(hostile, id).productId === claim.productIds[0]);
  assertError(hostile, `multi-Product comparison missing Product-specific support for ${claim.productIds[1]}`);
});

test("hostile old 17-capability projection is rejected", () => {
  const hostile = clone(registry);
  hostile.projection.capabilityCount = 17;
  assertError(hostile, "old or stale capability projection presented as current");
});

for (const count of [29, 31]) {
  test(`hostile ${count}-capability taxonomy is rejected`, () => {
    const hostile = clone(registry);
    if (count === 29) hostile.capabilities.pop();
    else hostile.capabilities.push({ ...hostile.capabilities.at(-1), capabilityId: "GAEP-CAP-131", name: "Improper extra dimension" });
    assertError(hostile, "capability taxonomy must contain exactly 30 dimensions");
  });
}

test("hostile repurposing of a legacy capability ID is rejected", () => {
  const hostile = clone(registry);
  hostile.capabilities[0].capabilityId = "GAEP-CAP-001";
  assertError(hostile, "exact canonical 30 IDs, names, and ordering");
});

test("hostile one-to-many migration without human review is rejected", () => {
  const hostile = clone(registry);
  hostile.capabilityMigration.legacyCapabilities.find(entry => entry.migrationType === "one-to-many").humanReviewRequired = false;
  assertError(hostile, "one-to-many migration requires human review");
});

test("hostile missing benchmark cell is rejected", () => {
  const hostile = clone(registry);
  hostile.benchmarkRows[0].cells.pop();
  assertError(hostile, "benchmark must contain every capability exactly once");
});

test("hostile duplicate benchmark cell is rejected", () => {
  const hostile = clone(registry);
  hostile.benchmarkRows[0].cells[1] = clone(hostile.benchmarkRows[0].cells[0]);
  assertError(hostile, "benchmark must contain every capability exactly once");
});

test("hostile Unknown converted to false or No is rejected", () => {
  const hostile = clone(registry);
  firstUnknownCell(hostile).cell.limitation = "No capability exists.";
  assertError(hostile, "unknown must remain explicit");
});

test("hostile documentation silence converted to unsupported is rejected", () => {
  const hostile = clone(registry);
  const target = firstUnknownCell(hostile).cell;
  target.supportLevel = "unsupported-by-reviewed-evidence";
  target.rationale = "No public documentation was found.";
  assertError(hostile, "missing public evidence cannot prove unsupported");
});

test("hostile methodology classified as Product is rejected", () => {
  const hostile = clone(registry);
  hostile.products[0].canonicalName = methodologyCatalog.references[0].canonicalName;
  assertError(hostile, "duplicates GAEP-REG-011 methodology truth");
});

test("hostile Product classified as methodology is rejected", () => {
  const hostile = clone(registry);
  const seed = hostile.seedResolutions.find(entry => entry.resolutionState === "methodology-framework");
  seed.selectedIdentity = hostile.products[0].canonicalName;
  assertError(hostile, "methodology classified as Product");
});

for (const wording of [
  "GAEP is superior to every alternative.",
  "GAEP is enterprise-ready.",
  "GAEP is secure and compliant.",
  "GAEP is certified.",
  "GAEP guarantees quality.",
  "GAEP delivers 40% ROI and time savings.",
]) {
  test(`hostile prohibited authority, outcome, or superiority wording is blocked: ${wording}`, () => {
    const hostile = clone(registry);
    hostile.claims[0].wording = wording;
    assertError(hostile, "unsupported strong claim is not prohibited");
  });
}

test("hostile GAEP roadmap capability presented as current is rejected", () => {
  const hostile = clone(registry);
  const maturity = hostile.gaepMaturity.find(entry => entry.maturityState === "planned-deferred-coming-soon");
  maturity.rationale = "Implemented current capability shipped to users.";
  assertError(hostile, "roadmap capability presented as shipped");
});

test("hostile unauthorized approval or publication is rejected", () => {
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

test("schema, semantic constants, serializer, taxonomy, and projection remain in parity", () => {
  assert.equal(EXPECTED_CAPABILITY_COUNT, 30);
  assert.deepEqual(registry.capabilities.map(({ capabilityId, name }) => [capabilityId, name]), REQUIRED_CAPABILITIES);
  assert.deepEqual(registry.capabilities.map(entry => entry.name), REQUIRED_CAPABILITY_NAMES);
  assert.deepEqual([...schema.$defs.benchmarkCell.properties.supportLevel.enum].sort(), SUPPORT_LEVELS);
  assert.deepEqual([...schema.$defs.benchmarkCell.properties.deliveryState.enum].sort(), DELIVERY_STATES);
  assert.deepEqual([...schema.$defs.evidenceAssertion.properties.supportStrength.enum].sort(), ASSERTION_STRENGTHS);
  assert.deepEqual([...schema.$defs.evidenceAssertion.properties.polarity.enum].sort(), ASSERTION_POLARITIES);
  assert.deepEqual([...schema.$defs.evidenceAssertion.properties.assertionType.enum].sort(), ASSERTION_TYPES);
  assert.deepEqual([...schema.$defs.gaepMaturity.properties.maturityState.enum].sort(), GAEP_MATURITY_STATES);
  assert.equal(registry.projection.capabilityCount, 30);
  assert.equal(registry.benchmarkRows.flatMap(row => row.cells).length, 450);
  assert.equal(canonicalJson(registry), fs.readFileSync(REGISTRY_PATH, "utf8"));
});
