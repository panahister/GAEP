import { basename, relative, sep } from "node:path"

import type {
  InitiativeApplicabilityMatrixInput,
  InitiativeApplicabilitySubject,
  InitiativeClassificationInput,
} from "@gaep/contracts"
import type { InitiativeInput, ProductInput } from "@gaep/engine"
import * as vscode from "vscode"

import {
  acceptInitiativeApplicability,
  answerInitiativeApplicability,
  assessInitiativeApplicabilityWithAutomaticRepair,
  backInitiativeApplicability,
  changeInitiativeApplicabilityAdvisor,
  initiativeApplicabilityInput,
  initiativeApplicabilityLifecycleAiCorrections,
  initiativeApplicabilityQuestion,
  isInitiativeApplicabilityChatState,
  standardInitiativeApplicabilityRoleCoverage,
  startInitiativeApplicabilityChat,
  suggestedInitiativeApplicabilityBrief,
  suggestedUnresolvedApplicabilityClarification,
  type InitiativeApplicabilityChatState,
} from "./interactive-initiative-applicability-chat.js"
import {
  acceptProductAnswer,
  answerProductInitialization,
  changeProductChatAdvisor,
  currentProductInitializationQuestion,
  editProductField,
  editProductRevisionField,
  gaepChatParticipantId,
  goBackProductInitialization,
  isProductInitializationChatState,
  preferredProductChatAdvisor,
  productProfiles,
  productInitializationInput,
  productInitializationProgress,
  recordProductAnswerAssessment,
  recordProductAnswerAssessmentWithAutomaticRepair,
  startProductInitialization,
  startProductInitializationReview,
  startProductRevision,
  selectProductChatAdvisorForCommand,
  type ProductAnswerAssessment,
  type ProductChatAdvisorSelection,
  type ProductInitializationChatState,
  type ProductInitializationInput,
} from "./interactive-product-chat.js"
import {
  existingProductJourneyCheckpointIds,
  journeyCheckpointLabels,
  parseExistingProductJourneyCoverage,
  type ExistingProductJourneyCoverage,
} from "./existing-product-journey-coverage.js"
import {
  productChatConversationOutlineHtml,
  type ProductChatConversationTurn,
} from "./product-chat-conversation-outline.js"
import { createRecordingChatResponseStream } from "./recording-chat-response-stream.js"
import {
  acceptInitiativeAnswer,
  answerInitiative,
  assessInitiativeAnswer,
  assessInitiativeAnswerWithAutomaticRepair,
  backInitiative,
  changeInitiativeAdvisor,
  currentInitiativeQuestion,
  editInitiativeField,
  initiativeAdvisorAcceptedAnswers,
  initiativeInput,
  initiativeProgress,
  isInitiativeChatState,
  startInitiativeChat,
  startInitiativeRevision,
  type InitiativeAnswerKey,
  type InitiativeChatState,
} from "./interactive-initiative-chat.js"
import {
  acceptInitiativeClassification,
  answerInitiativeClassification,
  assessInitiativeClassificationWithAutomaticRepair,
  backInitiativeClassification,
  changeInitiativeClassificationAdvisor,
  initiativeClassificationInput,
  initiativeClassificationQuestion,
  isInitiativeClassificationChatState,
  startInitiativeClassificationChat,
  suggestedInitiativeClassificationResolution,
  type InitiativeClassificationChatState,
} from "./interactive-initiative-classification-chat.js"
import {
  attachmentAlignmentInput,
  discoverProductChatAttachmentResources,
  portableAttachmentMetadata,
  readProductChatAttachments,
  type ProductChatAttachmentBatch,
  type ProductChatAttachmentNode,
  type ProductChatAttachmentResource,
} from "./product-chat-attachments.js"
import {
  isImplicitChatInstructionReference,
  markdownTable,
  sourceAdvisorFailureMarkdown,
  sourceAlignmentNextCheckpoint,
  sourceAlignmentTableRows,
  sourceIntakeManifestSummary,
  sourceReviewCacheKey,
  sourceUnderstandingInstruction,
} from "./product-chat-source-intake.js"
import type { CandidateSourceAttachment } from "./product-chat-source-recording.js"
import { phase1CanonicalRecordKinds, type Phase1CanonicalRecordKind } from "./phase1-canonical-authoring.js"
import { phase1CanonicalPresentation } from "./phase1-canonical-presentation.js"
import {
  canSafelyRebindInitiativeClassification,
  initiativeApplicabilityAttentionItems,
  initiativeClassificationAttentionItems,
  latestInitiativeResolutionState,
} from "./initiative-resolution-workflow.js"

export type GovernedProductState =
  | { state: "uninitialized" }
  | { state: "partial" }
  | { state: "initialized"; name: string; revision: number; input: ProductInput }

export interface GaepProductChatOptions {
  productState(): Promise<GovernedProductState>
  commitProduct(input: ProductInput): Promise<{ name: string }>
  reviseProduct(input: ProductInput, expectedRevision: number): Promise<{ name: string; revision: number }>
  selectRevisionField(): Promise<keyof ProductInitializationChatState["answers"] | undefined>
  currentInitiative(): Promise<{
    id: string
    title: string
    outcome: string
    scope: string[]
    exclusions: string[]
    state: string
    revision: number
    classificationStatus: "missing" | "stale" | "current"
    applicabilityStatus: "missing" | "stale" | "current"
    classification?: InitiativeClassificationInput
    applicabilityCatalog?: {
      catalogVersion: "gaep-initiative-applicability-subjects-v1"
      digest: string
      subjects: InitiativeApplicabilitySubject[]
    }
    applicability?: InitiativeApplicabilityMatrixInput
    priorApplicability?: InitiativeApplicabilityMatrixInput
  } | undefined>
  commitInitiative(input: InitiativeInput): Promise<{ title: string; state: string; revision: number }>
  reviseInitiative(
    initiativeId: string,
    input: InitiativeInput,
    expectedRevision: number,
  ): Promise<{ title: string; state: string; revision: number }>
  selectInitiativeRevisionField(): Promise<InitiativeAnswerKey | undefined>
  commitInitiativeClassification(
    initiativeId: string,
    input: InitiativeClassificationInput,
    expectedRevision: number,
  ): Promise<{ title: string; revision: number; primaryType: string; entryState: string }>
  commitInitiativeApplicability(
    initiativeId: string,
    input: InitiativeApplicabilityMatrixInput,
    expectedRevision: number,
  ): Promise<{
    title: string
    revision: number
    decisionCount: number
    unresolvedSubjectCount: number
    entryState: string
  }>
  recordCandidateSources(input: {
    initiativeId: string
    sources: CandidateSourceAttachment[]
  }): Promise<{
    recorded: Array<{ id: string; title: string; contentDigest: string }>
    reused: Array<{ id: string; title: string; contentDigest: string }>
  }>
  sourceCheckpoint(initiativeId: string): Promise<{
    sourceCount: number
    sourceTitles: string[]
    baseline?: { id: string; revision: number; memberCount: number; membershipDigest: string; status: "current" | "stale" | "incomplete" }
    provenanceCount: number
  }>
  createCandidateSourceBaseline(initiativeId: string): Promise<{
    id: string
    revision: number
    memberCount: number
    membershipDigest: string
    reused: boolean
  }>
  recordInitiativeSourceProvenance(initiativeId: string): Promise<{
    id: string
    sourceCount: number
    targetRevision: number
    reused: boolean
  }>
  phase1Checkpoint(initiativeId: string): Promise<{
    groups: Array<{
      id: "product-discovery" | "business-architecture" | "solution-security-architecture" |
        "detailed-design-assurance" | "p0-p4-readiness"
      label: string
      recorded: number
      total: number
      complete: boolean
      route: "direction" | "architecture" | "risks-decisions" | "readiness"
    }>
  }>
  nextPhase1AuthoringTarget(initiativeId: string, requestedKind?: Phase1CanonicalRecordKind): Promise<{
    kind: Phase1CanonicalRecordKind
    label: string
    group: string
    ordinal: number
    total: number
    schema: object
    context: object
    operation: "create" | "revise"
    current?: { id: string; revision: number; record: unknown; history: Array<{ revision: number; recordedAt?: string; recordedBy?: string }> }
    downstream: Array<{ kind: Phase1CanonicalRecordKind; label: string; recorded: boolean }>
  } | undefined>
  validatePhase1CanonicalDraft(kind: Phase1CanonicalRecordKind, value: unknown): Promise<{
    valid: boolean
    value?: unknown
    errors: string[]
  }>
  commitPhase1CanonicalDraft(kind: Phase1CanonicalRecordKind, value: unknown, current?: { id: string; expectedRevision: number }): Promise<{
    id: string
    revision: number
    kind: Phase1CanonicalRecordKind
    label: string
    operation: "created" | "revised"
  }>
  journeyMode?(): Promise<{ mode: "quick" | "guided" | "assured"; source: "recommended" | "selected" }>
  selectJourneyMode?(): Promise<{ mode: "quick" | "guided" | "assured"; source: "selected" } | undefined>
  currentAdvisor(): ProductChatAdvisorSelection | undefined
  selectAdvisor(current?: ProductChatAdvisorSelection): Promise<ProductChatAdvisorSelection | undefined>
  selectAgent(current?: ProductChatAdvisorSelection): Promise<ProductChatAdvisorSelection | undefined>
  selectModel(current: ProductChatAdvisorSelection): Promise<ProductChatAdvisorSelection | undefined>
  takeChosenFiles(): vscode.Uri[]
  challengeAnswer(input: {
    advisor: ProductChatAdvisorSelection
    question: { key: string; title: string; prompt: string }
    acceptedAnswers: object
    userAnswer: string
    previousAssessment?: { proposedAnswer: string; gaps: string[]; followUpQuestion?: string }
  }, signal: AbortSignal): Promise<ProductAnswerAssessment>
  reportDiagnostic?(message: string, error: unknown): void
}

interface SourceAlignmentChatState {
  schemaVersion: 1
  phase: "proposal" | "accepted" | "cancelled"
  productRevision: number
  initiative: { id: string; revision: number; title: string }
  advisor: ProductChatAdvisorSelection
  sources: Array<{
    label: string
    format: string
    extraction?: "utf8-text" | "docx-ooxml" | "xlsx-ooxml"
    byteLength: number
    contentDigest: `sha256:${string}`
    limitations?: string[]
  }>
  rejected: ProductChatAttachmentBatch["rejected"]
  assessment: ProductAnswerAssessment
  round: number
  purpose?: "understanding" | "alignment"
  cacheKey?: string
  task?: string
  authorityBoundary: "source-alignment-preview-is-advisory-and-does-not-create-sources-baselines-provenance-or-lifecycle-authority"
}

function isSourceAlignmentChatState(value: unknown): value is SourceAlignmentChatState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Partial<SourceAlignmentChatState>
  return candidate.schemaVersion === 1 && ["proposal", "accepted", "cancelled"].includes(String(candidate.phase)) &&
    typeof candidate.productRevision === "number" && candidate.productRevision > 0 &&
    Boolean(candidate.initiative && typeof candidate.initiative.id === "string" &&
      typeof candidate.initiative.revision === "number" && typeof candidate.initiative.title === "string") &&
    Boolean(candidate.advisor) && Array.isArray(candidate.sources) && Array.isArray(candidate.rejected) &&
    Boolean(candidate.assessment) && typeof candidate.round === "number" && candidate.round > 0 &&
    candidate.authorityBoundary === "source-alignment-preview-is-advisory-and-does-not-create-sources-baselines-provenance-or-lifecycle-authority"
}

function sourceAlignmentMetadata(state: SourceAlignmentChatState): vscode.ChatResult {
  return { metadata: { gaepSourceAlignment: state } }
}

function latestSourceAlignmentState(context: vscode.ChatContext): SourceAlignmentChatState | undefined {
  for (const turn of [...context.history].reverse()) {
    if (!("result" in turn)) continue
    const candidate = turn.result.metadata?.gaepSourceAlignment
    if (isSourceAlignmentChatState(candidate)) return candidate
  }
  return undefined
}

function metadata(state: ProductInitializationChatState): vscode.ChatResult {
  return { metadata: { gaepProductInitialization: state } }
}

function latestState(context: vscode.ChatContext): ProductInitializationChatState | undefined {
  for (const turn of [...context.history].reverse()) {
    if (!("result" in turn)) continue
    const candidate = turn.result.metadata?.gaepProductInitialization
    if (isProductInitializationChatState(candidate)) return candidate
  }
  return undefined
}

function initiativeMetadata(state: InitiativeChatState): vscode.ChatResult {
  return { metadata: { gaepInitiative: state } }
}

function latestInitiativeState(context: vscode.ChatContext): InitiativeChatState | undefined {
  for (const turn of [...context.history].reverse()) {
    if (!("result" in turn)) continue
    const candidate = turn.result.metadata?.gaepInitiative
    if (isInitiativeChatState(candidate)) return candidate
  }
  return undefined
}

function classificationMetadata(state: InitiativeClassificationChatState): vscode.ChatResult {
  return { metadata: { gaepInitiativeClassification: state } }
}

function applicabilityMetadata(state: InitiativeApplicabilityChatState): vscode.ChatResult {
  return { metadata: { gaepInitiativeApplicability: state } }
}

function latestResolutionState(context: vscode.ChatContext):
InitiativeClassificationChatState | InitiativeApplicabilityChatState | undefined {
  const states: Array<InitiativeClassificationChatState | InitiativeApplicabilityChatState | undefined> = []
  for (const turn of context.history) {
    if (!("result" in turn)) continue
    const classification = turn.result.metadata?.gaepInitiativeClassification
    const applicability = turn.result.metadata?.gaepInitiativeApplicability
    if (isInitiativeClassificationChatState(classification)) states.push(classification)
    if (isInitiativeApplicabilityChatState(applicability)) states.push(applicability)
  }
  return latestInitiativeResolutionState(states)
}

interface Phase1CanonicalAuthoringState {
  schemaVersion: 1
  phase: "proposal" | "review" | "committed" | "cancelled"
  initiativeId: string
  target: {
    kind: Phase1CanonicalRecordKind
    label: string
    group: string
    ordinal: number
    total: number
    operation: "create" | "revise"
    current?: { id: string; revision: number; historyCount: number }
    downstreamRecorded: Array<{ kind: Phase1CanonicalRecordKind; label: string }>
  }
  advisor: ProductChatAdvisorSelection
  assessment: ProductAnswerAssessment
  draft: unknown
  round: number
  authorityBoundary: "phase1-authoring-draft-is-advisory-until-explicit-review-and-commit"
}

function isPhase1CanonicalAuthoringState(value: unknown): value is Phase1CanonicalAuthoringState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Partial<Phase1CanonicalAuthoringState>
  return candidate.schemaVersion === 1 && ["proposal", "review", "committed", "cancelled"].includes(String(candidate.phase)) &&
    typeof candidate.initiativeId === "string" && Boolean(candidate.target) && Boolean(candidate.advisor) &&
    Boolean(candidate.assessment) && candidate.draft !== undefined && typeof candidate.round === "number" &&
    candidate.authorityBoundary === "phase1-authoring-draft-is-advisory-until-explicit-review-and-commit"
}

function phase1AuthoringMetadata(state: Phase1CanonicalAuthoringState): vscode.ChatResult {
  return { metadata: { gaepPhase1CanonicalAuthoring: state } }
}

function latestPhase1AuthoringState(context: vscode.ChatContext): Phase1CanonicalAuthoringState | undefined {
  for (const turn of [...context.history].reverse()) {
    if (!("result" in turn)) continue
    const candidate = turn.result.metadata?.gaepPhase1CanonicalAuthoring
    if (isPhase1CanonicalAuthoringState(candidate)) return candidate
  }
  return undefined
}

function parseStructuredDraft(value: string): unknown {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1]
  const candidate = (fenced ?? value).trim()
  const first = candidate.indexOf("{")
  const last = candidate.lastIndexOf("}")
  if (first < 0 || last <= first) throw new Error("The advisor did not return a JSON object for the canonical record")
  return JSON.parse(candidate.slice(first, last + 1))
}

function existingProductInitializationInput(value: unknown): ProductInitializationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The advisor did not return a Product input object")
  }
  const candidate = value as Record<string, unknown>
  const exactKeys = [
    "name", "summary", "problem", "affectedUsers", "desiredOutcome", "successSignals",
    "firstWorkflow", "exclusions", "profile",
  ]
  const keys = Object.keys(candidate)
  if (keys.length !== exactKeys.length || keys.some((key) => !exactKeys.includes(key))) {
    throw new Error(`The Product proposal must contain exactly: ${exactKeys.join(", ")}`)
  }
  const textKeys = ["name", "summary", "problem", "affectedUsers", "desiredOutcome", "firstWorkflow"] as const
  for (const key of textKeys) {
    if (typeof candidate[key] !== "string") throw new Error(`${key} must be a string`)
  }
  if (!Array.isArray(candidate.successSignals) || !candidate.successSignals.every((item) => typeof item === "string")) {
    throw new Error("successSignals must be a string array")
  }
  if (!Array.isArray(candidate.exclusions) || !candidate.exclusions.every((item) => typeof item === "string")) {
    throw new Error("exclusions must be a string array")
  }
  if (typeof candidate.profile !== "string") throw new Error("profile must be a supported Product profile")
  return candidate as unknown as ProductInitializationInput
}

function phase1AuthoringMarkdown(state: Phase1CanonicalAuthoringState): string {
  const presentation = phase1CanonicalPresentation({
    kind: state.target.kind,
    label: state.target.label,
    draft: state.draft,
  })
  return [
    `# ${markdownValue(state.target.label)} — ${state.phase === "review" ? "exact review" : state.target.operation === "revise" ? "revision proposal" : "candidate proposal"}`,
    "",
    `Product Journey record **${state.target.ordinal}/${state.target.total}** · ${markdownValue(state.target.group)}`,
    `Advisor: **${markdownValue(state.advisor.agentLabel)} · ${markdownValue(state.advisor.modelLabel)}** (${state.advisor.modelTruthClass}) · round **${state.round}**`,
    ...(state.target.current ? [
      `Current governed revision: **${state.target.current.revision}** · immutable history: **${state.target.current.historyCount} revision(s)**`,
    ] : []),
    "",
    `**Assessment:** ${markdownValue(state.assessment.assessment)}`,
    ...(state.assessment.strengths.length > 0
      ? ["", "**Strengths retained**", ...state.assessment.strengths.map((item) => `- ${markdownValue(item)}`)]
      : []),
    ...(state.assessment.gaps.length > 0
      ? ["", "**Gaps and assumptions**", ...state.assessment.gaps.map((item) => `- ${markdownValue(item)}`)]
      : []),
    ...(state.assessment.followUpQuestion
      ? ["", `**Challenge question:** ${markdownValue(state.assessment.followUpQuestion)}`]
      : []),
    "",
    presentation,
    ...(state.target.downstreamRecorded.length > 0 ? [
      "",
      "## Downstream realignment after commit",
      "",
      ...state.target.downstreamRecorded.map((entry) => `- **${markdownValue(entry.label)}** — review required after this upstream revision`),
    ] : []),
    "",
    "> This candidate has passed its input schema only. It grants no approval, appointment, baseline designation, readiness, implementation, release, or action authority.",
    "",
    state.phase === "review"
      ? "Send **`@gaep /commit CONFIRM`** to record this exact candidate, or **`@gaep /back`** to return to proposal review."
      : "Reply naturally with corrections for another governed advisory round, or send **`@gaep /commit CONFIRM`** for one explicit Review and Record action. `/accept` remains available when you want a separate exact-review pause.",
  ].join("\n")
}

function referenceUri(reference: vscode.ChatPromptReference): vscode.Uri | undefined {
  if (reference.value instanceof vscode.Uri) return reference.value
  if (reference.value instanceof vscode.Location) return reference.value.uri
  return undefined
}

function portableAttachmentLabel(uri: vscode.Uri): string {
  if (uri.scheme !== "file") return `${uri.scheme}:${basename(uri.path) || "attachment"}`
  const folder = vscode.workspace.getWorkspaceFolder(uri)
  if (!folder) return basename(uri.fsPath) || "external-attachment"
  const path = relative(folder.uri.fsPath, uri.fsPath)
  if (!path || path === ".." || path.startsWith(`..${sep}`)) return basename(uri.fsPath) || "attachment"
  return `${folder.name}/${path.split(sep).join("/")}`
}

function attachmentNode(uri: vscode.Uri, label: string): ProductChatAttachmentNode {
  return {
    label,
    scheme: uri.scheme,
    path: uri.path,
    read: async () => vscode.workspace.fs.readFile(uri),
    kind: async () => {
      const stat = await vscode.workspace.fs.stat(uri)
      if ((stat.type & vscode.FileType.SymbolicLink) !== 0) return "symbolic-link"
      if ((stat.type & vscode.FileType.Directory) !== 0) return "directory"
      if ((stat.type & vscode.FileType.File) !== 0) return "file"
      return "other"
    },
    children: async () => (await vscode.workspace.fs.readDirectory(uri)).map(([name]) =>
      attachmentNode(vscode.Uri.joinPath(uri, name), `${label}/${name}`)),
  }
}

async function attachmentResources(
  request: vscode.ChatRequest,
  response: vscode.ChatResponseStream,
  chosenFiles: readonly vscode.Uri[] = [],
): Promise<{
  rootCount: number
  resources: ProductChatAttachmentResource[]
  rejected: ProductChatAttachmentBatch["rejected"]
}> {
  const referencedUris = request.references.flatMap((reference) => {
    const uri = referenceUri(reference)
    if (!uri) return []
    if (isImplicitChatInstructionReference({
      id: reference.id,
      modelDescription: reference.modelDescription,
      path: uri.path,
      ...(reference.range ? { range: reference.range } : {}),
    })) return []
    return [uri]
  })
  const roots = [...new Map([...referencedUris, ...chosenFiles].map((uri) => [uri.toString(), uri])).values()].slice(0, 20)
  const nodes: ProductChatAttachmentNode[] = []
  for (const uri of roots) {
    response.reference(uri)
    nodes.push(attachmentNode(uri, portableAttachmentLabel(uri)))
  }
  const discovered = await discoverProductChatAttachmentResources(nodes)
  return { rootCount: roots.length, ...discovered }
}

async function withChatCancellation<T>(
  token: vscode.CancellationToken,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const abort = new AbortController()
  const cancellation = token.onCancellationRequested(() => abort.abort())
  try {
    return await operation(abort.signal)
  } finally {
    cancellation.dispose()
  }
}

function sourceAlignmentMarkdown(state: SourceAlignmentChatState): string {
  const alignmentRows = sourceAlignmentTableRows(state.assessment.proposedAnswer)
  const nextCheckpoint = sourceAlignmentNextCheckpoint(state.assessment.proposedAnswer)
  const reviewRows = [
    ["Assessment", state.assessment.assessment],
    ...state.assessment.strengths.map((item) => ["Strength", item]),
    ...state.assessment.gaps.map((item) => ["Gap / conflict", item]),
    ...(state.assessment.followUpQuestion ? [["Question", state.assessment.followUpQuestion]] : []),
  ]
  return [
    "# Existing Product alignment preview",
    "",
    markdownTable(
      ["Context", "Value"],
      [
        ["Advisor", `${state.advisor.agentLabel} · ${state.advisor.modelLabel} (${state.advisor.modelTruthClass})`],
        ["Initiative", `${state.initiative.title} · revision ${state.initiative.revision}`],
        ["Advisory round", String(state.round)],
      ],
    ),
    "",
    "## Candidate set",
    "",
    sourceOverviewTable(state),
    "",
    "The full file-by-file manifest is intentionally omitted from this decision view. Use **`@gaep /manifest`** only when you need to audit exact paths and digests.",
    "",
    "## Proposed GAEP alignment",
    "",
    markdownTable(
      ["Checkpoint", "Content alignment", "Authority", "Evidence, conflict, or missing information"],
      alignmentRows.map((row) => [row.checkpoint, row.alignment, row.authority, row.evidenceAndGap]),
    ),
    ...(nextCheckpoint ? ["", `**Recommended next checkpoint:** ${markdownValue(nextCheckpoint)}`] : []),
    "",
    "## Review notes",
    "",
    markdownTable(["Type", "Detail"], reviewRows),
    "",
    "> This is an editable advisory preview. It does not create Source, Baseline, Provenance, approval, readiness, or lifecycle authority.",
    "",
    state.phase === "accepted"
      ? "The preview is accepted for this Chat session. Use **`@gaep /record`** to record the exact files as non-authoritative candidate Sources."
      : "Reply naturally with corrections for another advisory round, or send **`@gaep /accept`** to accept this preview.",
  ].join("\n")
}

function sourceUnderstandingMarkdown(state: SourceAlignmentChatState): string {
  return [
    "# Attachment review",
    "",
    markdownTable(
      ["Context", "Value"],
      [
        ["Advisor", `${state.advisor.agentLabel} · ${state.advisor.modelLabel} (${state.advisor.modelTruthClass})`],
        ["Task", state.task ?? "Explain the attached Product documents"],
      ],
    ),
    "",
    "## Intake summary",
    "",
    sourceOverviewTable(state),
    "",
    "> Candidate authority boundary: words such as authoritative, approved, final, source of truth, or supersedes describe claims or precedence inside the candidate document set only. GAEP has not granted semantic authority to any attachment.",
    "",
    "## Answer",
    "",
    state.assessment.proposedAnswer,
    "",
    `**Review note:** ${markdownValue(state.assessment.assessment)}`,
    ...(state.assessment.followUpQuestion ? ["", `**Useful next question:** ${markdownValue(state.assessment.followUpQuestion)}`] : []),
    "",
    "> This answer uses attachment content but creates no Source, Baseline, Provenance, approval, or lifecycle authority.",
    "",
    "Ask another natural-language question about these files, use **`@gaep /manifest`** to audit exact file paths and digests, send **`@gaep /align`** for a separate editable GAEP lifecycle alignment preview, or use **`@gaep /record`** to record the exact files as non-authoritative candidate Sources.",
  ].join("\n")
}

function sourceOverviewTable(state: SourceAlignmentChatState): string {
  const manifest = sourceIntakeManifestSummary({ sources: state.sources, rejected: state.rejected })
  const formats = new Map<string, number>()
  for (const source of state.sources) {
    const format = source.format.toUpperCase()
    formats.set(format, (formats.get(format) ?? 0) + 1)
  }
  return markdownTable(
    ["Included", "Unique", "Duplicates", "Excluded", "Formats", "Bytes", "Silent truncation"],
    [[
      String(manifest.includedFiles),
      String(manifest.uniqueContentDigests),
      String(manifest.duplicateContentInstances),
      String(manifest.excludedEntries),
      [...formats.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([format, count]) => `${format} ${count}`).join(", ") || "none",
      manifest.totalCandidateBytes.toLocaleString("en-US"),
      "None",
    ]],
  )
}

function sourceManifestMarkdown(state: SourceAlignmentChatState): string {
  const firstLabelByDigest = new Map<string, string>()
  const includedRows = state.sources.map((source, index) => {
    const duplicateOf = firstLabelByDigest.get(source.contentDigest)
    if (!duplicateOf) firstLabelByDigest.set(source.contentDigest, source.label)
    return [
      String(index + 1),
      "Included",
      source.label,
      `${source.format.toUpperCase()}${source.extraction ? ` · ${source.extraction}` : ""}`,
      source.byteLength.toLocaleString("en-US"),
      source.contentDigest,
      duplicateOf ? `Duplicate content of ${duplicateOf}` : "Eligible",
    ]
  })
  const excludedRows = state.rejected.map((source, index) => [
    String(includedRows.length + index + 1),
    "Excluded",
    source.label,
    "—",
    "—",
    "—",
    source.reason,
  ])
  const limitations = state.sources.flatMap((source) =>
    (source.limitations ?? []).map((limitation) => [source.label, limitation]),
  )
  return [
    "# Candidate file manifest",
    "",
    sourceOverviewTable(state),
    "",
    markdownTable(
      ["#", "Status", "File", "Format", "Bytes", "SHA-256", "Review state"],
      [...includedRows, ...excludedRows],
    ),
    ...(limitations.length > 0
      ? ["", "## Extraction limitations", "", markdownTable(["File", "Limitation"], limitations)]
      : []),
    "",
    "> This audit view does not record files or grant Source, Baseline, Provenance, approval, readiness, implementation, or release authority.",
  ].join("\n")
}

function recordedCandidateSourcesMarkdown(input: Awaited<ReturnType<GaepProductChatOptions["recordCandidateSources"]>>): string {
  return [
    "# Candidate Sources recorded",
    "",
    markdownTable(
      ["New Sources", "Already recorded", "Total exact Sources", "Semantic authority", "Handling"],
      [[
        String(input.recorded.length),
        String(input.reused.length),
        String(input.recorded.length + input.reused.length),
        "Non-authoritative",
        "Restricted until reviewed",
      ]],
    ),
    "",
    "## Safe defaults",
    "",
    markdownTable(
      ["Control", "Recorded state"],
      [
        ["Semantic authority", "Non-authoritative"],
        ["Owner, usage rights, freshness, and source authenticity", "Not established"],
        ["Handling", "Restricted until reviewed"],
        ["Exact original-byte digest", "Recorded"],
      ],
    ),
    "",
    "> This Source Intake records exact candidate files only. It creates no Baseline, Provenance, approval, readiness, implementation, or release authority.",
    "",
    "Use **`@gaep /continue`** to inspect the updated Product Journey. Candidate Baseline and Provenance remain separate checkpoints.",
  ].join("\n")
}

function markdownValue(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+.!|>-]/gu, "\\$&")
}

function sameAdvisor(left: ProductChatAdvisorSelection, right: ProductChatAdvisorSelection): boolean {
  return left.adapterId === right.adapterId && left.modelId === right.modelId
}

function initializationValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join("\n") : value
}

function questionMarkdown(state: ProductInitializationChatState, challenge?: string): string {
  const question = currentProductInitializationQuestion(state)
  if (!question) return "The initialization draft is ready for review."
  return [
    `### ${question.title}`,
    "",
    `Progress: **${productInitializationProgress(state)}**`,
    `Advisor: **${markdownValue(state.advisor.agentLabel)} · ${markdownValue(state.advisor.modelLabel)}** (${state.advisor.modelTruthClass})`,
    "",
    ...(challenge ? [`> ${challenge}`, ""] : []),
    question.prompt,
    ...(state.workflow === "revision" && state.answers[question.key] !== undefined
      ? ["", `Current governed value: ${markdownValue(initializationValue(state.answers[question.key]!))}`]
      : []),
    "",
    `Example: _${question.example}_`,
    "",
    "Answer naturally, paste multiple lines, or use the VS Code Chat microphone. Attachments remain candidate inputs until a governed Source Intake records them.",
  ].join("\n")
}

function assessedAnswerMarkdown(state: ProductInitializationChatState): string {
  const question = currentProductInitializationQuestion(state)
  const pending = state.pending
  if (!question || !pending) return "No assessed answer is awaiting approval."
  const list = (values: readonly string[], empty: string) => values.length > 0
    ? values.map((value) => `- ${markdownValue(value)}`).join("\n")
    : `- ${empty}`
  return [
    `### ${question.title} — advisory round ${pending.round}`,
    "",
    `Advisor: **${markdownValue(pending.advisor.agentLabel)} · ${markdownValue(pending.advisor.modelLabel)}**`,
    "",
    `**Assessment:** ${markdownValue(pending.assessment)}`,
    "",
    "**Strengths retained:**",
    list(pending.strengths, "No distinct strength was identified."),
    "",
    "**Gaps or assumptions:**",
    list(pending.gaps, "No material gap was identified."),
    "",
    "**Proposed answer:**",
    "",
    `> ${markdownValue(pending.proposedAnswer).replace(/\n/gu, "\n> ")}`,
    ...(pending.followUpQuestion ? ["", `**Challenge question:** ${markdownValue(pending.followUpQuestion)}`] : []),
    "",
    "> This is an AI proposal, not accepted Product truth. GAEP will not advance automatically.",
    "",
    "Send **`@gaep /accept`** to accept this proposal and move to the next question. Otherwise reply naturally with a correction, objection, or more context; the selected advisor will challenge and improve it again.",
  ].join("\n")
}

function initiativeQuestionMarkdown(state: InitiativeChatState, challenge?: string): string {
  const question = currentInitiativeQuestion(state)
  if (!question) return "The Initiative draft is ready for review."
  return [
    `### ${question.title}`,
    "",
    `Initiative progress: **${initiativeProgress(state)}**`,
    `Advisor: **${markdownValue(state.advisor.agentLabel)} · ${markdownValue(state.advisor.modelLabel)}** (${state.advisor.modelTruthClass})`,
    "",
    ...(challenge ? [`> ${challenge}`, ""] : []),
    question.prompt,
    "",
    `Example: _${question.example.replace(/\n/gu, " · ")}_`,
    "",
    "Reply naturally. GAEP will ask the selected advisor to challenge the answer and will not advance until `/accept`.",
  ].join("\n")
}

function initiativeAssessedMarkdown(state: InitiativeChatState): string {
  const question = currentInitiativeQuestion(state)
  const pending = state.pending
  if (!question || !pending) return "No assessed Initiative answer is awaiting approval."
  const items = (values: readonly string[], empty: string) => values.length > 0
    ? values.map((value) => `- ${markdownValue(value)}`).join("\n")
    : `- ${empty}`
  return [
    `### ${question.title} — advisory round ${pending.round}`,
    "",
    `Advisor: **${markdownValue(pending.advisor.agentLabel)} · ${markdownValue(pending.advisor.modelLabel)}**`,
    "",
    `**Assessment:** ${markdownValue(pending.assessment)}`,
    "",
    "**Strengths retained:**",
    items(pending.strengths, "No distinct strength was identified."),
    "",
    "**Gaps or assumptions:**",
    items(pending.gaps, "No material gap was identified."),
    "",
    "**Proposed answer:**",
    "",
    `> ${markdownValue(pending.proposedAnswer).replace(/\n/gu, "\n> ")}`,
    ...(pending.followUpQuestion ? ["", `**Challenge question:** ${markdownValue(pending.followUpQuestion)}`] : []),
    "",
    "> This proposal does not create or advance an Initiative.",
    "",
    "Send **`@gaep /accept`** to accept it, or reply with a correction for another advisory round.",
  ].join("\n")
}

function initiativeReviewMarkdown(state: InitiativeChatState): string {
  const input = initiativeInput(state)
  const items = (values: readonly string[]) => values.length > 0
    ? values.map((value) => `- ${markdownValue(value)}`).join("\n")
    : "- None declared"
  return [
    "## Initiative review",
    "",
    `**Title:** ${markdownValue(input.title)}`,
    "",
    `**Bounded outcome:** ${markdownValue(input.outcome)}`,
    "",
    "**Included scope:**",
    items(input.scope),
    "",
    "**Exclusions:**",
    items(input.exclusions),
    "",
    "> Commit creates a proposed Initiative only. It grants no activation, execution, implementation, or source authority.",
    "",
    "Send **`@gaep /commit CONFIRM`** to create it, `/back` to revise the last field, or `/cancel` to discard the draft.",
  ].join("\n")
}

function classificationSummary(input: InitiativeClassificationInput): string {
  const list = (values: readonly string[]) => values.length > 0 ? values.map(markdownValue).join(", ") : "none"
  return [
    `**Primary / secondary types:** \`${input.primaryType}\` / ${list(input.secondaryTypes)}`,
    `**System / change:** \`${input.systemState}\` / \`${input.changePosture}\``,
    `**Motivations:** ${list(input.motivations)}`,
    `**UI / data / integration / exposure:** \`${input.characteristics.userInterface}\` / \`${input.characteristics.data}\` / \`${input.characteristics.integration}\` / \`${input.characteristics.exposure}\``,
    `**Interaction modes:** ${list(input.characteristics.interactionModes)}`,
    `**Regulated / policy domains:** ${input.regulated ? "yes" : "no"} / ${list(input.policyDomains)}`,
    `**Sensitivities:** ${list(input.sensitivities)}`,
    `**Lifetime / maintenance:** \`${input.expectedLifetime}\` / ${markdownValue(input.maintenanceHorizon)}`,
    `**Risk:** blast radius \`${input.risk.blastRadius}\`, reversibility \`${input.risk.reversibility}\`, urgency \`${input.risk.urgency}\`, cost of failure \`${input.risk.costOfFailure}\``,
    `**Dependencies / affected assets:** ${list(input.dependencies)} / ${list(input.affectedAssets)}`,
    `**Owner / accountable authority:** ${markdownValue(input.owner)} / ${markdownValue(input.accountableAuthority)}`,
    `**Confidence:** \`${input.confidence.level}\` — ${markdownValue(input.confidence.basis)}`,
    `**Evidence:** ${input.evidence.map((entry) => `${entry.kind}: ${markdownValue(entry.reference)}`).join("; ")}`,
    `**Unresolved questions:** ${list(input.unresolvedQuestions)}`,
    `**Rationale:** ${markdownValue(input.rationale)}`,
  ].join("\n\n")
}

function classificationQuestionMarkdown(state: InitiativeClassificationChatState, challenge?: string): string {
  const currentQuestions = state.currentClassification?.unresolvedQuestions ?? []
  return [
    "## Initiative Classification",
    "",
    `Initiative: **${markdownValue(state.initiative.title)}** · revision ${state.initiativeRevision}`,
    `Product: **${markdownValue(state.product.name)}** · revision ${state.productRevision} · profile \`${state.product.profile}\``,
    `Advisor: **${markdownValue(state.advisor.agentLabel)} · ${markdownValue(state.advisor.modelLabel)}** (${state.advisor.modelTruthClass})`,
    "",
    ...(challenge ? [`> ${challenge}`, ""] : []),
    ...(currentQuestions.length > 0 ? [
      `**Current open questions (${currentQuestions.length}):**`,
      "",
      ...currentQuestions.map((question) => `- ${markdownValue(question)}`),
      "",
    ] : []),
    "Describe the classification in natural language. Include what is known about:",
    "",
    "- primary/secondary Initiative type and whether this is greenfield or brownfield;",
    "- change posture and motivations;",
    "- UI, data, integrations, interaction modes, and exposure;",
    "- regulation, policy domains, sensitivities, lifetime, and maintenance horizon;",
    "- blast radius, reversibility, urgency, cost of failure, dependencies, and affected assets;",
    "- human owner, accountable authority, evidence basis, confidence, and unresolved questions.",
    "",
    "The selected advisor will challenge the brief and propose the complete governed classification. GAEP will not persist it without `/accept` followed by `/commit CONFIRM`.",
    ...(state.currentClassification ? [
      "",
      "Reply naturally with answers or corrections. You can also use `/suggest` to ask GAEP for bounded candidate resolutions. Recording a revised Classification creates a new Initiative revision, so Applicability must then be reconfirmed against that revision.",
    ] : []),
  ].join("\n")
}

function classificationAssessedMarkdown(state: InitiativeClassificationChatState): string {
  const pending = state.pending
  if (!pending) return "No assessed Initiative classification is awaiting approval."
  const attentionItems = initiativeClassificationAttentionItems(pending.classification)
  const items = (values: readonly string[], empty: string) => values.length > 0
    ? values.map((value) => `- ${markdownValue(value)}`).join("\n")
    : `- ${empty}`
  return [
    `## Initiative Classification — advisory round ${pending.round}`,
    "",
    `Advisor: **${markdownValue(pending.advisor.agentLabel)} · ${markdownValue(pending.advisor.modelLabel)}**`,
    "",
    `**Assessment:** ${markdownValue(pending.assessment)}`,
    "",
    "**Strengths retained:**",
    items(pending.strengths, "No distinct strength was identified."),
    "",
    "**Gaps or assumptions:**",
    items(pending.gaps, "No material gap was identified."),
    ...(pending.followUpQuestion ? ["", `**Challenge question:** ${markdownValue(pending.followUpQuestion)}`] : []),
    "",
    "### Proposed governed classification",
    "",
    classificationSummary(pending.classification),
    "",
    "> This is an AI proposal. It grants no approval, applicability decision, activation, execution, or implementation authority.",
    "",
    attentionItems.length > 0
      ? [
          `This proposal still contains **${attentionItems.length} open classification question(s)** and is not resolution-complete.`,
          "Send **`@gaep /resolve`** for a bounded completion proposal or answer the questions naturally.",
          "Use **`@gaep /accept ATTENTION`** only when deliberately preserving these open questions.",
        ].join(" ")
      : "Send **`@gaep /accept`** to move to exact review, or reply naturally with corrections for another advisory round.",
  ].join("\n")
}

function classificationReviewMarkdown(state: InitiativeClassificationChatState): string {
  const input = initiativeClassificationInput(state)
  return [
    "## Initiative Classification review",
    "",
    classificationSummary(input),
    "",
    `Bound to Initiative revision **${state.initiativeRevision}** and Product revision **${state.productRevision}**.`,
    "",
    "> Commit records human-attributed classification only. It does not resolve applicability or activate the Initiative.",
    "",
    "Send **`@gaep /commit CONFIRM`** to record it, `/back` to revise the brief, or `/cancel` to discard the draft.",
  ].join("\n")
}

function applicabilitySummary(input: InitiativeApplicabilityMatrixInput): string {
  const groups = new Map<string, string[]>()
  for (const decision of input.decisions) {
    const labels = groups.get(decision.status) ?? []
    labels.push(decision.subject.label)
    groups.set(decision.status, labels)
  }
  const statusLines = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([status, labels]) =>
    `- **${status} (${labels.length}):** ${labels.map(markdownValue).join("; ")}`)
  const unresolved = input.unresolvedSubjects.length > 0
    ? input.unresolvedSubjects.map((entry) =>
        `- **${markdownValue(entry.subject.label)}** — ${markdownValue(entry.reason)} · owner: ${markdownValue(entry.owner)}`).join("\n")
    : "- None"
  return [
    `**Canonical coverage:** ${input.decisions.length + input.unresolvedSubjects.length} subjects (${input.decisions.length} decided; ${input.unresolvedSubjects.length} unresolved)`,
    "",
    "**Decisions by status:**",
    ...statusLines,
    "",
    "**Unresolved subjects:**",
    unresolved,
  ].join("\n")
}

function applicabilityQuestionMarkdown(state: InitiativeApplicabilityChatState, challenge?: string): string {
  const pendingHumanDecisions = state.currentApplicability?.decisions.filter((decision) =>
    decision.status === "awaiting-human-decision" || decision.approval.state === "pending") ?? []
  return [
    "## Initiative Applicability Resolution",
    "",
    `Initiative: **${markdownValue(state.initiative.title)}** · revision ${state.initiativeRevision}`,
    `Classification: **${markdownValue(state.classification.primaryType)}** · canonical subjects ${state.catalog.subjects.length}`,
    `Advisor: **${markdownValue(state.advisor.agentLabel)} · ${markdownValue(state.advisor.modelLabel)}** (${state.advisor.modelTruthClass})`,
    "",
    ...(challenge ? [`> ${challenge}`, ""] : []),
    ...(pendingHumanDecisions.length > 0 ? [
      `**Pending human decisions (${pendingHumanDecisions.length}):**`,
      "",
      ...pendingHumanDecisions.map((decision) =>
        `- ${markdownValue(decision.subject.label)} — owner: ${markdownValue(decision.owner)}${decision.accountableApprover ? `; accountable approver: ${markdownValue(decision.accountableApprover)}` : ""}`),
      "",
    ] : []),
    "Describe the intended lifecycle depth in natural language. Include:",
    "",
    "- which discovery, architecture, design, implementation, release, testing, approval, and evidence work is required, optional, excluded, deferred, or awaiting a human decision;",
    "- known owners and accountable approvers;",
    "- existing governed records that genuinely satisfy or can be reused;",
    "- conditions, dependencies, review triggers, and decisions that must remain unresolved.",
    "",
    `The selected advisor will challenge the brief and map every one of the ${state.catalog.subjects.length} canonical subjects exactly once. Missing knowledge remains explicitly unresolved; absence is never interpreted as not applicable.`,
    "",
    "GAEP will not persist the matrix without `/accept` followed by `/commit CONFIRM`, and the matrix grants no approval, readiness, activation, execution, or implementation authority.",
    "",
    "**You do not need to write this brief or remember standard roles.** Use `/roles` to inspect GAEP's editable 49-subject role recommendations. Select **Use suggested applicability brief** below, or send `/suggest`; GAEP will submit the governed context plus those candidate roles to the active advisor. You can correct any role naturally before `/accept`.",
  ].join("\n")
}

function applicabilityRolesMarkdown(state: InitiativeApplicabilityChatState): string {
  const owners = new Map<string, string[]>()
  const approvers = new Map<string, string[]>()
  for (const recommendation of standardInitiativeApplicabilityRoleCoverage(state)) {
    const label = recommendation.subject.label
    owners.set(recommendation.owner, [...(owners.get(recommendation.owner) ?? []), label])
    if (recommendation.accountableApprover) {
      approvers.set(recommendation.accountableApprover, [
        ...(approvers.get(recommendation.accountableApprover) ?? []),
        label,
      ])
    }
  }
  const lines = (entries: Map<string, string[]>) => [...entries.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([role, subjects]) => `- **${markdownValue(role)} (${subjects.length}):** ${subjects.map(markdownValue).join("; ")}`)
  return [
    "## Suggested standard role coverage",
    "",
    `GAEP covers all **${state.catalog.subjects.length} canonical subjects** with editable candidate roles. These recommendations appoint nobody, grant no approval, and remain ungoverned until explicit \`/accept\` and \`/commit CONFIRM\`.`,
    "",
    "### Candidate owners",
    "",
    ...lines(owners),
    "",
    "### Candidate accountable approvers",
    "",
    ...lines(approvers),
    "",
    "To use the defaults, send `/suggest`. To override one or more roles, reply naturally with the override and the desired lifecycle depth; GAEP will generate a new proposal immediately. Do not send `/suggest` after an override because `/suggest` intentionally restores the standard defaults.",
  ].join("\n")
}

function applicabilityAdvisorContext(state: InitiativeApplicabilityChatState): object {
  return {
    product: state.product,
    initiative: state.initiative,
    classification: state.classification,
    subjectCatalog: {
      catalogVersion: state.catalog.catalogVersion,
      digest: state.catalog.digest,
      subjectCount: state.catalog.subjects.length,
    },
    revisionBinding: {
      initiativeRevision: state.initiativeRevision,
      productRevision: state.productRevision,
    },
    ...(state.currentApplicability ? { currentApplicability: state.currentApplicability } : {}),
  }
}

function applicabilityAssessedMarkdown(state: InitiativeApplicabilityChatState): string {
  const pending = state.pending
  if (!pending) return "No assessed Initiative applicability matrix is awaiting approval."
  const items = (values: readonly string[], empty: string) => values.length > 0
    ? values.map((value) => `- ${markdownValue(value)}`).join("\n")
    : `- ${empty}`
  const unresolvedCount = pending.matrix.unresolvedSubjects.length
  const attentionItems = initiativeApplicabilityAttentionItems(pending.matrix)
  const lifecycleAiCorrections = initiativeApplicabilityLifecycleAiCorrections(state)
  return [
    `## Initiative Applicability — advisory round ${pending.round}`,
    "",
    `Advisor: **${markdownValue(pending.advisor.agentLabel)} · ${markdownValue(pending.advisor.modelLabel)}**`,
    "",
    `**Assessment:** ${markdownValue(pending.assessment)}`,
    "",
    "**Strengths retained:**",
    items(pending.strengths, "No distinct strength was identified."),
    "",
    "**Gaps or assumptions:**",
    items(pending.gaps, "No material gap was identified."),
    ...(pending.followUpQuestion ? ["", `**Challenge question:** ${markdownValue(pending.followUpQuestion)}`] : []),
    "",
    "### Proposed governed applicability matrix",
    "",
    applicabilitySummary(pending.matrix),
    "",
    "> This is an AI proposal. It grants no approval, readiness, activation, execution, implementation, source, or release authority.",
    "",
    lifecycleAiCorrections.length > 0
      ? `GAEP detected **${lifecycleAiCorrections.length} lifecycle-AI scope decision(s)** that conflate GAEP-assisted lifecycle work with target-runtime AI. Do not accept this matrix yet. Send **\`@gaep /resolve\`** to replace those decisions in another advisory round.`
      : attentionItems.length > 0
      ? `This proposal still contains **${attentionItems.length} applicability attention item(s)** (${unresolvedCount} unresolved). Send **\`@gaep /resolve\`** to generate a bounded completion proposal or reply naturally with decisions. Use **\`@gaep /accept ATTENTION\`** only when deliberately preserving these items.`
      : "Send **`@gaep /accept`** to move to exact review, or reply naturally with corrections for another advisory round.",
  ].join("\n")
}

function applicabilityReviewMarkdown(state: InitiativeApplicabilityChatState): string {
  const input = initiativeApplicabilityInput(state)
  return [
    "## Initiative Applicability review",
    "",
    applicabilitySummary(input),
    "",
    `Bound to Initiative revision **${state.initiativeRevision}**, Product revision **${state.productRevision}**, and catalog **${state.catalog.digest}**.`,
    "",
    "> Commit records a human-attributed applicability matrix only. It does not approve or activate the Initiative and does not authorize implementation.",
    "",
    "Send **`@gaep /commit CONFIRM`** to record it, `/back` to revise the brief, or `/cancel` to discard the draft.",
  ].join("\n")
}

function reviewMarkdown(state: ProductInitializationChatState): string {
  const input = productInitializationInput(state)
  return [
    "## Product initialization review",
    "",
    markdownTable(["Field", "Proposed value"], [
      ["Product name", input.name],
      ["One-sentence summary", input.summary],
      ["Problem", input.problem],
      ["Affected users", input.affectedUsers],
      ["Desired outcome", input.desiredOutcome],
      ["Success signals", input.successSignals.join("\n")],
      ["First workflow", input.firstWorkflow],
      ["Initial exclusions", input.exclusions.join("\n") || "None declared"],
      ["Profile", input.profile],
    ]),
    "",
    markdownTable(["Evidence context", "Value"], [
      ["Advisor", `${state.advisor.agentLabel} · ${state.advisor.modelLabel} (${state.advisor.modelTruthClass})`],
      ["Candidate attachments", state.candidateAttachments.length > 0 ? state.candidateAttachments.join("\n") : "None"],
      ["Authority", "Candidate only — explicit commit is still required"],
    ]),
    "",
    "> Conversation and attachments are not yet the engineering source of truth. Only the explicit commit below creates governed Product state; attachments require a later Source Intake.",
    "",
    state.workflow === "revision"
      ? "Use **`@gaep /revise`** to edit another field. To create an audited Product revision, send **`@gaep /commit CONFIRM`**. Use `/cancel` to discard this revision draft."
      : "To create `.gaep`, send **`@gaep /commit CONFIRM`**. Use `/back` to revise the last answer or `/cancel` to discard this chat draft.",
  ].join("\n")
}

function helpMarkdown(): string {
  return [
    "## GAEP interactive Product workspace",
    "",
    "- `/initialize` — start a challenged Product initialization",
    "- `/adopt` — analyze an existing Product and propose Product Definition plus evidence-backed coverage for the complete Product Journey",
    "- `/revise` — revise one or more fields of an existing Product without replacing its identity",
    "- `/initiative` — review and revise one field of the current Initiative definition",
    "- `/edit` — choose and edit any field in the current complete Product draft",
    "- `/continue` — inspect governed state and start the next valid conversational workflow",
    "- `/classification` — review and resolve open questions in the current Initiative classification",
    "- `/applicability` — review and resolve pending human decisions in the current Initiative applicability matrix",
    "- `/intake` — explain, summarize, compare, or answer questions from explicitly attached Product documents",
    "- `/align` — create a separate editable GAEP lifecycle alignment after reviewing attachment content",
    "- `/manifest` — audit the exact included and excluded attachment paths, formats, sizes, and digests",
    "- `/record` — record the exact reviewed files as non-authoritative candidate Sources",
    "- `/baseline` — review and record an exact candidate Baseline from current candidate Sources",
    "- `/provenance` — record conservative exact Source-to-Initiative lineage for the current baseline",
    "- `/author` — generate, challenge, review, and record the next Product Journey record",
    "- `/mode` — choose Quick, Guided, or Assured journey presentation without weakening governed records",
    "- `/suggest` — generate and submit a safe context-aware starter for the active lifecycle question",
    "- `/roles` — inspect editable standard owner and accountable-approver recommendations for all applicability subjects",
    "- `/resolve` — ask GAEP to propose bounded defaults for unresolved applicability subjects and run another advisory round",
    "- `/agent` — switch between Codex and Claude Code, then select its model",
    "- `/model` — switch models within the current agent",
    "- `/advisor` — combined agent-and-model selector (compatibility alias)",
    "- `/accept` — explicitly accept the current AI-assisted proposal and advance",
    "- `/status` — inspect governed Product and draft state",
    "- `/review` — review a completed initialization draft",
    "- `/back` — revise the previous answer",
    "- `/commit CONFIRM` — explicitly create governed Product state",
    "- `/cancel` — discard the current chat draft",
    "",
    "Use the VS Code Chat Add Context paperclip or `#file` for files and the host microphone for speech-to-text. GAEP stores neither raw audio nor attachment contents in portable Chat state.",
  ].join("\n")
}

export function registerGaepProductChat(
  context: vscode.ExtensionContext,
  options: GaepProductChatOptions,
): vscode.ChatParticipant {
  let conversationTurns: ProductChatConversationTurn[] = []
  let conversationOutlinePanel: vscode.WebviewPanel | undefined
  const openConversationOutline = (): void => {
    if (conversationTurns.length === 0) {
      void vscode.window.showInformationMessage("Start a GAEP Product Chat turn before opening its Conversation Outline.")
      return
    }
    if (!conversationOutlinePanel) {
      conversationOutlinePanel = vscode.window.createWebviewPanel(
        "gaep.productConversationOutline",
        "GAEP Conversation Outline",
        vscode.ViewColumn.Beside,
        { enableScripts: false, retainContextWhenHidden: true },
      )
      conversationOutlinePanel.onDidDispose(() => { conversationOutlinePanel = undefined })
    }
    conversationOutlinePanel.webview.html = productChatConversationOutlineHtml(conversationTurns)
    conversationOutlinePanel.reveal(vscode.ViewColumn.Beside, true)
  }
  context.subscriptions.push(vscode.commands.registerCommand("gaep.openConversationOutline", openConversationOutline))

  const sourceReviewCache = new Map<string, ProductChatAttachmentBatch>()
  const cacheSourceBatch = (batch: ProductChatAttachmentBatch): string => {
    const key = sourceReviewCacheKey(batch.candidates.map((candidate) => candidate.contentDigest))
    sourceReviewCache.set(key, batch)
    while (sourceReviewCache.size > 8) {
      const oldest = sourceReviewCache.keys().next().value as string | undefined
      if (!oldest) break
      sourceReviewCache.delete(oldest)
    }
    return key
  }
  const coreHandler: vscode.ChatRequestHandler = async (request, chatContext, response, token) => {
    if (!vscode.workspace.isTrusted) {
      response.markdown("GAEP is fail-closed in Restricted Mode. Trust the intended Product folder before starting an interactive workflow.")
      response.button({ command: "gaep.manageWorkspaceTrust", title: "Manage Workspace Trust" })
      return { errorDetails: { message: "Workspace trust is required" } }
    }
    const command = request.command ?? ""
    const discoveredAttachments = await attachmentResources(
      request,
      response,
      command === "intake" || command === "adopt" ? options.takeChosenFiles() : [],
    )
    const referencedResources = discoveredAttachments.resources
    const attached = referencedResources.map((resource) => resource.label)
    let state = latestState(chatContext)
    let initiativeState = latestInitiativeState(chatContext)
    const resolutionState = latestResolutionState(chatContext)
    let classificationState = resolutionState?.kind === "gaep-initiative-classification-chat-state"
      ? resolutionState
      : undefined
    let applicabilityState = resolutionState?.kind === "gaep-initiative-applicability-chat-state"
      ? resolutionState
      : undefined
    let sourceAlignmentState = latestSourceAlignmentState(chatContext)
    let phase1AuthoringState = latestPhase1AuthoringState(chatContext)
    const sessionAdvisor = options.currentAdvisor()
    if (state && sessionAdvisor && !sameAdvisor(state.advisor, sessionAdvisor)) {
      state = changeProductChatAdvisor(state, sessionAdvisor, true)
    }
    if (initiativeState && sessionAdvisor && !sameAdvisor(initiativeState.advisor, sessionAdvisor)) {
      initiativeState = changeInitiativeAdvisor(initiativeState, sessionAdvisor, true)
    }
    if (classificationState && sessionAdvisor && !sameAdvisor(classificationState.advisor, sessionAdvisor)) {
      classificationState = changeInitiativeClassificationAdvisor(classificationState, sessionAdvisor, true)
    }
    if (applicabilityState && sessionAdvisor && !sameAdvisor(applicabilityState.advisor, sessionAdvisor)) {
      applicabilityState = changeInitiativeApplicabilityAdvisor(applicabilityState, sessionAdvisor, true)
    }
    if (phase1AuthoringState && sessionAdvisor && !sameAdvisor(phase1AuthoringState.advisor, sessionAdvisor) &&
        !["committed", "cancelled"].includes(phase1AuthoringState.phase)) {
      phase1AuthoringState = { ...phase1AuthoringState, advisor: sessionAdvisor }
    }

    const proposeCanonicalRecord = async (
      target: NonNullable<Awaited<ReturnType<GaepProductChatOptions["nextPhase1AuthoringTarget"]>>>,
      advisor: ProductChatAdvisorSelection,
      instruction: string,
      previous?: ProductAnswerAssessment,
    ): Promise<{ assessment: ProductAnswerAssessment; draft: unknown } | undefined> => {
      let latestInstruction = instruction
      let previousAssessment = previous
      let lastErrors: string[] = []
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        response.progress(attempt === 1
          ? `Asking ${advisor.agentLabel} · ${advisor.modelLabel} to draft ${target.label}…`
          : `Repairing ${target.label} against the canonical contract (${attempt}/3)…`)
        let assessment: ProductAnswerAssessment
        try {
          assessment = await withChatCancellation(token, (signal) => options.challengeAnswer({
            advisor,
            question: {
              key: "phase1-canonical-record",
              title: target.label,
              prompt: [
                `Create the complete ${target.label} input object for Product Journey record ${target.ordinal}/${target.total}.`,
                "The JSON Schema and governed context are supplied below. proposedAnswer must decode to the input object itself, with no wrapper.",
                "Every human-readable value must be English. Missing knowledge must remain explicit and conservative.",
                "Act as an AI Product and engineering collaborator: infer the strongest useful candidate from all supplied governed context. Never return placeholders, internal-schema instructions, or ask the human to repeat facts already present.",
              ].join(" "),
            },
            acceptedAnswers: {
              target: { kind: target.kind, label: target.label, group: target.group },
              jsonSchema: target.schema,
              governedContext: target.context,
              ...(lastErrors.length > 0 ? { contractErrorsToRepair: lastErrors } : {}),
            },
            userAnswer: latestInstruction,
            ...(previousAssessment ? { previousAssessment: {
              proposedAnswer: previousAssessment.proposedAnswer,
              gaps: previousAssessment.gaps,
              ...(previousAssessment.followUpQuestion ? { followUpQuestion: previousAssessment.followUpQuestion } : {}),
            } } : {}),
          }, signal))
        } catch (error) {
          options.reportDiagnostic?.(`Product Journey ${target.label} advisory failed`, error)
          response.markdown(sourceAdvisorFailureMarkdown({
            advisorLabel: `${advisor.agentLabel} · ${advisor.modelLabel}`,
            error,
            priorReviewPreserved: Boolean(previous),
          }))
          response.button({ command: "gaep.selectProductChatAgent", title: "Switch Agent" })
          response.button({ command: "gaep.selectProductChatModel", title: "Switch Model" })
          response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
          return undefined
        }
        let draft: unknown
        try {
          draft = parseStructuredDraft(assessment.proposedAnswer)
        } catch (error) {
          lastErrors = [error instanceof Error ? error.message : "The proposed answer was not valid JSON"]
          previousAssessment = assessment
          latestInstruction = "Return the same candidate as one complete valid JSON object and repair the listed contract error."
          continue
        }
        const validation = await options.validatePhase1CanonicalDraft(target.kind, draft)
        if (validation.valid) return { assessment, draft: validation.value ?? draft }
        lastErrors = validation.errors
        previousAssessment = assessment
        latestInstruction = "Repair every listed contract error without weakening exact bindings or inventing facts. Return the full corrected object."
      }
      response.markdown([
        `# ${markdownValue(target.label)} needs another advisory pass`,
        "",
        "The selected advisor could not produce a contract-valid candidate after three bounded repair attempts. Nothing was persisted.",
        "",
        ...lastErrors.map((error) => `- ${markdownValue(error)}`),
      ].join("\n"))
      response.button({ command: "gaep.openInteractiveChat", title: "Retry Canonical Draft", arguments: ["author"] })
      response.button({ command: "gaep.selectProductChatAgent", title: "Switch Agent" })
      response.button({ command: "gaep.selectProductChatModel", title: "Switch Model" })
      return undefined
    }
    const proposeInitiativeClassification = async (
      current: InitiativeClassificationChatState,
      userAnswer: string,
    ): Promise<InitiativeClassificationChatState | undefined> => {
      try {
        const result = await assessInitiativeClassificationWithAutomaticRepair(
          current,
          userAnswer,
          async ({ attempt, contractErrors, previousAssessment }) => {
            response.progress(attempt === 1
              ? `Asking ${current.advisor.agentLabel} · ${current.advisor.modelLabel} to challenge and structure this Initiative classification…`
              : `GAEP is repairing the Initiative classification against its governed contract (${attempt}/3)…`)
            return withChatCancellation(token, (signal) => options.challengeAnswer({
              advisor: current.advisor,
              question: initiativeClassificationQuestion(current),
            acceptedAnswers: {
              product: current.product,
              initiative: current.initiative,
              ...(current.currentClassification ? { currentClassification: current.currentClassification } : {}),
                revisionBinding: {
                  initiativeRevision: current.initiativeRevision,
                  productRevision: current.productRevision,
                },
                ...(contractErrors.length > 0 ? { contractErrorsToRepair: contractErrors } : {}),
              },
              userAnswer: attempt === 1
                ? userAnswer
                : `${userAnswer}\n\nGAEP automatic format repair: preserve the human meaning and return the full corrected governed object. Do not ask the human to rewrite or format this brief.`,
              ...(previousAssessment ? { previousAssessment: {
                proposedAnswer: previousAssessment.proposedAnswer,
                gaps: previousAssessment.gaps,
                ...(previousAssessment.followUpQuestion
                  ? { followUpQuestion: previousAssessment.followUpQuestion }
                  : {}),
              } } : {}),
            }, signal))
          },
        )
        return result.state
      } catch (error) {
        options.reportDiagnostic?.("Initiative classification automatic normalization failed", error)
        response.markdown([
          "GAEP could not normalize the advisor response after three bounded repair attempts. Your natural-language brief is preserved and nothing was persisted.",
          "",
          "You do not need to rewrite it in GAEP's internal format. Retry the same brief or switch the agent/model.",
        ].join("\n"))
        response.button({ command: "gaep.openInteractiveChat", title: "Retry Classification", arguments: ["continue"] })
        response.button({ command: "gaep.selectProductChatAgent", title: "Switch Agent" })
        response.button({ command: "gaep.selectProductChatModel", title: "Switch Model" })
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
        return undefined
      }
    }
    if (command === "initiative") {
      const current = await options.currentInitiative()
      if (!current) {
        response.markdown("No current governed Initiative definition is available to revise. Use `@gaep /continue` to create it first.")
        return initiativeState ? initiativeMetadata(initiativeState) : undefined
      }
      const advisor = preferredProductChatAdvisor(
        options.currentAdvisor(),
        initiativeState?.advisor ?? classificationState?.advisor ?? applicabilityState?.advisor,
        state?.advisor,
      ) ?? await options.selectAdvisor()
      if (!advisor) {
        response.markdown("Initiative revision did not start because no executable Product advisor/model was selected.")
        return initiativeState ? initiativeMetadata(initiativeState) : undefined
      }
      initiativeState = startInitiativeRevision(advisor, current)
      const field = await options.selectInitiativeRevisionField()
      if (!field) {
        response.markdown(`${initiativeReviewMarkdown(initiativeState)}\n\nNo field was selected; the governed Initiative remains unchanged.`)
        return initiativeMetadata(initiativeState)
      }
      initiativeState = editInitiativeField(initiativeState, field)
      response.markdown(initiativeQuestionMarkdown(
        initiativeState,
        "Revise this Initiative field. GAEP will show downstream impact and will not change governed state before explicit acceptance and commit.",
      ))
      return initiativeMetadata(initiativeState)
    }
    if (command === "classification") {
      const product = await options.productState()
      const current = await options.currentInitiative()
      if (product.state !== "initialized" || !current?.classification) {
        response.markdown("No current governed Initiative classification is available to revise. Use `@gaep /continue` to create the missing checkpoint first.")
        return classificationState ? classificationMetadata(classificationState) : undefined
      }
      const advisor = preferredProductChatAdvisor(
        options.currentAdvisor(),
        classificationState?.advisor ?? applicabilityState?.advisor ?? initiativeState?.advisor,
        state?.advisor,
      ) ?? await options.selectAdvisor()
      if (!advisor) {
        response.markdown("Classification revision did not start because no executable Product advisor/model was selected.")
        return classificationState ? classificationMetadata(classificationState) : undefined
      }
      classificationState = startInitiativeClassificationChat(advisor, {
        initiativeId: current.id,
        initiativeRevision: current.revision,
        productRevision: product.revision,
        product: { name: product.name, profile: product.input.profile, summary: product.input.summary },
        initiative: {
          title: current.title,
          outcome: current.outcome,
          scope: [...current.scope],
          exclusions: [...current.exclusions],
        },
        currentClassification: current.classification,
      })
      response.markdown([
        "# Resolve Initiative classification attention",
        "",
        "The current classification is preserved as the starting point. Answer one or more open questions naturally, or use `/suggest` for bounded candidate resolutions. GAEP will produce a complete editable revision and will not persist it without explicit review, `/accept`, and `/commit CONFIRM`.",
        "",
        classificationQuestionMarkdown(classificationState),
      ].join("\n"))
      response.button({ command: "gaep.openInteractiveChat", title: "Generate Resolution Proposal", arguments: ["resolve"] })
      return classificationMetadata(classificationState)
    }
    if (command === "applicability") {
      const product = await options.productState()
      const current = await options.currentInitiative()
      const startingApplicability = current?.applicability ?? current?.priorApplicability
      if (product.state !== "initialized" || !current?.classification ||
          !current.applicabilityCatalog || !startingApplicability) {
        response.markdown("No current governed Initiative applicability matrix is available to revise. Use `@gaep /continue` to create the missing checkpoint first.")
        return applicabilityState ? applicabilityMetadata(applicabilityState) : undefined
      }
      const advisor = preferredProductChatAdvisor(
        options.currentAdvisor(),
        applicabilityState?.advisor ?? classificationState?.advisor ?? initiativeState?.advisor,
        state?.advisor,
      ) ?? await options.selectAdvisor()
      if (!advisor) {
        response.markdown("Applicability revision did not start because no executable Product advisor/model was selected.")
        return applicabilityState ? applicabilityMetadata(applicabilityState) : undefined
      }
      applicabilityState = startInitiativeApplicabilityChat(advisor, {
        initiativeId: current.id,
        initiativeRevision: current.revision,
        productRevision: product.revision,
        product: { name: product.name, profile: product.input.profile, summary: product.input.summary },
        initiative: {
          title: current.title,
          outcome: current.outcome,
          scope: [...current.scope],
          exclusions: [...current.exclusions],
        },
        classification: current.classification,
        catalog: current.applicabilityCatalog,
        currentApplicability: startingApplicability,
      })
      response.markdown([
        current.applicabilityStatus === "current"
          ? "# Resolve Initiative applicability attention"
          : "# Rebuild Initiative applicability for the current revision",
        "",
        current.applicabilityStatus === "current"
          ? "The current 49-subject matrix is preserved as the starting point. State the human decisions or corrections naturally. GAEP will revise only supported decisions and will not persist anything without `/accept` and `/commit CONFIRM`."
          : `The prior matrix is stale because the Initiative advanced to revision ${current.revision}. GAEP preserved it only as an editable starting point and will bind the rebuilt proposal to the current Classification. Nothing is persisted without \`/accept\` and \`/commit CONFIRM\`.`,
        "",
        applicabilityQuestionMarkdown(applicabilityState),
      ].join("\n"))
      response.button({ command: "gaep.openInteractiveChat", title: "Generate Resolution Proposal", arguments: ["resolve"] })
      return applicabilityMetadata(applicabilityState)
    }
    const proposeInitiativeApplicability = async (
      current: InitiativeApplicabilityChatState,
      userAnswer: string,
    ): Promise<InitiativeApplicabilityChatState | undefined> => {
      try {
        const result = await assessInitiativeApplicabilityWithAutomaticRepair(
          current,
          userAnswer,
          async ({ attempt, contractErrors, previousAssessment }) => {
            response.progress(attempt === 1
              ? `Asking ${current.advisor.agentLabel} · ${current.advisor.modelLabel} to challenge and resolve the canonical applicability catalog…`
              : `GAEP is repairing the 49-subject applicability matrix against its governed contract (${attempt}/3)…`)
            return withChatCancellation(token, (signal) => options.challengeAnswer({
              advisor: current.advisor,
              question: initiativeApplicabilityQuestion(current),
              acceptedAnswers: {
                ...applicabilityAdvisorContext(current),
                ...(contractErrors.length > 0 ? { contractErrorsToRepair: contractErrors } : {}),
              },
              userAnswer: attempt === 1
                ? userAnswer
                : `${userAnswer}\n\nGAEP automatic matrix repair: preserve the human meaning, standard candidate roles, and exact 49-subject coverage. Return the full corrected governed object. Do not ask the human to enumerate or format the catalog.`,
              ...(previousAssessment ? { previousAssessment: {
                proposedAnswer: previousAssessment.proposedAnswer,
                gaps: previousAssessment.gaps,
                ...(previousAssessment.followUpQuestion
                  ? { followUpQuestion: previousAssessment.followUpQuestion }
                  : {}),
              } } : {}),
            }, signal))
          },
        )
        return result.state
      } catch (error) {
        options.reportDiagnostic?.("Initiative applicability automatic normalization failed", error)
        const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined
        const providerDidNotComplete = code === "provider-unavailable" || code === "provider-failed"
        const cancelled = code === "cancelled"
        response.markdown(cancelled
          ? "The applicability advisory turn was cancelled. Your brief is preserved and nothing was persisted."
          : providerDidNotComplete
            ? [
                "The selected advisor did not complete the applicability turn, so GAEP received no matrix to validate or repair. Your natural-language brief is preserved and nothing was persisted.",
                "",
                `Reason: ${markdownValue(error instanceof Error ? error.message : "The provider did not complete the governed turn.")}`,
                "",
                "You do not need to enumerate the catalog or write GAEP's internal format. Retry the same brief or switch the agent/model.",
              ].join("\n")
            : [
                "GAEP could not normalize the advisor response into an exact 49-subject applicability matrix after three bounded repair attempts. Your natural-language brief is preserved and nothing was persisted.",
                "",
                "You do not need to enumerate the catalog or write GAEP's internal format. Retry the same brief or switch the agent/model.",
              ].join("\n"))
        response.button({ command: "gaep.openInteractiveChat", title: "Retry Applicability", arguments: ["continue"] })
        response.button({ command: "gaep.selectProductChatAgent", title: "Switch Agent" })
        response.button({ command: "gaep.selectProductChatModel", title: "Switch Model" })
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
        return undefined
      }
    }
    const withAvailableCandidateDocumentContent = <T extends NonNullable<Awaited<ReturnType<GaepProductChatOptions["nextPhase1AuthoringTarget"]>>>>(
      target: T,
    ): T => {
      const batch = sourceAlignmentState?.cacheKey ? sourceReviewCache.get(sourceAlignmentState.cacheKey) : undefined
      if (!batch) return target
      return {
        ...target,
        context: {
          ...target.context,
          candidateDocumentContent: attachmentAlignmentInput(batch),
          candidateDocumentBoundary: "review-cache-only-non-authoritative-content-not-portable-product-truth",
        },
      }
    }

    const sourceReviewActive = Boolean(sourceAlignmentState && !["accepted", "cancelled"].includes(sourceAlignmentState.phase))
    const alignmentActive = Boolean(sourceReviewActive && sourceAlignmentState?.purpose !== "understanding")
    const understandingActive = Boolean(sourceReviewActive && sourceAlignmentState?.purpose === "understanding")
    const canonicalAuthoringActive = Boolean(phase1AuthoringState &&
      !["committed", "cancelled"].includes(phase1AuthoringState.phase))

    if (canonicalAuthoringActive && phase1AuthoringState) {
      const currentDraft = phase1AuthoringState
      if (command === "cancel") {
        phase1AuthoringState = { ...currentDraft, phase: "cancelled" }
        response.markdown("The Product Journey candidate was discarded. No governed record changed.")
        return phase1AuthoringMetadata(phase1AuthoringState)
      }
      if (command === "continue" || command === "author") {
        response.markdown(phase1AuthoringMarkdown(currentDraft))
        return phase1AuthoringMetadata(currentDraft)
      }
      if (command === "back") {
        phase1AuthoringState = { ...currentDraft, phase: "proposal" }
        response.markdown(phase1AuthoringMarkdown(phase1AuthoringState))
        return phase1AuthoringMetadata(phase1AuthoringState)
      }
      if (command === "accept") {
        phase1AuthoringState = { ...currentDraft, phase: "review" }
        response.markdown(phase1AuthoringMarkdown(phase1AuthoringState))
        return phase1AuthoringMetadata(phase1AuthoringState)
      }
      if (command === "commit") {
        if (request.prompt.trim() !== "CONFIRM") {
          response.markdown("Commit was not performed. Send exactly **`@gaep /commit CONFIRM`**.")
          return phase1AuthoringMetadata(currentDraft)
        }
        response.progress(`Validating and recording the exact ${currentDraft.target.label} candidate…`)
        try {
          const result = await options.commitPhase1CanonicalDraft(
            currentDraft.target.kind,
            currentDraft.draft,
            currentDraft.target.current
              ? { id: currentDraft.target.current.id, expectedRevision: currentDraft.target.current.revision }
              : undefined,
          )
          phase1AuthoringState = { ...currentDraft, phase: "committed" }
          response.markdown([
            `# ${markdownValue(result.label)} recorded`,
            "",
            `Candidate record **${result.id}** was **${result.operation}** at revision **${result.revision}** and is now governed local Product state.`,
            "",
            "The record remains candidate evidence and grants no approval, appointment, baseline designation, readiness, implementation, release, or action authority.",
            "",
            "Continue to the next Product Journey record.",
          ].join("\n"))
          response.button({ command: "gaep.openInteractiveChat", title: "Continue Product Journey", arguments: ["author"] })
          response.button({ command: "gaep.openInteractiveChat", title: "Review This Record", arguments: ["author", `review:${result.kind}`] })
          response.button({ command: "gaep.openProductStudio", title: "Open Product Journey", arguments: ["overview"] })
        } catch (error) {
          options.reportDiagnostic?.(`Product Journey ${currentDraft.target.label} commit failed`, error)
          response.markdown([
            `# ${markdownValue(currentDraft.target.label)} was not recorded`,
            "",
            "The Engine rejected the candidate during exact current-state validation. No partial record was persisted.",
            "",
            `Diagnostic: ${markdownValue(error instanceof Error ? error.message : "Unknown validation failure")}`,
            "",
            "Use **`@gaep /back`** and reply with a correction, or retry with a fresh candidate.",
          ].join("\n"))
          response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
          return phase1AuthoringMetadata(currentDraft)
        }
        return phase1AuthoringMetadata(phase1AuthoringState)
      }
      if (command === "agent" || command === "model" || command === "advisor") {
        const advisor = await selectProductChatAdvisorForCommand(command, currentDraft.advisor, {
          advisor: options.selectAdvisor,
          agent: options.selectAgent,
          model: options.selectModel,
        })
        if (!advisor) {
          response.markdown("Agent/model selection was cancelled. The current Product Journey draft was preserved.")
          return phase1AuthoringMetadata(currentDraft)
        }
        phase1AuthoringState = { ...currentDraft, advisor }
        response.markdown([
          `Product Journey advisor changed to **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}**.`,
          "",
          "The existing candidate remains unchanged. Reply with corrections to request a new round from this advisor.",
        ].join("\n"))
        return phase1AuthoringMetadata(phase1AuthoringState)
      }
      if (!command && request.prompt.trim()) {
        const rawTarget = await options.nextPhase1AuthoringTarget(currentDraft.initiativeId, currentDraft.target.kind)
        const target = rawTarget ? withAvailableCandidateDocumentContent(rawTarget) : undefined
        if (!target || target.kind !== currentDraft.target.kind) {
          response.markdown("The exact upstream record state changed. The draft was preserved but cannot be revised against stale bindings. Use **`@gaep /cancel`**, then **`@gaep /author`**.")
          return phase1AuthoringMetadata(currentDraft)
        }
        const proposed = await proposeCanonicalRecord(
          target,
          currentDraft.advisor,
          `Human correction request:\n${request.prompt.trim()}\n\nRevise the complete prior candidate accordingly.`,
          currentDraft.assessment,
        )
        if (!proposed) return phase1AuthoringMetadata(currentDraft)
        phase1AuthoringState = {
          ...currentDraft,
          phase: "proposal",
          assessment: proposed.assessment,
          draft: proposed.draft,
          round: currentDraft.round + 1,
        }
        response.markdown(phase1AuthoringMarkdown(phase1AuthoringState))
        return phase1AuthoringMetadata(phase1AuthoringState)
      }
    }

    if (command === "author") {
      const current = await options.currentInitiative()
      if (!current || current.applicabilityStatus !== "current") {
        response.markdown("Product Journey authoring requires a current governed Initiative and applicability matrix. Use **`@gaep /continue`** first.")
        return
      }
      const source = await options.sourceCheckpoint(current.id)
      if (!source.baseline || source.baseline.status !== "current" || source.provenanceCount === 0) {
        response.markdown("Product Journey authoring requires a current Candidate Source Baseline and Source Provenance. Use **`@gaep /continue`** to finish the source foundation.")
        return
      }
      const authorPrompt = request.prompt.trim()
      const requested = authorPrompt.match(/^(?:edit|review):([a-z0-9-]+)$/u)
      const requestedKind = requested?.[1] && phase1CanonicalRecordKinds.includes(requested[1] as Phase1CanonicalRecordKind)
        ? requested[1] as Phase1CanonicalRecordKind
        : undefined
      const reviewOnly = authorPrompt.startsWith("review:")
      const rawTarget = await options.nextPhase1AuthoringTarget(current.id, requestedKind)
      const target = rawTarget ? withAvailableCandidateDocumentContent(rawTarget) : undefined
      if (!target) {
        response.markdown([
          "# Product Journey record set is complete",
          "",
          "All required Product Journey record families are present, including the pre-design readiness assessment and design handoff package. Open Product Journey and inspect the exact recorded state before continuing to design.",
        ].join("\n"))
        response.button({ command: "gaep.openProductStudio", title: "Review Design Handoff", arguments: ["readiness"] })
        return
      }
      if (reviewOnly && target.current) {
        response.markdown([
          `# ${markdownValue(target.label)} — governed record review`,
          "",
          `Current revision: **${target.current.revision}** · immutable history: **${target.current.history.length} revision(s)**`,
          "",
          phase1CanonicalPresentation({ kind: target.kind, label: target.label, draft: target.current.record }),
          ...(target.downstream.filter((entry) => entry.recorded).length > 0 ? [
            "",
            "## Recorded downstream dependencies",
            "",
            ...target.downstream.filter((entry) => entry.recorded).map((entry) => `- ${markdownValue(entry.label)}`),
          ] : []),
        ].join("\n"))
        response.button({ command: "gaep.openInteractiveChat", title: `Edit ${target.label}`, arguments: ["author", `edit:${target.kind}`, true] })
        response.button({ command: "gaep.openProductStudio", title: "Back to Product Journey", arguments: ["overview"] })
        return
      }
      const advisor = options.currentAdvisor() ?? await options.selectAdvisor()
      if (!advisor) {
        response.markdown("Product Journey authoring did not start because no executable Codex or Claude Code advisor/model was selected.")
        return
      }
      const proposed = await proposeCanonicalRecord(
        target,
        advisor,
        requestedKind
          ? `Revise the current ${target.label} using the governed Product, Initiative, Sources, current record, revision history, and upstream records. Preserve valid facts, improve weaknesses, and identify downstream realignment. Do not ask the human to rewrite internal structures.`
          : authorPrompt || "Generate the strongest conservative candidate supported by the governed Product, Initiative, Sources, and exact upstream records.",
      )
      if (!proposed) return
      phase1AuthoringState = {
        schemaVersion: 1,
        phase: "proposal",
        initiativeId: current.id,
        target: {
          kind: target.kind,
          label: target.label,
          group: target.group,
          ordinal: target.ordinal,
          total: target.total,
          operation: target.operation,
          ...(target.current ? {
            current: { id: target.current.id, revision: target.current.revision, historyCount: target.current.history.length },
          } : {}),
          downstreamRecorded: target.downstream.filter((entry) => entry.recorded).map((entry) => ({ kind: entry.kind, label: entry.label })),
        },
        advisor,
        assessment: proposed.assessment,
        draft: proposed.draft,
        round: 1,
        authorityBoundary: "phase1-authoring-draft-is-advisory-until-explicit-review-and-commit",
      }
      response.markdown(phase1AuthoringMarkdown(phase1AuthoringState))
      response.button({ command: "gaep.openInteractiveChat", title: `Review and Record ${target.label}`, arguments: ["commit", "CONFIRM"] })
      return phase1AuthoringMetadata(phase1AuthoringState)
    }
    if (command === "intake") {
      const product = await options.productState()
      const current = await options.currentInitiative()
      if (product.state !== "initialized" || !current || current.applicabilityStatus !== "current") {
        response.markdown("Source Intake requires an initialized Product and a current Initiative applicability matrix. Use **`@gaep /continue`** first.")
        return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
      }
      if (discoveredAttachments.rootCount === 0) {
        response.markdown([
          "# Attach existing Product documents",
          "",
          "Select **Choose File** or **Choose Folder** to browse any accessible location on your computer, or use the native Add Context menu. Then send **`@gaep /intake`** followed by what you want GAEP to do with the content.",
          "",
          "This checkpoint accepts bounded UTF-8 text documents plus DOCX and XLSX. Office content is extracted as safe text: formulas are never executed, and macros, embedded objects, external links, and visual-only content are not imported. PDF remains unsupported.",
          "",
          "Attachments remain non-authoritative candidates until you review and explicitly record them.",
        ].join("\n"))
        response.button({ command: "gaep.chooseFile", title: "Choose File" })
        response.button({ command: "gaep.chooseFolder", title: "Choose Folder" })
        return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
      }
      response.progress("Reading explicitly attached candidate documents within GAEP limits…")
      const batch = await readProductChatAttachments(referencedResources)
      batch.rejected.unshift(...discoveredAttachments.rejected)
      if (batch.candidates.length === 0) {
        response.markdown([
          "No attachment could enter the document review.",
          "",
          ...batch.rejected.map((candidate) => `- **${markdownValue(candidate.label)}** · ${candidate.reason}`),
          "",
          "No Product state changed.",
        ].join("\n"))
        return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
      }
      const advisor = preferredProductChatAdvisor(
        options.currentAdvisor(),
        sourceAlignmentState?.advisor ?? applicabilityState?.advisor ?? classificationState?.advisor ?? initiativeState?.advisor,
        state?.advisor,
      ) ?? await options.selectAdvisor()
      if (!advisor) {
        response.markdown("Source alignment did not start because no executable Codex or Claude Code advisor/model was selected.")
        return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
      }
      const task = sourceUnderstandingInstruction(request.prompt)
      const cacheKey = cacheSourceBatch(batch)
      response.progress(`Asking ${advisor.agentLabel} · ${advisor.modelLabel} to work directly with the attached content…`)
      let assessment: ProductAnswerAssessment
      try {
        assessment = await withChatCancellation(token, (signal) => options.challengeAnswer({
          advisor,
          question: {
            key: "source-understanding",
            title: "Understand attached Product documents",
            prompt: task,
          },
          acceptedAnswers: {
            productRevision: product.revision,
            initiative: { id: current.id, revision: current.revision, title: current.title },
            sourceMetadata: portableAttachmentMetadata(batch),
          },
          userAnswer: attachmentAlignmentInput(batch),
        }, signal))
      } catch (error) {
        options.reportDiagnostic?.("Attachment understanding failed", error)
        response.markdown(sourceAdvisorFailureMarkdown({
          advisorLabel: `${advisor.agentLabel} · ${advisor.modelLabel}`,
          error,
          priorReviewPreserved: Boolean(sourceAlignmentState?.purpose === "understanding"),
        }))
        response.button({ command: "gaep.selectProductChatAgent", title: "Switch Agent" })
        response.button({ command: "gaep.selectProductChatModel", title: "Switch Model" })
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
        return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
      }
      sourceAlignmentState = {
        schemaVersion: 1,
        phase: "proposal",
        productRevision: product.revision,
        initiative: { id: current.id, revision: current.revision, title: current.title },
        advisor,
        sources: portableAttachmentMetadata(batch),
        rejected: batch.rejected,
        assessment,
        round: 1,
        purpose: "understanding",
        cacheKey,
        task,
        authorityBoundary: "source-alignment-preview-is-advisory-and-does-not-create-sources-baselines-provenance-or-lifecycle-authority",
      }
      response.markdown(sourceUnderstandingMarkdown(sourceAlignmentState))
      response.button({ command: "gaep.openInteractiveChat", title: "Review Candidate Files", arguments: ["manifest"] })
      response.button({ command: "gaep.openInteractiveChat", title: "Create Alignment Preview", arguments: ["align"] })
      response.button({ command: "gaep.openInteractiveChat", title: "Record Candidate Sources", arguments: ["record"] })
      return sourceAlignmentMetadata(sourceAlignmentState)
    }
    if (command === "align") {
      const cacheKey = sourceAlignmentState?.cacheKey
      if (!sourceAlignmentState || sourceAlignmentState.purpose !== "understanding" || !cacheKey) {
        response.markdown("Attach the intended Product documents and use **`@gaep /intake`** first. GAEP needs the exact reviewed content before it can create an alignment preview.")
        return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
      }
      const reviewed = sourceAlignmentState
      const batch = sourceReviewCache.get(cacheKey)
      if (!batch) {
        response.markdown("The machine-local attachment review cache is no longer available. Reattach the documents with **`@gaep /intake`**; raw attachment content is intentionally not stored in portable Chat state.")
        return sourceAlignmentMetadata(reviewed)
      }
      const advisor = options.currentAdvisor() ?? reviewed.advisor
      response.progress(`Asking ${advisor.agentLabel} · ${advisor.modelLabel} to create a separate evidence-bounded GAEP alignment…`)
      let assessment: ProductAnswerAssessment
      try {
        assessment = await withChatCancellation(token, (signal) => options.challengeAnswer({
          advisor,
          question: {
            key: "source-alignment",
            title: "Existing Product document alignment",
            prompt: [
              "Map the candidate documents to Product Definition, Initiative Definition, Classification, Applicability, Source Intake, Source Baseline, and Source Provenance.",
              "For every checkpoint report content alignment separately as supported, partially-supported, conflicting, or unsupported, then report authority state separately as candidate, reviewed, or baselined.",
              "Candidate authority must never downgrade otherwise-supported content. Cite only candidate source labels and content digests, identify missing evidence, and propose exactly one next checkpoint.",
              "Return an editable concise alignment proposal with exactly seven newline rows and no preamble inside proposedAnswer. Use this exact row shape: <Checkpoint>: <supported|partially-supported|conflicting|unsupported> (authority: <candidate|reviewed|baselined>) — <concise evidence, conflict, and missing evidence>. The checkpoint order must be Product Definition, Initiative Definition, Classification, Applicability, Source Intake, Source Baseline, Source Provenance. After those rows add exactly one Next checkpoint line.",
              "Never claim a source is authoritative or that a GAEP checkpoint is complete merely because a document mentions it.",
            ].join(" "),
          },
          acceptedAnswers: {
            productRevision: reviewed.productRevision,
            initiative: reviewed.initiative,
            sourceMetadata: portableAttachmentMetadata(batch),
          },
          userAnswer: attachmentAlignmentInput(batch),
        }, signal))
      } catch (error) {
        options.reportDiagnostic?.("Attachment alignment failed", error)
        response.markdown(sourceAdvisorFailureMarkdown({
          advisorLabel: `${advisor.agentLabel} · ${advisor.modelLabel}`,
          error,
          priorReviewPreserved: true,
          operation: "alignment",
        }))
        response.button({ command: "gaep.selectProductChatAgent", title: "Switch Agent" })
        response.button({ command: "gaep.selectProductChatModel", title: "Switch Model" })
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
        return sourceAlignmentMetadata(reviewed)
      }
      sourceAlignmentState = {
        ...reviewed,
        phase: "proposal",
        purpose: "alignment",
        advisor,
        assessment,
        round: 1,
      }
      response.markdown(sourceAlignmentMarkdown(sourceAlignmentState))
      response.button({ command: "gaep.openInteractiveChat", title: "Review Candidate Files", arguments: ["manifest"] })
      response.button({ command: "gaep.openInteractiveChat", title: "Record Candidate Sources", arguments: ["record"] })
      return sourceAlignmentMetadata(sourceAlignmentState)
    }
    if (command === "manifest") {
      if (!sourceAlignmentState || sourceAlignmentState.phase === "cancelled") {
        response.markdown("No active attachment review is available. Attach the intended documents and use **`@gaep /intake`** first.")
        return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
      }
      response.markdown(sourceManifestMarkdown(sourceAlignmentState))
      if (sourceAlignmentState.purpose === "understanding") {
        response.button({ command: "gaep.openInteractiveChat", title: "Create Alignment Preview", arguments: ["align"] })
      }
      response.button({ command: "gaep.openInteractiveChat", title: "Record Candidate Sources", arguments: ["record"] })
      return sourceAlignmentMetadata(sourceAlignmentState)
    }
    if (command === "record") {
      if (!sourceAlignmentState || sourceAlignmentState.phase === "cancelled" || !sourceAlignmentState.cacheKey) {
        response.markdown("Review the intended attachments with **`@gaep /intake`** first. GAEP records only the exact files from the active attachment review.")
        return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
      }
      const batch = sourceReviewCache.get(sourceAlignmentState.cacheKey)
      if (!batch) {
        response.markdown("The machine-local attachment review cache is no longer available. Reattach the documents with **`@gaep /intake`** before recording them.")
        return sourceAlignmentMetadata(sourceAlignmentState)
      }
      response.progress("Recording the exact reviewed files as non-authoritative candidate Sources…")
      try {
        const result = await options.recordCandidateSources({
          initiativeId: sourceAlignmentState.initiative.id,
          sources: portableAttachmentMetadata(batch),
        })
        response.markdown(recordedCandidateSourcesMarkdown(result))
        response.button({ command: "gaep.openInteractiveChat", title: "Continue Product Journey", arguments: ["continue"] })
      } catch (error) {
        options.reportDiagnostic?.("Candidate Source recording failed", error)
        response.markdown("# Candidate Source recording failed\n\nNo Source was recorded. The current attachment review remains available; inspect Diagnostics and retry **`@gaep /record`**.\n\n> No Baseline, Provenance, approval, readiness, implementation, or release authority was created.")
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
      }
      return sourceAlignmentMetadata(sourceAlignmentState)
    }
    if (command === "baseline") {
      const current = await options.currentInitiative()
      if (!current || current.applicabilityStatus !== "current") {
        response.markdown("A Candidate Source Baseline requires a current Initiative and applicability matrix. Use **`@gaep /continue`** first.")
        return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
      }
      const checkpoint = await options.sourceCheckpoint(current.id)
      if (checkpoint.sourceCount === 0) {
        response.markdown("No recorded candidate Source is available. Review attachments with **`@gaep /intake`**, then use **`@gaep /record`** first.")
        return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
      }
      response.progress("Recording the exact current Source revisions as a candidate Baseline…")
      try {
        const result = await options.createCandidateSourceBaseline(current.id)
        response.markdown([
          "# Candidate Source Baseline recorded",
          "",
          `**${result.memberCount} exact Source revision(s)** · Baseline revision **${result.revision}**${result.reused ? " · existing exact Baseline reused" : ""}`,
          "",
          `Membership digest: \`${markdownValue(result.membershipDigest)}\``,
          "",
          "> This is a candidate snapshot only. It does not approve, designate, validate, authorize, or supersede any Source.",
          "",
          "Next: record exact Source Provenance for the current Initiative.",
        ].join("\n"))
        response.button({ command: "gaep.openInteractiveChat", title: "Record Source Provenance", arguments: ["provenance"] })
      } catch (error) {
        options.reportDiagnostic?.("Candidate Source Baseline recording failed", error)
        response.markdown("# Candidate Source Baseline failed\n\nNo Baseline was recorded. Inspect Diagnostics and retry **`@gaep /baseline`**.")
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
      }
      return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
    }
    if (command === "provenance") {
      const current = await options.currentInitiative()
      if (!current || current.applicabilityStatus !== "current") {
        response.markdown("Source Provenance requires a current Initiative and applicability matrix. Use **`@gaep /continue`** first.")
        return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
      }
      const checkpoint = await options.sourceCheckpoint(current.id)
      if (!checkpoint.baseline || checkpoint.baseline.status !== "current") {
        response.markdown("Record a current Candidate Source Baseline with **`@gaep /baseline`** before Source Provenance.")
        return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
      }
      response.progress("Recording exact conservative Source-to-Initiative lineage…")
      try {
        const result = await options.recordInitiativeSourceProvenance(current.id)
        response.markdown([
          "# Source Provenance recorded",
          "",
          `**${result.sourceCount} exact Source revision(s)** linked to Initiative revision **${result.targetRevision}**${result.reused ? " · existing exact Provenance reused" : ""}.`,
          "",
          "Disposition remains **unknown** until claim-level review. No content truth, Source authority, approval, readiness, implementation, or release authority was inferred.",
          "",
          "Next: continue to Product planning.",
        ].join("\n"))
        response.button({ command: "gaep.openInteractiveChat", title: "Continue Product Journey", arguments: ["continue"] })
      } catch (error) {
        options.reportDiagnostic?.("Source Provenance recording failed", error)
        response.markdown("# Source Provenance failed\n\nNo Provenance was recorded. Inspect Diagnostics and retry **`@gaep /provenance`**.")
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
      }
      return sourceAlignmentState ? sourceAlignmentMetadata(sourceAlignmentState) : undefined
    }
    if (understandingActive && sourceAlignmentState) {
      const currentReview = sourceAlignmentState
      if (command === "cancel") {
        sourceAlignmentState = { ...currentReview, phase: "cancelled" }
        response.markdown("The attachment review was closed. No governed Product state changed.")
        return sourceAlignmentMetadata(sourceAlignmentState)
      }
      if (command === "accept") {
        response.markdown("Attachment understanding does not need acceptance and creates no governed state. Ask another question about the files, or use **`@gaep /align`** for an editable lifecycle alignment preview.")
        return sourceAlignmentMetadata(currentReview)
      }
      if (!command && request.prompt.trim()) {
        const batch = currentReview.cacheKey ? sourceReviewCache.get(currentReview.cacheKey) : undefined
        if (!batch) {
          response.markdown("The attachment content is no longer available in the machine-local review cache. Reattach it with **`@gaep /intake`** to continue.")
          return sourceAlignmentMetadata(currentReview)
        }
        const advisor = options.currentAdvisor() ?? currentReview.advisor
        const task = sourceUnderstandingInstruction(request.prompt)
        response.progress(`Asking ${advisor.agentLabel} · ${advisor.modelLabel} to answer from the attached content…`)
        let assessment: ProductAnswerAssessment
        try {
          assessment = await withChatCancellation(token, (signal) => options.challengeAnswer({
            advisor,
            question: { key: "source-understanding", title: "Understand attached Product documents", prompt: task },
            acceptedAnswers: {
              productRevision: currentReview.productRevision,
              initiative: currentReview.initiative,
              sourceMetadata: portableAttachmentMetadata(batch),
            },
            userAnswer: attachmentAlignmentInput(batch),
            previousAssessment: {
              proposedAnswer: currentReview.assessment.proposedAnswer,
              gaps: currentReview.assessment.gaps,
              ...(currentReview.assessment.followUpQuestion
                ? { followUpQuestion: currentReview.assessment.followUpQuestion }
                : {}),
            },
          }, signal))
        } catch (error) {
          options.reportDiagnostic?.("Attachment follow-up failed", error)
          response.markdown(sourceAdvisorFailureMarkdown({
            advisorLabel: `${advisor.agentLabel} · ${advisor.modelLabel}`,
            error,
            priorReviewPreserved: true,
          }))
          response.button({ command: "gaep.selectProductChatAgent", title: "Switch Agent" })
          response.button({ command: "gaep.selectProductChatModel", title: "Switch Model" })
          response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
          return sourceAlignmentMetadata(currentReview)
        }
        sourceAlignmentState = {
          ...currentReview,
          advisor,
          task,
          assessment,
          round: currentReview.round + 1,
        }
        response.markdown(sourceUnderstandingMarkdown(sourceAlignmentState))
        response.button({ command: "gaep.openInteractiveChat", title: "Review Candidate Files", arguments: ["manifest"] })
        response.button({ command: "gaep.openInteractiveChat", title: "Create Alignment Preview", arguments: ["align"] })
        response.button({ command: "gaep.openInteractiveChat", title: "Record Candidate Sources", arguments: ["record"] })
        return sourceAlignmentMetadata(sourceAlignmentState)
      }
    }
    if (alignmentActive && sourceAlignmentState) {
      if (command === "cancel") {
        sourceAlignmentState = { ...sourceAlignmentState, phase: "cancelled" }
        response.markdown("The Source alignment preview was discarded. No governed Product state changed.")
        return sourceAlignmentMetadata(sourceAlignmentState)
      }
      if (command === "accept") {
        sourceAlignmentState = { ...sourceAlignmentState, phase: "accepted" }
        response.markdown(sourceAlignmentMarkdown(sourceAlignmentState))
        response.button({ command: "gaep.openInteractiveChat", title: "Review Candidate Files", arguments: ["manifest"] })
        response.button({ command: "gaep.openInteractiveChat", title: "Record Candidate Sources", arguments: ["record"] })
        return sourceAlignmentMetadata(sourceAlignmentState)
      }
      if (!command && request.prompt.trim()) {
        const currentAlignment = sourceAlignmentState
        const advisor = options.currentAdvisor() ?? currentAlignment.advisor
        response.progress(`Asking ${advisor.agentLabel} · ${advisor.modelLabel} to revise the alignment preview…`)
        const assessment = await withChatCancellation(token, (signal) => options.challengeAnswer({
          advisor,
          question: {
            key: "source-alignment",
            title: "Existing Product document alignment",
            prompt: "Revise the existing GAEP alignment proposal using the human correction. Preserve source labels, digests, explicit uncertainty, and the no-authority boundary. Inside proposedAnswer return exactly seven newline rows in checkpoint order using <Checkpoint>: <supported|partially-supported|conflicting|unsupported> (authority: <candidate|reviewed|baselined>) — <concise evidence, conflict, and missing evidence>, followed by exactly one Next checkpoint line.",
          },
          acceptedAnswers: {
            productRevision: currentAlignment.productRevision,
            initiative: currentAlignment.initiative,
            sourceMetadata: currentAlignment.sources,
          },
          userAnswer: request.prompt,
          previousAssessment: {
            proposedAnswer: currentAlignment.assessment.proposedAnswer,
            gaps: currentAlignment.assessment.gaps,
            ...(currentAlignment.assessment.followUpQuestion
              ? { followUpQuestion: currentAlignment.assessment.followUpQuestion }
              : {}),
          },
        }, signal))
        sourceAlignmentState = { ...currentAlignment, advisor, assessment, round: currentAlignment.round + 1 }
        response.markdown(sourceAlignmentMarkdown(sourceAlignmentState))
        response.button({ command: "gaep.openInteractiveChat", title: "Review Candidate Files", arguments: ["manifest"] })
        return sourceAlignmentMetadata(sourceAlignmentState)
      }
    }

    if (command === "help") {
      response.markdown(helpMarkdown())
      return applicabilityState ? applicabilityMetadata(applicabilityState)
        : classificationState ? classificationMetadata(classificationState)
        : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
    }
    if (command === "adopt") {
      const product = await options.productState()
      if (product.state === "initialized") {
        response.markdown([
          `This workspace already contains **${markdownValue(product.name)}** at revision **${product.revision}**.`,
          "",
          "Existing documents can still be attached through `/intake` and compared through `/align`. GAEP will not replace a governed Product through fast-start; use `/revise` for an audited change.",
        ].join("\n"))
        response.button({ command: "gaep.openInteractiveChat", title: "Review Existing Documents", arguments: ["intake"] })
        response.button({ command: "gaep.openInteractiveChat", title: "Revise Product", arguments: ["revise"] })
        return state ? metadata(state) : undefined
      }
      if (product.state === "partial") {
        response.markdown("Fast-start is disabled because partial `.gaep` state already exists. Review diagnostics before creating or revising Product truth.")
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
        return { errorDetails: { message: "Partial GAEP state requires diagnosis" } }
      }
      if (referencedResources.length === 0) {
        response.markdown([
          "# Adopt an existing Product",
          "",
          "Choose one or more Product files, or a folder containing the current Product documents. GAEP will read supported content, propose the Product Definition, assess all Product Journey checkpoints, and stop at an editable review before creating `.gaep`.",
          "",
          "> Documents remain non-authoritative candidates. Fast-start does not silently create Source, Baseline, approval, implementation, or release authority.",
        ].join("\n"))
        response.button({ command: "gaep.chooseFolder", title: "Choose Product Folder", arguments: ["adopt"] })
        response.button({ command: "gaep.chooseFile", title: "Choose Product Files", arguments: ["adopt"] })
        return
      }
      const batch = await readProductChatAttachments(referencedResources)
      if (batch.candidates.length === 0) {
        const rejectionSummary = batch.rejected.length > 0
          ? markdownTable(["Candidate", "Reason"], batch.rejected.map((item) => [item.label, item.reason]))
          : "No readable candidate was discovered."
        response.markdown([
          "# Existing Product fast-start could not read a supported candidate",
          "",
          rejectionSummary,
          "",
          "Choose a supported text, JSON, Markdown, DOCX, or XLSX source and retry `/adopt`.",
        ].join("\n"))
        return { errorDetails: { message: "No supported existing Product document was available" } }
      }
      const advisor = preferredProductChatAdvisor(options.currentAdvisor(), undefined, state?.advisor) ?? await options.selectAdvisor()
      if (!advisor) {
        response.markdown("Existing Product fast-start did not begin because no executable Codex or Claude Code advisor/model was selected.")
        return state ? metadata(state) : undefined
      }
      let previousAssessment: ProductAnswerAssessment | undefined
      let contractErrors: string[] = []
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        response.progress(attempt === 1
          ? `Analyzing ${batch.candidates.length} existing Product document(s) with ${advisor.agentLabel} · ${advisor.modelLabel}…`
          : `Repairing the Product Definition and Journey proposal against the GAEP contract (${attempt}/3)…`)
        try {
          const assessment = await withChatCancellation(token, (signal) => options.challengeAnswer({
            advisor,
            question: {
              key: "existing-product-fast-start",
              title: "Existing Product fast-start",
              prompt: [
                "Analyze the supplied existing Product documents and return one conservative, reviewable GAEP Product Definition.",
                "Inside proposedAnswer return only one JSON object with exactly these keys: name, summary, problem, affectedUsers, desiredOutcome, successSignals, firstWorkflow, exclusions, profile.",
                "successSignals and exclusions must be arrays of separate complete strings. Every other value must be a string.",
                `profile must be exactly one of: ${productProfiles.join(", ")}.`,
                "Use only supported document evidence. Where evidence is incomplete, write an explicit candidate statement for human review; never invent approval, authority, completion, or implementation status.",
              ].join(" "),
            },
            acceptedAnswers: {
              candidateDocuments: attachmentAlignmentInput(batch),
              candidateMetadata: portableAttachmentMetadata(batch),
              requestedHumanIntent: request.prompt.trim() || "Align this existing Product with GAEP and propose the complete Product Definition.",
              ...(contractErrors.length > 0 ? { contractErrorsToRepair: contractErrors } : {}),
            },
            userAnswer: attempt === 1
              ? "Create the most evidence-backed Product Definition and preserve uncertainty explicitly."
              : "Repair every listed contract error and return the complete JSON object without a wrapper.",
            ...(previousAssessment ? { previousAssessment: {
              proposedAnswer: previousAssessment.proposedAnswer,
              gaps: previousAssessment.gaps,
              ...(previousAssessment.followUpQuestion ? { followUpQuestion: previousAssessment.followUpQuestion } : {}),
            } } : {}),
          }, signal))
          previousAssessment = assessment
          const input = existingProductInitializationInput(parseStructuredDraft(assessment.proposedAnswer))
          let coverageAssessment: ProductAnswerAssessment | undefined
          let journeyCoverage: ExistingProductJourneyCoverage[] | undefined
          let coverageErrors: string[] = []
          for (let coverageAttempt = 1; coverageAttempt <= 3; coverageAttempt += 1) {
            response.progress(coverageAttempt === 1
              ? "Mapping candidate evidence across the complete Product Journey…"
              : `Repairing Product Journey coverage (${coverageAttempt}/3)…`)
            try {
              coverageAssessment = await withChatCancellation(token, (signal) => options.challengeAnswer({
                advisor,
                question: {
                  key: "existing-product-journey-coverage",
                  title: "Existing Product Journey coverage",
                  prompt: [
                    "Assess how far the supplied existing Product evidence can accelerate GAEP's complete Product Journey.",
                    "Inside proposedAnswer return only one JSON object with key checkpoints.",
                    `checkpoints must contain exactly these IDs once each: ${existingProductJourneyCheckpointIds.join(", ")}.`,
                    "Every row must contain checkpoint, coverage, evidence, candidateProposal, and missingDecisions.",
                    "coverage must be exactly ready-to-propose, partially-supported, unsupported, or requires-governed-prerequisite.",
                    "Use candidate evidence only. Do not claim any checkpoint is committed, approved, authoritative, complete, or ready merely because documents mention it.",
                    "candidateProposal should summarize the concrete value GAEP can prefill for human review; missingDecisions must say what still needs confirmation or say None identified.",
                  ].join(" "),
                },
                acceptedAnswers: {
                  proposedProductDefinition: input,
                  candidateDocuments: attachmentAlignmentInput(batch),
                  candidateMetadata: portableAttachmentMetadata(batch),
                  ...(coverageErrors.length > 0 ? { contractErrorsToRepair: coverageErrors } : {}),
                },
                userAnswer: coverageAttempt === 1
                  ? "Prefill every Journey checkpoint supported by the evidence and preserve every gap explicitly."
                  : "Repair the exact coverage errors and return all checkpoints once without a wrapper.",
                ...(coverageAssessment ? { previousAssessment: {
                  proposedAnswer: coverageAssessment.proposedAnswer,
                  gaps: coverageAssessment.gaps,
                  ...(coverageAssessment.followUpQuestion ? { followUpQuestion: coverageAssessment.followUpQuestion } : {}),
                } } : {}),
              }, signal))
              journeyCoverage = parseExistingProductJourneyCoverage(parseStructuredDraft(coverageAssessment.proposedAnswer))
              break
            } catch (error) {
              coverageErrors = [error instanceof Error ? error.message : "The Product Journey coverage was not contract-valid"]
            }
          }
          if (!journeyCoverage || !coverageAssessment) {
            throw new Error(coverageErrors[0] ?? "The Product Journey coverage was not contract-valid")
          }
          state = startProductInitializationReview(advisor, input, batch.candidates.map((candidate) => candidate.label))
          response.markdown([
            "# Existing Product adoption proposal",
            "",
            "The documents were used twice: first to prefill the governed Product Definition, then to assess every Product Journey checkpoint. Nothing below is committed or authoritative yet.",
            "",
            `**Assessment:** ${markdownValue(assessment.assessment)}`,
            ...(assessment.gaps.length > 0 ? ["", "**Evidence gaps to review:**", ...assessment.gaps.map((gap) => `- ${markdownValue(gap)}`)] : []),
            "",
            reviewMarkdown(state),
            "",
            "## Journey acceleration preview",
            "",
            markdownTable(["Checkpoint", "Coverage", "Candidate proposal", "Missing decisions"], journeyCoverage.map((row) => [
              journeyCheckpointLabels[row.checkpoint],
              row.coverage,
              row.candidateProposal,
              row.missingDecisions,
            ])),
            "",
            "```mermaid",
            "flowchart LR",
            "  PD[\"Product definition\"] --> ID[\"Initiative definition\"] --> IC[\"Initiative classification\"] --> IA[\"Initiative applicability\"]",
            "  IA --> SI[\"Source intake\"] --> SB[\"Source baseline\"] --> SP[\"Source provenance\"]",
            "  SP --> DISC[\"Product discovery\"] --> BA[\"Business architecture\"] --> SA[\"Solution and security architecture\"]",
            "  SA --> DD[\"Detailed design and assurance, including Event Storming\"] --> DH[\"Pre-Figma readiness and handoff\"]",
            "```",
            "",
            `**Journey assessment:** ${markdownValue(coverageAssessment.assessment)}`,
            "",
            "> This preview accelerates the Journey by showing what GAEP can prefill at every checkpoint. Each proposal remains editable and a checkpoint is recorded only after its own review and explicit confirmation.",
          ].join("\n"))
          response.button({ command: "gaep.openInteractiveChat", title: "Commit Reviewed Product", arguments: ["commit", "CONFIRM"] })
          response.button({ command: "gaep.openInteractiveChat", title: "Edit Proposed Fields", arguments: ["edit"] })
          return metadata(state)
        } catch (error) {
          contractErrors = [error instanceof Error ? error.message : "The Product proposal was not contract-valid"]
        }
      }
      response.markdown([
        "# Existing Product fast-start needs another advisory pass",
        "",
        "GAEP could not produce a contract-valid Product Definition and complete Journey coverage proposal after three bounded repair attempts. No Product state was created.",
        "",
        ...contractErrors.map((error) => `- ${markdownValue(error)}`),
      ].join("\n"))
      response.button({ command: "gaep.openInteractiveChat", title: "Retry Existing Product Fast-start", arguments: ["adopt"] })
      response.button({ command: "gaep.selectProductChatAgent", title: "Switch Agent" })
      response.button({ command: "gaep.selectProductChatModel", title: "Switch Model" })
      return state ? metadata(state) : undefined
    }
    if (command === "status") {
      const product = await options.productState()
      const current = product.state === "initialized" ? await options.currentInitiative() : undefined
      const source = current ? await options.sourceCheckpoint(current.id) : undefined
      const phase1 = current && source?.baseline && source.provenanceCount > 0
        ? await options.phase1Checkpoint(current.id)
        : undefined
      const advisor = preferredProductChatAdvisor(
        options.currentAdvisor(),
        phase1AuthoringState?.advisor ?? applicabilityState?.advisor ?? classificationState?.advisor ?? initiativeState?.advisor,
        state?.advisor,
      )
      const advisorStatus = advisor
        ? `${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)} (${advisor.modelTruthClass})`
        : "not selected"
      const draftStatus = phase1AuthoringState && !["committed", "cancelled"].includes(phase1AuthoringState.phase)
        ? `Product Journey ${phase1AuthoringState.target.label} ${phase1AuthoringState.phase} (record ${phase1AuthoringState.target.ordinal}/${phase1AuthoringState.target.total})`
        : applicabilityState && !["committed", "cancelled"].includes(applicabilityState.phase)
        ? `Initiative applicability ${applicabilityState.phase} (Initiative revision ${applicabilityState.initiativeRevision})`
        : classificationState && !["committed", "cancelled"].includes(classificationState.phase)
          ? `Initiative classification ${classificationState.phase} (Initiative revision ${classificationState.initiativeRevision})`
          : initiativeState && !["committed", "cancelled"].includes(initiativeState.phase)
            ? `Initiative ${initiativeState.phase} (${initiativeProgress(initiativeState)})`
            : state ? `Product ${state.phase} (${productInitializationProgress(state)})` : "none"
      const statusRows = [
        ["Product definition", product.state === "initialized" ? "Recorded" : product.state, product.state === "initialized" ? `Revision ${product.revision}` : "No governed Product"],
        ["Initiative definition", current ? "Recorded" : "Not started", current ? `Revision ${current.revision}` : "—"],
        ["Initiative classification", current?.classificationStatus ?? "Not started", current?.classification ? `${current.classification.unresolvedQuestions.length} open question(s)` : "—"],
        ["Initiative applicability", current?.applicabilityStatus ?? "Not started", current?.applicability ? `${current.applicability.decisions.length} mapped · ${current.applicability.unresolvedSubjects.length} unresolved` : "—"],
        ["Source intake", source?.sourceCount ? "Recorded" : "Not started", source?.sourceCount ? `${source.sourceCount} exact candidate Source(s)` : "—"],
        ["Source baseline", source?.baseline?.status ?? "Not started", source?.baseline ? `Revision ${source.baseline.revision} · ${source.baseline.memberCount} members` : "—"],
        ["Source provenance", source?.provenanceCount ? "Recorded" : "Not started", source?.provenanceCount ? `${source.provenanceCount} lineage record(s)` : "—"],
        ...(phase1?.groups ?? []).map((group) => [group.label, group.complete ? "Recorded" : "In progress", `${group.recorded}/${group.total}`]),
      ]
      const nodeState = (done: boolean, active = false) => done ? "✓" : active ? "→" : "○"
      const productDone = product.state === "initialized"
      const initiativeDone = Boolean(current)
      const classificationDone = current?.classificationStatus === "current"
      const applicabilityDone = current?.applicabilityStatus === "current"
      const intakeDone = Boolean(source?.sourceCount)
      const baselineDone = source?.baseline?.status === "current"
      const provenanceDone = Boolean(source?.provenanceCount)
      const phaseGroup = (id: string) => phase1?.groups.find((group) => group.id === id)
      const completedBefore = [productDone, initiativeDone, classificationDone, applicabilityDone, intakeDone, baselineDone, provenanceDone]
      const activeIndex = completedBefore.findIndex((done) => !done)
      const journeyDiagram = [
        "```mermaid",
        "flowchart TD",
        `  P["${nodeState(productDone, activeIndex === 0)} Product definition"] --> I["${nodeState(initiativeDone, activeIndex === 1)} Initiative definition"]`,
        `  I --> C["${nodeState(classificationDone, activeIndex === 2)} Initiative classification"]`,
        `  C --> A["${nodeState(applicabilityDone, activeIndex === 3)} Initiative applicability"]`,
        `  A --> SI["${nodeState(intakeDone, activeIndex === 4)} Source intake"]`,
        `  SI --> SB["${nodeState(baselineDone, activeIndex === 5)} Source baseline"]`,
        `  SB --> SP["${nodeState(provenanceDone, activeIndex === 6)} Source provenance"]`,
        `  SP --> PD["${nodeState(Boolean(phaseGroup("product-discovery")?.complete), provenanceDone && !phaseGroup("product-discovery")?.complete)} Product discovery"]`,
        `  PD --> BA["${nodeState(Boolean(phaseGroup("business-architecture")?.complete))} Business architecture"]`,
        `  BA --> SA["${nodeState(Boolean(phaseGroup("solution-security-architecture")?.complete))} Solution and security architecture"]`,
        `  SA --> DD["${nodeState(Boolean(phaseGroup("detailed-design-assurance")?.complete))} Detailed design and assurance"]`,
        `  DD --> R["${nodeState(Boolean(phaseGroup("p0-p4-readiness")?.complete))} Pre-Figma readiness and handoff"]`,
        "```",
      ].join("\n")
      response.markdown([
        "# Product Journey status",
        "",
        markdownTable(["Checkpoint", "State", "Recorded detail"], statusRows),
        "",
        journeyDiagram,
        "",
        markdownTable(["Session", "Value"], [
          ["Active advisor", advisorStatus],
          ["Uncommitted Chat draft", draftStatus],
        ]),
        "",
        "Use **`@gaep /continue`** for the next checkpoint. Open Product Studio to inspect recorded field values, revisions, impacts, and checkpoint-specific review/edit actions.",
      ].join("\n"))
      response.button({ command: "gaep.openProductStudio", title: "Open Product Journey", arguments: ["overview"] })
      return phase1AuthoringState ? phase1AuthoringMetadata(phase1AuthoringState)
        : applicabilityState ? applicabilityMetadata(applicabilityState)
        : classificationState ? classificationMetadata(classificationState)
        : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
    }
    if (command === "mode") {
      if (!options.selectJourneyMode) {
        response.markdown("Journey mode selection is unavailable in this host. The governed workflow remains unchanged.")
        return
      }
      const selected = await options.selectJourneyMode()
      if (!selected) {
        response.markdown("Journey mode selection was cancelled. The current mode was preserved.")
        return
      }
      const behavior = selected.mode === "quick"
        ? "Shows only the next required checkpoint and material exceptions."
        : selected.mode === "guided"
          ? "Shows the recommended checkpoint sequence with focused explanations."
          : "Shows every record family, evidence gap, and consequential review boundary."
      response.markdown([
        `# ${selected.mode[0]!.toUpperCase()}${selected.mode.slice(1)} mode selected`,
        "",
        behavior,
        "",
        "The mode changes presentation depth only. It cannot remove mandatory records, approvals, evidence, or authority boundaries.",
      ].join("\n"))
      response.button({ command: "gaep.openInteractiveChat", title: "Continue Product Journey", arguments: ["continue"] })
      return
    }
    const productDraftActive = Boolean(state && !["committed", "cancelled"].includes(state.phase))
    const initiativeDraftActive = Boolean(initiativeState && !["committed", "cancelled"].includes(initiativeState.phase))
    const classificationDraftActive = Boolean(classificationState && !["committed", "cancelled"].includes(classificationState.phase))
    const applicabilityDraftActive = Boolean(applicabilityState && !["committed", "cancelled"].includes(applicabilityState.phase))
    if (command === "roles") {
      if (applicabilityDraftActive && applicabilityState) {
        response.markdown(applicabilityRolesMarkdown(applicabilityState))
        return applicabilityMetadata(applicabilityState)
      }
      response.markdown([
        "Standard applicability roles are available during Initiative Applicability Resolution.",
        "",
        "Use **`@gaep /continue`** to start or resume that checkpoint, then **`@gaep /roles`** to inspect all 49 editable recommendations.",
      ].join("\n"))
      return applicabilityState ? applicabilityMetadata(applicabilityState)
        : classificationState ? classificationMetadata(classificationState)
        : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
    }
    if ((command === "advisor" || command === "agent" || command === "model") &&
        !productDraftActive && !initiativeDraftActive && !classificationDraftActive && !applicabilityDraftActive) {
      const current = preferredProductChatAdvisor(
        options.currentAdvisor(),
        applicabilityState?.advisor ?? classificationState?.advisor ?? initiativeState?.advisor,
        state?.advisor,
      )
      const advisor = await selectProductChatAdvisorForCommand(command, current, {
        advisor: options.selectAdvisor,
        agent: options.selectAgent,
        model: options.selectModel,
      })
      if (!advisor) {
        response.markdown("Agent/model selection was cancelled. The current Product Chat selection was preserved.")
        return applicabilityState ? applicabilityMetadata(applicabilityState)
          : classificationState ? classificationMetadata(classificationState)
          : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
      }
      response.markdown([
        `Product Chat advisor changed to **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}** (${advisor.modelTruthClass}).`,
        "",
        "This selection applies to the next Product or Initiative advisory turn. It does not change committed Product or Initiative history.",
        "",
        "Use **`@gaep /status`** to verify the active selection, then **`@gaep /continue`** to resume the lifecycle.",
      ].join("\n"))
      return applicabilityState ? applicabilityMetadata(applicabilityState)
        : classificationState ? classificationMetadata(classificationState)
        : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
    }
    if (command === "initialize") {
      const product = await options.productState()
      if (product.state === "initialized") {
        response.markdown(`This workspace already contains the governed Product **${markdownValue(product.name)}**. Use **\`@gaep /revise\`** to correct it or **\`@gaep /continue\`** to start the next valid lifecycle step; initialization will not overwrite it.`)
        return
      }
      if (product.state === "partial") {
        response.markdown("This folder contains partial `.gaep` state without a valid Product manifest. Initialization is disabled to preserve evidence.")
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
        return { errorDetails: { message: "Partial GAEP state requires diagnosis" } }
      }
      const advisor = await options.selectAdvisor(state?.advisor)
      if (!advisor) {
        response.markdown("Product initialization did not start because no executable Codex or Claude Code advisor/model was selected. No Product state was changed.")
        return state ? metadata(state) : undefined
      }
      state = startProductInitialization(advisor, request.prompt, attached)
      response.markdown([
        "# GAEP Product initialization",
        "",
        `I will collect nine bounded inputs. **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}** will challenge and improve every candidate answer, and GAEP will require **\`/accept\`** before moving to the next question.`,
        ...(attached.length > 0 ? ["", `Received ${attached.length} candidate attachment(s). They are referenced but not yet governed or treated as authoritative.`] : []),
        "",
        questionMarkdown(state),
      ].join("\n"))
      return metadata(state)
    }
    if (command === "revise") {
      const product = await options.productState()
      if (product.state !== "initialized") {
        response.markdown(product.state === "partial"
          ? "Product revision is disabled because this folder contains partial `.gaep` state. Review diagnostics first."
          : "Initialize the Product before starting a governed revision.")
        return state ? metadata(state) : undefined
      }
      if (applicabilityState && !["committed", "cancelled"].includes(applicabilityState.phase)) {
        response.markdown(applicabilityState.phase === "review"
          ? applicabilityReviewMarkdown(applicabilityState)
          : applicabilityState.phase === "awaiting-approval"
            ? applicabilityAssessedMarkdown(applicabilityState)
            : applicabilityQuestionMarkdown(applicabilityState, "Resumed the current uncommitted Initiative applicability matrix."))
        return applicabilityMetadata(applicabilityState)
      }
      const advisor = preferredProductChatAdvisor(options.currentAdvisor(), undefined, state?.advisor) ?? await options.selectAdvisor()
      if (!advisor) {
        response.markdown("Product revision did not start because no executable Codex or Claude Code advisor/model was selected.")
        return state ? metadata(state) : undefined
      }
      if (state?.workflow !== "revision" || state.baseProductRevision !== product.revision ||
          state.phase === "committed" || state.phase === "cancelled") {
        state = startProductRevision(advisor, product.input, product.revision, attached)
      }
      const field = await options.selectRevisionField()
      if (!field) {
        response.markdown(`${reviewMarkdown(state)}\n\nNo field was selected; the revision draft was preserved.`)
        return metadata(state)
      }
      state = editProductRevisionField(state, field)
      response.markdown(questionMarkdown(state, "Revise this field. The existing governed value remains unchanged until explicit acceptance and commit."))
      return metadata(state)
    }
    if (command === "edit") {
      if (!state || state.phase !== "review") {
        response.markdown("No complete Product draft is available to edit. Complete `/initialize`, `/adopt`, or `/revise` first.")
        return state ? metadata(state) : undefined
      }
      const field = await options.selectRevisionField()
      if (!field) {
        response.markdown(`${reviewMarkdown(state)}\n\nNo field was selected; the complete draft was preserved.`)
        return metadata(state)
      }
      state = editProductField(state, field)
      response.markdown(questionMarkdown(state, "Edit this field. Other proposed values remain unchanged; nothing is governed until explicit acceptance and commit."))
      return metadata(state)
    }
    if (command === "continue") {
      const product = await options.productState()
      if (product.state !== "initialized") {
        response.markdown(product.state === "partial"
          ? "GAEP found partial Product state. Continuation is blocked until diagnostics and recovery complete."
          : "No governed Product exists yet. Start with **`@gaep /initialize`**.")
        return state ? metadata(state) : undefined
      }
      if (applicabilityState && !["committed", "cancelled"].includes(applicabilityState.phase)) {
        response.markdown(applicabilityState.phase === "review"
          ? applicabilityReviewMarkdown(applicabilityState)
          : applicabilityState.phase === "awaiting-approval"
            ? applicabilityAssessedMarkdown(applicabilityState)
            : applicabilityQuestionMarkdown(applicabilityState, "Resumed the current uncommitted Initiative applicability matrix."))
        return applicabilityMetadata(applicabilityState)
      }
      if (classificationState && !["committed", "cancelled"].includes(classificationState.phase)) {
        response.markdown(classificationState.phase === "review"
          ? classificationReviewMarkdown(classificationState)
          : classificationState.phase === "awaiting-approval"
            ? classificationAssessedMarkdown(classificationState)
            : classificationQuestionMarkdown(classificationState, "Resumed the current uncommitted Initiative classification."))
        return classificationMetadata(classificationState)
      }
      if (initiativeState && !["committed", "cancelled"].includes(initiativeState.phase)) {
        response.markdown(initiativeState.phase === "review"
          ? initiativeReviewMarkdown(initiativeState)
          : initiativeQuestionMarkdown(initiativeState, "Resumed the current uncommitted Initiative draft."))
        return initiativeMetadata(initiativeState)
      }
      const current = await options.currentInitiative()
      if (current) {
        if (current.classificationStatus === "current") {
          if (current.applicabilityStatus === "current") {
            const checkpoint = await options.sourceCheckpoint(current.id)
            if (checkpoint.sourceCount > 0 && !checkpoint.baseline) {
              response.markdown([
                `Current Initiative: **${markdownValue(current.title)}** · ${markdownValue(current.state)} · revision ${current.revision}.`,
                "",
                `Source Intake contains **${checkpoint.sourceCount} exact candidate Source(s)**: ${checkpoint.sourceTitles.map(markdownValue).join(", ")}.`,
                "",
                "## Next: Candidate Source Baseline",
                "",
                "Review and record the exact current Source revisions as one candidate snapshot. Membership remains editable by revising the Source set before this action.",
                "",
                "> This low-risk Review and Record action creates no Source authority, approval, readiness, implementation, or release authority.",
              ].join("\n"))
              response.button({ command: "gaep.openInteractiveChat", title: "Review and Record Baseline", arguments: ["baseline"] })
              return applicabilityState ? applicabilityMetadata(applicabilityState)
                : classificationState ? classificationMetadata(classificationState)
                  : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
            }
            if (checkpoint.baseline && checkpoint.baseline.status !== "current") {
              response.markdown([
                "# Source Baseline needs attention",
                "",
                `The current candidate Baseline is **${checkpoint.baseline.status}** against the recorded Source revisions.`,
                "",
                "Review the current candidate Sources, then record a new exact Baseline.",
              ].join("\n"))
              response.button({ command: "gaep.openInteractiveChat", title: "Record Current Baseline", arguments: ["baseline"] })
              return applicabilityState ? applicabilityMetadata(applicabilityState)
                : classificationState ? classificationMetadata(classificationState)
                  : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
            }
            if (checkpoint.baseline && checkpoint.provenanceCount === 0) {
              response.markdown([
                "# Candidate Source Baseline is current",
                "",
                `Baseline revision **${checkpoint.baseline.revision}** binds **${checkpoint.baseline.memberCount} exact Source revision(s)**.`,
                "",
                "## Next: Source Provenance",
                "",
                "Record conservative exact lineage from these candidate Sources to the current Initiative. Claim-level truth remains unresolved.",
              ].join("\n"))
              response.button({ command: "gaep.openInteractiveChat", title: "Review and Record Provenance", arguments: ["provenance"] })
              return applicabilityState ? applicabilityMetadata(applicabilityState)
                : classificationState ? classificationMetadata(classificationState)
                  : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
            }
            if (checkpoint.baseline && checkpoint.provenanceCount > 0) {
              const phase1 = await options.phase1Checkpoint(current.id)
              const journeyMode = await options.journeyMode?.() ?? {
                mode: "guided" as const,
                source: "recommended" as const,
              }
              const nextGroup = phase1.groups.find((group) => !group.complete)
              const recorded = phase1.groups.reduce((total, group) => total + group.recorded, 0)
              const total = phase1.groups.reduce((sum, group) => sum + group.total, 0)
              const visibleGroups = journeyMode.mode === "quick" && nextGroup ? [nextGroup] : phase1.groups
              const progress = visibleGroups.map((group) =>
                `${group.complete ? "✓" : group === nextGroup ? "→" : "○"} **${group.label}** — ${group.recorded}/${group.total}`)
              response.markdown([
                "# Source foundation is recorded",
                "",
                `**${checkpoint.sourceCount} Source(s)** · candidate Baseline revision **${checkpoint.baseline.revision}** · **${checkpoint.provenanceCount} Provenance record(s)**.`,
                "",
                `## ${journeyMode.mode[0]!.toUpperCase()}${journeyMode.mode.slice(1)} Product planning · ${recorded}/${total} records`,
                `Mode source: **${journeyMode.source}**. Use **\`@gaep /mode\`** to change presentation depth.`,
                "",
                ...progress,
                "",
                ...(nextGroup ? [
                  `## Next: ${nextGroup.label}`,
                  "",
                  "Open the focused Product Studio workspace to inspect exact current records, gaps, and the next governed authoring action.",
                ] : [
                  "## Next: Design handoff review",
                  "",
                  "All required record families are present. Inspect exact readiness before design or Figma work.",
                ]),
                "",
                "> Existing records remain candidate evidence. No readiness, implementation, or release authority is granted.",
              ].join("\n"))
              response.button({
                command: nextGroup ? "gaep.openInteractiveChat" : "gaep.openProductStudio",
                title: nextGroup ? `Author ${nextGroup.label}` : "Review Design Handoff",
                arguments: [nextGroup ? "author" : "readiness"],
              })
              if (nextGroup) {
                response.button({
                  command: "gaep.openProductStudio",
                  title: `Inspect ${nextGroup.label}`,
                  arguments: [nextGroup.route],
                })
              }
              response.button({ command: "gaep.openProductStudio", title: "Open Product Journey", arguments: ["overview"] })
              return applicabilityState ? applicabilityMetadata(applicabilityState)
                : classificationState ? classificationMetadata(classificationState)
                  : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
            }
            response.markdown([
              `Current Initiative: **${markdownValue(current.title)}** · ${markdownValue(current.state)} · revision ${current.revision}.`,
              "",
              "Its governed classification and applicability matrix are current. The next checkpoint is Source Intake.",
              "",
              "Select **Choose File** or **Choose Folder** to browse any accessible location on your computer. GAEP will open **`@gaep /intake`** so you can ask for a summary, explanation, comparison, extraction, or another task using the document content. Lifecycle alignment is offered separately after you understand the files.",
            ].join("\n"))
            response.button({ command: "gaep.chooseFile", title: "Choose File" })
            response.button({ command: "gaep.chooseFolder", title: "Choose Folder" })
            return applicabilityState ? applicabilityMetadata(applicabilityState)
              : classificationState ? classificationMetadata(classificationState)
                : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
          }
          if (!current.classification || !current.applicabilityCatalog) {
            response.markdown("Applicability resolution is fail-closed because the current Classification or canonical subject catalog could not be loaded. Refresh GAEP and review Diagnostics.")
            response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
            return classificationState ? classificationMetadata(classificationState)
              : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
          }
          const advisor = preferredProductChatAdvisor(
            options.currentAdvisor(),
            applicabilityState?.advisor ?? classificationState?.advisor ?? initiativeState?.advisor,
            state?.advisor,
          ) ?? await options.selectAdvisor()
          if (!advisor) {
            response.markdown("Initiative applicability did not start because no executable Codex or Claude Code advisor/model was selected.")
            return classificationState ? classificationMetadata(classificationState)
              : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
          }
          applicabilityState = startInitiativeApplicabilityChat(advisor, {
            initiativeId: current.id,
            initiativeRevision: current.revision,
            productRevision: product.revision,
            product: { name: product.name, profile: product.input.profile, summary: product.input.summary },
            initiative: {
              title: current.title,
              outcome: current.outcome,
              scope: [...current.scope],
              exclusions: [...current.exclusions],
            },
            classification: current.classification,
            catalog: current.applicabilityCatalog,
            ...(current.priorApplicability ? { currentApplicability: current.priorApplicability } : {}),
          })
          response.markdown([
            current.applicabilityStatus === "stale"
              ? "# Rebuild GAEP Initiative applicability"
              : "# GAEP Initiative applicability resolution",
            "",
            current.applicabilityStatus === "stale"
              ? `The Classification changed after the previous applicability decision. GAEP carried the stale matrix forward only as an editable draft for Initiative revision ${current.revision}; **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}** will re-evaluate all ${current.applicabilityCatalog.subjects.length} subjects against the current Classification.`
              : `The governed Classification is current and the exact catalog contains ${current.applicabilityCatalog.subjects.length} subjects. **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}** will challenge one natural-language applicability brief and map every subject exactly once. Unknowns stay unresolved; no absence becomes not-applicable.`,
            "",
            applicabilityQuestionMarkdown(applicabilityState),
          ].join("\n"))
          return applicabilityMetadata(applicabilityState)
        }
        const advisor = preferredProductChatAdvisor(
          options.currentAdvisor(),
          applicabilityState?.advisor ?? classificationState?.advisor ?? initiativeState?.advisor,
          state?.advisor,
        ) ?? await options.selectAdvisor()
        if (!advisor) {
          response.markdown("Initiative classification did not start because no executable Codex or Claude Code advisor/model was selected.")
          return classificationState ? classificationMetadata(classificationState)
            : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
        }
        classificationState = startInitiativeClassificationChat(advisor, {
          initiativeId: current.id,
          initiativeRevision: current.revision,
          productRevision: product.revision,
          product: {
            name: product.name,
            profile: product.input.profile,
            summary: product.input.summary,
          },
          initiative: {
            title: current.title,
            outcome: current.outcome,
            scope: [...current.scope],
            exclusions: [...current.exclusions],
          },
        })
        response.markdown([
          "# GAEP Initiative classification",
          "",
          `The proposed Initiative **${markdownValue(current.title)}** is bound to Product revision ${product.revision}. **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}** will challenge one natural-language classification brief and map it to the complete governed contract. No classification is recorded until /accept and /commit CONFIRM.`,
          "",
          classificationQuestionMarkdown(classificationState),
        ].join("\n"))
        return classificationMetadata(classificationState)
      }
      const advisor = preferredProductChatAdvisor(options.currentAdvisor(), initiativeState?.advisor, state?.advisor) ?? await options.selectAdvisor()
      if (!advisor) {
        response.markdown("Continuation did not start because no executable Product advisor/model was selected.")
        return state ? metadata(state) : undefined
      }
      initiativeState = startInitiativeChat(advisor)
      response.markdown([
        "# GAEP Initiative creation",
        "",
        `The governed Product **${markdownValue(product.name)}** is at revision ${product.revision}. I will collect four bounded Initiative inputs. **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}** will challenge each answer; only /accept advances and only /commit CONFIRM creates a proposed Initiative.`,
        "",
        initiativeQuestionMarkdown(initiativeState),
      ].join("\n"))
      return initiativeMetadata(initiativeState)
    }
    if (applicabilityState && !["committed", "cancelled"].includes(applicabilityState.phase)) {
      if (command === "resolve") {
        if (applicabilityState.phase === "review") {
          response.markdown(`${applicabilityReviewMarkdown(applicabilityState)}\n\nUse \`/back\` before resolving subjects in the accepted proposal.`)
          return applicabilityMetadata(applicabilityState)
        }
        const clarification = suggestedUnresolvedApplicabilityClarification(applicabilityState)
        if (!clarification) {
          response.markdown(applicabilityState.phase === "collecting"
            ? `${applicabilityQuestionMarkdown(applicabilityState)}\n\nThe current matrix has no attention item requiring a GAEP resolution proposal.`
            : `${applicabilityAssessedMarkdown(applicabilityState)}\n\nThe current proposal has no unresolved subject requiring a GAEP clarification.`)
          return applicabilityMetadata(applicabilityState)
        }
        const proposed = await proposeInitiativeApplicability(applicabilityState, clarification)
        if (proposed) {
          applicabilityState = proposed
          response.markdown(applicabilityAssessedMarkdown(applicabilityState))
        }
        return applicabilityMetadata(applicabilityState)
      }
      if (command === "suggest") {
        if (applicabilityState.phase === "review") {
          response.markdown(`${applicabilityReviewMarkdown(applicabilityState)}\n\nUse \`/back\` before replacing the accepted proposal.`)
          return applicabilityMetadata(applicabilityState)
        }
        if (applicabilityState.phase === "awaiting-approval") {
          applicabilityState = backInitiativeApplicability(applicabilityState)
        }
        const suggestedBrief = suggestedInitiativeApplicabilityBrief(applicabilityState)
        const proposed = await proposeInitiativeApplicability(applicabilityState, suggestedBrief)
        if (proposed) {
          applicabilityState = proposed
          response.markdown(applicabilityAssessedMarkdown(applicabilityState))
        }
        return applicabilityMetadata(applicabilityState)
      }
      if (command === "cancel") {
        applicabilityState = { ...applicabilityState, phase: "cancelled" }
        response.markdown("The Initiative applicability draft was discarded. No governed Initiative record was changed.")
        return applicabilityMetadata(applicabilityState)
      }
      if (command === "advisor" || command === "agent" || command === "model") {
        const advisor = command === "model"
          ? await options.selectModel(applicabilityState.advisor)
          : command === "agent"
            ? await options.selectAgent(applicabilityState.advisor)
            : await options.selectAdvisor(applicabilityState.advisor)
        if (!advisor) {
          response.markdown("Agent/model selection was cancelled. The applicability draft was preserved.")
          return applicabilityMetadata(applicabilityState)
        }
        if (sameAdvisor(applicabilityState.advisor, advisor)) {
          response.markdown(applicabilityState.phase === "review"
            ? applicabilityReviewMarkdown(applicabilityState)
            : applicabilityState.phase === "awaiting-approval"
              ? applicabilityAssessedMarkdown(applicabilityState)
              : applicabilityQuestionMarkdown(applicabilityState, "The selected agent and model are already active."))
          return applicabilityMetadata(applicabilityState)
        }
        const pending = applicabilityState.pending
        applicabilityState = changeInitiativeApplicabilityAdvisor(applicabilityState, advisor, true)
        if (pending && !sameAdvisor(pending.advisor, advisor)) {
          const proposed = await proposeInitiativeApplicability(applicabilityState, pending.originalAnswer)
          if (proposed) {
            applicabilityState = proposed
            response.markdown(applicabilityAssessedMarkdown(applicabilityState))
          }
          return applicabilityMetadata(applicabilityState)
        }
        applicabilityState = changeInitiativeApplicabilityAdvisor(applicabilityState, advisor)
        response.markdown(applicabilityQuestionMarkdown(applicabilityState, "The new advisor applies to the unaccepted applicability brief."))
        return applicabilityMetadata(applicabilityState)
      }
      if (command === "back") {
        applicabilityState = backInitiativeApplicability(applicabilityState)
        response.markdown(applicabilityQuestionMarkdown(applicabilityState, "The accepted applicability proposal was reopened for revision."))
        return applicabilityMetadata(applicabilityState)
      }
      if (command === "review") {
        response.markdown(applicabilityState.phase === "review"
          ? applicabilityReviewMarkdown(applicabilityState)
          : applicabilityState.phase === "awaiting-approval"
            ? applicabilityAssessedMarkdown(applicabilityState)
            : applicabilityQuestionMarkdown(applicabilityState, "Provide and accept an applicability brief before review."))
        return applicabilityMetadata(applicabilityState)
      }
      if (command === "accept") {
        if (!applicabilityState.pending) {
          response.markdown(applicabilityQuestionMarkdown(applicabilityState, "There is no Initiative applicability proposal awaiting acceptance."))
          return applicabilityMetadata(applicabilityState)
        }
        const lifecycleAiCorrections = initiativeApplicabilityLifecycleAiCorrections(applicabilityState)
        if (lifecycleAiCorrections.length > 0) {
          response.markdown([
            applicabilityAssessedMarkdown(applicabilityState),
            "",
            "Acceptance was not performed because the matrix conflates GAEP-assisted lifecycle AI with target-runtime AI. Use **`@gaep /resolve`** to correct the exact affected decisions first.",
          ].join("\n"))
          return applicabilityMetadata(applicabilityState)
        }
        const attentionItems = initiativeApplicabilityAttentionItems(applicabilityState.pending.matrix)
        if (attentionItems.length > 0 && request.prompt.trim() !== "ATTENTION") {
          response.markdown([
            applicabilityAssessedMarkdown(applicabilityState),
            "",
            `Acceptance was not performed because **${attentionItems.length} applicability attention item(s)** remain:`,
            "",
            ...attentionItems.map((item) => `- ${markdownValue(item)}`),
            "",
            "Use **`@gaep /resolve`** to generate a bounded completion proposal. Use **`@gaep /accept ATTENTION`** only when intentionally preserving these items in governed state.",
          ].join("\n"))
          return applicabilityMetadata(applicabilityState)
        }
        applicabilityState = acceptInitiativeApplicability(applicabilityState)
        response.markdown(applicabilityReviewMarkdown(applicabilityState))
        return applicabilityMetadata(applicabilityState)
      }
      if (command === "commit") {
        if (applicabilityState.phase !== "review") {
          response.markdown(applicabilityState.phase === "awaiting-approval"
            ? `${applicabilityAssessedMarkdown(applicabilityState)}\n\nAccept the exact proposal before commit.`
            : applicabilityQuestionMarkdown(applicabilityState, "The applicability draft is incomplete."))
          return applicabilityMetadata(applicabilityState)
        }
        if (request.prompt.trim() !== "CONFIRM") {
          response.markdown(`${applicabilityReviewMarkdown(applicabilityState)}\n\nCommit was not performed. Send exactly **\`@gaep /commit CONFIRM\`**.`)
          return applicabilityMetadata(applicabilityState)
        }
        response.progress("Recording the revision-bound Initiative applicability matrix")
        const committed = await options.commitInitiativeApplicability(
          applicabilityState.initiativeId,
          initiativeApplicabilityInput(applicabilityState),
          applicabilityState.initiativeRevision,
        )
        applicabilityState = { ...applicabilityState, phase: "committed" }
        response.markdown([
          `Initiative **${markdownValue(committed.title)}** recorded its applicability matrix at revision ${committed.revision}.`,
          "",
          `Coverage: **${committed.decisionCount} decisions** and **${committed.unresolvedSubjectCount} unresolved subjects**. Entry state: **${markdownValue(committed.entryState)}**.`,
          "",
          "This matrix grants no approval, activation, execution, implementation, source, or release authority.",
          "",
          "Next: use **`@gaep /continue`** to inspect the next governed lifecycle checkpoint.",
        ].join("\n"))
        return applicabilityMetadata(applicabilityState)
      }
      const candidate = answerInitiativeApplicability(applicabilityState, request.prompt)
      applicabilityState = candidate.state
      if (candidate.challenge) {
        response.markdown(applicabilityQuestionMarkdown(applicabilityState, candidate.challenge))
        return applicabilityMetadata(applicabilityState)
      }
      const proposed = await proposeInitiativeApplicability(applicabilityState, request.prompt)
      if (proposed) {
        applicabilityState = proposed
        response.markdown(applicabilityAssessedMarkdown(applicabilityState))
      }
      return applicabilityMetadata(applicabilityState)
    }
    if (classificationState && !["committed", "cancelled"].includes(classificationState.phase)) {
      if (command === "suggest" || command === "resolve") {
        if (!classificationState.currentClassification) {
          response.markdown(classificationQuestionMarkdown(classificationState, "Describe the Initiative classification before requesting a proposal."))
          return classificationMetadata(classificationState)
        }
        const resolution = suggestedInitiativeClassificationResolution(classificationState)
        if (!resolution) {
          response.markdown(classificationState.phase === "awaiting-approval"
            ? `${classificationAssessedMarkdown(classificationState)}\n\nThe current proposal has no open classification question requiring a GAEP resolution.`
            : classificationQuestionMarkdown(classificationState, "The current governed classification has no open question requiring a GAEP resolution."))
          return classificationMetadata(classificationState)
        }
        const proposed = await proposeInitiativeClassification(
          classificationState,
          resolution,
        )
        if (proposed) {
          classificationState = proposed
          response.markdown(classificationAssessedMarkdown(classificationState))
        }
        return classificationMetadata(classificationState)
      }
      if (command === "cancel") {
        classificationState = { ...classificationState, phase: "cancelled" }
        response.markdown("The Initiative classification draft was discarded. No governed Initiative record was changed.")
        return classificationMetadata(classificationState)
      }
      if (command === "advisor" || command === "agent" || command === "model") {
        const advisor = command === "model"
          ? await options.selectModel(classificationState.advisor)
          : command === "agent"
            ? await options.selectAgent(classificationState.advisor)
            : await options.selectAdvisor(classificationState.advisor)
        if (!advisor) {
          response.markdown("Agent/model selection was cancelled. The classification draft was preserved.")
          return classificationMetadata(classificationState)
        }
        if (sameAdvisor(classificationState.advisor, advisor)) {
          response.markdown(classificationState.phase === "awaiting-approval"
            ? classificationAssessedMarkdown(classificationState)
            : classificationQuestionMarkdown(classificationState, "The selected agent and model are already active."))
          return classificationMetadata(classificationState)
        }
        const pending = classificationState.pending
        classificationState = changeInitiativeClassificationAdvisor(classificationState, advisor, true)
        if (pending && !sameAdvisor(pending.advisor, advisor)) {
          const proposed = await proposeInitiativeClassification(classificationState, pending.originalAnswer)
          if (proposed) {
            classificationState = proposed
            response.markdown(classificationAssessedMarkdown(classificationState))
          }
          return classificationMetadata(classificationState)
        }
        classificationState = changeInitiativeClassificationAdvisor(classificationState, advisor)
        response.markdown(classificationQuestionMarkdown(classificationState, "The new advisor applies to the unaccepted classification brief."))
        return classificationMetadata(classificationState)
      }
      if (command === "back") {
        classificationState = backInitiativeClassification(classificationState)
        response.markdown(classificationQuestionMarkdown(classificationState, "The accepted classification proposal was reopened for revision."))
        return classificationMetadata(classificationState)
      }
      if (command === "review") {
        response.markdown(classificationState.phase === "review"
          ? classificationReviewMarkdown(classificationState)
          : classificationState.phase === "awaiting-approval"
            ? classificationAssessedMarkdown(classificationState)
            : classificationQuestionMarkdown(classificationState, "Provide and accept a classification brief before review."))
        return classificationMetadata(classificationState)
      }
      if (command === "accept") {
        if (!classificationState.pending) {
          response.markdown(classificationQuestionMarkdown(classificationState, "There is no Initiative classification proposal awaiting acceptance."))
          return classificationMetadata(classificationState)
        }
        const attentionItems = initiativeClassificationAttentionItems(classificationState.pending.classification)
        if (attentionItems.length > 0 && request.prompt.trim() !== "ATTENTION") {
          response.markdown([
            classificationAssessedMarkdown(classificationState),
            "",
            `Acceptance was not performed because **${attentionItems.length} classification question(s)** remain open:`,
            "",
            ...attentionItems.map((item) => `- ${markdownValue(item)}`),
            "",
            "Use **`@gaep /resolve`** to generate a bounded completion proposal. Use **`@gaep /accept ATTENTION`** only when intentionally preserving these questions in governed state.",
          ].join("\n"))
          return classificationMetadata(classificationState)
        }
        classificationState = acceptInitiativeClassification(classificationState)
        response.markdown(classificationReviewMarkdown(classificationState))
        return classificationMetadata(classificationState)
      }
      if (command === "commit") {
        if (classificationState.phase !== "review") {
          response.markdown(classificationState.phase === "awaiting-approval"
            ? `${classificationAssessedMarkdown(classificationState)}\n\nAccept the exact proposal before commit.`
            : classificationQuestionMarkdown(classificationState, "The classification draft is incomplete."))
          return classificationMetadata(classificationState)
        }
        if (request.prompt.trim() !== "CONFIRM") {
          response.markdown(`${classificationReviewMarkdown(classificationState)}\n\nCommit was not performed. Send exactly **\`@gaep /commit CONFIRM\`**.`)
          return classificationMetadata(classificationState)
        }
        const current = await options.currentInitiative()
        let expectedRevision = classificationState.initiativeRevision
        if (current?.revision !== expectedRevision) {
          if (!current || !canSafelyRebindInitiativeClassification(classificationState, current)) {
            response.markdown([
              "The Initiative changed in a way that may affect this accepted classification. GAEP preserved the draft and did not overwrite the newer governed state.",
              "",
              "Reload the current classification, review the proposed changes against it, and accept again only if they remain correct.",
            ].join("\n"))
            response.button({ command: "gaep.openInteractiveChat", title: "Reload Classification", arguments: ["classification"] })
            return classificationMetadata(classificationState)
          }
          expectedRevision = current.revision
          classificationState = { ...classificationState, initiativeRevision: current.revision }
          response.progress(`Safely rebinding the accepted classification to Initiative revision ${current.revision}`)
        }
        response.progress("Recording the revision-bound Initiative classification")
        const committed = await options.commitInitiativeClassification(
          classificationState.initiativeId,
          initiativeClassificationInput(classificationState),
          expectedRevision,
        )
        classificationState = { ...classificationState, phase: "committed" }
        response.markdown([
          `Initiative **${markdownValue(committed.title)}** was classified as **${markdownValue(committed.primaryType)}** at revision ${committed.revision}.`,
          "",
          `Entry state: **${markdownValue(committed.entryState)}**. The classification grants no approval, applicability decision, activation, execution, or implementation authority.`,
          "",
          "Next: use **`@gaep /continue`** to resolve the canonical Initiative applicability matrix conversationally.",
        ].join("\n"))
        return classificationMetadata(classificationState)
      }
      const candidate = answerInitiativeClassification(classificationState, request.prompt)
      classificationState = candidate.state
      if (candidate.challenge) {
        response.markdown(classificationQuestionMarkdown(classificationState, candidate.challenge))
        return classificationMetadata(classificationState)
      }
      const proposed = await proposeInitiativeClassification(classificationState, request.prompt)
      if (proposed) {
        classificationState = proposed
        response.markdown(classificationAssessedMarkdown(classificationState))
      }
      return classificationMetadata(classificationState)
    }
    if (initiativeState && !["committed", "cancelled"].includes(initiativeState.phase)) {
      const initiativeAdvisorContext = async (): Promise<object> => {
        const product = await options.productState()
        return initiativeAdvisorAcceptedAnswers(
          initiativeState!.answers,
          product.state === "initialized"
            ? { revision: product.revision, input: product.input }
            : undefined,
        )
      }
      if (command === "cancel") {
        initiativeState = { ...initiativeState, phase: "cancelled" }
        response.markdown("The Initiative chat draft was discarded. No governed Initiative was created or changed.")
        return initiativeMetadata(initiativeState)
      }
      if (command === "advisor" || command === "agent" || command === "model") {
        const advisor = command === "model"
          ? await options.selectModel(initiativeState.advisor)
          : command === "agent"
            ? await options.selectAgent(initiativeState.advisor)
            : await options.selectAdvisor(initiativeState.advisor)
        if (!advisor) {
          response.markdown("Agent/model selection was cancelled. The Initiative draft was preserved.")
          return initiativeMetadata(initiativeState)
        }
        if (sameAdvisor(initiativeState.advisor, advisor)) {
          response.markdown(initiativeQuestionMarkdown(initiativeState, "The selected agent and model are already active."))
          return initiativeMetadata(initiativeState)
        }
        const pending = initiativeState.pending
        initiativeState = changeInitiativeAdvisor(initiativeState, advisor, true)
        if (pending && !sameAdvisor(pending.advisor, advisor)) {
          const question = currentInitiativeQuestion(initiativeState)!
          response.progress(`Re-evaluating the Initiative answer with ${advisor.agentLabel} · ${advisor.modelLabel}`)
          const abort = new AbortController()
          const cancellation = token.onCancellationRequested(() => abort.abort())
          try {
            const assessment = await options.challengeAnswer({
              advisor,
              question,
              acceptedAnswers: await initiativeAdvisorContext(),
              userAnswer: pending.originalAnswer,
              previousAssessment: pending,
            }, abort.signal)
            initiativeState = assessInitiativeAnswer(initiativeState, pending.originalAnswer, assessment)
            response.markdown(initiativeAssessedMarkdown(initiativeState))
          } catch {
            response.markdown(`${initiativeAssessedMarkdown(initiativeState)}\n\nRe-evaluation failed; GAEP did not advance.`)
          } finally {
            cancellation.dispose()
          }
          return initiativeMetadata(initiativeState)
        }
        initiativeState = changeInitiativeAdvisor(initiativeState, advisor)
        response.markdown(initiativeQuestionMarkdown(initiativeState, "The new advisor applies to this and later unaccepted Initiative answers."))
        return initiativeMetadata(initiativeState)
      }
      if (command === "back") {
        initiativeState = backInitiative(initiativeState)
        response.markdown(initiativeQuestionMarkdown(initiativeState, "The previous Initiative answer was removed."))
        return initiativeMetadata(initiativeState)
      }
      if (command === "review") {
        response.markdown(initiativeState.phase === "review"
          ? initiativeReviewMarkdown(initiativeState)
          : initiativeQuestionMarkdown(initiativeState, "Complete the remaining Initiative questions before review."))
        return initiativeMetadata(initiativeState)
      }
      if (command === "accept") {
        if (!initiativeState.pending) {
          response.markdown(initiativeQuestionMarkdown(initiativeState, "There is no Initiative proposal awaiting acceptance."))
          return initiativeMetadata(initiativeState)
        }
        initiativeState = acceptInitiativeAnswer(initiativeState)
        response.markdown(initiativeState.phase === "review"
          ? initiativeReviewMarkdown(initiativeState)
          : initiativeQuestionMarkdown(initiativeState, "The previous Initiative proposal was explicitly accepted."))
        return initiativeMetadata(initiativeState)
      }
      if (command === "commit") {
        if (initiativeState.phase !== "review") {
          response.markdown(initiativeQuestionMarkdown(initiativeState, "The Initiative draft is incomplete."))
          return initiativeMetadata(initiativeState)
        }
        if (request.prompt.trim() !== "CONFIRM") {
          response.markdown(`${initiativeReviewMarkdown(initiativeState)}\n\nCommit was not performed. Send exactly **\`@gaep /commit CONFIRM\`**.`)
          return initiativeMetadata(initiativeState)
        }
        const isRevision = initiativeState.workflow === "revision"
        response.progress(isRevision ? "Recording the governed Initiative revision" : "Creating the governed proposed Initiative")
        const initiative = isRevision
          ? await options.reviseInitiative(
              initiativeState.initiativeId!,
              initiativeInput(initiativeState),
              initiativeState.baseInitiativeRevision!,
            )
          : await options.commitInitiative(initiativeInput(initiativeState))
        initiativeState = { ...initiativeState, phase: "committed" }
        response.markdown([
          isRevision
            ? `Initiative **${markdownValue(initiative.title)}** was revised at revision ${initiative.revision}.`
            : `Proposed Initiative **${markdownValue(initiative.title)}** was created at revision ${initiative.revision}.`,
          "",
          isRevision
            ? "The changed definition invalidates downstream Classification and Applicability until they are reviewed and recorded again. Prior audit evidence is preserved."
            : "It remains proposed and grants no execution or implementation authority.",
          "",
          "Next: run **`@gaep /continue`** to classify this Initiative conversationally.",
        ].join("\n"))
        return initiativeMetadata(initiativeState)
      }
      const candidate = answerInitiative(initiativeState, request.prompt)
      initiativeState = candidate.state
      if (candidate.challenge || candidate.value === undefined) {
        response.markdown(initiativeQuestionMarkdown(initiativeState, candidate.challenge))
        return initiativeMetadata(initiativeState)
      }
      const question = currentInitiativeQuestion(initiativeState)!
      try {
        const acceptedAnswers = await initiativeAdvisorContext()
        const result = await assessInitiativeAnswerWithAutomaticRepair(
          initiativeState,
          request.prompt,
          async ({ attempt, contractErrors, previousAssessment }) => {
            response.progress(attempt === 1
              ? `Asking ${initiativeState!.advisor.agentLabel} · ${initiativeState!.advisor.modelLabel} to draft and challenge this Initiative answer`
              : `GAEP is replacing an invalid or placeholder Initiative answer with a concrete context-grounded candidate (${attempt}/3)…`)
            return withChatCancellation(token, (signal) => options.challengeAnswer({
              advisor: initiativeState!.advisor,
              question,
              acceptedAnswers: {
                ...acceptedAnswers,
                ...(contractErrors.length > 0 ? { contractErrorsToRepair: contractErrors } : {}),
              },
              userAnswer: attempt === 1
                ? request.prompt
                : `${request.prompt}\n\nGAEP automatic answer repair: return a concrete, field-valid proposal derived from the governed context. Replace every placeholder. Do not ask the human to repeat known Product facts.`,
              ...(previousAssessment ? { previousAssessment } : {}),
            }, signal))
          },
        )
        initiativeState = result.state
        response.markdown(initiativeAssessedMarkdown(initiativeState))
      } catch (error) {
        options.reportDiagnostic?.("Initiative answer automatic normalization failed", error)
        response.markdown(initiativeQuestionMarkdown(initiativeState, "GAEP could not produce a concrete field-valid proposal after three automatic repair attempts. Your draft is preserved; switch the agent/model or retry without learning GAEP's internal format."))
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
      }
      return initiativeMetadata(initiativeState)
    }
    if (!state || state.phase === "cancelled" || state.phase === "committed") {
      response.markdown(`${helpMarkdown()}\n\nStart with **\`@gaep /initialize\`** for a new Product or **\`@gaep /revise\`** for an existing Product.`)
      return
    }
    if (command === "cancel") {
      state = { ...state, phase: "cancelled" }
      response.markdown("The conversational draft was discarded. No governed Product state was created or changed.")
      return metadata(state)
    }
    if (command === "advisor" || command === "agent" || command === "model") {
      const advisor = command === "model"
        ? await options.selectModel(state.advisor)
        : command === "agent"
          ? await options.selectAgent(state.advisor)
          : await options.selectAdvisor(state.advisor)
      if (!advisor) {
        response.markdown("Agent/model selection was cancelled. The current draft and advisor were preserved.")
        return metadata(state)
      }
      if (sameAdvisor(state.advisor, advisor)) {
        response.markdown(`${questionMarkdown(state, "The selected agent and model are already active.")}\n\nUse \`/agent\` to change provider or \`/model\` to change its model.`)
        return metadata(state)
      }
      const pending = state.pending
      state = changeProductChatAdvisor(state, advisor, true)
      if (pending) {
        response.progress(`Re-evaluating the current answer with ${advisor.agentLabel} · ${advisor.modelLabel}`)
        const abort = new AbortController()
        const cancellation = token.onCancellationRequested(() => abort.abort())
        try {
          const question = currentProductInitializationQuestion(state)!
          const assessment = await options.challengeAnswer({
            advisor: state.advisor,
            question,
            acceptedAnswers: state.answers,
            userAnswer: pending.originalAnswer,
            previousAssessment: pending,
          }, abort.signal)
          state = recordProductAnswerAssessment(state, pending.originalAnswer, assessment)
          response.markdown([
            `Agent/model changed to **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}**. The current answer was re-evaluated without advancing the Product step.`,
            "",
            assessedAnswerMarkdown(state),
          ].join("\n"))
        } catch {
          response.markdown([
            `Agent/model changed to **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}**, but re-evaluation did not complete.`,
            "",
            "The previous unaccepted proposal remains visible under its original advisor. Reply with a revision to retry using the new selection; GAEP did not advance.",
            "",
            assessedAnswerMarkdown(state),
          ].join("\n"))
          response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
        } finally {
          cancellation.dispose()
        }
        return metadata(state)
      }
      state = changeProductChatAdvisor(state, advisor)
      response.markdown([
        `Agent/model changed to **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}**.`,
        "",
        questionMarkdown(state, "The new selection applies to this and all later unaccepted answers."),
      ].join("\n"))
      return metadata(state)
    }
    if (command === "back") {
      state = goBackProductInitialization(state)
      response.markdown(questionMarkdown(state, "The previous answer was removed. Provide its replacement."))
      return metadata(state)
    }
    if (command === "review") {
      if (state.phase !== "review") {
        response.markdown(questionMarkdown(state, "Complete the remaining questions before review."))
        return metadata(state)
      }
      response.markdown(reviewMarkdown(state))
      return metadata(state)
    }
    if (command === "accept") {
      if (state.phase !== "awaiting-approval" || !state.pending) {
        response.markdown(questionMarkdown(state, "There is no AI-assisted proposal awaiting approval. Answer the current question first."))
        return metadata(state)
      }
      state = acceptProductAnswer(state)
      if (state.phase === "review") response.markdown(reviewMarkdown(state))
      else response.markdown(questionMarkdown(state, "The previous proposal was explicitly accepted. Continue with the next question."))
      return metadata(state)
    }
    if (command === "commit") {
      if (state.phase !== "review") {
        response.markdown(questionMarkdown(state, "The draft is incomplete and cannot be committed."))
        return metadata(state)
      }
      if (request.prompt.trim() !== "CONFIRM") {
        response.markdown(`${reviewMarkdown(state)}\n\nCommit was not performed. Send exactly **\`@gaep /commit CONFIRM\`**.`)
        return metadata(state)
      }
      const input = productInitializationInput(state) as ProductInput
      response.progress(state.workflow === "revision" ? "Creating the audited Product revision" : "Creating the governed Product record")
      const product = state.workflow === "revision"
        ? await options.reviseProduct(input, state.baseProductRevision!)
        : await options.commitProduct(input)
      state = { ...state, phase: "committed" }
      response.markdown(state.workflow === "revision" ? [
        `Governed Product **${markdownValue(product.name)}** was revised successfully at revision **${"revision" in product ? product.revision : state.baseProductRevision! + 1}**.`,
        "",
        "The Product identity was preserved, the prior revision remains in history, and an audit event records the explicit correction.",
        "",
        markdownTable(["Downstream area", "Realignment state"], [
          ["Initiative definition", "Review required against the new Product revision"],
          ["Classification and applicability", "Revalidate after the Initiative binding is current"],
          ["Source foundation", "Preserved; exact bindings must be rechecked before reuse"],
          ["Product planning records", "Preserved as history; impacted records must be revised explicitly"],
        ]),
        "",
        "```mermaid",
        "flowchart LR",
        "  P[\"New Product revision\"] --> I[\"Review Initiative binding\"]",
        "  I --> C[\"Revalidate classification and applicability\"]",
        "  C --> S[\"Recheck source foundation\"]",
        "  S --> D[\"Review impacted Product planning records\"]",
        "```",
        "",
        "> GAEP does not silently rewrite accepted downstream records. It preserves their revisions, identifies the affected checkpoints, and requires user-controlled review before realignment is accepted.",
        "",
        "Next: use **`@gaep /continue`** to inspect the first impacted checkpoint, or open Product Journey to review recorded values and history.",
      ].join("\n") : [
        `Governed Product **${markdownValue(product.name)}** was initialized successfully.`,
        "",
        "The chat transcript is not the source of truth; `.gaep` now is. Candidate attachments were not silently imported or granted authority.",
        "",
        "Next: create an Initiative and run governed Source Intake for the attached Product documents.",
      ].join("\n"))
      if (state.workflow === "revision") {
        response.button({ command: "gaep.openProductStudio", title: "Review Product Journey", arguments: ["overview"] })
      }
      return metadata(state)
    }
    if (state.phase === "review") {
      response.markdown(reviewMarkdown(state))
      return metadata(state)
    }

    const result = answerProductInitialization(state, request.prompt, attached)
    state = result.state
    if (result.challenge || result.value === undefined) {
      response.markdown(questionMarkdown(state, result.challenge))
      return metadata(state)
    }
    try {
      const question = currentProductInitializationQuestion(state)!
      const result = await recordProductAnswerAssessmentWithAutomaticRepair(
        state,
        request.prompt,
        async ({ attempt, contractErrors, previousAssessment }) => {
          response.progress(attempt === 1
            ? `Asking ${state!.advisor.agentLabel} · ${state!.advisor.modelLabel} to draft and challenge this Product answer`
            : `GAEP is replacing an invalid or placeholder Product answer with a concrete context-grounded candidate (${attempt}/3)…`)
          return withChatCancellation(token, (signal) => options.challengeAnswer({
            advisor: state!.advisor,
            question,
            acceptedAnswers: {
              acceptedProductFields: state!.answers,
              candidateAttachments: state!.candidateAttachments,
              ...(contractErrors.length > 0 ? { contractErrorsToRepair: contractErrors } : {}),
            },
            userAnswer: attempt === 1
              ? request.prompt
              : `${request.prompt}\n\nGAEP automatic answer repair: return a concrete, field-valid proposal derived from every accepted Product field and candidate attachment. Replace every placeholder and do not ask for facts already present.`,
            ...(previousAssessment ? { previousAssessment } : {}),
          }, signal))
        },
      )
      state = result.state
      response.markdown(assessedAnswerMarkdown(state))
    } catch (error) {
      options.reportDiagnostic?.("Product answer automatic normalization failed", error)
      response.markdown(questionMarkdown(
        state,
        "GAEP could not produce a concrete field-valid proposal after three automatic repair attempts. Your draft is preserved; retry or switch the agent/model without learning GAEP's internal format.",
      ))
      response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
    }
    return metadata(state)
  }

  const historyTurns = (history: readonly (vscode.ChatRequestTurn | vscode.ChatResponseTurn)[]): ProductChatConversationTurn[] => {
    const turns: ProductChatConversationTurn[] = []
    let pending: vscode.ChatRequestTurn | undefined
    for (const entry of history) {
      if ("prompt" in entry) {
        pending = entry
        continue
      }
      if (!pending || !("response" in entry)) continue
      const markdown = entry.response.flatMap((part) => {
        const value = "value" in part ? part.value : undefined
        return value instanceof vscode.MarkdownString ? [value.value] : []
      }).join("\n\n")
      turns.push({ command: pending.command, prompt: pending.prompt, response: markdown })
      pending = undefined
    }
    return turns
  }

  const handler: vscode.ChatRequestHandler = async (request, chatContext, response, token) => {
    const responseMarkdown: string[] = []
    const recordingResponse = createRecordingChatResponseStream(
      response,
      (value) => responseMarkdown.push(value),
    )
    const result = await coreHandler(request, chatContext, recordingResponse, token)
    conversationTurns = [
      ...historyTurns(chatContext.history),
      { command: request.command, prompt: request.prompt, response: responseMarkdown.join("\n\n") },
    ]
    if (conversationOutlinePanel) {
      conversationOutlinePanel.webview.html = productChatConversationOutlineHtml(conversationTurns)
    }
    response.button({ command: "gaep.openConversationOutline", title: "Open Conversation Outline" })
    return result
  }

  const participant = vscode.chat.createChatParticipant(gaepChatParticipantId, handler)
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "gaep.svg")
  participant.followupProvider = {
    provideFollowups: (result) => {
      const sourceReview = result.metadata?.gaepSourceAlignment
      if (isSourceAlignmentChatState(sourceReview)) {
        if (sourceReview.purpose === "understanding" && sourceReview.phase === "proposal") return [
          { prompt: "/align", label: "Create GAEP alignment preview" },
          { prompt: "/agent", label: "Switch agent" },
          { prompt: "/model", label: "Switch model" },
        ]
        if (sourceReview.phase === "proposal") return [
          { prompt: "/accept", label: "Accept alignment preview" },
          { prompt: "/cancel", label: "Discard alignment preview" },
          { prompt: "/agent", label: "Switch agent" },
          { prompt: "/model", label: "Switch model" },
        ]
      }
      const applicability = result.metadata?.gaepInitiativeApplicability
      if (isInitiativeApplicabilityChatState(applicability)) {
        if (applicability.phase === "review") return [
          { prompt: "/commit CONFIRM", label: "Record exact applicability matrix" },
          { prompt: "/back", label: "Revise applicability brief" },
        ]
        if (applicability.phase === "awaiting-approval") return [
          ...(initiativeApplicabilityLifecycleAiCorrections(applicability).length
            ? [{ prompt: "/resolve", label: "Correct lifecycle AI scope" }]
            : applicability.pending?.matrix.unresolvedSubjects.length
            ? [{ prompt: "/resolve", label: `Resolve ${applicability.pending.matrix.unresolvedSubjects.length} open subjects` }]
            : []),
          ...(initiativeApplicabilityLifecycleAiCorrections(applicability).length
            ? []
            : [{ prompt: "/accept", label: "Accept applicability matrix" }]),
          { prompt: "/roles", label: "Inspect suggested roles" },
          { prompt: "/agent", label: "Switch agent" },
          { prompt: "/model", label: "Switch model" },
        ]
        if (applicability.phase === "collecting") return [
          {
            prompt: "/suggest",
            label: "Use suggested applicability brief",
          },
          { prompt: "/roles", label: "Inspect suggested roles" },
          { prompt: "/agent", label: "Switch agent" },
          { prompt: "/model", label: "Switch model" },
        ]
        return [{ prompt: "/continue", label: "Continue lifecycle" }]
      }
      const classification = result.metadata?.gaepInitiativeClassification
      if (isInitiativeClassificationChatState(classification)) {
        if (classification.phase === "review") return [
          { prompt: "/commit CONFIRM", label: "Record exact classification" },
          { prompt: "/back", label: "Revise classification" },
        ]
        if (classification.phase === "awaiting-approval") return [
          { prompt: "/accept", label: "Accept classification" },
          { prompt: "/agent", label: "Switch agent" },
          { prompt: "/model", label: "Switch model" },
        ]
        if (classification.phase === "collecting") return [
          ...(classification.currentClassification
            ? [{ prompt: "/suggest", label: "Generate suggested resolutions" }]
            : []),
          { prompt: "/agent", label: "Switch agent" },
          { prompt: "/model", label: "Switch model" },
          { prompt: "/continue", label: "Resume classification" },
        ]
        return [{ prompt: "/continue", label: "Continue lifecycle" }]
      }
      const initiative = result.metadata?.gaepInitiative
      if (isInitiativeChatState(initiative)) {
        if (initiative.phase === "review") return [
          { prompt: "/commit CONFIRM", label: "Create proposed Initiative" },
          { prompt: "/back", label: "Revise last answer" },
        ]
        if (initiative.phase === "awaiting-approval") return [
          { prompt: "/accept", label: "Accept and continue" },
          { prompt: "/agent", label: "Switch agent" },
          { prompt: "/model", label: "Switch model" },
        ]
        if (initiative.phase === "collecting") return [
          { prompt: "/agent", label: "Switch agent" },
          { prompt: "/model", label: "Switch model" },
          { prompt: "/continue", label: "Show Initiative progress" },
        ]
        return [{ prompt: "/continue", label: "Continue lifecycle" }]
      }
      const state = result.metadata?.gaepProductInitialization
      if (!isProductInitializationChatState(state)) return [{ prompt: "/initialize", label: "Initialize Product" }]
      if (state.phase === "review") return [
        { prompt: "/commit CONFIRM", label: "Commit exact draft" },
        { prompt: "/back", label: "Revise last answer" },
      ]
      if (state.phase === "awaiting-approval") return [
        { prompt: "/accept", label: "Accept and continue" },
        { prompt: "/agent", label: "Switch agent" },
        { prompt: "/model", label: "Switch model" },
      ]
      if (state.phase === "collecting") return [
        { prompt: "/agent", label: "Switch agent" },
        { prompt: "/model", label: "Switch model" },
        { prompt: "/status", label: "Show progress" },
      ]
      return [{ prompt: "/status", label: "Show Product status" }]
    },
  }
  context.subscriptions.push(participant)
  return participant
}
