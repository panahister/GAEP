import type {
  ExecutionManagedIntent,
  RunToolSelection,
  ToolDefinition,
  ToolPermission,
  WorkflowPlan,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import type { RunToolSelectionInput } from "@gaep/engine"

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
          scope: [...new Set([...(existing?.scope ?? []), ...permission.scope])].sort(),
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
  selection: RunToolSelectionInput | RunToolSelection,
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
