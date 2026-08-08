import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(SCRIPT_DIR, "../..");
export const REGISTRY_PATH = path.join(ROOT, "docs/next/99_Registries_and_References/013_MARKET_EVIDENCE_AND_BENCHMARK_REGISTRY.json");
export const SCHEMA_PATH = path.join(ROOT, "docs/next/99_Registries_and_References/013_MARKET_EVIDENCE_AND_BENCHMARK_REGISTRY.schema.json");
export const METHODOLOGY_CATALOG_PATH = path.join(ROOT, "docs/next/99_Registries_and_References/011_METHODOLOGY_REFERENCE_CATALOG.json");
export const AJV_VERSION = require("ajv/package.json").version;
export const AJV_FORMATS_VERSION = require("ajv-formats/package.json").version;

export const EXPECTED_CAPABILITY_COUNT = 30;
export const REQUIRED_CAPABILITIES = [
  ["GAEP-CAP-101", "Product intent and problem discovery"],
  ["GAEP-CAP-102", "Guided lifecycle navigation and user onboarding"],
  ["GAEP-CAP-103", "Source intake and reference grounding"],
  ["GAEP-CAP-104", "Source baseline and version control"],
  ["GAEP-CAP-105", "Source provenance and lineage"],
  ["GAEP-CAP-106", "Human authority and propose/review/accept/commit separation"],
  ["GAEP-CAP-107", "Initiative definition and change boundary"],
  ["GAEP-CAP-108", "Initiative classification, risk and exposure"],
  ["GAEP-CAP-109", "Initiative applicability and lifecycle tailoring"],
  ["GAEP-CAP-110", "Business architecture, capabilities and value streams"],
  ["GAEP-CAP-111", "Domain discovery and EventStorming"],
  ["GAEP-CAP-112", "DDD strategic design, bounded contexts and context mapping"],
  ["GAEP-CAP-113", "Architecture views, quality attributes and ADRs"],
  ["GAEP-CAP-114", "Architecture-before-slice implementation sequencing"],
  ["GAEP-CAP-115", "Phase, wave and vertical-slice planning"],
  ["GAEP-CAP-116", "Tool-neutral Product Design preparation and handoff"],
  ["GAEP-CAP-117", "Architecture-bound backlog generation"],
  ["GAEP-CAP-118", "Acceptance criteria, Definition of Ready and Definition of Done"],
  ["GAEP-CAP-119", "Test design, test cases and quality assurance"],
  ["GAEP-CAP-120", "Requirements-to-design-to-code-to-test traceability"],
  ["GAEP-CAP-121", "Security, privacy, policy and compliance governance"],
  ["GAEP-CAP-122", "Data, API, event and integration contract governance"],
  ["GAEP-CAP-123", "Repository linking and implementation topology"],
  ["GAEP-CAP-124", "Cross-repository slice distribution, synchronization and drift detection"],
  ["GAEP-CAP-125", "Implementation agents and governed code generation"],
  ["GAEP-CAP-126", "CI/CD, release and deployment governance"],
  ["GAEP-CAP-127", "Runtime operations, observability, recovery and reliability"],
  ["GAEP-CAP-128", "Audit trail, evidence records and decision history"],
  ["GAEP-CAP-129", "Provider/tool neutrality, adapters and extensibility"],
  ["GAEP-CAP-130", "Enterprise administration, deployment control, data residency and portability"],
];
export const REQUIRED_CAPABILITY_NAMES = REQUIRED_CAPABILITIES.map(([, name]) => name);
export const SUPPORT_LEVELS = ["not-applicable", "partially-supported", "unknown", "unsupported-by-reviewed-evidence", "verified-supported"];
export const DELIVERY_STATES = ["announced-roadmap", "community-extension", "inference", "not-assessed", "preview-beta", "shipped"];
export const ASSERTION_STRENGTHS = ["identity-only", "partial", "verified"];
export const ASSERTION_POLARITIES = ["explicit-negative", "identity-only", "partial", "positive"];
export const ASSERTION_TYPES = ["availability", "capability-support", "explicit-negative", "identity", "landscape-classification"];
export const GAEP_MATURITY_STATES = ["candidate-proposed", "implemented-and-automated-tested", "implemented-awaiting-product-owner-acceptance", "partial", "planned-deferred-coming-soon", "unknown-not-assessed"];
export const SUBJECT_TYPES = ["excluded-identity", "methodology", "product"];
export const REPOSITORY_EVIDENCE_ROLES = ["contract", "documentation", "implementation", "test", "workflow"];

const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const duplicateValues = values => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].sort();
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const hasLongExactQuotation = value => [...String(value).matchAll(/["“]([^"”]+)["”]/g)]
  .some(match => match[1].trim().split(/\s+/).filter(Boolean).length > 25);
const GIT_COMMIT_ID = /^[a-f0-9]{40}$/;
const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const gitCommitCache = new Map();
const gitProofCache = new Map();

function runGit(repositoryRoot, args) {
  return spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
}

function verifyReachableCommit(commit, repositoryRoot, reachableFrom) {
  const key = `${repositoryRoot}\0${reachableFrom}\0${commit}`;
  if (gitCommitCache.has(key)) return gitCommitCache.get(key);
  let result;
  if (/^0+$/.test(commit)) result = "all-zero asOfCommit is prohibited";
  else if (!GIT_COMMIT_ID.test(commit)) result = "asOfCommit must be an exact 40-character lowercase Git object ID";
  else {
    const type = runGit(repositoryRoot, ["cat-file", "-t", commit]);
    if (type.status !== 0 || type.stdout.trim() !== "commit") result = "nonexistent or invalid Git commit";
    else {
      const reachable = runGit(repositoryRoot, ["merge-base", "--is-ancestor", commit, reachableFrom]);
      if (reachable.status !== 0) result = "Git commit is not permitted by reachability policy";
      else result = null;
    }
  }
  gitCommitCache.set(key, result);
  return result;
}

function unsafeRepositoryPath(repositoryPath) {
  if (typeof repositoryPath !== "string" || !repositoryPath || path.posix.isAbsolute(repositoryPath) || repositoryPath.includes("\\") || repositoryPath.startsWith(":")) return true;
  if (/[\u0000-\u001f\u007f]/.test(repositoryPath)) return true;
  const segments = repositoryPath.split("/");
  return segments.some(segment => !segment || segment === "." || segment === "..");
}

function verifyRepositoryProof(commit, proof, repositoryRoot) {
  const key = `${repositoryRoot}\0${commit}\0${proof.path}\0${proof.gitBlobObjectId}`;
  if (gitProofCache.has(key)) return gitProofCache.get(key);
  let result;
  if (unsafeRepositoryPath(proof.path)) result = "unsafe repository path";
  else if (!GIT_OBJECT_ID.test(proof.gitBlobObjectId)) result = "recorded Git blob object ID is invalid";
  else {
    const tree = runGit(repositoryRoot, ["ls-tree", "--full-tree", "-z", commit, "--", proof.path]);
    if (tree.status !== 0 || !tree.stdout.trim()) result = "nonexistent repository path at declared commit";
    else {
      const match = /^(\d+)\s+(\w+)\s+([a-f0-9]+)\t([^\0]+)\0$/.exec(tree.stdout);
      if (!match || match[4] !== proof.path || match[2] !== "blob" || match[1] === "120000") result = "repository path must resolve to an exact non-symlink Git blob";
      else if (match[3] !== proof.gitBlobObjectId) result = "recorded Git blob object ID mismatch";
      else result = null;
    }
  }
  gitProofCache.set(key, result);
  return result;
}

export function repositoryAssertionErrors(assertion, { repositoryRoot = ROOT, reachableFrom = "HEAD" } = {}) {
  if (assertion.status !== "active") return [];
  const errors = [];
  const commitError = verifyReachableCommit(assertion.asOfCommit, repositoryRoot, reachableFrom);
  if (commitError) errors.push(`${assertion.repositoryAssertionId}: ${commitError}`);
  if (!commitError) {
    for (const proof of assertion.repositoryEvidence) {
      const proofError = verifyRepositoryProof(assertion.asOfCommit, proof, repositoryRoot);
      if (proofError) errors.push(`${assertion.repositoryAssertionId}/${proof.path}: ${proofError}`);
    }
  }
  const roles = new Set(assertion.repositoryEvidence.map(proof => proof.role));
  if (assertion.strength === "automated-tested" || assertion.maturityState === "implemented-and-automated-tested") {
    if (!["contract", "implementation"].some(role => roles.has(role))) errors.push(`${assertion.repositoryAssertionId}: automated-tested proof requires implementation or contract Evidence`);
    if (!["test", "workflow"].some(role => roles.has(role))) errors.push(`${assertion.repositoryAssertionId}: automated-tested proof requires test or workflow Evidence`);
  } else if (["partial-implementation", "observed-implementation"].includes(assertion.strength)) {
    if (!["contract", "implementation"].some(role => roles.has(role))) errors.push(`${assertion.repositoryAssertionId}: implementation proof requires implementation or contract Evidence`);
  } else if (assertion.strength === "planned-document-only" && !roles.has("documentation")) {
    errors.push(`${assertion.repositoryAssertionId}: planned-document-only proof requires documentation Evidence`);
  }
  return errors;
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    const entries = value.map(canonicalize);
    return entries.every(entry => typeof entry === "string") ? sorted(entries) : entries;
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, canonicalize(entry)]));
}

export function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function assertOfflineSchema(schema) {
  const remote = [];
  const visit = (value, location) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${location}/${index}`));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      const next = `${location}/${key}`;
      if (key === "$ref" && typeof entry === "string" && !entry.startsWith("#")) remote.push(`${next}: ${entry}`);
      visit(entry, next);
    }
  };
  visit(schema, "#");
  if (remote.length > 0) throw new Error(`remote schema references are prohibited:\n${remote.join("\n")}`);
}

export function normalizeAjvErrors(errors) {
  return [...(errors ?? [])].map(error => ({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message,
    params: error.params,
  })).sort((left, right) => `${left.instancePath}|${left.schemaPath}|${left.keyword}|${left.message}`.localeCompare(`${right.instancePath}|${right.schemaPath}|${right.keyword}|${right.message}`));
}

export function formatAjvErrors(errors) {
  return normalizeAjvErrors(errors).map(error => `${error.instancePath || "/"} ${error.message} (${error.schemaPath})`).join("\n");
}

export function compileSchema(schema) {
  assertOfflineSchema(schema);
  const ajv = new Ajv2020({ allErrors: true, coerceTypes: false, messages: true, removeAdditional: false, strict: true, useDefaults: false, validateFormats: true, verbose: true });
  addFormats(ajv, { mode: "full" });
  if (!ajv.validateSchema(schema)) throw new Error(`invalid market benchmark schema:\n${formatAjvErrors(ajv.errors)}`);
  return ajv.compile(schema);
}

export function validateSchemaBinding(registry, schema) {
  const errors = [];
  if (registry.schemaId !== schema.$id) errors.push(`registry schemaId ${registry.schemaId} does not equal schema $id ${schema.$id}`);
  const version = schema?.properties?.schemaVersion?.const;
  if (registry.schemaVersion !== version) errors.push(`registry schemaVersion ${registry.schemaVersion} does not equal schema version ${version}`);
  return errors;
}

function checkIdCollection(errors, entries, idField, label) {
  const values = entries.map(entry => entry[idField]);
  const duplicates = duplicateValues(values);
  if (duplicates.length > 0) errors.push(`${label} duplicate IDs: ${duplicates.join(", ")}`);
  if (!same(values, sorted(values))) errors.push(`${label} must use canonical ID ordering`);
}

function addReferences(target, values) {
  for (const value of values ?? []) target.add(value);
}

function assertionEvidenceUsable(assertion, evidence, requiredStrength) {
  if (!evidence || assertion.status !== "active" || evidence.supersededBy.length > 0) return false;
  if (evidence.accessResult === "unavailable" || evidence.contentReviewState === "access-unavailable" || evidence.reviewDepth === "unavailable") return false;
  if (requiredStrength === "identity") {
    return ["partial", "success"].includes(evidence.accessResult)
      && ["reviewed", "reviewed-partial"].includes(evidence.contentReviewState)
      && assertion.supportStrength === "identity-only";
  }
  if (evidence.reviewDepth === "identity-only") return false;
  if (requiredStrength === "verified") {
    return evidence.accessResult === "success"
      && evidence.contentReviewState === "reviewed"
      && ["full-source-review", "substantive-page-review"].includes(evidence.reviewDepth)
      && assertion.supportStrength === "verified";
  }
  return ["partial", "success"].includes(evidence.accessResult)
    && ["reviewed", "reviewed-partial"].includes(evidence.contentReviewState)
    && ["partial", "verified"].includes(assertion.supportStrength);
}

function canonicalSubjectIdentity(record) {
  if (record?.subjectType === "product") return `product:${record.productId ?? ""}`;
  if (record?.subjectType === "methodology") return `methodology:${record.methodologyId ?? ""}`;
  if (record?.subjectType === "excluded-identity") return `excluded-identity:${record.excludedIdentityId ?? ""}`;
  return "invalid:";
}

function evidenceSubjectMatchesAssertion(evidence, assertion) {
  return canonicalSubjectIdentity(evidence) === canonicalSubjectIdentity(assertion);
}

function exactAssertion(errors, assertionById, evidenceById, assertionId, context, expected, requiredStrength = "partial") {
  const assertion = assertionById.get(assertionId);
  if (!assertion) {
    errors.push(`${context}: unknown Evidence assertion ${assertionId}`);
    return null;
  }
  if (expected.productId !== undefined && assertion.productId !== expected.productId) errors.push(`${context}: wrong-Product Evidence assertion ${assertionId}`);
  if (expected.methodologyId !== undefined && assertion.methodologyId !== expected.methodologyId) errors.push(`${context}: wrong-methodology Evidence assertion ${assertionId}`);
  if (expected.excludedIdentityId !== undefined && assertion.excludedIdentityId !== expected.excludedIdentityId) errors.push(`${context}: wrong excluded-identity Evidence assertion ${assertionId}`);
  if (expected.capabilityId !== undefined && assertion.capabilityId !== expected.capabilityId) errors.push(`${context}: wrong-capability Evidence assertion ${assertionId}`);
  if (expected.assertionTypes && !expected.assertionTypes.includes(assertion.assertionType)) errors.push(`${context}: incompatible assertion type ${assertion.assertionType} from ${assertionId}`);
  if (expected.polarities && !expected.polarities.includes(assertion.polarity)) errors.push(`${context}: incompatible assertion polarity ${assertion.polarity} from ${assertionId}`);
  const evidence = evidenceById.get(assertion.evidenceId);
  if (evidence && !evidenceSubjectMatchesAssertion(evidence, assertion)) errors.push(`${context}: Evidence subject does not match assertion subject for ${assertionId}`);
  if (!assertionEvidenceUsable(assertion, evidence, requiredStrength)) errors.push(`${context}: unusable or insufficient-strength Evidence assertion ${assertionId}`);
  return assertion;
}

export function registryMetrics(registry) {
  const countBy = (entries, field) => Object.fromEntries(Object.entries(Object.groupBy(entries, item => item[field])).sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => [key, values.length]));
  const cells = registry.benchmarkRows.flatMap(row => row.cells);
  const referencedAssertions = new Set();
  const referencedRepositoryAssertions = new Set();
  for (const product of registry.products) addReferences(referencedAssertions, product.identityAssertionIds);
  for (const methodology of registry.methodologyBindings) addReferences(referencedAssertions, methodology.assertionIds);
  for (const excluded of registry.excludedIdentities) addReferences(referencedAssertions, excluded.assertionIds);
  for (const seed of registry.seedResolutions) addReferences(referencedAssertions, seed.assertionIds);
  for (const evaluation of registry.landscapeEvaluations) addReferences(referencedAssertions, evaluation.assertionIds);
  for (const cell of cells) {
    addReferences(referencedAssertions, cell.supportAssertionIds);
    addReferences(referencedAssertions, cell.availabilityAssertionIds);
  }
  for (const claim of registry.claims) {
    addReferences(referencedAssertions, claim.supportAssertionIds);
    addReferences(referencedRepositoryAssertions, claim.repositoryAssertionIds);
  }
  for (const maturity of registry.gaepMaturity) addReferences(referencedRepositoryAssertions, maturity.repositoryAssertionIds);
  const referencedEvidence = new Set(registry.evidenceAssertions.map(assertion => assertion.evidenceId));
  return {
    categories: registry.marketCategories.length,
    capabilities: registry.capabilities.length,
    evidence: registry.evidence.length,
    evidenceAssertions: registry.evidenceAssertions.length,
    products: registry.products.length,
    methodologies: registry.methodologyBindings.length,
    landscapeClassifications: registry.landscapeEvaluations.length,
    benchmarkRows: registry.benchmarkRows.length,
    benchmarkCells: cells.length,
    expectedBenchmarkCells: registry.products.length * registry.capabilities.length,
    supportLevels: countBy(cells, "supportLevel"),
    deliveryStates: countBy(cells, "deliveryState"),
    evidenceAccess: countBy(registry.evidence, "accessResult"),
    evidenceReviewDepth: countBy(registry.evidence, "reviewDepth"),
    evidenceSubjects: countBy(registry.evidence, "subjectType"),
    assertionStrengths: countBy(registry.evidenceAssertions, "supportStrength"),
    repositoryProofRoles: countBy(registry.repositoryAssertions.filter(item => item.status === "active").flatMap(item => item.repositoryEvidence), "role"),
    repositoryProofEntries: registry.repositoryAssertions.filter(item => item.status === "active").flatMap(item => item.repositoryEvidence).length,
    repositoryProofBlobs: new Set(registry.repositoryAssertions.filter(item => item.status === "active").flatMap(item => item.repositoryEvidence.map(proof => proof.gitBlobObjectId))).size,
    repositoryProofCommits: new Set(registry.repositoryAssertions.filter(item => item.status === "active").map(item => item.asOfCommit)).size,
    gaepMaturity: countBy(registry.gaepMaturity, "maturityState"),
    claimClasses: countBy(registry.claims, "claimClass"),
    unknownCells: cells.filter(cell => cell.supportLevel === "unknown").length,
    researchDebt: registry.researchDebt.length,
    orphanEvidence: registry.evidence.filter(item => !referencedEvidence.has(item.evidenceId)).length,
    orphanAssertions: registry.evidenceAssertions.filter(item => item.status === "active" && !referencedAssertions.has(item.assertionId)).length,
    orphanRepositoryAssertions: registry.repositoryAssertions.filter(item => item.status === "active" && !referencedRepositoryAssertions.has(item.repositoryAssertionId)).length,
  };
}

export function semanticErrors(registry, { methodologyCatalog = readJson(METHODOLOGY_CATALOG_PATH), rawText, repositoryRoot = ROOT, reachableFrom = "HEAD" } = {}) {
  const errors = [];
  const collections = [
    [registry.marketCategories, "categoryId", "marketCategories"],
    [registry.capabilities, "capabilityId", "capabilities"],
    [registry.evidence, "evidenceId", "evidence"],
    [registry.evidenceAssertions, "assertionId", "evidenceAssertions"],
    [registry.repositoryAssertions, "repositoryAssertionId", "repositoryAssertions"],
    [registry.methodologyBindings, "methodologyId", "methodologyBindings"],
    [registry.excludedIdentities, "excludedIdentityId", "excludedIdentities"],
    [registry.seedResolutions, "seedId", "seedResolutions"],
    [registry.products, "productId", "products"],
    [registry.claims, "claimId", "claims"],
    [registry.scenarios, "scenarioId", "scenarios"],
    [registry.proofOfValueMetrics, "metricId", "proofOfValueMetrics"],
    [registry.researchDebt, "debtId", "researchDebt"],
  ];
  for (const [entries, field, label] of collections) checkIdCollection(errors, entries, field, label);

  const categoryIds = new Set(registry.marketCategories.map(entry => entry.categoryId));
  const capabilityIds = new Set(registry.capabilities.map(entry => entry.capabilityId));
  const evidenceIds = new Set(registry.evidence.map(entry => entry.evidenceId));
  const productIds = new Set(registry.products.map(entry => entry.productId));
  const methodologyIds = new Set(registry.methodologyBindings.map(entry => entry.methodologyId));
  const excludedIdentityIds = new Set(registry.excludedIdentities.map(entry => entry.excludedIdentityId));
  const assertionById = new Map(registry.evidenceAssertions.map(entry => [entry.assertionId, entry]));
  const evidenceById = new Map(registry.evidence.map(entry => [entry.evidenceId, entry]));
  const repositoryAssertionById = new Map(registry.repositoryAssertions.map(entry => [entry.repositoryAssertionId, entry]));
  const methodologyByReferenceId = new Map(methodologyCatalog.references.map(reference => [reference.referenceId, reference]));
  const canonicalSubjectNames = new Map([
    ...registry.products.map(product => [`product:${product.productId}`, product.canonicalName]),
    ...registry.methodologyBindings.map(methodology => [`methodology:${methodology.methodologyId}`, methodology.canonicalName]),
    ...registry.excludedIdentities.map(excluded => [`excluded-identity:${excluded.excludedIdentityId}`, excluded.canonicalName]),
  ]);

  if (registry.marketCategories.length < 5) errors.push("research saturation requires at least five market categories");
  if (registry.products.length < 15) errors.push("research coverage requires at least fifteen evaluated current Product/project identities");
  if (registry.capabilities.length !== EXPECTED_CAPABILITY_COUNT) errors.push(`capability taxonomy must contain exactly ${EXPECTED_CAPABILITY_COUNT} dimensions`);
  const actualCapabilities = registry.capabilities.map(({ capabilityId, name }) => [capabilityId, name]);
  if (!same(actualCapabilities, REQUIRED_CAPABILITIES)) errors.push("capability taxonomy must use the exact canonical 30 IDs, names, and ordering");

  const migration = registry.capabilityMigration;
  const legacyIds = migration.legacyCapabilities.map(entry => entry.legacyCapabilityId);
  const expectedLegacyIds = Array.from({ length: 17 }, (_, index) => `GAEP-CAP-${String(index + 1).padStart(3, "0")}`);
  const currentCapabilityIds = new Set(REQUIRED_CAPABILITIES.map(([id]) => id));
  if (!same(legacyIds, expectedLegacyIds)) errors.push("capability migration must preserve all 17 legacy IDs in canonical order");
  if (migration.sourceRegistryVersions.join(",") !== "0.1.0,0.1.1" || migration.targetRegistryVersion !== "0.2.0") errors.push("capability migration has an incorrect source or target version binding");
  if (legacyIds.some(id => currentCapabilityIds.has(id))) errors.push("legacy capability IDs must not be repurposed in the corrected taxonomy");
  const targetIds = migration.legacyCapabilities.flatMap(entry => entry.targetCapabilityIds);
  for (const targetId of targetIds) if (!currentCapabilityIds.has(targetId)) errors.push(`capability migration references unknown target ${targetId}`);
  for (const entry of migration.legacyCapabilities) {
    const expectedType = entry.targetCapabilityIds.length > 1 ? "one-to-many" : "one-to-one";
    if (entry.migrationType !== expectedType) errors.push(`${entry.legacyCapabilityId}: migration type does not match target cardinality`);
    if (entry.migrationType === "one-to-many" && entry.humanReviewRequired !== true) errors.push(`${entry.legacyCapabilityId}: one-to-many migration requires human review`);
  }
  const newCapabilityIds = migration.newCapabilities.map(entry => entry.capabilityId);
  if (!same(newCapabilityIds, sorted(newCapabilityIds)) || new Set(newCapabilityIds).size !== newCapabilityIds.length) errors.push("new capability migration entries must be unique and canonically ordered");
  for (const capabilityId of newCapabilityIds) if (!currentCapabilityIds.has(capabilityId)) errors.push(`capability migration declares unknown new capability ${capabilityId}`);

  for (const evidence of registry.evidence) {
    const subjectTargets = [evidence.productId, evidence.methodologyId, evidence.excludedIdentityId].filter(Boolean);
    if (subjectTargets.length !== 1) errors.push(`${evidence.evidenceId}: Evidence must identify exactly one canonical subject`);
    if (evidence.subjectType === "product") {
      if (!evidence.productId || !productIds.has(evidence.productId) || evidence.methodologyId !== null || evidence.excludedIdentityId !== null) errors.push(`${evidence.evidenceId}: invalid Product Evidence subject`);
    } else if (evidence.subjectType === "methodology") {
      if (!evidence.methodologyId || !methodologyIds.has(evidence.methodologyId) || evidence.productId !== null || evidence.excludedIdentityId !== null) errors.push(`${evidence.evidenceId}: invalid methodology Evidence subject`);
    } else if (evidence.subjectType === "excluded-identity") {
      if (!evidence.excludedIdentityId || !excludedIdentityIds.has(evidence.excludedIdentityId) || evidence.productId !== null || evidence.methodologyId !== null) errors.push(`${evidence.evidenceId}: invalid excluded-identity Evidence subject`);
    }
    if (!evidence.officialUri.startsWith("https://")) errors.push(`${evidence.evidenceId}: official URI must use HTTPS`);
    for (const field of ["accessedAt", "asOfDate", "nextReviewAt"]) if (!validDate(evidence[field])) errors.push(`${evidence.evidenceId}: ${field} is not a possible ISO date`);
    if (evidence.accessedAt > registry.researchAsOf || evidence.asOfDate > registry.researchAsOf) errors.push(`${evidence.evidenceId}: evidence chronology exceeds researchAsOf`);
    if (evidence.nextReviewAt < evidence.asOfDate) errors.push(`${evidence.evidenceId}: next review precedes evidence as-of date`);
    if (evidence.accessResult === "unavailable" && (evidence.contentReviewState !== "access-unavailable" || evidence.reviewDepth !== "unavailable")) errors.push(`${evidence.evidenceId}: unavailable Evidence must remain access-unavailable with unavailable review depth`);
    if (evidence.sourceDigest && evidence.rightsStatus !== "captured-with-permission") errors.push(`${evidence.evidenceId}: digest requires exact captured bytes and permission state`);
    for (const successor of evidence.supersededBy) {
      const target = evidenceById.get(successor);
      if (!target?.supersedes.includes(evidence.evidenceId)) errors.push(`${evidence.evidenceId}: missing reciprocal supersession from ${successor}`);
    }
    for (const predecessor of evidence.supersedes) {
      const target = evidenceById.get(predecessor);
      if (!target?.supersededBy.includes(evidence.evidenceId)) errors.push(`${evidence.evidenceId}: missing reciprocal supersession to ${predecessor}`);
    }
  }

  for (const [index, assertion] of registry.evidenceAssertions.entries()) {
    if (assertion.sequence !== index + 1) errors.push(`${assertion.assertionId}: Evidence assertion sequence is noncanonical`);
    if (!evidenceIds.has(assertion.evidenceId)) errors.push(`${assertion.assertionId}: unknown Evidence ${assertion.evidenceId}`);
    const boundEvidence = evidenceById.get(assertion.evidenceId);
    if (boundEvidence && !evidenceSubjectMatchesAssertion(boundEvidence, assertion)) errors.push(`${assertion.assertionId}: Evidence subject does not match assertion subject`);
    if (!assertion.proposition.trim()) errors.push(`${assertion.assertionId}: supported proposition is empty`);
    if (assertion.reviewedAt > registry.researchAsOf || assertion.asOfDate > registry.researchAsOf) errors.push(`${assertion.assertionId}: stale or future assertion binding`);
    if (assertion.status === "active" && assertion.asOfDate !== registry.researchAsOf) errors.push(`${assertion.assertionId}: stale assertion does not match registry snapshot`);
    const targets = [assertion.productId, assertion.methodologyId, assertion.excludedIdentityId].filter(Boolean);
    if (targets.length !== 1) errors.push(`${assertion.assertionId}: Evidence assertion must identify exactly one subject`);
    if (assertion.subjectType === "product" && (!assertion.productId || !productIds.has(assertion.productId) || assertion.methodologyId !== null || assertion.excludedIdentityId !== null)) errors.push(`${assertion.assertionId}: invalid Product assertion subject`);
    if (assertion.subjectType === "methodology" && (!assertion.methodologyId || !methodologyIds.has(assertion.methodologyId) || assertion.productId !== null || assertion.excludedIdentityId !== null)) errors.push(`${assertion.assertionId}: invalid methodology assertion subject`);
    if (assertion.subjectType === "excluded-identity" && (!assertion.excludedIdentityId || !excludedIdentityIds.has(assertion.excludedIdentityId) || assertion.productId !== null || assertion.methodologyId !== null)) errors.push(`${assertion.assertionId}: invalid excluded-identity assertion subject`);
    const featureAssertion = ["availability", "capability-support", "explicit-negative"].includes(assertion.assertionType);
    if (assertion.status === "active" && featureAssertion && (!assertion.capabilityId || !capabilityIds.has(assertion.capabilityId))) errors.push(`${assertion.assertionId}: feature assertion requires an exact current capability`);
    if (!featureAssertion && assertion.capabilityId !== null) errors.push(`${assertion.assertionId}: identity or landscape assertion must not masquerade as feature support`);
    if (featureAssertion && (assertion.supportStrength === "identity-only" || assertion.polarity === "identity-only")) errors.push(`${assertion.assertionId}: identity-only Evidence used for feature support`);
    if (assertion.assertionType === "identity" && (assertion.supportStrength !== "identity-only" || assertion.polarity !== "identity-only")) errors.push(`${assertion.assertionId}: identity assertion must remain identity-only`);
    if (assertion.assertionType === "explicit-negative" && assertion.polarity !== "explicit-negative") errors.push(`${assertion.assertionId}: explicit-negative assertion has incompatible polarity`);
    if (assertion.status === "active" && assertion.supersededBy.length > 0) errors.push(`${assertion.assertionId}: active assertion is superseded`);
    for (const successor of assertion.supersededBy) {
      const target = assertionById.get(successor);
      if (!target?.supersedes.includes(assertion.assertionId)) errors.push(`${assertion.assertionId}: missing reciprocal assertion supersession from ${successor}`);
    }
    for (const predecessor of assertion.supersedes) {
      const target = assertionById.get(predecessor);
      if (!target?.supersededBy.includes(assertion.assertionId)) errors.push(`${assertion.assertionId}: missing reciprocal assertion supersession to ${predecessor}`);
    }
  }

  for (const methodology of registry.methodologyBindings) {
    for (const capabilityId of methodology.relevantCapabilityIds) if (!capabilityIds.has(capabilityId)) errors.push(`${methodology.methodologyId}: unknown relevant capability ${capabilityId}`);
    if (methodology.identityType === "p01-catalog-reference") {
      if (!methodology.p01ReferenceId || !methodologyByReferenceId.has(methodology.p01ReferenceId)) errors.push(`${methodology.methodologyId}: unknown P01 methodology reference`);
      if (methodology.assertionIds.length > 0) errors.push(`${methodology.methodologyId}: P01 methodology truth must not be duplicated as P02 Evidence assertions`);
    } else {
      for (const assertionId of methodology.assertionIds) exactAssertion(errors, assertionById, evidenceById, assertionId, methodology.methodologyId, { methodologyId: methodology.methodologyId, capabilityId: null, assertionTypes: ["identity"] }, "identity");
    }
  }

  for (const excluded of registry.excludedIdentities) {
    for (const assertionId of excluded.assertionIds) exactAssertion(errors, assertionById, evidenceById, assertionId, excluded.excludedIdentityId, { excludedIdentityId: excluded.excludedIdentityId, capabilityId: null, assertionTypes: ["identity"] }, "identity");
    if (registry.products.some(product => product.canonicalName === excluded.canonicalName || product.officialUri === excluded.officialUri)) errors.push(`${excluded.excludedIdentityId}: excluded identity must not remain in the benchmark Product matrix`);
  }

  for (const seed of registry.seedResolutions) {
    const seedText = [seed.selectedIdentity, seed.rationale, ...seed.ambiguities].filter(Boolean).join(" ").toLocaleLowerCase("en");
    for (const assertionId of seed.assertionIds) {
      const assertion = assertionById.get(assertionId);
      if (!assertion) errors.push(`${seed.seedId}: unknown Evidence assertion ${assertionId}`);
      else {
        const identity = canonicalSubjectIdentity(assertion);
        const canonicalName = canonicalSubjectNames.get(identity)?.toLocaleLowerCase("en");
        const displaySubject = evidenceById.get(assertion.evidenceId)?.subject?.toLocaleLowerCase("en");
        if ((!canonicalName || !seedText.includes(canonicalName)) && (!displaySubject || !seedText.includes(displaySubject))) errors.push(`${seed.seedId}: Evidence assertion ${assertionId} is outside resolved seed subject scope`);
        exactAssertion(errors, assertionById, evidenceById, assertionId, seed.seedId, {
          productId: assertion.productId,
          methodologyId: assertion.methodologyId,
          excludedIdentityId: assertion.excludedIdentityId,
          capabilityId: null,
          assertionTypes: ["identity"],
        }, "identity");
      }
    }
    if (seed.ambiguities.length > 0 && seed.resolutionState.startsWith("resolved-") && (!seed.selectedIdentity || !/ambig|select|separate|distinct/i.test(seed.rationale))) errors.push(`${seed.seedId}: ambiguous identity was silently resolved`);
    if (seed.resolutionState === "methodology-framework" && registry.products.some(product => product.canonicalName === seed.selectedIdentity)) errors.push(`${seed.seedId}: methodology classified as Product`);
  }

  for (const product of registry.products) {
    for (const categoryId of product.categoryIds) if (!categoryIds.has(categoryId)) errors.push(`${product.productId}: unknown category ${categoryId}`);
    if (!product.officialUri.startsWith("https://")) errors.push(`${product.productId}: official URI must use HTTPS`);
    if (product.status === "active-current" && product.knownUnknowns.some(value => /discontinued|superseded/i.test(value))) errors.push(`${product.productId}: contradictory Product status`);
    if (product.identityAssertionIds.length === 0) errors.push(`${product.productId}: Product identity requires exact identity assertion`);
    for (const assertionId of product.identityAssertionIds) exactAssertion(errors, assertionById, evidenceById, assertionId, product.productId, { productId: product.productId, capabilityId: null, assertionTypes: ["identity"] }, "identity");
  }
  const represented = new Set(registry.products.flatMap(product => product.categoryIds));
  if (represented.size < 5) errors.push("Product landscape represents fewer than five market categories");

  const evaluationIds = registry.landscapeEvaluations.map(entry => entry.productId);
  if (!same(evaluationIds, sorted(evaluationIds))) errors.push("landscapeEvaluations must use canonical Product ordering");
  if (!same(evaluationIds, sorted([...productIds]))) errors.push("landscapeEvaluations must classify every Product exactly once");
  for (const evaluation of registry.landscapeEvaluations) {
    if (!productIds.has(evaluation.productId)) errors.push(`landscapeEvaluation has unknown Product ${evaluation.productId}`);
    if (evaluation.assertionIds.length === 0) errors.push(`${evaluation.productId}: landscape classification requires exact assertion`);
    for (const assertionId of evaluation.assertionIds) exactAssertion(errors, assertionById, evidenceById, assertionId, `${evaluation.productId} landscape`, { productId: evaluation.productId, capabilityId: null, assertionTypes: ["landscape-classification"] }, "partial");
  }

  const rowIds = registry.benchmarkRows.map(row => row.productId);
  if (!same(rowIds, sorted(rowIds))) errors.push("benchmarkRows must use canonical Product ordering");
  if (!same(rowIds, sorted([...productIds]))) errors.push("benchmarkRows must cover every Product exactly once");
  for (const row of registry.benchmarkRows) {
    if (!productIds.has(row.productId)) errors.push(`benchmarkRow has unknown Product ${row.productId}`);
    const cellIds = row.cells.map(cell => cell.capabilityId);
    if (!same(cellIds, sorted(cellIds))) errors.push(`${row.productId}: benchmark cells must use canonical capability ordering`);
    if (!same(cellIds, sorted([...capabilityIds]))) errors.push(`${row.productId}: benchmark must contain every capability exactly once`);
    for (const cell of row.cells) {
      const context = `${row.productId}/${cell.capabilityId}`;
      if (cell.asOfDate !== registry.researchAsOf) errors.push(`${context}: stale or mismatched as-of binding`);
      if (cell.supportLevel === "verified-supported") {
        if (cell.supportAssertionIds.length === 0) errors.push(`${context}: verified support requires explicit positive assertion`);
        for (const assertionId of cell.supportAssertionIds) exactAssertion(errors, assertionById, evidenceById, assertionId, context, { productId: row.productId, capabilityId: cell.capabilityId, assertionTypes: ["capability-support"], polarities: ["positive"] }, "verified");
      } else if (cell.supportLevel === "partially-supported") {
        if (cell.supportAssertionIds.length === 0) errors.push(`${context}: partial support requires explicit partial or bounded positive assertion`);
        for (const assertionId of cell.supportAssertionIds) exactAssertion(errors, assertionById, evidenceById, assertionId, context, { productId: row.productId, capabilityId: cell.capabilityId, assertionTypes: ["capability-support"], polarities: ["partial", "positive"] }, "partial");
      } else if (cell.supportLevel === "unsupported-by-reviewed-evidence") {
        if (cell.supportAssertionIds.length === 0) errors.push(`${context}: unsupported conclusion requires explicit reviewed negative assertion`);
        for (const assertionId of cell.supportAssertionIds) exactAssertion(errors, assertionById, evidenceById, assertionId, context, { productId: row.productId, capabilityId: cell.capabilityId, assertionTypes: ["explicit-negative"], polarities: ["explicit-negative"] }, "verified");
        if (/no public|not documented|missing documentation|absence/i.test(`${cell.rationale} ${cell.limitation}`)) errors.push(`${context}: missing public evidence cannot prove unsupported`);
      } else if (cell.supportLevel === "unknown") {
        if (cell.supportAssertionIds.length > 0 || cell.availabilityAssertionIds.length > 0) errors.push(`${context}: unknown must not masquerade as an evidence-supported conclusion`);
        if (!/not evidence of absence/i.test(cell.limitation)) errors.push(`${context}: unknown must remain explicit and must not be converted to false/no`);
        if (cell.deliveryState !== "not-assessed") errors.push(`${context}: unknown converted to a delivery conclusion`);
      } else if (cell.supportLevel === "not-applicable") {
        if (!cell.applicabilityRationale?.trim()) errors.push(`${context}: not-applicable requires an explicit applicability rationale`);
        if (cell.supportAssertionIds.length > 0) errors.push(`${context}: not-applicable must not carry capability support assertions`);
      }

      if (cell.deliveryState === "shipped") {
        if (cell.availabilityAssertionIds.length === 0) errors.push(`${context}: shipped state requires official availability assertion`);
        const strength = cell.supportLevel === "verified-supported" ? "verified" : "partial";
        for (const assertionId of cell.availabilityAssertionIds) {
          const assertion = exactAssertion(errors, assertionById, evidenceById, assertionId, context, { productId: row.productId, capabilityId: cell.capabilityId, assertionTypes: ["availability"], polarities: ["partial", "positive"] }, strength);
          if (assertion?.deliveryState !== "shipped") errors.push(`${context}: availability assertion ${assertionId} does not establish shipped state`);
          if (assertion && evidenceById.get(assertion.evidenceId)?.sourceType === "primary-research") errors.push(`${context}: shipped state requires official vendor/steward availability Evidence`);
        }
      } else if (!["inference", "not-assessed"].includes(cell.deliveryState)) {
        if (cell.availabilityAssertionIds.length === 0) errors.push(`${context}: ${cell.deliveryState} requires matching availability assertion`);
        for (const assertionId of cell.availabilityAssertionIds) {
          const assertion = exactAssertion(errors, assertionById, evidenceById, assertionId, context, { productId: row.productId, capabilityId: cell.capabilityId, assertionTypes: ["availability"] }, "partial");
          if (assertion?.deliveryState !== cell.deliveryState) errors.push(`${context}: delivery-state assertion ${assertionId} is mismatched`);
        }
      } else if (cell.availabilityAssertionIds.length > 0 && cell.deliveryState === "not-assessed") {
        errors.push(`${context}: not-assessed delivery must not carry availability conclusions`);
      }
    }
  }

  for (const [index, assertion] of registry.repositoryAssertions.entries()) {
    if (assertion.sequence !== index + 1) errors.push(`${assertion.repositoryAssertionId}: repository assertion sequence is noncanonical`);
    if (assertion.status === "active" && !capabilityIds.has(assertion.capabilityId)) errors.push(`${assertion.repositoryAssertionId}: unknown current capability ${assertion.capabilityId}`);
    if (assertion.status === "active" && assertion.supersededBy.length > 0) errors.push(`${assertion.repositoryAssertionId}: active repository assertion is superseded`);
    const proofOrder = assertion.repositoryEvidence.map(proof => `${proof.path}\0${proof.role}`);
    if (!same(proofOrder, sorted(proofOrder))) errors.push(`${assertion.repositoryAssertionId}: repository Evidence entries must use canonical path and role ordering`);
    if (duplicateValues(proofOrder).length > 0) errors.push(`${assertion.repositoryAssertionId}: duplicate repository Evidence entries`);
    errors.push(...repositoryAssertionErrors(assertion, { repositoryRoot, reachableFrom }));
    for (const successor of assertion.supersededBy) {
      const target = repositoryAssertionById.get(successor);
      if (!target?.supersedes.includes(assertion.repositoryAssertionId)) errors.push(`${assertion.repositoryAssertionId}: missing reciprocal repository supersession from ${successor}`);
    }
    for (const predecessor of assertion.supersedes) {
      const target = repositoryAssertionById.get(predecessor);
      if (!target?.supersededBy.includes(assertion.repositoryAssertionId)) errors.push(`${assertion.repositoryAssertionId}: missing reciprocal repository supersession to ${predecessor}`);
    }
  }
  const maturityIds = registry.gaepMaturity.map(entry => entry.capabilityId);
  if (!same(maturityIds, sorted(maturityIds))) errors.push("gaepMaturity must use canonical capability ordering");
  if (!same(maturityIds, sorted([...capabilityIds]))) errors.push("gaepMaturity must cover every capability exactly once");
  for (const maturity of registry.gaepMaturity) {
    if (maturity.repositoryAssertionIds.length === 0) errors.push(`${maturity.capabilityId}: GAEP maturity requires exact repository assertion`);
    for (const assertionId of maturity.repositoryAssertionIds) {
      const assertion = repositoryAssertionById.get(assertionId);
      if (!assertion) errors.push(`${maturity.capabilityId}: unknown repository assertion ${assertionId}`);
      else {
        if (assertion.status !== "active") errors.push(`${maturity.capabilityId}: inactive repository assertion ${assertionId} cannot support current GAEP maturity`);
        if (assertion.capabilityId !== maturity.capabilityId) errors.push(`${maturity.capabilityId}: wrong-capability repository assertion ${assertionId}`);
        if (assertion.maturityState !== maturity.maturityState) errors.push(`${maturity.capabilityId}: repository assertion maturity mismatch`);
      }
    }
    if (maturity.maturityState === "planned-deferred-coming-soon" && /implemented|shipped|current capability/i.test(maturity.rationale)) errors.push(`${maturity.capabilityId}: GAEP roadmap capability presented as shipped`);
  }

  const strong = /(better than|superior to|enterprise-ready|production-ready|\bsecure\b|\bcompliant\b|\bcertified\b|guarantees? quality|\bROI\b|time savings?|cost savings?|adoption rate)/i;
  for (const claim of registry.claims) {
    if (claim.asOfDate !== registry.researchAsOf) errors.push(`${claim.claimId}: stale claim snapshot binding`);
    for (const [field, values] of [["productIds", claim.productIds], ["capabilityIds", claim.capabilityIds], ["supportAssertionIds", claim.supportAssertionIds], ["repositoryAssertionIds", claim.repositoryAssertionIds]]) {
      const duplicates = duplicateValues(values);
      if (duplicates.length > 0) errors.push(`${claim.claimId}: duplicate ${field} bindings: ${duplicates.join(", ")}`);
    }
    for (const productId of claim.productIds) if (!productIds.has(productId)) errors.push(`${claim.claimId}: unknown Product ${productId}`);
    for (const capabilityId of claim.capabilityIds) if (!capabilityIds.has(capabilityId)) errors.push(`${claim.claimId}: unknown capability ${capabilityId}`);
    for (const assertionId of claim.supportAssertionIds) if (!assertionById.has(assertionId)) errors.push(`${claim.claimId}: unknown Evidence assertion ${assertionId}`);
    for (const assertionId of claim.repositoryAssertionIds) if (!repositoryAssertionById.has(assertionId)) errors.push(`${claim.claimId}: unknown repository assertion ${assertionId}`);
    if (["substantiated-bounded-fact", "evidence-bounded-comparison"].includes(claim.claimClass) && claim.supportAssertionIds.length === 0 && claim.repositoryAssertionIds.length === 0) errors.push(`${claim.claimId}: factual/comparative claim has no exact support assertion`);
    const claimAssertions = claim.supportAssertionIds.map(id => assertionById.get(id)).filter(Boolean);
    for (const assertionId of claim.supportAssertionIds) {
      const assertion = assertionById.get(assertionId);
      if (assertion && !assertionEvidenceUsable(assertion, evidenceById.get(assertion.evidenceId), assertion.supportStrength === "verified" ? "verified" : "partial")) errors.push(`${claim.claimId}: unrelated or unusable Evidence assertion ${assertionId}`);
      if (assertion && (assertion.subjectType !== "product" || !assertion.productId || !claim.productIds.includes(assertion.productId))) errors.push(`${claim.claimId}: Evidence assertion ${assertionId} is outside claim Product scope`);
      if (assertion && claim.capabilityIds.length > 0 && !claim.capabilityIds.includes(assertion.capabilityId)) errors.push(`${claim.claimId}: Evidence assertion ${assertionId} is outside claim capability scope`);
    }
    if (["substantiated-bounded-fact", "evidence-bounded-comparison"].includes(claim.claimClass) && claim.productIds.length > 0) {
      const requiredAssertionType = claim.capabilityIds.length > 0 ? "capability-support" : claim.claimClass === "evidence-bounded-comparison" ? "landscape-classification" : "identity";
      for (const productId of claim.productIds) {
        if (claim.capabilityIds.length > 0) {
          for (const capabilityId of claim.capabilityIds) {
            const matches = claimAssertions.filter(assertion => assertion.status === "active" && assertion.productId === productId && assertion.capabilityId === capabilityId && assertion.assertionType === requiredAssertionType);
            if (matches.length === 0) errors.push(`${claim.claimId}: claim missing exact active ${requiredAssertionType} support for ${productId}/${capabilityId}`);
          }
        } else {
          const matches = claimAssertions.filter(assertion => assertion.status === "active" && assertion.productId === productId && assertion.capabilityId === null && assertion.assertionType === requiredAssertionType);
          if (matches.length === 0) errors.push(`${claim.claimId}: claim missing exact active ${requiredAssertionType} support for ${productId}`);
        }
      }
    }
    if (claim.productIds.length === 0 && claim.supportAssertionIds.length > 0) errors.push(`${claim.claimId}: Product Evidence assertions require an exact claim Product scope`);
    for (const assertionId of claim.repositoryAssertionIds) {
      const assertion = repositoryAssertionById.get(assertionId);
      if (assertion && assertion.status !== "active") errors.push(`${claim.claimId}: inactive repository assertion ${assertionId}`);
      if (assertion && claim.capabilityIds.length > 0 && !claim.capabilityIds.includes(assertion.capabilityId)) errors.push(`${claim.claimId}: repository assertion ${assertionId} is outside claim capability scope`);
      if (assertion?.status === "active" && assertion.maturityState === "planned-deferred-coming-soon" && !/\b(plan(?:s|ned)?|future|roadmap|deferred|coming soon)\b/i.test(claim.wording)) errors.push(`${claim.claimId}: planned repository capability is presented as a current fact`);
    }
    if (claim.repositoryAssertionIds.length > 0) {
      for (const capabilityId of claim.capabilityIds) {
        if (!claim.repositoryAssertionIds.some(assertionId => {
          const assertion = repositoryAssertionById.get(assertionId);
          return assertion?.status === "active" && assertion.capabilityId === capabilityId;
        })) errors.push(`${claim.claimId}: repository-backed claim missing exact active support for ${capabilityId}`);
      }
      if (claim.capabilityIds.length === 0) errors.push(`${claim.claimId}: repository-backed claim requires exact capability scope`);
    }
    if (strong.test(claim.wording) && claim.disposition !== "prohibited") errors.push(`${claim.claimId}: unsupported strong claim is not prohibited`);
    if (hasLongExactQuotation(claim.wording)) errors.push(`${claim.claimId}: exact quotation exceeds the machine-enforced 25-word boundary`);
    if (claim.approvalState !== "not-approved" || claim.publicationState !== "not-published") errors.push(`${claim.claimId}: unauthorized Approved/Published state`);
  }

  for (const scenario of registry.scenarios) {
    for (const capabilityId of scenario.applicableCapabilityIds) if (!capabilityIds.has(capabilityId)) errors.push(`${scenario.scenarioId}: unknown capability ${capabilityId}`);
    if (scenario.rankingPolicy !== "no-total-score-preserve-unknowns") errors.push(`${scenario.scenarioId}: invented score/ranking policy`);
  }
  for (const categoryId of registry.researchCoverage.searchedCategoryIds) if (!categoryIds.has(categoryId)) errors.push(`researchCoverage: unknown searched category ${categoryId}`);

  const referencedAssertions = new Set();
  const referencedRepositoryAssertions = new Set();
  for (const product of registry.products) addReferences(referencedAssertions, product.identityAssertionIds);
  for (const methodology of registry.methodologyBindings) addReferences(referencedAssertions, methodology.assertionIds);
  for (const excluded of registry.excludedIdentities) addReferences(referencedAssertions, excluded.assertionIds);
  for (const seed of registry.seedResolutions) addReferences(referencedAssertions, seed.assertionIds);
  for (const evaluation of registry.landscapeEvaluations) addReferences(referencedAssertions, evaluation.assertionIds);
  for (const row of registry.benchmarkRows) for (const cell of row.cells) {
    addReferences(referencedAssertions, cell.supportAssertionIds);
    addReferences(referencedAssertions, cell.availabilityAssertionIds);
  }
  for (const claim of registry.claims) {
    addReferences(referencedAssertions, claim.supportAssertionIds);
    addReferences(referencedRepositoryAssertions, claim.repositoryAssertionIds);
  }
  for (const maturity of registry.gaepMaturity) addReferences(referencedRepositoryAssertions, maturity.repositoryAssertionIds);
  for (const assertion of registry.evidenceAssertions) if (assertion.status === "active" && !referencedAssertions.has(assertion.assertionId)) errors.push(`${assertion.assertionId}: orphan active Evidence assertion`);
  for (const assertion of registry.repositoryAssertions) if (assertion.status === "active" && !referencedRepositoryAssertions.has(assertion.repositoryAssertionId)) errors.push(`${assertion.repositoryAssertionId}: orphan active repository assertion`);
  const referencedEvidence = new Set(registry.evidenceAssertions.map(assertion => assertion.evidenceId));
  for (const evidenceId of evidenceIds) if (!referencedEvidence.has(evidenceId)) errors.push(`${evidenceId}: orphan Evidence`);

  const methodologyNames = new Set(methodologyCatalog.references.map(reference => reference.canonicalName.toLowerCase()));
  for (const product of registry.products) if (methodologyNames.has(product.canonicalName.toLowerCase())) errors.push(`${product.productId}: Product duplicates GAEP-REG-011 methodology truth`);
  if (registry.approval.state !== "not-approved" || registry.approval.publicationState !== "not-published") errors.push("registry has unauthorized Approved/Published state");
  if (registry.projection.registryVersion !== registry.version) errors.push("projection registryVersion differs from canonical registry version");
  if (registry.projection.documentVersion !== "0.4.1") errors.push("projection documentVersion differs from the corrected projection contract");
  if (registry.projection.capabilityCount !== registry.capabilities.length) errors.push("old or stale capability projection presented as current");
  if (rawText && rawText !== canonicalJson(registry)) errors.push("registry serialization is noncanonical");
  if (rawText && /"(?:totalScore|winner|rank)"\s*:/.test(rawText)) errors.push("invented total score or ranking field is prohibited");
  return sorted([...new Set(errors)]);
}

export function validateRegistryFiles({ registryPath = REGISTRY_PATH, schemaPath = SCHEMA_PATH, methodologyCatalogPath = METHODOLOGY_CATALOG_PATH } = {}) {
  const rawText = fs.readFileSync(registryPath, "utf8");
  const registry = JSON.parse(rawText);
  const schema = readJson(schemaPath);
  const methodologyCatalog = readJson(methodologyCatalogPath);
  const bindingErrors = validateSchemaBinding(registry, schema);
  const validate = compileSchema(schema);
  const schemaValid = validate(registry);
  const errors = [
    ...bindingErrors,
    ...(!schemaValid ? normalizeAjvErrors(validate.errors).map(error => `${error.instancePath || "/"} ${error.message}`) : []),
    ...(schemaValid ? semanticErrors(registry, { methodologyCatalog, rawText }) : []),
  ];
  return { valid: errors.length === 0, errors: sorted([...new Set(errors)]), registry, schema };
}

export function validateCanonicalRegistry() {
  return validateRegistryFiles();
}
