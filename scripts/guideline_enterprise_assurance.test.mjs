import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ROOT,
  loadProjectionContext,
  manifestSemanticErrors,
  renderGuideline,
  renderMarketDecisionSupport,
} from "./lib/guideline_projection.mjs";

const base = loadProjectionContext();
const clone = value => structuredClone(value);
const guide = fs.readFileSync(path.join(ROOT, base.manifest.generation.outputPath), "utf8");
const marketGuide = fs.readFileSync(path.join(ROOT, base.manifest.generation.decisionSupportOutputPath), "utf8");

function errors(overrides = {}) {
  return manifestSemanticErrors(overrides.manifest ?? clone(base.manifest), {
    catalog: overrides.catalog ?? clone(base.catalog), market: overrides.market ?? clone(base.market),
    extensionPackage: overrides.extensionPackage ?? clone(base.extensionPackage),
    runtimePresentation: overrides.runtimePresentation ?? clone(base.runtimePresentation),
    runtimeCheckpoints: overrides.runtimeCheckpoints ?? clone(base.runtimeCheckpoints),
    responsibility: overrides.responsibility ?? clone(base.responsibility), assurance: overrides.assurance ?? clone(base.assurance),
    targetExecution: overrides.targetExecution ?? clone(base.targetExecution),
  });
}

test("every current checkpoint and substep exposes the complete execution contract", () => {
  const fields = ["stepId", "order", "purpose", "interactionType", "responsibleRoleIds", "accountableRoleId", "consultedRoleIds", "informedRoleIds", "independentAssuranceRoleIds", "inputContractIds", "currentAction", "outputContractIds", "evidenceProduced", "evidenceConsumed", "reviewCriteria", "stateBefore", "stateAfter", "recordEffect", "authorityEffect", "failureConditions", "blockerBehavior", "retryRevisionPath", "auditEventEffect", "maturity"];
  for (const checkpoint of base.runtimeCheckpoints) {
    assert.ok(checkpoint.executionSubsteps.length > 0);
    for (const step of checkpoint.executionSubsteps) for (const field of fields) assert.ok(Object.hasOwn(step, field), `${step.stepId} lacks ${field}`);
  }
});

test("every governed decision has exactly one accountable role and Product Owner is not universal", () => {
  const decisions = base.runtimeCheckpoints.flatMap(checkpoint => checkpoint.executionSubsteps).filter(step => ["human-decision", "governed-commit"].includes(step.interactionType));
  assert.ok(decisions.length > 0);
  assert.ok(decisions.every(step => typeof step.accountableRoleId === "string" && step.accountableRoleId.length > 0));
  assert.ok(new Set(decisions.map(step => step.accountableRoleId)).size > 1);
  assert.ok(decisions.every(step => step.accountableRoleId !== "product-owner"));
});

test("missing accountability and incompatible independent assurance block validation", () => {
  const runtimePresentation = clone(base.runtimePresentation);
  runtimePresentation.checkpoints[0].executionSubsteps.at(-1).accountableRoleId = null;
  assert.ok(errors({ runtimePresentation, runtimeCheckpoints: runtimePresentation.checkpoints }).some(error => error.includes("lacks exactly one accountable role")));
  const conflict = clone(base.runtimePresentation);
  const step = conflict.checkpoints[0].executionSubsteps.at(-1);
  step.independentAssuranceRoleIds = [step.responsibleRoleIds[0]];
  assert.ok(errors({ runtimePresentation: conflict, runtimeCheckpoints: conflict.checkpoints }).some(error => error.includes("independent assurance role conflicts")));
});

test("RACI and sequences are generated from the exact checkpoint substeps", () => {
  for (const checkpoint of base.runtimeCheckpoints) {
    assert.ok(guide.includes(`GAEP-SEQUENCE:checkpoint-${checkpoint.checkpointId}`));
    assert.ok(guide.includes(`GAEP-VISUAL:checkpoint-${checkpoint.checkpointId}-flow`));
    for (const step of checkpoint.executionSubsteps) {
      assert.ok(guide.includes(`\`${step.stepId}\``));
      assert.ok(guide.includes(step.purpose));
      for (const role of step.responsibleRoleIds) assert.ok(guide.includes(role));
    }
  }
});

test("phase, checkpoint, target, substep, and role-participation RACI views are all projected", () => {
  assert.match(guide, /#### Executive phase-level RACI/);
  assert.match(guide, /#### Current-checkpoint RACI overview/);
  assert.match(guide, /#### Target-lifecycle RACI overview — planned, not executable/);
  assert.match(guide, /Role-to-lifecycle participation — current and target/);
  assert.equal((guide.match(/\*\*Substep RACI\*\*/g) ?? []).length, base.runtimeCheckpoints.length);
  for (const role of base.responsibility.roleArchetypes) assert.ok(guide.includes(`\`${role.roleId}\` ·`));
});

test("a nonexistent current command cannot appear in a current sequence", () => {
  const runtimePresentation = clone(base.runtimePresentation);
  runtimePresentation.checkpoints[0].executionSubsteps[1].currentAction.value = "@gaep /teleport";
  assert.ok(errors({ runtimePresentation, runtimeCheckpoints: runtimePresentation.checkpoints }).some(error => error.includes("does not resolve to a contributed command")));
});

test("all target nodes have planned non-executable flow and sequence profiles", () => {
  assert.equal(base.targetExecution.nodeProfiles.length, base.manifest.lifecycleNodes.length);
  for (const node of base.manifest.lifecycleNodes) {
    assert.ok(guide.includes(`GAEP-SEQUENCE:target-${node.nodeId}`));
    const start = guide.indexOf(`GAEP-SEQUENCE:target-${node.nodeId}`);
    const fragment = guide.slice(start, guide.indexOf("</details>", start));
    assert.match(fragment, /Target — planned, not executable/);
    assert.doesNotMatch(fragment, /@gaep \/[a-z]+/);
  }
});

test("ED1 abstract-only evidence cannot support normative mappings or enterprise decision evidence", () => {
  const assurance = clone(base.assurance);
  assurance.referenceDepthAssessments.find(entry => entry.referenceId === "GAEP-XREF-012").currentGaepMapping = "Normative requirements controls are fully mapped.";
  assert.ok(errors({ assurance }).some(error => error.includes("ED1 abstract-only evidence cannot support normative mapping")));
});

test("ISO/IEC/IEEE 29148 current edition and successor draft remain distinct and insufficient", () => {
  const assessment = base.assurance.referenceDepthAssessments.find(entry => entry.referenceId === "GAEP-XREF-012");
  assert.equal(assessment.evidenceDepth, "ED1");
  assert.match(assessment.reviewedCoverage, /2018 Edition 2.*90\.92.*Edition 3 DIS.*distinct successor draft/);
  assert.match(assessment.adoptionConsequence, /insufficient decision evidence/);
  assert.doesNotMatch(assessment.reviewedCoverage, /Edition 3 DIS is current/i);
});

test("a supplied ISO-style abstract card fails when inflated to assessed decision evidence", () => {
  const assurance = clone(base.assurance);
  const assessment = assurance.referenceDepthAssessments.find(entry => entry.referenceId === "GAEP-XREF-012");
  assessment.evidenceDepth = "ED3";
  assessment.reviewedCoverage = "Official abstract only, treated as complete control evidence.";
  assert.ok(errors({ assurance }).some(error => error.includes("ISO/IEC/IEEE 29148 abstract-only disposition")));
});

test("no standard reference can imply GAEP conformance", () => {
  const assurance = clone(base.assurance);
  assurance.claimAssurance.find(entry => entry.claimId === "GAEP-CLM-ENT-005").status = "test-verified";
  assert.ok(errors({ assurance }).some(error => error.includes("cannot imply GAEP conformance")));
});

test("every established GAEP claim has inspectable repository/runtime evidence", () => {
  for (const claim of base.assurance.claimAssurance.filter(entry => entry.status !== "not-established")) assert.ok(claim.repositoryEvidence.length + claim.runtimeEvidence.length > 0);
  const assurance = clone(base.assurance);
  const claim = assurance.claimAssurance.find(entry => entry.status !== "not-established");
  claim.repositoryEvidence = [];
  claim.runtimeEvidence = [];
  assert.ok(errors({ assurance }).some(error => error.includes("lacks inspectable repository/runtime evidence")));
});

test("competency gateway is role/risk based and rejects a universal score", () => {
  assert.equal(base.responsibility.competencyDimensions.length, 20);
  assert.equal(base.responsibility.participationLevels.length, 5);
  assert.equal(base.responsibility.gatewayOutcomes.length, 6);
  assert.ok(base.responsibility.gatewayRules.some(rule => /scenario evidence/i.test(rule)));
  assert.ok(base.responsibility.gatewayRules.some(rule => /Do not calculate one universal competency score/i.test(rule)));
  assert.match(guide, /Competence does not grant authority/);
});

test("organization weights cannot become a universal ranking and Unknown is never a losing score", () => {
  assert.ok(base.assurance.decisionProfileTemplate.weightingRules.includes("No default weights"));
  assert.ok(base.assurance.decisionProfileTemplate.weightingRules.includes("Unknown is not scored as No or zero"));
  assert.match(guide, /No universal winner is produced/);
  assert.doesNotMatch(guide, /default GAEP-favoring weight/i);
});

test("GAEP and alternative evidence remain visible under equivalent bounded semantics", () => {
  assert.match(guide, /Equivalent comparison criteria for GAEP and alternatives/);
  assert.match(guide, /GAEP receives no favorable default/);
  assert.match(marketGuide, /Unknown means no active reviewed assertion/);
  assert.match(guide, /test-verified|not-established/);
});

test("Product overview URLs cannot substitute for cell-level evidence", () => {
  const market = clone(base.market);
  const row = market.benchmarkRows.find(candidate => candidate.cells.some(cell => cell.supportAssertionIds.length > 0));
  const cell = row.cells.find(candidate => candidate.supportAssertionIds.length > 0);
  const assertion = market.evidenceAssertions.find(candidate => candidate.assertionId === cell.supportAssertionIds[0]);
  market.evidence.find(candidate => candidate.evidenceId === assertion.evidenceId).officialUri = market.products.find(candidate => candidate.productId === row.productId).officialUri;
  const rendered = renderMarketDecisionSupport({ ...base, market });
  const marker = `<!-- CELL:${cell.capabilityId}:${row.productId} -->`;
  const line = rendered.slice(rendered.indexOf(marker), rendered.indexOf("\n", rendered.indexOf(marker)));
  assert.match(line, /Product overview URI; not treated as a cell-level evidence link/);
  assert.ok(!line.includes(`](${market.products.find(candidate => candidate.productId === row.productId).officialUri})`));
});

test("all 450 Product-capability cells remain accessible and Unknown remains Unknown", () => {
  assert.equal((marketGuide.match(/<!-- CELL:GAEP-CAP-[0-9]{3}:GAEP-PRD-[0-9]{3} -->/g) ?? []).length, 450);
  assert.match(marketGuide, /Unknown · unknown/);
  assert.doesNotMatch(marketGuide, /Unknown · (?:No|Unsupported)/i);
  assert.equal(renderMarketDecisionSupport(base), marketGuide);
});

test("Source lifecycle and scoped gap impacts remain honest and non-circular", () => {
  const sourceGap = base.manifest.proposedCanonicalGaps.find(entry => entry.gapId === "GAEP-P03-GAP-002");
  assert.equal(sourceGap.scopedImpacts.p03ProjectionAcceptance, "non-blocking-when-honestly-projected");
  assert.deepEqual(sourceGap.scopedImpacts.responsibleRoadmapItems, ["P04"]);
  assert.equal(sourceGap.scopedImpacts.executableState, "proposed-non-executable");
  assert.match(guide, /No installed governed Source-supersession action/);
});

test("one canonical final-checkpoint label is projected without Pre-Figma terminology", () => {
  assert.equal(base.runtimeCheckpoints.filter(entry => entry.terminal).length, 1);
  assert.equal(base.runtimeCheckpoints.at(-1).label, "P0–P4 readiness and handoff");
  assert.doesNotMatch(guide, /Pre-Figma/i);
});

test("enterprise Guide bytes are still deterministic", () => {
  assert.equal(renderGuideline(base), guide);
});
