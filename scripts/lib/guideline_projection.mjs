import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import ts from "typescript";

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(SCRIPT_DIR, "../..");
export const MANIFEST_PATH = path.join(ROOT, "docs/next/99_Registries_and_References/014_GUIDELINE_PROJECTION_MANIFEST.json");
export const SCHEMA_PATH = path.join(ROOT, "docs/next/99_Registries_and_References/014_GUIDELINE_PROJECTION_MANIFEST.schema.json");
export const AJV_VERSION = require("ajv/package.json").version;
export const AJV_FORMATS_VERSION = require("ajv-formats/package.json").version;

export const EXPECTED_LAYERS = ["executive-orientation", "quick-start", "practitioner-guide", "methodology-appendix"];
export const EXPECTED_SOURCE_KINDS = ["methodology-catalog", "market-registry", "terminology-index", "runtime-presentation-contract", "runtime-contract-schema", "responsibility-competency-registry", "enterprise-assurance-registry", "target-execution-registry", "extension-package"];
export const EXPECTED_STATES = [
  "unknown-not-assessed",
  "planned-deferred-coming-soon",
  "candidate-proposed",
  "partial",
  "implemented-awaiting-product-owner-acceptance",
  "implemented-and-automated-tested",
];

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function compileSchema(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

function duplicateValues(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].sort();
}

function markdownSafe(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ").trim();
}

function mermaidSafe(value) {
  return String(value)
    .replaceAll("&", "and")
    .replaceAll("<", "")
    .replaceAll(">", "")
    .replaceAll('"', "'")
    .replaceAll("\n", " ")
    .trim();
}

function maturityLabel(manifest, state) {
  return manifest.statePolicy.labels[state] ?? String(state).replaceAll("-", " ");
}

function generatedBlock(id, content) {
  return `<!-- BEGIN GENERATED:${id} -->\n${content.trim()}\n<!-- END GENERATED:${id} -->`;
}

function visual(id, title, direction, body) {
  return `<!-- GAEP-VISUAL:${id} -->\n\n**${title}**\n\n\`\`\`mermaid\n%% ${title}\nflowchart ${direction}\n${body}\n\`\`\``;
}

function parseFrontmatterIdentity(rawText) {
  const block = rawText.match(/^---\n([\s\S]*?)\n---\n/);
  if (!block) return {};
  const value = key => block[1].match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim();
  return { identity: value("id"), version: value("version"), schemaVersion: value("schema_version") };
}

export function parseRuntimePresentationContract(rawText) {
  const compiled = ts.transpileModule(rawText, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
    reportDiagnostics: true,
  });
  if (compiled.diagnostics?.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) {
    throw new Error("runtime presentation contract does not transpile");
  }
  const module = { exports: {} };
  runInNewContext(compiled.outputText, { module, exports: module.exports }, { timeout: 1_000 });
  const value = module.exports;
  const checkpoints = value.currentProductJourneyCheckpointPresentation;
  const primaryStates = value.productJourneyPrimaryStatePresentation;
  const attentionIndicators = value.productJourneyAttentionIndicatorPresentation;
  const runtimeStates = value.productJourneyRuntimeStatePresentation;
  const roleArchetypeIds = value.productJourneyRoleArchetypeIds;
  const competencyProfileIds = value.productJourneyCompetencyProfileIds;
  if (!Array.isArray(checkpoints) || checkpoints.length === 0 || !primaryStates || !attentionIndicators || !runtimeStates) {
    throw new Error("runtime presentation contract does not expose checkpoints, primary states, indicators, and runtime mappings");
  }
  if (!Array.isArray(roleArchetypeIds) || !Array.isArray(competencyProfileIds)) throw new Error("runtime contract does not expose role and competency identities");
  return { checkpoints: structuredClone(checkpoints), primaryStates: structuredClone(primaryStates), attentionIndicators: structuredClone(attentionIndicators), runtimeStates: structuredClone(runtimeStates), roleArchetypeIds: structuredClone(roleArchetypeIds), competencyProfileIds: structuredClone(competencyProfileIds) };
}

export function loadProjectionContext({ root = ROOT, manifestPath = MANIFEST_PATH, schemaPath = SCHEMA_PATH } = {}) {
  const manifest = readJson(manifestPath);
  const schema = readJson(schemaPath);
  const rawSources = new Map();
  for (const binding of manifest.canonicalSources) rawSources.set(binding.kind, fs.readFileSync(path.join(root, binding.path)));
  const template = fs.readFileSync(path.join(root, manifest.generation.templatePath), "utf8");
  const catalog = JSON.parse(rawSources.get("methodology-catalog").toString("utf8"));
  const market = JSON.parse(rawSources.get("market-registry").toString("utf8"));
  const extensionPackage = JSON.parse(rawSources.get("extension-package").toString("utf8"));
  const runtimeContractSchema = JSON.parse(rawSources.get("runtime-contract-schema").toString("utf8"));
  const responsibility = JSON.parse(rawSources.get("responsibility-competency-registry").toString("utf8"));
  const assurance = JSON.parse(rawSources.get("enterprise-assurance-registry").toString("utf8"));
  const targetExecution = JSON.parse(rawSources.get("target-execution-registry").toString("utf8"));
  const responsibilitySchema = readJson(path.join(root, "docs/next/99_Registries_and_References/016_ENTERPRISE_RESPONSIBILITY_COMPETENCY_REGISTRY.schema.json"));
  const assuranceSchema = readJson(path.join(root, "docs/next/99_Registries_and_References/017_ENTERPRISE_ASSURANCE_DECISION_REGISTRY.schema.json"));
  const targetExecutionSchema = readJson(path.join(root, "docs/next/99_Registries_and_References/018_TARGET_LIFECYCLE_EXECUTION_REGISTRY.schema.json"));
  const runtimePresentation = parseRuntimePresentationContract(rawSources.get("runtime-presentation-contract").toString("utf8"));
  const runtimeCheckpoints = runtimePresentation.checkpoints.slice().sort((left, right) => left.order - right.order);
  return { root, manifest, schema, rawSources, template, catalog, market, extensionPackage, runtimeContractSchema, responsibility, responsibilitySchema, assurance, assuranceSchema, targetExecution, targetExecutionSchema, runtimePresentation, runtimeCheckpoints };
}

export function sourceBindingErrors(manifest, { rawSources }) {
  const errors = [];
  const bindings = new Map(manifest.canonicalSources.map(binding => [binding.kind, binding]));
  for (const binding of manifest.canonicalSources) {
    const raw = rawSources.get(binding.kind);
    if (!raw) {
      errors.push(`${binding.kind}: bound source bytes are unavailable`);
      continue;
    }
    const actualDigest = sha256(raw);
    if (actualDigest !== binding.sha256) errors.push(`${binding.kind}: digest drift ${actualDigest} does not match ${binding.sha256}`);
  }

  const jsonIdentity = (kind, idField) => {
    const binding = bindings.get(kind);
    const raw = rawSources.get(kind);
    if (!binding || !raw) return;
    const value = JSON.parse(raw.toString("utf8"));
    if (value[idField] !== binding.identity) errors.push(`${kind}: identity ${value[idField]} does not match ${binding.identity}`);
    if (value.version !== binding.version) errors.push(`${kind}: version ${value.version} does not match ${binding.version}`);
    if (value.schemaVersion !== binding.schemaVersion) errors.push(`${kind}: schema version ${value.schemaVersion} does not match ${binding.schemaVersion}`);
  };
  jsonIdentity("methodology-catalog", "catalogId");
  jsonIdentity("market-registry", "registryId");
  jsonIdentity("responsibility-competency-registry", "registryId");
  jsonIdentity("enterprise-assurance-registry", "registryId");
  jsonIdentity("target-execution-registry", "registryId");

  const terminology = bindings.get("terminology-index");
  if (terminology && rawSources.get("terminology-index")) {
    const identity = parseFrontmatterIdentity(rawSources.get("terminology-index").toString("utf8"));
    if (identity.identity !== terminology.identity) errors.push(`terminology-index: identity ${identity.identity} does not match ${terminology.identity}`);
    if (identity.version !== terminology.version) errors.push(`terminology-index: version ${identity.version} does not match ${terminology.version}`);
  }

  const extensionBinding = bindings.get("extension-package");
  if (extensionBinding && rawSources.get("extension-package")) {
    const packageJson = JSON.parse(rawSources.get("extension-package").toString("utf8"));
    if (packageJson.version !== extensionBinding.version) errors.push(`extension-package: version ${packageJson.version} does not match ${extensionBinding.version}`);
  }
  return errors;
}

function commandErrors(manifest, extensionPackage) {
  const errors = [];
  const extensionCommands = new Set((extensionPackage.contributes?.commands ?? []).map(entry => entry.command));
  const chatCommands = new Set((extensionPackage.contributes?.chatParticipants ?? []).flatMap(entry => entry.commands ?? []).map(entry => entry.name));
  for (const command of manifest.commandSurface.extensionCommandIds) {
    if (!extensionCommands.has(command)) errors.push(`nonexistent extension command ${command}`);
  }
  for (const command of manifest.commandSurface.chatCommands) {
    if (!chatCommands.has(command)) errors.push(`nonexistent chat command /${command}`);
  }
  return errors;
}

function repositoryMaturityErrors(market) {
  const errors = [];
  const assertions = new Map(market.repositoryAssertions.map(entry => [entry.repositoryAssertionId, entry]));
  for (const maturity of market.gaepMaturity) {
    if (maturity.repositoryAssertionIds.length === 0 && maturity.maturityState.startsWith("implemented")) {
      errors.push(`${maturity.capabilityId}: implemented state has no repository assertion`);
    }
    for (const id of maturity.repositoryAssertionIds) {
      const assertion = assertions.get(id);
      if (!assertion) errors.push(`${maturity.capabilityId}: unknown repository assertion ${id}`);
      else if (assertion.status !== "active") errors.push(`${maturity.capabilityId}: repository assertion ${id} is not active`);
      else if (assertion.capabilityId !== maturity.capabilityId) errors.push(`${maturity.capabilityId}: repository assertion ${id} belongs to ${assertion.capabilityId}`);
      else if (assertion.maturityState !== maturity.maturityState) errors.push(`${maturity.capabilityId}: repository assertion ${id} maturity does not match`);
    }
  }
  return errors;
}

function marketDecisionSupportSemanticErrors(market) {
  const errors = [];
  const productIds = market.products.map(entry => entry.productId);
  const capabilityIds = market.capabilities.map(entry => entry.capabilityId);
  const rows = new Map(market.benchmarkRows.map(entry => [entry.productId, entry]));
  const assertions = new Map(market.evidenceAssertions.map(entry => [entry.assertionId, entry]));
  const evidence = new Map(market.evidence.map(entry => [entry.evidenceId, entry]));
  for (const productId of productIds) {
    const row = rows.get(productId);
    if (!row) {
      errors.push(`${productId}: missing Product benchmark row`);
      continue;
    }
    const rowCapabilityIds = row.cells.map(cell => cell.capabilityId);
    if (JSON.stringify(rowCapabilityIds) !== JSON.stringify(capabilityIds)) errors.push(`${productId}: benchmark cells do not preserve canonical capability identity and order`);
    for (const cell of row.cells) {
      if (cell.supportLevel === "unknown" && cell.supportAssertionIds.length > 0) errors.push(`${productId}/${cell.capabilityId}: Unknown cell cannot carry a support assertion`);
      if (cell.supportLevel !== "unknown" && cell.supportAssertionIds.length === 0) errors.push(`${productId}/${cell.capabilityId}: assessed support lacks an exact support assertion`);
      if (cell.deliveryState === "shipped" && cell.availabilityAssertionIds.length === 0) errors.push(`${productId}/${cell.capabilityId}: shipped delivery lacks exact availability evidence`);
      for (const [role, assertionIds] of [["support", cell.supportAssertionIds], ["availability", cell.availabilityAssertionIds]]) {
        for (const assertionId of assertionIds) {
          const assertion = assertions.get(assertionId);
          if (!assertion) {
            errors.push(`${productId}/${cell.capabilityId}: unknown ${role} assertion ${assertionId}`);
            continue;
          }
          if (assertion.status !== "active" || assertion.productId !== productId || assertion.capabilityId !== cell.capabilityId) errors.push(`${productId}/${cell.capabilityId}: ${assertionId} is not an active exact cell assertion`);
          if (role === "support" && assertion.assertionType !== "capability-support") errors.push(`${productId}/${cell.capabilityId}: ${assertionId} is not capability-support evidence`);
          if (role === "availability" && assertion.assertionType !== "availability") errors.push(`${productId}/${cell.capabilityId}: ${assertionId} is not availability evidence`);
          const source = evidence.get(assertion.evidenceId);
          if (!source || source.productId !== productId || source.accessResult !== "success") errors.push(`${productId}/${cell.capabilityId}: ${assertionId} does not resolve to successful exact Product evidence`);
        }
      }
    }
  }
  return errors;
}

function runtimePresentationErrors(runtimePresentation) {
  const errors = [];
  const checkpointIds = runtimePresentation.checkpoints.map(entry => entry.checkpointId);
  const checkpointOrders = runtimePresentation.checkpoints.map(entry => entry.order);
  for (const [label, values] of [["runtime checkpoint IDs", checkpointIds], ["runtime checkpoint orders", checkpointOrders]]) {
    const duplicates = duplicateValues(values);
    if (duplicates.length > 0) errors.push(`${label} contain duplicates: ${duplicates.join(", ")}`);
  }
  if (runtimePresentation.checkpoints.some(entry => !entry.checkpointId || !entry.label || !Number.isSafeInteger(entry.order) || entry.order < 1)) {
    errors.push("runtime checkpoints require stable IDs, labels, and positive explicit order metadata");
  }
  if (JSON.stringify(checkpointOrders) !== JSON.stringify(checkpointOrders.slice().sort((left, right) => left - right))) {
    errors.push("runtime checkpoint presentation must be ordered by explicit order metadata");
  }
  for (const [state, mapping] of Object.entries(runtimePresentation.runtimeStates)) {
    if (!runtimePresentation.primaryStates[mapping.primaryState]) errors.push(`${state}: unknown primary state ${mapping.primaryState}`);
    for (const indicatorId of mapping.indicatorIds ?? []) {
      if (!runtimePresentation.attentionIndicators[indicatorId]) errors.push(`${state}: unknown attention indicator ${indicatorId}`);
    }
  }
  for (const [kind, entries] of [["primary state", runtimePresentation.primaryStates], ["attention indicator", runtimePresentation.attentionIndicators]]) {
    for (const [id, entry] of Object.entries(entries)) {
      for (const field of ["label", "marker", "meaning", "userAction", "progression", "persists", "doesNotAuthorize"]) {
        if (typeof entry[field] !== "string" || entry[field].trim().length === 0) errors.push(`${kind} ${id} lacks ${field}`);
      }
    }
  }
  return errors;
}

function enterpriseContractErrors(runtimePresentation, responsibility, assurance, targetExecution, catalog, extensionPackage, manifest) {
  const errors = [];
  const roleIds = new Set(responsibility.roleArchetypes.map(entry => entry.roleId));
  const competencyIds = new Set(responsibility.competencyDimensions.map(entry => entry.competencyId));
  const chatCommands = new Set((extensionPackage.contributes?.chatParticipants ?? []).flatMap(entry => entry.commands ?? []).map(entry => entry.name));
  if (JSON.stringify([...roleIds]) !== JSON.stringify(runtimePresentation.roleArchetypeIds)) errors.push("runtime and responsibility-registry role identities drift");
  if (JSON.stringify([...competencyIds]) !== JSON.stringify(runtimePresentation.competencyProfileIds)) errors.push("runtime and responsibility-registry competency identities drift");
  const accountableRoles = [];
  for (const checkpoint of runtimePresentation.checkpoints) {
    const stepIds = checkpoint.executionSubsteps.map(step => step.stepId);
    const stepOrders = checkpoint.executionSubsteps.map(step => step.order);
    if (duplicateValues(stepIds).length > 0 || duplicateValues(stepOrders).length > 0) errors.push(`${checkpoint.checkpointId}: substep identities/orders must be unique`);
    if (JSON.stringify(stepOrders) !== JSON.stringify(stepOrders.slice().sort((a, b) => a - b))) errors.push(`${checkpoint.checkpointId}: substeps must follow explicit order`);
    for (const roleId of checkpoint.requiredRoleArchetypeIds) if (!roleIds.has(roleId)) errors.push(`${checkpoint.checkpointId}: unknown role ${roleId}`);
    for (const competencyId of checkpoint.requiredCompetencyProfileIds) if (!competencyIds.has(competencyId)) errors.push(`${checkpoint.checkpointId}: unknown competency ${competencyId}`);
    for (const step of checkpoint.executionSubsteps) {
      for (const roleId of [...step.responsibleRoleIds, ...step.consultedRoleIds, ...step.informedRoleIds, ...step.independentAssuranceRoleIds, ...(step.accountableRoleId ? [step.accountableRoleId] : [])]) if (!roleIds.has(roleId)) errors.push(`${step.stepId}: unknown RACI/assurance role ${roleId}`);
      if (["human-decision", "governed-commit"].includes(step.interactionType) && !step.accountableRoleId) errors.push(`${step.stepId}: governed decision lacks exactly one accountable role`);
      if (step.accountableRoleId) accountableRoles.push(step.accountableRoleId);
      if (step.currentAction?.kind === "chat-command") {
        const displayed = [...step.currentAction.value.matchAll(/@gaep \/([a-z]+)/g)].map(match => match[1]);
        if (displayed.length === 0 || displayed.some(command => !chatCommands.has(command))) errors.push(`${step.stepId}: current sequence action does not resolve to a contributed command`);
      }
      if (step.maturity === "target-only" && step.currentAction) errors.push(`${step.stepId}: target-only action cannot be executable`);
      for (const assuranceRoleId of step.independentAssuranceRoleIds) {
        if (step.responsibleRoleIds.includes(assuranceRoleId) || step.accountableRoleId === assuranceRoleId) errors.push(`${step.stepId}: independent assurance role conflicts with delivery/accountability role`);
      }
    }
  }
  if (accountableRoles.length > 0 && accountableRoles.every(role => role === "product-owner")) errors.push("Product Owner cannot be the universal accountable role");
  const catalogReferenceIds = catalog.references.map(entry => entry.referenceId);
  const assessedReferenceIds = assurance.referenceDepthAssessments.map(entry => entry.referenceId);
  if (JSON.stringify(catalogReferenceIds) !== JSON.stringify(assessedReferenceIds)) errors.push("enterprise evidence-depth assessment must cover every P01 reference in canonical order");
  for (const assessment of assurance.referenceDepthAssessments) {
    if (assessment.evidenceDepth === "ED1" && !/(?:no |not established|illustrative|bounded)/i.test(assessment.currentGaepMapping)) errors.push(`${assessment.referenceId}: ED1 abstract-only evidence cannot support normative mapping`);
  }
  const requirementsStandard = assurance.referenceDepthAssessments.find(entry => entry.referenceId === "GAEP-XREF-012");
  if (!requirementsStandard || requirementsStandard.evidenceDepth !== "ED1" || !/2018 Edition 2/i.test(requirementsStandard.reviewedCoverage) || !/Edition 3 DIS.*distinct successor draft/i.test(requirementsStandard.reviewedCoverage) || !/insufficient decision evidence/i.test(requirementsStandard.adoptionConsequence)) errors.push("ISO/IEC/IEEE 29148 abstract-only disposition is not conservative and successor-aware");
  for (const claim of assurance.claimAssurance) {
    if (claim.status !== "not-established" && claim.repositoryEvidence.length === 0 && claim.runtimeEvidence.length === 0) errors.push(`${claim.claimId}: established claim lacks inspectable repository/runtime evidence`);
    if (/conform|certif|compli/i.test(claim.claim) && claim.status !== "not-established") errors.push(`${claim.claimId}: a referenced standard cannot imply GAEP conformance`);
  }
  if (assurance.decisionProfileTemplate.weightingRules.some(rule => /default weights/i.test(rule) && !/^No default weights$/i.test(rule))) errors.push("organization-specific weights cannot become a universal ranking");
  if (!assurance.decisionProfileTemplate.weightingRules.some(rule => /Unknown is not scored as No or zero/i.test(rule))) errors.push("Unknown cannot silently receive a losing score");
  for (const gap of manifest.proposedCanonicalGaps) {
    if (gap.scopedImpacts.p03ProjectionAcceptance !== "non-blocking-when-honestly-projected" || gap.scopedImpacts.executableState !== "proposed-non-executable") errors.push(`${gap.gapId}: gap impact is circular or executable`);
  }
  const targetNodeIds = manifest.lifecycleNodes.map(entry => entry.nodeId);
  if (JSON.stringify(targetExecution.nodeProfiles.map(entry => entry.nodeId)) !== JSON.stringify(targetNodeIds)) errors.push("target execution profiles must cover every target node in canonical order");
  const patterns = new Map(targetExecution.executionPatterns.map(entry => [entry.patternId, entry]));
  for (const profile of targetExecution.nodeProfiles) {
    const pattern = patterns.get(profile.patternId);
    if (!pattern) { errors.push(`${profile.nodeId}: unknown target execution pattern ${profile.patternId}`); continue; }
    for (const roleId of [...pattern.requiredRoleIds, ...pattern.responsibleRoleIds, pattern.accountableRoleId, ...pattern.assuranceRoleIds]) if (!roleIds.has(roleId)) errors.push(`${profile.nodeId}: unknown target role ${roleId}`);
    for (const competencyId of pattern.competencyIds) if (!competencyIds.has(competencyId)) errors.push(`${profile.nodeId}: unknown target competency ${competencyId}`);
  }
  return errors;
}

export function manifestSemanticErrors(manifest, { catalog, market, extensionPackage, runtimePresentation, runtimeCheckpoints, responsibility, assurance, targetExecution }) {
  const errors = [];
  const layerIds = manifest.audienceLayers.map(entry => entry.layerId);
  if (JSON.stringify(layerIds) !== JSON.stringify(EXPECTED_LAYERS)) errors.push("audience layers must be the exact four progressive layers in canonical order");
  const sourceKinds = manifest.canonicalSources.map(entry => entry.kind);
  if (JSON.stringify(sourceKinds) !== JSON.stringify(EXPECTED_SOURCE_KINDS)) errors.push("canonical sources must use the exact maintained ordering");
  for (const [label, values] of [
    ["source kinds", manifest.canonicalSources.map(entry => entry.kind)],
    ["section IDs", manifest.requiredSections.map(entry => entry.sectionId)],
    ["visual IDs", manifest.requiredVisuals.map(entry => entry.visualId)],
    ["lifecycle segment IDs", manifest.lifecycleSegments.map(entry => entry.segmentId)],
    ["lifecycle IDs", manifest.lifecycleNodes.map(entry => entry.nodeId)],
    ["transition checkpoint IDs", manifest.transitionRoadmap.map(entry => entry.currentCheckpointId)],
    ["stakeholder requirement IDs", manifest.stakeholderRequirements.map(entry => entry.requirementId)],
    ["proposed gap IDs", manifest.proposedCanonicalGaps.map(entry => entry.gapId)],
  ]) {
    const duplicates = duplicateValues(values);
    if (duplicates.length > 0) errors.push(`${label} contain duplicates: ${duplicates.join(", ")}`);
  }
  const sectionIds = new Set(manifest.requiredSections.map(entry => entry.sectionId));
  for (const visualEntry of manifest.requiredVisuals) {
    if (!sectionIds.has(visualEntry.sectionId)) errors.push(`${visualEntry.visualId}: unknown section ${visualEntry.sectionId}`);
    if (!["TD", "TB"].includes(visualEntry.direction)) errors.push(`${visualEntry.visualId}: visual must be vertical`);
  }
  const segmentIds = new Set(manifest.lifecycleSegments.map(entry => entry.segmentId));
  const visualIds = new Set(manifest.requiredVisuals.map(entry => entry.visualId));
  for (const segment of manifest.lifecycleSegments) if (!visualIds.has(segment.visualId)) errors.push(`${segment.segmentId}: unknown lifecycle visual ${segment.visualId}`);
  const orders = manifest.lifecycleNodes.map(entry => entry.order);
  const duplicateOrders = duplicateValues(orders);
  if (duplicateOrders.length > 0) errors.push(`lifecycle order values contain duplicates: ${duplicateOrders.join(", ")}`);
  if (JSON.stringify(orders) !== JSON.stringify(orders.slice().sort((left, right) => left - right))) errors.push("lifecycle nodes must be sorted by explicit order metadata");
  for (const node of manifest.lifecycleNodes) if (!segmentIds.has(node.segmentId)) errors.push(`${node.nodeId}: unknown lifecycle segment ${node.segmentId}`);
  const knownCapabilities = new Set(market.capabilities.map(entry => entry.capabilityId));
  const maturityByCapability = new Map(market.gaepMaturity.map(entry => [entry.capabilityId, entry]));
  const projectedCapabilities = new Set();
  for (const node of manifest.lifecycleNodes) {
    for (const capabilityId of node.capabilityIds) {
      projectedCapabilities.add(capabilityId);
      if (!knownCapabilities.has(capabilityId)) errors.push(`${node.nodeId}: unknown capability ${capabilityId}`);
      if (!maturityByCapability.has(capabilityId)) errors.push(`${node.nodeId}: capability ${capabilityId} lacks GAEP maturity`);
    }
  }
  const sourceConceptIds = manifest.sourceLifecycle.concepts.map(entry => entry.conceptId);
  if (JSON.stringify(sourceConceptIds) !== JSON.stringify(["source-intake", "source-baseline", "source-provenance"])) errors.push("Source Intake, Baseline, and Provenance concepts must remain distinct and ordered");
  const sourceEventIds = manifest.sourceLifecycle.events.map(entry => entry.eventId);
  const expectedSourceEventIds = ["source-added", "source-changed", "source-removed-excluded", "source-superseded", "source-unavailable"];
  if (JSON.stringify(sourceEventIds) !== JSON.stringify(expectedSourceEventIds)) errors.push("source lifecycle must cover Added, Changed, Removed/Excluded, Superseded, and Unavailable in canonical order");
  if (!/explicit, scoped human decision/i.test(manifest.sourceLifecycle.supersessionRule) || !/never infer/i.test(manifest.sourceLifecycle.supersessionRule)) errors.push("source supersession must be an explicit scoped human decision and never inferred");
  const sourceClassification = new Map(manifest.sourceLifecycle.events.map(entry => [entry.eventId, entry.runtimeClassification]));
  if (sourceClassification.get("source-added") !== "implemented-awaiting-product-owner-acceptance") errors.push("Source added must retain its verified current acceptance boundary");
  for (const eventId of ["source-removed-excluded", "source-superseded"]) {
    if (sourceClassification.get(eventId) !== "unsupported-unavailable") errors.push(`${eventId}: unsupported runtime behavior cannot be presented as implemented`);
  }
  for (const capabilityId of knownCapabilities) {
    if (!projectedCapabilities.has(capabilityId)) errors.push(`lifecycle omits current capability ${capabilityId}`);
  }
  const orderFor = fragment => manifest.lifecycleNodes.find(entry => entry.title.toLowerCase().includes(fragment))?.order ?? Number.POSITIVE_INFINITY;
  if (orderFor("ddd strategic") >= orderFor("architecture-bound backlog")) errors.push("DDD strategic design must precede architecture-bound backlog");
  if (orderFor("architecture decisions") >= orderFor("architecture-bound backlog")) errors.push("architecture decisions must precede architecture-bound backlog");
  if (orderFor("product design") >= orderFor("architecture-bound backlog")) errors.push("Product Design must precede architecture-bound backlog");
  if (manifest.lifecycleNodes.some(entry => /figma/i.test(entry.title))) errors.push("Figma cannot be the canonical target lifecycle stage");
  if (manifest.lifecycleNodes.some(entry => /pre-figma/i.test(entry.title))) errors.push("legacy Pre-Figma wording cannot define a target lifecycle node");
  if (manifest.lifecycleNodes.some(entry => /(?:every|all)\s+(?:enterprise\s+)?products?\s+(?:is|are)\s+(?:an?\s+)?erp/i.test(`${entry.title} ${entry.targetIntent}`))) errors.push("ERP cannot be a universal Product assumption");
  if (JSON.stringify(manifest.statePolicy.displayPriority) !== JSON.stringify(EXPECTED_STATES)) errors.push("state display priority is not the exact conservative policy");
  if (catalog.catalogId !== "GAEP-REG-011") errors.push("methodology input is not GAEP-REG-011");
  if (market.registryId !== "GAEP-REG-013") errors.push("market input is not GAEP-REG-013");
  const runtimeIds = new Set(runtimeCheckpoints.map(entry => entry.checkpointId));
  const targetIds = new Set(manifest.lifecycleNodes.map(entry => entry.nodeId));
  const gapIds = new Set(manifest.proposedCanonicalGaps.map(entry => entry.gapId));
  for (const transition of manifest.transitionRoadmap) {
    if (!runtimeIds.has(transition.currentCheckpointId)) errors.push(`${transition.currentCheckpointId}: transition references unknown current checkpoint`);
    for (const nodeId of transition.targetNodeIds) if (!targetIds.has(nodeId)) errors.push(`${transition.currentCheckpointId}: transition references unknown target ${nodeId}`);
    const checkpoint = runtimeCheckpoints.find(entry => entry.checkpointId === transition.currentCheckpointId);
    if (["renamed", "replaced-by-tool-neutral-abstraction"].includes(transition.transitionType) && (checkpoint?.compatibilityAliases?.length ?? 0) === 0) {
      errors.push(`${transition.currentCheckpointId}: renamed or replaced transition requires compatibility alias metadata`);
    }
  }
  for (const checkpoint of runtimeCheckpoints) {
    if (!manifest.transitionRoadmap.some(entry => entry.currentCheckpointId === checkpoint.checkpointId)) errors.push(`${checkpoint.checkpointId}: current checkpoint lacks transition metadata`);
    for (const cta of checkpoint.implementedCtas ?? []) {
      const chatCommand = cta.match(/^@gaep \/([a-z]+)/)?.[1];
      if (chatCommand && !manifest.commandSurface.chatCommands.includes(chatCommand)) errors.push(`${checkpoint.checkpointId}: CTA uses undeclared chat command /${chatCommand}`);
    }
  }
  for (const node of manifest.lifecycleNodes) for (const gapId of node.proposedGapIds) if (!gapIds.has(gapId)) errors.push(`${node.nodeId}: unknown proposed gap ${gapId}`);
  for (const requirement of manifest.stakeholderRequirements) {
    for (const nodeId of requirement.targetNodeIds) if (!targetIds.has(nodeId)) errors.push(`${requirement.requirementId}: unknown target node ${nodeId}`);
    for (const checkpointId of requirement.currentCheckpointIds) if (!runtimeIds.has(checkpointId)) errors.push(`${requirement.requirementId}: unknown current checkpoint ${checkpointId}`);
    for (const sourceId of requirement.canonicalSourceIds.filter(id => id.startsWith("GAEP-CAP-"))) if (!knownCapabilities.has(sourceId)) errors.push(`${requirement.requirementId}: unknown canonical capability ${sourceId}`);
  }
  for (const node of manifest.lifecycleNodes) {
    const mappedByRequirement = manifest.stakeholderRequirements.some(requirement => requirement.targetNodeIds.includes(node.nodeId));
    if (!mappedByRequirement) errors.push(`${node.nodeId}: target node lacks stakeholder requirement coverage`);
  }
  errors.push(...runtimePresentationErrors(runtimePresentation));
  errors.push(...enterpriseContractErrors(runtimePresentation, responsibility, assurance, targetExecution, catalog, extensionPackage, manifest));
  errors.push(...commandErrors(manifest, extensionPackage));
  errors.push(...repositoryMaturityErrors(market));
  errors.push(...marketDecisionSupportSemanticErrors(market));
  return errors;
}

export function validateProjectionContext(context) {
  const validate = compileSchema(context.schema);
  const validateRuntime = compileSchema(context.runtimeContractSchema);
  const validateResponsibility = compileSchema(context.responsibilitySchema);
  const validateAssurance = compileSchema(context.assuranceSchema);
  const validateTargetExecution = compileSchema(context.targetExecutionSchema);
  const errors = [];
  if (!validate(context.manifest)) {
    errors.push(...validate.errors.map(error => `manifest schema ${error.instancePath || "/"}: ${error.message}`));
  }
  if (context.manifest.schemaId !== context.schema.$id) errors.push("manifest schemaId does not equal schema $id");
  if (!validateRuntime(context.runtimePresentation)) errors.push(...validateRuntime.errors.map(error => `runtime contract schema ${error.instancePath || "/"}: ${error.message}`));
  if (!validateResponsibility(context.responsibility)) errors.push(...validateResponsibility.errors.map(error => `responsibility schema ${error.instancePath || "/"}: ${error.message}`));
  if (!validateAssurance(context.assurance)) errors.push(...validateAssurance.errors.map(error => `assurance schema ${error.instancePath || "/"}: ${error.message}`));
  if (!validateTargetExecution(context.targetExecution)) errors.push(...validateTargetExecution.errors.map(error => `target execution schema ${error.instancePath || "/"}: ${error.message}`));
  errors.push(...sourceBindingErrors(context.manifest, context));
  errors.push(...manifestSemanticErrors(context.manifest, context));
  return errors;
}

export function deriveLifecycleState(node, market, manifest) {
  const maturity = new Map(market.gaepMaturity.map(entry => [entry.capabilityId, entry.maturityState]));
  const states = new Set(node.capabilityIds.map(id => maturity.get(id) ?? "unknown-not-assessed"));
  return manifest.statePolicy.displayPriority.find(state => states.has(state)) ?? "unknown-not-assessed";
}

function stateMarker(state, manifest) {
  return manifest.statePolicy.labels[state].match(/^\[[A-Z]{2}\]/)?.[0] ?? "[UN]";
}

function renderProjectionHeader(manifest) {
  const catalog = manifest.canonicalSources.find(entry => entry.kind === "methodology-catalog");
  const market = manifest.canonicalSources.find(entry => entry.kind === "market-registry");
  return generatedBlock("PROJECTION_HEADER", [
    `> **Evidence boundary:** This Guide is generated from ${catalog.identity} v${catalog.version}, ${market.identity} v${market.version}, and the installed runtime presentation contract. Exact digests remain in the collapsed maintainer appendix.`,
    ">",
    "> **Authority:** Proposed, not approved, and not published. This Guide does not accept GAEP, authorize rollout, or convert evidence into organizational authority.",
  ].join("\n"));
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function renderExecutiveFacts(catalog, market, manifest) {
  const maturity = countBy(market.gaepMaturity.map(entry => entry.maturityState));
  return generatedBlock("EXECUTIVE_FACTS", [
    `**Evidence snapshot:** ${market.products.length} evaluated Products/projects · ${market.capabilities.length} vendor-neutral capabilities · ${market.benchmarkRows.length * market.capabilities.length} evidence-bounded benchmark cells · ${catalog.references.length} assessed methodology/reference sources · ${market.scenarios.length} adoption scenarios.`,
    "",
    "**Current GAEP repository maturity:**",
    "",
    `- ${maturity.get("implemented-and-automated-tested") ?? 0} implemented and automated-tested`,
    `- ${maturity.get("implemented-awaiting-product-owner-acceptance") ?? 0} implemented, awaiting independent P03 review`,
    `- ${maturity.get("partial") ?? 0} partial`,
    `- ${maturity.get("planned-deferred-coming-soon") ?? 0} planned/deferred`,
    "- 0 approved or published by this projection",
  ].join("\n"));
}

function renderExecutiveOperatingModel() {
  return generatedBlock("EXECUTIVE_OPERATING_MODEL", visual("executive-operating-model", "Evidence-governed operating model", "TD", [
    '  intent["Product intent and bounded problem"]',
    '  sources["Exact Sources, Baseline, and Provenance"]',
    '  decision["Human-governed Initiative decisions"]',
    '  architecture["Business, domain, and solution architecture"]',
    '  design["Product Design and architecture-bound backlog"]',
    '  delivery["Governed implementation, QA, and release evidence"]',
    '  operations["Operations, recovery, and feedback"]',
    "  intent --> sources --> decision --> architecture --> design --> delivery --> operations",
    "  operations -. new evidence or changed context .-> intent",
  ].join("\n")));
}

function renderAuthorityLoop() {
  return generatedBlock("AUTHORITY_LOOP", visual("authority-loop", "Human authority loop", "TD", [
    '  evidence["Evidence and governed context"] --> candidate["AI or tool prepares a candidate"]',
    '  candidate --> review["Human reviews exact content and limitations"]',
    '  review --> decision{"Accept this exact candidate?"}',
    '  decision -- "No: revise or cancel" --> candidate',
    '  decision -- "Yes: explicit acceptance" --> commit["Explicit commit creates governed state"]',
    '  commit --> separate["Approval, publication, rollout, and operations authority remain separate"]',
  ].join("\n")));
}

function renderQuickStart(manifest, extensionPackage) {
  const commands = new Set(manifest.commandSurface.chatCommands);
  const required = ["initialize", "status", "adopt", "continue", "intake", "record", "author", "inspect", "accept", "commit"];
  if (required.some(command => !commands.has(command))) throw new Error("quick-start commands are absent from the manifest command surface");
  const commandTitles = new Map((extensionPackage.contributes?.commands ?? []).map(entry => [entry.command, entry.title]));
  const chooseFile = commandTitles.get("gaep.chooseFile");
  const chooseFolder = commandTitles.get("gaep.chooseFolder");
  const addLink = commandTitles.get("gaep.addReferenceLink");
  if (!chooseFile || !chooseFolder || !addLink) throw new Error("source-first extension actions are absent from the contributed command surface");
  return generatedBlock("QUICK_START_FLOW", [
    visual("quick-start-flow", "First-session source-first path", "TD", [
      '  open["1 · Open a trusted Product workspace"] --> sources{"2 · Plan optional reference input"}',
      `  sources --> files["File · ${mermaidSafe(chooseFile)}<br/>select during Adopt or after Intake prerequisites"]`,
      `  sources --> folder["Folder · ${mermaidSafe(chooseFolder)}<br/>bounded recursive selection"]`,
      `  sources --> link["Link · ${mermaidSafe(addLink)}<br/>metadata only; never fetched"]`,
      '  sources --> none["No sources · allowed for Initialize<br/>missing evidence stays visible"]',
      '  files --> route{"3 · Existing or new Product?"}',
      '  folder --> route',
      '  link --> route',
      '  none --> route',
      '  route -- "Existing · readable documents required" --> adopt["@gaep /adopt"]',
      '  route -- "New · sources optional" --> initialize["@gaep /initialize"]',
      '  adopt --> productReview["Inspect/challenge Product candidate<br/>@gaep /accept · @gaep /commit CONFIRM"]',
      '  initialize --> productReview',
      '  productReview --> status["4 · @gaep /status"] --> next["5 · @gaep /continue"]',
      '  next --> intake["When Source Intake is current:<br/>@gaep /intake · @gaep /record"]',
      '  intake --> author["6 · @gaep /author"] --> review["7 · @gaep /inspect<br/>challenge exact candidate"]',
      '  review --> accept["8 · @gaep /accept"] --> commit["9 · @gaep /commit CONFIRM"]',
    ].join("\n")),
    "",
    "#### What the four source paths actually do",
    "",
    "| Path | What it does | What it does not do |",
    "|---|---|---|",
    `| **File** · \`${chooseFile}\` | Stages one or more supported files for the active \`/adopt\` or \`/intake\` route; the route reads bounded content and reports extraction limits. | Selection alone does not reason over content, record a Source, approve truth, or create governed state. |`,
    `| **Folder** · \`${chooseFolder}\` | Discovers supported files recursively within runtime limits for the active route. | It does not make every file relevant, authoritative, readable, or approved. |`,
    `| **Useful Link** · \`${addLink}\` | Records a portable, non-governed HTTP(S) reference label, URL, note, and added-at metadata. | GAEP never fetches or reads it. Link-only input is not content evidence unless exact content is separately made available and reviewed. |`,
    "| **No sources** | Lets a new Product proceed through `@gaep /initialize`; missing evidence remains explicit. | Current `@gaep /adopt` cannot fast-start an existing Product without readable documents, and `@gaep /intake` waits for Product, Initiative, and applicability prerequisites. |",
    "",
    "#### Do not conflate these boundaries",
    "",
    "1. **Select/attach** — chooses bytes or records link metadata; no reasoning or governance occurs.",
    "2. **Reason over exact attached content** — `@gaep /adopt` or, when prerequisites are current, `@gaep /intake`; this creates an advisory review, not a Source.",
    "3. **Record reviewed candidate Sources** — `@gaep /record`, or the explicit post-Adopt binding route after an Initiative exists; candidates remain non-authoritative.",
    "4. **Accept an exact proposal** — `@gaep /accept` records the human decision for the displayed candidate; it is not yet governed commit state.",
    "5. **Commit governed state** — `@gaep /commit CONFIRM` persists the exact accepted proposal. Approval, publication, rollout, release, production, security, and compliance authority remain separate.",
  ].join("\n"));
}

function renderCurrentRuntime(checkpoints, manifest) {
  const nodes = checkpoints.map(entry => {
    const label = entry.guideLabel ?? entry.label;
    return `  ${entry.checkpointId.replaceAll("-", "_")}["${entry.order}. ${mermaidSafe(label)}"]`;
  });
  nodes.push(`  ${checkpoints.map(entry => entry.checkpointId.replaceAll("-", "_")).join(" --> ")}`);
  const rows = checkpoints.map(entry => [
    `| \`${entry.checkpointId}\``,
    `${entry.order} · ${markdownSafe(entry.label)}`,
    markdownSafe(entry.prerequisites.length > 0 ? entry.prerequisites.join(", ") : "None"),
    `${markdownSafe(entry.implementedCtas.join("; "))}<br/>${markdownSafe(maturityLabel(manifest, entry.implementationMaturity))}<br/>${markdownSafe(entry.limitations)} |`,
  ].join(" | ")).join("\n");
  const compatibilityNotes = checkpoints.filter(entry => entry.compatibilityNote).map(entry => `> **Compatibility — \`${entry.checkpointId}\`:** ${entry.compatibilityNote}`).join("\n\n");
  return generatedBlock("CURRENT_RUNTIME", [
    visual("current-runtime", "Current runtime checkpoint inventory", "TD", nodes.join("\n")),
    "",
    "| Stable checkpoint ID | Order and current label | Current prerequisites | Implemented CTA, maturity, and limitation |",
    "|---|---|---|---|",
    rows,
    "",
    compatibilityNotes,
  ].join("\n"));
}

function renderCheckpointPositionExample(runtimePresentation) {
  const complete = runtimePresentation.primaryStates.complete;
  const current = runtimePresentation.primaryStates.current;
  const next = runtimePresentation.primaryStates.next;
  return generatedBlock("CHECKPOINT_POSITION_EXAMPLE", [
    visual("checkpoint-position-example", "Previous, Current, and Next example — not live workspace state", "TD", [
      `  previous["Previous · ${complete.marker} ${complete.label}<br/>Initiative definition · governed"]`,
      `  current["Current · ${current.marker} ${current.label}<br/>Initiative classification · candidate<br/>! 1 blocker · ? 2 open questions"]`,
      `  next["Next · ${next.marker} ${next.label}<br/>Initiative applicability<br/>CTA: @gaep /continue"]`,
      "  previous --> current --> next",
    ].join("\n")),
    "",
    "> **Static example, not live state.** Open Product Studio or run `@gaep /status` for the actual workspace position, candidate/governed status, blockers, attention count, open questions, and next valid CTA.",
  ].join("\n"));
}

function renderStateLegend(manifest, runtimePresentation) {
  const primary = Object.entries(runtimePresentation.primaryStates).map(([state, entry]) => [
    `<details><summary><strong>${entry.marker} ${entry.label}</strong> · \`${state}\`</summary>`,
    "",
    `- **Meaning:** ${entry.meaning}`,
    `- **Content:** ${entry.contentAuthority}.`,
    `- **Your action:** ${entry.userAction}`,
    `- **Progression:** ${entry.progression}.`,
    `- **Persists:** ${entry.persists}`,
    `- **Does not authorize:** ${entry.doesNotAuthorize}`,
    "",
    "</details>",
  ].join("\n")).join("\n\n");
  const indicators = Object.entries(runtimePresentation.attentionIndicators).map(([indicator, entry]) => [
    `<details><summary><strong>${entry.marker} ${entry.label}</strong> · overlay \`${indicator}\`</summary>`,
    "",
    `- **Meaning:** ${entry.meaning}`,
    `- **Your action:** ${entry.userAction}`,
    `- **Progression:** ${entry.progression}.`,
    `- **Persists:** ${entry.persists}`,
    `- **Does not authorize:** ${entry.doesNotAuthorize}`,
    "",
    "</details>",
  ].join("\n")).join("\n\n");
  const mappings = Object.entries(runtimePresentation.runtimeStates).map(([runtimeState, mapping]) => `| \`${runtimeState}\` | ${runtimePresentation.primaryStates[mapping.primaryState].marker} ${runtimePresentation.primaryStates[mapping.primaryState].label} | ${mapping.indicatorIds.map(id => `${runtimePresentation.attentionIndicators[id].marker} ${runtimePresentation.attentionIndicators[id].label}`).join(", ") || "None"} |`).join("\n");
  return generatedBlock("STATE_LEGEND", [
    "Primary progression state and attention indicators are separate. For example, a governed **Recorded** checkpoint may also carry **Needs attention**; a candidate may carry **2 open questions** without becoming governed.",
    "",
    "#### Primary progression states", "", primary,
    "", "#### Attention indicators", "", indicators,
    "", "#### Exact runtime-to-presentation mapping", "",
    "| Runtime machine state | Primary visible state | Attention overlay(s) |",
    "|---|---|---|", mappings,
    "",
    `**Unknown rule:** ${manifest.statePolicy.unknownRule}`,
    "",
    `**Accessibility rule:** ${manifest.statePolicy.colorRule}`,
  ].join("\n"));
}

function renderLifecycleSegment(id, title, nodes, market, manifest) {
  const lines = [];
  for (const node of nodes) {
    const state = deriveLifecycleState(node, market, manifest);
    const capabilities = node.capabilityIds.join(", ");
    lines.push(`  ${node.nodeId.replaceAll("-", "_")}["${node.order}. ${stateMarker(state, manifest)} ${mermaidSafe(node.title)}<br/>${capabilities}"]`);
  }
  lines.push(`  ${nodes.map(node => node.nodeId.replaceAll("-", "_")).join(" --> ")}`);
  return visual(id, title, "TD", lines.join("\n"));
}

function renderTargetLifecycle(manifest, market) {
  const nodes = manifest.lifecycleNodes.slice().sort((left, right) => left.order - right.order);
  const nodeDetails = nodes.map(node => {
    const state = deriveLifecycleState(node, market, manifest);
    const maturity = new Map(market.gaepMaturity.map(entry => [entry.capabilityId, entry]));
    const details = node.capabilityIds.map(id => `${id} ${maturity.get(id).maturityState}`).join("; ");
    return `| ${node.order} | ${markdownSafe(node.title)} | ${manifest.statePolicy.labels[state]} | ${details} |`;
  }).join("\n");
  const segments = manifest.lifecycleSegments.slice().sort((left, right) => left.order - right.order).map((segment, index, all) => [
    renderLifecycleSegment(segment.visualId, segment.title, nodes.filter(node => node.segmentId === segment.segmentId), market, manifest),
    index < all.length - 1 ? "\n\n↓ Continue to the next target segment" : "",
  ].join("")).join("\n\n");
  return generatedBlock("TARGET_LIFECYCLE", [
    "**Conservative target maturity vocabulary:**",
    "",
    ...manifest.statePolicy.displayPriority.map(state => `- ${manifest.statePolicy.labels[state]} · \`${state}\``),
    "",
    segments,
    "",
    "<details>",
    "<summary><strong>Exact capability-to-node derivation</strong></summary>",
    "",
    "| # | Target node | Conservative node state | Source capability states |",
    "|---:|---|---|---|",
    nodeDetails,
    "",
    "</details>",
  ].join("\n"));
}

function renderTransitionRoadmap(manifest) {
  const rows = manifest.transitionRoadmap.map(entry => `| \`${entry.currentCheckpointId}\` | ${entry.transitionType}<br/>${entry.targetNodeIds.map(id => `\`${id}\``).join(", ")} | ${markdownSafe(maturityLabel(manifest, entry.currentMaturity))}<br/>${markdownSafe(entry.implementationStatus)} | ${markdownSafe(entry.targetIntent)}<br/>Dependency: ${markdownSafe(entry.dependency)}<br/>Migration: ${entry.migrationState}; independent acceptance decision: ${entry.acceptanceDecision} |`).join("\n");
  const visualBody = [
    '  current["A. Current Runtime<br/>implemented behavior only"] --> mapping["C. Explicit transition records<br/>retained, expanded, split, merged, or replaced"]',
    '  mapping --> target["B. Target Operating Model<br/>intent and conservative maturity"]',
    '  target -. "later authorized prompts" .-> future["Future runtime implementation"]',
  ].join("\n");
  return generatedBlock("TRANSITION_ROADMAP", [
    visual("transition-roadmap", "Current-to-target transition", "TD", visualBody),
    "",
    "| Current stable ID | Transition and target | Current evidence | Target intent, dependency, and status |",
    "|---|---|---|---|",
    rows,
  ].join("\n"));
}

function renderRoadmapCoverage(manifest, market) {
  const maturity = new Map(market.gaepMaturity.map(entry => [entry.capabilityId, entry.maturityState]));
  const capabilityRows = market.capabilities.map(capability => {
    const targets = manifest.lifecycleNodes.filter(node => node.capabilityIds.includes(capability.capabilityId));
    const current = manifest.transitionRoadmap.filter(transition => transition.targetNodeIds.some(id => targets.some(node => node.nodeId === id))).map(entry => entry.currentCheckpointId);
    return `| ${capability.capabilityId}<br/>${markdownSafe(capability.name)} | ${targets.map(node => `\`${node.nodeId}\``).join(", ")} | ${[...new Set(current)].map(id => `\`${id}\``).join(", ") || "None"} | ${manifest.statePolicy.labels[maturity.get(capability.capabilityId) ?? "unknown-not-assessed"]}<br/>Canonical source: ${market.registryId} |`;
  }).join("\n");
  const requirementRows = manifest.stakeholderRequirements.map(entry => `| ${entry.requirementId}<br/>${markdownSafe(entry.title)} | ${entry.targetNodeIds.map(id => `\`${id}\``).join(", ")} | ${entry.currentCheckpointIds.map(id => `\`${id}\``).join(", ") || "None"} | ${markdownSafe(maturityLabel(manifest, entry.currentMaturity))}<br/>${markdownSafe(entry.futureDisposition)}<br/>${markdownSafe(entry.gapOrDecision)} |`).join("\n");
  const gaps = manifest.proposedCanonicalGaps.map(gap => `- **${gap.gapId} · ${gap.title}** — ${gap.status}; P03 projection: ${gap.scopedImpacts.p03ProjectionAcceptance}; capability impact: ${gap.scopedImpacts.targetCapabilityActivation}; current runtime: ${gap.scopedImpacts.currentRuntimeAvailability}; roadmap: ${gap.scopedImpacts.responsibleRoadmapItems.join(", ")}; executable state: ${gap.scopedImpacts.executableState}. ${gap.requiredCanonicalCorrection}`).join("\n");
  return generatedBlock("ROADMAP_COVERAGE", [
    "Every current canonical capability maps to at least one target node. Proposed stakeholder detail that exceeds accepted P01/P02 granularity remains an explicit, unaccepted gap.",
    "",
    "<details>", "<summary><strong>Show all canonical capability mappings</strong></summary>", "",
    "| Capability | Target node(s) | Current checkpoint(s), if any | Current maturity and source |", "|---|---|---|---|", capabilityRows, "", "</details>",
    "",
    "<details>", "<summary><strong>Show stakeholder requirement crosswalk</strong></summary>", "",
    "| Requirement | Target node(s) | Current checkpoint(s) | Disposition and unresolved decision |", "|---|---|---|---|", requirementRows, "", "</details>",
    "",
    "#### Proposed canonical gaps — not accepted truth", "", gaps,
  ].join("\n"));
}

function renderSourceLineage(manifest) {
  const concepts = manifest.sourceLifecycle.concepts.map(concept => [
    `<details><summary><strong>${concept.label}</strong></summary>`, "",
    `- **What it means:** ${concept.meaning}`,
    `- **Review boundary:** ${concept.reviewBoundary}`,
    `- **During Adopt:** ${concept.adoptBoundary}`,
    `- **When it changes:** ${concept.revisionRule}`,
    `- **Does not authorize:** ${concept.doesNotAuthorize}`,
    "", "</details>",
  ].join("\n")).join("\n\n");
  const summaryRows = manifest.sourceLifecycle.events.map(event => `| ${event.label} | ${maturityLabel(manifest, event.runtimeClassification)}<br/>compatibility machine state: \`${event.runtimeClassification}\` | ${markdownSafe(event.userAction)} | ${markdownSafe(event.recordEffect)} |`).join("\n");
  const eventDetails = manifest.sourceLifecycle.events.map(event => [
    `<details><summary><strong>${event.label}</strong> · ${maturityLabel(manifest, event.runtimeClassification)} · compatibility machine state: <code>${event.runtimeClassification}</code></summary>`, "",
    `- **What you see:** ${event.userSees}`,
    `- **What GAEP needs from you:** ${event.userAction}`,
    `- **Record/revision effect:** ${event.recordEffect}`,
    `- **Baseline review:** ${event.baselineReview}`,
    `- **Provenance review:** ${event.provenanceReview}`,
    `- **Possible downstream revalidation:** ${event.downstreamRevalidation}`,
    `- **Safe current workaround:** ${event.safeWorkaround}`,
    `- **Not authorized:** ${event.doesNotAuthorize}`,
    "", "</details>",
  ].join("\n")).join("\n\n");
  return generatedBlock("SOURCE_LINEAGE", [
    visual("source-lifecycle", "Source Intake, Baseline, Provenance, and change review", "TD", [
      '  material["Selected bytes or link metadata<br/>not approved truth"] --> review["Review exact available content<br/>or preserve missing evidence"]',
      '  review --> source["Explicit candidate Source record"]',
      '  source --> baseline["Explicit Baseline membership<br/>exact identity and revision"]',
      '  baseline --> provenance["Provenance<br/>lineage, transformations, limitations"]',
      '  provenance --> candidate["Bounded downstream candidate"]',
      '  candidate --> human["Human review · accept · explicit commit"]',
      '  human --> governed["Governed record<br/>authority still bounded"]',
      '  change["Added · Changed · Excluded · Superseded · Unavailable"] -. "review, revise, or remain unresolved" .-> source',
    ].join("\n")),
    "",
    "#### Three distinct records", "", concepts,
    "", "#### Source-change matrix", "",
    "| Event | Current runtime classification | Required user action | Record/revision consequence |",
    "|---|---|---|---|", summaryRows, "", eventDetails,
    "", `> **Supersession rule:** ${manifest.sourceLifecycle.supersessionRule}`,
  ].join("\n"));
}

function renderMarketGuide(market, manifest) {
  const cells = market.benchmarkRows.flatMap(row => row.cells);
  const support = countBy(cells.map(cell => cell.supportLevel));
  const delivery = countBy(cells.map(cell => cell.deliveryState));
  return generatedBlock("MARKET_GUIDE", [
    `Bound to **${market.registryId} v${market.version}**, research snapshot **${market.researchAsOf}**. The complete projection contains **${market.products.length} Products/projects × ${market.capabilities.length} capabilities = ${cells.length} cells**, including every Unknown.`,
    "",
    "**Executive frame:** compare Products by the job-to-be-done, category, scenario, support evidence, delivery state, limitations, and freshness. There is no universal winner. GAEP repository maturity remains a separate axis and never increases a Product's market support.",
    "",
    `**Evidence distribution:** ${support.get("verified-supported") ?? 0} Verified · ${support.get("partially-supported") ?? 0} Partial · ${support.get("unknown") ?? 0} Unknown. **Delivery distribution:** ${delivery.get("shipped") ?? 0} shipped · ${cells.length - (delivery.get("shipped") ?? 0)} not established as shipped.`,
    "",
    `**[Open the complete generated Product × capability decision guide](./${path.basename(manifest.generation.decisionSupportOutputPath)})** — all cells, exact assertion/evidence links, review and as-of dates, limitations, category/scenario context, and separate methodology identities.`,
    "",
    "**Interpretation:** support and delivery remain separate. For an Unknown cell, reviewed support is not established; it never means No. Preview, beta, roadmap, inference, community extension, or not-assessed delivery must never be shown as shipped.",
  ].join("\n"));
}

function supportDisplay(value) {
  if (value === "verified-supported") return "Verified · verified-supported";
  if (value === "partially-supported") return "Partial · partially-supported";
  if (value === "unknown") return "Unknown · unknown";
  return value;
}

function deliveryDisplay(value) {
  const labels = {
    shipped: "Shipped",
    "preview-beta": "Preview / beta",
    "announced-roadmap": "Announced roadmap",
    "community-extension": "Community extension",
    inference: "Inference only",
    "not-assessed": "Not assessed",
  };
  return `${labels[value] ?? value} · ${value}`;
}

function assertionEvidenceLine(role, assertion, evidence, product) {
  const limitations = [...new Set([...(assertion.limitations ?? []), ...(evidence.limitations ?? [])])].join(" ");
  const overviewOnly = evidence.officialUri === product.officialUri;
  const evidenceIdentity = overviewOnly
    ? `${assertion.assertionId} → ${evidence.evidenceId} (Product overview URI; not treated as a cell-level evidence link)`
    : `[${assertion.assertionId} → ${evidence.evidenceId}](${evidence.officialUri})`;
  return [
    `**${role}:** ${evidenceIdentity} — ${markdownSafe(assertion.proposition)}`,
    `Locator: ${markdownSafe(assertion.locator)} · assertion reviewed ${assertion.reviewedAt}, as-of ${assertion.asOfDate}`,
    `Evidence: ${markdownSafe(evidence.publisher)} · ${evidence.contentReviewState} / ${evidence.reviewDepth} · accessed ${evidence.accessedAt}, as-of ${evidence.asOfDate}`,
    `Evidence limitations: ${markdownSafe(limitations)}`,
  ].join("<br/>");
}

function renderDecisionCellEvidence(cell, product, assertionsById, evidenceById) {
  const lines = [];
  for (const [role, ids] of [["Support evidence", cell.supportAssertionIds], ["Delivery evidence", cell.availabilityAssertionIds]]) {
    if (ids.length === 0) {
      if (role === "Support evidence") lines.push("**Support evidence:** No active cell-level support assertion.");
      continue;
    }
    for (const assertionId of ids) {
      const assertion = assertionsById.get(assertionId);
      const evidence = assertion ? evidenceById.get(assertion.evidenceId) : undefined;
      if (!assertion || !evidence) throw new Error(`${product.productId}/${cell.capabilityId}: unresolved ${role.toLowerCase()} ${assertionId}`);
      lines.push(assertionEvidenceLine(role, assertion, evidence, product));
    }
  }
  lines.push(`**Cell review:** as-of ${cell.asOfDate}. ${markdownSafe(cell.rationale)}`);
  if (cell.applicabilityRationale) lines.push(`**Applicability:** ${markdownSafe(cell.applicabilityRationale)}`);
  lines.push(`**Cell limitation:** ${markdownSafe(cell.limitation)}`);
  return lines.join("<br/>");
}

export function renderMarketDecisionSupport(context) {
  const { manifest, market } = context;
  const productById = new Map(market.products.map(product => [product.productId, product]));
  const rowByProduct = new Map(market.benchmarkRows.map(row => [row.productId, row]));
  const assertionsById = new Map(market.evidenceAssertions.map(assertion => [assertion.assertionId, assertion]));
  const evidenceById = new Map(market.evidence.map(evidence => [evidence.evidenceId, evidence]));
  const maturity = new Map(market.gaepMaturity.map(entry => [entry.capabilityId, entry.maturityState]));
  const categories = new Map(market.marketCategories.map(category => [category.categoryId, category]));
  const productRows = market.products.map(product => `| ${product.productId} · [${product.canonicalName}](${product.officialUri}) | ${product.categoryIds.map(id => `${id} · ${markdownSafe(categories.get(id)?.name ?? "Unknown category")}`).join("<br/>")} | ${product.lastReviewedAt} · ${product.status} | Identity/overview link only; cell evidence appears only through assertion relationships below. |`).join("\n");
  const methodologyRows = market.methodologyBindings.map(binding => `| ${binding.methodologyId} · ${markdownSafe(binding.canonicalName)} | ${binding.identityType}${binding.p01ReferenceId ? ` · ${binding.p01ReferenceId}` : ""} | ${markdownSafe(binding.limitation)} |`).join("\n");
  const capabilitySections = market.capabilities.map(capability => {
    const rows = market.products.map(product => {
      const cell = rowByProduct.get(product.productId)?.cells.find(candidate => candidate.capabilityId === capability.capabilityId);
      if (!cell) throw new Error(`${product.productId}/${capability.capabilityId}: missing canonical benchmark cell`);
      return `| <!-- CELL:${capability.capabilityId}:${product.productId} -->${product.productId} · ${markdownSafe(product.canonicalName)} | ${supportDisplay(cell.supportLevel)} | ${deliveryDisplay(cell.deliveryState)} | ${renderDecisionCellEvidence(cell, product, assertionsById, evidenceById)} |`;
    }).join("\n");
    const cells = market.products.map(product => rowByProduct.get(product.productId).cells.find(cell => cell.capabilityId === capability.capabilityId));
    const support = countBy(cells.map(cell => cell.supportLevel));
    return [
      `### ${capability.capabilityId} — ${capability.name}`,
      "",
      capability.definition,
      "",
      `**GAEP maturity (separate from market support):** ${manifest.statePolicy.labels[maturity.get(capability.capabilityId) ?? "unknown-not-assessed"]}. **Market cells:** ${support.get("verified-supported") ?? 0} Verified · ${support.get("partially-supported") ?? 0} Partial · ${support.get("unknown") ?? 0} Unknown.`,
      "",
      "<details>",
      `<summary><strong>Compare all ${market.products.length} Products for ${capability.capabilityId}</strong></summary>`,
      "",
      "| Product | Support | Delivery | Exact evidence, dates, and limitation |",
      "|---|---|---|---|",
      rows,
      "",
      "</details>",
    ].join("\n");
  }).join("\n\n");
  const capabilityContents = market.capabilities.map(capability => `- [${capability.capabilityId} — ${capability.name}](#${capability.capabilityId.toLowerCase()}--${capability.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")})`).join("\n");
  return [
    "<!-- GENERATED FILE: complete deterministic GAEP-REG-013 decision-support projection. Do not edit manually. -->",
    "",
    "# GAEP Product × Capability Decision Guide",
    "",
    `Use this generated guide to inspect all ${market.products.length * market.capabilities.length} evidence-bounded cells without opening raw JSON. It is bound to ${market.registryId} v${market.version}, research as-of ${market.researchAsOf}.`,
    "",
    "> **Decision boundary:** there is no universal winner or aggregate score. Product support, delivery, evidence freshness, limitations, and scenario fit remain separate. GAEP maturity describes this repository only and never changes a market cell.",
    "",
    "> **Unknown rule:** Unknown means no active reviewed assertion established support for this Product/capability cell. It is not “No,” “unsupported,” or evidence of absence.",
    "",
    "[Return to the main GAEP Guide](./GAEP_GUIDE.md#market-and-capability-decision-support)",
    "",
    "## Executive category and scenario frame",
    "",
    `The registry covers ${market.marketCategories.length} market categories and ${market.scenarios.length} adoption scenarios. Start with the job, required evidence, fit/non-fit boundary, stewardship capacity, and a predeclared proof-of-value measure; then inspect cell evidence below.`,
    "",
    "<details>", "<summary><strong>Show category definitions</strong></summary>", "",
    ...market.marketCategories.map(category => `- **${category.categoryId} · ${category.name}** — ${category.definition}`),
    "", "</details>",
    "",
    "<details>", "<summary><strong>Show scenario fit and non-fit boundaries</strong></summary>", "",
    ...market.scenarios.map(scenario => `- **${scenario.scenarioId} · ${scenario.name}** — fit: ${scenario.fitConditions.join("; ")} Non-fit: ${scenario.nonFitConditions.join("; ")}`),
    "", "</details>",
    "",
    "## Evaluated Product identities",
    "",
    "| Product identity and overview | Category | Reviewed/status | Boundary |", "|---|---|---|---|", productRows,
    "",
    "## Methodologies and references — outside Product scoring",
    "",
    "| Methodology/reference | P01 relationship | Limitation |", "|---|---|---|", methodologyRows,
    "",
    "## Capability index", "", capabilityContents,
    "",
    "## Complete Product × capability projection", "", capabilitySections,
    "",
    "## Maintainer projection binding",
    "",
    "<details>", "<summary><strong>Show exact canonical digest and deterministic ownership</strong></summary>", "",
    `- Registry: ${market.registryId} v${market.version} · schema ${market.schemaVersion} · SHA-256 \`${manifest.canonicalSources.find(entry => entry.kind === "market-registry").sha256}\``,
    `- Generated output: \`${manifest.generation.decisionSupportOutputPath}\``,
    `- Renderer: \`${manifest.generation.rendererPath}\``,
    "- Regenerate with `npm run render:guideline`; fail stale output with `npm run check:guideline-projection`.",
    "", "</details>",
    "",
  ].join("\n");
}

function renderScenarioGuide(market) {
  const rows = market.scenarios.map(scenario => `| ${scenario.scenarioId} · ${markdownSafe(scenario.name)} | ${markdownSafe(scenario.fitConditions.join("; "))} | ${markdownSafe(scenario.nonFitConditions.join("; "))} |`).join("\n");
  return generatedBlock("SCENARIO_GUIDE", [
    visual("scenario-choice", "Scenario-led adoption choice", "TD", [
      '  need["State the exact job and required evidence"] --> scenario["Select the closest governed scenario"]',
      '  scenario --> fit{"Fit conditions hold and non-fit conditions do not?"}',
      '  fit -- "No" --> narrow["Use or buy the narrower specialist Product"]',
      '  fit -- "Yes" --> augment["Decide what GAEP augments; keep incumbent authorities"]',
      '  augment --> measure["Predeclare baseline, observation window, burden countermetric, and decision threshold"]',
      '  measure --> pilot["Run bounded proof of value"] --> human["Human adoption decision"]',
    ].join("\n")),
    "",
    "| Scenario | Fit condition | Non-fit boundary |",
    "|---|---|---|",
    rows,
    "",
    "#### Proof-of-value measures remain proposals",
    "",
    ...market.proofOfValueMetrics.map(metric => `- **${metric.metricId} · ${metric.name}** — ${metric.measurementState}. ${metric.definition} Threshold: ${metric.decisionThreshold}`),
  ].join("\n"));
}

function renderMethodologyGuide(catalog, market) {
  const bindings = new Map(market.methodologyBindings.filter(entry => entry.p01ReferenceId).map(entry => [entry.p01ReferenceId, entry]));
  const cards = catalog.references.map(reference => {
    const binding = bindings.get(reference.referenceId);
    return [
      `<details><summary><strong>${reference.referenceId} · ${reference.canonicalName}</strong></summary>`,
      "",
      `Official source: [${reference.officialUri}](${reference.officialUri})`,
      "",
      `- **Type / authority:** ${reference.referenceType} · ${reference.issuingAuthority}`,
      `- **Exact version:** ${reference.versionOrEdition} · evidence ${reference.evidenceStatus} · reviewed ${reference.contentReview.date}`,
      `- **GAEP concerns:** ${reference.gaepConcernIds.join(", ")}${binding ? ` · P02 market binding ${binding.methodologyId}` : ""}`,
      `- **Use boundary:** ${reference.claimLanguage}`,
      `- **Limitations:** ${reference.limitations.join(" ")}`,
      `- **Review trigger:** ${reference.reviewTrigger}`,
      "",
      "</details>",
    ].join("\n");
  }).join("\n\n");
  const deferred = catalog.deferredCandidates.map(entry => `- **${entry.referenceId} · ${entry.canonicalName}** — ${entry.status}. ${entry.reviewTrigger}`).join("\n");
  return generatedBlock("METHODOLOGY_GUIDE", [
    `Bound to **${catalog.catalogId} v${catalog.version}**, checked **${catalog.freshnessCheckedAt}**. It contains ${catalog.concerns.length} GAEP concerns, ${catalog.references.length} assessed references, ${catalog.mappings.length} exact concern mappings, and ${catalog.deferredCandidates.length} deferred candidates.`,
    "",
    `> ${catalog.claimBoundary}`,
    "",
    cards,
    "",
    "#### Deferred—not materially relied on",
    "",
    deferred,
  ].join("\n"));
}

function renderClaimLedger(market) {
  const claims = market.claims.map(claim => [
    `#### ${claim.claimId} · ${claim.claimClass}`,
    "",
    `> ${claim.wording}`,
    "",
    `- **Disposition:** ${claim.disposition}`,
    `- **Authority (accepted P02 compatibility metadata):** ${claim.approvalState}; ${claim.publicationState}; owner role ${claim.ownerRole}`,
    `- **Limitations:** ${claim.limitations.join(" ")}`,
    `- **Required qualifiers:** ${claim.requiredQualifiers.join(" ")}`,
    `- **Freshness trigger:** ${claim.freshnessTrigger}`,
  ].join("\n")).join("\n\n");
  return generatedBlock("CLAIM_LEDGER", [
    "> Accepted P02 compatibility boundary: `ownerRole` and Product Owner wording below are historical canonical claim metadata. They do not assign universal journey accountability; the P03-C2 RACI contract governs the projected enterprise role view.",
    "",
    claims,
  ].join("\n"));
}

function renderMaintenanceContract(manifest) {
  const sources = manifest.canonicalSources.map(binding => `| ${binding.kind} | \`${binding.identity}\`${binding.version ? ` v${binding.version}` : ""} | \`${binding.path}\` | \`${binding.sha256}\` |`).join("\n");
  const layers = manifest.audienceLayers.map(layer => `- **${layer.title}** — ${layer.primaryAudience}; ${layer.readingTimeMinutes}-minute route`).join("\n");
  return generatedBlock("MAINTENANCE_CONTRACT", [
    `**Projection contract:** ${manifest.registryId} v${manifest.version} · schema ${manifest.schemaVersion} · ${manifest.approval.state} · ${manifest.approval.publicationState}.`,
    "",
    "| Source role | Exact identity | Repository path | SHA-256 |",
    "|---|---|---|---|",
    sources,
    "",
    "**Required progressive layers:**",
    "",
    layers,
    "",
    `**Required visual inventory:** ${manifest.requiredVisuals.map(entry => entry.visualId).join(", ")}. All are vertical (TD/TB), use text labels, and rely on host light/dark Mermaid theming.`,
    "",
    "**Deterministic commands:**",
    "",
    "- `npm run validate:guideline` — strict Schema, binding, lifecycle, authority, and command validation",
    "- `npm run render:guideline` — regenerate the bundled Markdown from canonical inputs and this template",
    "- `npm run check:guideline-projection` — fail on manual edits or stale generated facts",
    "- `npm run test:guideline` — run Schema, hostile semantic, projection, packaging, and drift coverage",
  ].join("\n"));
}

function sequenceVisual(id, title, lines) {
  return `<!-- GAEP-SEQUENCE:${id} -->\n\n**${title}**\n\n\`\`\`mermaid\n%% ${title}\nsequenceDiagram\n${lines.join("\n")}\n\`\`\``;
}

function roleLabel(roleId, responsibility) {
  return responsibility.roleArchetypes.find(entry => entry.roleId === roleId)?.label ?? roleId;
}

function renderEnterpriseOpening() {
  return generatedBlock("ENTERPRISE_OPENING", [
    "**GAEP is an evidence-governed Product-to-Operate decision system.** It exists because unmanaged AI-assisted Product and software work can turn stale context, plausible inference, missing accountability, and tool output into irreversible architecture, code, risk, release, or operational decisions.",
    "",
    "GAEP is not an autonomous executive, a universal software-delivery platform, a standards-conformance claim, or a replacement for Product, architecture, engineering, security, privacy, risk, legal, quality, release, service, operations, assurance, or audit authority.",
    "",
    "The mental model is: **exact evidence → bounded AI-assisted candidate → human challenge → accountable acceptance → explicit governed commit → separately authorized downstream work → operating evidence and feedback**. AI can inspect, propose, compare, and challenge. Humans decide scope, evidence sufficiency, exceptions, acceptance, risk, implementation, release, and operations within their actual organizational authority.",
    "",
    "The installed runtime currently governs Product/Initiative definition through P0–P4 readiness and handoff. Product Design execution, architecture-bound backlog, repository allocation, implementation agents, CI/CD, release, deployment, and operations are target capabilities: planned or partial, non-executable here, and subject to later authorization.",
  ].join("\n"));
}

function renderEntryPaths() {
  const flow = visual("enterprise-entry-paths", "Newcomer and mid-journey entry routes", "TD", [
    '  context["Describe the real starting context"] --> route{"Which entry path applies?"}',
    '  route --> newProduct["New Product"]',
    '  route --> existing["Existing Product / active Initiative"]',
    '  route --> midway["Discovery / architecture / backlog already exists"]',
    '  route --> repository["Existing implementation repository"]',
    '  route --> highRisk["Regulated, high-risk, AI/data Product"]',
    '  route --> operational["Operational change or incident-driven evolution"]',
    '  newProduct --> assess["Bounded current-state assessment"]',
    '  existing --> assess', '  midway --> assess', '  repository --> assess', '  highRisk --> assess', '  operational --> assess',
    '  assess --> evidence{"Artifacts, source quality, architecture, decisions, assumptions, freshness, repositories, operations, governance gaps sufficient?"}',
    '  evidence -- "No" --> gap["Record gaps, owners, blockers, and guided work"] --> assess',
    '  evidence -- "Yes" --> position["Select earliest checkpoint needing governed evidence — do not restart by default"]',
    '  position --> authority["Apply competency, accountability, assurance, and authority gates"]',
  ].join("\n"));
  const firstSession = sequenceVisual("entry-selection", "First session and entry-path selection", [
    "actor participant as Initiative lead",
    "participant gaep as GAEP runtime",
    "participant accountable as Accountable business owner",
    "participant assurer as Independent assurance",
    "participant->>gaep: Describe Product, Initiative, repository, risk, and operating context",
    "gaep-->>participant: Request exact artifacts, source quality, decisions, freshness, and governance gaps",
    "participant->>gaep: Supply available evidence or continue with named gaps",
    "gaep-->>accountable: Candidate current-state assessment and proposed entry checkpoint",
    "accountable->>assurer: Request independent review when risk/applicability requires it",
    "assurer-->>accountable: Findings, limitations, or unresolved assurance requirement",
    "accountable-->>gaep: Accept bounded entry decision or return for revision",
    "gaep-->>participant: Current checkpoint, blockers, next valid action; no automatic restart",
  ]);
  const rows = [
    ["New Product", "Problem/user/outcome evidence; optional Sources", "Product definition via `@gaep /initialize`"],
    ["Existing Product", "Existing Product artifacts and readable evidence", "Adopt/current-state assessment; `@gaep /adopt` where supported"],
    ["Existing Product + active Initiative", "Initiative identity, scope, decisions, Source state", "Resume earliest stale/missing governed checkpoint"],
    ["Already in discovery", "Discovery evidence, assumptions, outcomes, Source lineage", "Assess Product/Initiative/Source foundation; continue at discovery if sufficient"],
    ["Already in architecture", "Business/domain/solution decisions, alternatives, risks", "Assess earlier evidence and enter at earliest ungoverned architecture dependency"],
    ["Existing backlog", "Backlog, criteria, dependencies, architecture and repository mappings", "Current runtime can assess through handoff; backlog execution remains target-only"],
    ["Existing repository", "Topology, code, tests, pipelines, decisions, operational evidence", "Current-state assessment; repository execution remains target-only"],
    ["Regulated/high-risk or AI/data", "Risk class, jurisdiction, data/model/provider, assurance and authority", "Classification/applicability plus competency and independent-assurance gates"],
    ["Operational change/incident", "Service observations, incident/recovery evidence, prior decisions", "Bound a new Initiative; operations execution remains target-only"],
  ].map(row => `| ${row.join(" | ")} |`).join("\n");
  return generatedBlock("ENTRY_PATHS", [flow, "", firstSession, "", "| Entry path | Required assessment evidence | Honest route |", "|---|---|---|", rows, "", "**Every mid-journey assessment covers:** available artifacts; Source quality and freshness; architectural knowledge; prior decisions; unresolved assumptions; repository state; operational evidence; and missing governance records. Missing evidence stays visible and does not force a fictitious restart or approval."].join("\n"));
}

function renderCompetencyAndAuthority(responsibility, runtimePresentation, manifest, targetExecution) {
  const gateway = visual("competency-gateway", "Role- and risk-based competency gateway", "TD", [
    '  activity["Select bounded checkpoint / substep"] --> roles["Resolve required role archetypes"]',
    '  roles --> risk["Apply Initiative risk, data, AI, security, privacy, release, and operations profile"]',
    '  risk --> scenario["Evaluate scenario evidence — not title or confidence"]',
    '  scenario --> decision{"Competence, accountability, and assurance sufficient?"}',
    '  decision -- "Yes" --> ready["Ready for bounded activity"]',
    '  decision -- "Guidance needed" --> guided["Ready with guidance"]',
    '  decision -- "Skill gap" --> develop["Competency development required"]',
    '  decision -- "No accountable authority" --> accountable["Accountable role required"]',
    '  decision -- "Independence required" --> assurance["Independent assurance required"]',
    '  ready --> boundary["Competence does not grant authority"]', '  guided --> boundary',
  ].join("\n"));
  const sequence = sequenceVisual("competency-assessment", "Competency assessment and guided-participation decision", [
    "actor participant as Candidate participant",
    "participant gaep as GAEP competency projection",
    "participant practitioner as Qualified practitioner",
    "participant accountable as Accountable decision role",
    "participant assurer as Independent assurance",
    "participant->>gaep: Select bounded activity and declared role",
    "gaep-->>participant: Required competencies and risk-based scenario evidence",
    "participant->>practitioner: Demonstrate scenario handling, failure response, and evidence",
    "practitioner-->>gaep: Observed evidence and guidance requirement",
    "gaep-->>accountable: Gateway outcome; competence and authority shown separately",
    "accountable->>assurer: Request independent review when required",
    "assurer-->>accountable: Assurance disposition",
    "accountable-->>participant: Authorized participation decision outside GAEP",
  ]);
  const competencyRows = responsibility.competencyDimensions.map(entry => `| \`${entry.competencyId}\` · ${entry.label} | ${markdownSafe(entry.scenarioEvidence)} |`).join("\n");
  const levels = responsibility.participationLevels.map(entry => `| ${entry.label} | ${markdownSafe(entry.evidenceRequirement)} |`).join("\n");
  const authority = responsibility.authorityTypes.map(entry => `| ${entry.label} | ${entry.decisionRoleIds.map(id => `\`${id}\``).join(", ")} | Separate from RACI and competence; actual appointment remains organizational. |`).join("\n");
  const checkpointRaci = runtimePresentation.checkpoints.map(checkpoint => {
    const steps = checkpoint.executionSubsteps;
    const unique = values => [...new Set(values)].join(", ") || "—";
    return `| \`${checkpoint.checkpointId}\` · ${checkpoint.label} | ${unique(steps.flatMap(step => step.responsibleRoleIds))} | ${unique(steps.flatMap(step => step.accountableRoleId ? [step.accountableRoleId] : []))} | ${unique(steps.flatMap(step => [...step.consultedRoleIds, ...step.informedRoleIds, ...step.independentAssuranceRoleIds]))} |`;
  }).join("\n");
  const targetPatterns = new Map(targetExecution.executionPatterns.map(entry => [entry.patternId, entry]));
  const targetNodes = new Map(manifest.lifecycleNodes.map(entry => [entry.nodeId, entry]));
  const participationRows = responsibility.roleArchetypes.map(role => {
    const current = runtimePresentation.checkpoints.flatMap(checkpoint => {
      const codes = new Set();
      for (const step of checkpoint.executionSubsteps) {
        if (step.responsibleRoleIds.includes(role.roleId)) codes.add("R");
        if (step.accountableRoleId === role.roleId) codes.add("A");
        if (step.consultedRoleIds.includes(role.roleId)) codes.add("C");
        if (step.informedRoleIds.includes(role.roleId)) codes.add("I");
        if (step.independentAssuranceRoleIds.includes(role.roleId)) codes.add("IA");
      }
      return codes.size ? [`\`${checkpoint.checkpointId}\` (${[...codes].join("/")})`] : [];
    });
    const target = targetExecution.nodeProfiles.flatMap(profile => {
      const pattern = targetPatterns.get(profile.patternId);
      const codes = [];
      if (pattern.responsibleRoleIds.includes(role.roleId)) codes.push("R");
      if (pattern.accountableRoleId === role.roleId) codes.push("A");
      if (pattern.requiredRoleIds.includes(role.roleId) && !pattern.responsibleRoleIds.includes(role.roleId) && pattern.accountableRoleId !== role.roleId) codes.push("C");
      if (pattern.assuranceRoleIds.includes(role.roleId)) codes.push("IA");
      const node = targetNodes.get(profile.nodeId);
      return codes.length ? [`\`${profile.nodeId}\` ${node.title} (${[...new Set(codes)].join("/")})`] : [];
    });
    return `| \`${role.roleId}\` · ${role.label} | ${current.join("<br/>") || "—"} | ${target.join("<br/>") || "—"} |`;
  }).join("\n");
  return generatedBlock("COMPETENCY_AUTHORITY", [gateway, "", sequence, "", `> **Authority boundary:** ${responsibility.authorityBoundary}`, "", "#### Participation levels", "", "| Level | Required scenario evidence |", "|---|---|", levels, "", "<details>", "<summary><strong>Show all competency dimensions and scenario evidence</strong></summary>", "", "| Competency | Demonstration evidence |", "|---|---|", competencyRows, "", "</details>", "", "#### Current-checkpoint RACI overview", "", "R = Responsible · A = Accountable · C = Consulted · I = Informed · IA = independent assurance. Exactly one A is required for each governed decision; this overview may show several A roles because a checkpoint contains several substeps.", "", "| Checkpoint | R | A | C / I / independent assurance |", "|---|---|---|---|", checkpointRaci, "", "<details>", "<summary><strong>Role-to-lifecycle participation — current and target</strong></summary>", "", "Target participation is proposed and non-executable. A role mapping does not appoint a person or grant authority.", "", "| Role archetype | Current checkpoint participation | Target lifecycle participation |", "|---|---|---|", participationRows, "", "</details>", "", "#### Authority and assurance — separate from RACI", "", "| Authority | Candidate decision-role archetypes | Boundary |", "|---|---|---|", authority].join("\n"));
}

function renderCheckpointExecution(runtimePresentation, manifest) {
  const phaseRows = [...new Map(runtimePresentation.checkpoints.map(checkpoint => [checkpoint.phase.id, checkpoint.phase])).values()].map(phase => {
    const checkpoints = runtimePresentation.checkpoints.filter(entry => entry.phase.id === phase.id);
    const roles = selector => [...new Set(checkpoints.flatMap(entry => entry.executionSubsteps.flatMap(selector)))].join(", ") || "—";
    return `| ${phase.order} · ${phase.label} | ${roles(step => step.responsibleRoleIds)} | ${roles(step => step.accountableRoleId ? [step.accountableRoleId] : [])} | ${roles(step => step.independentAssuranceRoleIds)} |`;
  }).join("\n");
  const details = runtimePresentation.checkpoints.map(checkpoint => {
    const id = checkpoint.checkpointId.replaceAll("-", "_");
    const steps = checkpoint.executionSubsteps.slice().sort((a, b) => a.order - b.order);
    const flowLines = steps.flatMap((step, index) => [
      `  ${id}_${index}["${step.order}. ${mermaidSafe(step.purpose)}<br/>${step.maturity} · ${step.recordEffect}"]`,
      ...(index > 0 ? [`  ${id}_${index - 1} --> ${id}_${index}`] : []),
    ]);
    flowLines.push(`  ${id}_${steps.length - 1} -. "failure / blocker" .-> ${id}_revise["Preserve evidence · revise · retry or escalate"]`);
    flowLines.push(`  ${id}_revise --> ${id}_0`);
    const participants = [...new Set(steps.flatMap(step => [...step.responsibleRoleIds, ...(step.accountableRoleId ? [step.accountableRoleId] : []), ...step.independentAssuranceRoleIds]))];
    const participantLines = participants.map((role, index) => `participant role${index} as ${role}`);
    const sequenceLines = steps.flatMap(step => {
      const responsible = `role${participants.indexOf(step.responsibleRoleIds[0])}`;
      const accountable = step.accountableRoleId ? `role${participants.indexOf(step.accountableRoleId)}` : responsible;
      const message = mermaidSafe(`${step.order}. ${step.purpose}${step.currentAction ? ` Action: ${step.currentAction.value}` : ""}`);
      return step.interactionType === "ai-assisted-candidate"
        ? [`${responsible}->>gaep: ${message}`, `gaep-->>${responsible}: Candidate only · ${step.stateAfter}`]
        : step.interactionType === "governed-commit"
          ? [`${responsible}->>${accountable}: ${message}`, `${accountable}->>gaep: Exact acceptance / explicit commit or reject`, `gaep-->>${responsible}: ${step.stateAfter}; authority remains bounded`]
          : [`${responsible}->>gaep: ${message}`, `gaep-->>${responsible}: ${step.stateAfter}; no authority created`];
    });
    const raciRows = steps.map(step => `| \`${step.stepId}\` | ${step.responsibleRoleIds.join(", ")} | ${step.accountableRoleId ?? "— (no decision)"} | C: ${step.consultedRoleIds.join(", ") || "—"}<br/>I: ${step.informedRoleIds.join(", ") || "—"}<br/>Assurance: ${step.independentAssuranceRoleIds.join(", ") || "—"} |`).join("\n");
    const stepDetails = steps.map(step => `- **${step.order} · \`${step.stepId}\`** — ${step.purpose} **Before/after:** ${step.stateBefore} → ${step.stateAfter}. **Action:** ${step.currentAction ? `\`${step.currentAction.value}\` (${step.currentAction.kind})` : "none; inspect only"}. **Evidence:** consumes ${step.evidenceConsumed.join("; ")}; produces ${step.evidenceProduced.join("; ")}. **Criteria:** ${step.reviewCriteria.join("; ")}. **Failure/blocker:** ${step.failureConditions.join("; ")} ${step.blockerBehavior} **Retry:** ${step.retryRevisionPath} **Audit:** ${step.auditEventEffect} **Authority:** ${step.authorityEffect}`).join("\n");
    const aiSteps = steps.filter(step => step.interactionType === "ai-assisted-candidate").map(step => step.purpose).join(" ") || "No AI activity is claimed.";
    const humanSteps = steps.filter(step => step.interactionType !== "ai-assisted-candidate").map(step => step.purpose).join(" ");
    return [
      "<details>", `<summary><strong>${checkpoint.order} · ${checkpoint.label}</strong> · ${maturityLabel(manifest, checkpoint.implementationMaturity)}</summary>`, "",
      `**Purpose:** ${checkpoint.purpose}`, "", `**Why it exists:** ${checkpoint.whyItExists}`, "",
      `**When it starts / prerequisites:** ${checkpoint.entryConditions.join(" ")} Prerequisites: ${checkpoint.prerequisites.join(", ") || "none"}.`, "",
      `**Roles and competency:** roles ${checkpoint.requiredRoleArchetypeIds.map(id => `\`${id}\``).join(", ")}; competencies ${checkpoint.requiredCompetencyProfileIds.map(id => `\`${id}\``).join(", ")}.`, "",
      `**Inputs:** ${checkpoint.requiredInputContractIds.join(", ")}. **Questions:** ${checkpoint.prominentQuestions.join(" ")}`, "",
      visual(`checkpoint-${checkpoint.checkpointId}-flow`, `${checkpoint.label} substeps and return path`, "TD", flowLines.join("\n")), "",
      sequenceVisual(`checkpoint-${checkpoint.checkpointId}`, `${checkpoint.label} — current canonical execution sequence`, [...participantLines, "participant gaep as GAEP runtime", ...sequenceLines]), "",
      "**Ordered substeps**", "", stepDetails, "",
      `**AI activity:** ${aiSteps}`, "", `**Human activity:** ${humanSteps}`, "",
      `**Candidate outputs:** ${checkpoint.candidateOutputContractIds.join(", ")}. **Governed outputs:** ${checkpoint.governedOutputContractIds.join(", ")}. **Decision records:** ${checkpoint.decisionRecordContractIds.join(", ")}.`, "",
      `**Evidence and Provenance:** ${checkpoint.evidenceRequirements.join(" ")}`, "",
      "**Substep RACI**", "", "| Step | R | A | C / I / independent assurance |", "|---|---|---|---|", raciRows, "",
      `**Decision and authority:** ${checkpoint.authorityEffects.join(" ")}`, "",
      `**Blockers / exception / escalation:** ${checkpoint.blockers.join("; ")}. ${checkpoint.exceptionPath} ${checkpoint.escalationPath}`, "",
      `**Exit / next:** ${checkpoint.exitCriteria.join(" ")} Next valid transitions: ${checkpoint.nextValidTransitions.join(", ") || "none in current runtime"}.`, "",
      `**Current limitations:** ${checkpoint.limitations}`, "", `**Target evolution:** ${checkpoint.targetEvolution}`, "", "</details>",
    ].join("\n");
  }).join("\n\n");
  return generatedBlock("CHECKPOINT_EXECUTION", ["#### Executive phase-level RACI", "", "| Phase | R | A | Independent assurance |", "|---|---|---|---|", phaseRows, "", "#### Every current checkpoint — canonical substeps, RACI, sequence, and authority", "", details].join("\n"));
}

function renderTargetExecution(manifest, targetExecution) {
  const patterns = new Map(targetExecution.executionPatterns.map(entry => [entry.patternId, entry]));
  const nodes = new Map(manifest.lifecycleNodes.map(entry => [entry.nodeId, entry]));
  const overviewRows = targetExecution.nodeProfiles.map(profile => {
    const node = nodes.get(profile.nodeId);
    const pattern = patterns.get(profile.patternId);
    const consulted = pattern.requiredRoleIds.filter(id => !pattern.responsibleRoleIds.includes(id) && id !== pattern.accountableRoleId);
    return `| \`${profile.nodeId}\` · ${node.title} | ${pattern.responsibleRoleIds.join(", ")} | ${pattern.accountableRoleId} | C: ${consulted.join(", ") || "—"}<br/>IA: ${pattern.assuranceRoleIds.join(", ") || "context-dependent"} |`;
  }).join("\n");
  const details = targetExecution.nodeProfiles.map(profile => {
    const node = nodes.get(profile.nodeId);
    const pattern = patterns.get(profile.patternId);
    const participants = [...new Set([...pattern.responsibleRoleIds, pattern.accountableRoleId, ...pattern.assuranceRoleIds])];
    const messages = pattern.plannedSubsteps.flatMap((step, index) => {
      const from = `role${index % Math.max(pattern.responsibleRoleIds.length, 1)}`;
      return index === pattern.plannedSubsteps.length - 1
        ? [`${from}->>accountable: ${mermaidSafe(step)}`, `accountable-->>${from}: Planned decision or return for revision; no executable action`]
        : [`${from}->>gaep: ${mermaidSafe(step)}`, `gaep-->>${from}: Planned candidate/evidence projection only`];
    });
    const flowLines = pattern.plannedSubsteps.flatMap((step, index) => [`  ${profile.nodeId.replaceAll("-", "_")}_${index}["${index + 1}. ${mermaidSafe(step)}<br/>Target — planned, not executable"]`, ...(index ? [`  ${profile.nodeId.replaceAll("-", "_")}_${index - 1} --> ${profile.nodeId.replaceAll("-", "_")}_${index}`] : [])]);
    return ["<details>", `<summary><strong>${node.order} · ${node.title}</strong> · Target — planned, not executable</summary>`, "", `**Purpose / why:** ${node.targetIntent}`, "", `**When/prerequisites:** Current/target transition and mapped capabilities ${node.capabilityIds.join(", ")} must be sufficient; later authorized implementation is required.`, "", `**Roles / competency:** ${pattern.requiredRoleIds.map(id => `\`${id}\``).join(", ")}; ${pattern.competencyIds.map(id => `\`${id}\``).join(", ")}.`, "", `**Inputs:** ${profile.inputs.join("; ")}. **Questions:** ${profile.questions.join(" ")}`, "", visual(`target-${profile.nodeId}-flow`, `${node.title} planned substeps`, "TD", flowLines.join("\n")), "", sequenceVisual(`target-${profile.nodeId}`, `${node.title} — Target — planned, not executable`, [...participants.map((role, index) => `participant role${index} as ${role}`), `participant accountable as ${pattern.accountableRoleId}`, "participant gaep as GAEP target projection", ...messages]), "", `**Planned substeps:** ${pattern.plannedSubsteps.map((step, index) => `${index + 1}. ${step}`).join(" ")}`, "", `**AI / human boundary:** a future GAEP implementation may prepare candidates; ${pattern.responsibleRoleIds.join(", ")} perform work, ${pattern.accountableRoleId} owns the bounded decision, and ${pattern.assuranceRoleIds.join(", ") || "no default independent role"} provides assurance when applicable. No command exists here.`, "", `**Candidate / governed outputs:** ${profile.outputs.join("; ")}; no current governed output exists.`, "", `**RACI:** R ${pattern.responsibleRoleIds.join(", ")} · A ${pattern.accountableRoleId} · C ${pattern.requiredRoleIds.filter(id => !pattern.responsibleRoleIds.includes(id) && id !== pattern.accountableRoleId).join(", ") || "—"} · I Initiative lead · independent assurance ${pattern.assuranceRoleIds.join(", ") || "context-dependent"}.`, "", `**Blockers / exception:** ${profile.blockers.join("; ")}. No planned node may bypass current prerequisites or organizational authority.`, "", `**Exit / next:** ${profile.exitCriteria.join(" ")} The next transition remains planned and non-executable.`, "", `**Authority / limitation:** ${targetExecution.authorityBoundary}`, "", "</details>"].join("\n");
  }).join("\n\n");
  return generatedBlock("TARGET_EXECUTION", ["#### Target-lifecycle RACI overview — planned, not executable", "", "| Target node | R | A | C / independent assurance |", "|---|---|---|---|", overviewRows, "", details].join("\n"));
}

function renderExceptionSequences() {
  const sequences = [
    sequenceVisual("source-review-commit", "Source selection, review, candidate recording, acceptance, and commit", ["actor contributor as Domain expert", "participant gaep as GAEP runtime", "participant accountable as Business owner", "contributor->>gaep: Select exact File/Folder; link remains metadata only", "gaep-->>contributor: Extraction limits, digest, reviewed content, Unknowns", "contributor->>gaep: @gaep /intake then @gaep /record", "gaep-->>accountable: Candidate Source records; not truth/Baseline/Provenance", "accountable->>gaep: Review/challenge; @gaep /accept exact digest", "accountable->>gaep: @gaep /commit CONFIRM", "gaep-->>contributor: Governed Source revision and audit event; broader authority unchanged"]),
    sequenceVisual("generic-checkpoint-loop", "Generic checkpoint execution loop", ["actor responsible as Responsible role", "participant gaep as GAEP runtime", "participant accountable as Accountable role", "participant assurer as Independent assurance", "responsible->>gaep: Inspect exact prerequisites and evidence", "gaep-->>responsible: Blockers, Unknowns, and valid current action", "responsible->>gaep: Execute current action and prepare candidate", "gaep-->>accountable: Exact candidate, digest, limitations, decisions", "accountable->>assurer: Request required independent review", "assurer-->>accountable: Findings", "accountable->>gaep: Accept exact candidate or reject/revise", "gaep-->>responsible: Explicit commit creates bounded governed state"]),
    sequenceVisual("evidence-conflict", "Evidence conflict, revision, challenge, and resolution", ["actor expert as Domain expert", "participant gaep as GAEP runtime", "participant accountable as Accountable role", "expert->>gaep: Supply conflicting exact Sources", "gaep-->>expert: Preserve both identities, provenance, conflict, and Unknown conclusion", "expert->>accountable: Challenge candidate against named criteria", "accountable-->>gaep: Reject, request revision, or record scoped unresolved decision", "gaep-->>expert: New candidate digest; prior evidence and decision history retained"]),
    sequenceVisual("missing-prerequisite", "Missing prerequisite and blocked progression", ["actor participant as Initiative lead", "participant gaep as GAEP runtime", "participant accountable as Accountable role", "participant->>gaep: Request downstream action", "gaep-->>participant: Waiting for prerequisite; named blocker and persisted prior state", "participant->>accountable: Resolve evidence/decision or assign owner", "accountable-->>gaep: Bounded disposition", "gaep-->>participant: Recompute next valid action; never bypass prerequisite silently"]),
    sequenceVisual("scoped-exception", "Decision escalation and scoped exception", ["actor responsible as Responsible role", "participant accountable as Accountable role", "participant risk as Risk/compliance specialist", "participant assurance as Independent assurance", "responsible->>accountable: Escalate material blocker with exact evidence", "accountable->>risk: Request applicability and residual-risk analysis", "risk->>assurance: Request independent challenge when required", "assurance-->>accountable: Findings and limitations", "accountable-->>responsible: Reject, defer, or authorize only the bounded exception outside GAEP", "responsible->>gaep: Record decision/evidence; no broader waiver inferred"]),
  ];
  return generatedBlock("EXCEPTION_SEQUENCES", sequences.join("\n\n"));
}

function renderEnterpriseAssurance(catalog, assurance) {
  const levels = assurance.evidenceDepthLevels.map(level => `| ${level.depthId} · ${level.label} | ${level.requiredEvidence.join("; ")} | ${level.permittedUses.join("; ")} | ${level.prohibitedUses.join("; ")} |`).join("\n");
  const referenceById = new Map(catalog.references.map(entry => [entry.referenceId, entry]));
  const references = assurance.referenceDepthAssessments.map(entry => {
    const reference = referenceById.get(entry.referenceId);
    return `| ${entry.referenceId} · ${markdownSafe(reference.canonicalName)}<br/>${markdownSafe(reference.versionOrEdition)} · ${reference.status} | ${entry.evidenceDepth}<br/>${markdownSafe(entry.reviewedCoverage)} | ${markdownSafe(entry.currentGaepMapping)}<br/>Implementation: ${markdownSafe(entry.implementationEvidence)} | ${markdownSafe(entry.assuranceState)}<br/>Gap: ${markdownSafe(entry.residualGap)}<br/>Adoption: ${markdownSafe(entry.adoptionConsequence)} |`;
  }).join("\n");
  const concerns = assurance.enterpriseConcernAssessments.map(entry => `| ${entry.concernId}<br/>${markdownSafe(entry.requiredDecision)} | ${entry.referenceFamily.join(", ")}<br/>minimum ${entry.minimumEvidenceDepth} | ${markdownSafe(entry.currentMapping)}<br/>${markdownSafe(entry.implementationEvidence)} | ${markdownSafe(entry.assuranceState)}<br/>${markdownSafe(entry.residualGap)}<br/>${markdownSafe(entry.adoptionConsequence)} |`).join("\n");
  return generatedBlock("ENTERPRISE_ASSURANCE", ["| Depth | Required evidence | Permitted use | Prohibited use |", "|---|---|---|---|", levels, "", "> **Abstract-only rejection rule:** ED1 can identify scope, edition, status, and revision watch. It cannot support normative mappings, conformance assessment, detailed implementation claims, or an enterprise selection conclusion.", "", "<details>", "<summary><strong>Show evidence-depth and control-assurance assessment for every P01 reference</strong></summary>", "", "| Reference / edition | Evidence depth / reviewed coverage | GAEP mapping / implementation evidence | Assurance, gap, and adoption consequence |", "|---|---|---|---|", references, "", "</details>", "", "#### Enterprise concern sufficiency", "", "| Concern / required decision | Reference family / minimum depth | Current mapping / implementation evidence | Assurance, residual gap, adoption consequence |", "|---|---|---|---|", concerns].join("\n"));
}

function renderClaimAssuranceAndDecision(assurance) {
  const claims = assurance.claimAssurance.map(claim => `| \`${claim.claimId}\`<br/>${markdownSafe(claim.claim)} | ${claim.claimType}<br/>${claim.scope}<br/>**${claim.status}** | Contracts: ${claim.supportingContractIds.join(", ") || "none"}<br/>Repository: ${claim.repositoryEvidence.join("<br/>") || "none"}<br/>Tests: ${claim.tests.join("<br/>") || "none"}<br/>Runtime: ${claim.runtimeEvidence.join("<br/>") || "none"} | Independent: ${claim.independentReviewState}<br/>Limitations: ${claim.limitations.join(" ")}<br/>Counter-evidence: ${claim.counterEvidence.join(" ") || "none"}<br/>Prohibited: ${claim.prohibitedInterpretation} |`).join("\n");
  const profile = assurance.decisionProfileTemplate;
  const dossier = assurance.pilotDecisionDossier;
  return generatedBlock("CLAIM_ASSURANCE_DECISION", ["#### GAEP enterprise claim assurance", "", "| Claim | Type, scope, state | Inspectable evidence | Independent state, limits, and prohibited interpretation |", "|---|---|---|---|", claims, "", "#### Organization-specific decision profile", "", `**State:** ${profile.profileState}. The evaluator must supply: ${profile.requiredInputs.join("; ")}.`, "", `**Mandatory gates stay separate:** ${profile.mandatoryGates.join("; ")}.`, "", `**Equivalent comparison criteria for GAEP and alternatives:** ${profile.comparisonCriteria.join("; ")}.`, "", `**Weighting/sensitivity rules:** ${profile.weightingRules.join("; ")}.`, "", "#### Enterprise pilot decision dossier", "", `**Current recommendation:** ${dossier.recommendationState}. ${dossier.currentDisposition}`, "", `**Allowed recommendation states:** ${dossier.allowedRecommendationStates.join("; ")}.`, "", `**Required dossier sections:** ${dossier.requiredSections.join("; ")}.`, "", "> No universal winner is produced. GAEP receives no favorable default. Unknown is not scored as No or zero. A weighted analysis is valid only after the enterprise supplies explicit weights, mandatory gates remain separate, evidence strength is visible, and sensitivity analysis is shown."].join("\n"));
}

export function renderGuideline(context) {
  const { manifest, template, catalog, market, extensionPackage, runtimePresentation, runtimeCheckpoints, responsibility, assurance, targetExecution } = context;
  const replacements = {
    ENTERPRISE_OPENING: renderEnterpriseOpening(),
    ENTRY_PATHS: renderEntryPaths(),
    COMPETENCY_AUTHORITY: renderCompetencyAndAuthority(responsibility, runtimePresentation, manifest, targetExecution),
    CHECKPOINT_EXECUTION: renderCheckpointExecution(runtimePresentation, manifest),
    TARGET_EXECUTION: renderTargetExecution(manifest, targetExecution),
    EXCEPTION_SEQUENCES: renderExceptionSequences(),
    ENTERPRISE_ASSURANCE: renderEnterpriseAssurance(catalog, assurance),
    CLAIM_ASSURANCE_DECISION: renderClaimAssuranceAndDecision(assurance),
    PROJECTION_HEADER: renderProjectionHeader(manifest),
    EXECUTIVE_FACTS: renderExecutiveFacts(catalog, market, manifest),
    EXECUTIVE_OPERATING_MODEL: renderExecutiveOperatingModel(),
    AUTHORITY_LOOP: renderAuthorityLoop(),
    QUICK_START_FLOW: renderQuickStart(manifest, extensionPackage),
    CHECKPOINT_POSITION_EXAMPLE: renderCheckpointPositionExample(runtimePresentation),
    CURRENT_RUNTIME: renderCurrentRuntime(runtimeCheckpoints, manifest),
    STATE_LEGEND: renderStateLegend(manifest, runtimePresentation),
    TARGET_LIFECYCLE: renderTargetLifecycle(manifest, market),
    TRANSITION_ROADMAP: renderTransitionRoadmap(manifest),
    ROADMAP_COVERAGE: renderRoadmapCoverage(manifest, market),
    SOURCE_LINEAGE: renderSourceLineage(manifest),
    MARKET_GUIDE: renderMarketGuide(market, manifest),
    SCENARIO_GUIDE: renderScenarioGuide(market),
    METHODOLOGY_GUIDE: renderMethodologyGuide(catalog, market),
    CLAIM_LEDGER: renderClaimLedger(market),
    MAINTENANCE_CONTRACT: renderMaintenanceContract(manifest),
  };
  let output = template;
  for (const [key, value] of Object.entries(replacements)) output = output.replaceAll(`{{${key}}}`, value);
  const unresolved = [...output.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map(match => match[1]);
  if (unresolved.length > 0) throw new Error(`unresolved Guide template placeholders: ${unresolved.join(", ")}`);
  return `${output.trim()}\n`;
}

function extractGenerated(text, id) {
  return text.match(new RegExp(`<!-- BEGIN GENERATED:${id} -->([\\s\\S]*?)<!-- END GENERATED:${id} -->`))?.[1] ?? "";
}

export function renderedGuidelineErrors(rendered, context) {
  const { manifest, catalog, market, extensionPackage, runtimePresentation } = context;
  const errors = [];
  if (!rendered.startsWith("<!-- GENERATED FILE:")) errors.push("Guide lacks generated-file warning");
  if ((rendered.match(/^# /gm) ?? []).length !== 1) errors.push("Guide must contain exactly one H1");
  for (const heading of ["## 1. Executive orientation", "## 2. Start here", "## 3. Practitioner guide", "## 4. Methodology and maintainer appendix"]) {
    if (!rendered.includes(heading)) errors.push(`Guide missing progressive layer ${heading}`);
  }
  if (!rendered.includes("## Contents") || !rendered.includes("[4. Methodology and maintainer appendix](#4-methodology-and-maintainer-appendix)")) errors.push("Guide missing progressive table of contents");
  const visible = rendered.replace(/<!--[\s\S]*?-->/g, "");
  const orientationIndex = visible.indexOf("### Why use this Guide");
  const startIndex = visible.indexOf("approximately three-minute route");
  const firstMaintenanceIndex = visible.indexOf("npm run");
  if (orientationIndex < 0 || startIndex < orientationIndex) errors.push("plain-language value, audience, and Start here route must lead the Guide");
  if (firstMaintenanceIndex >= 0 && firstMaintenanceIndex < startIndex) errors.push("maintenance commands appear before first-session orientation");
  const firstDigestIndex = visible.search(/[a-f0-9]{64}/);
  const maintainerIndex = visible.indexOf("### Maintainer and projection details");
  if (firstDigestIndex >= 0 && firstDigestIndex < maintainerIndex) errors.push("complete digests appear before collapsed maintainer details");
  for (const section of manifest.requiredSections) {
    if (!rendered.includes(`### ${section.heading}`)) errors.push(`Guide missing required section ${section.heading}`);
  }
  for (const entry of manifest.requiredVisuals) {
    const marker = `<!-- GAEP-VISUAL:${entry.visualId} -->`;
    const index = rendered.indexOf(marker);
    if (index < 0) errors.push(`Guide missing visual ${entry.visualId}`);
    else if (!rendered.slice(index, index + 500).includes(`flowchart ${entry.direction}`)) errors.push(`visual ${entry.visualId} is not ${entry.direction}`);
  }
  if (/flowchart\s+(?:LR|RL)\b/.test(rendered)) errors.push("Guide contains a long horizontal Mermaid flow");
  if (!rendered.includes("approximately 3 minutes") || !rendered.includes("approximately three-minute first session")) errors.push("Quick Start is not visibly approximately three minutes");
  for (const commandId of ["gaep.chooseFile", "gaep.chooseFolder", "gaep.addReferenceLink"]) {
    const title = extensionPackage.contributes.commands.find(entry => entry.command === commandId)?.title;
    if (!title || !rendered.includes(title)) errors.push(`Guide omits contributed source action ${commandId}`);
  }
  for (const [state, entry] of Object.entries(runtimePresentation.primaryStates)) {
    if (!rendered.includes(entry.label) || !rendered.includes(entry.marker)) errors.push(`Guide omits operational primary state ${state}`);
  }
  for (const [indicator, entry] of Object.entries(runtimePresentation.attentionIndicators)) {
    if (!rendered.includes(entry.label) || !rendered.includes(entry.marker)) errors.push(`Guide omits attention indicator ${indicator}`);
  }
  for (const position of ["Previous", "Current", "Next"]) if (!rendered.includes(position)) errors.push(`Guide omits ${position} navigation marker`);
  if (!/Static example, not live state/i.test(rendered) || !rendered.includes("@gaep /status")) errors.push("static checkpoint example falsely implies live workspace state");
  for (const state of EXPECTED_STATES) {
    if (!rendered.includes(manifest.statePolicy.labels[state])) errors.push(`Guide missing state label ${state}`);
  }
  if (!rendered.includes(manifest.statePolicy.unknownRule)) errors.push("Guide does not preserve the Unknown-not-No rule");
  if (/Unknown\s*(?:=|means|→)\s*(?:No\b|unsupported\b)/i.test(rendered)) errors.push("Guide converts Unknown into No");
  if (/Pre-Figma/i.test(rendered)) errors.push("legacy Pre-Figma wording cannot remain in the generated Guideline after systemic label migration");
  const lifecycleBlock = extractGenerated(rendered, "TARGET_LIFECYCLE");
  if (/Figma/i.test(lifecycleBlock)) errors.push("target lifecycle names Figma instead of tool-neutral Product Design");
  for (const node of manifest.lifecycleNodes) {
    const state = deriveLifecycleState(node, market, manifest);
    const expectedDiagramLabel = `${node.nodeId.replaceAll("-", "_")}["${node.order}. ${stateMarker(state, manifest)} ${node.title}`;
    const expectedTableLabel = `| ${node.order} | ${node.title} | ${manifest.statePolicy.labels[state]} |`;
    if (!lifecycleBlock.includes(expectedDiagramLabel) || !lifecycleBlock.includes(expectedTableLabel)) errors.push(`target lifecycle node ${node.nodeId} is stale or missing`);
  }
  const architectureIndex = lifecycleBlock.indexOf("Architecture decisions and quality scenarios");
  const backlogIndex = lifecycleBlock.indexOf("Architecture-bound backlog");
  if (architectureIndex < 0 || backlogIndex < 0 || architectureIndex >= backlogIndex) errors.push("rendered lifecycle puts backlog before architecture decisions");
  if (/^\s*\{\s*"(?:registryId|benchmarkRows)"/m.test(rendered) || /"benchmarkRows"\s*:/.test(rendered)) errors.push("Guide presents raw registry JSON as the human surface");
  if (!rendered.includes(path.basename(manifest.generation.decisionSupportOutputPath))) errors.push("Guide omits the complete generated market decision-support artifact link");
  for (const scenario of market.scenarios) {
    if (!rendered.includes(scenario.scenarioId) || !rendered.includes(scenario.fitConditions[0]) || !rendered.includes(scenario.nonFitConditions[0])) errors.push(`Guide omits scenario fit/non-fit ${scenario.scenarioId}`);
  }
  for (const claim of market.claims) {
    const start = rendered.indexOf(`#### ${claim.claimId}`);
    const end = rendered.indexOf("\n#### ", start + 1);
    const block = start < 0 ? "" : rendered.slice(start, end < 0 ? rendered.length : end);
    if (!block.includes(claim.disposition) || !block.includes(claim.approvalState) || !block.includes(claim.publicationState) || !block.includes(claim.limitations[0]) || !block.includes(claim.requiredQualifiers[0])) errors.push(`Guide omits claim authority or limitation ${claim.claimId}`);
  }
  for (const reference of catalog.references) {
    if (!rendered.includes(reference.referenceId) || !rendered.includes(reference.officialUri) || !rendered.includes(reference.evidenceStatus) || !rendered.includes(reference.reviewTrigger)) errors.push(`Guide omits methodology source card facts ${reference.referenceId}`);
  }
  for (const concept of manifest.sourceLifecycle.concepts) {
    for (const value of [concept.label, concept.meaning, concept.reviewBoundary, concept.revisionRule, concept.doesNotAuthorize]) if (!rendered.includes(value)) errors.push(`Guide omits source concept facts ${concept.conceptId}`);
  }
  for (const event of manifest.sourceLifecycle.events) {
    for (const value of [event.label, event.runtimeClassification, event.userAction, event.recordEffect, event.baselineReview, event.provenanceReview, event.downstreamRevalidation, event.safeWorkaround, event.doesNotAuthorize]) if (!rendered.includes(value)) errors.push(`Guide omits source lifecycle consequence ${event.eventId}`);
  }
  if (!rendered.includes(manifest.sourceLifecycle.supersessionRule)) errors.push("Guide omits explicit Source supersession rule");
  for (const command of manifest.commandSurface.chatCommands) {
    if (!["inspect", "help"].includes(command) && !rendered.includes(`/` + command)) errors.push(`Guide omits declared user command /${command}`);
  }
  if (!/not approved/i.test(rendered) || !/not published/i.test(rendered)) errors.push("Guide omits not-approved/not-published authority boundary");
  return errors;
}

export function renderedMarketDecisionSupportErrors(rendered, context) {
  const { manifest, market } = context;
  const errors = [];
  const rowByProduct = new Map(market.benchmarkRows.map(row => [row.productId, row]));
  const assertions = new Map(market.evidenceAssertions.map(entry => [entry.assertionId, entry]));
  const evidence = new Map(market.evidence.map(entry => [entry.evidenceId, entry]));
  if (!rendered.startsWith("<!-- GENERATED FILE:")) errors.push("market decision guide lacks generated-file warning");
  if ((rendered.match(/^# /gm) ?? []).length !== 1) errors.push("market decision guide must contain exactly one H1");
  if (!rendered.includes("[Return to the main GAEP Guide](./GAEP_GUIDE.md#market-and-capability-decision-support)")) errors.push("market decision guide lacks return navigation");
  if (/winner score|aggregate winner/i.test(rendered) && !/no universal winner|no aggregate score/i.test(rendered)) errors.push("market decision guide creates a winner score");
  if (/"benchmarkRows"\s*:/.test(rendered)) errors.push("market decision guide presents raw JSON as the primary experience");
  for (const line of rendered.split("\n").filter(line => line.startsWith("|"))) if ((line.match(/\|/g) ?? []).length > 5) errors.push("market decision guide table exceeds four columns");
  const productSection = rendered.slice(rendered.indexOf("## Evaluated Product identities"), rendered.indexOf("## Methodologies and references"));
  const methodologySection = rendered.slice(rendered.indexOf("## Methodologies and references"), rendered.indexOf("## Capability index"));
  for (const product of market.products) {
    if (!productSection.includes(product.productId) || !productSection.includes(product.canonicalName) || !productSection.includes(product.officialUri)) errors.push(`market decision guide omits Product identity ${product.productId}`);
  }
  for (const methodology of market.methodologyBindings) {
    if (productSection.includes(methodology.canonicalName)) errors.push(`market decision guide scores methodology ${methodology.methodologyId} as a Product`);
    if (!methodologySection.includes(methodology.methodologyId) || !methodologySection.includes(methodology.limitation)) errors.push(`market decision guide omits methodology boundary ${methodology.methodologyId}`);
  }
  const markers = [...rendered.matchAll(/<!-- CELL:(GAEP-CAP-[0-9]{3}):(GAEP-PRD-[0-9]{3}) -->/g)].map(match => `${match[1]}:${match[2]}`);
  if (markers.length !== market.products.length * market.capabilities.length || new Set(markers).size !== markers.length) errors.push("market decision guide does not expose every unique Product × capability cell");
  for (const capability of market.capabilities) {
    if (!rendered.includes(`### ${capability.capabilityId} — ${capability.name}`)) errors.push(`market decision guide omits capability section ${capability.capabilityId}`);
    for (const product of market.products) {
      const marker = `<!-- CELL:${capability.capabilityId}:${product.productId} -->`;
      const start = rendered.indexOf(marker);
      const end = rendered.indexOf("\n", start);
      const row = start < 0 ? "" : rendered.slice(start, end < 0 ? rendered.length : end);
      const cell = rowByProduct.get(product.productId)?.cells.find(entry => entry.capabilityId === capability.capabilityId);
      if (!cell || !row.includes(product.canonicalName) || !row.includes(supportDisplay(cell.supportLevel)) || !row.includes(deliveryDisplay(cell.deliveryState)) || !row.includes(cell.asOfDate) || !row.includes(cell.limitation)) errors.push(`market decision guide has stale cell ${product.productId}/${capability.capabilityId}`);
      const expectedEvidenceUris = [...cell.supportAssertionIds, ...cell.availabilityAssertionIds]
        .map(id => evidence.get(assertions.get(id)?.evidenceId)?.officialUri)
        .filter(uri => Boolean(uri) && uri !== product.officialUri);
      for (const uri of expectedEvidenceUris) if (!row.includes(uri)) errors.push(`${product.productId}/${capability.capabilityId}: exact assertion evidence link is missing`);
      const rowLinks = [...row.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map(match => match[1]);
      if (rowLinks.some(uri => !expectedEvidenceUris.includes(uri))) errors.push(`${product.productId}/${capability.capabilityId}: Product overview or unrelated URL substituted for cell evidence`);
      if (cell.supportLevel === "unknown" && (!row.includes("No active cell-level support assertion") || /\|\s*(?:No|Unsupported)\s*(?:·|\|)/i.test(row))) errors.push(`${product.productId}/${capability.capabilityId}: Unknown converted to No or lacks explicit evidence absence`);
      if (cell.deliveryState !== "shipped" && /Shipped · shipped/.test(row)) errors.push(`${product.productId}/${capability.capabilityId}: non-shipped delivery displayed as shipped`);
    }
  }
  return errors;
}

export function validateCanonicalProjection(context = loadProjectionContext()) {
  const errors = validateProjectionContext(context);
  let rendered = "";
  let renderedDecisionSupport = "";
  if (errors.length === 0) {
    rendered = renderGuideline(context);
    renderedDecisionSupport = renderMarketDecisionSupport(context);
    errors.push(...renderedGuidelineErrors(rendered, context));
    errors.push(...renderedMarketDecisionSupportErrors(renderedDecisionSupport, context));
  }
  return { valid: errors.length === 0, errors, rendered, renderedDecisionSupport };
}

export function projectionDriftErrors(actual, expected) {
  return actual === expected ? [] : ["generated Guide bytes differ from the deterministic canonical projection"];
}
