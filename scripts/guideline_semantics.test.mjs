import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  ROOT,
  deriveLifecycleState,
  loadProjectionContext,
  manifestSemanticErrors,
  projectionDriftErrors,
  renderGuideline,
  renderMarketDecisionSupport,
  renderedGuidelineErrors,
  renderedMarketDecisionSupportErrors,
  sourceBindingErrors,
} from "./lib/guideline_projection.mjs";

const base = loadProjectionContext();
const clone = value => structuredClone(value);

function semanticContext(overrides = {}) {
  return {
    catalog: overrides.catalog ?? clone(base.catalog),
    market: overrides.market ?? clone(base.market),
    extensionPackage: overrides.extensionPackage ?? clone(base.extensionPackage),
    runtimePresentation: overrides.runtimePresentation ?? clone(base.runtimePresentation),
    runtimeCheckpoints: overrides.runtimeCheckpoints ?? clone(base.runtimeCheckpoints),
    responsibility: overrides.responsibility ?? clone(base.responsibility),
    assurance: overrides.assurance ?? clone(base.assurance),
  };
}

function assertManifestError(manifest, fragment, overrides = {}) {
  const errors = manifestSemanticErrors(manifest, semanticContext(overrides));
  assert.ok(errors.some(error => error.includes(fragment)), `expected ${fragment}; got:\n${errors.join("\n")}`);
}

function assertRenderedError(rendered, fragment, overrides = {}) {
  const context = { ...base, ...semanticContext(overrides), manifest: overrides.manifest ?? clone(base.manifest) };
  const errors = renderedGuidelineErrors(rendered, context);
  assert.ok(errors.some(error => error.includes(fragment)), `expected ${fragment}; got:\n${errors.join("\n")}`);
}

function assertMarketRenderedError(rendered, fragment, overrides = {}) {
  const context = { ...base, ...semanticContext(overrides), manifest: overrides.manifest ?? clone(base.manifest) };
  const errors = renderedMarketDecisionSupportErrors(rendered, context);
  assert.ok(errors.some(error => error.includes(fragment)), `expected ${fragment}; got:\n${errors.join("\n")}`);
}

test("canonical P03 semantic contract is valid", () => {
  assert.deepEqual(manifestSemanticErrors(base.manifest, base), []);
  const rendered = renderGuideline(base);
  assert.deepEqual(renderedGuidelineErrors(rendered, base), []);
});

test("hostile P01 digest drift is rejected", () => {
  const rawSources = new Map(base.rawSources);
  rawSources.set("methodology-catalog", Buffer.concat([rawSources.get("methodology-catalog"), Buffer.from(" ")]));
  assert.ok(sourceBindingErrors(base.manifest, { rawSources }).some(error => error.includes("methodology-catalog: digest drift")));
});

test("hostile P02 digest drift is rejected", () => {
  const rawSources = new Map(base.rawSources);
  rawSources.set("market-registry", Buffer.concat([rawSources.get("market-registry"), Buffer.from(" ")]));
  assert.ok(sourceBindingErrors(base.manifest, { rawSources }).some(error => error.includes("market-registry: digest drift")));
});

test("hostile runtime presentation contract digest drift is rejected", () => {
  const rawSources = new Map(base.rawSources);
  rawSources.set("runtime-presentation-contract", Buffer.from(rawSources.get("runtime-presentation-contract").toString("utf8").replace("Product definition", "Product discovery")));
  assert.ok(sourceBindingErrors(base.manifest, { rawSources }).some(error => error.includes("runtime-presentation-contract: digest drift")));
});

test("hostile registry version change with old binding is rejected", () => {
  const rawSources = new Map(base.rawSources);
  const market = clone(base.market);
  market.version = "0.3.0";
  rawSources.set("market-registry", Buffer.from(JSON.stringify(market)));
  const errors = sourceBindingErrors(base.manifest, { rawSources });
  assert.ok(errors.some(error => error.includes("version 0.3.0 does not match 0.2.1")));
});

test("hostile canonical source reordering is rejected", () => {
  const manifest = clone(base.manifest);
  manifest.canonicalSources.reverse();
  assertManifestError(manifest, "exact maintained ordering");
});

test("hostile nonexistent extension command is rejected", () => {
  const manifest = clone(base.manifest);
  manifest.commandSurface.extensionCommandIds = ["gaep.notReal"];
  assertManifestError(manifest, "nonexistent extension command gaep.notReal");
});

test("hostile nonexistent chat command is rejected", () => {
  const manifest = clone(base.manifest);
  manifest.commandSurface.chatCommands.push("teleport");
  assertManifestError(manifest, "nonexistent chat command /teleport");
});

test("hostile removed audience layer is rejected", () => {
  const manifest = clone(base.manifest);
  manifest.audienceLayers.pop();
  assertManifestError(manifest, "exact four progressive layers");
});

test("hostile visual bound to unknown section is rejected", () => {
  const manifest = clone(base.manifest);
  manifest.requiredVisuals[0].sectionId = "missing-section";
  assertManifestError(manifest, "unknown section missing-section");
});

test("hostile duplicate visual identity is rejected", () => {
  const manifest = clone(base.manifest);
  manifest.requiredVisuals[1].visualId = manifest.requiredVisuals[0].visualId;
  assertManifestError(manifest, "visual IDs contain duplicates");
});

test("hostile duplicate lifecycle order is rejected", () => {
  const manifest = clone(base.manifest);
  manifest.lifecycleNodes[5].order = manifest.lifecycleNodes[4].order;
  assertManifestError(manifest, "lifecycle order values contain duplicates");
});

test("hostile backlog before DDD is rejected", () => {
  const manifest = clone(base.manifest);
  manifest.lifecycleNodes.find(node => node.title.includes("DDD strategic")).order = 140;
  manifest.lifecycleNodes.find(node => node.title.includes("Architecture-bound backlog")).order = 75;
  manifest.lifecycleNodes.sort((left, right) => left.order - right.order);
  assertManifestError(manifest, "DDD strategic design must precede architecture-bound backlog");
});

test("hostile Figma target lifecycle name is rejected", () => {
  const manifest = clone(base.manifest);
  manifest.lifecycleNodes.find(node => node.title.includes("Product Design")).title = "Figma preparation and evidence";
  assertManifestError(manifest, "Figma cannot be the canonical target lifecycle stage");
});

test("hostile legacy Pre-Figma target lifecycle name is rejected", () => {
  const manifest = clone(base.manifest);
  manifest.lifecycleNodes.find(node => node.title.includes("Product Design")).title = "Pre-Figma readiness";
  assertManifestError(manifest, "legacy Pre-Figma wording cannot define a target lifecycle node");
});

test("hostile unknown capability mapping is rejected", () => {
  const manifest = clone(base.manifest);
  manifest.lifecycleNodes[0].capabilityIds[0] = "GAEP-CAP-199";
  assertManifestError(manifest, "unknown capability GAEP-CAP-199");
});

test("hostile omitted current capability is rejected", () => {
  const manifest = clone(base.manifest);
  for (const node of manifest.lifecycleNodes) node.capabilityIds = node.capabilityIds.filter(id => id !== "GAEP-CAP-130");
  assertManifestError(manifest, "lifecycle omits current capability GAEP-CAP-130");
});

test("hostile implemented maturity without repository assertion is rejected", () => {
  const market = clone(base.market);
  market.gaepMaturity.find(entry => entry.maturityState === "implemented-and-automated-tested").repositoryAssertionIds = [];
  assertManifestError(clone(base.manifest), "implemented state has no repository assertion", { market });
});

test("hostile maturity bound to wrong-capability repository assertion is rejected", () => {
  const market = clone(base.market);
  const maturity = market.gaepMaturity[0];
  market.repositoryAssertions.find(entry => entry.repositoryAssertionId === maturity.repositoryAssertionIds[0]).capabilityId = "GAEP-CAP-130";
  assertManifestError(clone(base.manifest), "belongs to GAEP-CAP-130", { market });
});

test("hostile Unknown rendered as No is rejected", () => {
  const rendered = renderGuideline(base).replace(base.manifest.statePolicy.unknownRule, "Unknown means No.");
  assertRenderedError(rendered, "converts Unknown into No");
});

test("hostile planned lifecycle node rendered as implemented is rejected", () => {
  const rendered = renderGuideline(base).replace('lifecycle_15["150. [PD]', 'lifecycle_15["150. [IT]');
  assertRenderedError(rendered, "target lifecycle node lifecycle-15 is stale or missing");
});

test("hostile methodology inserted into Product list is rejected", () => {
  const rendered = renderMarketDecisionSupport(base).replace("## Methodologies and references — outside Product scoring", "AWS AI-Driven Development Life Cycle\n\n## Methodologies and references — outside Product scoring");
  assertMarketRenderedError(rendered, "scores methodology GAEP-MTH-001 as a Product");
});

test("hostile raw registry JSON as primary surface is rejected", () => {
  const rendered = `${renderGuideline(base)}\n{\"benchmarkRows\": []}\n`;
  assertRenderedError(rendered, "raw registry JSON");
});

test("hostile claim limitation removal is rejected", () => {
  const limitation = base.market.claims[0].limitations[0];
  const rendered = renderGuideline(base).replace(limitation, "Limitation removed.");
  assertRenderedError(rendered, "omits claim authority or limitation GAEP-CLM-001");
});

test("hostile allowed-internal claim displayed as approved/public is rejected", () => {
  const claim = base.market.claims.find(entry => entry.disposition === "allowed-internal");
  const canonical = renderGuideline(base);
  const start = canonical.indexOf(`#### ${claim.claimId}`);
  const end = canonical.indexOf("\n#### ", start + 1);
  const block = canonical.slice(start, end).replace(claim.approvalState, "approved").replace(claim.publicationState, "published");
  const rendered = `${canonical.slice(0, start)}${block}${canonical.slice(end)}`;
  assertRenderedError(rendered, `omits claim authority or limitation ${claim.claimId}`);
});

test("hostile manual generated-section edit fails production drift validation", () => {
  const canonical = renderGuideline(base);
  const manual = canonical.replace("15 evaluated Products/projects", "16 evaluated Products/projects");
  assert.deepEqual(projectionDriftErrors(manual, canonical), ["generated Guide bytes differ from the deterministic canonical projection"]);
});

test("hostile stale methodology official link is rejected", () => {
  const reference = base.catalog.references[0];
  const rendered = renderGuideline(base).replaceAll(reference.officialUri, "https://example.invalid/stale");
  assertRenderedError(rendered, `omits methodology source card facts ${reference.referenceId}`);
});

test("hostile removed visual marker is rejected", () => {
  const rendered = renderGuideline(base).replace("<!-- GAEP-VISUAL:source-lifecycle -->", "");
  assertRenderedError(rendered, "Guide missing visual source-lifecycle");
});

test("hostile long horizontal Mermaid flow is rejected", () => {
  const rendered = renderGuideline(base).replace("flowchart TD", "flowchart LR");
  assertRenderedError(rendered, "long horizontal Mermaid flow");
});

test("all target lifecycle states are derived from current P02 capability maturity", () => {
  const states = base.manifest.lifecycleNodes.map(node => deriveLifecycleState(node, base.market, base.manifest));
  assert.equal(states.length, 19);
  assert.deepEqual(new Set(states), new Set(["implemented-and-automated-tested", "implemented-awaiting-product-owner-acceptance", "partial", "planned-deferred-coming-soon"]));
});

test("P03 leaves the accepted P01 and P02 canonical truth byte-identical", () => {
  for (const binding of base.manifest.canonicalSources.filter(entry => ["methodology-catalog", "market-registry"].includes(entry.kind))) {
    const result = spawnSync("git", ["diff", "--quiet", "afae368c7772b0e0156e25defdcbe0147f0a5e65", "--", binding.path], { cwd: ROOT });
    assert.equal(result.status, 0, `${binding.identity} canonical truth changed during P03`);
  }
});
