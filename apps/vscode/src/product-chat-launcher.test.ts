import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { productChatLauncherCommands, resolveProductChatLauncherCommand } from "./product-chat-launcher.js"

describe("Product Chat launcher", () => {
  it("routes every slash command contributed by the GAEP chat participant", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      contributes: { chatParticipants: Array<{ id: string; commands: Array<{ name: string }> }> }
    }
    const contributed = packageJson.contributes.chatParticipants
      .find((participant) => participant.id === "gaep.product")
      ?.commands.map((command) => command.name)

    expect(productChatLauncherCommands).toEqual(contributed)
  })

  it("routes every declared lifecycle command without silently falling back to initialization", () => {
    for (const command of productChatLauncherCommands) {
      expect(resolveProductChatLauncherCommand(command)).toBe(command)
    }
    expect(resolveProductChatLauncherCommand("classification")).toBe("classification")
    expect(resolveProductChatLauncherCommand("resolve")).toBe("resolve")
    expect(resolveProductChatLauncherCommand("manifest")).toBe("manifest")
    expect(resolveProductChatLauncherCommand("adopt")).toBe("adopt")
    expect(resolveProductChatLauncherCommand("edit")).toBe("edit")
  })

  it("routes every literal Product Chat button target instead of silently falling back to help", () => {
    const participantSource = readFileSync(new URL("./product-chat-participant.ts", import.meta.url), "utf8")
    const targets = Array.from(participantSource.matchAll(
      /response\.button\(\{\s*command:\s*"gaep\.openInteractiveChat"[\s\S]*?arguments:\s*\["([^"]+)"/g,
    ), (match) => match[1])

    expect(targets.length).toBeGreaterThan(0)
    for (const target of targets) {
      expect(resolveProductChatLauncherCommand(target), `Product Chat button target /${target}`).toBe(target)
    }
  })

  it("keeps the status response table-first and includes a rendered Mermaid journey", () => {
    const participantSource = readFileSync(new URL("./product-chat-participant.ts", import.meta.url), "utf8")

    expect(participantSource).toContain('markdownTable(["Checkpoint", "State", "Recorded detail"]')
    expect(participantSource).toContain('"```mermaid"')
    expect(participantSource).toContain('"flowchart LR"')
    expect(participantSource).toContain('title: "Open Conversation Outline"')
    expect(participantSource).toContain("P0–P4 readiness and P5 handoff")
    expect(participantSource).not.toContain("new Proxy(response")
  })

  it("routes file and folder pickers back into Existing Product fast-start", () => {
    const participantSource = readFileSync(new URL("./product-chat-participant.ts", import.meta.url), "utf8")

    expect(participantSource).toContain('command: "gaep.chooseFolder", title: "Choose Product Folder", arguments: ["adopt"]')
    expect(participantSource).toContain('command: "gaep.chooseFile", title: "Choose Product Files", arguments: ["adopt"]')
    expect(participantSource).toContain('title: "Commit Reviewed Product", arguments: ["commit", "CONFIRM"]')
  })

  it("uses initialization only for an argument-free launcher and routes untrusted input to help", () => {
    expect(resolveProductChatLauncherCommand(undefined)).toBe("initialize")
    expect(resolveProductChatLauncherCommand("unknown-command")).toBe("help")
    expect(resolveProductChatLauncherCommand({ command: "classification" })).toBe("help")
  })
})
