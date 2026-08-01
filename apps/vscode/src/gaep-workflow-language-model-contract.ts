export const gaepWorkflowLanguageModelVendor = "gaep-workflow"

export const gaepWorkflowLanguageModelDescriptor = {
  id: "governed-workflow",
  name: "GAEP Governed Workflow",
  family: "gaep-deterministic-workflow",
  version: "1",
  tooltip: "Local deterministic model used only to enter GAEP governed conversational workflows without a third-party Chat model.",
  detail: "Local · no AI request",
  maxInputTokens: 8192,
  maxOutputTokens: 2048,
  capabilities: {
    imageInput: false,
    toolCalling: false,
  },
} as const

export function estimateGaepWorkflowTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4))
}
