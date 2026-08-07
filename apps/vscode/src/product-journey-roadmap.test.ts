import { describe, expect, it } from "vitest"

import { productJourneyRoadmapDiagram } from "./product-journey-roadmap.js"

const nodes = [
  { id: "P", label: "Product definition", done: true },
  { id: "I", label: "Initiative definition", done: true },
  { id: "C", label: "Initiative classification", done: false },
  { id: "A", label: "Initiative applicability", done: false },
]

describe("productJourneyRoadmapDiagram", () => {
  it("highlights done, current, and next checkpoints distinctly", () => {
    const diagram = productJourneyRoadmapDiagram(nodes, 2, 3)
    expect(diagram).toContain("```mermaid")
    expect(diagram).toContain("flowchart TD")
    // Done checkpoints keep the check marker and the done class.
    expect(diagram).toContain('P["✓ Product definition"]')
    expect(diagram).toContain("class P,I done;")
    // Current checkpoint is arrowed and styled current.
    expect(diagram).toContain('C["→ Initiative classification"]')
    expect(diagram).toContain("class C current;")
    // Next checkpoint is bulleted and styled next.
    expect(diagram).toContain('A["• Initiative applicability"]')
    expect(diagram).toContain("class A next;")
    // Edges connect the sequence.
    expect(diagram).toContain("P --> I")
    expect(diagram).toContain("C --> A")
  })

  it("emits no current/next classes when all checkpoints are recorded", () => {
    const diagram = productJourneyRoadmapDiagram(nodes.map((node) => ({ ...node, done: true })), -1, -1)
    expect(diagram).toContain("class P,I,C,A done;")
    expect(diagram).not.toContain("current;")
    expect(diagram).not.toContain("next;")
  })

  it("sanitizes labels that would break Mermaid node syntax", () => {
    const diagram = productJourneyRoadmapDiagram([{ id: "X", label: 'Bad "label" <b>|pipe', done: false }], 0, -1)
    expect(diagram).not.toContain('"label"')
    expect(diagram).not.toContain("|pipe")
  })
})
