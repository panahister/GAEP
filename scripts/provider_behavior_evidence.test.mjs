import assert from "node:assert/strict"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  providerBehaviorDefinitionDigest,
  providerBehaviorSourceSnapshot,
} from "./lib/provider_behavior_evidence.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const digestPattern = /^sha256:[0-9a-f]{64}$/u

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
