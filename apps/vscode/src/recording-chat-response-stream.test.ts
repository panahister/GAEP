import { describe, expect, it, vi } from "vitest"

import { createRecordingChatResponseStream } from "./recording-chat-response-stream.js"

describe("recording Chat response stream", () => {
  it("uses a plain forwarding object and records Markdown without proxying the host stream", () => {
    const markdown = vi.fn()
    const button = vi.fn()
    const host = Object.freeze({
      markdown,
      anchor: vi.fn(),
      button,
      filetree: vi.fn(),
      progress: vi.fn(),
      reference: vi.fn(),
      push: vi.fn(),
    })
    const recorded: string[] = []
    const stream = createRecordingChatResponseStream(host as never, (value) => recorded.push(value))

    stream.markdown("Rendered response")
    stream.button({ command: "gaep.openConversationOutline", title: "Open Conversation Outline" })

    expect(recorded).toEqual(["Rendered response"])
    expect(markdown).toHaveBeenCalledWith("Rendered response")
    expect(button).toHaveBeenCalledOnce()
    expect(stream).not.toBe(host)
  })
})
