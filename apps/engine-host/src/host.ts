import { CodexAdapter } from "@gaep/adapter-codex"
import { ClaudeAdapter } from "@gaep/adapter-claude"
import {
  canonicalDigest,
  capabilityDigest,
  fingerprintExecutable,
  type AdapterProbeResult,
  type AdapterRuntimeBinding,
  type ExecutableFingerprint,
} from "@gaep/agent-sdk"
import {
  adapterCapabilitiesSnapshotSchema,
  hostMethodSchema,
  hostRequestSchema,
  type AdapterCapabilities,
  type Change,
  type HostRequest,
  type Run,
} from "@gaep/contracts"
import {
  AgentModelCapabilityBindingError,
  AgentModelProductBindingError,
  AgentModelSelectionBindingError,
  ChangeImpactChangeBindingError,
  ChangeImpactProductBindingError,
  composeAgentModelDashboard,
  composeChangeImpactChangeCatalog,
  composeChangeImpactDashboard,
  composePhaseDashboardFramework,
  composePhase1AgentModelDashboard,
  composePhase1SummaryDashboard,
  composePhase1ChangeImpactDashboard,
  DashboardProductBindingError,
  GaepEngine,
  Phase1AgentModelBindingError,
  Phase1SummaryBindingError,
  Phase1ChangeImpactBindingError,
} from "@gaep/engine"
import { z, ZodError } from "zod"

import {
  isPortableDesignHostMethod,
  parsePortableDesignHostRequest,
  portableDesignHostMethods,
  portableDesignProductContextError,
  portableDesignRpcError,
  portableDesignSnapshotDto,
  portableDesignSnapshotPageDto,
  type PortableDesignHostRequest,
} from "./portable-design-rpc.js"
import { managedEvidenceDetailDto, managedRunPageDto } from "./managed-evidence-rpc.js"
import {
  managedReviewPreviewDto,
  managedReviewTransitionDto,
  recordManagedReviewWorkflowGatesNotAssessed,
  type ManagedReviewPreviewDto,
} from "./managed-review-rpc.js"
import { HostRpcError, invalidParamsError, MAX_RPC_FRAME_BYTES, normalizeRpcError } from "./rpc.js"

const PROTOCOL_VERSION = 2
const SUPPORTED_PROTOCOL_VERSIONS = [1, 2] as const
type EngineHostRequest = HostRequest | PortableDesignHostRequest
type EngineHostMethod = EngineHostRequest["method"]

const v2OnlyMethods = new Set<EngineHostMethod>([
  "workspaceHealth",
  "readAgentSelection",
  "readInitiative",
  "assessInitiativeEntry",
  "classifyInitiative",
  "resolveInitiativeApplicability",
  "migrateLegacySelection",
  "managed.readonly.preview",
  "managed.readonly.execute",
  "managed.evidence.list",
  "managed.evidence.read",
  "managed.review.read",
  "managed.review.apply",
  "managed.review.discard",
  "dashboard.framework",
  "dashboard.phase1Summary",
  "dashboard.phase1ChangeImpact",
  "dashboard.changeImpact.changes",
  "dashboard.changeImpact",
  "dashboard.agentModel",
  "dashboard.phase1AgentModel",
  "productStudio.designReadiness",
  "productStudio.search",
  "productStudio.exportBuild",
  "productStudio.importPreview",
  "source.list",
  "source.create",
  "source.revise",
  "source.baseline.list",
  "source.baseline.create",
  "source.baseline.revise",
  "source.provenance.list",
  "source.provenance.record",
  "source.assess",
  "source.snapshot",
  "business.understanding.read",
  "business.understanding.create",
  "business.understanding.revise",
  "business.stakeholders.read",
  "business.stakeholders.create",
  "business.stakeholders.revise",
  "business.outcomes.read",
  "business.outcomes.create",
  "business.outcomes.revise",
  "business.assess",
  "business.snapshot",
  "business.capabilities.read",
  "business.capabilities.create",
  "business.capabilities.revise",
  "business.capabilities.assess",
  "business.capabilities.snapshot",
  "business.valueStreams.read",
  "business.valueStreams.create",
  "business.valueStreams.revise",
  "business.valueStreams.assess",
  "business.valueStreams.snapshot",
  "business.operatingModels.read",
  "business.operatingModels.create",
  "business.operatingModels.revise",
  "business.operatingModels.assess",
  "business.operatingModels.snapshot",
  "business.businessRules.read",
  "business.businessRules.create",
  "business.businessRules.revise",
  "business.businessRules.assess",
  "business.businessRules.snapshot",
  "business.architectureBaselines.read",
  "business.architectureBaselines.create",
  "business.architectureBaselines.revise",
  "business.architectureBaselines.assess",
  "business.architectureBaselines.snapshot",
  "architecture.systemSolution.read",
  "architecture.systemSolution.create",
  "architecture.systemSolution.revise",
  "architecture.systemSolution.assess",
  "architecture.systemSolution.snapshot",
  "architecture.boundedContexts.read",
  "architecture.boundedContexts.create",
  "architecture.boundedContexts.revise",
  "architecture.boundedContexts.assess",
  "architecture.boundedContexts.snapshot",
  "security.privacyThreat.read",
  "security.privacyThreat.create",
  "security.privacyThreat.revise",
  "security.privacyThreat.assess",
  "security.privacyThreat.snapshot",
  "process.models.read",
  "process.models.create",
  "process.models.revise",
  "process.models.assess",
  "process.models.snapshot",
  "data.models.read",
  "data.models.create",
  "data.models.revise",
  "data.models.assess",
  "data.models.snapshot",
  "authorization.models.read",
  "authorization.models.create",
  "authorization.models.revise",
  "authorization.models.assess",
  "authorization.models.snapshot",
  "integration.models.read",
  "integration.models.create",
  "integration.models.revise",
  "integration.models.assess",
  "integration.models.snapshot",
  "recovery.models.read",
  "recovery.models.create",
  "recovery.models.revise",
  "recovery.models.assess",
  "recovery.models.snapshot",
  "challenge.models.read",
  "challenge.models.create",
  "challenge.models.revise",
  "challenge.models.assess",
  "challenge.models.snapshot",
  "decision.registers.read",
  "decision.registers.create",
  "decision.registers.revise",
  "decision.registers.assess",
  "decision.registers.snapshot",
  "risk.registers.read",
  "risk.registers.create",
  "risk.registers.revise",
  "risk.registers.assess",
  "risk.registers.snapshot",
  "evidence.registries.read",
  "evidence.registries.create",
  "evidence.registries.revise",
  "evidence.registries.assess",
  "evidence.registries.snapshot",
  "traceability.graphs.read",
  "traceability.graphs.create",
  "traceability.graphs.revise",
  "traceability.graphs.assess",
  "traceability.graphs.snapshot",
  "readiness.gates.read",
  "readiness.gates.create",
  "readiness.gates.revise",
  "readiness.gates.assess",
  "readiness.gates.snapshot",
  "handoff.p5.read",
  "handoff.p5.create",
  "handoff.p5.revise",
  "handoff.p5.assess",
  "handoff.p5.snapshot",
  "design.applicability.read",
  "design.applicability.create",
  "design.applicability.revise",
  "design.applicability.assess",
  "design.applicability.snapshot",
  "design.personas.roles.read",
  "design.personas.roles.create",
  "design.personas.roles.revise",
  "design.personas.roles.assess",
  "design.personas.roles.snapshot",
  "design.journeys.read",
  "design.journeys.create",
  "design.journeys.revise",
  "design.journeys.assess",
  "design.journeys.snapshot",
  "design.informationArchitecture.read",
  "design.informationArchitecture.create",
  "design.informationArchitecture.revise",
  "design.informationArchitecture.assess",
  "design.informationArchitecture.snapshot",
  "design.screenStateInventory.read",
  "design.screenStateInventory.create",
  "design.screenStateInventory.revise",
  "design.screenStateInventory.assess",
  "design.screenStateInventory.snapshot",
  "design.requirements.read",
  "design.requirements.create",
  "design.requirements.revise",
  "design.requirements.assess",
  "design.requirements.snapshot",
  "design.systemTokenContract.read",
  "design.systemTokenContract.create",
  "design.systemTokenContract.revise",
  "design.systemTokenContract.assess",
  "design.systemTokenContract.snapshot",
  "design.accessibilityRules.read",
  "design.accessibilityRules.create",
  "design.accessibilityRules.revise",
  "design.accessibilityRules.assess",
  "design.accessibilityRules.snapshot",
  "design.responsiveMultiPlatformTargets.read",
  "design.responsiveMultiPlatformTargets.create",
  "design.responsiveMultiPlatformTargets.revise",
  "design.responsiveMultiPlatformTargets.assess",
  "design.responsiveMultiPlatformTargets.snapshot",
  "design.manualFigmaExecutionPath.read",
  "design.manualFigmaExecutionPath.create",
  "design.manualFigmaExecutionPath.revise",
  "design.manualFigmaExecutionPath.assess",
  "design.manualFigmaExecutionPath.snapshot",
  "design.figmaMcpCapabilityDiscovery.read",
  "design.figmaMcpCapabilityDiscovery.create",
  "design.figmaMcpCapabilityDiscovery.revise",
  "design.figmaMcpCapabilityDiscovery.assess",
  "design.figmaMcpCapabilityDiscovery.snapshot",
  "design.figmaReadSnapshot.read",
  "design.figmaReadSnapshot.create",
  "design.figmaReadSnapshot.revise",
  "design.figmaReadSnapshot.assess",
  "design.figmaReadSnapshot.snapshot",
  "design.figmaContextImport.read",
  "design.figmaContextImport.create",
  "design.figmaContextImport.revise",
  "design.figmaContextImport.assess",
  "design.figmaContextImport.snapshot",
  "design.outboundDesignBriefPackage.read",
  "design.outboundDesignBriefPackage.create",
  "design.outboundDesignBriefPackage.revise",
  "design.outboundDesignBriefPackage.assess",
  "design.outboundDesignBriefPackage.snapshot",
  "design.governedFigmaWrite.read",
  "design.governedFigmaWrite.create",
  "design.governedFigmaWrite.revise",
  "design.governedFigmaWrite.assess",
  "design.governedFigmaWrite.snapshot",
  "design.finalizedFigmaSnapshotImport.read",
  "design.finalizedFigmaSnapshotImport.create",
  "design.finalizedFigmaSnapshotImport.revise",
  "design.finalizedFigmaSnapshotImport.assess",
  "design.finalizedFigmaSnapshotImport.snapshot",
  "design.designToRequirementBinding.read",
  "design.designToRequirementBinding.create",
  "design.designToRequirementBinding.revise",
  "design.designToRequirementBinding.assess",
  "design.designToRequirementBinding.snapshot",
  "design.designerReadyGate.read",
  "design.designerReadyGate.create",
  "design.designerReadyGate.revise",
  "design.designerReadyGate.assess",
  "design.designerReadyGate.snapshot",
  "design.designDelta.read",
  "design.designDelta.create",
  "design.designDelta.revise",
  "design.designDelta.assess",
  "design.designDelta.snapshot",
  "design.designConflictResolution.read",
  "design.designConflictResolution.create",
  "design.designConflictResolution.revise",
  "design.designConflictResolution.assess",
  "design.designConflictResolution.snapshot",
  "design.humanDesignApproval.read",
  "design.humanDesignApproval.create",
  "design.humanDesignApproval.revise",
  "design.humanDesignApproval.assess",
  "design.humanDesignApproval.snapshot",
  ...portableDesignHostMethods,
])

const requestEnvelopeSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string().min(1).max(128), z.number().int().safe()]),
  protocolVersion: z.number().int().positive().max(1_000).optional(),
  method: z.string().min(1).max(128),
  params: z.unknown().default({}),
}).strict()

interface CapabilitySnapshot {
  capabilities: AdapterCapabilities
  runtimeBinding: AdapterRuntimeBinding
}

interface PortablePreparedRun {
  run: Run
  execution: {
    inputMode?: "text-once" | "bidirectional-jsonl"
    protocol: "jsonl" | "stream-json" | "json-rpc"
    maturity: "stable" | "beta" | "experimental"
    warnings: string[]
    promptAttached: boolean
  }
}

function actorId(value: string | undefined): string {
  return value ?? "gaep.local-founder"
}

function sameExecutable(left: ExecutableFingerprint, right: ExecutableFingerprint): boolean {
  return left.canonicalPath === right.canonicalPath
    && left.digest === right.digest
    && left.size === right.size
    && left.modifiedAtMs === right.modifiedAtMs
}

function sameRuntimeBinding(left: AdapterRuntimeBinding, right: AdapterRuntimeBinding): boolean {
  if (left.kind !== right.kind || left.adapterId !== right.adapterId || left.agentId !== right.agentId) return false
  if (left.kind === "executable" && right.kind === "executable") {
    return left.executablePath === right.executablePath
      && sameExecutable(left.executableFingerprint, right.executableFingerprint)
  }
  if (left.kind === "managed-in-process" && right.kind === "managed-in-process") {
    return left.runtimeId === right.runtimeId
  }
  return left.kind === "unavailable" && right.kind === "unavailable"
}

function portablePreparedRun(value: { run: Run; invocation: {
  inputMode?: "text-once" | "bidirectional-jsonl"
  protocol: "jsonl" | "stream-json" | "json-rpc"
  maturity: "stable" | "beta" | "experimental"
  warnings: string[]
  stdin?: string
} }): PortablePreparedRun {
  return {
    run: value.run,
    execution: {
      inputMode: value.invocation.inputMode,
      protocol: value.invocation.protocol,
      maturity: value.invocation.maturity,
      warnings: [...value.invocation.warnings],
      promptAttached: value.invocation.stdin !== undefined,
    },
  }
}

export class EngineHost {
  readonly engine: GaepEngine
  private readonly recovery: Promise<unknown>
  private readonly capabilitySnapshots = new Map<string, CapabilitySnapshot>()
  private readonly selectedRuntimeBindings = new Map<string, AdapterRuntimeBinding>()

  constructor(workspacePath: string) {
    this.engine = new GaepEngine(workspacePath, [new CodexAdapter(), new ClaudeAdapter()])
    this.recovery = this.engine.recoverInterruptedRuns("gaep.engine-host")
  }

  async dispatch(rawRequest: unknown): Promise<unknown> {
    try {
      return await this.dispatchInternal(rawRequest)
    } catch (error) {
      throw normalizeRpcError(error)
    }
  }

  private async dispatchInternal(rawRequest: unknown): Promise<unknown> {
    await this.recovery
    const request = EngineHost.validateRequest(rawRequest)
    const requestProtocol = request.protocolVersion ?? 1
    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(requestProtocol as 1 | 2)) {
      throw new HostRpcError(
        -32_020,
        "UNSUPPORTED_PROTOCOL_VERSION",
        `GAEP engine protocol ${requestProtocol} is unsupported`,
        { supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS] },
      )
    }
    if (requestProtocol === 1 && v2OnlyMethods.has(request.method)) {
      throw new HostRpcError(
        -32_021,
        "PROTOCOL_UPGRADE_REQUIRED",
        "This GAEP engine method requires protocol version 2",
        { supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS] },
      )
    }

    switch (request.method) {
      case "ping":
        return {
          engineVersion: "0.1.0",
          protocolVersion: PROTOCOL_VERSION,
          negotiatedProtocolVersion: requestProtocol,
          supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
        }
      case "probeAgents":
        return this.refreshCapabilitySnapshots()
      case "readAgentSelection":
        return this.engine.readSelectionState()
      case "workspaceHealth":
        return this.engine.workspaceHealth()
      case "readProduct":
        return this.engine.readProduct()
      case "createProduct":
        return this.engine.createProduct(request.params.product, actorId(request.params.actorId))
      case "createInitiative":
        return this.engine.createInitiative(request.params.initiative, actorId(request.params.actorId))
      case "readInitiative":
        return this.engine.readInitiative(request.params.initiativeId)
      case "assessInitiativeEntry":
        return this.engine.assessInitiativeEntry(request.params.initiativeId)
      case "classifyInitiative":
        return this.engine.classifyInitiative(
          request.params.initiativeId,
          request.params.classification,
          request.params.expectedInitiativeRevision,
          actorId(request.params.actorId),
        )
      case "resolveInitiativeApplicability":
        return this.engine.resolveInitiativeApplicability(
          request.params.initiativeId,
          request.params.applicability,
          request.params.expectedInitiativeRevision,
          actorId(request.params.actorId),
        )
      case "selectAgent": {
        const snapshot = await this.observeAdapter(request.params.adapterId)
        const result = await this.engine.selectAgentGoverned(
          structuredClone(snapshot.capabilities),
          request.params.modelId,
          request.params.settings,
          actorId(request.params.actorId),
        )
        if (result.status === "blocked") {
          const blocked = {
            "active-run": [-32_015, "AGENT_SELECTION_ACTIVE_RUN", "Agent selection cannot change while a Run is non-terminal"],
            "capabilities-changed": [-32_012, "CAPABILITIES_CHANGED", "Agent capabilities changed during selection; probe again"],
            "migration-required": [-32_016, "AGENT_SELECTION_MIGRATION_REQUIRED", "The legacy Agent Selection requires explicit re-probe and reconfirmation"],
            "handoff-required": [-32_017, "AGENT_SELECTION_HANDOFF_REQUIRED", "A versioned handoff is required before changing agent, model, or settings after a Run"],
            "invalid-selection": [-32_018, "AGENT_SELECTION_INVALID", "The persisted Agent Selection is invalid and cannot be replaced implicitly"],
          } as const
          const [code, kind, message] = blocked[result.reason]
          throw new HostRpcError(code, kind, message)
        }
        this.selectedRuntimeBindings.set(request.params.adapterId, structuredClone(snapshot.runtimeBinding))
        return result.selection
      }
      case "migrateLegacySelection": {
        const snapshot = await this.observeAdapter(request.params.adapterId)
        const selection = await this.engine.migrateLegacyAgentSelection({
          capabilities: structuredClone(snapshot.capabilities),
          modelId: request.params.modelId,
          settings: request.params.settings,
          confirmation: request.params.confirmation,
        }, actorId(request.params.actorId))
        this.selectedRuntimeBindings.set(request.params.adapterId, structuredClone(snapshot.runtimeBinding))
        return selection
      }
      case "createCharter":
        return this.engine.createCharter(request.params.charter, actorId(request.params.actorId))
      case "confirmCharter":
        return this.engine.confirmCharter(request.params.charterId, actorId(request.params.actorId))
      case "prepareRun": {
        const selection = await this.engine.readSelection()
        const selectedBinding = this.selectedRuntimeBindings.get(selection.adapterId)
        const fresh = await this.observeAdapter(selection.adapterId)
        if (capabilityDigest(fresh.capabilities) !== selection.capabilityDigest) {
          throw new HostRpcError(
            -32_012,
            "CAPABILITIES_CHANGED",
            "Agent capabilities changed after selection; select the agent and model again",
          )
        }
        if (selectedBinding && !sameRuntimeBinding(selectedBinding, fresh.runtimeBinding)) {
          throw new HostRpcError(
            -32_014,
            "EXECUTABLE_CHANGED",
            "The selected agent runtime changed after selection; probe and select it again",
          )
        }
        if (fresh.runtimeBinding.kind === "unavailable") {
          throw new HostRpcError(-32_013, "EXECUTABLE_UNAVAILABLE", "The selected agent runtime is unavailable")
        }
        this.selectedRuntimeBindings.set(selection.adapterId, structuredClone(fresh.runtimeBinding))
        return portablePreparedRun(await this.engine.prepareRun(request.params.charterId, actorId(request.params.actorId)))
      }
      case "listRuns":
        return this.engine.listRuns()
      case "createHandoff": {
        const snapshot = await this.observeAdapter(request.params.handoff.toAdapterId)
        const handoff = await this.engine.createHandoff({
          fromRunId: request.params.handoff.fromRunId,
          toCapabilities: structuredClone(snapshot.capabilities),
          toModelId: request.params.handoff.toModelId,
          toSettings: request.params.handoff.toSettings,
          reason: request.params.handoff.reason,
          completedWork: request.params.handoff.completedWork,
          unresolvedMatters: request.params.handoff.unresolvedMatters,
          decisions: request.params.handoff.decisions,
          evidence: request.params.handoff.evidence,
        }, actorId(request.params.actorId))
        this.selectedRuntimeBindings.set(request.params.handoff.toAdapterId, structuredClone(snapshot.runtimeBinding))
        return handoff
      }
      case "managed.readonly.preview":
        return this.engine.previewManagedReadOnlyExecution(
          request.params.charterId,
          request.params.workflowPlanId,
        )
      case "managed.readonly.execute": {
        const preview = await this.engine.previewManagedReadOnlyExecution(
          request.params.charterId,
          request.params.workflowPlanId,
        )
        if (preview.previewDigest !== request.params.expectedPreviewDigest) {
          throw new HostRpcError(
            -32_022,
            "MANAGED_READ_ONLY_PREVIEW_CHANGED",
            "Managed read-only preview changed before execution; review the current preview",
          )
        }
        const receipt = await this.engine.executeManagedReadOnly({
          charterId: request.params.charterId,
          workflowPlanId: request.params.workflowPlanId,
          expectedPreviewDigest: request.params.expectedPreviewDigest,
          timeoutMs: request.params.timeoutMs,
        }, actorId(request.params.actorId))
        const record = await this.engine.readManagedRun(receipt.managedRunId)
        const result = record.resultId ? await this.engine.readManagedRunResult(record.resultId) : undefined
        const evidence = result ? await this.engine.readManagedRunEvidence(result.evidenceId) : undefined
        if (receipt.previewDigest !== preview.previewDigest || !result || !evidence ||
            receipt.resultDigest !== canonicalDigest(result) || receipt.evidenceDigest !== canonicalDigest(evidence)) {
          throw new HostRpcError(
            -32_023,
            "MANAGED_READ_ONLY_RECEIPT_INVALID",
            "Managed read-only terminal evidence could not be verified",
          )
        }
        return receipt
      }
      case "managed.evidence.list": {
        const audit = await this.engine.repository.verifyAudit()
        if (!audit.valid) {
          throw new HostRpcError(
            -32_024,
            "MANAGED_EVIDENCE_AUDIT_INVALID",
            "Managed Run evidence is unavailable because the governed audit chain is invalid",
          )
        }
        try {
          return managedRunPageDto(await this.engine.listManagedRunsPage({
            offset: request.params.offset,
            limit: request.params.limit,
            ...(request.params.snapshotDigest
              ? { snapshotDigest: request.params.snapshotDigest as `sha256:${string}` }
              : {}),
          }))
        } catch (error) {
          if (error instanceof Error && error.message.includes("inventory changed during pagination")) {
            throw new HostRpcError(
              -32_025,
              "MANAGED_EVIDENCE_SNAPSHOT_CHANGED",
              "Managed Run inventory changed during pagination; reload the first page",
            )
          }
          throw new HostRpcError(
            -32_026,
            "MANAGED_EVIDENCE_INVENTORY_INVALID",
            "GAEP could not verify the bounded Managed Run inventory",
          )
        }
      }
      case "managed.evidence.read": {
        const audit = await this.engine.repository.verifyAudit()
        if (!audit.valid) {
          throw new HostRpcError(
            -32_024,
            "MANAGED_EVIDENCE_AUDIT_INVALID",
            "Managed Run evidence is unavailable because the governed audit chain is invalid",
          )
        }
        try {
          const record = await this.engine.readManagedRun(request.params.managedRunId)
          return await managedEvidenceDetailDto(record, {
            readResult: (id) => this.engine.readManagedRunResult(id),
            readEvidence: (id) => this.engine.readManagedRunEvidence(id),
            readApplyDecision: (id) => this.engine.readManagedApplyDecision(id),
          })
        } catch {
          throw new HostRpcError(
            -32_027,
            "MANAGED_EVIDENCE_DETAIL_INVALID",
            "GAEP could not verify the exact Managed Run evidence detail",
          )
        }
      }
      case "managed.review.read":
        return this.readManagedReviewPreview(request.params.managedRunId)
      case "managed.review.apply": {
        const preview = await this.readManagedReviewPreview(request.params.managedRunId)
        this.assertCurrentManagedReview(preview, request.params.expectedManagedRunRevision, request.params.expectedPreviewDigest)
        if (!preview.canApply || !preview.applyConfirmation) {
          throw new HostRpcError(
            -32_036,
            "MANAGED_REVIEW_INVALID",
            "The exact Managed Run review is not currently eligible for apply",
          )
        }
        try {
          const review = await this.engine.applyPendingManagedReview(
            preview.managedRunId,
            {
              confirmation: preview.applyConfirmation,
              evaluateWorkflowGate: recordManagedReviewWorkflowGatesNotAssessed,
            },
            actorId(request.params.actorId),
          )
          await this.assertManagedReviewTransitionIntegrity(review.record)
          return managedReviewTransitionDto(
            "apply-exact-managed-review",
            preview,
            review,
            this.managedEvidenceReaders(),
          )
        } catch (error) {
          if (error instanceof HostRpcError) throw error
          throw new HostRpcError(
            -32_037,
            "MANAGED_REVIEW_APPLY_FAILED",
            "The exact Managed Run apply transition could not be verified; reload the review before any retry",
          )
        }
      }
      case "managed.review.discard": {
        const preview = await this.readManagedReviewPreview(request.params.managedRunId)
        this.assertCurrentManagedReview(preview, request.params.expectedManagedRunRevision, request.params.expectedPreviewDigest)
        if (!preview.canDiscard) {
          throw new HostRpcError(
            -32_036,
            "MANAGED_REVIEW_INVALID",
            "The exact Managed Run review is not currently eligible for discard",
          )
        }
        try {
          const review = await this.engine.discardPendingManagedReview(
            preview.managedRunId,
            actorId(request.params.actorId),
          )
          await this.assertManagedReviewTransitionIntegrity(review.record)
          return managedReviewTransitionDto(
            "discard-exact-managed-review",
            preview,
            review,
            this.managedEvidenceReaders(),
          )
        } catch (error) {
          if (error instanceof HostRpcError) throw error
          throw new HostRpcError(
            -32_038,
            "MANAGED_REVIEW_DISCARD_FAILED",
            "The exact Managed Run discard transition could not be verified; reload the review before any retry",
          )
        }
      }
      case "dashboard.framework": {
        const product = await this.engine.readProduct()
        try {
          return composePhaseDashboardFramework(product, request.params)
        } catch (error) {
          if (error instanceof DashboardProductBindingError) {
            throw new HostRpcError(
              -32_039,
              "DASHBOARD_PRODUCT_CONTEXT_CHANGED",
              "The Product changed before the dashboard framework was composed; reload the current Product",
            )
          }
          throw error
        }
      }
      case "dashboard.phase1Summary": {
        const audit = await this.engine.repository.verifyAudit()
        if (!audit.valid) {
          throw new HostRpcError(
            -32_046,
            "PHASE1_SUMMARY_AUDIT_INVALID",
            "The audit chain is invalid or unavailable; no Phase 1 summary was composed",
          )
        }
        const initiativeId = request.params.expectedInitiativeId
        const [product, initiative, readiness, handoff] = await Promise.all([
          this.engine.readProduct(),
          this.engine.readInitiative(initiativeId),
          this.engine.p0P4ReadinessGate.project(initiativeId),
          this.engine.p5HandoffPackage.project(initiativeId),
        ])
        try {
          return composePhase1SummaryDashboard(product, initiative, readiness, handoff, request.params)
        } catch (error) {
          if (error instanceof Phase1SummaryBindingError) {
            throw new HostRpcError(
              -32_047,
              "PHASE1_SUMMARY_CONTEXT_CHANGED",
              "The Product, Initiative, readiness, or handoff context changed before the Phase 1 summary was composed; reload the exact governed projections",
            )
          }
          throw error
        }
      }
      case "dashboard.phase1ChangeImpact": {
        const audit = await this.engine.repository.verifyAudit()
        if (!audit.valid) {
          throw new HostRpcError(
            -32_048,
            "PHASE1_CHANGE_IMPACT_AUDIT_INVALID",
            "The audit chain is invalid or unavailable; no Phase 1 Change/Impact dashboard was composed",
          )
        }
        const product = await this.engine.readProduct()
        if (
          request.params.expectedProductId.toLowerCase() !== product.id.toLowerCase()
          || request.params.expectedProductRevision !== (product.revision ?? 1)
          || request.params.expectedProductDigest !== canonicalDigest(product)
        ) {
          throw new HostRpcError(
            -32_049,
            "PHASE1_CHANGE_IMPACT_CONTEXT_CHANGED",
            "The Product changed before the Phase 1 Change/Impact dashboard was composed; reload the exact governed context",
          )
        }
        let initiative
        let change: Change
        try {
          [initiative, change] = await Promise.all([
            this.engine.readInitiative(request.params.expectedInitiativeId),
            this.engine.productStudio.readChange(request.params.expectedChangeId),
          ])
        } catch {
          throw new HostRpcError(
            -32_049,
            "PHASE1_CHANGE_IMPACT_CONTEXT_CHANGED",
            "The Initiative or Change is unavailable; reload the exact governed Phase 1 context",
          )
        }
        const changeDigest = canonicalDigest(change)
        if (request.params.expectedChangeRevision !== change.revision || request.params.expectedChangeDigest !== changeDigest) {
          throw new HostRpcError(
            -32_049,
            "PHASE1_CHANGE_IMPACT_CONTEXT_CHANGED",
            "The Change changed before the Phase 1 Change/Impact dashboard was composed; reload the exact governed context",
          )
        }
        const [workItems, traceImpact, decisions, risks, readiness, readinessGate, handoff, handoffPackage] = await Promise.all([
          this.engine.productStudio.listWorkItems(),
          this.engine.productStudio.impactAnalysis({
            recordType: "change",
            recordId: change.id,
            revision: change.revision,
            digest: changeDigest,
          }),
          this.engine.productStudio.listDecisions(),
          this.engine.productStudio.listRisks(),
          this.engine.p0P4ReadinessGate.project(initiative.id),
          this.engine.p0P4ReadinessGate.readCurrent(initiative.id),
          this.engine.p5HandoffPackage.project(initiative.id),
          this.engine.p5HandoffPackage.readCurrent(initiative.id),
        ])
        try {
          const changeImpact = composeChangeImpactDashboard(
            { product, change, workItems, traceImpact, decisions, risks },
            {
              expectedProductId: request.params.expectedProductId,
              expectedProductRevision: request.params.expectedProductRevision,
              expectedProductDigest: request.params.expectedProductDigest,
              expectedChangeId: request.params.expectedChangeId,
              expectedChangeRevision: request.params.expectedChangeRevision,
              expectedChangeDigest: request.params.expectedChangeDigest,
            },
          )
          return composePhase1ChangeImpactDashboard({
            product,
            initiative,
            change,
            changeImpact,
            readiness,
            ...(readinessGate ? { readinessGate } : {}),
            handoff,
            ...(handoffPackage ? { handoffPackage } : {}),
          }, request.params)
        } catch (error) {
          if (error instanceof Phase1ChangeImpactBindingError || error instanceof ChangeImpactProductBindingError ||
              error instanceof ChangeImpactChangeBindingError) {
            throw new HostRpcError(
              -32_049,
              "PHASE1_CHANGE_IMPACT_CONTEXT_CHANGED",
              "The Product, Initiative, Change, readiness, handoff, or trace context changed before composition; reload the exact governed context",
            )
          }
          throw error
        }
      }
      case "dashboard.changeImpact.changes": {
        const audit = await this.engine.repository.verifyAudit()
        if (!audit.valid) {
          throw new HostRpcError(
            -32_042,
            "CHANGE_IMPACT_AUDIT_INVALID",
            "The audit chain is invalid or unavailable; no Change catalog was composed",
          )
        }
        const product = await this.engine.readProduct()
        try {
          return composeChangeImpactChangeCatalog(
            product,
            await this.engine.productStudio.listChanges(),
            request.params,
          )
        } catch (error) {
          if (error instanceof ChangeImpactProductBindingError) {
            throw new HostRpcError(
              -32_040,
              "CHANGE_IMPACT_PRODUCT_CONTEXT_CHANGED",
              "The Product changed before the Change catalog was composed; reload the current Product",
            )
          }
          throw new HostRpcError(
            -32_043,
            "CHANGE_IMPACT_CATALOG_INVALID",
            "The current Change catalog could not be verified",
          )
        }
      }
      case "dashboard.changeImpact": {
        const audit = await this.engine.repository.verifyAudit()
        if (!audit.valid) {
          throw new HostRpcError(
            -32_042,
            "CHANGE_IMPACT_AUDIT_INVALID",
            "The audit chain is invalid or unavailable; no Change/Impact dashboard was composed",
          )
        }
        const product = await this.engine.readProduct()
        if (
          request.params.expectedProductId.toLowerCase() !== product.id.toLowerCase()
          || request.params.expectedProductRevision !== (product.revision ?? 1)
          || request.params.expectedProductDigest !== canonicalDigest(product)
        ) {
          throw new HostRpcError(
            -32_040,
            "CHANGE_IMPACT_PRODUCT_CONTEXT_CHANGED",
            "The Product changed before the Change/Impact dashboard was composed; reload the current Product",
          )
        }
        let change: Change
        try {
          change = await this.engine.productStudio.readChange(request.params.expectedChangeId)
        } catch {
          throw new HostRpcError(
            -32_041,
            "CHANGE_IMPACT_CHANGE_CONTEXT_CHANGED",
            "The Change is unavailable or changed before impact composition; reload the current Change",
          )
        }
        const changeDigest = canonicalDigest(change)
        if (
          request.params.expectedChangeRevision !== change.revision
          || request.params.expectedChangeDigest !== changeDigest
        ) {
          throw new HostRpcError(
            -32_041,
            "CHANGE_IMPACT_CHANGE_CONTEXT_CHANGED",
            "The Change changed before the Change/Impact dashboard was composed; reload the current Change",
          )
        }
        const [workItems, traceImpact, decisions, risks] = await Promise.all([
          this.engine.productStudio.listWorkItems(),
          this.engine.productStudio.impactAnalysis({
            recordType: "change",
            recordId: change.id,
            revision: change.revision,
            digest: changeDigest,
          }),
          this.engine.productStudio.listDecisions(),
          this.engine.productStudio.listRisks(),
        ])
        try {
          return composeChangeImpactDashboard(
            { product, change, workItems, traceImpact, decisions, risks },
            request.params,
          )
        } catch (error) {
          if (error instanceof ChangeImpactProductBindingError) {
            throw new HostRpcError(
              -32_040,
              "CHANGE_IMPACT_PRODUCT_CONTEXT_CHANGED",
              "The Product changed before the Change/Impact dashboard was composed; reload the current Product",
            )
          }
          if (error instanceof ChangeImpactChangeBindingError) {
            throw new HostRpcError(
              -32_041,
              "CHANGE_IMPACT_CHANGE_CONTEXT_CHANGED",
              "The Change changed before the Change/Impact dashboard was composed; reload the current Change",
            )
          }
          throw error
        }
      }
      case "dashboard.agentModel": {
        const audit = await this.engine.repository.verifyAudit()
        if (!audit.valid) {
          throw new HostRpcError(
            -32_044,
            "AGENT_MODEL_AUDIT_INVALID",
            "The audit chain is invalid or unavailable; no Agent/Model dashboard was composed",
          )
        }
        try {
          const capabilities = this.boundCapabilitySnapshots(request.params.expectedCapabilities)
          const [product, selection, runs, handoffs, managedPage] = await Promise.all([
            this.engine.readProduct(),
            this.engine.readSelectionState(),
            this.engine.listRuns(),
            this.engine.listHandoffs(),
            this.engine.listManagedRunsPage({ offset: 0, limit: 200 }),
          ])
          const managedRuns = await Promise.all(managedPage.items.map(async (record) => {
            if (!record.resultId) return { record }
            const result = await this.engine.readManagedRunResult(record.resultId)
            const evidence = await this.engine.readManagedRunEvidence(result.evidenceId)
            return { record, result, evidence }
          }))
          return composeAgentModelDashboard({
            product,
            capabilities,
            selection,
            runs,
            handoffs,
            handoffTotal: handoffs.length,
            managedRuns,
            managedRunTotal: managedPage.total,
          }, request.params)
        } catch (error) {
          if (error instanceof AgentModelProductBindingError) {
            throw new HostRpcError(
              -32_045,
              "AGENT_MODEL_PRODUCT_CONTEXT_CHANGED",
              "The Product changed before the Agent/Model dashboard was composed; reload the current Product",
            )
          }
          if (error instanceof AgentModelCapabilityBindingError) {
            throw new HostRpcError(
              -32_046,
              "AGENT_MODEL_CAPABILITIES_CHANGED",
              "Agent capabilities changed before the dashboard was composed; probe the current agents again",
            )
          }
          if (error instanceof AgentModelSelectionBindingError) {
            throw new HostRpcError(
              -32_047,
              "AGENT_MODEL_SELECTION_CHANGED",
              "The Agent Selection changed before the dashboard was composed; reload the current selection",
            )
          }
          if (error instanceof HostRpcError) throw error
          throw new HostRpcError(
            -32_048,
            "AGENT_MODEL_DASHBOARD_INVALID",
            "The current Agent/Model dashboard sources could not be verified",
          )
        }
      }
      case "dashboard.phase1AgentModel": {
        const audit = await this.engine.repository.verifyAudit()
        if (!audit.valid) {
          throw new HostRpcError(
            -32_050,
            "PHASE1_AGENT_MODEL_AUDIT_INVALID",
            "The audit chain is invalid or unavailable; no Phase 1 Agent/Model dashboard was composed",
          )
        }
        try {
          const capabilities = this.boundCapabilitySnapshots(request.params.agentModel.expectedCapabilities)
          const [product, initiative, selection, allRuns, allHandoffs, allManagedRuns] = await Promise.all([
            this.engine.readProduct(),
            this.engine.readInitiative(request.params.expectedInitiativeId),
            this.engine.readSelectionState(),
            this.engine.listRuns(),
            this.engine.listHandoffs(),
            this.engine.listManagedRuns(),
          ])
          const initiativeId = initiative.id.toLowerCase()
          const runs = allRuns.filter((run) => run.initiativeId.toLowerCase() === initiativeId)
          const handoffs = allHandoffs.filter((handoff) => handoff.initiativeId.toLowerCase() === initiativeId)
          const managedRecords = allManagedRuns.filter((record) => record.initiativeId.toLowerCase() === initiativeId)
          const managedRuns = await Promise.all(managedRecords.map(async (record) => {
            if (!record.resultId) return { record }
            const result = await this.engine.readManagedRunResult(record.resultId)
            const evidence = await this.engine.readManagedRunEvidence(result.evidenceId)
            return { record, result, evidence }
          }))
          const agentModel = composeAgentModelDashboard({
            product,
            capabilities,
            selection,
            runs,
            handoffs,
            handoffTotal: handoffs.length,
            managedRuns,
            managedRunTotal: managedRuns.length,
          }, request.params.agentModel)
          return composePhase1AgentModelDashboard(product, initiative, agentModel, request.params)
        } catch (error) {
          if (error instanceof AgentModelCapabilityBindingError) {
            throw new HostRpcError(
              -32_046,
              "AGENT_MODEL_CAPABILITIES_CHANGED",
              "Agent capabilities changed before the dashboard was composed; probe the current agents again",
            )
          }
          if (error instanceof AgentModelSelectionBindingError) {
            throw new HostRpcError(
              -32_047,
              "AGENT_MODEL_SELECTION_CHANGED",
              "The Agent Selection changed before the dashboard was composed; reload the current selection",
            )
          }
          if (error instanceof Phase1AgentModelBindingError || error instanceof AgentModelProductBindingError) {
            throw new HostRpcError(
              -32_051,
              "PHASE1_AGENT_MODEL_CONTEXT_CHANGED",
              "The Product or Initiative changed before the Phase 1 Agent/Model dashboard was composed; reload the current context",
            )
          }
          if (error instanceof HostRpcError) throw error
          throw new HostRpcError(
            -32_052,
            "PHASE1_AGENT_MODEL_DASHBOARD_INVALID",
            "The current Phase 1 Agent/Model dashboard sources could not be verified",
          )
        }
      }
      case "verifyAudit":
        return this.engine.repository.verifyAudit()
      case "productStudio.designReadiness": {
        const draft = await this.engine.productStudio.readDesignDraft(request.params.productId)
        return this.engine.productStudio.evaluateDesignReadiness(draft)
      }
      case "productStudio.search":
        return this.engine.productStudio.search(request.params)
      case "productStudio.exportBuild":
        return this.engine.productStudio.buildPortableExport()
      case "productStudio.importPreview":
        return this.engine.productStudio.previewImportBundle(request.params.bundle)
      case "source.list":
        return this.engine.sourceGovernance.listSources(request.params.initiativeId)
      case "source.create":
        return this.engine.sourceGovernance.createSource(
          request.params.source,
          actorId(request.params.actorId),
        )
      case "source.revise":
        return this.engine.sourceGovernance.reviseSource(
          request.params.sourceId,
          request.params.expectedSourceRevision,
          request.params.source,
          actorId(request.params.actorId),
        )
      case "source.baseline.list":
        return this.engine.sourceGovernance.listBaselines(request.params.initiativeId)
      case "source.baseline.create":
        return this.engine.sourceGovernance.createBaseline(
          request.params.baseline,
          actorId(request.params.actorId),
        )
      case "source.baseline.revise":
        return this.engine.sourceGovernance.reviseBaseline(
          request.params.baselineId,
          request.params.expectedBaselineRevision,
          request.params.baseline,
          actorId(request.params.actorId),
        )
      case "source.provenance.list":
        return this.engine.sourceGovernance.listProvenance(request.params.initiativeId)
      case "source.provenance.record":
        return this.engine.sourceGovernance.recordProvenance(
          request.params.provenance,
          actorId(request.params.actorId),
        )
      case "source.assess":
        return this.engine.sourceGovernance.assess(request.params.initiativeId)
      case "source.snapshot":
        return this.engine.sourceGovernance.project(request.params.initiativeId)
      case "business.understanding.read":
        return await this.engine.businessUnderstanding.readCurrentBusinessUnderstanding(
          request.params.initiativeId,
        ) ?? null
      case "business.understanding.create":
        return this.engine.businessUnderstanding.createBusinessUnderstanding(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.understanding.revise":
        return this.engine.businessUnderstanding.reviseBusinessUnderstanding(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.stakeholders.read":
        return await this.engine.businessUnderstanding.readCurrentStakeholderModel(
          request.params.initiativeId,
        ) ?? null
      case "business.stakeholders.create":
        return this.engine.businessUnderstanding.createStakeholderModel(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.stakeholders.revise":
        return this.engine.businessUnderstanding.reviseStakeholderModel(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.outcomes.read":
        return await this.engine.businessUnderstanding.readCurrentOutcomeModel(
          request.params.initiativeId,
        ) ?? null
      case "business.outcomes.create":
        return this.engine.businessUnderstanding.createOutcomeModel(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.outcomes.revise":
        return this.engine.businessUnderstanding.reviseOutcomeModel(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.assess":
        return this.engine.businessUnderstanding.assess(request.params.initiativeId)
      case "business.snapshot":
        return this.engine.businessUnderstanding.project(request.params.initiativeId)
      case "business.capabilities.read":
        return await this.engine.businessCapabilityMap.readCurrent(
          request.params.initiativeId,
        ) ?? null
      case "business.capabilities.create":
        return this.engine.businessCapabilityMap.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.capabilities.revise":
        return this.engine.businessCapabilityMap.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.capabilities.assess":
        return this.engine.businessCapabilityMap.assess(request.params.initiativeId)
      case "business.capabilities.snapshot":
        return this.engine.businessCapabilityMap.project(request.params.initiativeId)
      case "business.valueStreams.read":
        return await this.engine.valueStreamModel.readCurrent(
          request.params.initiativeId,
        ) ?? null
      case "business.valueStreams.create":
        return this.engine.valueStreamModel.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.valueStreams.revise":
        return this.engine.valueStreamModel.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.valueStreams.assess":
        return this.engine.valueStreamModel.assess(request.params.initiativeId)
      case "business.valueStreams.snapshot":
        return this.engine.valueStreamModel.project(request.params.initiativeId)
      case "business.operatingModels.read":
        return await this.engine.operatingModel.readCurrent(request.params.initiativeId) ?? null
      case "business.operatingModels.create":
        return this.engine.operatingModel.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.operatingModels.revise":
        return this.engine.operatingModel.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.operatingModels.assess":
        return this.engine.operatingModel.assess(request.params.initiativeId)
      case "business.operatingModels.snapshot":
        return this.engine.operatingModel.project(request.params.initiativeId)
      case "business.businessRules.read":
        return await this.engine.businessRuleCatalog.readCurrent(request.params.initiativeId) ?? null
      case "business.businessRules.create":
        return this.engine.businessRuleCatalog.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.businessRules.revise":
        return this.engine.businessRuleCatalog.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.businessRules.assess":
        return this.engine.businessRuleCatalog.assess(request.params.initiativeId)
      case "business.businessRules.snapshot":
        return this.engine.businessRuleCatalog.project(request.params.initiativeId)
      case "business.architectureBaselines.read":
        return await this.engine.businessArchitectureBaseline.readCurrent(request.params.initiativeId) ?? null
      case "business.architectureBaselines.create":
        return this.engine.businessArchitectureBaseline.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.architectureBaselines.revise":
        return this.engine.businessArchitectureBaseline.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "business.architectureBaselines.assess":
        return this.engine.businessArchitectureBaseline.assess(request.params.initiativeId)
      case "business.architectureBaselines.snapshot":
        return this.engine.businessArchitectureBaseline.project(request.params.initiativeId)
      case "architecture.systemSolution.read":
        return await this.engine.systemSolutionArchitecture.readCurrent(request.params.initiativeId) ?? null
      case "architecture.systemSolution.create":
        return this.engine.systemSolutionArchitecture.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "architecture.systemSolution.revise":
        return this.engine.systemSolutionArchitecture.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "architecture.systemSolution.assess":
        return this.engine.systemSolutionArchitecture.assess(request.params.initiativeId)
      case "architecture.systemSolution.snapshot":
        return this.engine.systemSolutionArchitecture.project(request.params.initiativeId)
      case "architecture.boundedContexts.read":
        return await this.engine.boundedContextModel.readCurrent(request.params.initiativeId) ?? null
      case "architecture.boundedContexts.create":
        return this.engine.boundedContextModel.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "architecture.boundedContexts.revise":
        return this.engine.boundedContextModel.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "architecture.boundedContexts.assess":
        return this.engine.boundedContextModel.assess(request.params.initiativeId)
      case "architecture.boundedContexts.snapshot":
        return this.engine.boundedContextModel.project(request.params.initiativeId)
      case "security.privacyThreat.read":
        return await this.engine.securityPrivacyAssessment.readCurrent(request.params.initiativeId) ?? null
      case "security.privacyThreat.create":
        return this.engine.securityPrivacyAssessment.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "security.privacyThreat.revise":
        return this.engine.securityPrivacyAssessment.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "security.privacyThreat.assess":
        return this.engine.securityPrivacyAssessment.assess(request.params.initiativeId)
      case "security.privacyThreat.snapshot":
        return this.engine.securityPrivacyAssessment.project(request.params.initiativeId)
      case "process.models.read":
        return await this.engine.processModel.readCurrent(request.params.initiativeId) ?? null
      case "process.models.create":
        return this.engine.processModel.create(request.params.record, actorId(request.params.actorId))
      case "process.models.revise":
        return this.engine.processModel.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "process.models.assess":
        return this.engine.processModel.assess(request.params.initiativeId)
      case "process.models.snapshot":
        return this.engine.processModel.project(request.params.initiativeId)
      case "data.models.read":
        return await this.engine.dataModel.readCurrent(request.params.initiativeId) ?? null
      case "data.models.create":
        return this.engine.dataModel.create(request.params.record, actorId(request.params.actorId))
      case "data.models.revise":
        return this.engine.dataModel.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "data.models.assess":
        return this.engine.dataModel.assess(request.params.initiativeId)
      case "data.models.snapshot":
        return this.engine.dataModel.project(request.params.initiativeId)
      case "authorization.models.read":
        return await this.engine.authorizationModel.readCurrent(request.params.initiativeId) ?? null
      case "authorization.models.create":
        return this.engine.authorizationModel.create(request.params.record, actorId(request.params.actorId))
      case "authorization.models.revise":
        return this.engine.authorizationModel.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "authorization.models.assess":
        return this.engine.authorizationModel.assess(request.params.initiativeId)
      case "authorization.models.snapshot":
        return this.engine.authorizationModel.project(request.params.initiativeId)
      case "integration.models.read":
        return await this.engine.eventIntegrationModel.readCurrent(request.params.initiativeId) ?? null
      case "integration.models.create":
        return this.engine.eventIntegrationModel.create(request.params.record, actorId(request.params.actorId))
      case "integration.models.revise":
        return this.engine.eventIntegrationModel.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "integration.models.assess":
        return this.engine.eventIntegrationModel.assess(request.params.initiativeId)
      case "integration.models.snapshot":
        return this.engine.eventIntegrationModel.project(request.params.initiativeId)
      case "recovery.models.read":
        return await this.engine.failureRecoveryModel.readCurrent(request.params.initiativeId) ?? null
      case "recovery.models.create":
        return this.engine.failureRecoveryModel.create(request.params.record, actorId(request.params.actorId))
      case "recovery.models.revise":
        return this.engine.failureRecoveryModel.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "recovery.models.assess":
        return this.engine.failureRecoveryModel.assess(request.params.initiativeId)
      case "recovery.models.snapshot":
        return this.engine.failureRecoveryModel.project(request.params.initiativeId)
      case "challenge.models.read":
        return await this.engine.architectureChallengeModel.readCurrent(request.params.initiativeId) ?? null
      case "challenge.models.create":
        return this.engine.architectureChallengeModel.create(request.params.record, actorId(request.params.actorId))
      case "challenge.models.revise":
        return this.engine.architectureChallengeModel.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "challenge.models.assess":
        return this.engine.architectureChallengeModel.assess(request.params.initiativeId)
      case "challenge.models.snapshot":
        return this.engine.architectureChallengeModel.project(request.params.initiativeId)
      case "decision.registers.read":
        return await this.engine.decisionRegister.readCurrent(request.params.initiativeId) ?? null
      case "decision.registers.create":
        return this.engine.decisionRegister.create(request.params.record, actorId(request.params.actorId))
      case "decision.registers.revise":
        return this.engine.decisionRegister.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "decision.registers.assess":
        return this.engine.decisionRegister.assess(request.params.initiativeId)
      case "decision.registers.snapshot":
        return this.engine.decisionRegister.project(request.params.initiativeId)
      case "risk.registers.read":
        return await this.engine.riskRegister.readCurrent(request.params.initiativeId) ?? null
      case "risk.registers.create":
        return this.engine.riskRegister.create(request.params.record, actorId(request.params.actorId))
      case "risk.registers.revise":
        return this.engine.riskRegister.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "risk.registers.assess":
        return this.engine.riskRegister.assess(request.params.initiativeId)
      case "risk.registers.snapshot":
        return this.engine.riskRegister.project(request.params.initiativeId)
      case "evidence.registries.read":
        return await this.engine.evidenceRegistry.readCurrent(request.params.initiativeId) ?? null
      case "evidence.registries.create":
        return this.engine.evidenceRegistry.create(request.params.record, actorId(request.params.actorId))
      case "evidence.registries.revise":
        return this.engine.evidenceRegistry.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "evidence.registries.assess":
        return this.engine.evidenceRegistry.assess(request.params.initiativeId)
      case "evidence.registries.snapshot":
        return this.engine.evidenceRegistry.project(request.params.initiativeId)
      case "traceability.graphs.read":
        return await this.engine.endToEndTraceability.readCurrent(request.params.initiativeId) ?? null
      case "traceability.graphs.create":
        return this.engine.endToEndTraceability.create(request.params.record, actorId(request.params.actorId))
      case "traceability.graphs.revise":
        return this.engine.endToEndTraceability.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "traceability.graphs.assess":
        return this.engine.endToEndTraceability.assess(request.params.initiativeId)
      case "traceability.graphs.snapshot":
        return this.engine.endToEndTraceability.project(request.params.initiativeId)
      case "readiness.gates.read":
        return await this.engine.p0P4ReadinessGate.readCurrent(request.params.initiativeId) ?? null
      case "readiness.gates.create":
        return this.engine.p0P4ReadinessGate.create(request.params.record, actorId(request.params.actorId))
      case "readiness.gates.revise":
        return this.engine.p0P4ReadinessGate.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "readiness.gates.assess":
        return this.engine.p0P4ReadinessGate.assess(request.params.initiativeId)
      case "readiness.gates.snapshot":
        return this.engine.p0P4ReadinessGate.project(request.params.initiativeId)
      case "handoff.p5.read":
        return await this.engine.p5HandoffPackage.readCurrent(request.params.initiativeId) ?? null
      case "handoff.p5.create":
        return this.engine.p5HandoffPackage.create(request.params.record, actorId(request.params.actorId))
      case "handoff.p5.revise":
        return this.engine.p5HandoffPackage.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "handoff.p5.assess":
        return this.engine.p5HandoffPackage.assess(request.params.initiativeId)
      case "handoff.p5.snapshot":
        return this.engine.p5HandoffPackage.project(request.params.initiativeId)
      case "design.applicability.read":
        return await this.engine.designApplicability.readCurrent(request.params.initiativeId) ?? null
      case "design.applicability.create":
        return this.engine.designApplicability.create(request.params.record, actorId(request.params.actorId))
      case "design.applicability.revise":
        return this.engine.designApplicability.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.applicability.assess":
        return this.engine.designApplicability.assess(request.params.initiativeId)
      case "design.applicability.snapshot":
        return this.engine.designApplicability.project(request.params.initiativeId)
      case "design.personas.roles.read":
        return await this.engine.designPersonaRoleModel.readCurrent(request.params.initiativeId) ?? null
      case "design.personas.roles.create":
        return this.engine.designPersonaRoleModel.create(request.params.record, actorId(request.params.actorId))
      case "design.personas.roles.revise":
        return this.engine.designPersonaRoleModel.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.personas.roles.assess":
        return this.engine.designPersonaRoleModel.assess(request.params.initiativeId)
      case "design.personas.roles.snapshot":
        return this.engine.designPersonaRoleModel.project(request.params.initiativeId)
      case "design.journeys.read":
        return await this.engine.userJourneyModel.readCurrent(request.params.initiativeId) ?? null
      case "design.journeys.create":
        return this.engine.userJourneyModel.create(request.params.record, actorId(request.params.actorId))
      case "design.journeys.revise":
        return this.engine.userJourneyModel.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.journeys.assess":
        return this.engine.userJourneyModel.assess(request.params.initiativeId)
      case "design.journeys.snapshot":
        return this.engine.userJourneyModel.project(request.params.initiativeId)
      case "design.informationArchitecture.read":
        return await this.engine.informationArchitectureModel.readCurrent(request.params.initiativeId) ?? null
      case "design.informationArchitecture.create":
        return this.engine.informationArchitectureModel.create(request.params.record, actorId(request.params.actorId))
      case "design.informationArchitecture.revise":
        return this.engine.informationArchitectureModel.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.informationArchitecture.assess":
        return this.engine.informationArchitectureModel.assess(request.params.initiativeId)
      case "design.informationArchitecture.snapshot":
        return this.engine.informationArchitectureModel.project(request.params.initiativeId)
      case "design.screenStateInventory.read":
        return await this.engine.screenStateInventory.readCurrent(request.params.initiativeId) ?? null
      case "design.screenStateInventory.create":
        return this.engine.screenStateInventory.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.screenStateInventory.revise":
        return this.engine.screenStateInventory.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.screenStateInventory.assess":
        return this.engine.screenStateInventory.assess(request.params.initiativeId)
      case "design.screenStateInventory.snapshot":
        return this.engine.screenStateInventory.project(request.params.initiativeId)
      case "design.requirements.read":
        return await this.engine.designRequirements.readCurrent(request.params.initiativeId) ?? null
      case "design.requirements.create":
        return this.engine.designRequirements.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.requirements.revise":
        return this.engine.designRequirements.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.requirements.assess":
        return this.engine.designRequirements.assess(request.params.initiativeId)
      case "design.requirements.snapshot":
        return this.engine.designRequirements.project(request.params.initiativeId)
      case "design.systemTokenContract.read":
        return await this.engine.designSystemTokenContract.readCurrent(request.params.initiativeId) ?? null
      case "design.systemTokenContract.create":
        return this.engine.designSystemTokenContract.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.systemTokenContract.revise":
        return this.engine.designSystemTokenContract.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.systemTokenContract.assess":
        return this.engine.designSystemTokenContract.assess(request.params.initiativeId)
      case "design.systemTokenContract.snapshot":
        return this.engine.designSystemTokenContract.project(request.params.initiativeId)
      case "design.accessibilityRules.read":
        return await this.engine.accessibilityDesignRules.readCurrent(request.params.initiativeId) ?? null
      case "design.accessibilityRules.create":
        return this.engine.accessibilityDesignRules.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.accessibilityRules.revise":
        return this.engine.accessibilityDesignRules.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.accessibilityRules.assess":
        return this.engine.accessibilityDesignRules.assess(request.params.initiativeId)
      case "design.accessibilityRules.snapshot":
        return this.engine.accessibilityDesignRules.project(request.params.initiativeId)
      case "design.responsiveMultiPlatformTargets.read":
        return await this.engine.responsiveMultiPlatformTargets.readCurrent(request.params.initiativeId) ?? null
      case "design.responsiveMultiPlatformTargets.create":
        return this.engine.responsiveMultiPlatformTargets.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.responsiveMultiPlatformTargets.revise":
        return this.engine.responsiveMultiPlatformTargets.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.responsiveMultiPlatformTargets.assess":
        return this.engine.responsiveMultiPlatformTargets.assess(request.params.initiativeId)
      case "design.responsiveMultiPlatformTargets.snapshot":
        return this.engine.responsiveMultiPlatformTargets.project(request.params.initiativeId)
      case "design.manualFigmaExecutionPath.read":
        return await this.engine.manualFigmaExecutionPath.readCurrent(request.params.initiativeId) ?? null
      case "design.manualFigmaExecutionPath.create":
        return this.engine.manualFigmaExecutionPath.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.manualFigmaExecutionPath.revise":
        return this.engine.manualFigmaExecutionPath.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.manualFigmaExecutionPath.assess":
        return this.engine.manualFigmaExecutionPath.assess(request.params.initiativeId)
      case "design.manualFigmaExecutionPath.snapshot":
        return this.engine.manualFigmaExecutionPath.project(request.params.initiativeId)
      case "design.figmaMcpCapabilityDiscovery.read":
        return await this.engine.figmaMcpCapabilityDiscovery.readCurrent(request.params.initiativeId) ?? null
      case "design.figmaMcpCapabilityDiscovery.create":
        return this.engine.figmaMcpCapabilityDiscovery.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.figmaMcpCapabilityDiscovery.revise":
        return this.engine.figmaMcpCapabilityDiscovery.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.figmaMcpCapabilityDiscovery.assess":
        return this.engine.figmaMcpCapabilityDiscovery.assess(request.params.initiativeId)
      case "design.figmaMcpCapabilityDiscovery.snapshot":
        return this.engine.figmaMcpCapabilityDiscovery.project(request.params.initiativeId)
      case "design.figmaReadSnapshot.read":
        return await this.engine.figmaReadSnapshot.readCurrent(request.params.initiativeId) ?? null
      case "design.figmaReadSnapshot.create":
        return this.engine.figmaReadSnapshot.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.figmaReadSnapshot.revise":
        return this.engine.figmaReadSnapshot.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.figmaReadSnapshot.assess":
        return this.engine.figmaReadSnapshot.assess(request.params.initiativeId)
      case "design.figmaReadSnapshot.snapshot":
        return this.engine.figmaReadSnapshot.project(request.params.initiativeId)
      case "design.figmaContextImport.read":
        return await this.engine.figmaContextImport.readCurrent(request.params.initiativeId) ?? null
      case "design.figmaContextImport.create":
        return this.engine.figmaContextImport.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.figmaContextImport.revise":
        return this.engine.figmaContextImport.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.figmaContextImport.assess":
        return this.engine.figmaContextImport.assess(request.params.initiativeId)
      case "design.figmaContextImport.snapshot":
        return this.engine.figmaContextImport.project(request.params.initiativeId)
      case "design.outboundDesignBriefPackage.read":
        return await this.engine.outboundDesignBriefPackage.readCurrent(request.params.initiativeId) ?? null
      case "design.outboundDesignBriefPackage.create":
        return this.engine.outboundDesignBriefPackage.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.outboundDesignBriefPackage.revise":
        return this.engine.outboundDesignBriefPackage.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.outboundDesignBriefPackage.assess":
        return this.engine.outboundDesignBriefPackage.assess(request.params.initiativeId)
      case "design.outboundDesignBriefPackage.snapshot":
        return this.engine.outboundDesignBriefPackage.project(request.params.initiativeId)
      case "design.governedFigmaWrite.read":
        return await this.engine.governedFigmaWrite.readCurrent(request.params.initiativeId) ?? null
      case "design.governedFigmaWrite.create":
        return this.engine.governedFigmaWrite.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.governedFigmaWrite.revise":
        return this.engine.governedFigmaWrite.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.governedFigmaWrite.assess":
        return this.engine.governedFigmaWrite.assess(request.params.initiativeId)
      case "design.governedFigmaWrite.snapshot":
        return this.engine.governedFigmaWrite.project(request.params.initiativeId)
      case "design.finalizedFigmaSnapshotImport.read":
        return await this.engine.finalizedFigmaSnapshotImport.readCurrent(request.params.initiativeId) ?? null
      case "design.finalizedFigmaSnapshotImport.create":
        return this.engine.finalizedFigmaSnapshotImport.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.finalizedFigmaSnapshotImport.revise":
        return this.engine.finalizedFigmaSnapshotImport.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.finalizedFigmaSnapshotImport.assess":
        return this.engine.finalizedFigmaSnapshotImport.assess(request.params.initiativeId)
      case "design.finalizedFigmaSnapshotImport.snapshot":
        return this.engine.finalizedFigmaSnapshotImport.project(request.params.initiativeId)
      case "design.designToRequirementBinding.read":
        return await this.engine.designToRequirementBinding.readCurrent(request.params.initiativeId) ?? null
      case "design.designToRequirementBinding.create":
        return this.engine.designToRequirementBinding.create(
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.designToRequirementBinding.revise":
        return this.engine.designToRequirementBinding.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.designToRequirementBinding.assess":
        return this.engine.designToRequirementBinding.assess(request.params.initiativeId)
      case "design.designToRequirementBinding.snapshot":
        return this.engine.designToRequirementBinding.project(request.params.initiativeId)
      case "design.designerReadyGate.read":
        return await this.engine.designerReadyGate.readCurrent(request.params.initiativeId) ?? null
      case "design.designerReadyGate.create":
        return this.engine.designerReadyGate.create(request.params.record, actorId(request.params.actorId))
      case "design.designerReadyGate.revise":
        return this.engine.designerReadyGate.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.designerReadyGate.assess":
        return this.engine.designerReadyGate.assess(request.params.initiativeId)
      case "design.designerReadyGate.snapshot":
        return this.engine.designerReadyGate.project(request.params.initiativeId)
      case "design.designDelta.read":
        return await this.engine.designDelta.readCurrent(request.params.initiativeId) ?? null
      case "design.designDelta.create":
        return this.engine.designDelta.create(request.params.record, actorId(request.params.actorId))
      case "design.designDelta.revise":
        return this.engine.designDelta.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.designDelta.assess":
        return this.engine.designDelta.assess(request.params.initiativeId)
      case "design.designDelta.snapshot":
        return this.engine.designDelta.project(request.params.initiativeId)
      case "design.designConflictResolution.read":
        return await this.engine.designConflictResolution.readCurrent(request.params.initiativeId) ?? null
      case "design.designConflictResolution.create":
        return this.engine.designConflictResolution.create(request.params.record, actorId(request.params.actorId))
      case "design.designConflictResolution.revise":
        return this.engine.designConflictResolution.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.designConflictResolution.assess":
        return this.engine.designConflictResolution.assess(request.params.initiativeId)
      case "design.designConflictResolution.snapshot":
        return this.engine.designConflictResolution.project(request.params.initiativeId)
      case "design.humanDesignApproval.read":
        return await this.engine.humanDesignApproval.readCurrent(request.params.initiativeId) ?? null
      case "design.humanDesignApproval.create":
        return this.engine.humanDesignApproval.create(request.params.record, actorId(request.params.actorId))
      case "design.humanDesignApproval.revise":
        return this.engine.humanDesignApproval.revise(
          request.params.recordId,
          request.params.expectedRevision,
          request.params.record,
          actorId(request.params.actorId),
        )
      case "design.humanDesignApproval.assess":
        return this.engine.humanDesignApproval.assess(request.params.initiativeId)
      case "design.humanDesignApproval.snapshot":
        return this.engine.humanDesignApproval.project(request.params.initiativeId)
      case "productStudio.portableDesign.import": {
        let product: Awaited<ReturnType<GaepEngine["readProduct"]>>
        try {
          product = await this.engine.readProduct()
        } catch {
          throw portableDesignProductContextError()
        }
        if (
          product.id.toLowerCase() !== request.params.expectedProductId.toLowerCase()
          || (product.revision ?? 1) !== request.params.expectedProductRevision
        ) {
          throw portableDesignProductContextError()
        }
        try {
          const snapshot = await this.engine.productStudio.importPortableDesignSnapshot({
            bundleRoot: request.params.bundleRoot,
            expectedProductId: request.params.expectedProductId,
            expectedProductRevision: request.params.expectedProductRevision,
          }, request.params.actorId)
          return portableDesignSnapshotDto(snapshot)
        } catch (error) {
          throw portableDesignRpcError("import", error)
        }
      }
      case "productStudio.portableDesign.list":
        try {
          return portableDesignSnapshotPageDto(
            await this.engine.productStudio.listPortableDesignSnapshots(request.params),
          )
        } catch (error) {
          throw portableDesignRpcError("list", error)
        }
      case "productStudio.portableDesign.read":
        try {
          return portableDesignSnapshotDto(
            await this.engine.productStudio.readPortableDesignSnapshot(request.params.bundleId),
          )
        } catch (error) {
          throw portableDesignRpcError("read", error)
        }
    }
  }

  private async refreshCapabilitySnapshots(): Promise<AdapterCapabilities[]> {
    const observed = await Promise.all([...this.engine.adapters.keys()].map((adapterId) => this.observeAdapter(adapterId)))
    return observed.map((snapshot) => structuredClone(snapshot.capabilities))
  }

  private boundCapabilitySnapshots(
    expected: Array<{ adapterId: string; agentId: string; capabilityDigest: string }>,
  ): AdapterCapabilities[] {
    if (expected.length !== this.engine.adapters.size ||
        [...this.engine.adapters.keys()].some((adapterId) => !expected.some((binding) => binding.adapterId === adapterId))) {
      throw new AgentModelCapabilityBindingError()
    }
    return expected.map((binding) => {
      const snapshot = this.capabilitySnapshots.get(binding.adapterId)
      if (!snapshot || snapshot.capabilities.agentId !== binding.agentId ||
          capabilityDigest(snapshot.capabilities) !== binding.capabilityDigest) {
        throw new AgentModelCapabilityBindingError()
      }
      return structuredClone(snapshot.capabilities)
    })
  }

  private managedEvidenceReaders() {
    return {
      readResult: (id: string) => this.engine.readManagedRunResult(id),
      readEvidence: (id: string) => this.engine.readManagedRunEvidence(id),
      readApplyDecision: (id: string) => this.engine.readManagedApplyDecision(id),
    }
  }

  private async readManagedReviewPreview(managedRunId: string): Promise<ManagedReviewPreviewDto> {
    const audit = await this.engine.repository.verifyAudit()
    if (!audit.valid) {
      throw new HostRpcError(
        -32_028,
        "MANAGED_REVIEW_AUDIT_INVALID",
        "Managed Run review is unavailable because the governed audit chain is invalid",
      )
    }
    try {
      let status
      try {
        status = await this.engine.readPendingManagedReviewStatus(managedRunId)
      } catch {
        // A failed durable-stage claim is deliberately retried once so the
        // engine can expose its persisted discard-only recovery boundary.
        status = await this.engine.readPendingManagedReviewStatus(managedRunId)
      }
      const record = await this.engine.readManagedRun(managedRunId)
      return await managedReviewPreviewDto(record, status, this.managedEvidenceReaders())
    } catch {
      throw new HostRpcError(
        -32_036,
        "MANAGED_REVIEW_INVALID",
        "GAEP could not verify an exact pending Managed Run review",
      )
    }
  }

  private assertCurrentManagedReview(
    preview: ManagedReviewPreviewDto,
    expectedRevision: number,
    expectedPreviewDigest: string,
  ): void {
    if (preview.managedRunRevision !== expectedRevision || preview.previewDigest !== expectedPreviewDigest) {
      throw new HostRpcError(
        -32_029,
        "MANAGED_REVIEW_CHANGED",
        "The Managed Run review changed before the decision; open and review the current exact inventory",
      )
    }
  }

  private async assertManagedReviewTransitionIntegrity(record: { readonly id: string }): Promise<void> {
    const [audit, persisted] = await Promise.all([
      this.engine.repository.verifyAudit(),
      this.engine.readManagedRun(record.id),
    ])
    if (!audit.valid) {
      throw new HostRpcError(
        -32_028,
        "MANAGED_REVIEW_AUDIT_INVALID",
        "Managed Run review is unavailable because the governed audit chain is invalid",
      )
    }
    if (canonicalDigest(persisted) !== canonicalDigest(record)) {
      throw new HostRpcError(
        -32_029,
        "MANAGED_REVIEW_CHANGED",
        "The Managed Run changed while its review decision was being verified",
      )
    }
  }

  private async observeAdapter(adapterId: string): Promise<CapabilitySnapshot> {
    const adapter = this.engine.adapters.get(adapterId)
    if (!adapter) {
      throw new HostRpcError(-32_011, "CAPABILITIES_NOT_AVAILABLE", "No host-observed capabilities exist for the requested adapter")
    }
    const probed = await adapter.probe({ refreshModels: true })
    const snapshot = await this.validateProbeResult(probed)
    this.capabilitySnapshots.set(adapterId, snapshot)
    return snapshot
  }

  private async validateProbeResult(probed: AdapterProbeResult): Promise<CapabilitySnapshot> {
    const capabilities = adapterCapabilitiesSnapshotSchema.parse(probed.capabilities)
    const rawBinding = probed.runtimeBinding
    if (
      !rawBinding
      || rawBinding.scope !== "machine-local"
      || rawBinding.adapterId !== capabilities.adapterId
      || rawBinding.agentId !== capabilities.agentId
    ) {
      throw new HostRpcError(-32_010, "INVALID_CAPABILITY_SNAPSHOT", "Agent runtime binding identity is invalid")
    }
    let runtimeBinding: AdapterRuntimeBinding
    if (rawBinding.kind === "executable") {
      let current: ExecutableFingerprint
      try {
        current = await fingerprintExecutable(rawBinding.executablePath, rawBinding.executableFingerprint.requested)
      } catch {
        throw new HostRpcError(-32_013, "EXECUTABLE_UNAVAILABLE", "The observed agent executable is unavailable")
      }
      if (!sameExecutable(current, rawBinding.executableFingerprint)) {
        throw new HostRpcError(
          -32_014,
          "EXECUTABLE_CHANGED",
          "The observed agent executable changed during capability discovery",
        )
      }
      runtimeBinding = { ...rawBinding, executablePath: current.canonicalPath, executableFingerprint: current }
    } else if (rawBinding.kind === "managed-in-process") {
      if (!rawBinding.runtimeId.trim()) {
        throw new HostRpcError(-32_010, "INVALID_CAPABILITY_SNAPSHOT", "Managed runtime identity is invalid")
      }
      runtimeBinding = structuredClone(rawBinding)
    } else if (rawBinding.kind === "unavailable") {
      runtimeBinding = structuredClone(rawBinding)
    } else {
      throw new HostRpcError(-32_010, "INVALID_CAPABILITY_SNAPSHOT", "Agent runtime binding kind is invalid")
    }
    if (capabilities.detected && runtimeBinding.kind === "unavailable") {
      throw new HostRpcError(-32_010, "INVALID_CAPABILITY_SNAPSHOT", "Detected agent has no usable local runtime binding")
    }
    return { capabilities: structuredClone(capabilities), runtimeBinding }
  }

  static parse(line: string): EngineHostRequest {
    let raw: unknown
    try {
      raw = JSON.parse(line)
    } catch {
      throw new HostRpcError(-32_700, "PARSE_ERROR", "Invalid JSON")
    }
    return EngineHost.validateRequest(raw)
  }

  static validateRequest(rawRequest: unknown): EngineHostRequest {
    let serialized: string
    try {
      serialized = JSON.stringify(rawRequest)
    } catch {
      throw new HostRpcError(-32_600, "INVALID_REQUEST", "Invalid JSON-RPC 2.0 request")
    }
    if (Buffer.byteLength(serialized) > MAX_RPC_FRAME_BYTES) {
      throw new HostRpcError(-32_001, "FRAME_TOO_LARGE", "JSON-RPC request exceeds the configured byte limit")
    }

    let envelope: z.infer<typeof requestEnvelopeSchema>
    try {
      envelope = requestEnvelopeSchema.parse(rawRequest)
    } catch (error) {
      throw new HostRpcError(
        -32_600,
        "INVALID_REQUEST",
        "Invalid JSON-RPC 2.0 request",
        error instanceof ZodError
          ? { issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }
          : undefined,
      )
    }
    if (isPortableDesignHostMethod(envelope.method)) {
      return parsePortableDesignHostRequest(envelope)
    }
    if (!hostMethodSchema.safeParse(envelope.method).success) {
      throw new HostRpcError(-32_601, "METHOD_NOT_FOUND", "Unknown GAEP engine method")
    }
    try {
      return hostRequestSchema.parse(envelope)
    } catch (error) {
      if (error instanceof ZodError && error.issues.every((issue) => issue.path[0] === "params")) {
        throw invalidParamsError(error)
      }
      throw new HostRpcError(-32_600, "INVALID_REQUEST", "Invalid JSON-RPC 2.0 request")
    }
  }
}
