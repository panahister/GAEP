import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
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

export const EXPECTED_CAPABILITY_COUNT = 17;
export const SUPPORT_LEVELS = ["not-applicable", "partially-supported", "unknown", "unsupported-by-reviewed-evidence", "verified-supported"];
export const DELIVERY_STATES = ["announced-roadmap", "community-extension", "inference", "not-assessed", "preview-beta", "shipped"];
export const ASSERTION_STRENGTHS = ["identity-only", "partial", "verified"];
export const ASSERTION_POLARITIES = ["explicit-negative", "identity-only", "partial", "positive"];
export const ASSERTION_TYPES = ["availability", "capability-support", "explicit-negative", "identity", "landscape-classification"];
export const GAEP_MATURITY_STATES = ["candidate-proposed", "implemented-and-automated-tested", "implemented-awaiting-product-owner-acceptance", "partial", "planned-deferred-coming-soon", "unknown-not-assessed"];

const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const duplicateValues = values => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].sort();
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const hasLongExactQuotation = value => [...String(value).matchAll(/["“]([^"”]+)["”]/g)]
  .some(match => match[1].trim().split(/\s+/).filter(Boolean).length > 25);

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
    assertionStrengths: countBy(registry.evidenceAssertions, "supportStrength"),
    gaepMaturity: countBy(registry.gaepMaturity, "maturityState"),
    claimClasses: countBy(registry.claims, "claimClass"),
    unknownCells: cells.filter(cell => cell.supportLevel === "unknown").length,
    researchDebt: registry.researchDebt.length,
    orphanEvidence: registry.evidence.filter(item => !referencedEvidence.has(item.evidenceId)).length,
    orphanAssertions: registry.evidenceAssertions.filter(item => !referencedAssertions.has(item.assertionId)).length,
    orphanRepositoryAssertions: registry.repositoryAssertions.filter(item => !referencedRepositoryAssertions.has(item.repositoryAssertionId)).length,
  };
}

export function semanticErrors(registry, { methodologyCatalog = readJson(METHODOLOGY_CATALOG_PATH), rawText } = {}) {
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

  if (registry.marketCategories.length < 5) errors.push("research saturation requires at least five market categories");
  if (registry.products.length < 15) errors.push("research coverage requires at least fifteen evaluated current Product/project identities");
  if (registry.capabilities.length !== EXPECTED_CAPABILITY_COUNT) errors.push(`capability taxonomy must contain exactly ${EXPECTED_CAPABILITY_COUNT} dimensions`);

  for (const evidence of registry.evidence) {
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
    if (!assertion.proposition.trim()) errors.push(`${assertion.assertionId}: supported proposition is empty`);
    if (assertion.reviewedAt > registry.researchAsOf || assertion.asOfDate > registry.researchAsOf) errors.push(`${assertion.assertionId}: stale or future assertion binding`);
    if (assertion.status === "active" && assertion.asOfDate !== registry.researchAsOf) errors.push(`${assertion.assertionId}: stale assertion does not match registry snapshot`);
    const targets = [assertion.productId, assertion.methodologyId, assertion.excludedIdentityId].filter(Boolean);
    if (targets.length !== 1) errors.push(`${assertion.assertionId}: Evidence assertion must identify exactly one subject`);
    if (assertion.subjectType === "product" && (!assertion.productId || !productIds.has(assertion.productId))) errors.push(`${assertion.assertionId}: unknown or missing Product subject`);
    if (assertion.subjectType === "methodology" && (!assertion.methodologyId || !methodologyIds.has(assertion.methodologyId))) errors.push(`${assertion.assertionId}: unknown or missing methodology subject`);
    if (assertion.subjectType === "excluded-identity" && (!assertion.excludedIdentityId || !excludedIdentityIds.has(assertion.excludedIdentityId))) errors.push(`${assertion.assertionId}: unknown or missing excluded identity subject`);
    const featureAssertion = ["availability", "capability-support", "explicit-negative"].includes(assertion.assertionType);
    if (featureAssertion && (!assertion.capabilityId || !capabilityIds.has(assertion.capabilityId))) errors.push(`${assertion.assertionId}: feature assertion requires an exact capability`);
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
  }

  for (const seed of registry.seedResolutions) {
    for (const assertionId of seed.assertionIds) if (!assertionById.has(assertionId)) errors.push(`${seed.seedId}: unknown Evidence assertion ${assertionId}`);
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
    if (!capabilityIds.has(assertion.capabilityId)) errors.push(`${assertion.repositoryAssertionId}: unknown capability ${assertion.capabilityId}`);
    if (assertion.status !== "active") errors.push(`${assertion.repositoryAssertionId}: inactive repository assertion cannot support current GAEP maturity`);
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
        if (assertion.capabilityId !== maturity.capabilityId) errors.push(`${maturity.capabilityId}: wrong-capability repository assertion ${assertionId}`);
        if (assertion.maturityState !== maturity.maturityState) errors.push(`${maturity.capabilityId}: repository assertion maturity mismatch`);
      }
    }
    if (maturity.maturityState === "planned-deferred-coming-soon" && /implemented|shipped|current capability/i.test(maturity.rationale)) errors.push(`${maturity.capabilityId}: GAEP roadmap capability presented as shipped`);
  }

  const strong = /(better than|superior to|enterprise-ready|production-ready|\bsecure\b|\bcompliant\b|\bcertified\b|guarantees? quality|\bROI\b|time savings?|cost savings?|adoption rate)/i;
  for (const claim of registry.claims) {
    if (claim.asOfDate !== registry.researchAsOf) errors.push(`${claim.claimId}: stale claim snapshot binding`);
    for (const productId of claim.productIds) if (!productIds.has(productId)) errors.push(`${claim.claimId}: unknown Product ${productId}`);
    for (const capabilityId of claim.capabilityIds) if (!capabilityIds.has(capabilityId)) errors.push(`${claim.claimId}: unknown capability ${capabilityId}`);
    for (const assertionId of claim.supportAssertionIds) if (!assertionById.has(assertionId)) errors.push(`${claim.claimId}: unknown Evidence assertion ${assertionId}`);
    for (const assertionId of claim.repositoryAssertionIds) if (!repositoryAssertionById.has(assertionId)) errors.push(`${claim.claimId}: unknown repository assertion ${assertionId}`);
    if (["substantiated-bounded-fact", "evidence-bounded-comparison"].includes(claim.claimClass) && claim.supportAssertionIds.length === 0 && claim.repositoryAssertionIds.length === 0) errors.push(`${claim.claimId}: factual/comparative claim has no exact support assertion`);
    if (claim.claimClass === "evidence-bounded-comparison") {
      for (const productId of claim.productIds) {
        const candidates = claim.supportAssertionIds.map(id => assertionById.get(id)).filter(Boolean).filter(assertion => assertion.productId === productId && assertion.status === "active");
        if (candidates.length === 0) errors.push(`${claim.claimId}: multi-Product comparison missing Product-specific support for ${productId}`);
        for (const capabilityId of claim.capabilityIds) if (!candidates.some(assertion => assertion.capabilityId === capabilityId)) errors.push(`${claim.claimId}: comparison missing exact ${productId}/${capabilityId} support`);
      }
    }
    for (const assertionId of claim.supportAssertionIds) {
      const assertion = assertionById.get(assertionId);
      if (assertion && !assertionEvidenceUsable(assertion, evidenceById.get(assertion.evidenceId), assertion.supportStrength === "verified" ? "verified" : "partial")) errors.push(`${claim.claimId}: unrelated or unusable Evidence assertion ${assertionId}`);
    }
    for (const assertionId of claim.repositoryAssertionIds) {
      const assertion = repositoryAssertionById.get(assertionId);
      if (assertion && claim.capabilityIds.length > 0 && !claim.capabilityIds.includes(assertion.capabilityId)) errors.push(`${claim.claimId}: repository assertion ${assertionId} is outside claim capability scope`);
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
  for (const assertion of registry.evidenceAssertions) if (!referencedAssertions.has(assertion.assertionId)) errors.push(`${assertion.assertionId}: orphan Evidence assertion`);
  for (const assertion of registry.repositoryAssertions) if (!referencedRepositoryAssertions.has(assertion.repositoryAssertionId)) errors.push(`${assertion.repositoryAssertionId}: orphan repository assertion`);
  const referencedEvidence = new Set(registry.evidenceAssertions.map(assertion => assertion.evidenceId));
  for (const evidenceId of evidenceIds) if (!referencedEvidence.has(evidenceId)) errors.push(`${evidenceId}: orphan Evidence`);

  const methodologyNames = new Set(methodologyCatalog.references.map(reference => reference.canonicalName.toLowerCase()));
  for (const product of registry.products) if (methodologyNames.has(product.canonicalName.toLowerCase())) errors.push(`${product.productId}: Product duplicates GAEP-REG-011 methodology truth`);
  if (registry.approval.state !== "not-approved" || registry.approval.publicationState !== "not-published") errors.push("registry has unauthorized Approved/Published state");
  if (registry.projection.registryVersion !== registry.version) errors.push("projection registryVersion differs from canonical registry version");
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
