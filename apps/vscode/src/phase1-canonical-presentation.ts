import type { Phase1CanonicalRecordKind } from "./phase1-canonical-authoring.js"
import { markdownTable } from "./product-chat-source-intake.js"

interface Phase1CanonicalPresentationInput {
  kind: Phase1CanonicalRecordKind
  label: string
  draft: unknown
}

interface RecordValue {
  [key: string]: unknown
}

const bindingFields = new Set([
  "initiativeId", "context", "informationClassification", "sources", "sourceReferences",
  "requirementCoverage",
])

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : undefined
}

function records(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(record).filter((entry): entry is RecordValue => Boolean(entry)) : []
}

function text(value: unknown, fallback = "Not specified"): string {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    const values = value.map((entry) => text(entry, "")).filter(Boolean)
    return values.length > 0 ? values.join(", ") : fallback
  }
  return fallback
}

function compact(value: unknown, maximum = 180): string {
  const normalized = text(value).replace(/\s+/gu, " ")
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum - 1)}…`
}

function label(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/[-_]/gu, " ")
    .replace(/^./u, (first) => first.toUpperCase())
}

function overviewRows(draft: RecordValue): string[][] {
  return Object.entries(draft)
    .filter(([key]) => !bindingFields.has(key))
    .slice(0, 18)
    .map(([key, value]) => {
      if (Array.isArray(value)) return [label(key), `${value.length} item${value.length === 1 ? "" : "s"}`, compact(value.slice(0, 3))]
      if (record(value)) return [label(key), "Structured", compact(Object.keys(value as object).map(label).slice(0, 8))]
      return [label(key), "Value", compact(value)]
    })
}

function mermaidLabel(value: unknown, fallback: string): string {
  return compact(value, 80)
    .replace(/["`{}<>]/gu, "")
    .replace(/[\r\n|]/gu, " ") || fallback
}

function processPresentation(draft: RecordValue): string[] {
  const processes = records(draft.processes)
  if (processes.length === 0) return []
  const rows = processes.slice(0, 16).map((process) => {
    const transitions = records(process.transitions)
    const events = records(process.events)
    const actors = new Set([
      text(process.ownerRoleKey, ""),
      ...((Array.isArray(process.participantRoleKeys) ? process.participantRoleKeys : []).map((entry) => text(entry, ""))),
      ...transitions.flatMap((transition) =>
        (Array.isArray(transition.actorRoleKeys) ? transition.actorRoleKeys : []).map((entry) => text(entry, ""))),
    ].filter(Boolean))
    const guards = transitions.flatMap((transition) =>
      (Array.isArray(transition.guardCriteria) ? transition.guardCriteria : []).map((entry) => text(entry, "")))
    return [
      text(process.name ?? process.key),
      transitions.map((transition) => compact(transition.trigger, 90)).join("<br>") || "Not specified",
      [...actors].join(", ") || "Not specified",
      events.map((event) => text(event.subject ?? event.key)).join("<br>") || "Not specified",
      text(process.boundedContextKeys),
      [...guards, ...(Array.isArray(process.inconsistencies) ? process.inconsistencies : []),
        ...(Array.isArray(process.unresolvedQuestions) ? process.unresolvedQuestions : [])]
        .slice(0, 5).map((entry) => compact(entry, 90)).join("<br>") || "None recorded",
    ]
  })
  const diagram: string[] = ["```mermaid", "flowchart LR"]
  processes.slice(0, 6).forEach((process, processIndex) => {
    const steps = records(process.steps).slice(0, 12)
    const events = records(process.events).slice(0, 12)
    diagram.push(`  subgraph P${processIndex}[\"${mermaidLabel(process.name ?? process.key, `Process ${processIndex + 1}`)}\"]`)
    steps.forEach((step, stepIndex) => {
      diagram.push(`    P${processIndex}S${stepIndex}[\"${stepIndex + 1}. ${mermaidLabel(step.objective ?? step.key, "Step")}\"]`)
      if (stepIndex > 0) diagram.push(`    P${processIndex}S${stepIndex - 1} --> P${processIndex}S${stepIndex}`)
    })
    events.forEach((event, eventIndex) => {
      diagram.push(`    P${processIndex}E${eventIndex}([\"Event: ${mermaidLabel(event.subject ?? event.key, "Domain event")}\"])`)
      const transitionKeys = Array.isArray(event.transitionKeys) ? event.transitionKeys : []
      const producerStep = steps.findIndex((step) => {
        const stepTransitions = Array.isArray(step.transitionKeys) ? step.transitionKeys : []
        return stepTransitions.some((key) => transitionKeys.includes(key))
      })
      if (producerStep >= 0) diagram.push(`    P${processIndex}S${producerStep} -.-> P${processIndex}E${eventIndex}`)
    })
    diagram.push("  end")
  })
  diagram.push("```")
  return [
    "## Event Storming board",
    "",
    markdownTable(["Process", "Commands / triggers", "Actors", "Domain events", "Bounded contexts", "Policies / hotspots"], rows),
    "",
    "## Process and event flow",
    "",
    ...diagram,
  ]
}

function architecturePresentation(draft: RecordValue): string[] {
  const elements = records(draft.elements)
  const relations = records(draft.relations)
  if (elements.length === 0) return []
  const keyIndex = new Map(elements.map((element, index) => [text(element.key), index]))
  const diagram = ["```mermaid", "flowchart LR"]
  elements.slice(0, 30).forEach((element, index) => {
    diagram.push(`  A${index}[\"${mermaidLabel(element.name ?? element.key, `Element ${index + 1}`)}\"]`)
  })
  relations.slice(0, 60).forEach((relation) => {
    const from = keyIndex.get(text(relation.fromElementKey))
    const to = keyIndex.get(text(relation.toElementKey))
    if (from !== undefined && to !== undefined && from < 30 && to < 30) {
      diagram.push(`  A${from} -->|\"${mermaidLabel(relation.kind ?? relation.interactionStyle, "uses")}\"| A${to}`)
    }
  })
  diagram.push("```")
  return [
    "## Architecture elements",
    "",
    markdownTable(["Element", "Kind", "Owner", "Responsibility", "Technology"], elements.slice(0, 30).map((element) => [
      text(element.name ?? element.key), text(element.kind), text(element.ownerRoleKey), compact(element.responsibility),
      compact(record(element.technology)?.value ?? record(element.technology)?.disposition),
    ])),
    "",
    "## Architecture relationship view",
    "",
    ...diagram,
  ]
}

function boundedContextPresentation(draft: RecordValue): string[] {
  const contexts = records(draft.boundedContexts)
  const relationships = records(draft.relationships)
  if (contexts.length === 0) return []
  const keyIndex = new Map(contexts.map((context, index) => [text(context.key), index]))
  const diagram = ["```mermaid", "flowchart LR"]
  contexts.slice(0, 30).forEach((context, index) => {
    diagram.push(`  C${index}[\"${mermaidLabel(context.name ?? context.key, `Context ${index + 1}`)}\"]`)
  })
  relationships.slice(0, 60).forEach((relationship) => {
    const upstream = keyIndex.get(text(relationship.upstreamContextKey))
    const downstream = keyIndex.get(text(relationship.downstreamContextKey))
    if (upstream !== undefined && downstream !== undefined && upstream < 30 && downstream < 30) {
      diagram.push(`  C${upstream} -->|\"${mermaidLabel(relationship.pattern, "contract")}\"| C${downstream}`)
    }
  })
  diagram.push("```")
  return [
    "## Bounded contexts and ownership",
    "",
    markdownTable(["Context", "Owner", "Responsibilities", "Data assets", "Invariants"], contexts.slice(0, 30).map((context) => [
      text(context.name ?? context.key), text(context.ownerRoleKey), compact(context.responsibilities),
      compact(context.dataAssetElementKeys), compact(context.invariants),
    ])),
    "",
    "## Context map",
    "",
    ...diagram,
  ]
}

function eventIntegrationPresentation(draft: RecordValue): string[] {
  const events = records(draft.eventTypes)
  const commands = records(draft.commands)
  if (events.length === 0 && commands.length === 0) return []
  return [
    "## Events and commands",
    "",
    markdownTable(["Type", "Name", "Owner / actor", "Bounded context", "State"], [
      ...events.slice(0, 30).map((event) => ["Event", text(event.name ?? event.key), text(event.producerRoleKeys),
        text(event.producerBoundedContextKey), text(event.occurrenceState)]),
      ...commands.slice(0, 30).map((command) => ["Command", text(command.name ?? command.key), text(command.actorRoleKeys),
        text(command.targetBoundedContextKeys), text(command.executionState)]),
    ]),
  ]
}

function readinessPresentation(draft: RecordValue): string[] {
  const outputs = records(draft.outputs)
  if (outputs.length === 0) return []
  const stateCounts = new Map<string, number>()
  for (const output of outputs) {
    const state = text(output.evaluationState, "not-assessed")
    stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1)
  }
  const diagram = [
    "```mermaid",
    "flowchart LR",
    "  R[\"Governed P0-P4 records\"] --> E[\"Evidence and traceability review\"]",
    "  E --> G{\"Pre-Figma readiness assessment\"}",
  ]
  ;[...stateCounts.entries()].sort(([left], [right]) => left.localeCompare(right)).forEach(([state], index) => {
    diagram.push(`  G --> S${index}[\"${mermaidLabel(state, "state")}: ${stateCounts.get(state) ?? 0}\"]`)
  })
  diagram.push("  G -. human review required .-> H[\"Pre-Figma handoff candidate\"]", "```")
  return [
    "## Readiness output assessment",
    "",
    markdownTable(["Output", "Applicability", "Assessment", "Freshness", "Evidence", "Blockers / conditions"], outputs.map((output) => [
      text(output.outputKind),
      text(output.applicability),
      text(output.evaluationState),
      text(output.freshness),
      `${records(output.subjects).length} exact record(s); ${Array.isArray(output.evidenceItemKeys) ? output.evidenceItemKeys.length : 0} evidence item(s)`,
      compact([...(Array.isArray(output.blockers) ? output.blockers : []), ...(Array.isArray(output.conditions) ? output.conditions : [])]),
    ])),
    "",
    "## Readiness dependency view",
    "",
    ...diagram,
    "",
    `Open decisions: **${records(draft.unresolvedDecisions).length}** · Conditions: **${records(draft.conditions).length}** · Waivers: **${records(draft.waivers).length}**.`,
  ]
}

function handoffPresentation(draft: RecordValue): string[] {
  const items = records(draft.items)
  if (items.length === 0) return []
  const diagram = [
    "```mermaid",
    "flowchart LR",
    "  J[\"Reviewed Product Journey\"] --> R[\"Pre-Figma readiness assessment\"]",
    "  R --> P[\"Pre-Figma handoff package\"]",
    "  P --> Q[\"Human review of questions and constraints\"]",
    "  Q -. future scope .-> F[\"Figma MCP roundtrip\"]",
    "  F -. excluded from this package .-> B[\"Implementation backlog\"]",
    "```",
  ]
  return [
    "## Handoff inventory",
    "",
    markdownTable(["Output", "Disposition", "Representation", "Freshness", "Consumer purpose", "Omissions / uncertainty"], items.map((item) => [
      text(item.outputKind),
      text(item.disposition),
      text(item.representation),
      text(item.freshness),
      compact(item.consumerPurpose),
      compact([...(Array.isArray(item.materialOmissions) ? item.materialOmissions : []), ...(Array.isArray(item.uncertainties) ? item.uncertainties : [])]),
    ])),
    "",
    "## Pre-Figma transfer boundary",
    "",
    ...diagram,
    "",
    markdownTable(["Control", "Candidate state"], [
      ["Readiness result", text(draft.readinessResult)],
      ["Transfer state", text(draft.transferState)],
      ["Target delivery mode", text(record(draft.target)?.deliveryMode)],
      ["Unresolved questions", text(draft.unresolvedQuestions, "None recorded")],
      ["Conflicts", text(draft.conflicts, "None recorded")],
      ["Next actions", text(draft.nextActions)],
    ]),
  ]
}

function specializedSections(kind: Phase1CanonicalRecordKind, draft: RecordValue): string[] {
  switch (kind) {
    case "process-model": return processPresentation(draft)
    case "system-solution-architecture": return architecturePresentation(draft)
    case "bounded-context-model": return boundedContextPresentation(draft)
    case "event-integration-model": return eventIntegrationPresentation(draft)
    case "p0-p4-readiness-gate": return readinessPresentation(draft)
    case "p5-handoff-package": return handoffPresentation(draft)
    default: return []
  }
}

export function phase1CanonicalPresentation(input: Phase1CanonicalPresentationInput): string {
  const draft = record(input.draft)
  if (!draft) return "The advisor did not return a structured candidate record."
  const title = compact(draft.title ?? input.label, 240)
  const purpose = compact(draft.purpose ?? draft.scope ?? draft.problem ?? draft.targetState, 600)
  const specialized = specializedSections(input.kind, draft)
  const exactDraft = JSON.stringify(input.draft, null, 2)
  return [
    `## ${title}`,
    "",
    purpose,
    "",
    ...(specialized.length > 0 ? specialized : [
      "## Candidate content overview",
      "",
      markdownTable(["Field", "Shape", "Candidate value"], overviewRows(draft)),
    ]),
    "",
    "<details>",
    "<summary>Advanced: inspect the exact governed record</summary>",
    "",
    "```json",
    exactDraft,
    "```",
    "",
    "</details>",
  ].join("\n")
}
