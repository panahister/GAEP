import { createHash } from "node:crypto"
import { createInterface } from "node:readline"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "29292929-2929-4929-8929-292929292929"
const bundleId = "22222222-2222-4222-8222-222222222222"
const runId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const charterId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const handoffId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const workflowPlanId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
const managedRunId = "ffffffff-ffff-4fff-8fff-ffffffffffff"
const managedGovernedRunId = "12121212-1212-4212-8212-121212121212"
const workflowStepId = "13131313-1313-4313-8313-131313131313"
const managedResultId = "14141414-1414-4414-8414-141414141414"
const managedEvidenceId = "15151515-1515-4515-8515-151515151515"
const stagedManagedRunId = "16161616-1616-4616-8616-161616161616"
const stagedResultId = "17171717-1717-4717-8717-171717171717"
const stagedEvidenceId = "18181818-1818-4818-8818-181818181818"
const transitionedResultId = "19191919-1919-4919-8919-191919191919"
const transitionedEvidenceId = "20202020-2020-4020-8020-202020202020"
const applyDecisionId = "21212121-2121-4121-8121-212121212121"
const changeId = "23232323-2323-4323-8323-232323232323"
const workItemId = "24242424-2424-4424-8424-242424242424"
const traceId = "25252525-2525-4525-8525-252525252525"
const decisionId = "26262626-2626-4626-8626-262626262626"
const riskId = "27272727-2727-4727-8727-272727272727"
const sourceId = "30303030-3030-4030-8030-303030303030"
const sourceBaselineId = "31313131-3131-4131-8131-313131313131"
const sourceProvenanceId = "32323232-3232-4232-8232-323232323232"
const businessUnderstandingId = "33333333-3333-4333-8333-333333333333"
const stakeholderModelId = "34343434-3434-4434-8434-343434343434"
const outcomeModelId = "35353535-3535-4535-8535-353535353535"
const businessCapabilityMapId = "36363636-3636-4636-8636-363636363636"
const valueStreamModelId = "37373737-3737-4737-8737-373737373737"
const operatingModelId = "38383838-3838-4838-8838-383838383838"
const businessRuleCatalogId = "39393939-3939-4939-8939-393939393939"
const businessArchitectureBaselineId = "40404040-4040-4040-8040-404040404040"
const systemSolutionArchitectureId = "41414141-4141-4141-8141-414141414141"
const boundedContextModelId = "42424242-4242-4242-8242-424242424242"
const securityPrivacyAssessmentId = "43434343-4343-4343-8343-434343434343"
const processModelId = "44444444-4444-4444-8444-444444444444"
const dataModelId = "45454545-4545-4545-8545-454545454545"
const authorizationModelId = "46464646-4646-4646-8646-464646464646"
const eventIntegrationModelId = "47474747-4747-4747-8747-474747474747"
const failureRecoveryModelId = "48484848-4848-4848-8848-484848484848"
const architectureChallengeModelId = "49494949-4949-4949-8949-494949494949"
const decisionRegisterId = "50505050-5050-4050-8050-505050505050"
const riskRegisterId = "51515151-5151-4151-8151-515151515151"
const evidenceRegistryId = "52525252-5252-4252-8252-525252525252"
const endToEndTraceabilityId = "53535353-5353-4353-8353-535353535353"
const p0P4ReadinessGateId = "54545454-5454-4454-8454-545454545454"
const p5HandoffPackageId = "55555555-5555-4555-8555-555555555555"
const designApplicabilityId = "56565656-5656-4656-8656-565656565656"
const designPersonaRoleId = "57575757-5757-4757-8757-575757575757"
const userJourneyId = "58585858-5858-4858-8858-585858585858"
const informationArchitectureId = "59595959-5959-4959-8959-595959595959"
const screenStateInventoryId = "60606060-6060-4060-8060-606060606060"
const designRequirementsId = "61616161-6161-4161-8161-616161616161"
const completenessPolicyVersion = "gaep-initiative-classification-completeness-v1"
const completenessPolicyDigest = `sha256:${"e".repeat(64)}`
const subjectCatalogVersion = "gaep-initiative-applicability-subjects-v1"
const subjectCatalogDigest = `sha256:${"f".repeat(64)}`
const subjectCatalogCount = 49
const previewDigest = managedReadOnlyPreview().previewDigest
const privateRoot = "/Users/private/portable-design"
const privateCredential = "PRIVATE-OAUTH-TOKEN"
const workspacePath = process.argv[process.argv.indexOf("--workspace") + 1] ?? ""
let selectedAgent = null
let initiativeState = initiativeRecord()

if (process.env.AWS_SECRET_ACCESS_KEY || process.env.OPENAI_API_KEY || process.env.HOME || process.env.USERPROFILE) {
  process.exit(91)
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
input.on("line", (line) => {
  const request = JSON.parse(line)
  const id = request.id
  if (!exactKeys(request, ["jsonrpc", "id", "method", "params", "protocolVersion"]) ||
    request.jsonrpc !== "2.0" || request.protocolVersion !== 2) {
    writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID ENVELOPE")
    return
  }
  switch (request.method) {
    case "readProduct":
      if (!exactKeys(request.params, [])) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PARAMS")
      return writeResult(id, productRecord())
    case "readInitiative":
      return readInitiative(id, request.params)
    case "assessInitiativeEntry":
      return assessInitiativeEntry(id, request.params)
    case "classifyInitiative":
      return classifyInitiative(id, request.params)
    case "resolveInitiativeApplicability":
      return resolveInitiativeApplicability(id, request.params)
    case "source.snapshot":
      return readSourceGovernance(id, request.params)
    case "business.snapshot":
      return readBusinessUnderstanding(id, request.params)
    case "business.capabilities.snapshot":
      return readBusinessCapabilityMap(id, request.params)
    case "business.valueStreams.snapshot":
      return readValueStreamModel(id, request.params)
    case "business.operatingModels.snapshot":
      return readOperatingModel(id, request.params)
    case "business.businessRules.snapshot":
      return readBusinessRuleCatalog(id, request.params)
    case "business.architectureBaselines.snapshot":
      return readBusinessArchitectureBaseline(id, request.params)
    case "architecture.systemSolution.snapshot":
      return readSystemSolutionArchitecture(id, request.params)
    case "architecture.boundedContexts.snapshot":
      return readBoundedContextModel(id, request.params)
    case "security.privacyThreat.snapshot":
      return readSecurityPrivacyAssessment(id, request.params)
    case "process.models.snapshot":
      return readProcessModel(id, request.params)
    case "data.models.snapshot":
      return readDataModel(id, request.params)
    case "authorization.models.snapshot":
      return readAuthorizationModel(id, request.params)
    case "integration.models.snapshot":
      return readEventIntegrationModel(id, request.params)
    case "recovery.models.snapshot":
      return readFailureRecoveryModel(id, request.params)
    case "challenge.models.snapshot":
      return readArchitectureChallengeModel(id, request.params)
    case "decision.registers.snapshot":
      return readDecisionRegister(id, request.params)
    case "risk.registers.snapshot":
      return readRiskRegister(id, request.params)
    case "evidence.registries.snapshot":
      return readEvidenceRegistry(id, request.params)
    case "traceability.graphs.snapshot":
      return readEndToEndTraceability(id, request.params)
    case "readiness.gates.snapshot":
      return readP0P4ReadinessGate(id, request.params)
    case "handoff.p5.snapshot":
      return readP5HandoffPackage(id, request.params)
    case "design.applicability.snapshot":
      return readDesignApplicability(id, request.params)
    case "design.personas.roles.snapshot":
      return readDesignPersonaRoleModel(id, request.params)
    case "design.journeys.snapshot":
      return readUserJourneyModel(id, request.params)
    case "design.informationArchitecture.snapshot":
      return readInformationArchitectureModel(id, request.params)
    case "design.screenStateInventory.snapshot":
      return readScreenStateInventory(id, request.params)
    case "design.requirements.snapshot":
      return readDesignRequirements(id, request.params)
    case "dashboard.framework":
      return readPhaseDashboard(id, request.params)
    case "dashboard.phase1Summary":
      return readPhase1Summary(id, request.params)
    case "dashboard.phase1ChangeImpact":
      return readPhase1ChangeImpact(id, request.params)
    case "dashboard.changeImpact.changes":
      return readChangeCatalog(id, request.params)
    case "dashboard.changeImpact":
      return readChangeImpact(id, request.params)
    case "dashboard.agentModel":
      return readAgentModel(id, request.params)
    case "dashboard.phase1AgentModel":
      return readPhase1AgentModel(id, request.params)
    case "probeAgents":
      if (!exactKeys(request.params, [])) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PARAMS")
      return writeResult(id, readinessSnapshots(workspacePath.endsWith("bad-readiness")))
    case "readAgentSelection":
      if (!exactKeys(request.params, [])) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PARAMS")
      if (workspacePath.endsWith("bad-selection")) {
        return writeResult(id, {
          status: "selected",
          selection: { ...agentSelection(), runtimeExecutable: `${privateRoot}/${privateCredential}` },
        })
      }
      return writeResult(id, selectedAgent ? { status: "selected", selection: selectedAgent } : { status: "unselected" })
    case "selectAgent":
      return selectAgent(id, request.params)
    case "listRuns":
      if (!exactKeys(request.params, [])) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PARAMS")
      return writeResult(id, [agentRun(workspacePath.endsWith("bad-runs"))])
    case "createHandoff":
      return createHandoff(id, request.params)
    case "managed.readonly.preview":
      return previewManagedReadOnly(id, request.params)
    case "managed.readonly.execute":
      return executeManagedReadOnly(id, request.params)
    case "managed.evidence.list":
      return listManagedEvidence(id, request.params)
    case "managed.evidence.read":
      return readManagedEvidence(id, request.params)
    case "managed.review.read":
      return readManagedReview(id, request.params)
    case "managed.review.apply":
      return decideManagedReview(id, request.params, "apply-exact-managed-review")
    case "managed.review.discard":
      return decideManagedReview(id, request.params, "discard-exact-managed-review")
    case "productStudio.portableDesign.import":
      return importSnapshot(id, request.params)
    case "productStudio.portableDesign.list":
      return listSnapshots(id, request.params)
    case "productStudio.portableDesign.read":
      return readSnapshot(id, request.params)
    default:
      return writeError(id, -32_601, "METHOD_NOT_FOUND", "PRIVATE METHOD")
  }
})

function productRecord() {
  return {
    id: productId,
    name: "Example Product",
    revision: 7,
    providerState: privateCredential,
  }
}

function initiativeRecord() {
  return {
    schemaVersion: 1,
    id: initiativeId,
    kind: "initiative",
    revision: 1,
    productId,
    title: "Governed entry",
    outcome: "One exact Initiative entry can be reviewed safely.",
    scope: ["Kiro host"],
    exclusions: ["No implicit approval"],
    state: "active",
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
  }
}

function readInitiative(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INITIATIVE PARAMS")
  }
  const value = structuredClone(initiativeState)
  if (workspacePath.endsWith("bad-initiative-private")) value.privateRoot = `${privateRoot}/${privateCredential}`
  return writeResult(id, value)
}

function readSourceGovernance(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE SOURCE PARAMS")
  }
  const sourceContentDigest = `sha256:${"a".repeat(64)}`
  const sourceRecordDigest = `sha256:${"b".repeat(64)}`
  const membershipDigest = `sha256:${"c".repeat(64)}`
  const baselineDigest = `sha256:${"d".repeat(64)}`
  const assessment = {
    schemaVersion: 1,
    kind: "source-governance-assessment",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    sourceCount: 1,
    baselineCount: 1,
    provenanceCount: 1,
    currentBaseline: {
      id: sourceBaselineId,
      revision: 1,
      digest: baselineDigest,
      membershipDigest,
      status: "current",
      memberCount: 1,
    },
    staleSourceCount: 0,
    unknownAuthorityCount: 0,
    unbaselinedSourceCount: 0,
    unprovenancedSourceCount: 0,
    state: "ready",
    reasons: [],
    assessedAt: "2026-07-25T03:00:00.000Z",
    authorityBoundary: "source-governance-assessment-reports-recorded-evidence-and-does-not-designate-a-baseline-approve-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "source-governance-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: {
      id: initiativeId,
      revision: initiativeState.revision,
      digest: canonicalDigest(initiativeState),
      state: initiativeState.state,
    },
    assessment,
    sources: [{
      id: sourceId,
      revision: 1,
      title: "Reviewed requirements source",
      sourceType: "requirements",
      owner: { kind: "human", id: "founder.kiro-review" },
      semanticAuthority: {
        standing: "authoritative",
        domain: "Kiro Source workflow",
        scope: ["P0 source intake"],
      },
      knowledgeDisposition: "confirmed",
      informationClassification: "internal",
      freshness: "fresh",
      availability: "available",
      contentDigest: sourceContentDigest,
      recordDigest: sourceRecordDigest,
      updatedAt: "2026-07-25T02:58:00.000Z",
    }],
    baselines: [{
      id: sourceBaselineId,
      revision: 1,
      title: "P0 exact source candidate",
      state: "candidate",
      membershipDigest,
      memberCount: 1,
      assessmentStatus: "current",
      updatedAt: "2026-07-25T02:59:00.000Z",
    }],
    provenance: [{
      id: sourceProvenanceId,
      targetKind: "claim",
      targetDigest: sourceContentDigest,
      disposition: "confirmed",
      sourceCount: 1,
      transformationCount: 0,
      recordedAt: "2026-07-25T03:00:00.000Z",
    }],
    limits: {
      sources: { shown: 1, total: 1, omitted: 0 },
      baselines: { shown: 1, total: 1, omitted: 0 },
      provenance: { shown: 1, total: 1, omitted: 0 },
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-portable-governance-metadata-and-digests-only-not-source-bytes-locators-local-paths-or-credentials",
    authorityBoundary: "source-governance-projection-does-not-designate-a-baseline-approve-readiness-transfer-authority-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-source-snapshot-binding")) content.initiative.id = sourceId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-source-snapshot-digest")) value.sources[0].freshness = "stale"
  if (workspacePath.endsWith("bad-source-snapshot-private")) value.sourceLocator = `${privateRoot}/${privateCredential}`
  return writeResult(id, value)
}

function readBusinessUnderstanding(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE BUSINESS PARAMS")
  }
  const businessDigest = `sha256:${"3".repeat(64)}`
  const stakeholderDigest = `sha256:${"4".repeat(64)}`
  const outcomeDigest = `sha256:${"5".repeat(64)}`
  const assessment = {
    schemaVersion: 1,
    kind: "business-understanding-assessment",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    businessUnderstanding: { recordId: businessUnderstandingId, revision: 2, digest: businessDigest },
    stakeholderModel: { recordId: stakeholderModelId, revision: 1, digest: stakeholderDigest },
    outcomeModel: { recordId: outcomeModelId, revision: 1, digest: outcomeDigest },
    stakeholderCount: 8,
    representedStakeholderCategoryCount: 8,
    unresolvedStakeholderCategoryCount: 0,
    verifiedAuthorityCount: 0,
    unverifiedAuthorityCount: 0,
    outcomeCount: 2,
    measureCount: 4,
    observedBaselineCount: 4,
    unresolvedQuestionCount: 0,
    blockingQuestionCount: 0,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    state: "complete-for-review",
    reasons: [],
    assessedAt: "2026-07-25T04:00:00.000Z",
    authorityBoundary: "business-understanding-assessment-reports-recorded-candidate-evidence-and-does-not-approve-decide-designate-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "business-understanding-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: {
      id: initiativeId,
      revision: initiativeState.revision,
      digest: canonicalDigest(initiativeState),
      state: initiativeState.state,
    },
    assessment,
    businessUnderstanding: {
      id: businessUnderstandingId,
      revision: 2,
      digest: businessDigest,
      state: "candidate",
      objectiveCount: 3,
      constraintCount: 2,
      assumptionCount: 1,
      unresolvedQuestionCount: 0,
      glossaryTermCount: 5,
      updatedAt: "2026-07-25T03:55:00.000Z",
    },
    stakeholderModel: {
      id: stakeholderModelId,
      revision: 1,
      digest: stakeholderDigest,
      state: "candidate",
      stakeholderCount: 8,
      representedCategoryCount: 8,
      unresolvedCategoryCount: 0,
      verifiedAuthorityCount: 0,
      updatedAt: "2026-07-25T03:56:00.000Z",
    },
    outcomeModel: {
      id: outcomeModelId,
      revision: 1,
      digest: outcomeDigest,
      state: "candidate",
      outcomeCount: 2,
      measureCount: 4,
      countermetricCount: 1,
      burdenMeasureCount: 1,
      observedBaselineCount: 4,
      updatedAt: "2026-07-25T03:57:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-business-narrative-personal-data-source-content-locators-or-credentials",
    authorityBoundary: "business-understanding-projection-does-not-approve-appoint-decide-designate-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-business-snapshot-binding")) content.initiative.id = businessUnderstandingId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-business-snapshot-digest")) value.outcomeModel.measureCount = 5
  if (workspacePath.endsWith("bad-business-snapshot-private")) value.personalAssignment = `${privateRoot}/${privateCredential}`
  return writeResult(id, value)
}

function readBusinessCapabilityMap(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE CAPABILITY PARAMS")
  }
  const mapDigest = `sha256:${"6".repeat(64)}`
  const assessment = {
    schemaVersion: 1,
    kind: "business-capability-map-assessment",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    capabilityMap: { recordId: businessCapabilityMapId, revision: 2, digest: mapDigest },
    capabilityCount: 7,
    ownedCapabilityCount: 6,
    unownedCapabilityCount: 1,
    objectiveCoverageCount: 3,
    outcomeCoverageCount: 2,
    openGapCount: 2,
    criticalGapCount: 1,
    unknownCurrentMaturityCount: 1,
    unassessedPriorityCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more capabilities do not have a candidate owner"],
    assessedAt: "2026-07-25T04:10:00.000Z",
    authorityBoundary: "business-capability-map-assessment-reports-recorded-candidate-coverage-and-gaps-and-does-not-approve-priority-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "business-capability-map-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: {
      id: initiativeId,
      revision: initiativeState.revision,
      digest: canonicalDigest(initiativeState),
      state: initiativeState.state,
    },
    assessment,
    capabilityMap: {
      id: businessCapabilityMapId,
      revision: 2,
      digest: mapDigest,
      state: "candidate",
      capabilityCount: 7,
      ownedCapabilityCount: 6,
      openGapCount: 2,
      criticalGapCount: 1,
      candidatePriorityCount: 6,
      updatedAt: "2026-07-25T04:09:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-capability-narrative-personal-data-source-content-locators-or-credentials",
    authorityBoundary: "business-capability-map-projection-does-not-approve-prioritize-baseline-designate-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-capability-snapshot-binding")) content.initiative.id = businessCapabilityMapId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-capability-snapshot-digest")) value.capabilityMap.openGapCount = 3
  if (workspacePath.endsWith("bad-capability-snapshot-private")) {
    value.capabilityNarrative = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readValueStreamModel(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE VALUE STREAM PARAMS")
  }
  const modelDigest = `sha256:${"7".repeat(64)}`
  const assessment = {
    schemaVersion: 1,
    kind: "value-stream-model-assessment",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    valueStreamModel: { recordId: valueStreamModelId, revision: 2, digest: modelDigest },
    valueStreamCount: 3,
    ownedValueStreamCount: 2,
    unownedValueStreamCount: 1,
    stageCount: 9,
    dependencyCount: 2,
    capabilityCoverageCount: 6,
    outcomeCoverageCount: 2,
    absentFlowEvidenceCount: 1,
    openBottleneckCount: 2,
    criticalBottleneckCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more value streams do not have a candidate owner"],
    assessedAt: "2026-07-25T05:00:00.000Z",
    authorityBoundary: "value-stream-model-assessment-reports-recorded-candidate-flow-coverage-and-gaps-and-does-not-approve-baseline-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "value-stream-model-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: {
      id: initiativeId,
      revision: initiativeState.revision,
      digest: canonicalDigest(initiativeState),
      state: initiativeState.state,
    },
    assessment,
    valueStreamModel: {
      id: valueStreamModelId,
      revision: 2,
      digest: modelDigest,
      state: "candidate",
      valueStreamCount: 3,
      ownedValueStreamCount: 2,
      stageCount: 9,
      dependencyCount: 2,
      openBottleneckCount: 2,
      criticalBottleneckCount: 1,
      updatedAt: "2026-07-25T04:59:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-value-stream-narrative-personal-data-source-content-locators-or-credentials",
    authorityBoundary: "value-stream-model-projection-does-not-approve-baseline-priority-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-value-stream-snapshot-binding")) content.initiative.id = valueStreamModelId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-value-stream-snapshot-digest")) value.valueStreamModel.openBottleneckCount = 3
  if (workspacePath.endsWith("bad-value-stream-snapshot-private")) {
    value.valueStreamNarrative = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readOperatingModel(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE OPERATING MODEL PARAMS")
  }
  const modelDigest = `sha256:${"8".repeat(64)}`
  const assessment = {
    schemaVersion: 1,
    kind: "operating-model-assessment",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    operatingModel: { recordId: operatingModelId, revision: 2, digest: modelDigest },
    roleCount: 6,
    governanceSystemCount: 2,
    unassignedAppointingAuthorityCount: 1,
    insufficientCapacityCount: 2,
    unfundedCapacityCount: 3,
    decisionRightCount: 8,
    unassignedDecisionAuthorityCount: 1,
    forumCount: 2,
    cycleCount: 3,
    supportCapacityGapCount: 1,
    emergencyAuthorityGapCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more candidate roles have no candidate appointing authority"],
    assessedAt: "2026-07-26T07:00:00.000Z",
    authorityBoundary: "operating-model-assessment-reports-candidate-structural-coverage-and-gaps-and-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "operating-model-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    assessment,
    operatingModel: {
      id: operatingModelId, revision: 2, digest: modelDigest, state: "candidate",
      roleCount: 6, decisionRightCount: 8, forumCount: 2, cycleCount: 3,
      updatedAt: "2026-07-26T06:59:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-operating-narrative-personal-data-source-content-locators-or-credentials",
    authorityBoundary: "operating-model-projection-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-operating-model-snapshot-binding")) content.initiative.id = operatingModelId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-operating-model-snapshot-digest")) value.operatingModel.roleCount = 7
  if (workspacePath.endsWith("bad-operating-model-snapshot-private")) {
    value.operatingNarrative = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readBusinessRuleCatalog(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE BUSINESS RULE PARAMS")
  }
  const catalogDigest = `sha256:${"9".repeat(64)}`
  const assessment = {
    schemaVersion: 1,
    kind: "business-rule-catalog-assessment",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    businessRuleCatalog: { recordId: businessRuleCatalogId, revision: 2, digest: catalogDigest },
    ruleCount: 7,
    sourceBackedRuleCount: 7,
    nonExceptionableRuleCount: 3,
    enforcementTargetCount: 4,
    unassignedEnforcementTargetCount: 1,
    unverifiedEnforcementTargetCount: 2,
    exceptionCount: 2,
    unassignedExceptionAuthorityCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more enforcement targets have no candidate assignment"],
    assessedAt: "2026-07-26T08:30:00.000Z",
    authorityBoundary: "business-rule-catalog-assessment-reports-candidate-coverage-and-gaps-and-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "business-rule-catalog-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    assessment,
    businessRuleCatalog: {
      id: businessRuleCatalogId, revision: 2, digest: catalogDigest, state: "candidate",
      ruleCount: 7, enforcementTargetCount: 4, exceptionCount: 2, nonExceptionableRuleCount: 3,
      updatedAt: "2026-07-26T08:29:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-rule-narrative-source-content-personal-data-locators-or-credentials",
    authorityBoundary: "business-rule-catalog-projection-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-business-rule-snapshot-binding")) content.initiative.id = businessRuleCatalogId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-business-rule-snapshot-digest")) value.businessRuleCatalog.ruleCount = 8
  if (workspacePath.endsWith("bad-business-rule-snapshot-private")) {
    value.ruleNarrative = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readBusinessArchitectureBaseline(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE BUSINESS ARCHITECTURE BASELINE PARAMS")
  }
  const baselineDigest = `sha256:${"a".repeat(64)}`
  const assessment = {
    schemaVersion: 1,
    kind: "business-architecture-baseline-assessment",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    baseline: { recordId: businessArchitectureBaselineId, revision: 2, digest: baselineDigest },
    coveredElementCount: 27,
    includedElementCount: 25,
    excludedElementCount: 1,
    unresolvedElementCount: 1,
    integrationClaimCount: 8,
    consistencyCheckCount: 6,
    consistencyGapCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more candidate architecture elements remain unresolved"],
    assessedAt: "2026-07-26T09:30:00.000Z",
    authorityBoundary: "business-architecture-baseline-assessment-reports-candidate-coherence-and-gaps-and-does-not-designate-or-approve-a-baseline-establish-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "business-architecture-baseline-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    assessment,
    baseline: {
      id: businessArchitectureBaselineId,
      revision: 2,
      digest: baselineDigest,
      membershipDigest: `sha256:${"d".repeat(64)}`,
      state: "candidate",
      coveredElementCount: 27,
      integrationClaimCount: 8,
      consistencyGapCount: 2,
      updatedAt: "2026-07-26T09:29:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials",
    authorityBoundary: "business-architecture-baseline-projection-does-not-designate-or-approve-a-baseline-establish-readiness-grant-exceptions-deploy-enforcement-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-business-architecture-baseline-snapshot-binding")) {
    content.initiative.id = businessArchitectureBaselineId
  }
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-business-architecture-baseline-snapshot-digest")) {
    value.baseline.coveredElementCount = 28
  }
  if (workspacePath.endsWith("bad-business-architecture-baseline-snapshot-private")) {
    value.architectureNarrative = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readSystemSolutionArchitecture(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE SYSTEM SOLUTION ARCHITECTURE PARAMS")
  }
  const architectureDigest = `sha256:${"b".repeat(64)}`
  const assessment = {
    schemaVersion: 1,
    kind: "system-solution-architecture-assessment",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    architecture: { recordId: systemSolutionArchitectureId, revision: 3, digest: architectureDigest },
    concernCount: 4,
    viewCount: 3,
    elementCount: 9,
    relationCount: 12,
    qualityAttributeCount: 5,
    unresolvedQualityAttributeCount: 1,
    decisionCount: 4,
    unresolvedDecisionCount: 2,
    conformanceCriterionCount: 6,
    unresolvedConformanceCriterionCount: 1,
    lifecycleGapCount: 1,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more architecture decisions remain unresolved"],
    assessedAt: "2026-07-26T10:30:00.000Z",
    authorityBoundary: "system-solution-architecture-assessment-reports-candidate-coverage-and-gaps-and-does-not-approve-baseline-readiness-conformance-technology-or-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "system-solution-architecture-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    assessment,
    architecture: {
      id: systemSolutionArchitectureId,
      revision: 3,
      digest: architectureDigest,
      membershipDigest: `sha256:${"e".repeat(64)}`,
      state: "candidate",
      concernCount: 4,
      viewCount: 3,
      elementCount: 9,
      qualityAttributeCount: 5,
      decisionCount: 4,
      updatedAt: "2026-07-26T10:29:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials",
    authorityBoundary: "system-solution-architecture-projection-does-not-approve-or-designate-an-architecture-baseline-establish-readiness-prove-conformance-mandate-technology-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-system-solution-architecture-snapshot-binding")) {
    content.initiative.id = systemSolutionArchitectureId
  }
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-system-solution-architecture-snapshot-digest")) {
    value.architecture.elementCount = 10
  }
  if (workspacePath.endsWith("bad-system-solution-architecture-snapshot-private")) {
    value.architectureNarrative = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readBoundedContextModel(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE BOUNDED CONTEXT PARAMS")
  }
  const modelDigest = `sha256:${"3".repeat(64)}`
  const assessment = {
    schemaVersion: 1,
    kind: "bounded-context-ownership-assessment",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    model: { recordId: boundedContextModelId, revision: 2, digest: modelDigest },
    boundedContextCount: 3,
    coreContextCount: 1,
    languageTermCount: 11,
    contractCount: 4,
    unresolvedContractCount: 1,
    relationshipCount: 3,
    unresolvedRelationshipCount: 1,
    unassignedArchitectureElementCount: 2,
    unownedDataAssetCount: 1,
    unmappedCrossContextRelationCount: 2,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more cross-context contracts remain unresolved"],
    assessedAt: "2026-07-26T11:00:00.000Z",
    authorityBoundary: "bounded-context-model-assessment-reports-candidate-coverage-and-gaps-and-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "bounded-context-ownership-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    assessment,
    model: {
      id: boundedContextModelId,
      revision: 2,
      digest: modelDigest,
      membershipDigest: `sha256:${"4".repeat(64)}`,
      state: "candidate",
      boundedContextCount: 3,
      contractCount: 4,
      relationshipCount: 3,
      updatedAt: "2026-07-26T10:59:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-boundary-language-contract-source-content-personal-data-locators-or-credentials",
    authorityBoundary: "bounded-context-model-projection-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-bounded-context-snapshot-binding")) {
    content.initiative.id = boundedContextModelId
  }
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-bounded-context-snapshot-digest")) {
    value.model.boundedContextCount = 4
  }
  if (workspacePath.endsWith("bad-bounded-context-snapshot-private")) {
    value.ubiquitousLanguage = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readSecurityPrivacyAssessment(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE SECURITY PRIVACY PARAMS")
  }
  const assessmentDigest = `sha256:${"5".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "security-privacy-threat-assessment-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    assessment: { recordId: securityPrivacyAssessmentId, revision: 2, digest: assessmentDigest },
    assetCount: 4,
    actorCount: 5,
    trustBoundaryCount: 3,
    dataClassCount: 2,
    dataFlowCount: 4,
    controlCount: 6,
    threatCount: 7,
    unresolvedThreatCount: 2,
    unverifiedControlCount: 1,
    unresolvedProcessingAuthorityCount: 1,
    uncoveredArchitectureElementCount: 0,
    unmappedArchitectureRelationCount: 1,
    unresolvedRequirementCount: 3,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more Security or Data Profile requirements remain unresolved"],
    assessedAt: "2026-07-26T11:15:00.000Z",
    authorityBoundary: "security-privacy-threat-status-reports-candidate-coverage-and-gaps-and-does-not-approve-threats-attest-controls-accept-risk-approve-processing-establish-security-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "security-privacy-threat-assessment-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    assessment: {
      id: securityPrivacyAssessmentId,
      revision: 2,
      digest: assessmentDigest,
      membershipDigest: `sha256:${"6".repeat(64)}`,
      state: "candidate",
      assetCount: 4,
      trustBoundaryCount: 3,
      dataClassCount: 2,
      controlCount: 6,
      threatCount: 7,
      updatedAt: "2026-07-26T11:14:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-threat-scenarios-control-content-data-content-personal-data-locators-secrets-or-credentials",
    authorityBoundary: "security-privacy-threat-projection-does-not-approve-a-threat-model-attest-control-effectiveness-accept-risk-approve-processing-establish-security-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-security-privacy-snapshot-binding")) {
    content.initiative.id = securityPrivacyAssessmentId
  }
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-security-privacy-snapshot-digest")) {
    value.assessment.assetCount = 5
  }
  if (workspacePath.endsWith("bad-security-privacy-snapshot-private")) {
    value.threatScenario = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readProcessModel(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PROCESS MODEL PARAMS")
  }
  const modelDigest = `sha256:${"7".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "process-model-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    model: { recordId: processModelId, revision: 2, digest: modelDigest },
    processCount: 3,
    stepCount: 9,
    stateDimensionCount: 5,
    stateValueCount: 18,
    transitionCount: 11,
    eventDefinitionCount: 8,
    approvalRequirementCount: 4,
    uncoveredValueStreamCount: 1,
    uncoveredBoundedContextCount: 2,
    uncoveredBusinessRuleCount: 3,
    unresolvedRequirementCount: 4,
    inconsistencyCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more Process Model requirements remain unresolved"],
    assessedAt: "2026-07-26T11:30:00.000Z",
    authorityBoundary: "process-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "process-model-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    model: {
      id: processModelId,
      revision: 2,
      digest: modelDigest,
      membershipDigest: `sha256:${"8".repeat(64)}`,
      state: "candidate",
      processCount: 3,
      transitionCount: 11,
      approvalRequirementCount: 4,
      updatedAt: "2026-07-26T11:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-process-narrative-transition-guards-approval-content-source-content-personal-data-locators-secrets-or-credentials",
    authorityBoundary: "process-model-projection-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-process-model-snapshot-binding")) content.initiative.id = processModelId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-process-model-snapshot-digest")) value.model.processCount = 4
  if (workspacePath.endsWith("bad-process-model-snapshot-private")) {
    value.transitionGuard = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readDataModel(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DATA MODEL PARAMS")
  }
  const modelDigest = `sha256:${"9".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "data-model-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    model: { recordId: dataModelId, revision: 2, digest: modelDigest },
    entityCount: 6,
    attributeCount: 24,
    relationshipCount: 8,
    lifecycleCount: 6,
    transformationCount: 5,
    uncoveredBoundedContextCount: 1,
    uncoveredSecurityDataClassCount: 2,
    uncoveredProcessCount: 3,
    unresolvedSystemOfRecordCount: 1,
    unresolvedTransformationCount: 2,
    unresolvedRequirementCount: 4,
    inconsistencyCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more Data Model requirements remain unresolved"],
    assessedAt: "2026-07-26T12:30:00.000Z",
    authorityBoundary: "data-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "data-model-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    model: {
      id: dataModelId,
      revision: 2,
      digest: modelDigest,
      membershipDigest: `sha256:${"a".repeat(64)}`,
      state: "candidate",
      entityCount: 6,
      relationshipCount: 8,
      lifecycleCount: 6,
      updatedAt: "2026-07-26T12:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-entity-attributes-relationships-lifecycle-content-source-content-personal-data-locators-secrets-or-credentials",
    authorityBoundary: "data-model-projection-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-data-model-snapshot-binding")) content.initiative.id = dataModelId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-data-model-snapshot-digest")) value.model.entityCount = 7
  if (workspacePath.endsWith("bad-data-model-snapshot-private")) {
    value.entityAttribute = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readAuthorizationModel(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE AUTHORIZATION MODEL PARAMS")
  }
  const modelDigest = `sha256:${"b".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "authorization-model-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    model: { recordId: authorizationModelId, revision: 2, digest: modelDigest },
    principalCount: 5,
    roleAssignmentCount: 6,
    resourceCount: 7,
    actionCount: 8,
    approvalBindingCount: 3,
    ruleCount: 9,
    uncoveredOperatingRoleCount: 1,
    uncoveredProcessCount: 2,
    uncoveredDataEntityCount: 3,
    unresolvedIdentityCount: 4,
    unresolvedRuleCount: 5,
    unresolvedRequirementCount: 6,
    inconsistencyCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more Authorization Rules remain unresolved"],
    assessedAt: "2026-07-26T13:30:00.000Z",
    authorityBoundary: "authorization-model-status-reports-candidate-coverage-and-gaps-and-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "authorization-model-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    model: {
      id: authorizationModelId,
      revision: 2,
      digest: modelDigest,
      membershipDigest: `sha256:${"c".repeat(64)}`,
      state: "candidate",
      principalCount: 5,
      actionCount: 8,
      ruleCount: 9,
      updatedAt: "2026-07-26T13:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-principal-identifiers-role-assignments-rules-conditions-approval-content-source-content-personal-data-locators-secrets-or-credentials",
    authorityBoundary: "authorization-model-projection-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-authorization-model-snapshot-binding")) content.initiative.id = authorizationModelId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-authorization-model-snapshot-digest")) value.model.principalCount = 6
  if (workspacePath.endsWith("bad-authorization-model-snapshot-private")) {
    value.principalIdentifier = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readEventIntegrationModel(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE EVENT INTEGRATION MODEL PARAMS")
  }
  const modelDigest = `sha256:${"d".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "event-integration-model-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    model: { recordId: eventIntegrationModelId, revision: 2, digest: modelDigest },
    eventTypeCount: 10,
    commandCount: 11,
    adapterCount: 4,
    externalContractCount: 5,
    mappingCount: 6,
    routeCount: 7,
    uncoveredProcessEventCount: 1,
    uncoveredProcessCount: 2,
    uncoveredBoundedContextCount: 3,
    uncoveredDataEntityCount: 4,
    uncoveredAuthorizationActionCount: 5,
    unknownMappingTruthCount: 6,
    unresolvedRequirementCount: 7,
    inconsistencyCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more integration mappings remain unresolved"],
    assessedAt: "2026-07-26T14:00:00.000Z",
    authorityBoundary: "event-integration-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "event-integration-model-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    model: {
      id: eventIntegrationModelId,
      revision: 2,
      digest: modelDigest,
      membershipDigest: `sha256:${"e".repeat(64)}`,
      state: "candidate",
      eventTypeCount: 10,
      commandCount: 11,
      adapterCount: 4,
      externalContractCount: 5,
      mappingCount: 6,
      routeCount: 7,
      updatedAt: "2026-07-26T13:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-event-payloads-command-inputs-mapping-content-external-locators-source-content-personal-data-secrets-or-credentials",
    authorityBoundary: "event-integration-model-projection-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-event-integration-model-snapshot-binding")) content.initiative.id = eventIntegrationModelId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-event-integration-model-snapshot-digest")) value.model.routeCount = 8
  if (workspacePath.endsWith("bad-event-integration-model-snapshot-private")) {
    value.eventPayload = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readFailureRecoveryModel(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE FAILURE RECOVERY MODEL PARAMS")
  }
  const modelDigest = `sha256:${"c".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "failure-recovery-model-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    model: { recordId: failureRecoveryModelId, revision: 2, digest: modelDigest },
    failureModeCount: 8,
    retryPolicyCount: 6,
    compensationPlanCount: 5,
    recoveryPlanCount: 4,
    recoveryEvidenceDefinitionCount: 3,
    uncoveredProcessCount: 1,
    uncoveredCommandCount: 2,
    uncoveredRouteCount: 3,
    uncoveredAuthorizationActionCount: 4,
    unresolvedRecoveryEvidenceCount: 5,
    unresolvedRequirementCount: 6,
    inconsistencyCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more recovery evidence definitions remain unresolved"],
    assessedAt: "2026-07-26T15:00:00.000Z",
    authorityBoundary: "failure-recovery-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "failure-recovery-model-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    model: {
      id: failureRecoveryModelId,
      revision: 2,
      digest: modelDigest,
      membershipDigest: `sha256:${"b".repeat(64)}`,
      state: "candidate",
      failureModeCount: 8,
      retryPolicyCount: 6,
      compensationPlanCount: 5,
      recoveryPlanCount: 4,
      recoveryEvidenceDefinitionCount: 3,
      updatedAt: "2026-07-26T14:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-failure-evidence-operational-telemetry-retry-keys-compensation-content-recovery-steps-source-content-personal-data-secrets-or-credentials",
    authorityBoundary: "failure-recovery-model-projection-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-failure-recovery-model-snapshot-binding")) content.initiative.id = failureRecoveryModelId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-failure-recovery-model-snapshot-digest")) value.model.recoveryPlanCount = 5
  if (workspacePath.endsWith("bad-failure-recovery-model-snapshot-private")) {
    value.recoveryEvidence = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readArchitectureChallengeModel(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE ARCHITECTURE CHALLENGE PARAMS")
  }
  const modelDigest = `sha256:${"d".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "architecture-challenge-model-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    model: { recordId: architectureChallengeModelId, revision: 2, digest: modelDigest },
    challengeSubjectCount: 3,
    assumptionCount: 4,
    alternativeCount: 5,
    findingCount: 6,
    responseCount: 2,
    unrespondedFindingCount: 4,
    unresolvedAssumptionCount: 2,
    unresolvedRequirementCount: 1,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 1,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required",
    reasons: ["One or more Challenge Findings lack an attributable candidate response"],
    assessedAt: "2026-07-26T16:00:00.000Z",
    authorityBoundary: "architecture-challenge-status-reports-candidate-coverage-and-gaps-and-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "architecture-challenge-model-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    model: {
      id: architectureChallengeModelId,
      revision: 2,
      digest: modelDigest,
      membershipDigest: `sha256:${"b".repeat(64)}`,
      state: "candidate",
      challengeSubjectCount: 3,
      assumptionCount: 4,
      alternativeCount: 5,
      findingCount: 6,
      responseCount: 2,
      updatedAt: "2026-07-26T15:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-challenge-content-assumptions-evidence-findings-responses-source-content-personal-data-secrets-or-credentials",
    authorityBoundary: "architecture-challenge-projection-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action",
  }
  if (workspacePath.endsWith("bad-architecture-challenge-snapshot-binding")) content.initiative.id = architectureChallengeModelId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-architecture-challenge-snapshot-digest")) value.model.findingCount = 7
  if (workspacePath.endsWith("bad-architecture-challenge-snapshot-private")) {
    value.challengeEvidence = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readDecisionRegister(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DECISION REGISTER PARAMS")
  }
  const registerDigest = `sha256:${"d".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "decision-register-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    register: { recordId: decisionRegisterId, revision: 2, digest: registerDigest },
    decisionCount: 7,
    unresolvedDecisionCount: 2,
    selectedPendingDecisionCount: 3,
    deferredDecisionCount: 1,
    unresolvedRequirementCount: 1,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 1,
    state: "attention-required",
    reasons: ["One or more Decision Questions remain unresolved"],
    assessedAt: "2026-07-26T17:00:00.000Z",
    authorityBoundary: "decision-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
  }
  const content = {
    schemaVersion: 1,
    kind: "decision-register-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    register: {
      id: decisionRegisterId,
      revision: 2,
      digest: registerDigest,
      membershipDigest: `sha256:${"b".repeat(64)}`,
      state: "candidate",
      decisionCount: 7,
      updatedAt: "2026-07-26T16:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-decision-questions-options-recommendations-outcomes-rationale-evidence-subject-content-personal-data-secrets-or-credentials",
    authorityBoundary: "decision-register-projection-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
  }
  if (workspacePath.endsWith("bad-decision-register-snapshot-binding")) content.initiative.id = decisionRegisterId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-decision-register-snapshot-digest")) value.register.decisionCount = 8
  if (workspacePath.endsWith("bad-decision-register-snapshot-private")) {
    value.decisionQuestion = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readRiskRegister(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE RISK REGISTER PARAMS")
  }
  const registerDigest = `sha256:${"e".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "risk-register-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    register: { recordId: riskRegisterId, revision: 3, digest: registerDigest },
    riskCount: 9,
    notAssessedRiskCount: 2,
    unresolvedResidualRiskCount: 3,
    proposedTreatmentCount: 9,
    unassignedOwnerCount: 9,
    unverifiedControlCount: 4,
    unresolvedRequirementCount: 1,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 1,
    state: "attention-required",
    reasons: ["One or more Risk Assessments remain explicitly not assessed"],
    assessedAt: "2026-07-26T18:00:00.000Z",
    authorityBoundary: "risk-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
  }
  const content = {
    schemaVersion: 1,
    kind: "risk-register-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    register: {
      id: riskRegisterId,
      revision: 3,
      digest: registerDigest,
      membershipDigest: `sha256:${"c".repeat(64)}`,
      state: "candidate",
      riskCount: 9,
      updatedAt: "2026-07-26T17:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-risk-statements-assessments-controls-treatments-residual-risk-evidence-related-record-content-personal-data-secrets-or-credentials",
    authorityBoundary: "risk-register-projection-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
  }
  if (workspacePath.endsWith("bad-risk-register-snapshot-binding")) content.initiative.id = riskRegisterId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-risk-register-snapshot-digest")) value.register.riskCount = 10
  if (workspacePath.endsWith("bad-risk-register-snapshot-private")) {
    value.riskStatement = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readEvidenceRegistry(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE EVIDENCE REGISTRY PARAMS")
  }
  const registryDigest = `sha256:${"f".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "evidence-registry-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    registry: { recordId: evidenceRegistryId, revision: 4, digest: registryDigest },
    claimCount: 12,
    evidenceItemCount: 18,
    linkCount: 21,
    notAssessedClaimCount: 2,
    notAssessedEvidenceCount: 3,
    adverseEvidencePendingDispositionCount: 1,
    staleOrUnknownEvidenceCount: 4,
    invalidatedEvidenceCount: 1,
    unresolvedLinkCount: 21,
    unresolvedRequirementCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 1,
    state: "attention-required",
    reasons: ["One or more Claims remain explicitly not assessed"],
    assessedAt: "2026-07-27T00:00:00.000Z",
    authorityBoundary: "evidence-registry-status-reports-candidate-coverage-freshness-and-gaps-and-does-not-establish-claim-validation-evidence-sufficiency-assurance-approval-readiness-or-action-authority",
  }
  const content = {
    schemaVersion: 1,
    kind: "evidence-registry-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    registry: {
      id: evidenceRegistryId,
      revision: 4,
      digest: registryDigest,
      membershipDigest: `sha256:${"d".repeat(64)}`,
      state: "candidate",
      claimCount: 12,
      evidenceItemCount: 18,
      linkCount: 21,
      updatedAt: "2026-07-26T23:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-claim-statements-evidence-observations-methods-warrants-quality-details-source-content-personal-data-secrets-or-credentials",
    authorityBoundary: "evidence-registry-projection-does-not-establish-claim-validation-evidence-sufficiency-assurance-review-approval-risk-acceptance-readiness-or-action-authority",
  }
  if (workspacePath.endsWith("bad-evidence-registry-snapshot-binding")) content.initiative.id = evidenceRegistryId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-evidence-registry-snapshot-digest")) value.registry.claimCount = 13
  if (workspacePath.endsWith("bad-evidence-registry-snapshot-private")) {
    value.claimStatement = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readEndToEndTraceability(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE TRACEABILITY PARAMS")
  }
  const traceabilityDigest = `sha256:${"a".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "end-to-end-traceability-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    traceability: { recordId: endToEndTraceabilityId, revision: 3, digest: traceabilityDigest },
    nodeCount: 44,
    relationshipCount: 12,
    linkCount: 67,
    transformationCount: 5,
    verifiedLinkCount: 40,
    proposedLinkCount: 20,
    invalidOrHistoricalLinkCount: 7,
    unresolvedEndpointCount: 2,
    notAssessedSemanticCount: 6,
    missingSpineCount: 1,
    unknownRelationshipCount: 3,
    unresolvedRequirementCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    inconsistencyCount: 1,
    unresolvedQuestionCount: 2,
    state: "attention-required",
    reasons: ["One or more Trace Links have unresolved endpoints"],
    assessedAt: "2026-07-27T02:30:00.000Z",
    coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship",
    authorityBoundary: "end-to-end-traceability-status-reports-candidate-coverage-and-gaps-and-does-not-establish-relationship-truth-completeness-approval-readiness-or-action-authority",
  }
  const content = {
    schemaVersion: 1,
    kind: "end-to-end-traceability-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    traceability: {
      id: endToEndTraceabilityId,
      revision: 3,
      digest: traceabilityDigest,
      membershipDigest: `sha256:${"b".repeat(64)}`,
      state: "candidate",
      nodeCount: 44,
      relationshipCount: 12,
      linkCount: 67,
      transformationCount: 5,
      updatedAt: "2026-07-27T02:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-node-content-link-rationale-transformation-detail-source-content-personal-data-secrets-or-credentials",
    authorityBoundary: "end-to-end-traceability-projection-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority",
  }
  if (workspacePath.endsWith("bad-traceability-snapshot-binding")) content.initiative.id = endToEndTraceabilityId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-traceability-snapshot-digest")) value.traceability.nodeCount = 45
  if (workspacePath.endsWith("bad-traceability-snapshot-private")) {
    value.linkRationale = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readP0P4ReadinessGate(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE READINESS GATE PARAMS")
  }
  const gateDigest = `sha256:${"c".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "p0-p4-readiness-gate-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    gate: { recordId: p0P4ReadinessGateId, revision: 2, digest: gateDigest },
    outputCount: 25,
    applicableOutputCount: 20,
    notApplicableOutputCount: 4,
    unresolvedApplicabilityCount: 1,
    satisfiedOutputCount: 17,
    conditionalOutputCount: 1,
    incompleteOutputCount: 1,
    failedOutputCount: 1,
    blockedOutputCount: 0,
    staleOrUnknownOutputCount: 1,
    pendingOrInvalidWaiverCount: 1,
    unresolvedDecisionCount: 2,
    unmetConditionCount: 1,
    unresolvedRequirementCount: 2,
    adverseEvidenceCount: 1,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 1,
    result: "failed",
    reasons: ["The exact Evidence Registry contains adverse evidence"],
    assessedAt: "2026-07-27T03:30:00.000Z",
    gateBoundary: "a-passing-gate-is-an-evaluation-result-not-permission",
    authorityBoundary: "p0-p4-readiness-gate-status-is-an-evaluation-result-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
  }
  const content = {
    schemaVersion: 1,
    kind: "p0-p4-readiness-gate-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    gate: {
      id: p0P4ReadinessGateId,
      revision: 2,
      digest: gateDigest,
      membershipDigest: `sha256:${"d".repeat(64)}`,
      state: "candidate",
      evaluationDefinitionDigest: `sha256:${"e".repeat(64)}`,
      outputCount: 25,
      waiverCount: 1,
      unresolvedDecisionCount: 2,
      conditionCount: 1,
      updatedAt: "2026-07-27T03:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-results-and-digests-only-not-output-content-criteria-findings-waiver-rationale-decision-content-evidence-content-source-content-personal-data-secrets-or-credentials",
    authorityBoundary: "p0-p4-readiness-gate-projection-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
  }
  if (workspacePath.endsWith("bad-readiness-gate-snapshot-binding")) content.initiative.id = p0P4ReadinessGateId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-readiness-gate-snapshot-digest")) value.gate.outputCount = 24
  if (workspacePath.endsWith("bad-readiness-gate-snapshot-private")) {
    value.waiverRationale = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readP5HandoffPackage(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE P5 HANDOFF PARAMS")
  }
  const handoffDigest = `sha256:${"1".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "p5-handoff-package-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    handoff: { recordId: p5HandoffPackageId, revision: 3, digest: handoffDigest },
    itemCount: 25,
    includedItemCount: 17,
    referenceOnlyItemCount: 3,
    omittedNotApplicableItemCount: 4,
    unresolvedItemCount: 1,
    staleOrUnknownItemCount: 2,
    lossyTransformationCount: 1,
    unresolvedRequirementCount: 2,
    conflictCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    readinessResult: "incomplete",
    transferState: "held",
    state: "attention-required",
    reasons: ["The current P0-P4 Readiness Gate evaluation has not passed"],
    assessedAt: "2026-07-27T04:00:00.000Z",
    handoffBoundary: "handoff-transfers-exact-candidate-context-not-source-ownership-or-authority",
    authorityBoundary: "p5-handoff-package-status-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-or-action-authority",
  }
  const content = {
    schemaVersion: 1,
    kind: "p5-handoff-package-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    handoff: {
      id: p5HandoffPackageId,
      revision: 3,
      digest: handoffDigest,
      membershipDigest: `sha256:${"2".repeat(64)}`,
      state: "candidate",
      readinessStatusDigest: `sha256:${"3".repeat(64)}`,
      itemCount: 25,
      requirementCount: 66,
      deliveryMode: "disconnected",
      updatedAt: "2026-07-27T03:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-item-content-summaries-omissions-uncertainties-source-content-personal-data-secrets-credentials-or-destinations",
    authorityBoundary: "p5-handoff-package-projection-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-write-or-action-authority",
  }
  if (workspacePath.endsWith("bad-p5-handoff-snapshot-binding")) content.initiative.id = p5HandoffPackageId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-p5-handoff-snapshot-digest")) value.handoff.itemCount = 24
  if (workspacePath.endsWith("bad-p5-handoff-snapshot-private")) {
    value.itemContent = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readDesignApplicability(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGN APPLICABILITY PARAMS")
  }
  const candidateDigest = `sha256:${"4".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "design-applicability-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    candidate: { recordId: designApplicabilityId, revision: 2, digest: candidateDigest },
    scopeCount: 2,
    decisionCount: 8,
    unresolvedDecisionCount: 1,
    blockedDecisionCount: 0,
    pendingApprovalCount: 1,
    rejectedApprovalCount: 0,
    unresolvedDepthCount: 1,
    unresolvedSourceCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 1,
    unresolvedQuestionCount: 2,
    reviewState: "held",
    state: "attention-required",
    reasons: ["One or more target scopes remain unresolved"],
    assessedAt: "2026-07-28T04:00:00.000Z",
    authorityBoundary: "design-applicability-status-is-observational-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-implementation-or-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "design-applicability-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    candidate: {
      id: designApplicabilityId,
      revision: 2,
      digest: candidateDigest,
      membershipDigest: `sha256:${"5".repeat(64)}`,
      state: "candidate",
      scopeCount: 2,
      reviewState: "held",
      updatedAt: "2026-07-28T03:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-rationales-source-content-journeys-design-content-personal-data-secrets-or-credentials",
    authorityBoundary: "design-applicability-projection-is-read-only-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-write-implementation-or-action",
  }
  if (workspacePath.endsWith("bad-design-applicability-snapshot-binding")) content.initiative.id = designApplicabilityId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-design-applicability-snapshot-digest")) value.candidate.scopeCount = 3
  if (workspacePath.endsWith("bad-design-applicability-snapshot-private")) {
    value.rationale = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readDesignPersonaRoleModel(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGN PERSONA ROLE PARAMS")
  }
  const candidateDigest = `sha256:${"6".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "design-persona-role-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    candidate: { recordId: designPersonaRoleId, revision: 2, digest: candidateDigest },
    personaCount: 2,
    designRoleCount: 1,
    representedParticipantCategoryCount: 4,
    unresolvedParticipantCategoryCount: 1,
    representedRoleKindCount: 1,
    unresolvedRoleKindCount: 1,
    weakEvidencePersonaCount: 1,
    humanReviewedPersonaCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 1,
    unresolvedQuestionCount: 2,
    reviewState: "held",
    state: "attention-required",
    reasons: ["One or more design participant categories remain unresolved"],
    assessedAt: "2026-07-28T08:30:00.000Z",
    authorityBoundary: "design-persona-role-status-is-observational-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "design-persona-role-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    candidate: {
      id: designPersonaRoleId,
      revision: 2,
      digest: candidateDigest,
      membershipDigest: `sha256:${"7".repeat(64)}`,
      state: "candidate",
      personaCount: 2,
      designRoleCount: 1,
      reviewState: "held",
      updatedAt: "2026-07-28T08:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-persona-content-behaviors-constraints-source-content-personal-data-secrets-or-credentials",
    authorityBoundary: "design-persona-role-projection-is-read-only-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-write-or-action",
  }
  if (workspacePath.endsWith("bad-design-persona-role-snapshot-binding")) content.initiative.id = designPersonaRoleId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-design-persona-role-snapshot-digest")) value.candidate.personaCount = 3
  if (workspacePath.endsWith("bad-design-persona-role-snapshot-private")) {
    value.personaBehavior = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readUserJourneyModel(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE USER JOURNEY PARAMS")
  }
  const candidateDigest = `sha256:${"8".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "user-journey-model-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    candidate: { recordId: userJourneyId, revision: 2, digest: candidateDigest },
    journeyCount: 2,
    touchpointCount: 3,
    primaryPathCount: 2,
    successPathCount: 2,
    failurePathCount: 2,
    recoveryPathCount: 2,
    representedScopeCount: 1,
    unresolvedScopeCount: 1,
    weakEvidencePathCount: 2,
    staleBindingCount: 0,
    staleSourceReferenceCount: 1,
    unresolvedQuestionCount: 2,
    reviewState: "held",
    state: "attention-required",
    reasons: ["One or more Design Applicability scopes have unresolved User Journey coverage"],
    assessedAt: "2026-07-28T09:30:00.000Z",
    authorityBoundary: "user-journey-model-status-is-observational-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "user-journey-model-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    candidate: {
      id: userJourneyId,
      revision: 2,
      digest: candidateDigest,
      membershipDigest: `sha256:${"9".repeat(64)}`,
      state: "candidate",
      journeyCount: 2,
      touchpointCount: 3,
      reviewState: "held",
      updatedAt: "2026-07-28T09:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-journey-step-touchpoint-persona-source-or-personal-content-secrets-or-credentials",
    authorityBoundary: "user-journey-model-projection-is-read-only-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-write-or-action",
  }
  if (workspacePath.endsWith("bad-user-journey-snapshot-binding")) content.initiative.id = userJourneyId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-user-journey-snapshot-digest")) value.candidate.journeyCount = 3
  if (workspacePath.endsWith("bad-user-journey-snapshot-private")) {
    value.journeyStep = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readInformationArchitectureModel(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INFORMATION ARCHITECTURE PARAMS")
  }
  const candidateDigest = `sha256:${"a".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "information-architecture-model-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    candidate: { recordId: informationArchitectureId, revision: 2, digest: candidateDigest },
    nodeCount: 6,
    rootNodeCount: 2,
    routeCount: 8,
    representedScopeCount: 1,
    unresolvedScopeCount: 1,
    weakEvidenceNodeCount: 2,
    weakEvidenceRouteCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 1,
    unresolvedQuestionCount: 2,
    reviewState: "held",
    state: "attention-required",
    reasons: ["One or more Design Applicability scopes have unresolved Information Architecture coverage"],
    assessedAt: "2026-07-28T10:30:00.000Z",
    authorityBoundary: "information-architecture-status-is-observational-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "information-architecture-model-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    candidate: {
      id: informationArchitectureId,
      revision: 2,
      digest: candidateDigest,
      membershipDigest: `sha256:${"b".repeat(64)}`,
      state: "candidate",
      nodeCount: 6,
      rootNodeCount: 2,
      routeCount: 8,
      reviewState: "held",
      updatedAt: "2026-07-28T10:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-node-route-content-persona-source-or-personal-content-secrets-or-credentials",
    authorityBoundary: "information-architecture-projection-is-read-only-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-write-or-action",
  }
  if (workspacePath.endsWith("bad-information-architecture-snapshot-binding")) {
    content.initiative.id = informationArchitectureId
  }
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-information-architecture-snapshot-digest")) value.candidate.nodeCount = 7
  if (workspacePath.endsWith("bad-information-architecture-snapshot-private")) {
    value.nodeLabel = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readScreenStateInventory(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE SCREEN STATE INVENTORY PARAMS")
  }
  const candidateDigest = `sha256:${"c".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "screen-state-inventory-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    candidate: { recordId: screenStateInventoryId, revision: 2, digest: candidateDigest },
    platformCount: 3,
    targetedPlatformCount: 2,
    unresolvedPlatformCount: 1,
    screenCount: 8,
    stateCount: 24,
    variantCount: 6,
    representedRouteCount: 7,
    unresolvedRouteCount: 1,
    representedScopeCount: 1,
    unresolvedScopeCount: 1,
    weakEvidenceItemCount: 2,
    staleBindingCount: 0,
    staleSourceReferenceCount: 1,
    unresolvedQuestionCount: 2,
    reviewState: "held",
    state: "attention-required",
    reasons: ["One or more experience platforms remain unresolved"],
    assessedAt: "2026-07-28T11:30:00.000Z",
    authorityBoundary: "screen-state-inventory-status-is-observational-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-action",
  }
  const content = {
    schemaVersion: 1,
    kind: "screen-state-inventory-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    candidate: {
      id: screenStateInventoryId,
      revision: 2,
      digest: candidateDigest,
      membershipDigest: `sha256:${"d".repeat(64)}`,
      state: "candidate",
      platformCount: 3,
      screenCount: 8,
      stateCount: 24,
      variantCount: 6,
      reviewState: "held",
      updatedAt: "2026-07-28T11:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-screen-state-variant-platform-content-persona-source-or-personal-content-secrets-or-credentials",
    authorityBoundary: "screen-state-inventory-projection-is-read-only-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-write-or-action",
  }
  if (workspacePath.endsWith("bad-screen-state-inventory-snapshot-binding")) content.initiative.id = screenStateInventoryId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-screen-state-inventory-snapshot-digest")) value.candidate.screenCount = 9
  if (workspacePath.endsWith("bad-screen-state-inventory-snapshot-private")) {
    value.screenLabel = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function readDesignRequirements(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGN REQUIREMENTS PARAMS")
  }
  const candidateDigest = `sha256:${"e".repeat(64)}`
  const status = {
    schemaVersion: 1,
    kind: "design-requirements-status",
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: initiativeState.revision,
    candidate: { recordId: designRequirementsId, revision: 2, digest: candidateDigest },
    requirementCount: 12,
    mustPriorityCount: 5,
    representedOutcomeCount: 4,
    unresolvedOutcomeCount: 1,
    linkedBacklogRequirementCount: 8,
    notPlannedRequirementCount: 2,
    unresolvedBacklogRequirementCount: 2,
    workItemCount: 10,
    weakEvidenceRequirementCount: 3,
    staleBindingCount: 0,
    staleDomainReferenceCount: 1,
    staleSourceReferenceCount: 1,
    unresolvedQuestionCount: 2,
    catalogCompletenessState: "not-assessed",
    reviewState: "held",
    state: "attention-required",
    reasons: ["One or more Design Requirements retain unresolved outcome or backlog coverage"],
    assessedAt: "2026-07-28T12:30:00.000Z",
    authorityBoundary: "design-requirements-status-is-observational-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-action-authority",
  }
  const content = {
    schemaVersion: 1,
    kind: "design-requirements-projection",
    product: { id: productId, revision: 7, digest: canonicalDigest(productRecord()) },
    initiative: { id: initiativeId, revision: initiativeState.revision, digest: canonicalDigest(initiativeState), state: initiativeState.state },
    status,
    candidate: {
      id: designRequirementsId,
      revision: 2,
      digest: candidateDigest,
      membershipDigest: `sha256:${"f".repeat(64)}`,
      state: "candidate",
      requirementCount: 12,
      representedOutcomeCount: 4,
      workItemCount: 10,
      reviewState: "held",
      updatedAt: "2026-07-28T12:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-requirement-outcome-work-item-design-target-source-or-personal-content-secrets-or-credentials",
    authorityBoundary: "design-requirements-projection-is-read-only-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-write-or-action-authority",
  }
  if (workspacePath.endsWith("bad-design-requirements-snapshot-binding")) content.initiative.id = designRequirementsId
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-design-requirements-snapshot-digest")) value.candidate.requirementCount = 13
  if (workspacePath.endsWith("bad-design-requirements-snapshot-private")) {
    value.requirementStatement = `${privateRoot}/${privateCredential}`
  }
  return writeResult(id, value)
}

function initiativeAssessment() {
  const classification = initiativeState.classification
  const applicability = initiativeState.applicability
  const reasons = []
  if (!classification) reasons.push("Initiative classification is missing")
  if (classification) reasons.push("Initiative classification does not satisfy the current completeness policy")
  if (!applicability) reasons.push("Initiative applicability has not been resolved")
  const coveredSubjectCount = Math.min(
    (applicability?.decisions.length ?? 0) + (applicability?.unresolvedSubjects.length ?? 0),
    subjectCatalogCount,
  )
  const missingSubjectCount = classification ? subjectCatalogCount - coveredSubjectCount : 0
  if (applicability && missingSubjectCount > 0) reasons.push("Initiative applicability does not cover every canonical subject")
  const pendingHumanDecisionCount = applicability?.decisions.filter((decision) => decision.status === "awaiting-human-decision").length ?? 0
  const blockedDecisionCount = applicability?.decisions.filter((decision) => decision.status === "blocked").length ?? 0
  const pendingApprovalCount = applicability?.decisions.filter((decision) => decision.approval.state === "pending").length ?? 0
  const rejectedApprovalCount = applicability?.decisions.filter((decision) => decision.approval.state === "rejected").length ?? 0
  if ((applicability?.unresolvedSubjects.length ?? 0) > 0) reasons.push("Applicability subjects remain explicitly unresolved")
  if (pendingHumanDecisionCount > 0) reasons.push("Applicability decisions await accountable human judgment")
  if (blockedDecisionCount > 0) reasons.push("One or more required applicability decisions are blocked")
  if (pendingApprovalCount > 0) reasons.push("Applicability approvals remain pending")
  if (rejectedApprovalCount > 0) reasons.push("One or more applicability approvals were rejected")
  return {
    schemaVersion: 1,
    kind: "initiative-entry-assessment",
    initiativeId,
    initiativeRevision: initiativeState.revision,
    productId,
    productRevision: 7,
    productDigest: canonicalDigest(productRecord()),
    classification: classification
      ? {
          status: "current",
          digest: canonicalDigest(classification),
          completeness: {
            status: "incomplete",
            policyVersion: completenessPolicyVersion,
            policyDigest: completenessPolicyDigest,
            unknownDimensionCount: 0,
            unresolvedQuestionCount: classification.unresolvedQuestions.length,
            missingConditionalDimensionCount: 0,
            confidenceSufficient: true,
          },
        }
      : {
          status: "missing",
          completeness: {
            status: "missing",
            policyVersion: completenessPolicyVersion,
            policyDigest: completenessPolicyDigest,
            unknownDimensionCount: 0,
            unresolvedQuestionCount: 0,
            missingConditionalDimensionCount: 0,
            confidenceSufficient: false,
          },
        },
    applicability: applicability
      ? {
          status: "current",
          matrixRevision: applicability.revision,
          digest: canonicalDigest(applicability),
          decisionCount: applicability.decisions.length,
          unresolvedSubjectCount: applicability.unresolvedSubjects.length,
          pendingHumanDecisionCount,
          blockedDecisionCount,
          pendingApprovalCount,
          rejectedApprovalCount,
          coverage: {
            status: missingSubjectCount === 0 ? "complete" : "incomplete",
            catalogVersion: subjectCatalogVersion,
            catalogDigest: subjectCatalogDigest,
            subjectCount: subjectCatalogCount,
            coveredSubjectCount,
            missingSubjectCount,
            unexpectedSubjectCount: 0,
            mismatchedSubjectCount: 0,
          },
        }
      : {
          status: "missing",
          decisionCount: 0,
          unresolvedSubjectCount: 0,
          pendingHumanDecisionCount: 0,
          blockedDecisionCount: 0,
          pendingApprovalCount: 0,
          rejectedApprovalCount: 0,
          coverage: classification
            ? {
                status: "missing",
                catalogVersion: subjectCatalogVersion,
                catalogDigest: subjectCatalogDigest,
                subjectCount: subjectCatalogCount,
                coveredSubjectCount: 0,
                missingSubjectCount: subjectCatalogCount,
                unexpectedSubjectCount: 0,
                mismatchedSubjectCount: 0,
              }
            : {
                status: "unavailable",
                subjectCount: 0,
                coveredSubjectCount: 0,
                missingSubjectCount: 0,
                unexpectedSubjectCount: 0,
                mismatchedSubjectCount: 0,
              },
        },
    state: blockedDecisionCount > 0 || rejectedApprovalCount > 0 ? "blocked" : reasons.length > 0 ? "attention-required" : "ready",
    reasons,
    assessedAt: "2026-07-25T00:00:00.000Z",
    authorityBoundary: "entry-assessment-is-read-only-and-does-not-grant-approval-readiness-or-action-authority",
  }
}

function assessInitiativeEntry(id, params) {
  if (!exactKeys(params, ["initiativeId"]) || params.initiativeId !== initiativeId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE ASSESSMENT PARAMS")
  }
  const value = initiativeAssessment()
  if (workspacePath.endsWith("bad-entry-boundary")) value.authorityBoundary = "approved"
  if (workspacePath.endsWith("bad-entry-policy")) delete value.classification.completeness
  return writeResult(id, value)
}

function classifyInitiative(id, params) {
  if (!exactKeys(params, ["initiativeId", "expectedInitiativeRevision", "actorId", "classification"]) ||
      params.initiativeId !== initiativeId || params.expectedInitiativeRevision !== initiativeState.revision) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE CLASSIFICATION PARAMS")
  }
  const now = "2026-07-25T00:01:00.000Z"
  initiativeState = {
    ...initiativeState,
    revision: initiativeState.revision + 1,
    classification: {
      ...params.classification,
      productProfile: "software",
      productRevision: 7,
      productDigest: canonicalDigest(productRecord()),
      completenessPolicyVersion,
      completenessPolicyDigest,
      classifiedBy: { kind: "human", id: params.actorId },
      classifiedAt: now,
      authorityBoundary: "classification-guides-profile-selection-and-does-not-grant-approval-or-action-authority",
    },
    ...(initiativeState.applicability ? {
      applicability: {
        ...initiativeState.applicability,
        state: "stale",
        invalidatedAt: now,
        invalidationReason: "Initiative classification was superseded",
      },
    } : {}),
    updatedAt: now,
  }
  if (workspacePath.endsWith("bad-classification-binding")) initiativeState.revision += 1
  if (workspacePath.endsWith("bad-classification-content")) initiativeState.classification.rationale = "Substituted classification content"
  return writeResult(id, initiativeState)
}

function resolveInitiativeApplicability(id, params) {
  if (!exactKeys(params, ["initiativeId", "expectedInitiativeRevision", "actorId", "applicability"]) ||
      params.initiativeId !== initiativeId || params.expectedInitiativeRevision !== initiativeState.revision ||
      !initiativeState.classification) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE APPLICABILITY PARAMS")
  }
  const now = "2026-07-25T00:02:00.000Z"
  const nextRevision = initiativeState.revision + 1
  const previous = new Map((initiativeState.applicability?.decisions ?? []).map((decision) => [
    `${decision.subject.type}:${decision.subject.key}`,
    decision,
  ]))
  const decisions = params.applicability.decisions.map((decision, index) => {
    const prior = previous.get(`${decision.subject.type}:${decision.subject.key}`)
    return {
      ...decision,
      id: prior?.id ?? `30303030-3030-4030-8030-${String(index + 1).padStart(12, "0")}`,
      revision: (prior?.revision ?? 0) + 1,
      initiativeRevision: nextRevision,
      decidedBy: { kind: "human", id: params.actorId },
      decidedAt: now,
      authorityBoundary: "applicability-decision-does-not-grant-approval-readiness-or-action-authority",
    }
  })
  initiativeState = {
    ...initiativeState,
    revision: nextRevision,
    applicability: {
      schemaVersion: 1,
      kind: "initiative-applicability-matrix",
      decisions,
      unresolvedSubjects: params.applicability.unresolvedSubjects,
      revision: (initiativeState.applicability?.revision ?? 0) + 1,
      initiativeId,
      productId,
      initiativeRevision: nextRevision,
      classificationDigest: canonicalDigest(initiativeState.classification),
      subjectCatalog: {
        catalogVersion: subjectCatalogVersion,
        digest: subjectCatalogDigest,
        subjectCount: subjectCatalogCount,
      },
      state: "current",
      evaluatedBy: { kind: "human", id: params.actorId },
      evaluatedAt: now,
      authorityBoundary: "applicability-matrix-does-not-grant-approval-readiness-or-action-authority",
    },
    updatedAt: now,
  }
  if (workspacePath.endsWith("bad-applicability-binding")) initiativeState.applicability.evaluatedBy.id = "other-actor"
  if (workspacePath.endsWith("bad-applicability-content")) initiativeState.applicability.decisions[0].rationale = "Substituted applicability content"
  return writeResult(id, initiativeState)
}

function readPhaseDashboard(id, params) {
  const productDigest = canonicalDigest(productRecord())
  if (!exactKeys(params, ["phase", "expectedProductId", "expectedProductRevision", "expectedProductDigest"]) ||
      params.phase !== "phase-0-1a-foundation" || params.expectedProductId !== productId ||
      params.expectedProductRevision !== 7 || params.expectedProductDigest !== productDigest) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DASHBOARD PARAMS")
  }
  const content = {
    schemaVersion: 1,
    kind: "phase-dashboard-framework",
    catalogVersion: "gaep-phase-dashboards-v1",
    product: { recordType: "product", recordId: productId, revision: 7, digest: productDigest },
    phase: { id: "phase-0-1a-foundation", label: "Phase 0 / 1A — Four-IDE Platform Foundation" },
    panels: [
      {
        id: "foundation-summary",
        role: "phase",
        title: "Foundation summary and readiness",
        applicability: { status: "unknown", basis: "not-evaluated" },
        state: "attention-required",
      },
      {
        id: "change-impact",
        role: "change-impact",
        title: "Change and impact",
        applicability: { status: "applicable", basis: "phase-contract" },
        state: "active",
      },
      {
        id: "agent-model",
        role: "agent-model",
        title: "Agent and model",
        applicability: { status: "applicable", basis: "phase-contract" },
        state: "active",
      },
    ],
    evidenceCues: {
      freshness: "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    observedAt: "2026-07-24T12:00:00.000Z",
    sourceBoundary: "governed-repository-and-engine-only",
    limitations: [
      "The selected phase scopes presentation only; it does not prove phase entry, completion, acceptance, or release readiness.",
      "The phase dashboard remains attention-required until a governed applicability decision is bound.",
    ],
    authorityBoundary: "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence",
  }
  if (workspacePath.endsWith("bad-dashboard-binding")) content.product.digest = `sha256:${"0".repeat(64)}`
  if (workspacePath.endsWith("bad-dashboard-applicability")) {
    content.panels[0].applicability = { status: "applicable", basis: "not-evaluated" }
    content.panels[0].state = "active"
  }
  if (workspacePath.endsWith("bad-dashboard-evidence-cues")) content.evidenceCues.freshness = "unknown"
  const value = { ...content, compositionDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-dashboard-digest")) value.panels[0].title = "Forged dashboard title"
  if (workspacePath.endsWith("bad-dashboard-private")) value.sourceRoot = `${privateRoot}/${privateCredential}`
  return writeResult(id, value)
}

function readPhase1Summary(id, params) {
  const productDigest = canonicalDigest(productRecord())
  const initiativeDigest = canonicalDigest(initiativeState)
  if (!exactKeys(params, [
    "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedInitiativeId",
    "expectedInitiativeRevision", "expectedInitiativeDigest",
  ])) return writeError(id, -32_602, "PHASE1_KEYS_INVALID", "Phase 1 summary request keys are invalid")
  if (params.expectedProductId !== productId || params.expectedProductRevision !== 7 ||
      params.expectedProductDigest !== productDigest) {
    return writeError(id, -32_602, "PHASE1_PRODUCT_INVALID", "Phase 1 summary Product binding is invalid")
  }
  if (params.expectedInitiativeId !== initiativeId || params.expectedInitiativeRevision !== initiativeState.revision ||
      params.expectedInitiativeDigest !== initiativeDigest) {
    return writeError(id, -32_602, "PHASE1_INITIATIVE_INVALID", "Phase 1 summary Initiative binding is invalid")
  }
  const readinessGaps = Object.fromEntries([
    "applicability", "conditional", "incomplete", "failed", "blocked", "staleOrUnknown", "waivers",
    "decisions", "conditions", "requirements", "adverseEvidence", "bindings", "sourceReferences",
    "inconsistencies", "questions", "total",
  ].map((key) => [key, 0]))
  const handoffGaps = Object.fromEntries([
    "unresolvedItems", "staleOrUnknownItems", "requirements", "conflicts", "questions", "bindings",
    "sourceReferences", "total",
  ].map((key) => [key, 0]))
  const content = {
    schemaVersion: 1,
    kind: "phase-1-summary-readiness-dashboard",
    phase: { id: "phase-1b-product", label: "Phase 1B — Product P0–P4" },
    product: { recordType: "product", recordId: productId, revision: 7, digest: productDigest },
    initiative: {
      recordType: "initiative",
      recordId: initiativeId,
      revision: initiativeState.revision,
      digest: initiativeDigest,
      state: initiativeState.state,
    },
    readiness: {
      snapshotDigest: `sha256:${"1".repeat(64)}`,
      result: "not-assessed",
      assessedAt: "2026-07-27T12:00:00.000Z",
      outputs: { total: 0, applicable: 0, notApplicable: 0, unresolvedApplicability: 0, satisfied: 0 },
      gaps: readinessGaps,
      reasonCount: 1,
      attentionRequired: true,
      authorityBoundary: "readiness-result-is-evaluation-only-not-permission-or-product-readiness",
    },
    handoff: {
      snapshotDigest: `sha256:${"2".repeat(64)}`,
      state: "attention-required",
      transferState: "draft",
      assessedAt: "2026-07-27T12:00:01.000Z",
      items: { total: 0, included: 0, referenceOnly: 0, omittedNotApplicable: 0, unresolved: 0 },
      gaps: handoffGaps,
      reasonCount: 1,
      attentionRequired: true,
      authorityBoundary: "handoff-status-is-candidate-context-only-not-transfer-or-phase-entry-authority",
    },
    phaseStatus: {
      state: "attention-required",
      declaredGapCount: 0,
      attentionSignalCount: 2,
      productOwnerAcceptance: "not-established",
      readinessAuthority: "not-established",
      phaseEntryAuthority: "not-established",
    },
    owners: { state: "unbound", boundOwnerCount: 0, basis: "no-governed-phase-owner-assignment-is-bound" },
    freshness: {
      state: "current",
      readinessObservedAt: "2026-07-27T12:00:02.000Z",
      handoffObservedAt: "2026-07-27T12:00:03.000Z",
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      basis: "exact-current-projections-and-declared-binding-freshness",
    },
    evidenceCues: {
      freshness: "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    observedAt: "2026-07-27T12:00:04.000Z",
    sourceBoundary: "current-governed-product-initiative-readiness-and-handoff-projections-only",
    privacyBoundary: "summary-exposes-identities-counts-statuses-times-and-digests-not-narrative-findings-evidence-source-content-personal-data-secrets-or-credentials",
    limitations: ["Phase ownership remains unbound until a governed phase-owner assignment record is available."],
    authorityBoundary: "phase-1-summary-is-read-only-candidate-evidence-not-readiness-approval-acceptance-phase-entry-release-or-action-authority",
  }
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-phase1-summary-digest")) value.phaseStatus.state = "candidate-complete"
  if (workspacePath.endsWith("bad-dashboard-private")) value.sourceRoot = `${privateRoot}/${privateCredential}`
  return writeResult(id, value)
}

function changeRecord() {
  return {
    schemaVersion: 1,
    kind: "change",
    id: changeId,
    productId,
    revision: 3,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Private Change title is withheld",
    summary: "Private Change summary is withheld.",
    baseline: { kind: "genesis", declaration: "No earlier projection.", rationale: "First projection." },
    state: "active",
    effectEnvelope: ["reversible-change"],
    createdAt: "2026-07-24T12:01:00.000Z",
    updatedAt: "2026-07-24T12:02:00.000Z",
  }
}

function changeReference() {
  const change = changeRecord()
  return {
    recordType: "change",
    recordId: change.id,
    revision: change.revision,
    digest: canonicalDigest(change),
    state: change.state,
    effectEnvelope: change.effectEnvelope,
  }
}

function readChangeCatalog(id, params) {
  const productDigest = canonicalDigest(productRecord())
  if (!exactKeys(params, ["expectedProductId", "expectedProductRevision", "expectedProductDigest"]) ||
      params.expectedProductId !== productId || params.expectedProductRevision !== 7 ||
      params.expectedProductDigest !== productDigest) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE CHANGE CATALOG PARAMS")
  }
  const content = {
    schemaVersion: 1,
    kind: "change-impact-change-catalog",
    product: { recordType: "product", recordId: productId, revision: 7, digest: productDigest },
    items: [changeReference()],
    total: 1,
    omitted: 0,
    observedAt: "2026-07-24T12:03:00.000Z",
    sourceBoundary: "current-governed-change-metadata-only",
    limitations: [
      "The catalog contains exact current Change metadata only; Product text, Change text, and source content are withheld.",
    ],
    authorityBoundary: "change-catalog-selection-does-not-approve-change-or-authorize-effects",
  }
  if (workspacePath.endsWith("bad-change-catalog-binding")) content.product.digest = `sha256:${"0".repeat(64)}`
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-change-catalog-digest")) value.items[0].state = "blocked"
  if (workspacePath.endsWith("bad-change-catalog-private")) value.sourceRoot = `${privateRoot}/${privateCredential}`
  return writeResult(id, value)
}

function readChangeImpact(id, params) {
  const productDigest = canonicalDigest(productRecord())
  const change = changeReference()
  if (!exactKeys(params, [
    "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedChangeId",
    "expectedChangeRevision", "expectedChangeDigest",
  ]) || params.expectedProductId !== productId || params.expectedProductRevision !== 7 ||
      params.expectedProductDigest !== productDigest || params.expectedChangeId !== change.recordId ||
      params.expectedChangeRevision !== change.revision || params.expectedChangeDigest !== change.digest) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE CHANGE IMPACT PARAMS")
  }
  const workItem = { recordType: "work-item", recordId: workItemId, revision: 2, digest: `sha256:${"3".repeat(64)}` }
  const decision = { recordType: "decision", recordId: decisionId, revision: 1, digest: `sha256:${"4".repeat(64)}` }
  const risk = { recordType: "risk", recordId: riskId, revision: 1, digest: `sha256:${"5".repeat(64)}` }
  const content = {
    schemaVersion: 1,
    kind: "change-impact-dashboard",
    product: { recordType: "product", recordId: productId, revision: 7, digest: productDigest },
    change,
    workItems: [{ record: workItem, state: "in-progress" }],
    changedArtifacts: [{ sourceWorkItem: workItem, locator: { kind: "workspace-relative", path: "apps/kiro/src/protocol.ts" } }],
    effectTargets: [{ sourceWorkItem: workItem, locator: { kind: "logical", value: "package.build" } }],
    affectedUnits: [{
      direction: "upstream",
      relationship: "affects",
      endpoint: risk,
      trace: { recordId: traceId, revision: 1, assessmentDigest: `sha256:${"6".repeat(64)}`, assessedState: "valid" },
    }],
    governance: {
      approval: { state: "not-established", basis: "current-contract-has-no-change-approval-record" },
      decisions: [{ record: decision, state: "open", outcome: "not-selected" }],
      risks: [{ record: risk, state: "open", likelihood: "possible", impact: "major", acceptance: "not-accepted" }],
      authorityBoundary: "decisions-and-risk-acceptance-do-not-approve-the-change",
    },
    freshness: {
      state: "current",
      evaluatedAt: "2026-07-24T12:04:00.000Z",
      unresolvedTraceLinks: 0,
      invalidTraceLinks: 0,
      staleTraceLinks: 0,
      staleGovernanceReferences: 0,
      traceAnalysisTruncated: false,
      coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact",
    },
    evidenceCues: {
      freshness: "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    limits: {
      workItems: { shown: 1, total: 1, omitted: 0 },
      changedArtifacts: { shown: 1, total: 1, omitted: 0 },
      effectTargets: { shown: 1, total: 1, omitted: 0 },
      affectedUnits: { shown: 1, total: 1, omitted: 0 },
      decisions: { shown: 1, total: 1, omitted: 0 },
      risks: { shown: 1, total: 1, omitted: 0 },
      truncated: false,
    },
    observedAt: "2026-07-24T12:05:00.000Z",
    sourceBoundary: "current-governed-records-and-bounded-trace-analysis",
    limitations: [
      "Only persisted Work Item scopes and trace links are shown; missing trace does not prove missing impact.",
      "The current record model has no general Change approval record, so approval remains not established.",
    ],
    authorityBoundary: "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects",
  }
  if (workspacePath.endsWith("bad-change-impact-binding")) content.change.digest = `sha256:${"0".repeat(64)}`
  if (workspacePath.endsWith("bad-change-impact-count")) content.limits.workItems.total = 2
  if (workspacePath.endsWith("bad-change-impact-freshness")) content.freshness.state = "attention-required"
  if (workspacePath.endsWith("bad-change-impact-evidence-cues")) content.evidenceCues.freshness = "stale"
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-change-impact-digest")) value.change.state = "blocked"
  if (workspacePath.endsWith("bad-change-impact-private")) value.sourceRoot = `${privateRoot}/${privateCredential}`
  return writeResult(id, value)
}

function readPhase1ChangeImpact(id, params) {
  const productDigest = canonicalDigest(productRecord())
  const initiativeDigest = canonicalDigest(initiativeState)
  const change = changeReference()
  if (!exactKeys(params, [
    "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedInitiativeId",
    "expectedInitiativeRevision", "expectedInitiativeDigest", "expectedChangeId", "expectedChangeRevision",
    "expectedChangeDigest",
  ]) || params.expectedProductId !== productId || params.expectedProductRevision !== 7 ||
      params.expectedProductDigest !== productDigest || params.expectedInitiativeId !== initiativeId ||
      params.expectedInitiativeRevision !== initiativeState.revision || params.expectedInitiativeDigest !== initiativeDigest ||
      params.expectedChangeId !== change.recordId || params.expectedChangeRevision !== change.revision ||
      params.expectedChangeDigest !== change.digest) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PHASE 1 CHANGE IMPACT PARAMS")
  }
  const outputKinds = [
    ["architecture-challenge-model", "architecture-challenge-model"], ["authorization-model", "authorization-model"],
    ["bounded-context-ownership", "bounded-context-model"], ["business-architecture-baseline", "business-architecture-baseline"],
    ["business-capability-map", "business-capability-map"], ["business-rule-catalog", "business-rule-catalog"],
    ["business-understanding", "business-understanding"], ["candidate-source-baseline", "source-baseline"],
    ["data-model", "data-model"], ["decision-register", "decision-register"],
    ["end-to-end-traceability", "end-to-end-traceability-candidate"], ["event-integration-model", "event-integration-model"],
    ["evidence-registry", "evidence-registry"], ["failure-recovery-model", "failure-recovery-model"],
    ["initiative-entry", "initiative"], ["operating-model", "operating-model"],
    ["outcome-success-model", "outcome-model"], ["process-model", "process-model"],
    ["risk-register", "risk-register"], ["security-privacy-threat-assessment", "security-privacy-threat-assessment"],
    ["source-intake", "source-record"], ["source-provenance", "source-provenance"],
    ["stakeholder-role-model", "stakeholder-model"], ["system-solution-architecture", "system-solution-architecture"],
    ["value-stream-model", "value-stream-model"],
  ]
  const content = {
    schemaVersion: 1,
    kind: "phase-1-change-impact-dashboard",
    phase: { id: "phase-1b-product", label: "Phase 1B — Product P0–P4" },
    product: { recordType: "product", recordId: productId, revision: 7, digest: productDigest },
    initiative: {
      recordType: "initiative", recordId: initiativeId, revision: initiativeState.revision,
      digest: initiativeDigest, state: initiativeState.state,
    },
    change,
    sources: {
      changeImpactSnapshotDigest: `sha256:${"7".repeat(64)}`,
      readinessSnapshotDigest: `sha256:${"8".repeat(64)}`,
      handoffSnapshotDigest: `sha256:${"9".repeat(64)}`,
    },
    changeScope: {
      workItemCount: 1, changedArtifactCount: 1, effectTargetCount: 1, affectedUnitCount: 1,
      decisionCount: 1, riskCount: 1, unresolvedTraceLinkCount: 0, staleTraceLinkCount: 0,
      invalidTraceLinkCount: 0, traceAnalysisTruncated: false,
    },
    outputs: outputKinds.map(([outputKind, recordKind]) => ({
      outputKind,
      recordKind,
      readiness: { applicability: "not-assessed", evaluationState: "not-assessed", freshness: "unknown", subjectCount: 0 },
      impact: {
        state: "not-established", exactMatchedSubjectCount: 0, staleSubjectBindingCount: 0, traceReferenceCount: 0,
        validTraceCount: 0, unresolvedTraceCount: 0, staleTraceCount: 0, invalidTraceCount: 0,
        upstreamTraceCount: 0, downstreamTraceCount: 0, revalidationState: "not-established",
        coverageBoundary: "absence-of-an-exact-trace-match-does-not-prove-absence-of-impact",
      },
      handoff: { disposition: "not-established", freshness: "unknown", subjectCount: 0 },
    })),
    coverage: {
      state: "bounded-not-complete", outputCount: 25, applicableOutputCount: 0,
      currentTraceObservedOutputCount: 0, attentionRequiredOutputCount: 0, impactNotEstablishedOutputCount: 25,
      revalidationNotEstablishedOutputCount: 25,
      basis: "exact-current-readiness-subjects-matched-to-bounded-governed-change-trace-results",
      coverageBoundary: "trace-presence-proves-only-the-recorded-link-and-trace-absence-does-not-prove-no-impact",
    },
    owners: { state: "unbound", boundOutputOwnerCount: 0, basis: "no-governed-phase-output-owner-assignment-is-bound" },
    governance: {
      changeApproval: "not-established", riskAcceptanceAuthority: "not-established",
      revalidationAuthority: "not-established", productOwnerAcceptance: "not-established", effectAuthority: "not-established",
    },
    freshness: {
      state: "current", changeImpactEvaluatedAt: "2026-07-27T12:04:00.000Z",
      readinessObservedAt: "2026-07-27T12:04:01.000Z", handoffObservedAt: "2026-07-27T12:04:02.000Z",
      staleBindingCount: 0, staleSourceReferenceCount: 0, traceAttentionLinkCount: 0,
      traceAnalysisTruncated: false,
      basis: "current-governed-snapshots-and-declared-trace-readiness-handoff-freshness",
    },
    evidenceCues: {
      freshness: "current",
      confidence: { state: "not-assessed", basis: "bounded-trace-coverage-does-not-establish-impact-confidence-or-completeness" },
    },
    observedAt: "2026-07-27T12:04:03.000Z",
    sourceBoundary: "current-governed-product-initiative-change-readiness-handoff-and-bounded-trace-projections-only",
    privacyBoundary: "dashboard-exposes-identities-digests-counts-statuses-effects-and-times-not-change-text-output-content-findings-evidence-source-content-personal-data-secrets-or-credentials",
    limitations: ["Outputs without exact trace matches remain impact not established rather than unaffected."],
    authorityBoundary: "phase-1-change-impact-dashboard-is-read-only-observed-candidate-evidence-not-impact-completeness-revalidation-approval-risk-acceptance-readiness-effect-release-or-action-authority",
  }
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-phase1-change-impact-digest")) value.coverage.impactNotEstablishedOutputCount = 24
  if (workspacePath.endsWith("bad-dashboard-private")) value.sourceRoot = `${privateRoot}/${privateCredential}`
  return writeResult(id, value)
}

function buildAgentModel(params) {
  const productDigest = canonicalDigest(productRecord())
  const readiness = readinessSnapshots(false)
  const expectedCapabilities = readiness.map((entry) => ({
    adapterId: entry.adapterId,
    agentId: entry.agentId,
    capabilityDigest: stableCapabilityDigest(entry),
  })).sort((left, right) => `${left.adapterId}:${left.agentId}`.localeCompare(`${right.adapterId}:${right.agentId}`))
  const expectedSelection = selectedAgent
    ? { status: "selected", selectionDigest: canonicalDigest(selectedAgent) }
    : { status: "unselected" }
  if (!exactKeys(params, [
    "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedSelection", "expectedCapabilities",
  ]) || params.expectedProductId !== productId || params.expectedProductRevision !== 7 ||
      params.expectedProductDigest !== productDigest || canonicalDigest(params.expectedSelection) !== canonicalDigest(expectedSelection) ||
      canonicalDigest(params.expectedCapabilities) !== canonicalDigest(expectedCapabilities)) {
    return undefined
  }
  const capabilities = readiness.map((entry) => ({
    adapterId: entry.adapterId,
    adapterVersion: entry.adapterVersion,
    agentId: entry.agentId,
    agentLabel: entry.agentLabel,
    runtimeVersion: entry.runtimeVersion ?? null,
    capabilityDigest: stableCapabilityDigest(entry),
    detected: entry.detected,
    executionInterface: entry.executionInterface,
    interfaceMaturity: entry.interfaceMaturity,
    support: {
      resume: entry.supportsResume,
      cancel: entry.supportsCancel,
      checkpoints: entry.supportsCheckpoints,
      modelDiscovery: entry.supportsModelDiscovery,
      toolSelection: entry.supportsToolSelection,
    },
    modelCount: entry.models.length,
    limitations: { values: entry.limitations, shown: entry.limitations.length, total: entry.limitations.length, omitted: 0 },
    observedAt: entry.observedAt,
    selected: selectedAgent?.adapterId === entry.adapterId && selectedAgent?.agentId === entry.agentId,
  })).sort((left, right) => `${left.adapterId}:${left.agentId}`.localeCompare(`${right.adapterId}:${right.agentId}`))
  const selectedCapability = selectedAgent
    ? capabilities.find((entry) => entry.adapterId === selectedAgent.adapterId && entry.agentId === selectedAgent.agentId)
    : undefined
  const selection = selectedAgent ? {
    status: "selected",
    selectionDigest: canonicalDigest(selectedAgent),
    adapterId: selectedAgent.adapterId,
    agentId: selectedAgent.agentId,
    modelId: selectedAgent.modelId,
    modelTruthClass: selectedAgent.modelTruthClass,
    modelAlias: selectedAgent.modelAlias,
    settings: selectedAgent.settings,
    selectedAt: selectedAgent.selectedAt,
    capabilityDigest: selectedAgent.capabilityDigest,
    capabilityState: selectedCapability?.capabilityDigest === selectedAgent.capabilityDigest ? "current" : "stale",
  } : { status: "unselected" }
  const selectionCapabilityState = selection.status === "selected" ? selection.capabilityState : selection.status
  const freshnessState = selectionCapabilityState === "stale" ? "attention-required" : "current"
  const content = {
    schemaVersion: 1,
    kind: "agent-model-dashboard",
    product: { recordType: "product", recordId: productId, revision: 7, digest: productDigest },
    capabilities,
    selection,
    runs: [],
    handoffs: [],
    providerMetrics: {
      usage: { state: "unavailable", basis: "current-managed-records-have-no-provider-usage-or-cost-contract" },
      cost: { state: "unavailable", basis: "current-managed-records-have-no-provider-usage-or-cost-contract" },
    },
    freshness: {
      state: freshnessState,
      selectionCapabilityState,
      oldestCapabilityObservedAt: "2026-07-24T08:00:00.000Z",
      newestCapabilityObservedAt: "2026-07-24T08:00:00.000Z",
      truncated: false,
      coverageBoundary: "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness",
    },
    evidenceCues: {
      freshness: selectionCapabilityState === "stale" ? "stale" : "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    limits: {
      capabilities: { shown: 2, total: 2, omitted: 0 },
      runs: { shown: 0, total: 0, omitted: 0 },
      handoffs: { shown: 0, total: 0, omitted: 0 },
      managedRuns: { shown: 0, total: 0, omitted: 0 },
      truncated: false,
    },
    observedAt: "2026-07-24T12:06:00.000Z",
    sourceBoundary: "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata",
    limitations: [
      "Capability truth is bounded to current portable observations and does not prove provider-account readiness.",
      "Current managed records have no provider usage or cost contract, so both metrics remain unavailable.",
    ],
    authorityBoundary: "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects",
  }
  if (workspacePath.endsWith("bad-agent-model-binding")) content.product.digest = `sha256:${"0".repeat(64)}`
  if (workspacePath.endsWith("bad-agent-model-count")) content.limits.capabilities.total = 3
  if (workspacePath.endsWith("bad-agent-model-freshness")) content.freshness.state = "attention-required"
  if (workspacePath.endsWith("bad-agent-model-evidence-cues")) content.evidenceCues.confidence.state = "supported"
  if (workspacePath.endsWith("bad-agent-model-metrics")) content.providerMetrics.cost = { state: "available", amount: 0 }
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-agent-model-digest")) value.capabilities[0].agentLabel = "Forged label"
  if (workspacePath.endsWith("bad-agent-model-private")) value.sourceRoot = `${privateRoot}/${privateCredential}`
  return value
}

function readAgentModel(id, params) {
  const value = buildAgentModel(params)
  return value
    ? writeResult(id, value)
    : writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE AGENT MODEL PARAMS")
}

function readPhase1AgentModel(id, params) {
  const productDigest = canonicalDigest(productRecord())
  const initiativeDigest = canonicalDigest(initiativeState)
  if (!exactKeys(params, [
    "expectedInitiativeId", "expectedInitiativeRevision", "expectedInitiativeDigest", "agentModel",
  ]) || params.expectedInitiativeId !== initiativeId ||
      params.expectedInitiativeRevision !== initiativeState.revision ||
      params.expectedInitiativeDigest !== initiativeDigest) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PHASE 1 AGENT MODEL PARAMS")
  }
  const agentModel = buildAgentModel(params.agentModel)
  if (!agentModel) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PHASE 1 AGENT MODEL PARAMS")
  const detected = agentModel.capabilities.filter((entry) => entry.detected).length
  const selected = agentModel.capabilities.filter((entry) => entry.selected).length
  const content = {
    schemaVersion: 1,
    kind: "phase-1-agent-model-dashboard",
    phase: { id: "phase-1b-product", label: "Phase 1B — Product P0–P4" },
    product: { recordType: "product", recordId: productId, revision: 7, digest: productDigest },
    initiative: {
      recordType: "initiative", recordId: initiativeId, revision: initiativeState.revision,
      digest: initiativeDigest, state: initiativeState.state,
    },
    source: { agentModelSnapshotDigest: agentModel.snapshotDigest, scope: "exact-current-initiative" },
    agentModel,
    executionTruth: {
      capabilities: {
        shown: agentModel.capabilities.length, total: agentModel.limits.capabilities.total,
        omitted: agentModel.limits.capabilities.omitted, detected,
        unavailable: agentModel.capabilities.length - detected, selected,
      },
      runs: {
        shown: 0, total: 0, omitted: 0, terminal: 0, nonTerminal: 0, managedObserved: 0,
        resultBound: 0, actualEffectCount: 0,
        outcomes: { satisfied: 0, failed: 0, notAssessed: 0, indeterminate: 0 },
      },
      managedRuns: { shown: 0, total: 0, omitted: 0 },
      handoffs: { shown: 0, total: 0, omitted: 0, pendingAcknowledgement: 0, acknowledged: 0 },
      providerMetrics: { usage: "unavailable", cost: "unavailable" },
      liveProviderQuality: "not-assessed",
      semanticOutputQuality: "not-assessed",
    },
    freshness: {
      state: agentModel.freshness.state,
      selectionCapabilityState: agentModel.freshness.selectionCapabilityState,
      oldestCapabilityObservedAt: agentModel.freshness.oldestCapabilityObservedAt,
      newestCapabilityObservedAt: agentModel.freshness.newestCapabilityObservedAt,
      agentModelObservedAt: agentModel.observedAt,
      truncated: agentModel.limits.truncated,
      basis: "exact-initiative-scoped-agent-model-snapshot-and-declared-bounded-coverage",
    },
    governance: {
      providerAccountReadiness: "not-established", providerPreference: "not-established",
      automaticSelectionAuthority: "not-granted", handoffAcknowledgementAuthority: "not-granted",
      runLaunchAuthority: "not-granted", effectAuthority: "not-granted",
      phaseReadinessAuthority: "not-established", productOwnerAcceptance: "not-established",
    },
    observedAt: "2026-07-24T12:06:01.000Z",
    sourceBoundary: "current-governed-product-initiative-capability-selection-run-handoff-and-managed-evidence-metadata-only",
    privacyBoundary: "dashboard-exposes-identities-digests-counts-statuses-times-and-redacted-selection-metadata-not-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-or-machine-paths",
    limitations: [
      "Capability observations prove only the bounded adapter/runtime metadata recorded at observation time, not provider account readiness or service availability.",
      "Provider usage and cost remain unavailable because no governed provider metric contract is bound.",
    ],
    authorityBoundary: "phase-1-agent-model-dashboard-is-read-only-observed-evidence-not-provider-quality-preference-automatic-selection-handoff-acknowledgement-run-launch-readiness-approval-effect-release-or-action-authority",
  }
  if (workspacePath.endsWith("bad-phase1-agent-model-count")) content.executionTruth.capabilities.total = 3
  const value = { ...content, snapshotDigest: canonicalDigest(content) }
  if (workspacePath.endsWith("bad-phase1-agent-model-digest")) value.executionTruth.capabilities.detected = 2
  if (workspacePath.endsWith("bad-phase1-agent-model-private")) value.sourceRoot = `${privateRoot}/${privateCredential}`
  return writeResult(id, value)
}

function selectAgent(id, params) {
  if (!exactKeys(params, ["adapterId", "modelId", "settings", "actorId"]) ||
    params.adapterId !== "openai-codex" || params.modelId !== "gpt-5.6-codex" ||
    !exactKeys(params.settings, ["reasoningEffort"]) || params.settings.reasoningEffort !== "high" ||
    params.actorId !== "founder.kiro-review") {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE SELECTION PARAMS")
  }
  selectedAgent = agentSelection(params.settings)
  return writeResult(id, selectedAgent)
}

function agentSelection(settings = { reasoningEffort: "high" }) {
  return {
    schemaVersion: 2,
    adapterId: "openai-codex",
    agentId: "codex",
    modelId: "gpt-5.6-codex",
    modelTruthClass: "observed",
    modelAlias: false,
    settings,
    selectedAt: "2026-07-24T08:05:00.000Z",
    capabilityDigest: `sha256:${"e".repeat(64)}`,
  }
}

function targetAgentSelection() {
  return {
    ...agentSelection({ reasoningEffort: "medium" }),
    modelId: "gpt-5.6-codex-next",
    selectedAt: "2026-07-24T08:10:00.000Z",
    capabilityDigest: `sha256:${"f".repeat(64)}`,
  }
}

function agentRun(includePrivatePath = false) {
  const run = {
    schemaVersion: 1,
    id: runId,
    revision: 3,
    charterId,
    charterDigest: `sha256:${"1".repeat(64)}`,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    agent: agentSelection(),
    state: "completed",
    providerSessionRef: `sha256:${"2".repeat(64)}`,
    startedAt: "2026-07-24T08:00:00.000Z",
    endedAt: "2026-07-24T08:04:00.000Z",
  }
  if (includePrivatePath) run.runtimeExecutable = `${privateRoot}/${privateCredential}`
  return run
}

function createHandoff(id, params) {
  const expected = {
    fromRunId: runId,
    toAdapterId: "openai-codex",
    toModelId: "gpt-5.6-codex-next",
    toSettings: { reasoningEffort: "medium" },
    reason: "Switch to the reviewed model",
    completedWork: ["Selection workflow completed"],
    unresolvedMatters: ["Native Kiro acceptance remains"],
    decisions: ["Keep execution disabled"],
    evidence: ["evidence/kiro-selection.json"],
  }
  if (!exactKeys(params, ["actorId", "handoff"]) || params.actorId !== "founder.kiro-review" ||
    !params.handoff || !exactKeys(params.handoff, Object.keys(expected)) ||
    JSON.stringify(params.handoff) !== JSON.stringify(expected)) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE HANDOFF PARAMS")
  }
  selectedAgent = targetAgentSelection()
  const value = agentHandoff()
  if (workspacePath.endsWith("bad-handoff")) value.runtimeExecutable = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-handoff-binding")) value.toAgent.settings.reasoningEffort = "high"
  return writeResult(id, value)
}

function agentHandoff() {
  return {
    schemaVersion: 1,
    id: handoffId,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    fromRunId: runId,
    toAgent: targetAgentSelection(),
    reason: "Switch to the reviewed model",
    workspaceBaseline: {
      gitHead: "abcdef1",
      dirty: true,
      changedFiles: ["src/index.ts"],
      truthClass: "observed",
    },
    completedWork: ["Selection workflow completed"],
    unresolvedMatters: ["Native Kiro acceptance remains"],
    decisions: ["Keep execution disabled"],
    evidence: ["evidence/kiro-selection.json"],
    capabilityDifferences: ["Model changes from gpt-5.6-codex to gpt-5.6-codex-next."],
    createdAt: "2026-07-24T08:10:00.000Z",
  }
}

function previewManagedReadOnly(id, params) {
  if (!exactKeys(params, ["charterId", "workflowPlanId"]) || params.charterId !== charterId ||
    params.workflowPlanId !== workflowPlanId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANAGED PREVIEW PARAMS")
  }
  const value = managedReadOnlyPreview()
  if (workspacePath.endsWith("bad-managed-preview")) value.runtimeExecutable = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-managed-criterion")) value.gates[2].criteria[0] = `Inspect ${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-managed-digest")) value.previewDigest = `sha256:${"0".repeat(64)}`
  return writeResult(id, value)
}

function executeManagedReadOnly(id, params) {
  if (!exactKeys(params, [
    "actorId", "charterId", "workflowPlanId", "expectedPreviewDigest", "timeoutMs", "confirmation",
  ]) || params.actorId !== "founder.kiro-review" || params.charterId !== charterId ||
    params.workflowPlanId !== workflowPlanId || params.expectedPreviewDigest !== previewDigest ||
    params.timeoutMs !== 30_000 || params.confirmation !== "attest-exact-managed-readonly-preview") {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANAGED EXECUTE PARAMS")
  }
  const value = managedReadOnlyReceipt()
  if (workspacePath.endsWith("bad-managed-receipt")) value.rawProviderOutput = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-managed-binding")) value.previewDigest = `sha256:${"b".repeat(64)}`
  return writeResult(id, value)
}

function managedReadOnlyPreview() {
  const stepGate = (phase, criterion) => {
    const criteria = [criterion]
    return {
      key: `step:${workflowStepId}:${phase}`,
      stepId: workflowStepId,
      phase,
      criteria,
      criteriaDigest: canonicalDigest(criteria),
    }
  }
  const requiredEvidence = ["Record one observation receipt"]
  const stopConditions = ["Stop if governed scope changes"]
  const body = {
    schemaVersion: 1,
    kind: "managed-readonly-preview",
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    charterId,
    charterDigest: `sha256:${"3".repeat(64)}`,
    workflowPlanId,
    workflowPlanDigest: `sha256:${"4".repeat(64)}`,
    adapterId: "openai-codex",
    agentId: "codex",
    modelId: "gpt-5.6-codex",
    selectionDigest: `sha256:${"5".repeat(64)}`,
    strategy: "sequential",
    stepIds: [workflowStepId],
    contextPackCount: 1,
    readScopeCount: 2,
    gates: [
      {
        key: "charter:required-evidence",
        phase: "charter-evidence",
        criteria: requiredEvidence,
        criteriaDigest: canonicalDigest(requiredEvidence),
      },
      {
        key: "charter:stop-conditions",
        phase: "charter-stop-conditions",
        criteria: stopConditions,
        criteriaDigest: canonicalDigest(stopConditions),
      },
      stepGate("preconditions", "Confirmed Product context is available"),
      stepGate("outputs", "Return metadata-only observations"),
      stepGate("evidence", "Record bounded event evidence"),
      stepGate("stop-conditions", "Stop before any write or Tool request"),
    ],
    authorityBoundary: "managed-readonly-preview-does-not-grant-execution-or-effect-authority",
  }
  return { ...body, previewDigest: canonicalDigest(body) }
}

function managedReadOnlyReceipt() {
  return {
    schemaVersion: 1,
    kind: "managed-readonly-receipt",
    previewDigest,
    runId: managedGovernedRunId,
    managedRunId,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    adapterId: "openai-codex",
    agentId: "codex",
    modelId: "gpt-5.6-codex",
    mode: "manual-offline",
    state: "completed",
    providerDisposition: "completed",
    outcomeStatus: "satisfied",
    outcomeBasis: "deterministic-offline-runtime",
    eventCount: 4,
    completedStepCount: 1,
    totalStepCount: 1,
    resultDigest: `sha256:${"e".repeat(64)}`,
    evidenceDigest: `sha256:${"f".repeat(64)}`,
    warnings: [],
    startedAt: "2026-07-24T08:20:00.000Z",
    endedAt: "2026-07-24T08:20:01.000Z",
    authorityBoundary: "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority",
  }
}

function listManagedEvidence(id, params) {
  if (!exactKeys(params, params.snapshotDigest === undefined ? ["offset", "limit"] : ["offset", "limit", "snapshotDigest"]) ||
    ![0, 1].includes(params.offset) || params.limit !== 100 ||
    (params.offset > 0 && params.snapshotDigest === undefined) ||
    (params.snapshotDigest !== undefined && params.snapshotDigest !== `sha256:${"6".repeat(64)}`)) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANAGED EVIDENCE LIST PARAMS")
  }
  const value = managedRunPage(params.offset)
  if (workspacePath.endsWith("bad-managed-evidence-page")) value.items[0].localStagePath = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-managed-evidence-count")) value.omittedCount = 0
  if (workspacePath.endsWith("bad-managed-evidence-snapshot")) value.snapshotDigest = `sha256:${"7".repeat(64)}`
  if (workspacePath.endsWith("bad-managed-evidence-total") && params.offset === 1) {
    value.total = 4
    value.omittedCount = value.total - value.items.length
    value.hasMore = true
  }
  return writeResult(id, value)
}

function readManagedEvidence(id, params) {
  if (!exactKeys(params, ["managedRunId"]) || params.managedRunId !== managedRunId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANAGED EVIDENCE READ PARAMS")
  }
  const value = managedEvidenceDetail()
  if (workspacePath.endsWith("bad-managed-evidence-detail")) value.rawProviderOutput = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-managed-evidence-binding")) value.evidence.evidenceDigest = `sha256:${"0".repeat(64)}`
  return writeResult(id, value)
}

function managedRunSummary() {
  return {
    schemaVersion: 1,
    kind: "managed-run-summary",
    managedRunId,
    runId: managedGovernedRunId,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mode: "manual-offline",
    state: "completed",
    adapterId: "openai-codex",
    agentId: "codex",
    modelId: "gpt-5.6-codex",
    attemptNumber: 1,
    recoveryStatus: "not-required",
    workflowCheckpointCount: 0,
    hasResult: true,
    hasApplyDecision: false,
    bindingsDigest: `sha256:${"8".repeat(64)}`,
    resultDigest: `sha256:${"9".repeat(64)}`,
    createdAt: "2026-07-24T08:19:59.000Z",
    startedAt: "2026-07-24T08:20:00.000Z",
    updatedAt: "2026-07-24T08:20:01.000Z",
    endedAt: "2026-07-24T08:20:01.000Z",
    authorityBoundary: "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
  }
}

function managedRunPage(offset = 0) {
  const items = offset === 0
    ? [managedRunSummary()]
    : [
        { ...managedRunSummary(), managedRunId: "17171717-1717-4717-8717-171717171717", runId: "18181818-1818-4818-8818-181818181818" },
        { ...managedRunSummary(), managedRunId: "19191919-1919-4919-8919-191919191919", runId: "20202020-2020-4020-8020-202020202020" },
      ]
  return {
    schemaVersion: 1,
    kind: "managed-run-summary-page",
    items,
    offset,
    limit: 100,
    total: 3,
    omittedCount: 3 - items.length,
    snapshotDigest: `sha256:${"6".repeat(64)}`,
    hasMore: offset + items.length < 3,
    authorityBoundary: "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
    privacyBoundary: "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
  }
}

function managedEvidenceDetail() {
  return {
    schemaVersion: 1,
    kind: "managed-evidence-detail",
    summary: managedRunSummary(),
    artifactStatus: "verified-result-and-evidence",
    result: {
      resultId: managedResultId,
      resultDigest: `sha256:${"9".repeat(64)}`,
      providerDisposition: "completed",
      terminationCause: "normal",
      outcomeStatus: "satisfied",
      outcomeBasis: "deterministic-offline-runtime",
      terminalState: "completed",
      evidenceId: managedEvidenceId,
      evidenceDigest: `sha256:${"a".repeat(64)}`,
      warningCodes: [],
      startedAt: "2026-07-24T08:20:00.000Z",
      endedAt: "2026-07-24T08:20:01.000Z",
    },
    evidence: {
      evidenceId: managedEvidenceId,
      evidenceDigest: `sha256:${"a".repeat(64)}`,
      eventCount: 4,
      eventTypeCounts: { lifecycle: 2, output: 1, item: 1, approval: 0, warning: 0, error: 0 },
      eventsDigest: `sha256:${"b".repeat(64)}`,
      workflowStrategy: "sequential",
      workflowStepCount: 1,
      workflowAttemptCount: 1,
      completedStepCount: 1,
      charterEvidenceStatus: "satisfied",
      charterStopStatus: "satisfied",
      terminalReasonCode: "workflow-completed",
      actualEffectCounts: { "not-observed": 1, "observed-provisional": 0, applied: 0, blocked: 0, unknown: 0 },
      capturedAt: "2026-07-24T08:20:01.000Z",
    },
    authorityBoundary: "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority",
    privacyBoundary: "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
  }
}

function readManagedReview(id, params) {
  if (!exactKeys(params, ["managedRunId"]) || params.managedRunId !== stagedManagedRunId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANAGED REVIEW READ PARAMS")
  }
  const value = managedReviewPreview()
  if (workspacePath.endsWith("bad-managed-review-digest")) value.previewDigest = `sha256:${"0".repeat(64)}`
  if (workspacePath.endsWith("bad-managed-review-private")) value.sourceRoot = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-managed-review-binding")) {
    value.applyConfirmation.reviewEvidenceId = managedEvidenceId
    value.previewDigest = digestWithout(value, "previewDigest")
  }
  if (workspacePath.endsWith("bad-managed-review-path")) {
    value.staging.changedInventory[0].path = `${privateRoot}/secret.ts`
    value.staging.changedInventoryDigest = canonicalDigest(value.staging.changedInventory)
    value.applyConfirmation.changedInventoryDigest = value.staging.changedInventoryDigest
    value.previewDigest = digestWithout(value, "previewDigest")
  }
  return writeResult(id, value)
}

function decideManagedReview(id, params, decision) {
  const preview = managedReviewPreview()
  if (!exactKeys(params, [
    "actorId", "managedRunId", "expectedManagedRunRevision", "expectedPreviewDigest", "confirmation",
  ]) || params.actorId !== "founder.kiro-review" || params.managedRunId !== stagedManagedRunId ||
    params.expectedManagedRunRevision !== preview.managedRunRevision || params.expectedPreviewDigest !== preview.previewDigest ||
    params.confirmation !== decision) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANAGED REVIEW DECISION PARAMS")
  }
  if (workspacePath.endsWith("stale-managed-review")) {
    return writeError(id, -32_029, "MANAGED_REVIEW_CHANGED", `${privateRoot}; token=${privateCredential}`)
  }
  const value = managedReviewTransition(decision)
  if (workspacePath.endsWith("bad-managed-transition-digest")) value.transitionDigest = `sha256:${"0".repeat(64)}`
  if (workspacePath.endsWith("bad-managed-transition-private")) value.localJournalPath = `${privateRoot}/${privateCredential}`
  return writeResult(id, value)
}

function managedReviewPreview() {
  const changedInventory = [
    {
      path: "src/new.ts",
      kind: "added",
      afterDigest: `sha256:${"1".repeat(64)}`,
      afterSize: 24,
      afterMode: 0o644,
    },
    {
      path: "src/review.ts",
      kind: "modified",
      beforeDigest: `sha256:${"2".repeat(64)}`,
      afterDigest: `sha256:${"3".repeat(64)}`,
      beforeSize: 80,
      afterSize: 96,
      beforeMode: 0o644,
      afterMode: 0o644,
    },
  ]
  const changedInventoryDigest = canonicalDigest(changedInventory)
  const writeEnvelope = ["src"]
  const body = {
    schemaVersion: 1,
    kind: "managed-review-preview",
    managedRunId: stagedManagedRunId,
    managedRunRevision: 3,
    runId: managedGovernedRunId,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mode: "codex-staged",
    state: "review-required",
    canApply: true,
    canDiscard: true,
    hasLocalJournal: false,
    bindingsDigest: `sha256:${"4".repeat(64)}`,
    result: {
      resultId: stagedResultId,
      resultDigest: `sha256:${"5".repeat(64)}`,
      terminalState: "review-required",
      providerDisposition: "completed",
      outcomeStatus: "not-assessed",
      outcomeBasis: "not-evaluated",
      warningCodes: ["provider-output-redacted", "staging-read-confinement-unattested"],
      evidenceId: stagedEvidenceId,
      evidenceDigest: `sha256:${"6".repeat(64)}`,
    },
    staging: {
      evidenceId: stagedEvidenceId,
      evidenceDigest: `sha256:${"6".repeat(64)}`,
      baselineDigest: `sha256:${"7".repeat(64)}`,
      finalDigest: `sha256:${"8".repeat(64)}`,
      applyState: "pending",
      changeCount: changedInventory.length,
      changedInventoryLimit: 512,
      omittedCount: 0,
      changedInventory,
      changedInventoryDigest,
      excludedPathCount: 0,
      excludedPathSetDigest: canonicalDigest([]),
    },
    applyConfirmation: {
      decision: "apply-exact-reviewed-inventory",
      reviewEvidenceId: stagedEvidenceId,
      reviewEvidenceDigest: `sha256:${"6".repeat(64)}`,
      changedInventoryDigest,
      writeEnvelope,
      writeEnvelopeDigest: canonicalDigest(writeEnvelope),
    },
    postApplyGatePolicy: "record-not-assessed",
    authorityBoundary: "managed-review-preview-authorizes-no-mutation-without-an-exact-digest-bound-human-decision",
    privacyBoundary: "Exact portable identifiers, digests, warning codes, workspace-relative changed paths, file digests, sizes, modes and write scopes only; prompts, provider output, source bytes, absolute paths, executable paths, process state and credentials are omitted.",
    cleanupBoundary: "Persisted discard or apply state does not independently prove machine-local stage or recovery-journal cleanup.",
  }
  return { ...body, previewDigest: canonicalDigest(body) }
}

function managedReviewTransition(decision) {
  const preview = managedReviewPreview()
  const state = decision === "apply-exact-managed-review" ? "failed" : "discarded"
  const detail = transitionedManagedEvidenceDetail(state, decision === "apply-exact-managed-review")
  const body = {
    schemaVersion: 1,
    kind: "managed-review-transition",
    decision,
    sourcePreviewDigest: preview.previewDigest,
    sourceManagedRunRevision: preview.managedRunRevision,
    managedRunId: stagedManagedRunId,
    managedRunRevision: 4,
    state,
    canApply: false,
    canDiscard: false,
    hasLocalJournal: decision === "apply-exact-managed-review",
    detail,
    authorityBoundary: "managed-review-transition-proves-persisted-state-not-provider-outcome-or-machine-local-cleanup",
    cleanupBoundary: "Persisted discard or apply state does not independently prove machine-local stage or recovery-journal cleanup.",
  }
  return { ...body, transitionDigest: canonicalDigest(body) }
}

function transitionedManagedEvidenceDetail(state, applied) {
  const resultDigest = `sha256:${"9".repeat(64)}`
  const evidenceDigest = `sha256:${"a".repeat(64)}`
  const applyDecisionDigest = `sha256:${"b".repeat(64)}`
  const summary = {
    schemaVersion: 1,
    kind: "managed-run-summary",
    managedRunId: stagedManagedRunId,
    runId: managedGovernedRunId,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mode: "codex-staged",
    state,
    adapterId: "openai-codex",
    agentId: "codex",
    modelId: "gpt-5.6-codex",
    attemptNumber: 1,
    recoveryStatus: "recovered",
    workflowCheckpointCount: 0,
    hasResult: true,
    hasApplyDecision: applied,
    bindingsDigest: `sha256:${"4".repeat(64)}`,
    resultDigest,
    ...(applied ? { applyDecisionDigest } : {}),
    createdAt: "2026-07-24T08:29:59.000Z",
    startedAt: "2026-07-24T08:30:00.000Z",
    updatedAt: "2026-07-24T08:30:02.000Z",
    endedAt: "2026-07-24T08:30:02.000Z",
    authorityBoundary: "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
  }
  return {
    schemaVersion: 1,
    kind: "managed-evidence-detail",
    summary,
    artifactStatus: "verified-result-and-evidence",
    result: {
      resultId: transitionedResultId,
      resultDigest,
      providerDisposition: "completed",
      terminationCause: "normal",
      outcomeStatus: "failed",
      outcomeBasis: "not-evaluated",
      terminalState: state,
      evidenceId: transitionedEvidenceId,
      evidenceDigest,
      warningCodes: ["provider-output-redacted", ...(state === "discarded" ? ["local-cleanup-pending"] : [])],
      startedAt: "2026-07-24T08:30:00.000Z",
      endedAt: "2026-07-24T08:30:02.000Z",
    },
    evidence: {
      evidenceId: transitionedEvidenceId,
      evidenceDigest,
      eventCount: 2,
      eventTypeCounts: { lifecycle: 1, output: 1, item: 0, approval: 0, warning: 0, error: 0 },
      eventsDigest: `sha256:${"c".repeat(64)}`,
      workflowStrategy: "sequential",
      workflowStepCount: 1,
      workflowAttemptCount: 1,
      completedStepCount: 0,
      charterEvidenceStatus: "not-assessed",
      charterStopStatus: "not-assessed",
      terminalReasonCode: applied ? "workflow-output-gate-failed" : "staged-review-discarded",
      staging: {
        changeCount: 2,
        excludedPathCount: 0,
        applyState: applied ? "applied" : "discarded",
        baselineDigest: `sha256:${"7".repeat(64)}`,
        finalDigest: `sha256:${"8".repeat(64)}`,
        changedInventoryDigest: previewChangedInventoryDigest(),
        excludedPathSetDigest: canonicalDigest([]),
      },
      actualEffectCounts: { "not-observed": 0, "observed-provisional": 0, applied: applied ? 1 : 0, blocked: applied ? 0 : 1, unknown: 0 },
      capturedAt: "2026-07-24T08:30:02.000Z",
    },
    ...(applied ? {
      applyDecision: {
        receiptId: applyDecisionId,
        receiptDigest: applyDecisionDigest,
        managedRunRevision: 3,
        changedInventoryCount: 2,
        writeEnvelopeCount: 1,
        changedInventoryDigest: previewChangedInventoryDigest(),
        writeEnvelopeDigest: canonicalDigest(["src"]),
        decidedAt: "2026-07-24T08:30:01.000Z",
      },
    } : {}),
    authorityBoundary: "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority",
    privacyBoundary: "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
  }
}

function previewChangedInventoryDigest() {
  return managedReviewPreview().staging.changedInventoryDigest
}

function digestWithout(value, key) {
  return canonicalDigest(Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)))
}

function canonicalDigest(value) {
  const normalize = (entry) => {
    if (Array.isArray(entry)) return entry.map(normalize)
    if (entry !== null && typeof entry === "object") {
      return Object.fromEntries(
        Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, normalize(child)]),
      )
    }
    return entry
  }
  return `sha256:${createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex")}`
}

function importSnapshot(id, params) {
  if (!exactKeys(params, ["bundleRoot", "expectedProductId", "expectedProductRevision", "actorId"]) ||
    params.expectedProductId !== productId || params.expectedProductRevision !== 7 ||
    params.actorId !== "founder.kiro-review") {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE IMPORT PARAMS")
  }
  if (params.bundleRoot.endsWith("source-error")) {
    return writeError(
      id,
      -32_030,
      "PORTABLE_DESIGN_SOURCE_INVALID",
      `Malformed bundle at ${privateRoot}; password=${privateCredential}`,
    )
  }
  return writeResult(id, snapshot())
}

function listSnapshots(id, params) {
  if (!exactKeys(params, ["offset", "limit"])) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE LIST PARAMS")
  }
  const items = params.offset === 9_999 ? Array.from({ length: 201 }, () => snapshot()) : [snapshot()]
  return writeResult(id, {
    items,
    offset: params.offset,
    limit: params.limit,
    total: params.offset === 9_999 ? 10_200 : 1,
    hasMore: params.offset === 9_999,
    governanceBoundary: "Every item remains pending human review; source review is an upstream claim only.",
    privacyBoundary: "Items contain validated metadata and digests only; local paths and source content are omitted.",
  })
}

function readSnapshot(id, params) {
  if (!exactKeys(params, ["bundleId"])) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE READ PARAMS")
  }
  switch (params.bundleId) {
    case "33333333-3333-4333-8333-333333333333":
      return writeError(id, -32_035, "PORTABLE_DESIGN_NOT_FOUND", `Missing ${privateRoot}; token=${privateCredential}`)
    case "44444444-4444-4444-8444-444444444444":
      process.stdout.write(`{"jsonrpc":"2.0","id":${id},"id":${id},"result":{}}\n`)
      return
    case "55555555-5555-4555-8555-555555555555":
      process.stdout.write(Buffer.from([0xc3, 0x28, 0x0a]))
      return
    case "66666666-6666-4666-8666-666666666666":
      process.stdout.write(`{"jsonrpc":"2.0","id":${id},"result":{"padding":"${"x".repeat(1024 * 1024 + 1)}"}}\n`)
      return
    case "77777777-7777-4777-8777-777777777777": {
      const value = snapshot(params.bundleId)
      value.bundleRoot = `${privateRoot}/${privateCredential}`
      return writeResult(id, value)
    }
    case "88888888-8888-4888-8888-888888888888": {
      const value = snapshot(params.bundleId)
      value.governance.state = "approved"
      return writeResult(id, value)
    }
    case "99999999-9999-4999-8999-999999999999":
      return writeError(id, -32_030, "PORTABLE_DESIGN_NOT_FOUND", `Wrong code ${privateRoot} ${privateCredential}`)
    default:
      return writeResult(id, snapshot(params.bundleId))
  }
}

function stableCapabilityDigest(entry) {
  const { observedAt: _observedAt, ...stable } = entry
  return canonicalDigest(stable)
}

function snapshot(id = bundleId) {
  return {
    schemaVersion: 1,
    kind: "portable-design-snapshot-summary",
    bundleId: id,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Imported Product Design",
    classification: "confidential",
    governance: {
      state: "pending-human-review",
      humanReviewRequired: true,
      claimBoundary: "import-validation-is-not-design-approval-or-baseline",
      nonEscalation: "not-gaep-approval-design-baseline-implementation-or-release-readiness",
    },
    sourceReview: {
      status: "approved",
      claimLabel: "approved upstream claim; not GAEP approval, a Design Baseline, implementation readiness, or release readiness",
      gaepApproval: false,
    },
    source: { tool: "figma", exportMethod: "manual-export" },
    counts: { artifacts: 2, normalizedDesignTokens: 1, validationChecks: 6, recordedLimitations: 5 },
    digests: {
      snapshot: `sha256:${"a".repeat(64)}`,
      evidence: `sha256:${"b".repeat(64)}`,
      manifest: `sha256:${"c".repeat(64)}`,
      artifactInventory: `sha256:${"d".repeat(64)}`,
    },
    timestamps: {
      sourceExportedAt: "2026-07-24T00:00:00.000Z",
      importedAt: "2026-07-24T00:01:00.000Z",
    },
    privacyBoundary: "Validated metadata only; no bundle root, artifact path, token value, source bytes, credentials, OAuth state, or external-account state.",
  }
}

function readinessSnapshots(includePrivatePath) {
  const codex = {
    schemaVersion: 1,
    adapterId: "openai-codex",
    adapterVersion: "0.1.0",
    agentId: "codex",
    agentLabel: "OpenAI Codex",
    runtimeVersion: "0.42.0",
    detected: true,
    executionInterface: "cli-jsonl",
    interfaceMaturity: "beta",
    supportsResume: true,
    supportsCancel: true,
    supportsCheckpoints: true,
    supportsModelDiscovery: true,
    supportsToolSelection: true,
    settings: [{
      key: "reasoningEffort",
      label: "Reasoning effort",
      description: "Provider-declared reasoning effort for a future governed run.",
      kind: "select",
      required: false,
      sensitive: false,
      options: [{ value: "high", label: "High" }],
      truthClass: "provider-declared",
    }],
    models: [{
      id: "gpt-5.6-codex",
      label: "GPT-5.6 Codex",
      description: "Observed local Codex model metadata.",
      reasoningOptions: ["high"],
      contextWindow: 200000,
      inputModalities: ["text", "image"],
      truthClass: "observed",
      alias: false,
    }],
    limitations: ["Capability observation does not authorize execution."],
    observedAt: "2026-07-24T08:00:00.000Z",
  }
  if (includePrivatePath) codex.runtimeExecutable = `${privateRoot}/${privateCredential}`
  return [codex, {
    schemaVersion: 1,
    adapterId: "anthropic-claude-code",
    adapterVersion: "0.1.0",
    agentId: "claude-code",
    agentLabel: "Anthropic Claude Code",
    detected: false,
    executionInterface: "unavailable",
    interfaceMaturity: "unknown",
    supportsResume: false,
    supportsCancel: false,
    supportsCheckpoints: false,
    supportsModelDiscovery: false,
    supportsToolSelection: false,
    settings: [],
    models: [],
    limitations: ["The local Claude Code runtime was not observed."],
    observedAt: "2026-07-24T08:00:00.000Z",
  }]
}

function writeResult(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`)
}

function writeError(id, code, kind, rawMessage) {
  process.stdout.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message: rawMessage,
      data: { kind, detail: { bundleRoot: privateRoot, credential: privateCredential } },
    },
  })}\n`)
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}
