import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { approvedFigmaContextRetrievalInputSchema, type ApprovedFigmaContextRetrievalInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { ApprovedFigmaContextRetrievalService } from "./approved-figma-context-retrieval.js"
import type { GaepRepository } from "./repository.js"

interface StoredWrite { path: string; value: unknown }
interface StoredMutation { writes: StoredWrite[]; audit: { eventType: string; payload: Record<string, unknown> } }
class MemoryRepository {
  readonly values = new Map<string, unknown>(); readonly audits: StoredMutation["audit"][] = []
  resolve(...segments: string[]): string { return join("/workspace/.gaep", ...segments) }
  async withLock<T>(work: () => Promise<T>): Promise<T> { return work() }
  async verifyAudit() { return { valid: true } }
  async readJson<T>(path: string): Promise<T> { if (!this.values.has(path)) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return this.values.get(path) as T }
  async readDirectory(directory: string): Promise<string[]> { const names = [...this.values.keys()].filter((path) => dirname(path) === directory).map((path) => basename(path)); if (!names.length) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return names }
  async commitMutation(mutation: StoredMutation): Promise<void> { for (const write of mutation.writes) this.values.set(write.path, write.value); this.audits.push(mutation.audit) }
}

function reference(record: { id: string; revision: number }) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function fixture() {
  const repository = new MemoryRepository()
  const product = { id: randomUUID(), revision: 1 }
  const initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as const }
  const context = { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) }
  const base = () => ({ id: randomUUID(), revision: 1, productId: product.id, initiativeId: initiative.id, context })
  const designApplicability = { ...base(), membershipDigest: canonicalDigest({ design: "applicable" }) }
  const externalFileIdentityDigest = canonicalDigest({ file: "approved-figma-file" })
  const returnedExternalVersionDigest = canonicalDigest({ version: "approved-figma-version" })
  const itemCatalogDigest = canonicalDigest({ items: ["item-1"] })
  const finalizedFigmaSnapshotImport = { ...base(), membershipDigest: itemCatalogDigest,
    returnReceipt: { externalFileIdentityDigest, returnedExternalVersionDigest }, items: [{ key: "item-1" }] }
  const approvalSubjectDigest = canonicalDigest({ subject: "approved-snapshot" })
  const approvalScopeDigest = canonicalDigest({ included: ["item-1"] })
  const humanDecisionReceiptDigest = canonicalDigest({ decision: "approve-candidate" })
  const humanDesignApproval = { ...base(), candidateResult: "approved-candidate", decision: { kind: "approve-candidate" },
    decisionReceiptDigest: humanDecisionReceiptDigest,
    subject: { digest: approvalSubjectDigest, itemCatalogDigest },
    scope: { scopeDigest: approvalScopeDigest, includedItemDigests: [canonicalDigest({ item: 1 })], excludedItemDigests: [] } }
  const baselineMembershipDigest = canonicalDigest({ baseline: "membership" })
  const designBaseline = { ...base(), membershipDigest: baselineMembershipDigest, humanDesignApproval: reference(humanDesignApproval),
    baselineLineageId: randomUUID(), candidateSetId: randomUUID(), candidateSetRevision: 1, semanticVersion: "1.0.0" }
  const designToRequirementBinding = { ...base(), membershipDigest: canonicalDigest({ requirement: "binding" }), bindings: [{ key: "binding-1" }] }
  const implementationUnitId = randomUUID()
  const designToCodeBindingRegistry = { ...base(), designBaseline: reference(designBaseline),
    finalizedFigmaSnapshotImport: reference(finalizedFigmaSnapshotImport), designToRequirementBinding: reference(designToRequirementBinding),
    bindingSubjectCatalogDigest: canonicalDigest({ code: "bindings" }), subjects: [{ implementationUnitId }] }
  const routeScreenComponentMapping = { ...base(), designBaseline: reference(designBaseline),
    designToRequirementBinding: reference(designToRequirementBinding), designToCodeBindingRegistry: reference(designToCodeBindingRegistry),
    subjectCatalogDigest: canonicalDigest({ routes: "subjects" }), relationshipCatalogDigest: canonicalDigest({ routes: "relationships" }),
    subjects: [{ id: randomUUID() }], relationships: [{ id: randomUUID() }] }
  const proposedChangePreview = { ...base(), assessmentReceiptDigest: canonicalDigest({ preview: "assessment" }) }
  const stagingWorkspace = { ...base(), proposedChangePreview: reference(proposedChangePreview), assessmentReceiptDigest: canonicalDigest({ staging: "assessment" }) }
  const modelSwitchImplementation = { ...base(), proposedChangePreview: reference(proposedChangePreview), stagingWorkspace: reference(stagingWorkspace),
    assessmentReceiptDigest: canonicalDigest({ model: "assessment" }), unitCount: 1, pathCount: 1 }
  const dependencies = { designApplicability, finalizedFigmaSnapshotImport, humanDesignApproval, designBaseline,
    designToRequirementBinding, designToCodeBindingRegistry, routeScreenComponentMapping, proposedChangePreview,
    stagingWorkspace, modelSwitchImplementation }
  const input: ApprovedFigmaContextRetrievalInput = {
    initiativeId: initiative.id, context, informationClassification: "internal", title: "Approved Figma context retrieval candidate",
    dependencies: Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, reference(value)])) as ApprovedFigmaContextRetrievalInput["dependencies"],
    approvedSnapshot: { externalFileIdentityDigest, returnedExternalVersionDigest, itemCatalogDigest, itemCount: 1,
      includedItemCount: 1, excludedItemCount: 0, approvalSubjectDigest, approvalScopeDigest, humanDecisionReceiptDigest,
      humanDecisionCandidateState: "approved-candidate", baselineMembershipDigest, baselineLineageId: designBaseline.baselineLineageId,
      baselineCandidateSetId: designBaseline.candidateSetId, baselineCandidateSetRevision: 1, baselineSemanticVersion: "1.0.0" },
    generationContext: { designApplicabilityMembershipDigest: designApplicability.membershipDigest,
      requirementBindingMembershipDigest: designToRequirementBinding.membershipDigest,
      designToCodeBindingMembershipDigest: designToCodeBindingRegistry.bindingSubjectCatalogDigest,
      routeSubjectCatalogDigest: routeScreenComponentMapping.subjectCatalogDigest,
      routeRelationshipCatalogDigest: routeScreenComponentMapping.relationshipCatalogDigest,
      previewAssessmentDigest: proposedChangePreview.assessmentReceiptDigest, stagingAssessmentDigest: stagingWorkspace.assessmentReceiptDigest,
      modelSwitchAssessmentDigest: modelSwitchImplementation.assessmentReceiptDigest, requirementBindingCount: 1,
      designToCodeBindingCount: 1, routeSubjectCount: 1, routeRelationshipCount: 1, implementationUnitCount: 1, pathCount: 1,
      contentBoundary: "metadata-and-digests-only", materializationState: "not-performed", transferState: "not-performed" },
    lifecycle: { retrievalCandidateState: "candidate-defined", figmaConnectionState: "not-performed", remoteFetchState: "not-performed",
      contextMaterializationState: "not-performed", contextTransferState: "not-performed", generationState: "not-performed",
      providerExecutionState: "not-performed", stageEffectState: "not-performed", sourceMutationState: "not-performed",
      approvalState: "not-established", authorizationState: "not-established", acceptanceState: "not-established" },
    evidenceReferences: [{ kind: "evidence", sourceId: "approved-figma-context-inspection", revision: 1,
      digest: canonicalDigest({ evidence: true }), evidenceState: "human-reviewed" }],
    unresolvedQuestions: [], limitations: ["This candidate does not connect to Figma, transfer content, generate code, or mutate source"],
    reviewState: "ready-for-human-review", actualFigmaAccessState: "not-established", snapshotContentState: "not-materialized",
    designApprovalState: "candidate-only-not-established", designBaselineState: "candidate-only-not-established",
    generationReadinessState: "not-established", nativeHostAcceptanceState: "not-established", liveProviderAcceptanceState: "not-established",
    securityAcceptanceState: "not-established", releaseReadinessState: "not-established", deploymentReadinessState: "not-established",
    actionAuthorityState: "not-granted",
  }
  const readers = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, { readCurrent: async () => value }]))
  const service = new ApprovedFigmaContextRetrievalService(repository as unknown as GaepRepository, async () => product as never,
    async () => initiative as never, readers as never)
  return { repository, service, input, initiative, dependencies }
}

describe("Approved Figma Context Retrieval lifecycle", () => {
  it("persists immutable approved snapshot/version and metadata-only generation continuity without accessing Figma", async () => {
    const { repository, service, input, initiative, dependencies } = fixture()
    const created = await service.create(input, "implementation-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed approved Figma context retrieval" }, "implementation-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created),
      lifecycle: { figmaConnectionState: "not-performed", remoteFetchState: "not-performed", generationState: "not-performed", sourceMutationState: "not-performed" } })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", snapshotItemCount: 1,
      requirementBindingCount: 1, designToCodeBindingCount: 1, routeSubjectCount: 1, implementationUnitCount: 1, pathCount: 1,
      staleBindingCount: 0, snapshotGapCount: 0, generationContextGapCount: 0, lifecycleGapCount: 0 })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ approvedSnapshot: { baselineSemanticVersion: "1.0.0", itemCount: 1 },
      generationContext: { contentBoundary: "metadata-and-digests-only", materializationState: "not-performed" } })
    expect(JSON.stringify(projection)).not.toContain("implementation-author")
    expect(JSON.stringify(projection)).not.toContain("/workspace")
    expect(repository.audits.at(-1)?.payload).toMatchObject({ snapshotItemCount: 1, pathCount: 1, actionAuthorityState: "not-granted" })
    dependencies.designBaseline.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })

  it("fails closed on stale version, content-scope forgery, and secret-shaped input", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, approvedSnapshot: { ...input.approvedSnapshot,
      returnedExternalVersionDigest: canonicalDigest({ forged: true }) } }, "implementation-author")).rejects.toThrow(/snapshot|version|baseline/iu)
    expect(approvedFigmaContextRetrievalInputSchema.safeParse({ ...input, approvedSnapshot: { ...input.approvedSnapshot,
      includedItemCount: 1, excludedItemCount: 1 } }).success).toBe(false)
    expect(approvedFigmaContextRetrievalInputSchema.safeParse({ ...input,
      limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
