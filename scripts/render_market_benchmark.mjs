#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { REGISTRY_PATH, ROOT, validateRegistryFiles } from "./lib/market_benchmark_registry.mjs";

const args = new Set(process.argv.slice(2));
if (![...args].every(argument => ["--write", "--check"].includes(argument)) || args.size !== 1) {
  console.error("Usage: node scripts/render_market_benchmark.mjs (--write|--check)");
  process.exit(2);
}

const validation = validateRegistryFiles();
if (!validation.valid) {
  console.error(`Cannot render an invalid registry:\n${validation.errors.map(error => `- ${error}`).join("\n")}`);
  process.exit(1);
}

const registry = validation.registry;
const productById = new Map(registry.products.map(product => [product.productId, product]));
const capabilityById = new Map(registry.capabilities.map(capability => [capability.capabilityId, capability]));
const categoryById = new Map(registry.marketCategories.map(category => [category.categoryId, category]));
const evidenceById = new Map(registry.evidence.map(evidence => [evidence.evidenceId, evidence]));
const assertionById = new Map(registry.evidenceAssertions.map(assertion => [assertion.assertionId, assertion]));
const repositoryAssertionById = new Map(registry.repositoryAssertions.map(assertion => [assertion.repositoryAssertionId, assertion]));
const maturityByCapabilityId = new Map(registry.gaepMaturity.map(maturity => [maturity.capabilityId, maturity]));
const digest = crypto.createHash("sha256").update(fs.readFileSync(REGISTRY_PATH)).digest("hex");
const outputPath = path.join(ROOT, registry.projection.path);

const clean = value => String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
const names = (ids, lookup) => ids.map(id => lookup.get(id)?.name ?? lookup.get(id)?.canonicalName ?? id).join(", ");
const assertionEvidenceLinks = assertionIds => {
  const uniqueEvidenceIds = [...new Set(assertionIds.map(id => assertionById.get(id)?.evidenceId).filter(Boolean))].sort();
  return uniqueEvidenceIds.length === 0 ? "No external Evidence binding" : uniqueEvidenceIds.map(id => `[${id}](${evidenceById.get(id).officialUri})`).join(", ");
};

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map(row => `| ${row.map(clean).join(" | ")} |`),
  ].join("\n");
}

const classificationOrder = ["direct-competitor", "adjacent-alternative", "partial-substitute", "complement-integration-candidate"];
const landscapeRows = [...registry.landscapeEvaluations]
  .sort((left, right) => classificationOrder.indexOf(left.classification) - classificationOrder.indexOf(right.classification) || left.productId.localeCompare(right.productId))
  .map(evaluation => {
    const product = productById.get(evaluation.productId);
    return [product.canonicalName, evaluation.classification, names(product.categoryIds, categoryById), evaluation.rationale, assertionEvidenceLinks(evaluation.assertionIds)];
  });

const benchmarkSummaryRows = registry.benchmarkRows.map(row => {
  const counts = Object.fromEntries(["verified-supported", "partially-supported", "unsupported-by-reviewed-evidence", "unknown", "not-applicable"].map(state => [state, 0]));
  for (const cell of row.cells) counts[cell.supportLevel] += 1;
  return [productById.get(row.productId).canonicalName, counts["verified-supported"], counts["partially-supported"], counts["unsupported-by-reviewed-evidence"], counts.unknown, counts["not-applicable"]];
});

const capabilityGroups = [
  ["Product and Initiative governance", "GAEP-CAP-101", "GAEP-CAP-109"],
  ["Business, domain, architecture, and planning", "GAEP-CAP-110", "GAEP-CAP-115"],
  ["Design, backlog, assurance, and traceability", "GAEP-CAP-116", "GAEP-CAP-120"],
  ["Security, repositories, delivery, operations, evidence, and administration", "GAEP-CAP-121", "GAEP-CAP-130"],
];

function capabilityComparisonRows(startId, endId) {
  return registry.capabilities
    .filter(capability => capability.capabilityId.localeCompare(startId) >= 0 && capability.capabilityId.localeCompare(endId) <= 0)
    .map(capability => {
      const matching = registry.benchmarkRows.map(row => ({ productId: row.productId, cell: row.cells.find(cell => cell.capabilityId === capability.capabilityId) }));
      const verified = matching.filter(item => item.cell.supportLevel === "verified-supported");
      const partial = matching.filter(item => item.cell.supportLevel === "partially-supported");
      const conclusions = [...verified, ...partial];
      const assertionIds = conclusions.flatMap(item => [...item.cell.supportAssertionIds, ...item.cell.availabilityAssertionIds]);
      const maturity = maturityByCapabilityId.get(capability.capabilityId);
      return [
        `${capability.capabilityId} — ${capability.name}`,
        maturity.maturityState,
        verified.length ? verified.map(item => productById.get(item.productId).canonicalName).join(", ") : "None established",
        partial.length ? partial.map(item => productById.get(item.productId).canonicalName).join(", ") : "None established",
        matching.filter(item => item.cell.supportLevel === "unknown").length,
        assertionEvidenceLinks(assertionIds),
      ];
    });
}

const sourceStates = Object.entries(Object.groupBy(registry.evidence, evidence => `${evidence.contentReviewState} / ${evidence.reviewDepth}`))
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([state, records]) => [state, records.length]);

const generated = `---
id: GAEP-STR-004
title: Evidence-Governed Market Category, Benchmark, and Positioning
document_type: product-strategy
schema_version: 1.0
version: ${registry.projection.documentVersion}
status: proposed
owner_role: GAEP Product Owner
scope: P02 market category, competitive benchmark, executive claims, and adoption decision support
normative_level: informative
classification: internal
provenance: Deterministically generated from GAEP-REG-013 version ${registry.version}
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-001
  - GAEP-CST-003
  - GAEP-REG-003
  - GAEP-REG-011
  - GAEP-REG-012
informative_references:
  - ../99_Registries_and_References/013_MARKET_EVIDENCE_AND_BENCHMARK_REGISTRY.json
  - ../../99_References/993_EXTERNAL_PROJECTS.md
supersedes: []
---

# Evidence-Governed Market Category, Benchmark, and Positioning

> **Authority boundary:** Proposed, internal decision support. No category, benchmark, claim, purchase, publication, Product Owner acceptance, or release is approved. This projection does not make GAEP enterprise-ready, production-ready, secure, compliant, superior, complete, end-to-end, or proven.

Generated from **${registry.registryId} v${registry.version}**, research snapshot **${registry.researchAsOf}**, registry SHA-256 \`${digest}\`. Edit the canonical registry and rerun \`npm run render:market-benchmark\`; do not edit generated market assertions here.

## How to read this document

- **Verified** means a current active assertion for this exact Product/capability has full or substantive official-source review.
- **Partial** means official Evidence establishes only a bounded part of the compound capability.
- **Unsupported by reviewed evidence** requires explicit reviewed negative Evidence; documentation silence is insufficient.
- Unknown means not assessed or not established by reviewed evidence; it never means No.
- **N/A** requires an explicit applicability rationale.
- A shipped state needs a separate official availability assertion. Counts are coverage indicators, not a score or ranking.

## 1. Market/category definition

GAEP is being evaluated as a **composite governed Product-to-Operations decision and evidence system**, not as one undifferentiated substitute for every specialized lifecycle tool. The category remains a hypothesis pending comprehension and outcome research.

${table(["Category", "Definition", "Includes", "Excludes"], registry.marketCategories.map(category => [category.name, category.definition, category.inclusionCriteria.join("; "), category.exclusionCriteria.join("; ")]))}

### Ambiguous Product Owner search seeds

${table(["Seed", "Resolution", "Selected identity", "Reason", "Evidence"], registry.seedResolutions.map(seed => [seed.inputName, seed.resolutionState, seed.selectedIdentity ?? "No identity selected", seed.rationale, assertionEvidenceLinks(seed.assertionIds)]))}

AWS AI-DLC is treated as a methodology rather than a vendor product. “Spec Flow” was not silently normalized: the discontinued SpecFlow BDD project and the current GitHub Spec Kit are distinct identities; the benchmark evaluates Spec Kit and records SpecFlow only as identity-resolution evidence.

### P01 Product identity boundary

P02 preserves the P01 naming recommendation; it does not reopen, approve, or replace it.

| Element | P01 recommended candidate |
| --- | --- |
| Canonical name | **Governed AI Engineering Platform** |
| Descriptor | **An evidence-driven, adaptive product-to-operations engineering system.** |
| Optional tagline | **From product intent to operational evidence.** |
| Decision state | **Proposed — awaiting explicit Product Owner acceptance** |

### Naming drift inventory

The candidate name, descriptor, tagline, and approval boundary above project P01; they are not new P02 market Evidence. Rename, alias, trademark, localization, package/command migration, and public-brand decisions remain separately governed. The open P01 positioning decisions remain owned by their existing crosswalk:

| Decision ID | Decision still requiring human authority |
| --- | --- |
| GAEP-STR-POS-DEC-001 | Which category target users understand without extensive explanation |
| GAEP-STR-POS-DEC-002 | Which alternative is the primary incumbent for the first workflow |
| GAEP-STR-POS-DEC-003 | Which differentiator is valuable and defensible with first-horizon Evidence |
| GAEP-STR-POS-DEC-004 | Which capabilities should be composed rather than owned by GAEP |
| GAEP-STR-POS-DEC-005 | Which provider-substitution test is sufficient for a portability claim |
| GAEP-STR-POS-DEC-006 | Which claims may be used internally, publicly, or commercially at each Evidence stage |

## 2. Landscape and inclusion/exclusion rationale

Inclusion required an official current identity and enough reviewed official Evidence to evaluate at least one defined capability. Classification describes relationship to GAEP's candidate scope, not quality. No reviewed Product was established as a direct full-scope competitor; this is not proof that none exists.

${table(["Product/project", "Relationship", "Category membership", "Bounded rationale", "Official Evidence"], landscapeRows)}

### Methodologies/frameworks kept outside the Product matrix

${table(["Methodology/framework", "Identity treatment", "Relevant capabilities", "Boundary"], registry.methodologyBindings.map(item => [item.canonicalName, item.identityType, names(item.relevantCapabilityIds, capabilityById), item.limitation]))}

### Explicit exclusions

${table(["Identity", "Reason excluded", "Evidence"], registry.excludedIdentities.map(item => [item.canonicalName, item.reason, assertionEvidenceLinks(item.assertionIds)]))}

ERP appears only as an explicit enterprise-product boundary example. Enterprise Products are not equated with ERP, and SAP S/4HANA does not pad the 15-Product benchmark matrix.

## 3. Evidence-bound comparison

Every evaluated Product has exactly 30 defined cells: **15 × 30 = 450**. The following compact view exposes evidence coverage without inventing a winner.

${table(["Product/project", "Verified", "Partial", "Unsupported by reviewed evidence", "Unknown", "N/A"], benchmarkSummaryRows)}

This compact table is not a score or ranking. Raw support assertions, cell rationale, limitations, delivery state, and as-of bindings are authoritative in GAEP-REG-013. No aggregate winner score is permitted.

### Capability-by-capability evidence view

${capabilityGroups.map(([group, startId, endId]) => `#### ${group}\n\n${table(["Capability", "GAEP maturity", "Verified Products", "Partially supported Products", "Unknown count", "Official Evidence"], capabilityComparisonRows(startId, endId))}`).join("\n\n")}

### Evidence review state

${table(["Review state / depth", "Official sources"], sourceStates)}

All ${registry.evidence.length} entries use official HTTPS sources. Living pages are snapshots as of ${registry.researchAsOf}; they must be reviewed on recorded triggers. A digest appears only when exact bytes were legally captured—none is implied by a URL or access date.

## 4. GAEP differentiation with current-vs-future separation

These observations derive from exact repository assertions at the recorded commit. They do not create Product Owner acceptance, market validation, readiness, security/compliance authority, or public claim permission.

${table(["Capability", "GAEP maturity", "Repository observation", "Limitation"], registry.gaepMaturity.map(item => {
  const assertions = item.repositoryAssertionIds.map(id => repositoryAssertionById.get(id));
  return [`${item.capabilityId} — ${capabilityById.get(item.capabilityId).name}`, item.maturityState, assertions.map(entry => `${entry.repositoryAssertionId}: ${entry.proposition} [${entry.repositoryEvidence.map(proof => `${proof.role}:${proof.path}@${proof.gitBlobObjectId.slice(0, 12)}`).join(", ")}]`).join("; "), item.limitation];
}))}

GAEP's candidate distinction is the combination of governed sources, explicit human proposal/review/accept/commit authority, Initiative tailoring, cross-lifecycle traceability, and provider/tool portability. Each element must be stated at its exact maturity. Planned work is not comparable to another Product's shipped feature as equivalent delivery.

## 5. Executive adoption decision guide

Do not choose from brand familiarity, AI novelty, or the count table. Select a scenario, inspect relevant cells and Unknowns, then run a bounded proof of value.

${registry.scenarios.map(scenario => `### ${scenario.name}\n\n**Decision criteria:** ${scenario.decisionCriteria.join("; ")}.\n\n**Fit:** ${scenario.fitConditions.join("; ")}.\n\n**Non-fit:** ${scenario.nonFitConditions.join("; ")}.\n\n**Risks and trade-offs:** ${scenario.risksAndTradeoffs.join("; ")}.\n\n**Build/buy/adopt/augment:** ${scenario.buildBuyAdoptAugment.join("; ")}.\n\n**Evaluation questions:** ${scenario.evaluationQuestions.join("; ")}.\n\nApplicable capabilities: ${names(scenario.applicableCapabilityIds, capabilityById)}. Ranking policy: **${scenario.rankingPolicy}**.`).join("\n\n")}

### Proof-of-value metrics

No benchmark value is invented. Each threshold remains a human decision until a baseline and observation plan exist.

${table(["Metric", "Definition", "Baseline", "Window", "Data owner", "Confounders", "Decision threshold"], registry.proofOfValueMetrics.map(metric => [metric.name, metric.definition, metric.baseline, metric.observationWindow, metric.dataOwner, metric.confounders.join("; "), metric.decisionThreshold]))}

## 6. Claim registry summary

Only the exact bounded wording may be considered. Even \`allowed-internal\` entries remain **not approved** and **not published**. Prohibited entries are guardrails, not reusable marketing copy.

${table(["Claim", "Class", "Disposition", "Bounded wording", "Exact support", "Required qualifiers"], registry.claims.map(claim => [claim.claimId, claim.claimClass, claim.disposition, claim.wording, `${assertionEvidenceLinks(claim.supportAssertionIds)}; repository: ${claim.repositoryAssertionIds.join(", ") || "none"}`, claim.requiredQualifiers.join("; ")]))}

## 7. Limitations, unknowns and research debt

${registry.researchDebt.map(item => `- **${item.debtId} — ${item.subject}.** ${item.reason} Required Evidence: ${item.requiredEvidence}. Owner: ${item.ownerRole}. State: ${item.status}.`).join("\n")}

Key limits:

- The research snapshot is current only to ${registry.researchAsOf}; living vendor pages can change without versioned releases.
- Official documentation establishes publisher claims, not operational effectiveness or customer outcomes.
- No customer interviews, comparative trials, procurement diligence, security assessment, price normalization, or outcome measurement occurred in P02.
- Unknown cells are preserved, not converted to negative claims.
- No comparison proves GAEP is a better choice; the correct outcome may be a narrower tool, an existing-tool composition, or no GAEP adoption.

## 8. P03 projection contract

P03 may project category definitions, Product identities, relationship classes, the exact 30 capability labels, benchmark states, Evidence, limitations, freshness, GAEP maturity, claim disposition, scenarios, and proof-of-value definitions from GAEP-REG-013.

P03 must consume registry version and digest, preserve Unknown and current-vs-future distinctions, expose Evidence and limitations, and fail on projection drift. P03 must not copy canonical truth, approve claims, invent scores, merge Products with methodologies, or add market assertions outside GAEP-REG-013. **P03 has not started.**

## Canonical source and migration

- **Canonical market and benchmark truth:** GAEP-REG-013 v${registry.version}.
- **Contract:** GAEP-REG-012 v0.2.1.
- **Methodology and standards truth:** GAEP-REG-011 remains owned by P01.
- **This document:** deterministic human projection only.
- **Legacy 17-capability taxonomy:** preserved only through the registry migration map; legacy IDs are not repurposed and one-to-many conclusions require human review.
- **Legacy external-project register:** historical cross-reference, not current benchmark authority.

P02 is not self-accepted. Independent acceptance review and explicit human authority are required before any benchmark or claim may be treated as approved or published.
`;

if (args.has("--write")) {
  fs.writeFileSync(outputPath, generated);
  console.log(`Wrote ${path.relative(ROOT, outputPath)} from ${registry.registryId} v${registry.version}.`);
} else {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
  if (current !== generated) {
    console.error(`${path.relative(ROOT, outputPath)} is stale; run npm run render:market-benchmark.`);
    process.exit(1);
  }
  console.log(`${path.relative(ROOT, outputPath)} is current with ${registry.registryId} v${registry.version}.`);
}
