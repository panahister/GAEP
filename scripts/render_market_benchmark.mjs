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
const evidenceById = new Map(registry.evidence.map(evidence => [evidence.evidenceId, evidence]));
const digest = crypto.createHash("sha256").update(fs.readFileSync(REGISTRY_PATH)).digest("hex");
const outputPath = path.join(ROOT, registry.projection.path);

const clean = value => String(value).replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
const list = values => values.length > 0 ? values.map(value => `- ${value}`).join("\n") : "- None recorded.";
const names = (ids, lookup) => ids.map(id => lookup.get(id)?.name ?? lookup.get(id)?.canonicalName ?? id).join(", ");
const evidenceLinks = ids => ids.length === 0
  ? "Repository evidence only"
  : ids.map(id => {
    const evidence = evidenceById.get(id);
    return `[${id}](${evidence.officialUri})`;
  }).join(", ");

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map(row => `| ${row.map(clean).join(" | ")} |`),
  ].join("\n");
}

const classificationOrder = [
  "direct-competitor",
  "adjacent-alternative",
  "partial-substitute",
  "complement-integration-candidate",
  "methodology-framework-not-product",
  "excluded-with-reason",
];

const landscapeRows = [...registry.landscapeEvaluations]
  .sort((left, right) => {
    const classOrder = classificationOrder.indexOf(left.classification) - classificationOrder.indexOf(right.classification);
    return classOrder || left.productId.localeCompare(right.productId);
  })
  .map(evaluation => {
    const product = productById.get(evaluation.productId);
    return [
      product.canonicalName,
      evaluation.classification,
      names(product.categoryIds, new Map(registry.marketCategories.map(category => [category.categoryId, category]))),
      evaluation.rationale,
      evidenceLinks(evaluation.evidenceIds),
    ];
  });

const benchmarkRows = registry.benchmarkRows.map(row => {
  const counts = Object.fromEntries(["verified-supported", "partially-supported", "unsupported-by-reviewed-evidence", "unknown", "not-applicable"].map(state => [state, 0]));
  for (const cell of row.cells) counts[cell.supportLevel] += 1;
  return [
    productById.get(row.productId).canonicalName,
    counts["verified-supported"],
    counts["partially-supported"],
    counts["unsupported-by-reviewed-evidence"],
    counts.unknown,
    counts["not-applicable"],
  ];
});

const sourceStates = Object.entries(Object.groupBy(registry.evidence, evidence => evidence.contentReviewState))
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([state, records]) => [state, records.length]);

const generated = `---
id: GAEP-STR-004
title: Evidence-Governed Market Category, Benchmark, and Positioning
document_type: product-strategy
schema_version: 1.0
version: 0.3.0
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

Generated from **${registry.registryId} v${registry.version}**, research snapshot **${registry.researchAsOf}**, registry SHA-256 \`${digest}\`. Edit the registry and rerun \`npm run render:market-benchmark\`; do not edit generated market assertions here.

## 1. Market/category definition

GAEP is being evaluated as a **composite governed Product-to-Operations decision and evidence system**, not as one undifferentiated substitute for every specialized lifecycle tool. The category remains a hypothesis pending comprehension and outcome research.

${table(
  ["Category", "Definition", "Includes", "Excludes"],
  registry.marketCategories.map(category => [category.name, category.definition, category.inclusionCriteria.join("; "), category.exclusionCriteria.join("; ")]),
)}

### Ambiguous Product Owner search seeds

${table(
  ["Seed", "Resolution", "Selected identity", "Reason", "Evidence"],
  registry.seedResolutions.map(seed => [seed.inputName, seed.resolutionState, seed.selectedIdentity ?? "No identity selected", seed.rationale, evidenceLinks(seed.evidenceIds)]),
)}

AWS AI-DLC is treated as a methodology rather than a vendor product. “Spec Flow” was not silently normalized: the discontinued SpecFlow BDD project and the current GitHub Spec Kit are distinct identities; the benchmark evaluates Spec Kit and records SpecFlow only as identity-resolution evidence.

### P01 Product identity boundary

P02 preserves the P01 naming recommendation; it does not reopen, approve, or replace it.

| Element | P01 recommended candidate |
| --- | --- |
| Canonical name | **Governed AI Engineering Platform** |
| Descriptor | **An evidence-driven, adaptive product-to-operations engineering system.** |
| Optional tagline | **From product intent to operational evidence.** |
| Decision state | **Proposed — awaiting explicit Product Owner acceptance** |

## Naming drift inventory

The name, descriptor, tagline, and approval boundary above are a projection of the accepted-for-roadmap-progression P01 artifact state, not new P02 market evidence. Any rename, alias, trademark conclusion, localization, package/command migration, or public-brand decision remains separately governed.

The P01 Product Strategy decisions remain open and retain their existing crosswalk ownership:

| Decision ID | Decision still requiring human authority |
| --- | --- |
| GAEP-STR-POS-DEC-001 | Which category target users understand without extensive explanation |
| GAEP-STR-POS-DEC-002 | Which alternative is the primary incumbent for the first workflow |
| GAEP-STR-POS-DEC-003 | Which differentiator is valuable and defensible with first-horizon evidence |
| GAEP-STR-POS-DEC-004 | Which capabilities should be composed rather than owned by GAEP |
| GAEP-STR-POS-DEC-005 | Which provider-substitution test is sufficient for a portability claim |
| GAEP-STR-POS-DEC-006 | Which claims may be used internally, publicly, or commercially at each evidence stage |

## 2. Landscape and inclusion/exclusion rationale

Inclusion required an official, current identity and enough official evidence to evaluate at least one defined capability. Classification describes relationship to GAEP's candidate scope, not quality. No reviewed product was established as a direct full-scope competitor; this is not proof that no such competitor exists.

${table(["Product/project", "Relationship", "Category membership", "Bounded rationale", "Official evidence"], landscapeRows)}

Products and methodologies are deliberately separated. SAP S/4HANA is retained only as an ERP boundary example; Enterprise Products are not equated with ERP.

## 3. Evidence-bound comparison

Every Product has exactly ${registry.capabilities.length} defined cells. **Unknown means not assessed or not established by reviewed evidence; it never means No.** “Unsupported by reviewed evidence” requires affirmative reviewed evidence and is not inferred from documentation silence. Preview, roadmap, extension, and inference states remain distinct from shipped capability.

${table(
  ["Product/project", "Verified", "Partial", "Unsupported by reviewed evidence", "Unknown", "N/A"],
  benchmarkRows,
)}

This compact table is a coverage view, not a score or ranking. Raw evidence, cell rationale, limitations, delivery state, and as-of bindings are authoritative in GAEP-REG-013. No aggregate winner score is permitted.

### Evidence review state

${table(["Review state", "Official sources"], sourceStates)}

All ${registry.evidence.length} entries use official HTTPS sources. Living pages are snapshots as of ${registry.researchAsOf}; they must be reviewed on their recorded triggers. A source digest appears only when exact bytes were legally captured—none is implied by a URL or access date.

## 4. GAEP differentiation with current-vs-future separation

The following is derived from exact repository paths. Implementation status does not create Product Owner acceptance, market validation, enterprise readiness, security/compliance authority, or public claim permission.

${table(
  ["Capability", "GAEP maturity", "Repository basis", "Limitation"],
  registry.gaepMaturity.map(item => [capabilityById.get(item.capabilityId).name, item.maturityState, item.repositoryEvidence.join("; "), item.limitation]),
)}

GAEP's candidate distinction is the combination of governed sources, explicit human proposal/accept/commit authority, Initiative tailoring, cross-lifecycle traceability, and provider/tool portability. Each element must be stated at its recorded maturity; planned work must never be compared with another product's shipped feature as equivalent delivery.

## 5. Executive adoption decision guide

Do not choose from brand familiarity, AI novelty, or this document's count table. Select a scenario, inspect its relevant cells and unknowns, and validate fit through a bounded proof of value.

${registry.scenarios.map(scenario => `### ${scenario.name}

**Decision criteria:** ${scenario.decisionCriteria.join("; ")}.

**Fit:** ${scenario.fitConditions.join("; ")}.

**Non-fit:** ${scenario.nonFitConditions.join("; ")}.

**Trade-offs:** ${scenario.risksAndTradeoffs.join("; ")}.

**Build/buy/adopt/augment:** ${scenario.buildBuyAdoptAugment.join("; ")}.

**Evaluation questions:** ${scenario.evaluationQuestions.join("; ")}.

Applicable capabilities: ${names(scenario.applicableCapabilityIds, capabilityById)}. Ranking policy: **${scenario.rankingPolicy}**.`).join("\n\n")}

### Proof-of-value metrics

No benchmark value is invented. Each threshold remains a human decision until a baseline and observation plan exist.

${table(
  ["Metric", "Definition", "Baseline", "Window", "Data owner", "Confounders", "Decision threshold"],
  registry.proofOfValueMetrics.map(metric => [metric.name, metric.definition, metric.baseline, metric.observationWindow, metric.dataOwner, metric.confounders.join("; "), metric.decisionThreshold]),
)}

## 6. Claim registry summary

Only exact bounded wording may be considered, and even allowed-internal entries remain **not approved** and **not published**. Prohibited entries are guardrails, not reusable marketing copy.

${table(
  ["Claim", "Class", "Disposition", "Bounded wording", "Evidence/maturity", "Required qualifiers"],
  registry.claims.map(claim => [claim.claimId, claim.claimClass, claim.disposition, claim.wording, `${evidenceLinks(claim.evidenceIds)}; ${names(claim.gaepCapabilityIds, capabilityById) || "No GAEP capability binding"}`, claim.requiredQualifiers.join("; ")]),
)}

## 7. Limitations, unknowns and research debt

${registry.researchDebt.map(item => `- **${item.debtId} — ${item.question}** Owner: ${item.ownerRole}. Trigger: ${item.trigger}. State: ${item.status}.`).join("\n")}

Key limits:

- The research snapshot is current only to ${registry.researchAsOf}; living vendor pages can change without versioned releases.
- One official page per Product is enough for inclusion, not exhaustive feature or licensing due diligence.
- No customer interviews, comparative trials, procurement diligence, security assessment, price normalization, or outcome measurement occurred in P02.
- Unknown cells are preserved, not converted to negative claims.
- No comparison proves GAEP is a better choice; the correct outcome may be a narrower tool, an existing-tool composition, or no GAEP adoption.

## 8. P03 projection contract

P03 may project the following from GAEP-REG-013 without creating duplicate truth:

- category names and definitions;
- Product identities and relationship classifications;
- benchmark support, evidence, delivery, limitation, and as-of states;
- GAEP maturity states and repository bindings;
- exact claim wording, disposition, qualifiers, approval, and publication state;
- scenario decision criteria, fit/non-fit conditions, questions, and proof-of-value definitions.

P03 must consume the registry version and digest, preserve Unknown and current-vs-future distinctions, expose evidence and limitations, and fail on projection drift. P03 must not approve claims, invent scores, merge Products with methodologies, or add market truth outside GAEP-REG-013.

## Canonical source and migration

- **Canonical market evidence and benchmark truth:** GAEP-REG-013.
- **Contract:** GAEP-REG-012.
- **Methodology and standards truth:** GAEP-REG-011 remains owned by P01.
- **This document:** deterministic human projection only.
- **Legacy external-project register:** preserved as historical and cross-referenced; it is not a current benchmark authority.

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
