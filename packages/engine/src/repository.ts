import { randomUUID } from "node:crypto"
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  type FileHandle,
} from "node:fs/promises"
import { hostname } from "node:os"
import { dirname, isAbsolute, relative, resolve as resolvePath, sep } from "node:path"

import {
  architectureRecordSchema,
  authorizationModelSchema,
  auditCheckpointSchema,
  auditEventSchema,
  businessArchitectureBaselineSchema,
  boundedContextModelSchema,
  securityPrivacyAssessmentSchema,
  processModelSchema,
  dataModelSchema,
  businessCapabilityMapSchema,
  businessRuleCatalogSchema,
  businessUnderstandingSchema,
  changeSchema,
  contextPackSchema,
  decisionSchema,
  evidenceRecordSchema,
  executionCharterSchema,
  governedStateSchema,
  handoffSchema,
  instructionPrivilegeGrantSchema,
  initiativeSchema,
  managedApplyDecisionReceiptSchema,
  managedRunEvidenceSchema,
  managedRunRecordSchema,
  managedRunResultSchema,
  outcomeModelSchema,
  operatingModelSchema,
  productSchema,
  productDesignRevisionSchema,
  productRevisionSchema,
  productRecordRevisionSchema,
  repositoryManifestSchema,
  repositoryTransactionBodySchema,
  repositoryTransactionSchema,
  runSchema,
  sourceBaselineSchema,
  sourceProvenanceSchema,
  systemSolutionArchitectureSchema,
  sourceRecordRevisionSchema,
  sourceRecordSchema,
  stakeholderModelSchema,
  valueStreamModelSchema,
  requirementSchema,
  riskSchema,
  runToolSelectionSchema,
  traceLinkSchema,
  toolDefinitionSchema,
  workflowPlanSchema,
  workItemSchema,
  workspaceHealthSchema,
  type AuditCheckpoint,
  type AuditEvent,
  type GovernedState,
  type RepositoryManifest,
  type RepositoryTransaction,
  type WorkspaceHealth,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import {
  canonicalDigest,
  parseAdapterCapabilitiesCompatibility,
  parseAgentSelectionCompatibility,
  type AdapterCapabilitiesCompatibilityResult,
  type AgentSelectionCompatibilityResult,
} from "@gaep/agent-sdk"
import { portableDesignImportResultSchema } from "@gaep/design-import"
import type { ZodType } from "zod"

const directoryNames = [
  "profiles",
  "design-revisions",
  "product-history",
  "record-history",
  "sources",
  "source-history",
  "source-baselines",
  "source-baseline-history",
  "source-provenance",
  "business-understanding",
  "business-understanding-history",
  "business-capability-maps",
  "business-capability-map-history",
  "value-stream-models",
  "value-stream-model-history",
  "operating-models",
  "operating-model-history",
  "business-rule-catalogs",
  "business-rule-catalog-history",
  "business-architecture-baselines",
  "business-architecture-baseline-history",
  "system-solution-architectures",
  "system-solution-architecture-history",
  "bounded-context-models",
  "bounded-context-model-history",
  "security-privacy-assessments",
  "security-privacy-assessment-history",
  "process-models",
  "process-model-history",
  "data-models",
  "data-model-history",
  "authorization-models",
  "authorization-model-history",
  "stakeholder-models",
  "stakeholder-model-history",
  "outcome-models",
  "outcome-model-history",
  "initiatives",
  "changes",
  "work-items",
  "decisions",
  "requirements",
  "architecture",
  "risks",
  "evidence",
  "candidates",
  "sessions",
  "handoffs",
  "trace",
  "context-packs",
  "instruction-grants",
  "workflow-plans",
  "tools",
  "tool-selections",
  "exports",
  "audit",
  "policies",
  "runtime",
] as const

const localHostname = hostname()

export type RepositoryFaultPoint =
  | "after-journal"
  | "after-record-writes"
  | "after-audit-append"
  | "after-state-write"
  | "after-checkpoint-write"

export interface MutationWrite<T = unknown> {
  path: string
  value: T
  schema: ZodType<T>
  governed: boolean
}

export interface MutationAuditInput {
  eventType: string
  actor: AuditEvent["actor"]
  subjectId?: string
  payload?: Record<string, unknown>
}

export interface GaepRepositoryOptions {
  lockLeaseMs?: number
  faultInjector?: (point: RepositoryFaultPoint) => void | Promise<void>
}

interface AuditVerification {
  valid: boolean
  events: number
  error?: string
  warning?: string
  headHash?: string | null
}

interface LockLease {
  token: string
  pid: number
  hostname: string
  acquiredAt: string
  heartbeatAt: string
}

interface LockInspection {
  present: boolean
  stale: boolean
  malformed?: boolean
  lease?: LockLease
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code
}

function parseLockLease(value: unknown): LockLease | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.token !== "string" ||
    typeof candidate.pid !== "number" ||
    !Number.isInteger(candidate.pid) ||
    candidate.pid <= 0 ||
    typeof candidate.hostname !== "string" ||
    typeof candidate.acquiredAt !== "string" ||
    typeof candidate.heartbeatAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.acquiredAt)) ||
    !Number.isFinite(Date.parse(candidate.heartbeatAt))
  ) return undefined
  return candidate as unknown as LockLease
}

export class GaepRepository {
  readonly root: string
  readonly workspacePath: string
  private readonly lockLeaseMs: number
  private readonly faultInjector?: (point: RepositoryFaultPoint) => void | Promise<void>
  private activeLockToken?: string

  constructor(
    workspacePath: string,
    options: GaepRepositoryOptions = {},
  ) {
    this.workspacePath = resolvePath(workspacePath)
    this.root = resolvePath(this.workspacePath, ".gaep")
    this.lockLeaseMs = options.lockLeaseMs ?? 300_000
    this.faultInjector = options.faultInjector
  }

  resolve(...segments: string[]): string {
    if (segments.some((segment) => isAbsolute(segment))) {
      throw new Error("GAEP repository paths must be relative to the workspace")
    }
    const candidate = resolvePath(this.root, ...segments)
    this.assertContained(candidate)
    return candidate
  }

  async prepareLayout(): Promise<void> {
    await this.assertSafePath(this.root)
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    for (const directory of directoryNames) {
      const path = this.resolve(directory)
      await this.assertSafePath(path)
      await mkdir(path, { recursive: true, mode: 0o700 })
    }
  }

  async assertCanCreateProduct(): Promise<void> {
    const manifestExists = await this.exists(this.resolve("manifest.json"))
    const productExists = await this.exists(this.resolve("product.json"))
    if (manifestExists || productExists) {
      throw new Error("A GAEP Product is already initialized in this workspace; Product identity cannot be replaced")
    }
  }

  createManifest(productId: string, engineVersion = "0.1.0"): RepositoryManifest {
    return repositoryManifestSchema.parse({
      format: "gaep-project",
      schemaVersion: 1,
      productId,
      createdAt: new Date().toISOString(),
      engineVersion,
      auditCheckpointRequired: true,
      governedStateRequired: true,
    })
  }

  async readJson<T>(path: string, schema: ZodType<T>): Promise<T> {
    await this.recoverIfNeeded()
    return this.readJsonUnlocked(path, schema)
  }

  async readAgentSelectionCompatibility(): Promise<AgentSelectionCompatibilityResult> {
    await this.recoverIfNeeded()
    return this.readAgentSelectionCompatibilityUnlocked()
  }

  async readAdapterCapabilitiesCompatibility(path: string): Promise<AdapterCapabilitiesCompatibilityResult> {
    await this.recoverIfNeeded()
    return this.readAdapterCapabilitiesCompatibilityUnlocked(path)
  }

  async readDirectory(path: string): Promise<string[]> {
    await this.recoverIfNeeded()
    await this.assertSafePath(path)
    return readdir(path)
  }

  async writeLocalJson<T>(path: string, value: T, schema: ZodType<T>): Promise<T> {
    if (!this.activeLockToken) {
      throw new Error("Local repository writes require the owned GAEP workspace lock")
    }
    const validated = schema.parse(value)
    await this.writeJsonAtomic(path, validated, schema)
    return validated
  }

  async commitMutation(input: {
    writes: MutationWrite[]
    audit: MutationAuditInput
    initialization?: boolean
  }): Promise<AuditEvent> {
    if (!this.activeLockToken) {
      throw new Error("Repository mutations require the owned GAEP workspace lock")
    }
    if (input.writes.length === 0) throw new Error("A repository transaction requires at least one write")
    if (await this.exists(this.transactionPath())) {
      throw new Error("A pending GAEP transaction must be recovered before creating another transaction")
    }
    const initialization = input.initialization === true
    const verification = await this.verifyAuditUnlocked()
    if (!initialization && !verification.valid) {
      throw new Error(`GAEP workspace integrity is invalid; refusing mutation: ${verification.error ?? "unknown error"}`)
    }
    if (initialization) {
      if (verification.events !== 0 || (await this.listGovernedPaths()).length > 0) {
        throw new Error("Initialization requires an empty GAEP workspace")
      }
    }

    const transactionId = randomUUID()
    const createdAt = new Date().toISOString()
    const writes = input.writes.map((write) => {
      const relativePath = this.toRelativePath(write.path)
      const validated = write.schema.parse(write.value)
      const content = `${JSON.stringify(validated, null, 2)}\n`
      return {
        relativePath,
        content,
        contentDigest: canonicalDigest(validated),
        governed: write.governed,
      }
    })
    if (new Set(writes.map((write) => write.relativePath)).size !== writes.length) {
      throw new Error("A repository transaction cannot write the same path twice")
    }

    const currentState = await this.loadGovernedState(initialization)
    const auditSequence = verification.events + 1
    const nextRecords = { ...currentState.records }
    for (const write of writes.filter((candidate) => candidate.governed)) {
      const parsed = JSON.parse(write.content) as Record<string, unknown>
      nextRecords[write.relativePath] = {
        digest: write.contentDigest,
        revision: typeof parsed.revision === "number" ? parsed.revision : undefined,
        transactionId,
        auditSequence,
      }
    }
    const governedState = governedStateSchema.parse({
      schemaVersion: 1,
      updatedAt: createdAt,
      records: nextRecords,
    })
    const stateDigest = canonicalDigest(governedState)
    const recordChanges = writes.filter((write) => write.governed).map((write) => ({
      path: write.relativePath,
      digest: write.contentDigest,
    }))
    const unsignedEvent = {
      schemaVersion: 1 as const,
      id: randomUUID(),
      sequence: auditSequence,
      eventType: input.audit.eventType,
      occurredAt: createdAt,
      actor: input.audit.actor,
      subjectId: input.audit.subjectId,
      payload: {
        ...(input.audit.payload ?? {}),
        transactionId,
        stateDigest,
        recordChanges,
      },
      previousHash: verification.headHash ?? null,
    }
    const auditEvent = auditEventSchema.parse({ ...unsignedEvent, hash: canonicalDigest(unsignedEvent) })
    const checkpoint = auditCheckpointSchema.parse({
      schemaVersion: 1,
      eventCount: auditEvent.sequence,
      headHash: auditEvent.hash,
      stateDigest,
      updatedAt: createdAt,
    })
    const body = repositoryTransactionBodySchema.parse({
      schemaVersion: 1,
      id: transactionId,
      createdAt,
      writes,
      auditEvent,
      checkpoint,
      governedState,
    })
    const transaction = repositoryTransactionSchema.parse({ ...body, hash: canonicalDigest(body) })
    await this.writeJsonAtomic(this.transactionPath(), transaction, repositoryTransactionSchema)
    await this.injectFault("after-journal")
    await this.applyTransaction(transaction, true)
    return auditEvent
  }

  async recoverIfNeeded(): Promise<boolean> {
    if (!(await this.exists(this.transactionPath()))) return false
    await this.withLock(async () => undefined)
    return true
  }

  async verifyAudit(): Promise<{ valid: boolean; events: number; error?: string; warning?: string }> {
    try {
      await this.recoverIfNeeded()
    } catch (error) {
      return {
        valid: false,
        events: 0,
        error: error instanceof Error ? `Transaction recovery failed: ${error.message}` : "Transaction recovery failed",
      }
    }
    const result = await this.verifyAuditUnlocked()
    const { headHash: _headHash, ...publicResult } = result
    return publicResult
  }

  async workspaceHealth(): Promise<WorkspaceHealth> {
    const issues: WorkspaceHealthIssue[] = []
    try {
      await this.recoverIfNeeded()
    } catch (error) {
      issues.push({
        code: "workspace.transaction-recovery-failed",
        severity: "error",
        message: error instanceof Error ? error.message : "A pending transaction could not be recovered.",
      })
    }

    const manifestPath = this.resolve("manifest.json")
    const productPath = this.resolve("product.json")
    const manifestExists = await this.exists(manifestPath)
    const productExists = await this.exists(productPath)
    let productId: string | undefined

    if (manifestExists !== productExists) {
      issues.push({
        code: manifestExists ? "workspace.product-missing" : "workspace.manifest-missing",
        severity: "error",
        message: manifestExists
          ? "The GAEP manifest exists but product.json is missing."
          : "product.json exists but the GAEP manifest is missing.",
      })
    }

    if (manifestExists) {
      try {
        const manifest = await this.readJsonUnlocked(manifestPath, repositoryManifestSchema)
        productId = manifest.productId
        if (productExists) {
          const product = await this.readJsonUnlocked(productPath, productSchema)
          if (product.id !== manifest.productId) {
            issues.push({
              code: "workspace.product-id-mismatch",
              severity: "error",
              message: "The manifest and Product record identify different Products.",
            })
          }
        }
      } catch (error) {
        issues.push({
          code: "workspace.invalid-record",
          severity: "error",
          message: error instanceof Error ? error.message : "A workspace identity record is invalid.",
        })
      }
    }

    const auditResult = await this.verifyAuditUnlocked()
    const { headHash: _headHash, ...audit } = auditResult
    if (!audit.valid) {
      issues.push({
        code: "workspace.audit-invalid",
        severity: "error",
        message: audit.error ?? "The audit and governed-state chain is invalid.",
      })
    } else if (audit.warning) {
      issues.push({
        code: "workspace.audit-checkpoint-missing",
        severity: "warning",
        message: audit.warning,
      })
    }

    if (await this.exists(this.resolve("runtime", "selection.json"))) {
      try {
        const compatibility = await this.readAgentSelectionCompatibilityUnlocked()
        if (compatibility.status === "migration-required") {
          issues.push({
            code: "workspace.agent-selection-migration-required",
            severity: "warning",
            message: "The persisted Agent Selection uses a legacy machine-local executable field and requires explicit re-probe and reconfirmation.",
          })
        } else if (compatibility.status === "invalid") {
          issues.push({
            code: "workspace.agent-selection-invalid",
            severity: "error",
            message: `The persisted Agent Selection is invalid: ${compatibility.issues.join("; ")}`,
          })
        }
      } catch (error) {
        issues.push({
          code: "workspace.agent-selection-invalid",
          severity: "error",
          message: error instanceof Error ? error.message : "The persisted Agent Selection cannot be parsed.",
        })
      }
    }
    let capabilityNames: string[] = []
    try {
      capabilityNames = (await readdir(this.resolve("runtime")))
        .filter((name) => /^capabilities-[0-9a-f]{64}\.json$/.test(name))
    } catch (error) {
      if (!hasCode(error, "ENOENT")) throw error
    }
    for (const name of capabilityNames) {
      try {
        const compatibility = await this.readAdapterCapabilitiesCompatibilityUnlocked(this.resolve("runtime", name))
        if (compatibility.status === "migration-required") {
          issues.push({
            code: "workspace.agent-capabilities-migration-required",
            severity: "warning",
            message: `The persisted capability snapshot ${name} contains a legacy machine-local executable and requires explicit migration.`,
          })
        } else if (compatibility.status === "invalid") {
          issues.push({
            code: "workspace.agent-capabilities-invalid",
            severity: "error",
            message: `The persisted capability snapshot ${name} is invalid: ${compatibility.issues.join("; ")}`,
          })
        }
      } catch (error) {
        issues.push({
          code: "workspace.agent-capabilities-invalid",
          severity: "error",
          message: error instanceof Error
            ? `The persisted capability snapshot ${name} cannot be parsed: ${error.message}`
            : `The persisted capability snapshot ${name} cannot be parsed.`,
        })
      }
    }

    const lock = await this.inspectLock()
    if (lock.malformed) {
      issues.push({
        code: "workspace.lock-invalid",
        severity: lock.stale ? "warning" : "error",
        message: lock.stale
          ? "A malformed stale engine lock can be recovered by the next operation."
          : "The engine lock is malformed but still inside its safety lease.",
      })
    } else if (lock.stale) {
      issues.push({
        code: "workspace.lock-stale",
        severity: "warning",
        message: "A stale engine lock can be recovered by the next operation.",
      })
    }

    const initialized = manifestExists || productExists
    const hasErrors = issues.some((issue) => issue.severity === "error")
    const status = !initialized
      ? "uninitialized"
      : hasErrors
        ? "invalid"
        : issues.length > 0
          ? "degraded"
          : "healthy"
    return workspaceHealthSchema.parse({
      status,
      initialized,
      productId,
      audit,
      lock: { present: lock.present, stale: lock.stale },
      issues,
    })
  }

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const lockPath = this.resolve("runtime", "engine.lock")
    await this.assertSafePath(lockPath)
    await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 })
    const token = randomUUID()
    const lock = await this.acquireLock(lockPath, token)
    this.activeLockToken = token
    let heartbeatChain = Promise.resolve()
    const heartbeatInterval = Math.max(10, Math.floor(this.lockLeaseMs / 3))
    const heartbeat = setInterval(() => {
      heartbeatChain = heartbeatChain
        .catch(() => undefined)
        .then(() => this.refreshLock(lockPath, token, lock))
    }, heartbeatInterval)
    heartbeat.unref()
    try {
      await this.recoverPendingTransactionUnlocked()
      return await operation()
    } finally {
      clearInterval(heartbeat)
      await heartbeatChain.catch(() => undefined)
      this.activeLockToken = undefined
      try {
        await lock.close()
      } finally {
        await this.removeOwnedLock(lockPath, token)
      }
    }
  }

  private async readJsonUnlocked<T>(path: string, schema: ZodType<T>): Promise<T> {
    const value = await this.readRawJsonUnlocked(path)
    const schemaIdentity = schema as unknown
    if ((schemaIdentity === managedRunRecordSchema as unknown || schemaIdentity === managedRunEvidenceSchema as unknown) &&
        value !== null && typeof value === "object" &&
        (value as { schemaVersion?: unknown }).schemaVersion === 1) {
      throw new Error(
        "Legacy Managed Execution schemaVersion 1 requires an explicit evidence-preserving migration before this GAEP version can open it; automatic semantic inference is forbidden",
      )
    }
    return schema.parse(value)
  }

  private async readRawJsonUnlocked(path: string): Promise<unknown> {
    await this.assertSafePath(path)
    const text = await readFile(path, "utf8")
    return JSON.parse(text)
  }

  private async readAgentSelectionCompatibilityUnlocked(): Promise<AgentSelectionCompatibilityResult> {
    return parseAgentSelectionCompatibility(
      await this.readRawJsonUnlocked(this.resolve("runtime", "selection.json")),
    )
  }

  private async readAdapterCapabilitiesCompatibilityUnlocked(
    path: string,
  ): Promise<AdapterCapabilitiesCompatibilityResult> {
    return parseAdapterCapabilitiesCompatibility(await this.readRawJsonUnlocked(path))
  }

  private async writeJsonAtomic<T>(path: string, value: T, schema: ZodType<T>): Promise<void> {
    const validated = schema.parse(value)
    await this.writeContentAtomic(path, `${JSON.stringify(validated, null, 2)}\n`)
  }

  private async writeContentAtomic(path: string, content: string): Promise<void> {
    this.assertContained(path)
    await this.assertSafePath(path)
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
    const handle = await open(temporaryPath, "wx", 0o600)
    try {
      await handle.writeFile(content, "utf8")
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      await rename(temporaryPath, path)
      await this.syncDirectory(dirname(path))
    } catch (error) {
      await rm(temporaryPath, { force: true })
      throw error
    }
  }

  private async applyTransaction(transaction: RepositoryTransaction, injectFault: boolean): Promise<void> {
    const { hash, ...body } = transaction
    if (canonicalDigest(body) !== hash) throw new Error("Pending repository transaction hash is invalid")
    for (const write of transaction.writes) {
      const parsed = JSON.parse(write.content)
      if (canonicalDigest(parsed) !== write.contentDigest) {
        throw new Error(`Pending transaction content digest is invalid for ${write.relativePath}`)
      }
      await this.writeContentAtomic(this.fromRelativePath(write.relativePath), write.content)
    }
    if (injectFault) await this.injectFault("after-record-writes")
    await this.appendExactAuditEvent(transaction.auditEvent)
    if (injectFault) await this.injectFault("after-audit-append")
    await this.writeJsonAtomic(this.statePath(), transaction.governedState, governedStateSchema)
    if (injectFault) await this.injectFault("after-state-write")
    await this.writeJsonAtomic(this.checkpointPath(), transaction.checkpoint, auditCheckpointSchema)
    if (injectFault) await this.injectFault("after-checkpoint-write")
    await rm(this.transactionPath(), { force: true })
    await this.syncDirectory(dirname(this.transactionPath()))
  }

  private async recoverPendingTransactionUnlocked(): Promise<void> {
    if (!(await this.exists(this.transactionPath()))) return
    const transaction = await this.readJsonUnlocked(this.transactionPath(), repositoryTransactionSchema)
    await this.applyTransaction(transaction, false)
  }

  private async appendExactAuditEvent(event: AuditEvent): Promise<void> {
    const events = await this.loadAuditEvents()
    if (events.length === event.sequence) {
      if (events.at(-1)?.hash !== event.hash) {
        throw new Error("Pending transaction conflicts with the committed audit event")
      }
      return
    }
    if (events.length !== event.sequence - 1) {
      throw new Error("Pending transaction audit sequence cannot be recovered deterministically")
    }
    if ((events.at(-1)?.hash ?? null) !== event.previousHash) {
      throw new Error("Pending transaction audit predecessor does not match")
    }
    const path = this.auditPath()
    await this.assertSafePath(path)
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const handle = await open(path, "a", 0o600)
    try {
      await handle.write(`${JSON.stringify(event)}\n`)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await this.syncDirectory(dirname(path))
  }

  private async verifyAuditUnlocked(): Promise<AuditVerification> {
    const manifestExists = await this.exists(this.resolve("manifest.json"))
    let manifest: RepositoryManifest | undefined
    if (manifestExists) {
      try {
        manifest = await this.readJsonUnlocked(this.resolve("manifest.json"), repositoryManifestSchema)
      } catch (error) {
        return {
          valid: false,
          events: 0,
          error: error instanceof Error ? `Cannot read integrity policy: ${error.message}` : "Cannot read integrity policy",
        }
      }
    }

    let events: AuditEvent[]
    try {
      events = await this.loadAuditEvents()
    } catch (error) {
      return { valid: false, events: 0, error: error instanceof Error ? error.message : "Invalid audit event" }
    }
    if (manifestExists && events.length === 0) {
      return { valid: false, events: 0, error: "Audit log is missing or empty in an initialized workspace" }
    }

    let checkpoint: AuditCheckpoint | undefined
    try {
      checkpoint = await this.readJsonUnlocked(this.checkpointPath(), auditCheckpointSchema)
    } catch (error) {
      if (!hasCode(error, "ENOENT")) {
        return {
          valid: false,
          events: events.length,
          error: error instanceof Error ? `Invalid audit checkpoint: ${error.message}` : "Invalid audit checkpoint",
        }
      }
    }
    const headHash = events.at(-1)?.hash ?? null
    if (checkpoint) {
      if (checkpoint.eventCount !== events.length) {
        return { valid: false, events: events.length, error: "Audit event count does not match its checkpoint" }
      }
      if (checkpoint.headHash !== headHash) {
        return { valid: false, events: events.length, error: "Audit head does not match its checkpoint" }
      }
    } else if (manifest?.auditCheckpointRequired || events.length > 0) {
      return { valid: false, events: events.length, error: "Required audit checkpoint is missing" }
    }

    const governedPaths = await this.listGovernedPaths()
    let governedState: GovernedState | undefined
    try {
      governedState = await this.readJsonUnlocked(this.statePath(), governedStateSchema)
    } catch (error) {
      if (!hasCode(error, "ENOENT")) {
        return {
          valid: false,
          events: events.length,
          error: error instanceof Error ? `Invalid governed state: ${error.message}` : "Invalid governed state",
        }
      }
    }
    if (!governedState && (manifest?.governedStateRequired || governedPaths.length > 0)) {
      return {
        valid: false,
        events: events.length,
        error: "Governed record digest index is missing; explicit reconciliation is required",
      }
    }
    if (governedState) {
      const stateDigest = canonicalDigest(governedState)
      if (checkpoint?.stateDigest !== stateDigest) {
        return { valid: false, events: events.length, error: "Governed state does not match the audit checkpoint" }
      }
      if (events.at(-1)?.payload.stateDigest !== stateDigest) {
        return { valid: false, events: events.length, error: "Governed state does not match the latest audit event" }
      }
      const indexedPaths = Object.keys(governedState.records).sort()
      if (JSON.stringify(indexedPaths) !== JSON.stringify(governedPaths)) {
        return { valid: false, events: events.length, error: "Governed record inventory differs from the committed index" }
      }
      for (const relativePath of governedPaths) {
        try {
          const value = await this.readGovernedRecord(relativePath)
          if (canonicalDigest(value) !== governedState.records[relativePath]!.digest) {
            return {
              valid: false,
              events: events.length,
              error: `Governed record ${relativePath} differs from its committed digest`,
            }
          }
        } catch (error) {
          return {
            valid: false,
            events: events.length,
            error: error instanceof Error
              ? `Governed record ${relativePath} is invalid: ${error.message}`
              : `Governed record ${relativePath} is invalid`,
          }
        }
      }
    }
    return { valid: true, events: events.length, headHash }
  }

  private async loadAuditEvents(): Promise<AuditEvent[]> {
    let lines: string[]
    try {
      const path = this.auditPath()
      await this.assertSafePath(path)
      lines = (await readFile(path, "utf8")).trim().split("\n").filter(Boolean)
    } catch (error) {
      if (hasCode(error, "ENOENT")) return []
      throw error
    }
    const events: AuditEvent[] = []
    let previousHash: string | null = null
    for (let index = 0; index < lines.length; index += 1) {
      const event = auditEventSchema.parse(JSON.parse(lines[index]!))
      const { hash, ...unsigned } = event
      if (event.sequence !== index + 1) throw new Error("Sequence gap")
      if (event.previousHash !== previousHash) throw new Error("Previous hash mismatch")
      if (canonicalDigest(unsigned) !== hash) throw new Error("Event hash mismatch")
      events.push(event)
      previousHash = hash
    }
    return events
  }

  private async loadGovernedState(initialization: boolean): Promise<GovernedState> {
    try {
      return await this.readJsonUnlocked(this.statePath(), governedStateSchema)
    } catch (error) {
      if (!hasCode(error, "ENOENT")) throw error
      if (!initialization && (await this.listGovernedPaths()).length > 0) {
        throw new Error("Governed record digest index is missing; explicit reconciliation is required")
      }
      return { schemaVersion: 1, updatedAt: new Date(0).toISOString(), records: {} }
    }
  }

  private async listGovernedPaths(): Promise<string[]> {
    const paths: string[] = []
    if (await this.exists(this.resolve("manifest.json"))) paths.push("manifest.json")
    if (await this.exists(this.resolve("product.json"))) paths.push("product.json")
    if (await this.exists(this.resolve("runtime", "selection.json"))) paths.push("runtime/selection.json")
    for (const [directory, pattern] of [
      ["design-revisions", /^[0-9a-f-]+\.json$/i],
      ["product-history", /^product-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["record-history", /^[a-z-]+-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["sources", /^[0-9a-f-]+\.json$/i],
      ["source-history", /^source-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["source-baselines", /^[0-9a-f-]+\.json$/i],
      ["source-baseline-history", /^baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["source-provenance", /^[0-9a-f-]+\.json$/i],
      ["business-understanding", /^[0-9a-f-]+\.json$/i],
      ["business-understanding-history", /^business-understanding-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["business-capability-maps", /^[0-9a-f-]+\.json$/i],
      ["business-capability-map-history", /^business-capability-map-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["value-stream-models", /^[0-9a-f-]+\.json$/i],
      ["value-stream-model-history", /^value-stream-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["operating-models", /^[0-9a-f-]+\.json$/i],
      ["operating-model-history", /^operating-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["business-rule-catalogs", /^[0-9a-f-]+\.json$/i],
      ["business-rule-catalog-history", /^business-rule-catalog-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["business-architecture-baselines", /^[0-9a-f-]+\.json$/i],
      ["business-architecture-baseline-history", /^business-architecture-baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["system-solution-architectures", /^[0-9a-f-]+\.json$/i],
      ["system-solution-architecture-history", /^system-solution-architecture-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["bounded-context-models", /^[0-9a-f-]+\.json$/i],
      ["bounded-context-model-history", /^bounded-context-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["security-privacy-assessments", /^[0-9a-f-]+\.json$/i],
      ["security-privacy-assessment-history", /^security-privacy-assessment-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["process-models", /^[0-9a-f-]+\.json$/i],
      ["process-model-history", /^process-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["data-models", /^[0-9a-f-]+\.json$/i],
      ["data-model-history", /^data-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["authorization-models", /^[0-9a-f-]+\.json$/i],
      ["authorization-model-history", /^authorization-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["stakeholder-models", /^[0-9a-f-]+\.json$/i],
      ["stakeholder-model-history", /^stakeholder-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["outcome-models", /^[0-9a-f-]+\.json$/i],
      ["outcome-model-history", /^outcome-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i],
      ["initiatives", /^[0-9a-f-]+\.json$/i],
      ["changes", /^[0-9a-f-]+\.json$/i],
      ["work-items", /^[0-9a-f-]+\.json$/i],
      ["requirements", /^[0-9a-f-]+\.json$/i],
      ["decisions", /^[0-9a-f-]+\.json$/i],
      ["risks", /^[0-9a-f-]+\.json$/i],
      ["architecture", /^[0-9a-f-]+\.json$/i],
      ["evidence", /^[0-9a-f-]+\.json$/i],
      ["trace", /^[0-9a-f-]+\.json$/i],
      ["context-packs", /^[0-9a-f-]+\.json$/i],
      ["instruction-grants", /^[0-9a-f-]+\.json$/i],
      ["workflow-plans", /^[0-9a-f-]+\.json$/i],
      ["tools", /^[0-9a-f-]+\.json$/i],
      ["tool-selections", /^[0-9a-f-]+\.json$/i],
      ["candidates", /^portable-design-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/],
      ["sessions", /^(?:(?:charter|run|managed-run|managed-evidence|managed-result|managed-apply-decision)-[0-9a-f-]+)\.json$/i],
      ["handoffs", /^[0-9a-f-]+\.json$/i],
      ["runtime", /^capabilities-[0-9a-f]{64}\.json$/],
    ] as const) {
      let names: string[]
      try {
        const directoryPath = this.resolve(directory)
        await this.assertSafePath(directoryPath)
        names = await readdir(directoryPath)
      } catch (error) {
        if (hasCode(error, "ENOENT")) continue
        throw error
      }
      for (const name of names.filter((candidate) => pattern.test(candidate))) {
        paths.push(`${directory}/${name}`)
      }
    }
    return paths.sort()
  }

  private async readGovernedRecord(relativePath: string): Promise<unknown> {
    const path = this.fromRelativePath(relativePath)
    if (relativePath === "manifest.json") return this.readJsonUnlocked(path, repositoryManifestSchema)
    if (relativePath === "product.json") return this.readJsonUnlocked(path, productSchema)
    if (relativePath === "runtime/selection.json") {
      const raw = await this.readRawJsonUnlocked(path)
      const compatibility = parseAgentSelectionCompatibility(raw)
      if (compatibility.status === "invalid") {
        throw new Error(`Persisted Agent Selection is invalid: ${compatibility.issues.join("; ")}`)
      }
      return raw
    }
    if (/^runtime\/capabilities-[0-9a-f]{64}\.json$/.test(relativePath)) {
      const raw = await this.readRawJsonUnlocked(path)
      const compatibility = parseAdapterCapabilitiesCompatibility(raw)
      if (compatibility.status === "invalid") {
        throw new Error(`Persisted capability snapshot is invalid: ${compatibility.issues.join("; ")}`)
      }
      return raw
    }
    if (/^initiatives\/[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, initiativeSchema)
    }
    if (/^design-revisions\/[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, productDesignRevisionSchema)
    }
    if (/^product-history\/product-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, productRevisionSchema)
    }
    if (/^record-history\/[a-z-]+-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, productRecordRevisionSchema)
    }
    if (/^sources\/[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, sourceRecordSchema)
    }
    if (/^source-history\/source-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, sourceRecordRevisionSchema)
    }
    if (/^source-baselines\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^source-baseline-history\/baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, sourceBaselineSchema)
    }
    if (/^source-provenance\/[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, sourceProvenanceSchema)
    }
    if (/^business-understanding\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^business-understanding-history\/business-understanding-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, businessUnderstandingSchema)
    }
    if (/^business-capability-maps\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^business-capability-map-history\/business-capability-map-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, businessCapabilityMapSchema)
    }
    if (/^value-stream-models\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^value-stream-model-history\/value-stream-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, valueStreamModelSchema)
    }
    if (/^operating-models\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^operating-model-history\/operating-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, operatingModelSchema)
    }
    if (/^business-rule-catalogs\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^business-rule-catalog-history\/business-rule-catalog-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, businessRuleCatalogSchema)
    }
    if (/^business-architecture-baselines\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^business-architecture-baseline-history\/business-architecture-baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, businessArchitectureBaselineSchema)
    }
    if (/^system-solution-architectures\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^system-solution-architecture-history\/system-solution-architecture-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, systemSolutionArchitectureSchema)
    }
    if (/^bounded-context-models\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^bounded-context-model-history\/bounded-context-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, boundedContextModelSchema)
    }
    if (/^security-privacy-assessments\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^security-privacy-assessment-history\/security-privacy-assessment-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, securityPrivacyAssessmentSchema)
    }
    if (/^process-models\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^process-model-history\/process-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, processModelSchema)
    }
    if (/^data-models\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^data-model-history\/data-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, dataModelSchema)
    }
    if (/^authorization-models\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^authorization-model-history\/authorization-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, authorizationModelSchema)
    }
    if (/^stakeholder-models\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^stakeholder-model-history\/stakeholder-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, stakeholderModelSchema)
    }
    if (/^outcome-models\/[0-9a-f-]+\.json$/i.test(relativePath) ||
        /^outcome-model-history\/outcome-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, outcomeModelSchema)
    }
    if (/^changes\/[0-9a-f-]+\.json$/i.test(relativePath)) return this.readJsonUnlocked(path, changeSchema)
    if (/^work-items\/[0-9a-f-]+\.json$/i.test(relativePath)) return this.readJsonUnlocked(path, workItemSchema)
    if (/^requirements\/[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, requirementSchema)
    }
    if (/^decisions\/[0-9a-f-]+\.json$/i.test(relativePath)) return this.readJsonUnlocked(path, decisionSchema)
    if (/^risks\/[0-9a-f-]+\.json$/i.test(relativePath)) return this.readJsonUnlocked(path, riskSchema)
    if (/^architecture\/[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, architectureRecordSchema)
    }
    if (/^evidence\/[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, evidenceRecordSchema)
    }
    if (/^trace\/[0-9a-f-]+\.json$/i.test(relativePath)) return this.readJsonUnlocked(path, traceLinkSchema)
    if (/^context-packs\/[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, contextPackSchema)
    }
    if (/^instruction-grants\/[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, instructionPrivilegeGrantSchema)
    }
    if (/^workflow-plans\/[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, workflowPlanSchema)
    }
    if (/^tools\/[0-9a-f-]+\.json$/i.test(relativePath)) return this.readJsonUnlocked(path, toolDefinitionSchema)
    if (/^tool-selections\/[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, runToolSelectionSchema)
    }
    if (/^candidates\/portable-design-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/.test(relativePath)) {
      return this.readJsonUnlocked(path, portableDesignImportResultSchema)
    }
    if (/^sessions\/charter-[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, executionCharterSchema)
    }
    if (/^sessions\/run-[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, runSchema)
    }
    if (/^sessions\/managed-run-[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, managedRunRecordSchema)
    }
    if (/^sessions\/managed-evidence-[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, managedRunEvidenceSchema)
    }
    if (/^sessions\/managed-result-[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, managedRunResultSchema)
    }
    if (/^sessions\/managed-apply-decision-[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, managedApplyDecisionReceiptSchema)
    }
    if (/^handoffs\/[0-9a-f-]+\.json$/i.test(relativePath)) {
      return this.readJsonUnlocked(path, handoffSchema)
    }
    throw new Error("Unsupported governed record path")
  }

  private assertContained(path: string): void {
    const candidate = resolvePath(path)
    const relation = relative(this.root, candidate)
    if (relation === "") return
    if (relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
      throw new Error("Resolved path escapes the GAEP repository")
    }
  }

  private async assertSafePath(path: string): Promise<void> {
    this.assertContained(path)
    const candidate = resolvePath(path)
    const relation = relative(this.root, candidate)
    const components = relation === "" ? [] : relation.split(sep)
    let current = this.root
    const paths = [current]
    for (const component of components) {
      current = resolvePath(current, component)
      paths.push(current)
    }
    for (const target of paths) {
      try {
        const metadata = await lstat(target)
        if (metadata.isSymbolicLink()) throw new Error(`GAEP refuses symbolic-link repository paths: ${target}`)
      } catch (error) {
        if (hasCode(error, "ENOENT")) return
        throw error
      }
    }
  }

  private async exists(path: string): Promise<boolean> {
    await this.assertSafePath(path)
    try {
      await lstat(path)
      return true
    } catch (error) {
      if (hasCode(error, "ENOENT")) return false
      throw error
    }
  }

  private toRelativePath(path: string): string {
    this.assertContained(path)
    const value = relative(this.root, resolvePath(path)).split(sep).join("/")
    if (!value) throw new Error("A repository transaction cannot replace the repository root")
    return value
  }

  private fromRelativePath(path: string): string {
    if (path.includes("\\")) throw new Error("Repository transaction path is not normalized")
    return this.resolve(...path.split("/"))
  }

  private auditPath(): string {
    return this.resolve("audit", "events.jsonl")
  }

  private checkpointPath(): string {
    return this.resolve("audit", "checkpoint.json")
  }

  private statePath(): string {
    return this.resolve("audit", "state.json")
  }

  private transactionPath(): string {
    return this.resolve("runtime", "transaction.json")
  }

  private async injectFault(point: RepositoryFaultPoint): Promise<void> {
    await this.faultInjector?.(point)
  }

  private async syncDirectory(path: string): Promise<void> {
    if (process.platform === "win32") return
    const directory = await open(path, "r")
    try {
      await directory.sync()
    } finally {
      await directory.close()
    }
  }

  private async inspectLock(): Promise<LockInspection> {
    const lockPath = this.resolve("runtime", "engine.lock")
    try {
      await this.assertSafePath(lockPath)
      const [text, metadata] = await Promise.all([readFile(lockPath, "utf8"), stat(lockPath)])
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return { present: true, stale: Date.now() - metadata.mtimeMs > this.lockLeaseMs, malformed: true }
      }
      const lease = parseLockLease(parsed)
      if (!lease) {
        return { present: true, stale: Date.now() - metadata.mtimeMs > this.lockLeaseMs, malformed: true }
      }
      const expired = Date.now() - Date.parse(lease.heartbeatAt) > this.lockLeaseMs
      let ownerDead = false
      if (lease.hostname === localHostname) {
        try {
          process.kill(lease.pid, 0)
        } catch (error) {
          ownerDead = hasCode(error, "ESRCH")
        }
      }
      return { present: true, stale: lease.hostname === localHostname ? ownerDead : expired, lease }
    } catch (error) {
      if (hasCode(error, "ENOENT")) return { present: false, stale: false }
      throw error
    }
  }

  private async acquireLock(lockPath: string, token: string): Promise<FileHandle> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let lock: FileHandle
      try {
        lock = await open(lockPath, "wx", 0o600)
      } catch (error) {
        if (!hasCode(error, "EEXIST")) throw error
        const inspection = await this.inspectLock()
        if (!inspection.stale) throw new Error("Another GAEP operation is changing this workspace")
        const displacedPath = this.resolve("runtime", `engine.lock.stale-${randomUUID()}`)
        try {
          await rename(lockPath, displacedPath)
          await rm(displacedPath, { force: true })
        } catch (renameError) {
          if (!hasCode(renameError, "ENOENT")) throw renameError
        }
        continue
      }
      const now = new Date().toISOString()
      const lease: LockLease = {
        token,
        pid: process.pid,
        hostname: localHostname,
        acquiredAt: now,
        heartbeatAt: now,
      }
      try {
        await lock.writeFile(JSON.stringify(lease))
        await lock.sync()
        return lock
      } catch (error) {
        await lock.close()
        await rm(lockPath, { force: true })
        throw error
      }
    }
    throw new Error("Unable to acquire the GAEP workspace lock after stale-lock recovery")
  }

  private async refreshLock(lockPath: string, token: string, handle: FileHandle): Promise<void> {
    try {
      const current = parseLockLease(JSON.parse(await readFile(lockPath, "utf8")))
      if (!current || current.token !== token) return
      const refreshed = JSON.stringify({ ...current, heartbeatAt: new Date().toISOString() })
      await handle.truncate(0)
      await handle.write(refreshed, 0, "utf8")
      await handle.sync()
    } catch (error) {
      if (!hasCode(error, "ENOENT")) throw error
    }
  }

  private async removeOwnedLock(lockPath: string, token: string): Promise<void> {
    try {
      const current = parseLockLease(JSON.parse(await readFile(lockPath, "utf8")))
      if (current?.token === token) await rm(lockPath, { force: true })
    } catch (error) {
      if (!hasCode(error, "ENOENT")) throw error
    }
  }
}
