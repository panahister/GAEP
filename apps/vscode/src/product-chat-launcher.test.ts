import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  productChatLauncherCommands,
  resolveProductChatLauncherCommand,
  shouldStartFreshProductChatSession,
  shouldSubmitProductChatLauncher,
} from "./product-chat-launcher.js"

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
    expect(resolveProductChatLauncherCommand("inspect")).toBe("inspect")
  })

  it("routes every literal Product Chat button target instead of silently falling back to help", () => {
    const participantSource = readFileSync(new URL("./product-chat-participant.ts", import.meta.url), "utf8")
    const targets = Array.from(participantSource.matchAll(
      /response\.button\(\{\s*command:\s*"gaep\.openInteractiveChat"[^}]*?arguments:\s*\["([^"]+)"/g,
    ), (match) => match[1])

    expect(targets.length).toBeGreaterThan(0)
    for (const target of targets) {
      expect(resolveProductChatLauncherCommand(target), `Product Chat button target /${target}`).toBe(target)
    }
  })

  it("keeps the status response highlighted-roadmap-first and includes a rendered Mermaid journey", () => {
    const participantSource = readFileSync(new URL("./product-chat-participant.ts", import.meta.url), "utf8")
    const roadmapSource = readFileSync(new URL("./product-journey-roadmap.ts", import.meta.url), "utf8")

    expect(participantSource).toContain('markdownTable(["Checkpoint", "State", "Recorded detail"]')
    expect(participantSource).toContain("productJourneyRoadmapDiagram(journeyNodes, currentIndex, nextIndex)")
    expect(participantSource).toContain("**You are here:**")
    expect(roadmapSource).toContain('"```mermaid"')
    expect(roadmapSource).toContain('"flowchart TD"')
    expect(roadmapSource).toContain("classDef current")
    expect(participantSource).toContain('title: "Open Conversation Outline"')
    expect(participantSource).toContain("P0–P4 readiness and handoff")
    expect(participantSource).not.toContain("new Proxy(response")
  })

  it("routes file and folder pickers back into Existing Product fast-start", () => {
    const participantSource = readFileSync(new URL("./product-chat-participant.ts", import.meta.url), "utf8")

    expect(participantSource).toContain('command: "gaep.chooseFolder", title: "Choose Product Folder", arguments: ["adopt"]')
    expect(participantSource).toContain('command: "gaep.chooseFile", title: "Choose Product Files", arguments: ["adopt"]')
    expect(participantSource).toContain('title: "Commit Reviewed Product", arguments: ["commit", "CONFIRM"]')
    expect(participantSource).toContain('title: "Review Checkpoint Details", arguments: ["adopt", "review"]')
    expect(participantSource).not.toContain('title: "Edit Proposed Fields"')
  })

  it("uses initialization only for an argument-free launcher and routes untrusted input to help", () => {
    expect(resolveProductChatLauncherCommand(undefined)).toBe("initialize")
    expect(resolveProductChatLauncherCommand("unknown-command")).toBe("help")
    expect(resolveProductChatLauncherCommand({ command: "classification" })).toBe("help")
  })

  it("submits explicit lifecycle actions while preserving an argument-free editable launcher", () => {
    expect(shouldSubmitProductChatLauncher("author")).toBe(true)
    expect(shouldSubmitProductChatLauncher("baseline")).toBe(true)
    expect(shouldSubmitProductChatLauncher(undefined)).toBe(false)
    expect(shouldSubmitProductChatLauncher("unknown-command")).toBe(false)
    expect(shouldSubmitProductChatLauncher("author", false)).toBe(false)
    expect(shouldSubmitProductChatLauncher(undefined, true)).toBe(true)
  })

  it("never starts a new Chat for an action that depends on the visible draft", () => {
    for (const command of ["accept", "back", "cancel", "commit", "inspect", "manifest", "record", "resolve", "review", "roles", "suggest"]) {
      expect(shouldStartFreshProductChatSession(command, true), `/${command}`).toBe(false)
    }
    expect(shouldStartFreshProductChatSession("author", true)).toBe(true)
    expect(shouldStartFreshProductChatSession("adopt", true)).toBe(true)
    expect(shouldStartFreshProductChatSession("accept", false)).toBe(false)
  })

  it("does not mark proposal acceptance or commit buttons as fresh-session actions", () => {
    const participantSource = readFileSync(new URL("./product-chat-participant.ts", import.meta.url), "utf8")

    expect(participantSource).not.toMatch(/arguments:\s*\["accept"[^\]]*,\s*true\]/u)
    expect(participantSource).not.toMatch(/arguments:\s*\["commit"[^\]]*,\s*true\]/u)
  })

  it("uses the same explicit proposal, accept, and commit boundary across adopted checkpoints", () => {
    const participantSource = readFileSync(new URL("./product-chat-participant.ts", import.meta.url), "utf8")

    expect(participantSource).toContain("startSourceFoundationProposal")
    expect(participantSource).toContain("acceptSourceFoundationProposal")
    expect(participantSource).toContain('candidateCreation === "product-discovery"')
    expect(participantSource).toContain('candidateCreation === "business-architecture"')
    expect(participantSource).toContain('candidateCreation === "solution-security-architecture"')
    expect(participantSource).toContain('candidateCreation === "detailed-design-assurance"')
    expect(participantSource).toContain('candidateCreation === "design-implementation-handoff"')
    expect(participantSource).toContain("Accept the exact ${markdownValue(currentDraft.target.label)} proposal first")
    expect(participantSource).not.toContain("Review and Record ${target.label}")
  })
})
