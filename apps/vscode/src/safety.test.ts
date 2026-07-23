import type { AgentSetting, Initiative } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import {
  constrainedSetting,
  currentInitiative,
  filteredAgentEnvironment,
  initiativeRunEligibility,
  machineScopedSettingValue,
  unsafeSelectionReasons,
} from "./safety.js"

describe("VS Code stop-line safety helpers", () => {
  it("removes provider modes that bypass the Founder Edition safety boundary", () => {
    const setting: AgentSetting = {
      key: "sandbox",
      label: "Sandbox",
      description: "Provider sandbox",
      kind: "select",
      required: true,
      sensitive: false,
      options: ["read-only", "workspace-write", "danger-full-access"].map((value) => ({ value, label: value })),
      truthClass: "provider-declared",
    }
    expect(constrainedSetting("codex-cli", setting).options?.map((option) => option.value))
      .toEqual(["read-only"])
    expect(unsafeSelectionReasons("codex-cli", {
      sandbox: "danger-full-access",
    })).toHaveLength(1)
    expect(unsafeSelectionReasons("codex-cli", {
      sandbox: "read-only",
    })).toEqual([])
    expect(unsafeSelectionReasons("codex-cli", {
      sandbox: "read-only",
      search: true,
    })).toHaveLength(1)

    const permissionSetting: AgentSetting = {
      ...setting,
      key: "permissionMode",
      label: "Permission mode",
      options: ["default", "acceptEdits", "auto", "dontAsk", "plan"].map((value) => ({ value, label: value })),
    }
    expect(constrainedSetting("claude-code-cli", permissionSetting).options?.map((option) => option.value))
      .toEqual(["default", "plan"])
  })

  it("does not inherit secret-bearing environment variables into an agent process", () => {
    const filtered = filteredAgentEnvironment({
      PATH: "/usr/bin",
      HOME: "/tmp/home",
      OPENAI_API_KEY: "secret",
      SERVICE_TOKEN: "secret",
      LC_ALL: "C",
    }, { ANTHROPIC_API_KEY: "secret", TERM: "xterm-256color" })
    expect(filtered).toEqual({
      PATH: "/usr/bin",
      HOME: "/tmp/home",
      LC_ALL: "C",
      TERM: "xterm-256color",
    })
  })

  it("ignores executable overrides supplied by a workspace or workspace folder", () => {
    expect(machineScopedSettingValue({
      defaultValue: "codex",
      globalValue: "/trusted/codex",
      workspaceValue: "/workspace/untrusted-codex",
      workspaceFolderValue: "/folder/untrusted-codex",
    }, "codex")).toBe("/trusted/codex")
  })

  it("selects an active or blocked Initiative ahead of closed work", () => {
    const makeInitiative = (state: Initiative["state"], updatedAt: string): Initiative => ({
      schemaVersion: 1,
      id: crypto.randomUUID(),
      kind: "initiative",
      productId: crypto.randomUUID(),
      title: state,
      outcome: "A bounded outcome",
      scope: ["Bounded scope"],
      exclusions: [],
      state,
      createdAt: updatedAt,
      updatedAt,
    })
    const selected = currentInitiative([
      makeInitiative("completed", "2026-07-21T10:00:00.000Z"),
      makeInitiative("active", "2026-07-20T10:00:00.000Z"),
      makeInitiative("blocked", "2026-07-21T11:00:00.000Z"),
    ])
    expect(selected?.state).toBe("active")
    expect(initiativeRunEligibility(selected!)).toEqual({ eligible: true })
    expect(initiativeRunEligibility(makeInitiative("proposed", "2026-07-21T12:00:00.000Z")))
      .toEqual({ eligible: false, reason: "Activate this proposed Initiative before preparing a run." })
  })
})
