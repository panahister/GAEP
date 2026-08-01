import { describe, expect, it } from "vitest"

import {
  estimateGaepWorkflowTokens,
  gaepWorkflowLanguageModelDescriptor,
  gaepWorkflowLanguageModelVendor,
} from "./gaep-workflow-language-model-contract.js"

describe("GAEP local workflow language model", () => {
  it("declares a truthful non-generative, non-tool-calling local model", () => {
    expect(gaepWorkflowLanguageModelVendor).toBe("gaep-workflow")
    expect(gaepWorkflowLanguageModelDescriptor).toMatchObject({
      id: "governed-workflow",
      family: "gaep-deterministic-workflow",
      detail: "Local · no AI request",
      capabilities: { imageInput: false, toolCalling: false },
    })
  })

  it("provides a deterministic positive token estimate", () => {
    expect(estimateGaepWorkflowTokens("")).toBe(1)
    expect(estimateGaepWorkflowTokens("1234")).toBe(1)
    expect(estimateGaepWorkflowTokens("12345")).toBe(2)
  })
})
