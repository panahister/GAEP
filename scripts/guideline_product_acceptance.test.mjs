import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ROOT,
  loadProjectionContext,
  manifestSemanticErrors,
  projectionDriftErrors,
  renderGuideline,
  renderMarketDecisionSupport,
  renderedGuidelineErrors,
  renderedMarketDecisionSupportErrors,
} from "./lib/guideline_projection.mjs";

const base = loadProjectionContext();
const clone = value => structuredClone(value);
const guide = fs.readFileSync(path.join(ROOT, base.manifest.generation.outputPath), "utf8");
const marketGuide = fs.readFileSync(path.join(ROOT, base.manifest.generation.decisionSupportOutputPath), "utf8");
const quickStart = guide.match(/<!-- BEGIN GENERATED:QUICK_START_FLOW -->([\s\S]*?)<!-- END GENERATED:QUICK_START_FLOW -->/)?.[1] ?? "";
const sourceLifecycle = guide.match(/<!-- BEGIN GENERATED:SOURCE_LINEAGE -->([\s\S]*?)<!-- END GENERATED:SOURCE_LINEAGE -->/)?.[1] ?? "";
const stateLegend = guide.match(/<!-- BEGIN GENERATED:STATE_LEGEND -->([\s\S]*?)<!-- END GENERATED:STATE_LEGEND -->/)?.[1] ?? "";
const currentRuntime = guide.match(/<!-- BEGIN GENERATED:CURRENT_RUNTIME -->([\s\S]*?)<!-- END GENERATED:CURRENT_RUNTIME -->/)?.[1] ?? "";

function semanticInputs(overrides = {}) {
  return {
    catalog: overrides.catalog ?? clone(base.catalog),
    market: overrides.market ?? clone(base.market),
    extensionPackage: overrides.extensionPackage ?? clone(base.extensionPackage),
    runtimePresentation: overrides.runtimePresentation ?? clone(base.runtimePresentation),
    runtimeCheckpoints: overrides.runtimeCheckpoints ?? clone(base.runtimeCheckpoints),
  };
}

function semanticErrors(manifest, overrides = {}) {
  return manifestSemanticErrors(manifest, semanticInputs(overrides));
}

function expectSemanticError(manifest, fragment, overrides = {}) {
  const errors = semanticErrors(manifest, overrides);
  assert.ok(errors.some(error => error.includes(fragment)), `expected ${fragment}; got:\n${errors.join("\n")}`);
}

test("first-session route is approximately three minutes and source-first", () => {
  assert.equal(base.manifest.audienceLayers.find(layer => layer.layerId === "quick-start")?.readingTimeMinutes, 3);
  assert.match(guide, /approximately 3 minutes/i);
  for (const value of ["File", "Folder", "Useful Link", "No sources"]) assert.ok(quickStart.includes(value));
  assert.ok(quickStart.indexOf("Plan optional reference input") < quickStart.indexOf("Existing or new Product?"));
  assert.match(quickStart, /Existing · readable documents required[\s\S]*@gaep \/adopt/);
  assert.match(quickStart, /New · sources optional[\s\S]*@gaep \/initialize/);
});

test("first-session source methods preserve their actual runtime boundaries", () => {
  assert.match(quickStart, /GAEP never fetches or reads it/);
  assert.match(quickStart, /Link-only input is not content evidence/);
  assert.match(quickStart, /Selection alone does not reason over content, record a Source, approve truth, or create governed state/);
  assert.match(quickStart, /current `@gaep \/adopt` cannot fast-start an existing Product without readable documents/i);
  assert.match(quickStart, /`@gaep \/intake` waits for Product, Initiative, and applicability prerequisites/);
  assert.match(quickStart, /missing evidence remains explicit/);
});

test("attachment, content reasoning, Source recording, acceptance, and governed commit stay distinct", () => {
  const ordered = ["Select/attach", "Reason over exact attached content", "Record reviewed candidate Sources", "Accept an exact proposal", "Commit governed state"];
  let previous = -1;
  for (const label of ordered) {
    const index = quickStart.indexOf(label);
    assert.ok(index > previous, `${label} is missing or out of order`);
    previous = index;
  }
  assert.match(quickStart, /AI-generated|document-derived|candidate/i);
  assert.match(guide, /AI-generated and document-derived candidates are not governed/);
});

test("every displayed GAEP chat command and source action exists", () => {
  const contributedChat = new Set(base.extensionPackage.contributes.chatParticipants.flatMap(participant => participant.commands).map(command => command.name));
  for (const command of [...guide.matchAll(/@gaep \/([a-z]+)/g)].map(match => match[1])) assert.ok(contributedChat.has(command), `missing contributed /${command}`);
  const contributedActions = new Set(base.extensionPackage.contributes.commands.map(command => command.title));
  for (const title of ["GAEP: Choose File", "GAEP: Choose Folder", "GAEP: Add Useful Link", "GAEP: Open Guide"]) assert.ok(contributedActions.has(title) && guide.includes(title));
});

test("Source Intake, Baseline, and Provenance are distinct complete lifecycle concepts", () => {
  assert.deepEqual(base.manifest.sourceLifecycle.concepts.map(entry => entry.conceptId), ["source-intake", "source-baseline", "source-provenance"]);
  for (const concept of base.manifest.sourceLifecycle.concepts) {
    for (const field of ["meaning", "reviewBoundary", "adoptBoundary", "revisionRule", "doesNotAuthorize"]) assert.ok(sourceLifecycle.includes(concept[field]));
  }
  assert.match(sourceLifecycle, /Baseline membership only says which Source revisions were in the bounded set/);
  assert.match(sourceLifecycle, /Provenance does not establish correctness/);
});

test("all five Source change events expose action and governance consequence", () => {
  assert.deepEqual(base.manifest.sourceLifecycle.events.map(entry => entry.eventId), ["source-added", "source-changed", "source-removed-excluded", "source-superseded", "source-unavailable"]);
  for (const event of base.manifest.sourceLifecycle.events) {
    for (const field of ["userSees", "userAction", "recordEffect", "baselineReview", "provenanceReview", "downstreamRevalidation", "safeWorkaround", "doesNotAuthorize"]) assert.ok(sourceLifecycle.includes(event[field]), `${event.eventId} lacks ${field}`);
  }
});

test("implemented, partial, and unavailable Source behavior cannot be conflated", () => {
  const classification = Object.fromEntries(base.manifest.sourceLifecycle.events.map(entry => [entry.eventId, entry.runtimeClassification]));
  assert.equal(classification["source-added"], "implemented-awaiting-product-owner-acceptance");
  assert.equal(classification["source-changed"], "partial");
  assert.equal(classification["source-removed-excluded"], "unsupported-unavailable");
  assert.equal(classification["source-superseded"], "unsupported-unavailable");
  assert.equal(classification["source-unavailable"], "partial");
  const hostile = clone(base.manifest);
  hostile.sourceLifecycle.events.find(entry => entry.eventId === "source-superseded").runtimeClassification = "implemented-and-verified";
  expectSemanticError(hostile, "unsupported runtime behavior cannot be presented as implemented");
});

test("Source supersession remains an explicit scoped human decision", () => {
  assert.match(base.manifest.sourceLifecycle.supersessionRule, /explicit, scoped human decision/);
  assert.match(base.manifest.sourceLifecycle.supersessionRule, /never infer/);
  for (const signal of ["filename", "date", "document wording", "locator", "content similarity", "replacement intent"]) assert.ok(base.manifest.sourceLifecycle.supersessionRule.includes(signal));
  const hostile = clone(base.manifest);
  hostile.sourceLifecycle.supersessionRule = "GAEP may infer supersession from a newer filename.";
  expectSemanticError(hostile, "never inferred");
});

test("every canonical operational state and indicator is projected from the runtime contract", () => {
  for (const [state, presentation] of Object.entries(base.runtimePresentation.primaryStates)) {
    assert.ok(stateLegend.includes(state));
    assert.ok(stateLegend.includes(presentation.label));
    assert.ok(stateLegend.includes(presentation.marker));
    assert.ok(stateLegend.includes(presentation.doesNotAuthorize));
  }
  for (const [indicator, presentation] of Object.entries(base.runtimePresentation.attentionIndicators)) {
    assert.ok(stateLegend.includes(indicator));
    assert.ok(stateLegend.includes(presentation.label));
    assert.ok(stateLegend.includes(presentation.marker));
  }
});

test("runtime and Guide checkpoint labels cannot silently drift", () => {
  for (const checkpoint of base.runtimeCheckpoints) {
    assert.ok(currentRuntime.includes(`\`${checkpoint.checkpointId}\``));
    assert.ok(currentRuntime.includes(checkpoint.label));
    assert.ok(currentRuntime.includes(String(checkpoint.order)));
    assert.ok(currentRuntime.includes(checkpoint.limitations));
  }
  assert.deepEqual(renderedGuidelineErrors(guide, base), []);
});

test("Previous, Current, Next, blockers, questions, and live-state boundary are visible without color", () => {
  for (const value of ["Previous", "Current", "Next", "1 blocker", "2 open questions", "next valid CTA"]) assert.ok(guide.includes(value));
  assert.match(guide, /Static example, not live state/);
  assert.match(guide, /Open Product Studio or run `@gaep \/status`/);
  assert.match(stateLegend, /text and an accessible marker; color is supplementary only/);
});

test("every canonical Product × capability cell is accessible exactly once", () => {
  const markers = [...marketGuide.matchAll(/<!-- CELL:(GAEP-CAP-[0-9]{3}):(GAEP-PRD-[0-9]{3}) -->/g)].map(match => `${match[1]}:${match[2]}`);
  assert.equal(markers.length, 450);
  assert.equal(new Set(markers).size, 450);
  for (const capability of base.market.capabilities) for (const product of base.market.products) assert.ok(markers.includes(`${capability.capabilityId}:${product.productId}`));
});

test("Product identity, capability identity, support, and delivery remain paired", () => {
  const rowByProduct = new Map(base.market.benchmarkRows.map(row => [row.productId, row]));
  for (const capability of base.market.capabilities) {
    assert.ok(marketGuide.includes(`### ${capability.capabilityId} — ${capability.name}`));
    for (const product of base.market.products) {
      const cell = rowByProduct.get(product.productId).cells.find(entry => entry.capabilityId === capability.capabilityId);
      const marker = `<!-- CELL:${capability.capabilityId}:${product.productId} -->`;
      const line = marketGuide.slice(marketGuide.indexOf(marker), marketGuide.indexOf("\n", marketGuide.indexOf(marker)));
      assert.ok(line.includes(product.canonicalName));
      assert.ok(line.includes(cell.supportLevel));
      assert.ok(line.includes(cell.deliveryState));
      assert.ok(line.includes(cell.asOfDate));
      assert.ok(line.includes(cell.limitation));
    }
  }
});

test("cell evidence links resolve only through exact assertion/evidence relationships", () => {
  assert.deepEqual(renderedMarketDecisionSupportErrors(marketGuide, base), []);
  const assertions = new Map(base.market.evidenceAssertions.map(entry => [entry.assertionId, entry]));
  const evidence = new Map(base.market.evidence.map(entry => [entry.evidenceId, entry]));
  for (const row of base.market.benchmarkRows) for (const cell of row.cells) {
    const marker = `<!-- CELL:${cell.capabilityId}:${row.productId} -->`;
    const line = marketGuide.slice(marketGuide.indexOf(marker), marketGuide.indexOf("\n", marketGuide.indexOf(marker)));
    for (const assertionId of [...cell.supportAssertionIds, ...cell.availabilityAssertionIds]) {
      const assertion = assertions.get(assertionId);
      assert.ok(line.includes(assertionId));
      assert.ok(line.includes(evidence.get(assertion.evidenceId).officialUri));
    }
  }
});

test("Unknown never becomes No and lacks substituted overview evidence", () => {
  for (const row of base.market.benchmarkRows) for (const cell of row.cells.filter(entry => entry.supportLevel === "unknown")) {
    const marker = `<!-- CELL:${cell.capabilityId}:${row.productId} -->`;
    const line = marketGuide.slice(marketGuide.indexOf(marker), marketGuide.indexOf("\n", marketGuide.indexOf(marker)));
    assert.match(line, /Unknown · unknown/);
    assert.match(line, /No active cell-level support assertion/);
    assert.doesNotMatch(line, /\|\s*(?:No|Unsupported)\s*(?:·|\|)/i);
    assert.doesNotMatch(line, /\]\(https?:\/\//);
  }
});

test("roadmap, preview, inference, and community delivery labels never render as shipped", () => {
  for (const state of ["preview-beta", "announced-roadmap", "inference", "community-extension"]) {
    const context = clone(base);
    const cell = context.market.benchmarkRows[0].cells[0];
    cell.deliveryState = state;
    const rendered = renderMarketDecisionSupport(context);
    const marker = `<!-- CELL:${cell.capabilityId}:${context.market.benchmarkRows[0].productId} -->`;
    const line = rendered.slice(rendered.indexOf(marker), rendered.indexOf("\n", rendered.indexOf(marker)));
    assert.ok(line.includes(state));
    assert.doesNotMatch(line, /Shipped · shipped/);
  }
});

test("methodologies remain outside Product scoring and no winner/raw JSON surface exists", () => {
  const productSection = marketGuide.slice(marketGuide.indexOf("## Evaluated Product identities"), marketGuide.indexOf("## Methodologies and references"));
  for (const methodology of base.market.methodologyBindings) assert.ok(!productSection.includes(methodology.canonicalName));
  assert.match(marketGuide, /no universal winner or aggregate score/);
  assert.doesNotMatch(marketGuide, /"benchmarkRows"\s*:/);
});

test("plain-language orientation precedes commands and complete digests", () => {
  const visible = guide.replace(/<!--[\s\S]*?-->/g, "");
  const orientation = visible.indexOf("### Why use this Guide");
  const start = visible.indexOf("approximately three-minute route");
  const maintenance = visible.indexOf("npm run");
  const digest = visible.search(/[a-f0-9]{64}/);
  const maintainer = visible.indexOf("### Maintainer and projection details");
  assert.ok(orientation >= 0 && start > orientation);
  assert.ok(maintenance > start);
  assert.ok(digest > maintainer);
});

test("dense methodology, claims, market cells, and maintainer details are progressively disclosed", () => {
  assert.equal((guide.match(/<details><summary><strong>GAEP-XREF-/g) ?? []).length, base.catalog.references.length);
  assert.match(guide, /Show claim-control records/);
  assert.match(guide, /Show generation commands, canonical paths, full digests/);
  assert.match(guide, /GAEP_MARKET_DECISION_GUIDE\.md/);
  assert.equal((marketGuide.match(/<summary><strong>Compare all 15 Products for GAEP-CAP-/g) ?? []).length, base.market.capabilities.length);
});

test("a synthetic additional runtime checkpoint is projected without renderer changes", () => {
  const runtimePresentation = clone(base.runtimePresentation);
  const extra = {
    checkpointId: "operations-feedback",
    order: 130,
    label: "Operations feedback",
    phase: { id: "operations", label: "Operations", order: 80 },
    prerequisites: ["p0-p4-readiness"],
    implementedCtas: ["@gaep /continue"],
    limitations: "Synthetic evolution fixture only; no production behavior is asserted.",
    implementationMaturity: "planned-deferred-coming-soon",
    compatibilityAliases: [],
  };
  runtimePresentation.checkpoints.push(extra);
  const runtimeCheckpoints = runtimePresentation.checkpoints.slice().sort((left, right) => left.order - right.order);
  const manifest = clone(base.manifest);
  manifest.transitionRoadmap.push({
    currentCheckpointId: extra.checkpointId,
    targetNodeIds: ["lifecycle-19"],
    transitionType: "newly-planned",
    currentMaturity: "planned-deferred-coming-soon",
    targetIntent: "Project synthetic operations feedback without fixed checkpoint cardinality.",
    dependency: "Synthetic test fixture",
    implementationStatus: "target-only-planned",
    productOwnerAcceptanceStatus: "unresolved",
    migrationState: "planned",
  });
  manifest.productOwnerRequirements[7].currentCheckpointIds.push(extra.checkpointId);
  assert.deepEqual(semanticErrors(manifest, { runtimePresentation, runtimeCheckpoints }), []);
  const rendered = renderGuideline({ ...base, manifest, runtimePresentation, runtimeCheckpoints });
  assert.match(rendered, /`operations-feedback`/);
  assert.match(rendered, /130 · Operations feedback/);
});

test("adding a checkpoint without Guide transition metadata fails visibly", () => {
  const runtimePresentation = clone(base.runtimePresentation);
  runtimePresentation.checkpoints.push({ ...clone(runtimePresentation.checkpoints.at(-1)), checkpointId: "unmapped-checkpoint", order: 130, label: "Unmapped checkpoint", compatibilityAliases: [] });
  const runtimeCheckpoints = runtimePresentation.checkpoints;
  expectSemanticError(clone(base.manifest), "current checkpoint lacks transition metadata", { runtimePresentation, runtimeCheckpoints });
});

test("a synthetic additional target node is projected without renderer changes", () => {
  const manifest = clone(base.manifest);
  manifest.lifecycleNodes.push({ nodeId: "lifecycle-20", order: 200, segmentId: "deliver-operate", title: "Governed learning loop", targetIntent: "Test evolvable target-node projection without claiming current implementation.", capabilityIds: ["GAEP-CAP-128"], proposedGapIds: [] });
  manifest.productOwnerRequirements[7].targetNodeIds.push("lifecycle-20");
  assert.deepEqual(semanticErrors(manifest), []);
  const rendered = renderGuideline({ ...base, manifest });
  assert.match(rendered, /lifecycle_20\["200\. \[IA\] Governed learning loop/);
});

test("reordering changes presentation but preserves stable identity", () => {
  const runtimePresentation = clone(base.runtimePresentation);
  const first = runtimePresentation.checkpoints[0];
  const second = runtimePresentation.checkpoints[1];
  [first.order, second.order] = [20, 10];
  runtimePresentation.checkpoints.sort((left, right) => left.order - right.order);
  const runtimeCheckpoints = runtimePresentation.checkpoints;
  const rendered = renderGuideline({ ...base, runtimePresentation, runtimeCheckpoints });
  assert.ok(rendered.indexOf("`initiative-definition`") < rendered.indexOf("`product-definition`"));
  assert.ok(rendered.includes("`product-definition`") && rendered.includes("`initiative-definition`"));
});

test("renaming requires compatibility and migration metadata", () => {
  const runtimePresentation = clone(base.runtimePresentation);
  const checkpoint = runtimePresentation.checkpoints.find(entry => entry.checkpointId === "p0-p4-readiness");
  checkpoint.compatibilityAliases = [];
  expectSemanticError(clone(base.manifest), "requires compatibility alias metadata", { runtimePresentation, runtimeCheckpoints: runtimePresentation.checkpoints });
});

test("splitting one current checkpoint into multiple target nodes is representable", () => {
  const split = base.manifest.transitionRoadmap.find(entry => entry.currentCheckpointId === "business-architecture");
  assert.equal(split.transitionType, "split");
  assert.deepEqual(split.targetNodeIds, ["lifecycle-06", "lifecycle-07", "lifecycle-08"]);
});

test("an unmapped canonical capability fails validation", () => {
  const market = clone(base.market);
  market.capabilities.push({ capabilityId: "GAEP-CAP-999", name: "Synthetic capability", definition: "Synthetic capability used only to verify fail-closed roadmap coverage." });
  market.gaepMaturity.push({ capabilityId: "GAEP-CAP-999", maturityState: "planned-deferred-coming-soon", repositoryAssertionIds: [], rationale: "Synthetic." });
  for (const row of market.benchmarkRows) row.cells.push({ capabilityId: "GAEP-CAP-999", supportLevel: "unknown", supportAssertionIds: [], availabilityAssertionIds: [], asOfDate: market.researchAsOf, rationale: "Not assessed.", limitation: "Synthetic test only.", deliveryState: "not-assessed", applicabilityRationale: null });
  expectSemanticError(clone(base.manifest), "lifecycle omits current capability GAEP-CAP-999", { market });
});

test("a new planned capability appears automatically when canonically mapped", () => {
  const market = clone(base.market);
  market.capabilities.push({ capabilityId: "GAEP-CAP-999", name: "Synthetic planned capability", definition: "Synthetic planned capability used only to verify automatic roadmap projection." });
  market.gaepMaturity.push({ capabilityId: "GAEP-CAP-999", maturityState: "planned-deferred-coming-soon", repositoryAssertionIds: [], rationale: "Synthetic planned fixture." });
  for (const row of market.benchmarkRows) row.cells.push({ capabilityId: "GAEP-CAP-999", supportLevel: "unknown", supportAssertionIds: [], availabilityAssertionIds: [], asOfDate: market.researchAsOf, rationale: "Not assessed.", limitation: "Synthetic test only.", deliveryState: "not-assessed", applicabilityRationale: null });
  const manifest = clone(base.manifest);
  manifest.lifecycleNodes.push({ nodeId: "lifecycle-planned", order: 200, segmentId: "deliver-operate", title: "Synthetic planned target", targetIntent: "Project a new planned capability without renderer code or an implemented claim.", capabilityIds: ["GAEP-CAP-999"], proposedGapIds: [] });
  manifest.productOwnerRequirements.push({ requirementId: "GAEP-P03-REQ-999", title: "Synthetic planned coverage", targetNodeIds: ["lifecycle-planned"], currentCheckpointIds: [], canonicalSourceIds: ["GAEP-CAP-999"], currentMaturity: "planned-deferred-coming-soon", futureDisposition: "newly-planned", gapOrDecision: "Synthetic fixture remains unimplemented and unaccepted." });
  assert.deepEqual(semanticErrors(manifest, { market }), []);
  const rendered = renderGuideline({ ...base, manifest, market });
  assert.match(rendered, /GAEP-CAP-999/);
  assert.match(rendered, /\[PD\] Planned \/ deferred/);
  assert.doesNotMatch(rendered.match(/lifecycle_planned\[[^\n]+/)?.[0] ?? "", /\[IT\]/);
});

test("Current Runtime, Target Operating Model, and Transition Roadmap cannot be conflated", () => {
  const headings = ["### A. Current Runtime", "### B. Target Product-to-Operations Operating Model", "### C. Transition Roadmap"];
  assert.deepEqual(headings.map(heading => guide.indexOf(heading)).sort((left, right) => left - right), headings.map(heading => guide.indexOf(heading)));
  assert.match(guide, /The roadmap is not implementation evidence/);
  assert.match(guide, /Planned.*later authorized work is required/);
});

test("ERP remains illustrative, Figma stays an adapter, and architecture/DDD precede backlog", () => {
  const target = base.manifest.lifecycleNodes.slice().sort((left, right) => left.order - right.order);
  assert.ok(!target.some(node => /figma/i.test(node.title)));
  assert.ok(target.find(node => /Product Design/.test(node.title)).targetIntent.includes("optional Figma"));
  assert.ok(base.manifest.productOwnerRequirements.find(entry => entry.requirementId === "GAEP-P03-REQ-009").gapOrDecision.includes("Product-neutral"));
  const order = fragment => target.find(node => node.title.toLowerCase().includes(fragment)).order;
  assert.ok(order("ddd strategic") < order("architecture-bound backlog"));
  assert.ok(order("architecture decisions") < order("architecture-bound backlog"));
  assert.ok(order("product design") < order("architecture-bound backlog"));
});

test("backlog coverage retains target slice and repository-topology mappings", () => {
  const backlog = base.manifest.productOwnerRequirements.find(entry => entry.requirementId === "GAEP-P03-REQ-005");
  const topology = base.manifest.productOwnerRequirements.find(entry => entry.requirementId === "GAEP-P03-REQ-006");
  assert.ok(backlog.targetNodeIds.includes("lifecycle-13") && backlog.targetNodeIds.includes("lifecycle-15"));
  assert.ok(topology.targetNodeIds.includes("lifecycle-14") && topology.targetNodeIds.includes("lifecycle-15"));
  assert.match(base.manifest.lifecycleNodes.find(node => node.nodeId === "lifecycle-15").targetIntent, /backlog slice.*implementation targets and repositories/i);
});

test("changed maturity, order, or CTA regenerates and invalidates stale output", () => {
  const market = clone(base.market);
  market.gaepMaturity.find(entry => entry.capabilityId === "GAEP-CAP-101").maturityState = "partial";
  const maturityRender = renderGuideline({ ...base, market });
  assert.deepEqual(projectionDriftErrors(guide, maturityRender), ["generated Guide bytes differ from the deterministic canonical projection"]);

  const manifest = clone(base.manifest);
  [manifest.lifecycleNodes[0].order, manifest.lifecycleNodes[1].order] = [20, 10];
  manifest.lifecycleNodes.sort((left, right) => left.order - right.order);
  const orderRender = renderGuideline({ ...base, manifest });
  assert.notEqual(orderRender, guide);

  const runtimePresentation = clone(base.runtimePresentation);
  runtimePresentation.checkpoints[0].implementedCtas = ["@gaep /teleport"];
  expectSemanticError(clone(base.manifest), "CTA uses undeclared chat command /teleport", { runtimePresentation, runtimeCheckpoints: runtimePresentation.checkpoints });
});

test("manual edits to either generated artifact fail deterministic drift", () => {
  assert.deepEqual(projectionDriftErrors(`${guide}manual\n`, renderGuideline(base)), ["generated Guide bytes differ from the deterministic canonical projection"]);
  assert.deepEqual(projectionDriftErrors(`${marketGuide}manual\n`, renderMarketDecisionSupport(base)), ["generated Guide bytes differ from the deterministic canonical projection"]);
});
