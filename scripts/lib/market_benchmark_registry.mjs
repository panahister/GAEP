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
    instancePath:error.instancePath,
    schemaPath:error.schemaPath,
    keyword:error.keyword,
    message:error.message,
    params:error.params,
  })).sort((left,right)=>`${left.instancePath}|${left.schemaPath}|${left.keyword}|${left.message}`.localeCompare(`${right.instancePath}|${right.schemaPath}|${right.keyword}|${right.message}`));
}

export function formatAjvErrors(errors) {
  return normalizeAjvErrors(errors).map(error=>`${error.instancePath || "/"} ${error.message} (${error.schemaPath})`).join("\n");
}

export function compileSchema(schema) {
  assertOfflineSchema(schema);
  const ajv = new Ajv2020({allErrors:true,coerceTypes:false,messages:true,removeAdditional:false,strict:true,useDefaults:false,validateFormats:true,verbose:true});
  addFormats(ajv,{mode:"full"});
  if (!ajv.validateSchema(schema)) throw new Error(`invalid market benchmark schema:\n${formatAjvErrors(ajv.errors)}`);
  return ajv.compile(schema);
}

export function validateSchemaBinding(registry, schema) {
  const errors=[];
  if (registry.schemaId !== schema.$id) errors.push(`registry schemaId ${registry.schemaId} does not equal schema $id ${schema.$id}`);
  const version=schema?.properties?.schemaVersion?.const;
  if (registry.schemaVersion !== version) errors.push(`registry schemaVersion ${registry.schemaVersion} does not equal schema version ${version}`);
  return errors;
}

const ids = entries => entries.map(entry => Object.entries(entry).find(([key])=>key.endsWith("Id"))?.[1]);
const duplicateValues = values => [...new Set(values.filter((value,index)=>values.indexOf(value)!==index))].sort();
const sorted = values => [...values].sort((left,right)=>left.localeCompare(right));
const same = (left,right) => JSON.stringify(left)===JSON.stringify(right);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const hasLongExactQuotation = value => {
  const matches = String(value).matchAll(/["“]([^"”]+)["”]/g);
  return [...matches].some(match => match[1].trim().split(/\s+/).filter(Boolean).length > 25);
};

export const SUPPORT_LEVELS = ["not-applicable", "partially-supported", "unknown", "unsupported-by-reviewed-evidence", "verified-supported"];
export const DELIVERY_STATES = ["announced-roadmap", "community-extension", "inference", "not-assessed", "preview-beta", "shipped"];
export const GAEP_MATURITY_STATES = ["candidate-proposed", "implemented-and-automated-tested", "implemented-awaiting-product-owner-acceptance", "partial", "planned-deferred-coming-soon", "unknown-not-assessed"];

function checkIdCollection(errors, entries, idField, label) {
  const values=entries.map(entry=>entry[idField]);
  const duplicates=duplicateValues(values);
  if (duplicates.length) errors.push(`${label} duplicate IDs: ${duplicates.join(", ")}`);
  if (!same(values,sorted(values))) errors.push(`${label} must use canonical ID ordering`);
}

function collectEvidenceReferences(registry) {
  const references=[];
  for (const seed of registry.seedResolutions) references.push(...seed.evidenceIds);
  for (const product of registry.products) references.push(...product.evidenceIds);
  for (const evaluation of registry.landscapeEvaluations) references.push(...evaluation.evidenceIds);
  for (const row of registry.benchmarkRows) for (const cell of row.cells) references.push(...cell.evidenceIds);
  for (const claim of registry.claims) references.push(...claim.evidenceIds);
  return references;
}

export function semanticErrors(registry, { methodologyCatalog = readJson(METHODOLOGY_CATALOG_PATH), rawText } = {}) {
  const errors=[];
  const collections=[
    [registry.marketCategories,"categoryId","marketCategories"],
    [registry.capabilities,"capabilityId","capabilities"],
    [registry.evidence,"evidenceId","evidence"],
    [registry.seedResolutions,"seedId","seedResolutions"],
    [registry.products,"productId","products"],
    [registry.claims,"claimId","claims"],
    [registry.scenarios,"scenarioId","scenarios"],
    [registry.proofOfValueMetrics,"metricId","proofOfValueMetrics"],
    [registry.researchDebt,"debtId","researchDebt"],
  ];
  for (const [entries,field,label] of collections) checkIdCollection(errors,entries,field,label);

  const categoryIds=new Set(registry.marketCategories.map(entry=>entry.categoryId));
  const capabilityIds=new Set(registry.capabilities.map(entry=>entry.capabilityId));
  const evidenceIds=new Set(registry.evidence.map(entry=>entry.evidenceId));
  const productIds=new Set(registry.products.map(entry=>entry.productId));

  if (registry.marketCategories.length < 5) errors.push("research saturation requires at least five market categories");
  if (registry.products.length < 15) errors.push("research saturation requires at least fifteen current Product/project identities");

  for (const evidence of registry.evidence) {
    if (!evidence.officialUri.startsWith("https://")) errors.push(`${evidence.evidenceId}: official URI must use HTTPS`);
    for (const field of ["accessedAt","asOfDate","nextReviewAt"]) if (!validDate(evidence[field])) errors.push(`${evidence.evidenceId}: ${field} is not a possible ISO date`);
    if (evidence.accessedAt > registry.researchAsOf || evidence.asOfDate > registry.researchAsOf) errors.push(`${evidence.evidenceId}: evidence chronology exceeds researchAsOf`);
    if (evidence.nextReviewAt < evidence.asOfDate) errors.push(`${evidence.evidenceId}: next review precedes evidence as-of date`);
    if (evidence.accessResult === "unavailable" && (evidence.contentReviewState !== "access-unavailable" || evidence.supportedClaims.length > 0)) errors.push(`${evidence.evidenceId}: unavailable evidence cannot be reviewed or support claims`);
    if (evidence.sourceDigest && evidence.rightsStatus !== "captured-with-permission") errors.push(`${evidence.evidenceId}: digest requires exact captured bytes and permission state`);
    for (const successor of evidence.supersededBy) {
      const target=registry.evidence.find(entry=>entry.evidenceId===successor);
      if (!target?.supersedes.includes(evidence.evidenceId)) errors.push(`${evidence.evidenceId}: missing reciprocal supersession from ${successor}`);
    }
    for (const predecessor of evidence.supersedes) {
      const target=registry.evidence.find(entry=>entry.evidenceId===predecessor);
      if (!target?.supersededBy.includes(evidence.evidenceId)) errors.push(`${evidence.evidenceId}: missing reciprocal supersession to ${predecessor}`);
    }
  }

  for (const seed of registry.seedResolutions) {
    for (const evidenceId of seed.evidenceIds) if (!evidenceIds.has(evidenceId)) errors.push(`${seed.seedId}: unknown evidence ${evidenceId}`);
    if (seed.ambiguities.length > 0 && seed.resolutionState.startsWith("resolved-") && (!seed.selectedIdentity || !/ambig|select|separate|distinct/i.test(seed.rationale))) errors.push(`${seed.seedId}: ambiguous identity was silently resolved`);
    if (seed.resolutionState === "methodology-framework" && registry.products.some(product=>product.canonicalName===seed.selectedIdentity)) errors.push(`${seed.seedId}: methodology classified as Product`);
  }

  for (const product of registry.products) {
    for (const categoryId of product.categoryIds) if (!categoryIds.has(categoryId)) errors.push(`${product.productId}: unknown category ${categoryId}`);
    for (const evidenceId of product.evidenceIds) if (!evidenceIds.has(evidenceId)) errors.push(`${product.productId}: unknown evidence ${evidenceId}`);
    if (!product.officialUri.startsWith("https://")) errors.push(`${product.productId}: official URI must use HTTPS`);
    if (product.status === "active-current" && product.knownUnknowns.some(value=>/discontinued|superseded/i.test(value))) errors.push(`${product.productId}: contradictory Product status`);
  }
  const represented=new Set(registry.products.flatMap(product=>product.categoryIds));
  if (represented.size < 5) errors.push("Product landscape represents fewer than five market categories");

  const evaluationIds=registry.landscapeEvaluations.map(entry=>entry.productId);
  if (!same(evaluationIds,sorted(evaluationIds))) errors.push("landscapeEvaluations must use canonical Product ordering");
  if (!same(evaluationIds,sorted([...productIds]))) errors.push("landscapeEvaluations must classify every Product exactly once");
  for (const evaluation of registry.landscapeEvaluations) {
    if (!productIds.has(evaluation.productId)) errors.push(`landscapeEvaluation has unknown Product ${evaluation.productId}`);
    for (const evidenceId of evaluation.evidenceIds) if (!evidenceIds.has(evidenceId)) errors.push(`${evaluation.productId}: landscape evaluation has unknown evidence ${evidenceId}`);
  }

  const rowIds=registry.benchmarkRows.map(row=>row.productId);
  if (!same(rowIds,sorted(rowIds))) errors.push("benchmarkRows must use canonical Product ordering");
  if (!same(rowIds,sorted([...productIds]))) errors.push("benchmarkRows must cover every Product exactly once");
  for (const row of registry.benchmarkRows) {
    if (!productIds.has(row.productId)) errors.push(`benchmarkRow has unknown Product ${row.productId}`);
    const cellIds=row.cells.map(cell=>cell.capabilityId);
    if (!same(cellIds,sorted(cellIds))) errors.push(`${row.productId}: benchmark cells must use canonical capability ordering`);
    if (!same(cellIds,sorted([...capabilityIds]))) errors.push(`${row.productId}: benchmark must contain every capability exactly once`);
    for (const cell of row.cells) {
      for (const evidenceId of cell.evidenceIds) if (!evidenceIds.has(evidenceId)) errors.push(`${row.productId}/${cell.capabilityId}: unknown evidence ${evidenceId}`);
      if (["verified-supported","partially-supported","unsupported-by-reviewed-evidence"].includes(cell.supportLevel) && cell.evidenceIds.length===0) errors.push(`${row.productId}/${cell.capabilityId}: benchmark support state requires evidence`);
      if (cell.supportLevel==="unknown" && cell.evidenceIds.length>0) errors.push(`${row.productId}/${cell.capabilityId}: unknown must not masquerade as an evidence-supported conclusion`);
      if (cell.supportLevel==="unknown" && !/not evidence of absence/i.test(cell.limitation)) errors.push(`${row.productId}/${cell.capabilityId}: unknown must remain explicit and must not be converted to false/no`);
      if (cell.supportLevel==="unsupported-by-reviewed-evidence" && /no public|not documented|absence/i.test(`${cell.rationale} ${cell.limitation}`)) errors.push(`${row.productId}/${cell.capabilityId}: missing public evidence cannot prove unsupported`);
      if (cell.deliveryState==="shipped" && cell.supportLevel==="unknown") errors.push(`${row.productId}/${cell.capabilityId}: unknown converted to shipped capability`);
      if (cell.asOfDate !== registry.researchAsOf) errors.push(`${row.productId}/${cell.capabilityId}: stale or mismatched as-of binding`);
    }
  }

  const maturityIds=registry.gaepMaturity.map(entry=>entry.capabilityId);
  if (!same(maturityIds,sorted(maturityIds))) errors.push("gaepMaturity must use canonical capability ordering");
  if (!same(maturityIds,sorted([...capabilityIds]))) errors.push("gaepMaturity must cover every capability exactly once");
  for (const maturity of registry.gaepMaturity) {
    if (maturity.repositoryEvidence.length===0) errors.push(`${maturity.capabilityId}: GAEP maturity requires exact repository evidence`);
    if (maturity.maturityState==="planned-deferred-coming-soon" && /implemented|shipped|current capability/i.test(maturity.rationale)) errors.push(`${maturity.capabilityId}: GAEP roadmap capability presented as shipped`);
  }

  const strong=/(better than|superior to|enterprise-ready|production-ready|\bsecure\b|\bcompliant\b|\bcertified\b|guarantees? quality|\bROI\b|time savings?|cost savings?|adoption rate)/i;
  for (const claim of registry.claims) {
    for (const evidenceId of claim.evidenceIds) if (!evidenceIds.has(evidenceId)) errors.push(`${claim.claimId}: unknown evidence ${evidenceId}`);
    for (const capabilityId of claim.gaepCapabilityIds) if (!capabilityIds.has(capabilityId)) errors.push(`${claim.claimId}: unknown GAEP capability ${capabilityId}`);
    if (["substantiated-bounded-fact","evidence-bounded-comparison"].includes(claim.claimClass) && claim.evidenceIds.length===0 && claim.gaepCapabilityIds.length===0) errors.push(`${claim.claimId}: factual/comparative claim has no evidence or maturity binding`);
    if (strong.test(claim.wording) && claim.disposition!=="prohibited") errors.push(`${claim.claimId}: unsupported strong claim is not prohibited`);
    if (hasLongExactQuotation(claim.wording)) errors.push(`${claim.claimId}: exact quotation exceeds the machine-enforced 25-word boundary`);
    if (claim.approvalState!=="not-approved" || claim.publicationState!=="not-published") errors.push(`${claim.claimId}: unauthorized Approved/Published state`);
  }

  for (const scenario of registry.scenarios) {
    for (const capabilityId of scenario.applicableCapabilityIds) if (!capabilityIds.has(capabilityId)) errors.push(`${scenario.scenarioId}: unknown capability ${capabilityId}`);
    if (scenario.rankingPolicy!=="no-total-score-preserve-unknowns") errors.push(`${scenario.scenarioId}: invented score/ranking policy`);
  }

  const references=collectEvidenceReferences(registry);
  for (const evidenceId of evidenceIds) if (!references.includes(evidenceId)) errors.push(`${evidenceId}: orphan evidence`);
  for (const evidenceId of references) if (!evidenceIds.has(evidenceId)) errors.push(`unknown evidence reference ${evidenceId}`);

  const methodologyNames=new Set(methodologyCatalog.references.map(reference=>reference.canonicalName.toLowerCase()));
  for (const product of registry.products) if (methodologyNames.has(product.canonicalName.toLowerCase())) errors.push(`${product.productId}: Product duplicates GAEP-REG-011 methodology truth`);

  if (registry.approval.state!=="not-approved" || registry.approval.publicationState!=="not-published") errors.push("registry has unauthorized Approved/Published state");
  if (registry.projection.registryVersion!==registry.version) errors.push("projection registryVersion differs from canonical registry version");
  if (rawText && rawText!==canonicalJson(registry)) errors.push("registry serialization is noncanonical");
  if (rawText && /"(?:totalScore|winner|rank)"\s*:/.test(rawText)) errors.push("invented total score or ranking field is prohibited");
  return sorted([...new Set(errors)]);
}

export function validateRegistryFiles({registryPath=REGISTRY_PATH,schemaPath=SCHEMA_PATH,methodologyCatalogPath=METHODOLOGY_CATALOG_PATH}={}) {
  const rawText=fs.readFileSync(registryPath,"utf8");
  const registry=JSON.parse(rawText);
  const schema=readJson(schemaPath);
  const methodologyCatalog=readJson(methodologyCatalogPath);
  const bindingErrors=validateSchemaBinding(registry,schema);
  const validate=compileSchema(schema);
  const schemaValid=validate(registry);
  const errors=[...bindingErrors,...(!schemaValid?normalizeAjvErrors(validate.errors).map(error=>`${error.instancePath || "/"} ${error.message}`):[]),...semanticErrors(registry,{methodologyCatalog,rawText})];
  return {valid:errors.length===0,errors:sorted([...new Set(errors)]),registry,schema};
}

export function validateCanonicalRegistry() {
  return validateRegistryFiles();
}
