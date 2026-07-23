import { z } from "zod"

export const truthClassSchema = z.enum([
  "observed",
  "provider-declared",
  "configured",
  "inferred",
  "unknown",
])

function portableCapabilityText(minimumLength = 0): z.ZodString {
  return z.string().min(minimumLength).max(20_000).superRefine((value, context) => {
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value)) {
      context.addIssue({ code: "custom", message: "Portable capability text cannot contain control characters" })
    }
    const trimmed = value.trim()
    if (
      /^(?:\/[^\s]+|[A-Za-z]:[\\/][^\s]+|\\\\[^\s]+|file:\/\/[^\s]+)$/u.test(trimmed)
      || /(?:^|[\s(="'])(?:\/(?:Users|home|tmp|private|Volumes)\/[^\s"'<>)]*|[A-Za-z]:\\[^\s"'<>)]*|\\\\[^\s"'<>)]*)/u.test(value)
    ) {
      context.addIssue({ code: "custom", message: "Portable capability text cannot contain a machine-local path" })
    }
    if (
      /\bBearer\s+\S+/iu.test(value)
      || /\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b/u.test(value)
      || /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u.test(value)
      || /\bAKIA[A-Z0-9]{16}\b/u.test(value)
      || /-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(value)
      || /\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+/iu.test(value)
    ) {
      context.addIssue({ code: "custom", message: "Portable capability text cannot contain secret-shaped values" })
    }
  })
}

export const settingOptionSchema = z.object({
  value: portableCapabilityText(),
  label: portableCapabilityText(),
  description: portableCapabilityText().optional(),
}).strict()

const portableSettingStringSchema = z.string().max(10_000).superRefine((value, context) => {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value)) {
    context.addIssue({ code: "custom", message: "Portable selection settings cannot contain control characters" })
  }
  if (/(?:^|[\s(="':])(?:\/(?!\/)[^\s"'<>)]*|[A-Za-z]:[\\/][^\s"'<>)]*|\\\\[^\s"'<>)]*|file:\/\/[^\s"'<>)]*|~[\\/][^\s"'<>)]*)/u.test(value)) {
    context.addIssue({ code: "custom", message: "Portable selection settings cannot contain machine-local paths" })
  }
  if (
    /\bBearer\s+\S+/iu.test(value)
    || /\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b/u.test(value)
    || /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u.test(value)
    || /\bAKIA[A-Z0-9]{16}\b/u.test(value)
    || /-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(value)
    || /\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+/iu.test(value)
    || /^\$\{?[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY)[A-Z0-9_]*\}?$/iu.test(value)
  ) {
    context.addIssue({ code: "custom", message: "Portable selection settings cannot contain secret-shaped values" })
  }
})

/**
 * Read-only compatibility value for settings persisted before the portable/local
 * split. It intentionally permits machine-local paths, but retains every other
 * current setting boundary so legacy parsing cannot become a credential or
 * arbitrary-JSON ingress.
 */
const legacyAgentSettingStringSchema = z.string().max(10_000).superRefine((value, context) => {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value)) {
    context.addIssue({ code: "custom", message: "Legacy selection settings cannot contain control characters" })
  }
  if (
    /\bBearer\s+\S+/iu.test(value)
    || /\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b/u.test(value)
    || /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u.test(value)
    || /\bAKIA[A-Z0-9]{16}\b/u.test(value)
    || /-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(value)
    || /\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+/iu.test(value)
    || /^\$\{?[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY)[A-Z0-9_]*\}?$/iu.test(value)
  ) {
    context.addIssue({ code: "custom", message: "Legacy selection settings cannot contain secret-shaped values" })
  }
})

export const portableAgentSettingValueSchema = z.union([
  portableSettingStringSchema,
  z.number().finite(),
  z.boolean(),
  z.array(portableSettingStringSchema).max(256),
])

const legacyAgentSettingValueSchema = z.union([
  legacyAgentSettingStringSchema,
  z.number().finite(),
  z.boolean(),
  z.array(legacyAgentSettingStringSchema).max(256),
])

function rejectSecretBearingSettingKeys(
  settings: Record<string, unknown>,
  context: z.RefinementCtx,
  message: string,
): void {
  for (const key of Object.keys(settings)) {
    if (/(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|bearer[_-]?token|session[_-]?token|password|passwd|client[_-]?secret|private[_-]?key|credential)/iu.test(key)
      || /^(?:secret|token)$/iu.test(key)) {
      context.addIssue({ code: "custom", path: [key], message })
    }
  }
}

export const portableSelectionSettingsSchema = z.record(
  z.string().regex(/^[a-z][a-zA-Z0-9]{0,127}$/),
  portableAgentSettingValueSchema,
).superRefine((settings, context) => {
  if (Object.keys(settings).length > 128) {
    context.addIssue({ code: "custom", message: "Portable agent selections can contain at most 128 settings" })
  }
  rejectSecretBearingSettingKeys(
    settings,
    context,
    "Secret-bearing settings must use a machine-local credential binding",
  )
})

const legacySelectionSettingsSchema = z.record(
  z.string().regex(/^[a-z][a-zA-Z0-9]{0,127}$/),
  legacyAgentSettingValueSchema,
).superRefine((settings, context) => {
  if (Object.keys(settings).length > 128) {
    context.addIssue({ code: "custom", message: "Legacy agent selections can contain at most 128 settings" })
  }
  rejectSecretBearingSettingKeys(
    settings,
    context,
    "Secret-bearing legacy settings cannot be migrated",
  )
})

export const agentSettingSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  label: portableCapabilityText(1),
  description: portableCapabilityText(1),
  kind: z.enum(["select", "boolean", "number", "string", "string-list"]),
  required: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  defaultValue: portableAgentSettingValueSchema.optional(),
  options: z.array(settingOptionSchema).max(256).optional(),
  minimum: z.number().finite().optional(),
  maximum: z.number().finite().optional(),
  truthClass: truthClassSchema,
}).strict().superRefine((setting, context) => {
  if (setting.sensitive && setting.defaultValue !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["defaultValue"],
      message: "Sensitive setting defaults cannot be stored in portable capability snapshots",
    })
  }
  if (setting.kind === "select") {
    if (!setting.options || setting.options.length === 0) {
      context.addIssue({ code: "custom", path: ["options"], message: "Select settings require at least one option" })
    }
  } else if (setting.options !== undefined) {
    context.addIssue({ code: "custom", path: ["options"], message: "Only select settings may declare options" })
  }
  if (setting.kind === "number") {
    if (setting.minimum !== undefined && setting.maximum !== undefined && setting.minimum > setting.maximum) {
      context.addIssue({ code: "custom", path: ["minimum"], message: "Setting minimum cannot exceed maximum" })
    }
  } else if (setting.minimum !== undefined || setting.maximum !== undefined) {
    context.addIssue({ code: "custom", message: "Only number settings may declare numeric bounds" })
  }
  if (setting.defaultValue === undefined) return
  const invalidDefault = (() => {
    switch (setting.kind) {
      case "select":
        return typeof setting.defaultValue !== "string" ||
          !(setting.options ?? []).some((option) => option.value === setting.defaultValue)
      case "boolean":
        return typeof setting.defaultValue !== "boolean"
      case "number":
        return typeof setting.defaultValue !== "number" ||
          !Number.isFinite(setting.defaultValue) ||
          (setting.minimum !== undefined && setting.defaultValue < setting.minimum) ||
          (setting.maximum !== undefined && setting.defaultValue > setting.maximum)
      case "string":
        return typeof setting.defaultValue !== "string" || (setting.required && !setting.defaultValue.trim())
      case "string-list":
        return !Array.isArray(setting.defaultValue) ||
          (setting.required && setting.defaultValue.length === 0) ||
          setting.defaultValue.some((item) => typeof item !== "string" || !item.trim())
    }
  })()
  if (invalidDefault) {
    context.addIssue({ code: "custom", path: ["defaultValue"], message: "Setting default does not satisfy its declaration" })
  }
})

export const modelDescriptorSchema = z.object({
  id: portableCapabilityText(1),
  label: portableCapabilityText(1),
  description: portableCapabilityText().optional(),
  reasoningOptions: z.array(portableCapabilityText()).max(64).default([]),
  contextWindow: z.number().int().positive().optional(),
  inputModalities: z.array(portableCapabilityText()).max(32).default(["text"]),
  truthClass: truthClassSchema,
  alias: z.boolean().default(false),
}).strict()

/** Portable logical capability snapshot. Machine-local runtime bindings live in agent-sdk. */
export const adapterCapabilitiesSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  adapterId: portableCapabilityText(1),
  adapterVersion: portableCapabilityText(1),
  agentId: portableCapabilityText(1),
  agentLabel: portableCapabilityText(1),
  runtimeVersion: portableCapabilityText().optional(),
  detected: z.boolean(),
  executionInterface: z.enum(["cli-jsonl", "cli-stream-json", "stdio-rpc", "managed-in-process", "unavailable"]),
  interfaceMaturity: z.enum(["stable", "beta", "experimental", "unknown"]),
  supportsResume: z.boolean(),
  supportsCancel: z.boolean(),
  supportsCheckpoints: z.boolean(),
  supportsModelDiscovery: z.boolean(),
  supportsToolSelection: z.boolean(),
  settings: z.array(agentSettingSchema).max(256).refine(
    (settings) => new Set(settings.map((setting) => setting.key)).size === settings.length,
    "Capability setting keys must be unique",
  ),
  models: z.array(modelDescriptorSchema).max(512).refine(
    (models) => new Set(models.map((model) => model.id)).size === models.length,
    "Capability model IDs must be unique",
  ),
  limitations: z.array(portableCapabilityText()).max(512),
  observedAt: z.string().datetime(),
}).strict()

/** Backward source alias; the schema itself is now path-free and portable. */
export const adapterCapabilitiesSchema = adapterCapabilitiesSnapshotSchema

/**
 * Read-only compatibility shape for capability snapshots written before the
 * portable capability/runtime-binding split. The executable is deliberately
 * excluded from the current portable snapshot schema.
 */
export const legacyAdapterCapabilitiesV1Schema = adapterCapabilitiesSnapshotSchema
  .omit({ schemaVersion: true })
  .extend({
    schemaVersion: z.literal(1).optional(),
    executablePath: z.string().min(1),
  })
  .strict()

const portableAgentSelectionFields = {
  adapterId: portableCapabilityText(1),
  agentId: portableCapabilityText(1),
  modelId: portableCapabilityText(1),
  modelTruthClass: truthClassSchema.default("configured"),
  modelAlias: z.boolean().nullable().default(null),
  settings: portableSelectionSettingsSchema.default({}),
  selectedAt: z.string().datetime(),
  capabilityDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
}

export const agentSelectionSchema = z.object({
  schemaVersion: z.literal(2),
  ...portableAgentSelectionFields,
}).strict()

/**
 * Read-only compatibility shape for selections written before the portable/local split.
 * It is never embedded in current Charter, Run, or Handoff contracts.
 */
export const legacyAgentSelectionV1Schema = z.object({
  schemaVersion: z.literal(1).optional(),
  runtimeExecutable: z.string().min(1),
  ...portableAgentSelectionFields,
  settings: legacySelectionSettingsSchema.default({}),
}).strict().superRefine((selection, context) => {
  for (const [key, value] of Object.entries(selection.settings)) {
    if (portableAgentSettingValueSchema.safeParse(value).success) continue
    if (
      selection.adapterId === "gaep.codex-cli"
      && selection.agentId === "codex-cli"
      && key === "profile"
      && typeof value === "string"
    ) continue
    context.addIssue({
      code: "custom",
      path: ["settings", key],
      message: "Only the legacy Codex profile setting may contain a machine-local path",
    })
  }
})

export type TruthClass = z.infer<typeof truthClassSchema>
export type PortableAgentSettingValue = z.infer<typeof portableAgentSettingValueSchema>
export type AgentSetting = z.infer<typeof agentSettingSchema>
export type ModelDescriptor = z.infer<typeof modelDescriptorSchema>
export type AdapterCapabilitiesSnapshot = z.infer<typeof adapterCapabilitiesSnapshotSchema>
export type AdapterCapabilities = AdapterCapabilitiesSnapshot
export type LegacyAdapterCapabilitiesV1 = z.infer<typeof legacyAdapterCapabilitiesV1Schema>
export type AgentSelection = z.infer<typeof agentSelectionSchema>
export type LegacyAgentSelectionV1 = z.infer<typeof legacyAgentSelectionV1Schema>
