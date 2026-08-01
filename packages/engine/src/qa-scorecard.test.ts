import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { qaScorecardDimensionIds, type QaScorecardInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import type { GaepRepository } from "./repository.js"
import { QaScorecardService } from "./qa-scorecard.js"

interface Mutation { writes: Array<{ path: string; value: unknown }>; audit: { eventType: string; payload: Record<string, unknown> } }
class MemoryRepository {
  readonly values = new Map<string, unknown>(); readonly audits: Mutation["audit"][] = []
  resolve(...parts: string[]): string { return join("/workspace/.gaep", ...parts) }
  async withLock<T>(work: () => Promise<T>): Promise<T> { return work() }
  async verifyAudit() { return { valid: true } }
  async readJson<T>(path: string): Promise<T> { if (!this.values.has(path)) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return this.values.get(path) as T }
  async readDirectory(directory: string): Promise<string[]> { const values = [...this.values.keys()].filter((path) => dirname(path) === directory).map((path) => basename(path)); if (!values.length) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return values }
  async commitMutation(mutation: Mutation): Promise<void> { mutation.writes.forEach((write) => this.values.set(write.path, write.value)); this.audits.push(mutation.audit) }
}

const evidenceKinds = ["local-functional-gate", "local-unit-integration-gate", "local-e2e-receipt", "local-security-report", "local-accessibility-report",
  "local-visual-fixture-report", "local-performance-report", "local-reliability-report", "trace-coverage-candidate", "gap-register"] as const
function fixture() {
  const repository = new MemoryRepository(), product = { id: randomUUID(), revision: 1 }
  const initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as "active" | "completed" }
  const context = { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) }
  const input: QaScorecardInput = { initiativeId: initiative.id, context, informationClassification: "internal", title: "Local QA scorecard",
    dimensions: qaScorecardDimensionIds.map((id, index) => ({ id, ordinal: index + 1, state: "success", evidence: [{ id: randomUUID(), dimensionId: id,
      kind: evidenceKinds[index]!, artifactId: `evidence.${id}`, artifactPath: `evidence/vscode-checkpoints/${id}.json`, artifactDigest: canonicalDigest({ id }),
      sourceCheckpoint: "063e5d12", observedAt: "2026-08-01T09:24:15.000Z", outcome: "success", freshness: "current", testCount: index + 1,
      skippedCount: 0, limitationCount: 1, localExecutionOnly: true, acceptanceState: "not-established" }], gapKeys: [], reasons: ["Current bounded local evidence"],
      localAutomationState: "passed", humanValidationState: "not-established", productOwnerAcceptanceState: "not-established" })), unresolvedGapKeys: [],
    limitations: ["Local evidence is not Product truth or human acceptance"], reviewState: "ready-for-human-review", assessedBy: { kind: "human", id: "qa-reviewer" },
    assessedAt: "2026-08-01T09:24:15.000Z", productTruthState: "not-established", nativeHumanAcceptanceState: "not-established",
    securityApprovalState: "not-established", productOwnerAcceptanceState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted" }
  return { repository, product, initiative, input,
    service: new QaScorecardService(repository as unknown as GaepRepository, async () => product as never, async () => initiative as never) }
}

describe("QA scorecard lifecycle", () => {
  it("persists immutable evidence summaries and produces a read-only current projection", async () => {
    const { repository, service, input, initiative } = fixture()
    const created = await service.create(input, "qa-reviewer")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed local QA scorecard" }, "qa-reviewer")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), productTruthState: "not-established", actionAuthorityState: "not-granted" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "local-evidence-current", successCount: 10, evidenceCount: 10, unresolvedGapCount: 0 })
    expect((await service.project(initiative.id)).candidate?.dimensions[0]).toMatchObject({ id: "functional", state: "success", evidenceCount: 1 })
    expect(repository.audits.at(-1)?.payload).toMatchObject({ dimensionCount: 10, evidenceCount: 10, productOwnerAcceptanceState: "not-established", actionAuthorityState: "not-granted" })
    expect(await service.healthIssues()).toEqual([])
  })

  it("fails closed for missing evidence, unresolved gaps, stale bindings, revision conflicts, and terminal initiatives", async () => {
    const { service, input, initiative } = fixture()
    const dimension = input.dimensions[0]!
    const held: QaScorecardInput = { ...input, dimensions: input.dimensions.map((item, index) => index ? item : { ...dimension, state: "missing", evidence: [], gapKeys: ["gap.functional"], localAutomationState: "not-run" }),
      unresolvedGapKeys: ["gap.functional"], reviewState: "held" }
    const created = await service.create(held, "qa-reviewer")
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", missingCount: 1, unresolvedGapCount: 1 })
    await expect(service.revise(created.id, 2, held, "qa-reviewer")).rejects.toThrow(/revision conflict/iu)
    const staleContext = { ...held, context: { ...held.context, initiativeRevision: 2 } }
    await expect(service.revise(created.id, 1, staleContext, "qa-reviewer")).rejects.toThrow(/exact current/iu)
    initiative.state = "completed"
    await expect(service.revise(created.id, 1, held, "qa-reviewer")).rejects.toThrow(/immutable/iu)
  })
})
