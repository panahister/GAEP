import {
  journeyCheckpointLabels,
  parseExistingProductJourneyCoverage,
  type ExistingProductJourneyCoverage,
  type ExistingProductJourneyCheckpointId,
} from "./existing-product-journey-coverage.js"
import type { CandidateSourceAttachment } from "./product-chat-source-recording.js"
import { markdownTable, nonWrappingTableLabel } from "./product-chat-source-intake.js"

const authorityBoundary = "existing-product-adoption-review-is-an-uncommitted-preview-and-does-not-create-governed-source-checkpoint-approval-readiness-implementation-release-or-action-authority" as const

export interface ExistingProductAdoptionReviewState {
  schemaVersion: 1
  kind: "gaep-existing-product-adoption-review"
  phase: "review" | "committed" | "cancelled"
  productAssessment: string
  productGaps: string[]
  journeyAssessment: string
  sources: CandidateSourceAttachment[]
  checkpoints: ExistingProductJourneyCoverage[]
  authorityBoundary: typeof authorityBoundary
}

function boundedText(value: unknown, maximum = 8_192): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum
}

function boundedStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 32 && value.every((entry) => boundedText(entry))
}

function isCandidateSourceAttachment(value: unknown): value is CandidateSourceAttachment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Partial<CandidateSourceAttachment>
  return boundedText(candidate.label, 1_024) && boundedText(candidate.format, 32) &&
    ["utf8-text", "docx-ooxml", "xlsx-ooxml"].includes(String(candidate.extraction)) &&
    Number.isSafeInteger(candidate.byteLength) && Number(candidate.byteLength) >= 0 &&
    typeof candidate.contentDigest === "string" && /^sha256:[a-f0-9]{64}$/u.test(candidate.contentDigest) &&
    (candidate.limitations === undefined || boundedStrings(candidate.limitations))
}

function markdownValue(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+.!|>-]/gu, "\\$&")
}

export function isExistingProductAdoptionReviewState(value: unknown): value is ExistingProductAdoptionReviewState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Partial<ExistingProductAdoptionReviewState>
  if (candidate.schemaVersion !== 1 || candidate.kind !== "gaep-existing-product-adoption-review" ||
      !["review", "committed", "cancelled"].includes(String(candidate.phase)) ||
      !boundedText(candidate.productAssessment) || !boundedStrings(candidate.productGaps) ||
      !boundedText(candidate.journeyAssessment) || !Array.isArray(candidate.sources) || candidate.sources.length > 100 ||
      !candidate.sources.every(isCandidateSourceAttachment) || candidate.authorityBoundary !== authorityBoundary) return false
  try {
    parseExistingProductJourneyCoverage({ checkpoints: candidate.checkpoints })
    return true
  } catch {
    return false
  }
}

export function startExistingProductAdoptionReview(input: {
  productAssessment: string
  productGaps: readonly string[]
  journeyAssessment: string
  sources?: readonly CandidateSourceAttachment[]
  checkpoints: readonly ExistingProductJourneyCoverage[]
}): ExistingProductAdoptionReviewState {
  const state: ExistingProductAdoptionReviewState = {
    schemaVersion: 1,
    kind: "gaep-existing-product-adoption-review",
    phase: "review",
    productAssessment: input.productAssessment.trim(),
    productGaps: input.productGaps.map((entry) => entry.trim()),
    journeyAssessment: input.journeyAssessment.trim(),
    sources: (input.sources ?? []).map((source) => structuredClone(source)),
    checkpoints: parseExistingProductJourneyCoverage({ checkpoints: structuredClone(input.checkpoints) }),
    authorityBoundary,
  }
  if (!isExistingProductAdoptionReviewState(state)) throw new Error("The Existing Product adoption review exceeds its portable bounds")
  return state
}

export function setExistingProductAdoptionReviewPhase(
  state: ExistingProductAdoptionReviewState,
  phase: ExistingProductAdoptionReviewState["phase"],
): ExistingProductAdoptionReviewState {
  return { ...state, phase }
}

export function existingProductAdoptionOverviewMarkdown(
  state: ExistingProductAdoptionReviewState,
  productReview: string,
): string {
  return [
    "# Existing Product adoption proposal",
    "",
    "The documents were consumed to prefill the Product Definition and assess every Product Journey checkpoint. Nothing below is governed or authoritative yet.",
    "",
    `**Assessment:** ${markdownValue(state.productAssessment)}`,
    ...(state.productGaps.length > 0 ? ["", "**Evidence gaps to review:**", ...state.productGaps.map((gap) => `- ${markdownValue(gap)}`)] : []),
    "",
    productReview,
    "",
    `**Source Intake candidate set:** ${state.sources.length} exact reviewed attachment(s), integrity-bound by content digest.`,
    "",
    "## Journey acceleration preview",
    "",
    markdownTable(["Checkpoint", "Coverage", "Candidate proposal", "Missing decisions"], state.checkpoints.map((row) => [
      journeyCheckpointLabels[row.checkpoint],
      row.coverage,
      row.candidateProposal,
      row.missingDecisions,
    ])),
    "",
    "```mermaid",
    "flowchart TD",
    "  PD[\"Product definition\"] --> ID[\"Initiative definition\"] --> IC[\"Initiative classification\"] --> IA[\"Initiative applicability\"]",
    "  IA --> SI[\"Source intake\"] --> SB[\"Source baseline\"] --> SP[\"Source provenance\"]",
    "  SP --> DISC[\"Product discovery\"] --> BA[\"Business architecture\"] --> SA[\"Solution and security architecture\"]",
    "  SA --> DD[\"Detailed design and assurance, including Event Storming\"] --> DH[\"Pre-Figma readiness and handoff\"]",
    "```",
    "",
    `**Journey assessment:** ${markdownValue(state.journeyAssessment)}`,
    "",
    "> Commit creates the governed Product Definition, captures the exact attachments as reviewed Source Intake, and saves downstream proposals as non-governed candidates. Every later checkpoint still requires its own review and explicit governed action.",
  ].join("\n")
}

export function existingProductAdoptionCheckpointSelectionMarkdown(state: ExistingProductAdoptionReviewState): string {
  return [
    "# Review adoption checkpoint details",
    "",
    "Select any checkpoint below to inspect its exact evidence, candidate proposal, and missing decisions. Reviewing a row does not edit or commit it.",
    "",
    markdownTable(["Checkpoint", "Coverage"], state.checkpoints.map((row) => [
      journeyCheckpointLabels[row.checkpoint],
      row.coverage,
    ])),
  ].join("\n")
}

export function existingProductAdoptionCheckpointMarkdown(
  state: ExistingProductAdoptionReviewState,
  checkpoint: ExistingProductJourneyCheckpointId,
): string {
  const row = state.checkpoints.find((candidate) => candidate.checkpoint === checkpoint)
  if (!row) throw new Error(`Adoption checkpoint ${checkpoint} is unavailable`)
  return [
    `# ${journeyCheckpointLabels[checkpoint]} — adoption preview`,
    "",
    markdownTable(["Review item", "Candidate value"], [
      [nonWrappingTableLabel("Coverage"), row.coverage],
      [nonWrappingTableLabel("Supporting evidence"), row.evidence],
      [nonWrappingTableLabel("Candidate proposal"), row.candidateProposal],
      [nonWrappingTableLabel("Missing decisions"), row.missingDecisions],
    ]),
    "",
    "> Read-only candidate detail. Nothing is recorded, edited, approved, or authorized by opening this checkpoint.",
  ].join("\n")
}

export function existingProductAdoptionFollowThrough(checkpoint: ExistingProductJourneyCheckpointId): {
  command: string
  prompt: string
  title: string
} {
  return checkpoint === "product-definition"
    ? { command: "revise", prompt: "", title: "Revise Governed Product Definition" }
    : checkpoint === "initiative-definition"
      ? { command: "adopt", prompt: "create:initiative-definition", title: "Generate Initiative Proposal" }
      : checkpoint === "initiative-classification"
        ? { command: "adopt", prompt: "create:initiative-classification", title: "Generate Classification Proposal" }
        : checkpoint === "initiative-applicability"
          ? { command: "adopt", prompt: "create:initiative-applicability", title: "Generate Applicability Proposal" }
          : checkpoint === "source-intake"
            ? { command: "adopt", prompt: "consume", title: "Bind Reviewed Sources to Initiative" }
            : checkpoint === "source-baseline"
              ? { command: "baseline", prompt: "", title: "Generate Source Baseline Proposal" }
              : checkpoint === "source-provenance"
                ? { command: "provenance", prompt: "", title: "Generate Source Provenance Proposal" }
                : {
                    command: "adopt",
                    prompt: `create:${checkpoint}`,
                    title: `Generate ${journeyCheckpointLabels[checkpoint]} Proposal`,
                  }
}
