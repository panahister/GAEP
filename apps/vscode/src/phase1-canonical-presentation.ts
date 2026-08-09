import type { Phase1CanonicalRecordKind } from "./phase1-canonical-authoring.js"
import { markdownTable } from "./product-chat-source-intake.js"

interface Phase1CanonicalPresentationInput {
  kind: Phase1CanonicalRecordKind
  label: string
  draft: unknown
}

export function phase1CanonicalExactDraftPresentation(input: Phase1CanonicalPresentationInput): string {
  return [
    `# ${input.label} — exact candidate JSON`,
    "",
    "> Advanced audit view requested explicitly. This is the same uncommitted, contract-valid candidate held by the active conversation; viewing it does not accept or record anything.",
    "",
    "```json",
    JSON.stringify(input.draft, null, 2),
    "```",
  ].join("\n")
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
  const structured = record(value)
  if (structured) {
    for (const key of [
      "text", "question", "statement", "definition", "name", "title", "description", "objective",
      "purpose", "rationale", "term", "value", "key", "id",
    ]) {
      if (structured[key] !== undefined) {
        const candidate = text(structured[key], "")
        if (candidate) return candidate
      }
    }
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

function itemPreview(value: unknown): string {
  const structured = record(value)
  if (!structured) return compact(value)
  const identity = text(structured.name ?? structured.title ?? structured.term ?? structured.key ?? structured.id, "")
  const content = text(
    structured.text ?? structured.question ?? structured.statement ?? structured.definition ??
      structured.description ?? structured.objective ?? structured.rationale,
    "",
  )
  if (identity && content && identity !== content) return `${identity} — ${content}`
  return content || identity || compact(Object.keys(structured).map(label))
}

function arrayPreview(value: unknown[]): string {
  if (value.length === 0) return "None recorded"
  const shown = value.slice(0, 3).map((entry) => compact(itemPreview(entry), 180))
  return [...shown, ...(value.length > shown.length ? [`…and ${value.length - shown.length} more`] : [])].join("\n")
}

function structuredPreview(value: RecordValue): string {
  const direct = text(value, "")
  if (direct) return compact(direct)
  return Object.entries(value).slice(0, 6).map(([key, child]) => {
    const summary = Array.isArray(child) ? `${child.length} item${child.length === 1 ? "" : "s"}` : compact(child, 90)
    return `${label(key)}: ${summary}`
  }).join("\n") || "No candidate value recorded"
}

function overviewRows(draft: RecordValue): string[][] {
  return Object.entries(draft)
    .filter(([key]) => !bindingFields.has(key))
    .slice(0, 18)
    .map(([key, value]) => {
      if (Array.isArray(value)) return [label(key), `${value.length} item${value.length === 1 ? "" : "s"}`, arrayPreview(value)]
      const structured = record(value)
      if (structured) return [label(key), "Structured", structuredPreview(structured)]
      return [label(key), "Value", compact(value)]
    })
}

function exactSourceCount(value: unknown): number {
  const sources = record(value)?.sources
  return Array.isArray(sources) ? sources.length : 0
}

function disposition(value: unknown): string {
  const token = text(record(value)?.disposition, "unresolved")
  return label(token)
}

function bulletList(values: unknown, emptyMessage: string): string[] {
  if (!Array.isArray(values) || values.length === 0) return [`- ${emptyMessage}`]
  return values.map((value) => `- ${itemPreview(value)}`)
}

function attributedItems(values: unknown, noun: string): string[] {
  const items = records(values)
  if (items.length === 0) return [`- No ${noun.toLocaleLowerCase("en-US")} recorded.`]
  return items.map((item, index) => {
    const id = text(item.id ?? item.key, "")
    const evidenceCount = exactSourceCount(item)
    return [
      `${index + 1}. ${text(item)}`,
      `   _${disposition(item)} from ${evidenceCount} exact Source${evidenceCount === 1 ? "" : "s"}${id ? ` · ID: \`${id}\`` : ""}_`,
    ].join("\n")
  })
}

function businessUnderstandingPresentation(draft: RecordValue): string[] {
  const assumptions = records(draft.assumptions)
  const questions = records(draft.unresolvedQuestions)
  const blockingQuestions = questions.filter((question) => question.blocking === true).length
  const glossary = records(draft.glossary)
  const scope = record(draft.scope)
  const mainStatements: Array<[string, unknown]> = [
    ["Problem", draft.problem],
    ["Opportunity", draft.opportunity],
    ["Current state", draft.currentState],
    ["Target state", draft.targetState],
  ].filter(([, value]) => value !== undefined) as Array<[string, unknown]>
  return [
    "## Review summary",
    "",
    "> **Candidate only — awaiting human review.** Source-confirmed means supported by the candidate documents; it does not mean human approval.",
    "",
    markdownTable(["Review item", "Candidate state"], [
      ["Information handling", label(text(draft.informationClassification, "unresolved"))],
      ["Objectives", `${records(draft.objectives).length} proposed`],
      ["Constraints", `${records(draft.constraints).length} proposed`],
      ["Assumptions to confirm", `${assumptions.length}`],
      ["Open questions", `${questions.length} total · ${blockingQuestions} blocking`],
      ["Decision", "Review, correct if needed, then accept before commit"],
    ]),
    "",
    "## Business problem and intended change",
    "",
    markdownTable(["Aspect", "Candidate statement", "Evidence state"], mainStatements.map(([name, value]) => {
      const sourceCount = exactSourceCount(value)
      return [name, compact(value, 640), `${disposition(value)} · ${sourceCount} exact Source${sourceCount === 1 ? "" : "s"}`]
    })),
    "",
    "## Scope",
    "",
    "### Included",
    "",
    ...bulletList(scope?.included, "No included scope proposed."),
    "",
    "### Excluded",
    "",
    ...bulletList(scope?.excluded, "No exclusions proposed."),
    "",
    "### Boundaries",
    "",
    ...bulletList(scope?.boundaries, "No explicit boundaries proposed."),
    "",
    `## Objectives (${records(draft.objectives).length})`,
    "",
    ...attributedItems(draft.objectives, "Objectives"),
    "",
    `## Constraints (${records(draft.constraints).length})`,
    "",
    ...attributedItems(draft.constraints, "Constraints"),
    "",
    "## Items requiring human attention",
    "",
    `### Assumptions to confirm (${assumptions.length})`,
    "",
    ...(assumptions.length > 0 ? assumptions.map((assumption) => [
      `- **${label(text(assumption.id, "Assumption"))}:** ${text(assumption.statement)}`,
      `  - Status: ${label(text(assumption.status, "unverified"))}`,
      `  - Review trigger: ${text(assumption.reviewTrigger)}`,
    ].join("\n")) : ["- None recorded."]),
    "",
    `### Open questions (${questions.length})`,
    "",
    ...(questions.length > 0 ? questions.map((question) => [
      `- **${question.blocking === true ? "Blocking" : "Non-blocking"}:** ${text(question.question)}`,
      `  - Suggested owner: ${label(text(question.ownerRoleKey, "Unassigned"))}`,
      `  - Review trigger: ${text(question.reviewTrigger)}`,
    ].join("\n")) : ["- None recorded."]),
    "",
    `## Glossary (${glossary.length})`,
    "",
    ...(glossary.length > 0 ? [markdownTable(["Term", "Candidate definition", "Evidence state"], glossary.map((entry) => {
      const definition = entry.definition
      const sourceCount = exactSourceCount(definition)
      return [text(entry.term), compact(definition, 420), `${disposition(definition)} · ${sourceCount} exact Source${sourceCount === 1 ? "" : "s"}`]
    }))] : ["No glossary terms recorded."]),
    "",
    "## Known evidence limitations",
    "",
    ...bulletList(draft.limitations, "No limitations recorded."),
  ]
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

function capabilityMapPresentation(draft: RecordValue): string[] {
  const capabilities = records(draft.capabilities)
  if (capabilities.length === 0) return []
  const keyIndex = new Map(capabilities.map((capability, index) => [text(capability.key), index]))
  const diagram = ["```mermaid", "flowchart TD"]
  capabilities.slice(0, 40).forEach((capability, index) => {
    diagram.push(`  CAP${index}[\"${mermaidLabel(capability.name ?? capability.key, `Capability ${index + 1}`)}\"]`)
  })
  capabilities.slice(0, 40).forEach((capability, index) => {
    const dependencies = Array.isArray(capability.dependencyKeys) ? capability.dependencyKeys : []
    for (const dependency of dependencies) {
      const target = keyIndex.get(text(dependency))
      if (target !== undefined && target < 40 && target !== index) diagram.push(`  CAP${index} --> CAP${target}`)
    }
  })
  diagram.push("```")
  return [
    "## Business capabilities",
    "",
    markdownTable(
      ["Capability", "Category", "Placement", "Maturity", "Priority", "Objectives", "Outcomes", "Gaps"],
      capabilities.slice(0, 80).map((capability) => [
        text(capability.name ?? capability.key),
        text(capability.category),
        text(capability.placement),
        text(record(capability.maturity)?.level),
        text(record(capability.priority)?.tier ?? record(capability.priority)?.status),
        String(Array.isArray(capability.objectiveIds) ? capability.objectiveIds.length : 0),
        String(Array.isArray(capability.outcomeIds) ? capability.outcomeIds.length : 0),
        String(records(capability.gaps).length),
      ]),
    ),
    "",
    "## Capability dependency map",
    "",
    ...diagram,
  ]
}

function valueStreamPresentation(draft: RecordValue): string[] {
  const streams = records(draft.valueStreams)
  if (streams.length === 0) return []
  const sections: string[] = ["## Value streams", ""]
  streams.slice(0, 8).forEach((stream, streamIndex) => {
    const stages = records(stream.stages)
      .slice()
      .sort((left, right) => (Number(left.sequence) || 0) - (Number(right.sequence) || 0))
    sections.push(
      `### ${text(stream.name ?? stream.key)}`,
      "",
      `Beneficiaries: **${(Array.isArray(stream.beneficiaryStakeholderKeys) ? stream.beneficiaryStakeholderKeys.length : 0)}** · Objectives: **${(Array.isArray(stream.objectiveIds) ? stream.objectiveIds.length : 0)}** · Outcomes: **${(Array.isArray(stream.outcomeIds) ? stream.outcomeIds.length : 0)}** · Enabling capabilities: **${(Array.isArray(stream.capabilityKeys) ? stream.capabilityKeys.length : 0)}**`,
      "",
    )
    if (stages.length === 0) {
      sections.push("No stages recorded.", "")
      return
    }
    sections.push(
      markdownTable(["#", "Stage", "Entry criteria", "Exit criteria", "Capabilities"], stages.map((stage) => [
        text(stage.sequence),
        text(stage.name ?? stage.key),
        compact(stage.entryCriteria, 160),
        compact(stage.exitCriteria, 160),
        text(stage.capabilityKeys),
      ])),
      "",
    )
    const diagram = ["```mermaid", "flowchart LR"]
    stages.slice(0, 20).forEach((stage, stageIndex) => {
      diagram.push(`  VS${streamIndex}S${stageIndex}[\"${stageIndex + 1}. ${mermaidLabel(stage.name ?? stage.key, "Stage")}\"]`)
      if (stageIndex > 0) diagram.push(`  VS${streamIndex}S${stageIndex - 1} --> VS${streamIndex}S${stageIndex}`)
    })
    diagram.push("```")
    sections.push(...diagram, "")
  })
  return sections
}

function operatingModelPresentation(draft: RecordValue): string[] {
  const roles = records(draft.roles)
  const decisionRights = records(draft.decisionRights)
  const forums = records(draft.forums)
  const cycles = records(draft.cycles)
  if (roles.length === 0 && decisionRights.length === 0) return []
  const sections: string[] = []
  if (roles.length > 0) sections.push(
    "## Operating roles",
    "",
    markdownTable(["Role", "Governance system", "Capabilities", "Value streams"], roles.slice(0, 60).map((role) => [
      text(role.name ?? role.key),
      text(role.governanceSystem),
      text(role.capabilityKeys),
      text(role.valueStreamKeys),
    ])),
    "",
  )
  if (decisionRights.length > 0) sections.push(
    "## Decision rights (accountable / consulted)",
    "",
    markdownTable(["Decision subject", "Accountable role", "Consulted roles", "Value streams"], decisionRights.slice(0, 60).map((decision) => [
      compact(decision.subject ?? decision.name ?? decision.key, 160),
      text(decision.accountableRoleKey),
      text(decision.consultedRoleKeys),
      text(decision.valueStreamKeys),
    ])),
    "",
  )
  const roleStreamEdges: Array<[roleIndex: number, stream: string]> = []
  roles.slice(0, 30).forEach((role, index) => {
    for (const stream of (Array.isArray(role.valueStreamKeys) ? role.valueStreamKeys : [])) {
      roleStreamEdges.push([index, text(stream)])
    }
  })
  if (roleStreamEdges.length > 0) {
    const streamNodes = [...new Set(roleStreamEdges.map(([, stream]) => stream))]
    const streamIndex = new Map(streamNodes.map((stream, index) => [stream, index]))
    const diagram = ["```mermaid", "flowchart LR"]
    roles.slice(0, 30).forEach((role, index) => {
      diagram.push(`  R${index}[\"${mermaidLabel(role.name ?? role.key, `Role ${index + 1}`)}\"]`)
    })
    streamNodes.forEach((stream, index) => {
      diagram.push(`  S${index}([\"${mermaidLabel(stream, "Value stream")}\"])`)
    })
    for (const [roleIndex, stream] of roleStreamEdges) {
      diagram.push(`  R${roleIndex} --> S${streamIndex.get(stream) ?? 0}`)
    }
    diagram.push("```")
    sections.push("## Role and value-stream accountability map", "", ...diagram, "")
  }
  if (forums.length > 0) sections.push("## Governance forums", "", ...bulletList(forums, "None recorded."), "")
  if (cycles.length > 0) sections.push("## Operating cycles", "", ...bulletList(cycles, "None recorded."), "")
  return sections
}

function businessRuleCatalogPresentation(draft: RecordValue): string[] {
  const rules = records(draft.rules)
  const enforcementTargets = records(draft.enforcementTargets)
  const exceptions = records(draft.exceptions)
  if (rules.length === 0) return []
  const capabilityNodes = [...new Set(rules.flatMap((rule) =>
    (Array.isArray(rule.capabilityKeys) ? rule.capabilityKeys : []).map((entry) => text(entry))))]
  const capabilityIndex = new Map(capabilityNodes.map((capability, index) => [capability, index]))
  const diagram = ["```mermaid", "flowchart LR"]
  rules.slice(0, 30).forEach((rule, index) => {
    diagram.push(`  RULE${index}[\"${mermaidLabel(rule.name ?? rule.key, `Rule ${index + 1}`)}\"]`)
  })
  capabilityNodes.slice(0, 40).forEach((capability, index) => {
    diagram.push(`  RCAP${index}([\"${mermaidLabel(capability, "Capability")}\"])`)
  })
  rules.slice(0, 30).forEach((rule, index) => {
    for (const capability of (Array.isArray(rule.capabilityKeys) ? rule.capabilityKeys : [])) {
      const target = capabilityIndex.get(text(capability))
      if (target !== undefined && target < 40) diagram.push(`  RULE${index} --> RCAP${target}`)
    }
  })
  diagram.push("```")
  const sections = [
    "## Business rules",
    "",
    markdownTable(["Rule", "Kind", "Statement", "Owner", "Capabilities", "Value streams"], rules.slice(0, 80).map((rule) => [
      text(rule.name ?? rule.key),
      text(rule.kind),
      compact(rule.statement, 200),
      text(rule.ownerRoleKey),
      text(rule.capabilityKeys),
      text(rule.valueStreamKeys),
    ])),
    "",
    `Enforcement targets: **${enforcementTargets.length}** · Exceptions: **${exceptions.length}**.`,
    "",
    "## Rule to capability traceability",
    "",
    ...diagram,
  ]
  return sections
}

function businessArchitectureBaselinePresentation(draft: RecordValue): string[] {
  const coverage = records(draft.coverage)
  const integrationClaims = records(draft.integrationClaims)
  const consistencyChecks = records(draft.consistencyChecks)
  if (coverage.length === 0 && consistencyChecks.length === 0) return []
  const scope = record(draft.scope)
  const dispositionCounts = new Map<string, number>()
  const elementKindCounts = new Map<string, number>()
  for (const entry of coverage) {
    const disposition = text(entry.disposition, "unassessed")
    dispositionCounts.set(disposition, (dispositionCounts.get(disposition) ?? 0) + 1)
    const kind = text(entry.elementKind, "element")
    elementKindCounts.set(kind, (elementKindCounts.get(kind) ?? 0) + 1)
  }
  const compositionDiagram = ["```mermaid", "flowchart TD", "  B[\"Business Architecture Baseline\"]"]
  ;[...elementKindCounts.entries()].sort(([left], [right]) => left.localeCompare(right)).forEach(([kind, count], index) => {
    compositionDiagram.push(`  B --> EK${index}[\"${mermaidLabel(kind, "elements")}: ${count}\"]`)
  })
  compositionDiagram.push("```")
  return [
    "## Baseline scope",
    "",
    "### Included",
    "",
    ...bulletList(scope?.included, "No inclusions recorded."),
    "",
    "### Excluded",
    "",
    ...bulletList(scope?.excluded, "No exclusions recorded."),
    "",
    "## Coverage summary",
    "",
    markdownTable(["Disposition", "Elements"], [...dispositionCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([disposition, count]) => [label(disposition), String(count)])),
    "",
    "## Composition",
    "",
    ...compositionDiagram,
    "",
    "## Consistency checks",
    "",
    markdownTable(["Topic", "State", "Accountable role"], consistencyChecks.map((check) => [
      text(check.topic),
      text(check.state),
      text(check.accountableRoleKey),
    ])),
    "",
    `## Integration claims (${integrationClaims.length})`,
    "",
    ...(integrationClaims.length > 0
      ? integrationClaims.slice(0, 40).map((claim) => `- ${compact(claim.statement, 240)}`)
      : ["- None recorded."]),
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
    "  E --> G{\"P0–P4 readiness assessment\"}",
  ]
  ;[...stateCounts.entries()].sort(([left], [right]) => left.localeCompare(right)).forEach(([state], index) => {
    diagram.push(`  G --> S${index}[\"${mermaidLabel(state, "state")}: ${stateCounts.get(state) ?? 0}\"]`)
  })
  diagram.push("  G -. human review required .-> H[\"P0–P4 handoff candidate\"]", "```")
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
    "  J[\"Reviewed Product Journey\"] --> R[\"P0–P4 readiness assessment\"]",
    "  R --> P[\"P0–P4 handoff package\"]",
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
    "## P0–P4 transfer boundary",
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
    case "business-understanding": return businessUnderstandingPresentation(draft)
    case "business-capability-map": return capabilityMapPresentation(draft)
    case "value-stream-model": return valueStreamPresentation(draft)
    case "operating-model": return operatingModelPresentation(draft)
    case "business-rule-catalog": return businessRuleCatalogPresentation(draft)
    case "business-architecture-baseline": return businessArchitectureBaselinePresentation(draft)
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
  const purpose = compact(draft.purpose ?? draft.problem ?? draft.targetState ?? draft.scope, 600)
  const specialized = specializedSections(input.kind, draft)
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
    "> The exact contract-valid candidate remains sealed in this active conversation and will be revalidated before commit. Internal JSON, Source UUIDs, and digests are intentionally omitted from the primary human review.",
  ].join("\n")
}
