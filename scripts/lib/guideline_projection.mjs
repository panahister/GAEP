import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(SCRIPT_DIR, "../..");
export const MANIFEST_PATH = path.join(ROOT, "docs/next/99_Registries_and_References/014_GUIDELINE_PROJECTION_MANIFEST.json");
export const SCHEMA_PATH = path.join(ROOT, "docs/next/99_Registries_and_References/014_GUIDELINE_PROJECTION_MANIFEST.schema.json");
export const AJV_VERSION = require("ajv/package.json").version;
export const AJV_FORMATS_VERSION = require("ajv-formats/package.json").version;

export const EXPECTED_LAYERS = ["executive-orientation", "quick-start", "practitioner-guide", "methodology-appendix"];
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

export function parseRuntimeCheckpoints(rawText) {
  const idsBlock = rawText.match(/existingProductJourneyCheckpointIds\s*=\s*\[([\s\S]*?)\]\s*as const/);
  const labelsBlock = rawText.match(/journeyCheckpointLabels[^=]*=\s*\{([\s\S]*?)\n\}/);
  if (!idsBlock || !labelsBlock) throw new Error("runtime checkpoint source does not expose the expected canonical arrays");
  const ids = [...idsBlock[1].matchAll(/"([a-z0-9-]+)"/g)].map(match => match[1]);
  const labels = new Map([...labelsBlock[1].matchAll(/"([a-z0-9-]+)":\s*"([^"]+)"/g)].map(match => [match[1], match[2]]));
  if (ids.length === 0 || labels.size !== ids.length || ids.some(id => !labels.has(id))) {
    throw new Error("runtime checkpoint IDs and labels are incomplete or inconsistent");
  }
  return ids.map((checkpointId, index) => ({ checkpointId, sequence: index + 1, label: labels.get(checkpointId) }));
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
  const runtimeCheckpoints = parseRuntimeCheckpoints(rawSources.get("runtime-checkpoints").toString("utf8"));
  return { root, manifest, schema, rawSources, template, catalog, market, extensionPackage, runtimeCheckpoints };
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

export function manifestSemanticErrors(manifest, { catalog, market, extensionPackage, runtimeCheckpoints }) {
  const errors = [];
  const layerIds = manifest.audienceLayers.map(entry => entry.layerId);
  if (JSON.stringify(layerIds) !== JSON.stringify(EXPECTED_LAYERS)) errors.push("audience layers must be the exact four progressive layers in canonical order");
  for (const [label, values] of [
    ["source kinds", manifest.canonicalSources.map(entry => entry.kind)],
    ["section IDs", manifest.requiredSections.map(entry => entry.sectionId)],
    ["visual IDs", manifest.requiredVisuals.map(entry => entry.visualId)],
    ["lifecycle IDs", manifest.lifecycleNodes.map(entry => entry.nodeId)],
  ]) {
    const duplicates = duplicateValues(values);
    if (duplicates.length > 0) errors.push(`${label} contain duplicates: ${duplicates.join(", ")}`);
  }
  const sectionIds = new Set(manifest.requiredSections.map(entry => entry.sectionId));
  for (const visualEntry of manifest.requiredVisuals) {
    if (!sectionIds.has(visualEntry.sectionId)) errors.push(`${visualEntry.visualId}: unknown section ${visualEntry.sectionId}`);
    if (!["TD", "TB"].includes(visualEntry.direction)) errors.push(`${visualEntry.visualId}: visual must be vertical`);
  }
  const sequences = manifest.lifecycleNodes.map(entry => entry.sequence);
  if (JSON.stringify(sequences) !== JSON.stringify(Array.from({ length: 19 }, (_, index) => index + 1))) errors.push("lifecycle nodes must have exact sequence 1 through 19");
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
  for (const capabilityId of knownCapabilities) {
    if (!projectedCapabilities.has(capabilityId)) errors.push(`lifecycle omits current capability ${capabilityId}`);
  }
  const sequenceFor = fragment => manifest.lifecycleNodes.find(entry => entry.title.toLowerCase().includes(fragment))?.sequence ?? Number.POSITIVE_INFINITY;
  if (sequenceFor("ddd strategic") >= sequenceFor("architecture-bound backlog")) errors.push("DDD strategic design must precede architecture-bound backlog");
  if (sequenceFor("architecture decisions") >= sequenceFor("architecture-bound backlog")) errors.push("architecture decisions must precede architecture-bound backlog");
  if (sequenceFor("product design") >= sequenceFor("architecture-bound backlog")) errors.push("Product Design must precede architecture-bound backlog");
  if (manifest.lifecycleNodes.some(entry => /figma/i.test(entry.title))) errors.push("Figma cannot be the canonical target lifecycle stage");
  if (manifest.lifecycleNodes.some(entry => /pre-figma/i.test(entry.title))) errors.push("legacy Pre-Figma wording cannot define a target lifecycle node");
  if (JSON.stringify(manifest.statePolicy.displayPriority) !== JSON.stringify(EXPECTED_STATES)) errors.push("state display priority is not the exact conservative policy");
  if (catalog.catalogId !== "GAEP-REG-011") errors.push("methodology input is not GAEP-REG-011");
  if (market.registryId !== "GAEP-REG-013") errors.push("market input is not GAEP-REG-013");
  if (runtimeCheckpoints.length !== 12) errors.push("current runtime checkpoint projection must contain exactly 12 checkpoints");
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
    "> **Generated surface.** Edit the narrative template or owning canonical sources—not this file. `npm run check:guideline-projection` detects drift.",
    ">",
    `> **Bound truth:** ${catalog.identity} v${catalog.version} (${catalog.sha256}); ${market.identity} v${market.version} (${market.sha256}).`,
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

function renderQuickStart(manifest) {
  const commands = new Set(manifest.commandSurface.chatCommands);
  const required = ["status", "adopt", "continue", "author", "accept", "commit"];
  if (required.some(command => !commands.has(command))) throw new Error("quick-start commands are absent from the manifest command surface");
  return generatedBlock("QUICK_START_FLOW", visual("quick-start-flow", "First-session path", "TD", [
    '  open["Open a trusted Product workspace"] --> status["@gaep /status"]',
    '  status --> adopt{"Existing Product?"}',
    '  adopt -- "Yes" --> existing["@gaep /adopt"]',
    '  adopt -- "No" --> initialize["@gaep /initialize"]',
    '  existing --> next["@gaep /continue"]',
    '  initialize --> next',
    '  next --> author["@gaep /author"] --> review["Inspect and challenge exact candidate"]',
    '  review --> accept["@gaep /accept"] --> commit["@gaep /commit CONFIRM"]',
  ].join("\n")));
}

function renderCurrentRuntime(checkpoints) {
  const nodes = checkpoints.map((entry, index) => {
    const label = index === checkpoints.length - 1 ? "Design and implementation handoff (legacy wording below)" : entry.label;
    return `  r${String(index + 1).padStart(2, "0")}["${entry.sequence}. ${mermaidSafe(label)}"]`;
  });
  nodes.push(`  ${checkpoints.map((_, index) => `r${String(index + 1).padStart(2, "0")}`).join(" --> ")}`);
  const list = checkpoints.map((entry, index) => `- \`${entry.checkpointId}\` — ${index === checkpoints.length - 1 ? "Design and implementation handoff (legacy wording; see compatibility note)" : entry.label}`).join("\n");
  return generatedBlock("CURRENT_RUNTIME", [
    visual("where-you-are", "Current runtime checkpoint path", "TD", nodes.join("\n")),
    "",
    "<details>",
    "<summary><strong>Exact current checkpoint IDs</strong></summary>",
    "",
    list,
    "",
    "</details>",
    "",
    `> **Compatibility note — current runtime only:** the existing final checkpoint label is “${checkpoints.at(-1).label}.” The target lifecycle and all new guidance use the tool-neutral canonical stage “Product Design preparation and evidence.”`,
  ].join("\n"));
}

function renderStateLegend(manifest) {
  const rows = manifest.statePolicy.displayPriority.map(state => `| ${manifest.statePolicy.labels[state]} | ${state} |`).join("\n");
  return generatedBlock("STATE_LEGEND", [
    "| Visible state | Canonical machine value |",
    "|---|---|",
    rows,
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
    lines.push(`  ${node.nodeId.replaceAll("-", "_")}["${node.sequence}. ${stateMarker(state, manifest)} ${mermaidSafe(node.title)}<br/>${capabilities}"]`);
  }
  lines.push(`  ${nodes.map(node => node.nodeId.replaceAll("-", "_")).join(" --> ")}`);
  return visual(id, title, "TD", lines.join("\n"));
}

function renderTargetLifecycle(manifest, market) {
  const nodes = manifest.lifecycleNodes;
  const nodeDetails = nodes.map(node => {
    const state = deriveLifecycleState(node, market, manifest);
    const maturity = new Map(market.gaepMaturity.map(entry => [entry.capabilityId, entry]));
    const details = node.capabilityIds.map(id => `${id} ${maturity.get(id).maturityState}`).join("; ");
    return `| ${node.sequence} | ${markdownSafe(node.title)} | ${manifest.statePolicy.labels[state]} | ${details} |`;
  }).join("\n");
  return generatedBlock("TARGET_LIFECYCLE", [
    renderLifecycleSegment("lifecycle-discover-define", "Lifecycle 1–6: discover and define", nodes.slice(0, 6), market, manifest),
    "",
    "↓ Continue to architecture and planning",
    "",
    renderLifecycleSegment("lifecycle-architecture-plan", "Lifecycle 7–13: architecture and planning", nodes.slice(6, 13), market, manifest),
    "",
    "↓ Continue to delivery and operations",
    "",
    renderLifecycleSegment("lifecycle-deliver-operate", "Lifecycle 14–19: delivery and operations", nodes.slice(13), market, manifest),
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

function renderSourceLineage() {
  return generatedBlock("SOURCE_LINEAGE", visual("source-lineage", "Source-to-decision lineage", "TD", [
    '  material["Exact attached or ingested material"] --> source["Candidate Source record"]',
    '  source --> baseline["Explicit Baseline membership and revision"]',
    '  baseline --> provenance["Provenance, locator, limitations, and lineage"]',
    '  provenance --> candidate["Bounded downstream candidate"]',
    '  candidate --> human["Human review and explicit decision"]',
    '  human --> governed["Governed record with trace back to exact evidence"]',
    '  unknown["Missing or unreviewed evidence"] -. stays visible as Unknown .-> candidate',
  ].join("\n")));
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
      `#### ${reference.referenceId} · [${reference.canonicalName}](${reference.officialUri})`,
      "",
      `- **Type / authority:** ${reference.referenceType} · ${reference.issuingAuthority}`,
      `- **Exact version:** ${reference.versionOrEdition} · evidence ${reference.evidenceStatus} · reviewed ${reference.contentReview.date}`,
      `- **GAEP concerns:** ${reference.gaepConcernIds.join(", ")}${binding ? ` · P02 market binding ${binding.methodologyId}` : ""}`,
      `- **Use boundary:** ${reference.claimLanguage}`,
      `- **Limitations:** ${reference.limitations.join(" ")}`,
      `- **Review trigger:** ${reference.reviewTrigger}`,
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
  const { manifest, template, catalog, market, runtimeCheckpoints } = context;
  const replacements = {
    PROJECTION_HEADER: renderProjectionHeader(manifest),
    EXECUTIVE_FACTS: renderExecutiveFacts(catalog, market, manifest),
    EXECUTIVE_OPERATING_MODEL: renderExecutiveOperatingModel(),
    AUTHORITY_LOOP: renderAuthorityLoop(),
    QUICK_START_FLOW: renderQuickStart(manifest),
    CURRENT_RUNTIME: renderCurrentRuntime(runtimeCheckpoints),
    STATE_LEGEND: renderStateLegend(manifest),
    TARGET_LIFECYCLE: renderTargetLifecycle(manifest, market),
    SOURCE_LINEAGE: renderSourceLineage(),
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
  const { manifest, catalog, market } = context;
  const errors = [];
  if (!rendered.startsWith("<!-- GENERATED FILE:")) errors.push("Guide lacks generated-file warning");
  if ((rendered.match(/^# /gm) ?? []).length !== 1) errors.push("Guide must contain exactly one H1");
  for (const heading of ["## 1. Executive orientation", "## 2. Quick start", "## 3. Practitioner guide", "## 4. Methodology and maintainer appendix"]) {
    if (!rendered.includes(heading)) errors.push(`Guide missing progressive layer ${heading}`);
  }
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
  for (const state of EXPECTED_STATES) {
    if (!rendered.includes(manifest.statePolicy.labels[state])) errors.push(`Guide missing state label ${state}`);
  }
  if (!rendered.includes(manifest.statePolicy.unknownRule)) errors.push("Guide does not preserve the Unknown-not-No rule");
  if (/Unknown\s*(?:=|means|→)\s*(?:No\b|unsupported\b)/i.test(rendered)) errors.push("Guide converts Unknown into No");
  const compatibilityOccurrences = rendered.match(/Pre-Figma/g) ?? [];
  if (compatibilityOccurrences.length !== 1 || !rendered.includes("Compatibility note — current runtime only")) errors.push("legacy Pre-Figma wording must appear exactly once inside the bounded compatibility note");
  const lifecycleBlock = extractGenerated(rendered, "TARGET_LIFECYCLE");
  if (/Figma/i.test(lifecycleBlock)) errors.push("target lifecycle names Figma instead of tool-neutral Product Design");
  for (const node of manifest.lifecycleNodes) {
    const state = deriveLifecycleState(node, market, manifest);
    const expectedDiagramLabel = `${node.nodeId.replaceAll("-", "_")}["${node.sequence}. ${stateMarker(state, manifest)} ${node.title}`;
    const expectedTableLabel = `| ${node.sequence} | ${node.title} | ${manifest.statePolicy.labels[state]} |`;
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
    if (!rendered.includes(claim.claimId) || !rendered.includes(claim.disposition) || !rendered.includes(claim.approvalState) || !rendered.includes(claim.publicationState) || !rendered.includes(claim.limitations[0]) || !rendered.includes(claim.requiredQualifiers[0])) errors.push(`Guide omits claim authority or limitation ${claim.claimId}`);
  }
  for (const reference of catalog.references) {
    if (!rendered.includes(reference.referenceId) || !rendered.includes(reference.officialUri) || !rendered.includes(reference.evidenceStatus) || !rendered.includes(reference.reviewTrigger)) errors.push(`Guide omits methodology source card facts ${reference.referenceId}`);
  }
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
