import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import { studioDomainWorkflows } from "./studio-protocol.js"

interface ExtensionManifest {
  activationEvents?: string[]
  contributes?: {
    commands?: Array<{ command: string; title: string }>
    views?: Record<string, Array<{ id: string; name: string }>>
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

  it("gives every command and native view a unique bounded accessible name", async () => {
    const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as ExtensionManifest
    const commands = manifest.contributes?.commands ?? []
    expect(commands.length).toBeGreaterThanOrEqual(40)
    expect(new Set(commands.map(({ command }) => command)).size).toBe(commands.length)
    for (const { command, title } of commands) {
      expect(command).toMatch(/^gaep\.[a-zA-Z0-9.]+$/)
      expect(title.trim().length, command).toBeGreaterThan(3)
      expect(title.length, command).toBeLessThanOrEqual(160)
    }

    const views = manifest.contributes?.views?.gaep ?? []
    expect(views).toEqual([
      { id: "gaep.overview", name: "Product" },
      { id: "gaep.agent", name: "Agent" },
      { id: "gaep.governance", name: "Governance" },
      { id: "gaep.runs", name: "Runs" },
    ])
    const activationEvents = new Set(manifest.activationEvents ?? [])
    for (const { id, name } of views) {
      expect(name.trim().length, id).toBeGreaterThan(0)
      expect(activationEvents.has(`onView:${id}`), id).toBe(true)
    }
    expect(activationEvents.has("onWebviewPanel:gaep.productStudio")).toBe(true)
  })
})
