import { describe, expect, it } from "vitest"

import {
  maximumPendingProductChatFiles,
  ProductChatFileSelection,
} from "./product-chat-file-selection.js"

describe("Product Chat Choose File selection", () => {
  it("keeps one bounded in-memory selection and consumes it exactly once", () => {
    const selection = new ProductChatFileSelection<string>()
    expect(selection.stage(Array.from({ length: 25 }, (_, index) => `file-${index}`)))
      .toBe(maximumPendingProductChatFiles)
    expect(selection.take()).toEqual(Array.from({ length: 20 }, (_, index) => `file-${index}`))
    expect(selection.take()).toEqual([])
  })

  it("replaces and clears an earlier unconsumed selection", () => {
    const selection = new ProductChatFileSelection<string>()
    selection.stage(["old"])
    selection.stage(["new"])
    expect(selection.take()).toEqual(["new"])
    selection.stage(["discarded"])
    selection.clear()
    expect(selection.take()).toEqual([])
  })
})
