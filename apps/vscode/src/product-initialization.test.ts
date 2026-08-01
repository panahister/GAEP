import { describe, expect, it } from "vitest"

import { productInitializationPresentation } from "./product-initialization.js"

describe("Product initialization presentation", () => {
  it("allows agent selection only when the governed manifest exists", () => {
    expect(productInitializationPresentation(true, true)).toEqual({ state: "initialized" })
  })

  it("offers explicit initialization for a clean workspace instead of exposing ENOENT", () => {
    expect(productInitializationPresentation(false, false)).toEqual({
      state: "uninitialized",
      message: "This workspace folder is not a GAEP Product yet. Initialize Product before selecting an agent or model.",
      action: "Initialize Product",
    })
  })

  it("fails closed on partial GAEP state and routes to diagnostics", () => {
    expect(productInitializationPresentation(true, false)).toEqual({
      state: "partial",
      message: "This folder contains partial GAEP state but no .gaep/manifest.json. Initialization is disabled to preserve that state; inspect diagnostics before continuing.",
      action: "Show Diagnostics",
    })
  })
})
