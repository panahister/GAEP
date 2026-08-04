import { describe, expect, it } from "vitest"

import { productChatConversationOutlineHtml } from "./product-chat-conversation-outline.js"

describe("Product Chat conversation outline", () => {
  it("links every outline row to the exact beginning of its transcript turn", () => {
    const html = productChatConversationOutlineHtml([
      { command: "adopt", prompt: "Review the Doc folder", response: "Adoption proposal" },
      { command: "commit", prompt: "CONFIRM", response: "Product recorded" },
    ])

    expect(html).toContain('href="#turn-1"')
    expect(html).toContain('id="turn-1"')
    expect(html).toContain('href="#turn-2"')
    expect(html).toContain('id="turn-2"')
    expect(html).toContain("/adopt · Review the Doc folder")
    expect(html).toContain("/commit · CONFIRM")
  })

  it("escapes user and advisor content and states the session-only trust boundary", () => {
    const html = productChatConversationOutlineHtml([
      { prompt: "<script>unsafe()</script>", response: "A & B" },
    ])

    expect(html).not.toContain("<script>unsafe()</script>")
    expect(html).toContain("&lt;script&gt;unsafe()&lt;/script&gt;")
    expect(html).toContain("A &amp; B")
    expect(html).toContain("not a governed Source or Evidence record")
  })
})
