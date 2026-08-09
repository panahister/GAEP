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
export const EXPECTED_SOURCE_KINDS = ["methodology-catalog", "market-registry", "terminology-index", "runtime-presentation-contract", "extension-package"];
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
  if (!Array.isArray(checkpoints) || checkpoints.length === 0 || !primaryStates || !attentionIndicators || !runtimeStates) {
    throw new Error("runtime presentation contract does not expose checkpoints, primary states, indicators, and runtime mappings");
  }
  return { checkpoints: structuredClone(checkpoints), primaryStates: structuredClone(primaryStates), attentionIndicators: structuredClone(attentionIndicators), runtimeStates: structuredClone(runtimeStates) };
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
  const runtimePresentation = parseRuntimePresentationContract(rawSources.get("runtime-presentation-contract").toString("utf8"));
  const runtimeCheckpoints = runtimePresentation.checkpoints.slice().sort((left, right) => left.order - right.order);
  return { root, manifest, schema, rawSources, template, catalog, market, extensionPackage, runtimePresentation, runtimeCheckpoints };
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

export function manifestSemanticErrors(manifest, { catalog, market, extensionPackage, runtimePresentation, runtimeCheckpoints }) {
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
    ["Product Owner requirement IDs", manifest.productOwnerRequirements.map(entry => entry.requirementId)],
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
  for (const requirement of manifest.productOwnerRequirements) {
    for (const nodeId of requirement.targetNodeIds) if (!targetIds.has(nodeId)) errors.push(`${requirement.requirementId}: unknown target node ${nodeId}`);
    for (const checkpointId of requirement.currentCheckpointIds) if (!runtimeIds.has(checkpointId)) errors.push(`${requirement.requirementId}: unknown current checkpoint ${checkpointId}`);
    for (const sourceId of requirement.canonicalSourceIds.filter(id => id.startsWith("GAEP-CAP-"))) if (!knownCapabilities.has(sourceId)) errors.push(`${requirement.requirementId}: unknown canonical capability ${sourceId}`);
  }
  for (const node of manifest.lifecycleNodes) {
    const mappedByRequirement = manifest.productOwnerRequirements.some(requirement => requirement.targetNodeIds.includes(node.nodeId));
    if (!mappedByRequirement) errors.push(`${node.nodeId}: target node lacks Product Owner requirement coverage`);
  }
  errors.push(...runtimePresentationErrors(runtimePresentation));
  errors.push(...commandErrors(manifest, extensionPackage));
  errors.push(...repositoryMaturityErrors(market));
  return errors;
}

export function validateProjectionContext(context) {
  const validate = compileSchema(context.schema);
  const errors = [];
  if (!validate(context.manifest)) {
    errors.push(...validate.errors.map(error => `manifest schema ${error.instancePath || "/"}: ${error.message}`));
  }
  if (context.manifest.schemaId !== context.schema.$id) errors.push("manifest schemaId does not equal schema $id");
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
    `- ${maturity.get("implemented-awaiting-product-owner-acceptance") ?? 0} implemented, awaiting Product Owner acceptance`,
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

function renderCurrentRuntime(checkpoints) {
  const nodes = checkpoints.map(entry => {
    const label = entry.guideLabel ?? entry.label;
    return `  ${entry.checkpointId.replaceAll("-", "_")}["${entry.order}. ${mermaidSafe(label)}"]`;
  });
  nodes.push(`  ${checkpoints.map(entry => entry.checkpointId.replaceAll("-", "_")).join(" --> ")}`);
  const rows = checkpoints.map(entry => [
    `| \`${entry.checkpointId}\``,
    `${entry.order} · ${markdownSafe(entry.label)}`,
    markdownSafe(entry.prerequisites.length > 0 ? entry.prerequisites.join(", ") : "None"),
    `${markdownSafe(entry.implementedCtas.join("; "))}<br/>${markdownSafe(entry.implementationMaturity)}<br/>${markdownSafe(entry.limitations)} |`,
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
  const rows = manifest.transitionRoadmap.map(entry => `| \`${entry.currentCheckpointId}\` | ${entry.transitionType}<br/>${entry.targetNodeIds.map(id => `\`${id}\``).join(", ")} | ${markdownSafe(entry.currentMaturity)}<br/>${markdownSafe(entry.implementationStatus)} | ${markdownSafe(entry.targetIntent)}<br/>Dependency: ${markdownSafe(entry.dependency)}<br/>Migration: ${entry.migrationState}; PO acceptance: ${entry.productOwnerAcceptanceStatus} |`).join("\n");
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
  const requirementRows = manifest.productOwnerRequirements.map(entry => `| ${entry.requirementId}<br/>${markdownSafe(entry.title)} | ${entry.targetNodeIds.map(id => `\`${id}\``).join(", ")} | ${entry.currentCheckpointIds.map(id => `\`${id}\``).join(", ") || "None"} | ${markdownSafe(entry.currentMaturity)}<br/>${markdownSafe(entry.futureDisposition)}<br/>${markdownSafe(entry.gapOrDecision)} |`).join("\n");
  const gaps = manifest.proposedCanonicalGaps.map(gap => `- **${gap.gapId} · ${gap.title}** — ${gap.status}; blocks acceptance: ${gap.blocksAcceptance}. ${gap.requiredCanonicalCorrection}`).join("\n");
  return generatedBlock("ROADMAP_COVERAGE", [
    "Every current canonical capability maps to at least one target node. Proposed Product Owner detail that exceeds accepted P01/P02 granularity remains an explicit, unaccepted gap.",
    "",
    "<details>", "<summary><strong>Show all canonical capability mappings</strong></summary>", "",
    "| Capability | Target node(s) | Current checkpoint(s), if any | Current maturity and source |", "|---|---|---|---|", capabilityRows, "", "</details>",
    "",
    "<details>", "<summary><strong>Show Product Owner requirement crosswalk</strong></summary>", "",
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
  const summaryRows = manifest.sourceLifecycle.events.map(event => `| ${event.label} | ${event.runtimeClassification} | ${markdownSafe(event.userAction)} | ${markdownSafe(event.recordEffect)} |`).join("\n");
  const eventDetails = manifest.sourceLifecycle.events.map(event => [
    `<details><summary><strong>${event.label}</strong> · ${event.runtimeClassification}</summary>`, "",
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

function capabilitySummary(market, manifest) {
  const maturity = new Map(market.gaepMaturity.map(entry => [entry.capabilityId, entry]));
  return market.capabilities.map(capability => {
    const cells = market.benchmarkRows.map(row => row.cells.find(cell => cell.capabilityId === capability.capabilityId));
    const support = countBy(cells.map(cell => cell.supportLevel));
    const delivery = countBy(cells.map(cell => cell.deliveryState));
    return `- **${capability.capabilityId} — ${capability.name}** · GAEP ${manifest.statePolicy.labels[maturity.get(capability.capabilityId).maturityState]} · market evidence: ${support.get("verified-supported") ?? 0} Verified / ${support.get("partially-supported") ?? 0} Partial / ${support.get("unknown") ?? 0} Unknown · delivery: ${delivery.get("shipped") ?? 0} shipped / ${cells.length - (delivery.get("shipped") ?? 0)} not established as shipped`;
  }).join("\n");
}

function renderMarketGuide(market, manifest) {
  const products = market.products.map(product => `- **${product.productId} · [${product.canonicalName}](${product.officialUri})** — ${product.categoryIds.join(", ")} · reviewed ${product.lastReviewedAt} · ${product.status}`).join("\n");
  const methodologies = market.methodologyBindings.map(binding => `- **${binding.methodologyId} · ${binding.canonicalName}** — ${binding.identityType}${binding.p01ReferenceId ? ` · ${binding.p01ReferenceId}` : ""}. ${binding.limitation}`).join("\n");
  return generatedBlock("MARKET_GUIDE", [
    `Bound to **${market.registryId} v${market.version}**, research snapshot **${market.researchAsOf}**. The benchmark has **${market.products.length} Products/projects × ${market.capabilities.length} capabilities = ${market.benchmarkRows.length * market.capabilities.length} cells**.`,
    "",
    "#### Evaluated Products and projects",
    "",
    "<!-- BEGIN GENERATED:MARKET_PRODUCTS -->",
    products,
    "<!-- END GENERATED:MARKET_PRODUCTS -->",
    "",
    "#### Methodologies and references kept outside Product scoring",
    "",
    "<!-- BEGIN GENERATED:MARKET_METHODOLOGIES -->",
    methodologies,
    "<!-- END GENERATED:MARKET_METHODOLOGIES -->",
    "",
    "#### Exact 30-capability view",
    "",
    "<details>",
    "<summary><strong>Show all capability and support/delivery summaries</strong></summary>",
    "",
    capabilitySummary(market, manifest),
    "",
    "</details>",
    "",
    "**Interpretation:** Verified, Partial, Unknown, and unsupported-by-reviewed-evidence are evidence conclusions. Shipped, preview/beta, announced-roadmap, community-extension, inference, and not-assessed are delivery conclusions. They are never collapsed into a Yes/No score.",
  ].join("\n"));
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
    `- **Authority:** ${claim.approvalState}; ${claim.publicationState}; owner role ${claim.ownerRole}`,
    `- **Limitations:** ${claim.limitations.join(" ")}`,
    `- **Required qualifiers:** ${claim.requiredQualifiers.join(" ")}`,
    `- **Freshness trigger:** ${claim.freshnessTrigger}`,
  ].join("\n")).join("\n\n");
  return generatedBlock("CLAIM_LEDGER", claims);
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

export function renderGuideline(context) {
  const { manifest, template, catalog, market, extensionPackage, runtimePresentation, runtimeCheckpoints } = context;
  const replacements = {
    PROJECTION_HEADER: renderProjectionHeader(manifest),
    EXECUTIVE_FACTS: renderExecutiveFacts(catalog, market, manifest),
    EXECUTIVE_OPERATING_MODEL: renderExecutiveOperatingModel(),
    AUTHORITY_LOOP: renderAuthorityLoop(),
    QUICK_START_FLOW: renderQuickStart(manifest, extensionPackage),
    CHECKPOINT_POSITION_EXAMPLE: renderCheckpointPositionExample(runtimePresentation),
    CURRENT_RUNTIME: renderCurrentRuntime(runtimeCheckpoints),
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
  const compatibilityOccurrences = rendered.match(/Pre-Figma/g) ?? [];
  if (compatibilityOccurrences.length !== 1 || !rendered.includes("Current runtime compatibility only")) errors.push("legacy Pre-Figma wording must appear exactly once inside the bounded compatibility note");
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
  const productBlock = extractGenerated(rendered, "MARKET_PRODUCTS");
  const methodologyBlock = extractGenerated(rendered, "MARKET_METHODOLOGIES");
  for (const product of market.products) {
    if (!productBlock.includes(product.canonicalName) || !productBlock.includes(product.officialUri)) errors.push(`Guide omits Product identity or official link ${product.productId}`);
  }
  for (const methodology of market.methodologyBindings) {
    if (productBlock.includes(methodology.canonicalName)) errors.push(`Guide presents methodology ${methodology.methodologyId} as a Product`);
    if (!methodologyBlock.includes(methodology.canonicalName)) errors.push(`Guide omits methodology binding ${methodology.methodologyId}`);
  }
  for (const capability of market.capabilities) {
    if (!rendered.includes(capability.capabilityId) || !rendered.includes(capability.name)) errors.push(`Guide omits capability ${capability.capabilityId}`);
  }
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

export function validateCanonicalProjection(context = loadProjectionContext()) {
  const errors = validateProjectionContext(context);
  let rendered = "";
  if (errors.length === 0) {
    rendered = renderGuideline(context);
    errors.push(...renderedGuidelineErrors(rendered, context));
  }
  return { valid: errors.length === 0, errors, rendered };
}

export function projectionDriftErrors(actual, expected) {
  return actual === expected ? [] : ["generated Guide bytes differ from the deterministic canonical projection"];
}
