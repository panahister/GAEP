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
  DashboardProductBindingError,
  GaepEngine,
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
  "dashboard.changeImpact.changes",
  "dashboard.changeImpact",
  "dashboard.agentModel",
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
