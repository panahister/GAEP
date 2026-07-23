import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("VS Code portable/local source boundary", () => {
  it("does not restore path-bearing selection or capability assumptions", async () => {
    const [extension, studio, tree] = await Promise.all([
      readFile(new URL("./extension.ts", import.meta.url), "utf8"),
      readFile(new URL("./current-engine-studio-data-source.ts", import.meta.url), "utf8"),
      readFile(new URL("./tree.ts", import.meta.url), "utf8"),
    ])

    expect(extension).not.toMatch(/currentSelection\.runtimeExecutable/u)
    expect(extension).not.toMatch(/capabilit(?:y|ies)\.executablePath/u)
    expect(extension).not.toContain("scope: [runtime.path]")
    expect(studio).not.toContain("runtimeExecutable")
    expect(tree).not.toContain("runtimeExecutable")
  })

  it("keeps executable-path access attached to the explicit machine-local probe binding", async () => {
    const extension = await readFile(new URL("./extension.ts", import.meta.url), "utf8")
    const pathReads = extension.match(/[A-Za-z0-9_.]+\.executablePath/gu) ?? []
    expect(pathReads).toEqual(["runtimeBinding.executablePath"])
    expect(extension).toContain('const runtimeBindingsKey = "gaep.runtimeBindings.v2"')
  })

  it("declares the explicit legacy migration command", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
      activationEvents: string[]
      contributes: { commands: Array<{ command: string }> }
    }
    expect(packageJson.activationEvents).toContain("onCommand:gaep.migrateLegacyAgentSelection")
    expect(packageJson.contributes.commands).toContainEqual({
      command: "gaep.migrateLegacyAgentSelection",
      title: "GAEP: Review and Normalize Legacy Agent Selection",
    })
  })
})
