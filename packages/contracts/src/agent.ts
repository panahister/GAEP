import { z } from "zod"

export const truthClassSchema = z.enum([
  "observed",
  "provider-declared",
  "configured",
  "inferred",
  "unknown",
])

export const settingOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
})

export const agentSettingSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  label: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(["select", "boolean", "number", "string", "string-list"]),
  required: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  options: z.array(settingOptionSchema).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  truthClass: truthClassSchema,
})

export const modelDescriptorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  reasoningOptions: z.array(z.string()).default([]),
  contextWindow: z.number().int().positive().optional(),
  inputModalities: z.array(z.string()).default(["text"]),
  truthClass: truthClassSchema,
  alias: z.boolean().default(false),
})

export const adapterCapabilitiesSchema = z.object({
  adapterId: z.string().min(1),
  adapterVersion: z.string().min(1),
  agentId: z.string().min(1),
  agentLabel: z.string().min(1),
  runtimeVersion: z.string().optional(),
  executablePath: z.string().optional(),
  detected: z.boolean(),
  executionInterface: z.enum(["cli-jsonl", "cli-stream-json", "stdio-rpc", "unavailable"]),
  interfaceMaturity: z.enum(["stable", "beta", "experimental", "unknown"]),
  supportsResume: z.boolean(),
  supportsCancel: z.boolean(),
  supportsCheckpoints: z.boolean(),
  supportsModelDiscovery: z.boolean(),
  supportsToolSelection: z.boolean(),
  settings: z.array(agentSettingSchema),
  models: z.array(modelDescriptorSchema),
  limitations: z.array(z.string()),
  observedAt: z.string().datetime(),
})

export const agentSelectionSchema = z.object({
  adapterId: z.string().min(1),
  agentId: z.string().min(1),
  runtimeExecutable: z.string().min(1),
  modelId: z.string().min(1),
  modelTruthClass: truthClassSchema.default("configured"),
  modelAlias: z.boolean().nullable().default(null),
  settings: z.record(z.string(), z.unknown()).default({}),
  selectedAt: z.string().datetime(),
  capabilityDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
})

export type TruthClass = z.infer<typeof truthClassSchema>
export type AgentSetting = z.infer<typeof agentSettingSchema>
export type ModelDescriptor = z.infer<typeof modelDescriptorSchema>
export type AdapterCapabilities = z.infer<typeof adapterCapabilitiesSchema>
export type AgentSelection = z.infer<typeof agentSelectionSchema>
