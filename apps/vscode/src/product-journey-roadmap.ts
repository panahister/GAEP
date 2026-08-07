/**
 * Render the twelve-checkpoint Product Journey as a highlighted Mermaid roadmap
 * so a newcomer can see, at a glance, what is done, where they are, and what is
 * next — reducing chat overwhelm and drop-off. `currentIndex`/`nextIndex` are
 * -1 when there is no active or next checkpoint (e.g. all recorded).
 */
export interface ProductJourneyRoadmapNode {
  readonly id: string
  readonly label: string
  readonly done: boolean
}

export function productJourneyRoadmapDiagram(
  nodes: ReadonlyArray<ProductJourneyRoadmapNode>,
  currentIndex: number,
  nextIndex: number,
): string {
  const marker = (index: number, done: boolean): string =>
    done ? "✓" : index === currentIndex ? "→" : index === nextIndex ? "•" : "○"
  const safe = (label: string): string => label.replace(/["<>|]/gu, " ")
  const lines = ["```mermaid", "flowchart TD"]
  nodes.forEach((node, index) => {
    lines.push(`  ${node.id}["${marker(index, node.done)} ${safe(node.label)}"]`)
    if (index > 0) lines.push(`  ${nodes[index - 1]!.id} --> ${node.id}`)
  })
  const doneIds = nodes.filter((node, index) => node.done && index !== currentIndex).map((node) => node.id)
  lines.push(
    "  classDef done fill:#1f7a33,color:#ffffff,stroke:#145223;",
    "  classDef current fill:#0b5fff,color:#ffffff,stroke:#0740a8,stroke-width:2px;",
    "  classDef next fill:#f4a100,color:#1b1b1b,stroke:#a86e00;",
  )
  if (doneIds.length > 0) lines.push(`  class ${doneIds.join(",")} done;`)
  if (currentIndex >= 0 && nodes[currentIndex]) lines.push(`  class ${nodes[currentIndex]!.id} current;`)
  if (nextIndex >= 0 && nodes[nextIndex]) lines.push(`  class ${nodes[nextIndex]!.id} next;`)
  lines.push("```")
  return lines.join("\n")
}
