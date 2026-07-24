import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  hostBehaviorDefinitionDigest,
  hostBehaviorSourceSnapshot,
} from "./lib/host_behavior_evidence.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const contractPath = resolve(repositoryRoot, "conformance/phase-0-ide-contract.json")
const digestPattern = /^sha256:[0-9a-f]{64}$/u

async function contract() {
  return JSON.parse(await readFile(contractPath, "utf8"))
}

test("binds four exact host-gate definitions and distinct bounded source snapshots", async () => {
  const current = await contract()
  assert.match(hostBehaviorDefinitionDigest(), digestPattern)
  const hostIds = current.hosts.map((host) => host.id).sort()
  assert.deepEqual(hostIds, ["kiro", "rider", "visual-studio", "vscode"])
  const snapshots = await Promise.all(hostIds.map((hostId) =>
    hostBehaviorSourceSnapshot({ repositoryRoot, contract: current, hostId })))
  assert.equal(snapshots.every((digest) => digestPattern.test(digest)), true)
  assert.equal(new Set(snapshots).size, hostIds.length)
})

test("changes a host snapshot when its claimed source contract changes", async () => {
  const current = await contract()
  const before = await hostBehaviorSourceSnapshot({ repositoryRoot, contract: current, hostId: "vscode" })
  const hostile = structuredClone(current)
  hostile.hosts.find((host) => host.id === "vscode").capabilityAssessments[0].probes[0].contains[0] += "-drift"
  const after = await hostBehaviorSourceSnapshot({ repositoryRoot, contract: hostile, hostId: "vscode" })
  assert.notEqual(after, before)
})

test("rejects source inventory paths that escape the repository", async () => {
  const hostile = await contract()
  hostile.hosts.find((host) => host.id === "vscode").capabilityAssessments[0].probes[0].path = "../outside"
  await assert.rejects(
    hostBehaviorSourceSnapshot({ repositoryRoot, contract: hostile, hostId: "vscode" }),
    /escaped the repository/u,
  )
})
