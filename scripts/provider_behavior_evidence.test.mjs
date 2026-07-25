import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  providerBehaviorDefinitionDigest,
  providerBehaviorSourceSnapshot,
  verifyProviderBehaviorEvidence,
} from "./lib/provider_behavior_evidence.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const digestPattern = /^sha256:[0-9a-f]{64}$/u
const receiptPath = resolve(repositoryRoot, "evidence/ide-smokes/2026-07-25T015113Z-phase-1-entry-foundation-provider-behavior.json")

test("binds exact distinct Codex and Claude deterministic contract sources", async () => {
  assert.match(providerBehaviorDefinitionDigest(), digestPattern)
  const [codex, claude] = await Promise.all([
    providerBehaviorSourceSnapshot({ repositoryRoot, providerId: "codex" }),
    providerBehaviorSourceSnapshot({ repositoryRoot, providerId: "claude" }),
  ])
  assert.match(codex, digestPattern)
  assert.match(claude, digestPattern)
  assert.notEqual(codex, claude)
})

test("rejects unknown provider identities", async () => {
  await assert.rejects(
    providerBehaviorSourceSnapshot({ repositoryRoot, providerId: "unknown" }),
    /definition is missing/u,
  )
})

test("accepts the sealed provider receipt and rejects a forged live-acceptance claim", async () => {
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"))
  const verified = await verifyProviderBehaviorEvidence({ repositoryRoot, receipt })
  assert.equal(verified.providers, 2)
  assert.equal(verified.checksPassed, 2)
  assert.equal(verified.liveAcceptedProviders, 0)

  const forged = structuredClone(receipt)
  forged.providers.find((provider) => provider.id === "claude").liveAcceptance = "accepted"
  await assert.rejects(
    verifyProviderBehaviorEvidence({ repositoryRoot, receipt: forged }),
    /claude behavior result differs/u,
  )
})
