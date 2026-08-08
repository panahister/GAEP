import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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
  REPOSITORY_EVIDENCE_ROLES,
  REQUIRED_CAPABILITIES,
  REQUIRED_CAPABILITY_NAMES,
  ROOT,
  SCHEMA_PATH,
  SUBJECT_TYPES,
  SUPPORT_LEVELS,
  canonicalJson,
  readJson,
  repositoryAssertionErrors,
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

function repositoryAssertion(candidate, assertionId) {
  return candidate.repositoryAssertions.find(entry => entry.repositoryAssertionId === assertionId);
}

function firstActiveRepositoryAssertion(candidate) {
  return candidate.repositoryAssertions.find(entry => entry.status === "active");
}

function runFixtureGit(repositoryRoot, args, input) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: "2026-08-08T00:00:00Z",
      GIT_AUTHOR_EMAIL: "gaep-test@example.invalid",
      GIT_AUTHOR_NAME: "GAEP Test",
      GIT_COMMITTER_DATE: "2026-08-08T00:00:00Z",
      GIT_COMMITTER_EMAIL: "gaep-test@example.invalid",
      GIT_COMMITTER_NAME: "GAEP Test",
    },
    input,
  });
  assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
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

test("hostile Kiro assertion rebound only to SAP Evidence is rejected", () => {
  const hostile = clone(registry);
  assertion(hostile, "GAEP-AST-078").evidenceId = "GAEP-EVD-017";
  assertError(hostile, "Evidence subject does not match assertion subject");
});

test("hostile Evidence subject changed while assertions remain unchanged is rejected", () => {
  const hostile = clone(registry);
  const evidence = hostile.evidence.find(entry => entry.evidenceId === "GAEP-EVD-018");
  evidence.productId = "GAEP-PRD-002";
  assertError(hostile, "Evidence subject does not match assertion subject");
});

test("hostile Product Evidence used for a methodology is rejected", () => {
  const hostile = clone(registry);
  assertion(hostile, "GAEP-AST-059").evidenceId = "GAEP-EVD-003";
  assertError(hostile, "Evidence subject does not match assertion subject");
});

test("hostile excluded-identity Evidence used for a Product is rejected", () => {
  const hostile = clone(registry);
  const identityAssertionId = hostile.products.find(product => product.productId === "GAEP-PRD-001").identityAssertionIds[0];
  assertion(hostile, identityAssertionId).evidenceId = "GAEP-EVD-017";
  assertError(hostile, "Evidence subject does not match assertion subject");
});

test("hostile Evidence with multiple canonical subject identities is rejected", () => {
  const hostile = clone(registry);
  const evidence = hostile.evidence.find(entry => entry.evidenceId === "GAEP-EVD-003");
  evidence.methodologyId = "GAEP-MTH-001";
  assertError(hostile, "Evidence must identify exactly one canonical subject");
});

test("hostile Evidence with zero canonical subject identities is rejected", () => {
  const hostile = clone(registry);
  const evidence = hostile.evidence.find(entry => entry.evidenceId === "GAEP-EVD-003");
  evidence.productId = null;
  assertError(hostile, "Evidence must identify exactly one canonical subject");
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
  assertError(hostile, "claim missing exact active landscape-classification support");
});

test("hostile multi-Product comparison missing one subject-specific assertion is rejected", () => {
  const hostile = clone(registry);
  const claim = hostile.claims.find(entry => entry.claimClass === "evidence-bounded-comparison" && entry.productIds.length > 1);
  claim.supportAssertionIds = claim.supportAssertionIds.filter(id => assertion(hostile, id).productId === claim.productIds[0]);
  assertError(hostile, `claim missing exact active landscape-classification support for ${claim.productIds[1]}`);
});

test("hostile all-zero repository asOfCommit is rejected", () => {
  const hostile = clone(registry);
  firstActiveRepositoryAssertion(hostile).asOfCommit = "0".repeat(40);
  assertError(hostile, "all-zero asOfCommit is prohibited");
});

test("hostile syntactically valid but nonexistent repository commit is rejected", () => {
  const hostile = clone(registry);
  firstActiveRepositoryAssertion(hostile).asOfCommit = "f".repeat(40);
  assertError(hostile, "nonexistent or invalid Git commit");
});

test("hostile existing commit outside the permitted reachability boundary is rejected", () => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gaep-reachability-"));
  try {
    runFixtureGit(repositoryRoot, ["init", "--quiet"]);
    const emptyTree = runFixtureGit(repositoryRoot, ["mktree"], "");
    const reachableCommit = runFixtureGit(repositoryRoot, ["commit-tree", emptyTree, "-m", "reachable"]);
    runFixtureGit(repositoryRoot, ["update-ref", "refs/heads/main", reachableCommit]);
    runFixtureGit(repositoryRoot, ["symbolic-ref", "HEAD", "refs/heads/main"]);
    const unreachableCommit = runFixtureGit(repositoryRoot, ["commit-tree", emptyTree, "-m", "unreachable"]);
    const hostile = clone(firstActiveRepositoryAssertion(registry));
    hostile.asOfCommit = unreachableCommit;
    assert.ok(repositoryAssertionErrors(hostile, { repositoryRoot }).some(error => error.includes("Git commit is not permitted by reachability policy")));
  } finally {
    fs.rmSync(repositoryRoot, { force: true, recursive: true });
  }
});

test("hostile nonexistent repository path is rejected", () => {
  const hostile = clone(registry);
  firstActiveRepositoryAssertion(hostile).repositoryEvidence[0].path = "does/not/exist.ts";
  assertError(hostile, "nonexistent repository path at declared commit");
});

test("hostile absolute repository path is rejected", () => {
  const hostile = clone(registry);
  firstActiveRepositoryAssertion(hostile).repositoryEvidence[0].path = "/etc/passwd";
  assertError(hostile, "unsafe repository path");
});

test("hostile parent traversal repository path is rejected", () => {
  const hostile = clone(registry);
  firstActiveRepositoryAssertion(hostile).repositoryEvidence[0].path = "../package.json";
  assertError(hostile, "unsafe repository path");
});

test("hostile backslash traversal repository path is rejected", () => {
  const hostile = clone(registry);
  firstActiveRepositoryAssertion(hostile).repositoryEvidence[0].path = "..\\package.json";
  assertError(hostile, "unsafe repository path");
});

test("hostile repository path resolving to a tree instead of a blob is rejected", () => {
  const hostile = clone(registry);
  firstActiveRepositoryAssertion(hostile).repositoryEvidence[0].path = "packages/contracts/src";
  assertError(hostile, "repository path must resolve to an exact non-symlink Git blob");
});

test("hostile recorded Git blob object ID mismatch is rejected", () => {
  const hostile = clone(registry);
  firstActiveRepositoryAssertion(hostile).repositoryEvidence[0].gitBlobObjectId = "1".repeat(40);
  assertError(hostile, "recorded Git blob object ID mismatch");
});

test("hostile automated-tested assertion without test or workflow proof is rejected", () => {
  const hostile = clone(registry);
  const repositoryEvidence = hostile.repositoryAssertions.find(entry => entry.status === "active" && entry.strength === "automated-tested");
  repositoryEvidence.repositoryEvidence = repositoryEvidence.repositoryEvidence.filter(proof => !["test", "workflow"].includes(proof.role));
  assertError(hostile, "automated-tested proof requires test or workflow Evidence");
});

test("hostile factual repository claim missing support for one declared capability is rejected", () => {
  const hostile = clone(registry);
  const claim = hostile.claims.find(entry => entry.claimId === "GAEP-CLM-001");
  claim.repositoryAssertionIds = claim.repositoryAssertionIds.filter(assertionId => assertionId !== "GAEP-REP-020");
  assertError(hostile, "repository-backed claim missing exact active support for GAEP-CAP-103");
});

test("hostile Product factual claim missing one Product by capability assertion is rejected", () => {
  const hostile = clone(registry);
  const claim = hostile.claims.find(entry => entry.claimId === "GAEP-CLM-002");
  claim.claimClass = "substantiated-bounded-fact";
  claim.capabilityIds = ["GAEP-CAP-125"];
  assertError(hostile, "claim missing exact active capability-support support for GAEP-PRD-001/GAEP-CAP-125");
});

test("hostile unrelated Evidence used by a Product factual claim is rejected", () => {
  const hostile = clone(registry);
  const claim = hostile.claims.find(entry => entry.claimId === "GAEP-CLM-002");
  claim.claimClass = "substantiated-bounded-fact";
  claim.productIds = ["GAEP-PRD-001"];
  claim.supportAssertionIds = ["GAEP-AST-060"];
  assertError(hostile, "Evidence assertion GAEP-AST-060 is outside claim Product scope");
});

test("hostile inactive repository assertion cannot support a factual claim", () => {
  const hostile = clone(registry);
  repositoryAssertion(hostile, "GAEP-REP-020").status = "invalidated";
  assertError(hostile, "inactive repository assertion GAEP-REP-020");
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
  assert.deepEqual([...schema.$defs.evidence.properties.subjectType.enum].sort(), SUBJECT_TYPES);
  assert.deepEqual([...schema.$defs.evidenceAssertion.properties.subjectType.enum].sort(), SUBJECT_TYPES);
  assert.deepEqual([...schema.$defs.repositoryEvidence.properties.role.enum].sort(), REPOSITORY_EVIDENCE_ROLES);
  assert.deepEqual([...schema.$defs.gaepMaturity.properties.maturityState.enum].sort(), GAEP_MATURITY_STATES);
  assert.equal(registry.projection.documentVersion, "0.4.1");
  assert.equal(registry.projection.capabilityCount, 30);
  assert.equal(registry.benchmarkRows.flatMap(row => row.cells).length, 450);
  assert.equal(canonicalJson(registry), fs.readFileSync(REGISTRY_PATH, "utf8"));
});
