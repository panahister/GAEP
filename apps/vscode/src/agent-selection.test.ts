import type { AdapterProbeResult } from "@gaep/agent-sdk"
import type { AdapterCapabilities } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import {
  allowsCustomModelIdentifier,
  exactSelectionReviewCharacterLimit,
  exactSelectionReviewText,
  materialSelectionChange,
  probeSelectionEligibility,
  selectionSwitchBlockers,
  settingForSelectedModel,
} from "./agent-selection.js"

const capabilities = (overrides: Partial<AdapterCapabilities> = {}): AdapterCapabilities => ({
  schemaVersion: 1,
  adapterId: "gaep.codex-cli",
  adapterVersion: "0.1.0",
  agentId: "codex-cli",
  agentLabel: "Codex",
  runtimeVersion: "1",
  detected: true,
  executionInterface: "stdio-rpc",
  interfaceMaturity: "stable",
  supportsResume: true,
  supportsCancel: true,
  supportsCheckpoints: false,
  supportsModelDiscovery: true,
  supportsToolSelection: true,
  settings: [],
  models: [],
  limitations: [],
  observedAt: "2026-07-23T00:00:00.000Z",
  ...overrides,
})

const executableProbe = (): AdapterProbeResult => ({
  capabilities: capabilities(),
  runtimeBinding: {
    scope: "machine-local",
    kind: "executable",
    adapterId: "gaep.codex-cli",
    agentId: "codex-cli",
    executablePath: "/opt/gaep/codex",
    executableFingerprint: {
      requested: "codex",
      canonicalPath: "/opt/gaep/codex",
      digest: `sha256:${"a".repeat(64)}`,
      size: 42,
      modifiedAtMs: 1,
    },
  },
})

describe("VS Code agent selection boundary", () => {
  it("renders exact reviews without truncation and rejects oversized content", () => {
    expect(exactSelectionReviewText(["one", "two"])).toBe("one\n\ntwo")
    expect(() => exactSelectionReviewText(["x".repeat(exactSelectionReviewCharacterLimit + 1)]))
      .toThrow(/exceeds.*review limit/i)
  })

  it("accepts exact executable and deterministic managed-in-process bindings", () => {
    expect(probeSelectionEligibility(executableProbe())).toEqual({ selectable: true, runtimeKind: "executable" })
    const manual: AdapterProbeResult = {
      capabilities: capabilities({
        adapterId: "gaep.manual",
        agentId: "manual",
        agentLabel: "Deterministic Manual Agent",
        executionInterface: "managed-in-process",
        supportsToolSelection: false,
      }),
      runtimeBinding: {
        scope: "machine-local",
        kind: "managed-in-process",
        adapterId: "gaep.manual",
        agentId: "manual",
        runtimeId: "gaep.manual",
      },
    }
    expect(probeSelectionEligibility(manual)).toEqual({ selectable: true, runtimeKind: "managed-in-process" })
    expect(allowsCustomModelIdentifier(manual.capabilities)).toBe(false)
    expect(allowsCustomModelIdentifier(executableProbe().capabilities)).toBe(true)
    expect(allowsCustomModelIdentifier(capabilities({ adapterId: "gaep.future" }))).toBe(false)
  })

  it("rejects unavailable, mismatched, and malformed runtime bindings", () => {
    expect(probeSelectionEligibility({
      capabilities: capabilities({ detected: false, executionInterface: "unavailable" }),
      runtimeBinding: {
        scope: "machine-local",
        kind: "unavailable",
        adapterId: "gaep.codex-cli",
        agentId: "codex-cli",
        reason: "not found",
      },
    })).toMatchObject({ selectable: false })
    expect(probeSelectionEligibility({
      ...executableProbe(),
      runtimeBinding: { ...executableProbe().runtimeBinding, agentId: "other" },
    })).toMatchObject({ selectable: false, reason: expect.stringMatching(/inconsistent.*identity/i) })
    const malformed = executableProbe()
    if (malformed.runtimeBinding.kind !== "executable") throw new Error("Expected executable fixture")
    malformed.runtimeBinding.executableFingerprint.canonicalPath = "/different/path"
    expect(probeSelectionEligibility(malformed)).toMatchObject({ selectable: false, reason: expect.stringMatching(/fingerprint/i) })
  })

  it("limits known-provider effort choices to the selected model", () => {
    const setting = {
      key: "reasoningEffort",
      label: "Reasoning effort",
      description: "Effort",
      kind: "select" as const,
      required: false,
      sensitive: false,
      options: ["low", "medium", "high"].map((value) => ({ value, label: value })),
      truthClass: "observed" as const,
    }
    const model = {
      id: "gpt-test",
      label: "GPT Test",
      reasoningOptions: ["low", "high"],
      inputModalities: ["text"],
      truthClass: "observed" as const,
      alias: false,
    }
    expect(settingForSelectedModel("gaep.codex-cli", setting, model)?.options?.map((option) => option.value))
      .toEqual(["low", "high"])
    expect(settingForSelectedModel("gaep.future", setting, model)).toEqual(setting)
    expect(settingForSelectedModel("gaep.codex-cli", setting, undefined)).toEqual(setting)
  })

  it("blocks switching for prepared, active, unknown, and review-bearing work", () => {
    expect(selectionSwitchBlockers({
      activeRoot: true,
      runs: [
        { id: "prepared-run", state: "prepared" },
        { id: "completed-run", state: "completed" },
        { id: "unknown-run", state: "unknown" },
      ],
      managedRuns: [
        { id: "active-managed", state: "running" },
        { id: "settled-managed", state: "completed" },
        { id: "review-managed", state: "review-required" },
      ],
      pendingReviews: [{ managedRunId: "review-managed", state: "review-required" }],
    })).toEqual(expect.arrayContaining([
      expect.stringMatching(/active provider session/i),
      expect.stringMatching(/prepared-run.*prepared/i),
      expect.stringMatching(/unknown-run.*unknown/i),
      expect.stringMatching(/active-managed.*running/i),
      expect.stringMatching(/review-managed.*unresolved/i),
    ]))
  })

  it.each(["prepared", "running", "paused", "unknown"] as const)(
    "blocks switching for legacy Run state %s",
    (state) => {
      expect(selectionSwitchBlockers({
        activeRoot: false,
        runs: [{ id: `legacy-${state}`, state }],
        managedRuns: [],
        pendingReviews: [],
      })).toEqual([expect.stringMatching(new RegExp(`legacy-${state}.*${state}`, "i"))])
    },
  )

  it.each(["prepared", "running", "review-required", "applying", "unknown", "conflict"] as const)(
    "blocks switching for Managed Run state %s even without an in-memory review",
    (state) => {
      expect(selectionSwitchBlockers({
        activeRoot: false,
        runs: [],
        managedRuns: [{ id: `managed-${state}`, state }],
        pendingReviews: [],
      })).toEqual([expect.stringMatching(new RegExp(`managed-${state}.*${state}`, "i"))])
    },
  )

  it("permits switching after all work and reviews are terminal", () => {
    expect(selectionSwitchBlockers({
      activeRoot: false,
      runs: [{ id: "completed-run", state: "completed" }],
      managedRuns: [
        { id: "completed-managed", state: "completed" },
        { id: "failed-managed", state: "failed" },
        { id: "cancelled-managed", state: "cancelled" },
        { id: "timed-out-managed", state: "timed-out" },
        { id: "discarded-managed", state: "discarded" },
      ],
      pendingReviews: [],
    })).toEqual([])
  })

  it("compares material selection canonically and ignores selectedAt", () => {
    const current = {
      schemaVersion: 2 as const,
      adapterId: "gaep.codex-cli",
      agentId: "codex-cli",
      modelId: "gpt-test",
      modelTruthClass: "observed" as const,
      modelAlias: false,
      settings: { reasoningEffort: "high", optional: true },
      selectedAt: "2026-07-23T00:00:00.000Z",
      capabilityDigest: `sha256:${"a".repeat(64)}` as const,
    }
    expect(materialSelectionChange(current, {
      ...current,
      settings: { optional: true, reasoningEffort: "high" },
    })).toBe(false)
    expect(materialSelectionChange(current, { ...current, settings: { reasoningEffort: "low", optional: true } })).toBe(true)
    expect(materialSelectionChange(current, { ...current, capabilityDigest: `sha256:${"b".repeat(64)}` })).toBe(true)
    expect(materialSelectionChange({ ...current, selectedAt: "2027-01-01T00:00:00.000Z" }, current)).toBe(false)
  })
})
