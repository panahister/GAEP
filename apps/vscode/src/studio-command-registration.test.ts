import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import { studioDomainWorkflows } from "./studio-protocol.js"

interface ExtensionManifest {
  contributes?: {
    commands?: Array<{ command: string; title: string }>
  }
}

describe("Product Studio Command Palette coverage", () => {
  it("contributes every Product-domain workflow and each design/inspection operation", async () => {
    const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as ExtensionManifest
    const commands = new Map((manifest.contributes?.commands ?? []).map((entry) => [entry.command, entry.title]))

    for (const workflow of studioDomainWorkflows) {
      const command = `gaep.productStudio.${workflow.replaceAll("-", ".")}`
      expect(commands.has(command), command).toBe(true)
      expect(commands.get(command), command).toMatch(/^GAEP Product Studio:/)
    }

    for (const command of [
      "gaep.classifyInitiative",
      "gaep.resolveInitiativeApplicability",
      "gaep.productStudio.startDesignDraft",
      "gaep.productStudio.editDesignSection",
      "gaep.productStudio.evaluateDesignReadiness",
      "gaep.productStudio.createDesignRevision",
      "gaep.productStudio.inspectRecord",
      "gaep.productStudio.analyzeImpact",
    ]) expect(commands.has(command), command).toBe(true)
  })
})
