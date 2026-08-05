import type { GaepEngine } from "@gaep/engine"

import {
  listPhase1CanonicalRecordedRecords,
  phase1CanonicalRecordCatalog,
} from "./phase1-canonical-authoring.js"
import { phase1CanonicalPresentation } from "./phase1-canonical-presentation.js"
import { markdownTable } from "./product-chat-source-intake.js"

interface ExportOptions {
  generatedAt?: string
}

type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined
}

function value(value: unknown, fallback = "Not specified"): string {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.length > 0 ? value.map((entry) => valueText(entry)).join("<br>") : fallback
  return fallback
}

function valueText(input: unknown): string {
  if (typeof input === "string") return input
  if (typeof input === "number" || typeof input === "boolean") return String(input)
  const entry = object(input)
  if (entry) return value(entry.title ?? entry.name ?? entry.subjectLabel ?? entry.subjectId ?? entry.id, "Structured value")
  return "Not specified"
}

function classificationRows(classification: unknown): string[][] {
  const record = object(classification)
  if (!record) return []
  return Object.entries(record)
    .filter(([key]) => !["classifiedAt", "classifiedBy", "authorityBoundary", "productDigest"].includes(key))
    .map(([key, entry]) => [key.replace(/([a-z0-9])([A-Z])/gu, "$1 $2"), value(entry)])
}

function applicabilityRows(applicability: unknown): string[][] {
  const record = object(applicability)
  const decisions = Array.isArray(record?.decisions) ? record.decisions : []
  return decisions.map((candidate) => {
    const decision = object(candidate) ?? {}
    return [
      value(decision.subjectLabel ?? decision.subjectId),
      value(decision.status),
      value(decision.ownerRoleKey ?? decision.owner),
      value(decision.accountableApproverRoleKey ?? decision.accountableApprover),
      value(decision.rationale),
      value(decision.reviewTrigger),
    ]
  })
}

export async function buildProductJourneyMarkdown(
  engine: GaepEngine,
  initiativeId: string,
  options: ExportOptions = {},
): Promise<string> {
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const [product, initiative, sourceRecords, baselines, provenance, sourceAssessment, canonicalRecords] = await Promise.all([
    engine.readProduct(),
    engine.readInitiative(initiativeId),
    engine.sourceGovernance.listSources(initiativeId),
    engine.sourceGovernance.listBaselines(initiativeId),
    engine.sourceGovernance.listProvenance(initiativeId),
    engine.sourceGovernance.assess(initiativeId),
    listPhase1CanonicalRecordedRecords(engine, initiativeId),
  ])
  const recordedByKind = new Map(canonicalRecords.map((entry) => [entry.kind, entry]))
  const lines: string[] = [
    `# ${product.name} — Product Journey`,
    "",
    `Generated: ${generatedAt}`,
    "",
    "> This document is an export of governed GAEP records. The export itself grants no approval, source, design, Figma, implementation, release, or operational authority.",
    "",
    "## Journey overview",
    "",
    markdownTable(["Checkpoint", "Status", "Revision / coverage", "Purpose"], [
      ["Product definition", "Recorded", `Revision ${product.revision ?? 1}`, "Defines the durable Product boundary."],
      ["Initiative definition", "Recorded", `Revision ${initiative.revision ?? 1}`, "Defines the bounded change under review."],
      ["Initiative classification", initiative.classification ? "Recorded" : "Missing", initiative.classification ? "Governed classification present" : "—", "Classifies change posture, exposure, risk, and assurance context."],
      ["Initiative applicability", initiative.applicability ? "Recorded" : "Missing", initiative.applicability ? `${initiative.applicability.decisions.length} decision(s); ${initiative.applicability.unresolvedSubjects.length} unresolved` : "—", "Maps the canonical lifecycle subjects."],
      ["Source intake", sourceRecords.length > 0 ? "Recorded" : "Missing", `${sourceRecords.length} Source revision(s)`, "Records reviewed candidate documents."],
      ["Source baseline", sourceAssessment.currentBaseline ? "Recorded" : "Missing", sourceAssessment.currentBaseline ? `Revision ${sourceAssessment.currentBaseline.revision}` : "—", "Freezes the exact reviewed Source set."],
      ["Source provenance", provenance.length > 0 ? "Recorded" : "Missing", `${provenance.length} lineage record(s)`, "Links accepted facts to exact Source revisions."],
      ...phase1CanonicalRecordCatalog.map((entry) => {
        const recorded = recordedByKind.get(entry.kind)
        return [entry.label, recorded ? "Recorded" : "Missing", recorded ? `Revision ${recorded.revision}` : "—", entry.group]
      }),
    ]),
    "",
    "```mermaid",
    "flowchart LR",
    "  P[\"Product definition\"] --> I[\"Initiative definition\"]",
    "  I --> C[\"Classification and applicability\"]",
    "  C --> S[\"Source intake, baseline, provenance\"]",
    "  S --> D[\"Product discovery\"]",
    "  D --> B[\"Business architecture\"]",
    "  B --> A[\"Solution and security architecture\"]",
    "  A --> E[\"Event Storming and detailed assurance\"]",
    "  E --> H[\"Pre-Figma readiness and handoff\"]",
    "```",
    "",
    "## Product definition",
    "",
    markdownTable(["Field", "Governed value"], [
      ["Name", product.name],
      ["Summary", product.summary],
      ["Problem", product.problem],
      ["Affected users", product.affectedUsers],
      ["Desired outcome", product.desiredOutcome],
      ["Success signals", product.successSignals.join("<br>")],
      ["First workflow", product.firstWorkflow],
      ["Exclusions", product.exclusions.join("<br>") || "None recorded"],
      ["Profile", product.profile],
    ]),
    "",
    "## Initiative definition",
    "",
    markdownTable(["Field", "Governed value"], [
      ["Title", initiative.title],
      ["Outcome", initiative.outcome],
      ["Included scope", initiative.scope.join("<br>")],
      ["Exclusions", initiative.exclusions.join("<br>") || "None recorded"],
      ["State", initiative.state],
    ]),
  ]

  if (initiative.classification) lines.push(
    "",
    "## Initiative classification",
    "",
    markdownTable(["Dimension", "Governed value"], classificationRows(initiative.classification)),
  )
  if (initiative.applicability) lines.push(
    "",
    "## Initiative applicability",
    "",
    markdownTable(["Subject", "Status", "Owner", "Accountable approver", "Rationale", "Review trigger"], applicabilityRows(initiative.applicability)),
  )

  lines.push(
    "",
    "## Source intake, baseline, and provenance",
    "",
    markdownTable(["Source", "Type", "Classification", "Revision", "Content digest"], sourceRecords.map((source) => [
      source.title,
      source.sourceType,
      source.informationClassification,
      String(source.revision),
      source.contentDigest,
    ])),
    "",
    `Baselines recorded: **${baselines.length}**. Current baseline: **${sourceAssessment.currentBaseline ? `revision ${sourceAssessment.currentBaseline.revision}` : "none"}**. Provenance records: **${provenance.length}**.`,
  )

  for (const entry of canonicalRecords) {
    lines.push(
      "",
      "---",
      "",
      `# ${entry.group} — ${entry.label}`,
      "",
      `Current revision: **${entry.revision}** · History: **${entry.history.length} revision(s)**`,
      "",
      phase1CanonicalPresentation({ kind: entry.kind, label: entry.label, draft: entry.record }),
    )
  }

  lines.push(
    "",
    "---",
    "",
    "## Pre-Figma boundary",
    "",
    "This export may package reviewed inputs for Product Design. It does not perform the Figma MCP roundtrip, create or approve a Figma artifact, synchronize Figma back to GAEP, or grant implementation authority.",
    "",
  )
  return lines.join("\n")
}
