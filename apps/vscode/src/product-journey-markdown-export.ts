import type { GaepEngine } from "@gaep/engine"

import {
  listPhase1CanonicalRecordedRecords,
  phase1CanonicalRecordCatalog,
} from "./phase1-canonical-authoring.js"
import { phase1CanonicalPresentation } from "./phase1-canonical-presentation.js"
import { markdownTable } from "./product-chat-source-intake.js"
import type { ReferenceLink } from "./reference-links.js"

interface ExportOptions {
  generatedAt?: string
  referenceLinks?: readonly ReferenceLink[]
}

function referenceLinksSection(referenceLinks: readonly ReferenceLink[] | undefined): string[] {
  if (!referenceLinks || referenceLinks.length === 0) return []
  return [
    "## Reference links",
    "",
    "> User-provided candidate references. GAEP does not fetch them and derives no authority from them.",
    "",
    markdownTable(["Label", "URL", "Note"], referenceLinks.map((link) => [link.label, link.url, link.note || "—"])),
  ]
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

function sourceSummary(source: { description?: string }): string {
  const text = (source.description ?? "").trim().replace(/\s+/gu, " ")
  if (!text) return "—"
  return text.length <= 200 ? text : `${text.slice(0, 199)}…`
}

function applicabilityRows(applicability: unknown): string[][] {
  const record = object(applicability)
  const decisions = Array.isArray(record?.decisions) ? record.decisions : []
  return decisions.map((candidate) => {
    const decision = object(candidate) ?? {}
    const subject = object(decision.subject)
    return [
      value(subject?.label ?? subject?.key ?? decision.subjectLabel ?? decision.subjectId),
      value(decision.status),
      value(decision.owner ?? decision.ownerRoleKey),
      value(decision.accountableApprover ?? decision.accountableApproverRoleKey, "—"),
      value(decision.rationale),
      value(decision.reviewTriggers ?? decision.reviewTrigger),
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
    markdownTable(["Subject", "Status", "Responsible (owner)", "Accountable (approver)", "Rationale", "Review triggers"], applicabilityRows(initiative.applicability)),
  )

  lines.push(
    "",
    "## Source intake, baseline, and provenance",
    "",
    markdownTable(["Source", "Summary", "Type", "Classification", "Revision", "Content digest"], sourceRecords.map((source) => [
      source.title,
      sourceSummary(source),
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

export interface ProductJourneyReviewSection {
  readonly id: string
  readonly title: string
  /** The exact `## N. Title` heading line, used to position a preview. */
  readonly heading: string
}

export interface ProductJourneyReview {
  readonly markdown: string
  readonly sections: ProductJourneyReviewSection[]
}

const reviewCheckpoints: ReadonlyArray<{ id: string; title: string; group?: string }> = [
  { id: "product-definition", title: "Product definition" },
  { id: "initiative-definition", title: "Initiative definition" },
  { id: "initiative-classification", title: "Initiative classification" },
  { id: "initiative-applicability", title: "Initiative applicability" },
  { id: "source-intake", title: "Source intake" },
  { id: "source-baseline", title: "Source baseline" },
  { id: "source-provenance", title: "Source provenance" },
  { id: "product-discovery", title: "Product discovery", group: "Product discovery" },
  { id: "business-architecture", title: "Business architecture", group: "Business architecture" },
  { id: "solution-security-architecture", title: "Solution and security architecture", group: "Solution and security architecture" },
  { id: "detailed-design-assurance", title: "Detailed design and assurance", group: "Detailed design and assurance" },
  { id: "p0-p4-readiness", title: "Pre-Figma readiness and handoff", group: "Pre-Figma readiness and handoff" },
]

function anchor(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 -]/gu, "").replace(/\s+/gu, "-")
}

/**
 * Candidate accountable/responsible role guidance per checkpoint. This is a
 * recommendation for human review — it appoints no one and grants no authority.
 */
const checkpointRoleGuidance: Record<string, { responsible: string; accountable: string }> = {
  "product-definition": { responsible: "Product Owner", accountable: "Business Sponsor" },
  "initiative-definition": { responsible: "Product Owner", accountable: "Business Sponsor" },
  "initiative-classification": { responsible: "Product Owner", accountable: "Risk Owner" },
  "initiative-applicability": { responsible: "Product Owner", accountable: "Business Sponsor" },
  "source-intake": { responsible: "Product Manager", accountable: "Product Owner" },
  "source-baseline": { responsible: "Data Steward", accountable: "Product Owner" },
  "source-provenance": { responsible: "Data Steward", accountable: "Product Owner" },
  "product-discovery": { responsible: "Product Manager", accountable: "Product Owner" },
  "business-architecture": { responsible: "Business Architect", accountable: "Product Owner" },
  "solution-security-architecture": { responsible: "Solution Architect", accountable: "Architecture Authority" },
  "detailed-design-assurance": { responsible: "Solution Architect", accountable: "Engineering Authority" },
  "p0-p4-readiness": { responsible: "Delivery Manager", accountable: "Product Owner" },
}

/**
 * Build a single navigable, Mermaid-rich Markdown document that reviews the
 * whole Product Journey. Returned `sections` expose the exact heading line for
 * each of the twelve checkpoints so a host can open the built-in Markdown
 * preview positioned on the selected checkpoint while remaining navigable to
 * the others. This is a read-only projection and grants no authority.
 */
export async function buildProductJourneyReview(
  engine: GaepEngine,
  initiativeId: string,
  options: ExportOptions = {},
): Promise<ProductJourneyReview> {
  const generated = options.generatedAt ?? new Date().toISOString()
  const [product, initiative, sourceRecords, baselines, provenance, sourceAssessment, canonicalRecords] = await Promise.all([
    engine.readProduct(),
    engine.readInitiative(initiativeId),
    engine.sourceGovernance.listSources(initiativeId),
    engine.sourceGovernance.listBaselines(initiativeId),
    engine.sourceGovernance.listProvenance(initiativeId),
    engine.sourceGovernance.assess(initiativeId),
    listPhase1CanonicalRecordedRecords(engine, initiativeId),
  ])

  const sectionBody = (id: string, group: string | undefined): string[] => {
    switch (id) {
      case "product-definition":
        return [markdownTable(["Field", "Governed value"], [
          ["Name", product.name],
          ["Summary", product.summary],
          ["Problem", product.problem],
          ["Affected users", product.affectedUsers],
          ["Desired outcome", product.desiredOutcome],
          ["Success signals", product.successSignals.join("<br>")],
          ["First workflow", product.firstWorkflow],
          ["Exclusions", product.exclusions.join("<br>") || "None recorded"],
          ["Profile", product.profile],
        ])]
      case "initiative-definition":
        return [markdownTable(["Field", "Governed value"], [
          ["Title", initiative.title],
          ["Outcome", initiative.outcome],
          ["Included scope", initiative.scope.join("<br>")],
          ["Exclusions", initiative.exclusions.join("<br>") || "None recorded"],
          ["State", initiative.state],
        ])]
      case "initiative-classification":
        return initiative.classification
          ? [markdownTable(["Dimension", "Governed value"], classificationRows(initiative.classification))]
          : ["_Not yet recorded._"]
      case "initiative-applicability":
        return initiative.applicability
          ? [
              `Mapped subjects: **${initiative.applicability.decisions.length}** · Unresolved: **${initiative.applicability.unresolvedSubjects.length}**.`,
              "",
              markdownTable(["Subject", "Status", "Responsible (owner)", "Accountable (approver)", "Rationale", "Review triggers"], applicabilityRows(initiative.applicability)),
            ]
          : ["_Not yet recorded._"]
      case "source-intake":
        return sourceRecords.length > 0
          ? [markdownTable(["Source", "Summary", "Type", "Classification", "Revision", "Content digest"], sourceRecords.map((source) => [
              source.title, sourceSummary(source), source.sourceType, source.informationClassification, String(source.revision), source.contentDigest,
            ]))]
          : ["_No reviewed sources recorded yet._"]
      case "source-baseline":
        return sourceAssessment.currentBaseline
          ? [`Baselines recorded: **${baselines.length}**. Current baseline: **revision ${sourceAssessment.currentBaseline.revision}** · **${sourceAssessment.currentBaseline.memberCount} member(s)**.`]
          : ["_No baseline frozen yet._"]
      case "source-provenance":
        return provenance.length > 0
          ? [`Provenance records: **${provenance.length}**. Unprovenanced Sources: **${sourceAssessment.unprovenancedSourceCount}**.`]
          : ["_No provenance recorded yet._"]
      default: {
        const groupRecords = canonicalRecords.filter((entry) => entry.group === group)
        if (groupRecords.length === 0) return ["_No governed records in this checkpoint yet._"]
        return groupRecords.flatMap((entry) => [
          `### ${entry.label}`,
          "",
          `Current revision: **${entry.revision}** · History: **${entry.history.length} revision(s)**`,
          "",
          phase1CanonicalPresentation({ kind: entry.kind, label: entry.label, draft: entry.record }),
          "",
        ])
      }
    }
  }

  const sections: ProductJourneyReviewSection[] = reviewCheckpoints.map((checkpoint, index) => ({
    id: checkpoint.id,
    title: checkpoint.title,
    heading: `## ${index + 1}. ${checkpoint.title}`,
  }))

  const lines: string[] = [
    `# ${product.name} — Product Journey review`,
    "",
    `Generated: ${generated}`,
    "",
    "> Visual review of the governed Product Journey. Diagrams render in the Markdown preview. This is a read-only projection and grants no approval, source, design, Figma, implementation, release, or operational authority.",
    "",
    "## Checkpoints",
    "",
    ...sections.map((section, index) => `${index + 1}. [${section.title}](#${anchor(`${index + 1}. ${section.title}`)})`),
  ]
  reviewCheckpoints.forEach((checkpoint, index) => {
    const roles = checkpointRoleGuidance[checkpoint.id]
    const roleLine = roles
      ? [`_Candidate role guidance — **Responsible:** ${roles.responsible} · **Accountable:** ${roles.accountable}. This appoints no one and grants no authority._`, ""]
      : []
    lines.push("", "---", "", `## ${index + 1}. ${checkpoint.title}`, "", ...roleLine, ...sectionBody(checkpoint.id, checkpoint.group))
  })
  const links = referenceLinksSection(options.referenceLinks)
  if (links.length > 0) lines.push("", "---", "", ...links)

  return { markdown: lines.join("\n"), sections }
}

export interface ProductJourneyExportFile {
  /** POSIX-style path relative to the chosen export root folder. */
  readonly path: string
  readonly contents: string
}

const EXPORT_AUTHORITY_BOUNDARY =
  "this-export-is-a-projection-of-governed-records-and-grants-no-approval-source-design-figma-implementation-release-or-operational-authority"

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 60) || "record"
}

function frontmatter(fields: Record<string, string | number | undefined>): string {
  const rows = Object.entries(fields)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, raw]) => `${key}: ${typeof raw === "string" ? JSON.stringify(raw) : raw}`)
  return ["---", ...rows, "---", ""].join("\n")
}

function sectionFile(
  fields: Record<string, string | number | undefined>,
  title: string,
  body: string[],
): string {
  return [frontmatter(fields), `# ${title}`, "", ...body].join("\n")
}

/**
 * Build a folder-shaped export of the governed Product Journey: one numbered
 * subfolder per checkpoint, each section a self-contained `.md` file carrying
 * YAML frontmatter. Only governed records are emitted; the export grants no
 * authority of any kind.
 */
export async function buildProductJourneyExportFiles(
  engine: GaepEngine,
  initiativeId: string,
  options: ExportOptions = {},
): Promise<ProductJourneyExportFile[]> {
  const generated = options.generatedAt ?? new Date().toISOString()
  const [product, initiative, sourceRecords, baselines, provenance, sourceAssessment, canonicalRecords] = await Promise.all([
    engine.readProduct(),
    engine.readInitiative(initiativeId),
    engine.sourceGovernance.listSources(initiativeId),
    engine.sourceGovernance.listBaselines(initiativeId),
    engine.sourceGovernance.listProvenance(initiativeId),
    engine.sourceGovernance.assess(initiativeId),
    listPhase1CanonicalRecordedRecords(engine, initiativeId),
  ])
  const common = { gaep_export: "product-journey", product: product.name, initiative: initiative.title, generated }
  const files: ProductJourneyExportFile[] = []

  files.push({
    path: "README.md",
    contents: [
      frontmatter({ ...common, kind: "journey-index", authority_boundary: EXPORT_AUTHORITY_BOUNDARY }),
      `# ${product.name} — Product Journey export`,
      "",
      `Generated: ${generated}`,
      "",
      "> This folder is an export of governed GAEP records. Each checkpoint is a numbered subfolder; each section is a Markdown file with YAML frontmatter. The export itself grants no approval, source, design, Figma, implementation, release, or operational authority.",
      "",
      "## Checkpoints in this export",
      "",
      markdownTable(["Checkpoint", "Status", "Revision / coverage"], [
        ["01 product-definition", "Recorded", `Revision ${product.revision ?? 1}`],
        ["02 initiative-definition", "Recorded", `Revision ${initiative.revision ?? 1}`],
        ["03 initiative-classification", initiative.classification ? "Recorded" : "Missing", initiative.classification ? "Governed" : "—"],
        ["04 initiative-applicability", initiative.applicability ? "Recorded" : "Missing", initiative.applicability ? `${initiative.applicability.decisions.length} decision(s); ${initiative.applicability.unresolvedSubjects.length} unresolved` : "—"],
        ["05 source-intake", sourceRecords.length > 0 ? "Recorded" : "Missing", `${sourceRecords.length} Source revision(s)`],
        ["06 source-baseline", sourceAssessment.currentBaseline ? "Recorded" : "Missing", sourceAssessment.currentBaseline ? `Revision ${sourceAssessment.currentBaseline.revision}` : "—"],
        ["07 source-provenance", provenance.length > 0 ? "Recorded" : "Missing", `${provenance.length} lineage record(s)`],
        ...phase1CanonicalRecordCatalog.map((entry) => {
          const recorded = canonicalRecords.find((candidate) => candidate.kind === entry.kind)
          return [`${entry.group} — ${entry.label}`, recorded ? "Recorded" : "Missing", recorded ? `Revision ${recorded.revision}` : "—"]
        }),
      ]),
    ].join("\n"),
  })

  files.push({
    path: "01_product-definition/product-definition.md",
    contents: sectionFile(
      { ...common, checkpoint: "product-definition", revision: product.revision ?? 1, authority_boundary: EXPORT_AUTHORITY_BOUNDARY },
      "Product definition",
      [markdownTable(["Field", "Governed value"], [
        ["Name", product.name],
        ["Summary", product.summary],
        ["Problem", product.problem],
        ["Affected users", product.affectedUsers],
        ["Desired outcome", product.desiredOutcome],
        ["Success signals", product.successSignals.join("<br>")],
        ["First workflow", product.firstWorkflow],
        ["Exclusions", product.exclusions.join("<br>") || "None recorded"],
        ["Profile", product.profile],
      ])],
    ),
  })

  files.push({
    path: "02_initiative-definition/initiative-definition.md",
    contents: sectionFile(
      { ...common, checkpoint: "initiative-definition", revision: initiative.revision ?? 1, authority_boundary: EXPORT_AUTHORITY_BOUNDARY },
      "Initiative definition",
      [markdownTable(["Field", "Governed value"], [
        ["Title", initiative.title],
        ["Outcome", initiative.outcome],
        ["Included scope", initiative.scope.join("<br>")],
        ["Exclusions", initiative.exclusions.join("<br>") || "None recorded"],
        ["State", initiative.state],
      ])],
    ),
  })

  if (initiative.classification) files.push({
    path: "03_initiative-classification/initiative-classification.md",
    contents: sectionFile(
      { ...common, checkpoint: "initiative-classification", authority_boundary: EXPORT_AUTHORITY_BOUNDARY },
      "Initiative classification",
      [markdownTable(["Dimension", "Governed value"], classificationRows(initiative.classification))],
    ),
  })

  if (initiative.applicability) files.push({
    path: "04_initiative-applicability/initiative-applicability.md",
    contents: sectionFile(
      { ...common, checkpoint: "initiative-applicability", revision: initiative.applicability.revision, subjects: initiative.applicability.decisions.length, authority_boundary: EXPORT_AUTHORITY_BOUNDARY },
      "Initiative applicability",
      [
        `Mapped subjects: **${initiative.applicability.decisions.length}** · Unresolved: **${initiative.applicability.unresolvedSubjects.length}**.`,
        "",
        markdownTable(["Subject", "Status", "Responsible (owner)", "Accountable (approver)", "Rationale", "Review triggers"], applicabilityRows(initiative.applicability)),
      ],
    ),
  })

  if (sourceRecords.length > 0) files.push({
    path: "05_source-intake/sources.md",
    contents: sectionFile(
      { ...common, checkpoint: "source-intake", sources: sourceRecords.length, authority_boundary: EXPORT_AUTHORITY_BOUNDARY },
      "Source intake",
      [markdownTable(["Source", "Summary", "Type", "Classification", "Revision", "Content digest"], sourceRecords.map((source) => [
        source.title,
        sourceSummary(source),
        source.sourceType,
        source.informationClassification,
        String(source.revision),
        source.contentDigest,
      ]))],
    ),
  })

  if (sourceAssessment.currentBaseline) files.push({
    path: "06_source-baseline/baseline.md",
    contents: sectionFile(
      { ...common, checkpoint: "source-baseline", revision: sourceAssessment.currentBaseline.revision, authority_boundary: EXPORT_AUTHORITY_BOUNDARY },
      "Source baseline",
      [
        `Baselines recorded: **${baselines.length}**. Current baseline: **revision ${sourceAssessment.currentBaseline.revision}**.`,
        "",
        markdownTable(["Field", "Value"], [
          ["Baseline state", sourceAssessment.currentBaseline.status],
          ["Exact members", `${sourceAssessment.currentBaseline.memberCount} Source revision(s)`],
          ["Membership digest", sourceAssessment.currentBaseline.membershipDigest],
        ]),
      ],
    ),
  })

  if (provenance.length > 0) files.push({
    path: "07_source-provenance/provenance.md",
    contents: sectionFile(
      { ...common, checkpoint: "source-provenance", records: provenance.length, authority_boundary: EXPORT_AUTHORITY_BOUNDARY },
      "Source provenance",
      [`Provenance records: **${provenance.length}**. Unprovenanced Sources: **${sourceAssessment.unprovenancedSourceCount}**.`],
    ),
  })

  const links = referenceLinksSection(options.referenceLinks)
  if (links.length > 0) files.push({
    path: "reference-links.md",
    contents: [
      frontmatter({ ...common, kind: "reference-links", authority_boundary: EXPORT_AUTHORITY_BOUNDARY }),
      ...links,
    ].join("\n"),
  })

  const canonicalGroupOrder: string[] = []
  for (const entry of phase1CanonicalRecordCatalog) {
    if (!canonicalGroupOrder.includes(entry.group)) canonicalGroupOrder.push(entry.group)
  }
  for (const entry of canonicalRecords) {
    const groupIndex = canonicalGroupOrder.indexOf(entry.group)
    const folder = `${String(8 + groupIndex).padStart(2, "0")}_${slug(entry.group)}`
    files.push({
      path: `${folder}/${slug(entry.label)}.md`,
      contents: sectionFile(
        { ...common, checkpoint: slug(entry.group), record: entry.kind, group: entry.group, revision: entry.revision, history: entry.history.length, authority_boundary: EXPORT_AUTHORITY_BOUNDARY },
        `${entry.group} — ${entry.label}`,
        [
          `Current revision: **${entry.revision}** · History: **${entry.history.length} revision(s)**`,
          "",
          phase1CanonicalPresentation({ kind: entry.kind, label: entry.label, draft: entry.record }),
        ],
      ),
    })
  }

  return files
}
