import type {
  ExecutionManagedIntent,
  RunToolSelection,
  ToolDefinition,
  ToolPermission,
  WorkflowPlan,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import type {
  ManagedWorkflowGateEvaluationRequest,
  ManagedWorkflowGateEvaluator,
  RunToolSelectionInput,
} from "@gaep/engine"

const deniedCapabilities = [
  "network-access",
  "commit",
  "push",
  "deploy",
  "publish",
  "external-communication",
  "spend",
  "privilege-change",
  "delete",
  "destructive-delete",
] as const

function unique<T>(values: readonly T[], key: (value: T) => string): T[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const identity = key(value)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

export interface ManagedWorkflowEnvelope {
  managedIntent: ExecutionManagedIntent
  permissions: ToolPermission[]
  expectedEffects: WorkflowPlan["steps"][number]["effectEnvelope"]
  stopConditions: string[]
  requiredEvidence: string[]
}

export type HumanWorkflowGateStatus = "satisfied" | "failed" | "not-assessed"

export interface HumanWorkflowGatePrompt {
  title: string
  message: string
  satisfiedLabel: string
  canAttest: boolean
}

const gatePhaseLabels: Record<ManagedWorkflowGateEvaluationRequest["phase"], string> = {
  preconditions: "Workflow preconditions",
  outputs: "Workflow outputs",
  evidence: "Workflow evidence",
  "stop-conditions": "Workflow stop boundary",
  "charter-evidence": "Charter evidence",
  "charter-stop-conditions": "Charter stop boundary",
}

/**
 * Produces bounded, non-provider-output text for the native human gate dialog.
 * The host must never infer that natural-language criteria were satisfied.
 */
export function humanWorkflowGatePrompt(
  request: ManagedWorkflowGateEvaluationRequest,
): HumanWorkflowGatePrompt {
  const stopBoundary = request.phase === "stop-conditions" || request.phase === "charter-stop-conditions"
  const maximumCriterionCharacters = 2_000
  const maximumCriteriaCharacters = 12_000
  let criteriaCharacters = 0
  let criteriaTruncated = false
  const displayedCriteria: string[] = []
  for (const [index, criterion] of request.criteria.entries()) {
    const bounded = criterion.length > maximumCriterionCharacters
      ? `${criterion.slice(0, maximumCriterionCharacters)}…`
      : criterion
    const line = `${index + 1}. ${bounded}`
    if (criteriaCharacters + line.length > maximumCriteriaCharacters) {
      criteriaTruncated = true
      break
    }
    if (bounded !== criterion) criteriaTruncated = true
    displayedCriteria.push(line)
    criteriaCharacters += line.length
  }
  const criteria = request.criteria.length === 0
    ? "No criteria were declared. Do not attest satisfaction without an independent basis."
    : [
        ...displayedCriteria,
        ...(criteriaTruncated ? ["[Criteria are truncated in this dialog; satisfaction cannot be attested here.]"] : []),
      ].join("\n")
  const runtime = [
    request.providerDisposition ? `Provider disposition: ${request.providerDisposition}` : undefined,
    request.postconditionStatus ? `Postcondition status: ${request.postconditionStatus}` : undefined,
  ].filter((line): line is string => line !== undefined).join("\n")
  return {
    title: `${gatePhaseLabels[request.phase]} — step ${request.stepIndex + 1}, attempt ${request.attempt}`,
    message: [
      stopBoundary
        ? "Attest only if the declared stop boundary was complied with."
        : "Attest only if every declared criterion is supported by evidence you independently reviewed.",
      criteria,
      runtime,
      `Criteria digest: ${request.criteriaDigest}`,
    ].filter(Boolean).join("\n\n"),
    satisfiedLabel: stopBoundary ? "Attest Boundary Complied" : "Attest Satisfied",
    canAttest: request.criteria.length > 0 && !criteriaTruncated,
  }
}

/**
 * Converts an explicit native human decision into the engine's exact evaluator
 * contract. Dismissal or uncertainty remains not-assessed and never becomes a
 * successful gate implicitly.
 */
export function createHumanWorkflowGateEvaluator(
  actorId: string,
  decide: (request: ManagedWorkflowGateEvaluationRequest) => Promise<HumanWorkflowGateStatus>,
): ManagedWorkflowGateEvaluator {
  const version = "gaep-vscode-human-gate-v1"
  const evaluator = {
    kind: "human" as const,
    id: actorId,
    version,
    digest: canonicalDigest({ kind: "human", id: actorId, version }) as `sha256:${string}`,
  }
  return async (request) => {
    const status = await decide(request)
    return {
      status,
      basis: "human-attestation",
      evaluator,
      ...(status === "not-assessed" ? {} : {
        evidenceDigest: canonicalDigest({
          kind: "gaep-vscode-human-workflow-gate-attestation",
          managedRunId: request.managedRunId,
          runId: request.runId,
          stepId: request.stepId,
          stepIndex: request.stepIndex,
          attempt: request.attempt,
          phase: request.phase,
          criteriaDigest: request.criteriaDigest,
          completedStepIds: request.completedStepIds,
          providerDisposition: request.providerDisposition,
          postconditionStatus: request.postconditionStatus,
          eventsDigest: request.eventsDigest,
          actorId,
          evaluatorDigest: evaluator.digest,
          status,
        }) as `sha256:${string}`,
      }),
    }
  }
}

export function buildManagedWorkflowEnvelope(
  plan: WorkflowPlan,
  tools: readonly ToolDefinition[],
  adapterId: string,
): ManagedWorkflowEnvelope {
  if (plan.state !== "resolved") throw new Error("Managed execution requires a resolved Workflow Plan")
  const toolById = new Map(tools.map((tool) => [tool.id, tool]))
  if (toolById.size !== tools.length || plan.toolDefinitions.some((reference) => !toolById.has(reference.recordId))) {
    throw new Error("Managed Workflow Tool inventory is incomplete or duplicated")
  }
  const expectedEffects = unique(plan.steps.flatMap((step) => step.effectEnvelope), (effect) => effect)
  const requestedScopes = unique(plan.steps.flatMap((step) => step.scope.write), (scope) => JSON.stringify(scope))
  const requestedWorkspaceScopes = requestedScopes
    .filter((scope): scope is { kind: "workspace-relative"; path: string } => scope.kind === "workspace-relative")
    .map((scope) => scope.path)
  const managedIntent: ExecutionManagedIntent = {
    workflowPlan: {
      recordType: "workflow-plan",
      recordId: plan.id,
      revision: plan.revision,
      digest: canonicalDigest(plan),
    },
    contextPacks: plan.contextPacks.map((reference) => ({ ...reference, recordType: "context-pack" })),
    toolDefinitions: plan.toolDefinitions.map((reference) => ({ ...reference, recordType: "tool-definition" })),
    requestedEffects: expectedEffects,
    requestedScopes,
  }
  const permissions: ToolPermission[] = []
  if (adapterId === "gaep.manual" || adapterId === "gaep.claude-code-cli") {
    if (tools.length > 0 || expectedEffects.some((effect) => effect !== "observe") || requestedScopes.length > 0) {
      throw new Error("Manual and Claude context-only execution require an observe-only Workflow without Tools or write scopes")
    }
    permissions.push({ capability: "all-tools", mode: "deny", scope: [] })
  } else if (adapterId === "gaep.codex-cli") {
    const byCapability = new Map<string, ToolPermission>()
    for (const tool of tools) {
      if (tool.binding.adapterId !== adapterId) throw new Error(`Tool ${tool.key} targets a different adapter`)
      for (const permission of tool.requiredPermissions) {
        const existing = byCapability.get(permission.capability)
        if (existing && existing.mode !== permission.mode) {
          throw new Error(`Tool permissions conflict for ${permission.capability}`)
        }
        byCapability.set(permission.capability, {
          capability: permission.capability,
          mode: permission.mode,
          scope: [...new Set([...(existing?.scope ?? []), ...requestedWorkspaceScopes])].sort(),
        })
      }
    }
    permissions.push(...byCapability.values())
    for (const capability of deniedCapabilities) {
      if (!byCapability.has(capability)) permissions.push({ capability, mode: "deny", scope: [] })
    }
    if (permissions.length === deniedCapabilities.length) {
      permissions.unshift({ capability: "all-tools", mode: "deny", scope: [] })
    }
  } else {
    throw new Error(`Adapter ${adapterId} has no supported VS Code managed Workflow envelope`)
  }
  return {
    managedIntent,
    permissions,
    expectedEffects,
    stopConditions: unique(plan.steps.flatMap((step) => step.stopConditions), (condition) => condition),
    requiredEvidence: unique(plan.steps.flatMap((step) => step.evidenceCriteria), (criterion) => criterion),
  }
}

export function buildRunToolSelectionInput(
  runId: string,
  plan: WorkflowPlan,
  tools: readonly ToolDefinition[],
  envelope: ManagedWorkflowEnvelope,
  workspaceTrusted: boolean,
): RunToolSelectionInput {
  const toolById = new Map(tools.map((tool) => [tool.id, tool]))
  return {
    runId,
    tools: plan.toolDefinitions,
    requestedEffects: envelope.managedIntent.requestedEffects,
    requestedScopes: envelope.managedIntent.requestedScopes,
    confirmedToolIds: plan.toolDefinitions
      .filter((reference) => toolById.get(reference.recordId)?.policy.requiresHumanConfirmation)
      .map((reference) => reference.recordId),
    workspaceTrusted,
  }
}

export function toolSelectionSummary(
  selection: Pick<RunToolSelectionInput, "tools"> | Pick<RunToolSelection, "tools">,
  tools: readonly ToolDefinition[],
): string[] {
  const toolById = new Map(tools.map((tool) => [tool.id, tool]))
  return selection.tools.map((reference) => {
    const tool = toolById.get(reference.recordId)
    return tool
      ? `${tool.name}: effects=${tool.effectEnvelope.join(", ") || "none"}; scopes=${tool.allowedScopes.map((scope) => JSON.stringify(scope)).join(", ") || "none"}`
      : `Unknown Tool ${reference.recordId}`
  })
}
