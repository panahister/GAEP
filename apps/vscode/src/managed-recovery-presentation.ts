import type { ManagedRunRecord, ManagedRunResult } from "@gaep/contracts"

export type ManagedRecoveryPresentationKind =
  | "pending-review"
  | "recovery-deferred"
  | "conflict"
  | "quarantined"
  | "unknown"
  | "local-cleanup-pending"
  | "recovery-recorded"

export interface ManagedRecoveryPresentation {
  kind: ManagedRecoveryPresentationKind
  status: string
  recovery: string
  localCleanup: string
  meaning: string
  canRetryRecovery: boolean
  canOpenDiscardReview: boolean
}

export interface PrivacySafeRecoveryDiagnostic {
  code: string
  message: string
  diagnostic: string
}

export interface ManagedRecoveryPassPresentation {
  level: "information" | "warning"
  message: string
}

export type ManagedDiscardErrorRevalidation =
  | {
      status: "persisted-discarded"
      record: ManagedRunRecord
      message: string
    }
  | {
      status: "unknown"
      message: string
    }

export interface ManagedDiscardErrorReader {
  readManagedRun(id: string): Promise<ManagedRunRecord>
  verifyAudit(): Promise<{ valid: boolean }>
}

const portableRecoveryErrorCodes = new Set([
  "journal-missing",
  "quarantine-missing",
  "quarantine-conflict",
  "stage-active",
  "lock-timeout",
  "quarantine-limit",
  "source-residue-conflict",
])

function localCleanupStatus(result: ManagedRunResult | undefined): {
  pending: boolean
  failed: boolean
  label: string
} {
  const pending = result?.warnings.includes("local-cleanup-pending") ?? false
  const failed = result?.warnings.includes("local-cleanup-failed") ?? false
  if (failed) return { pending: true, failed: true, label: "Failed or incomplete; local cleanup is not verified" }
  if (pending) return { pending: true, failed: false, label: "Pending; local cleanup is not verified" }
  return { pending: false, failed: false, label: "No portable cleanup warning is exposed; cleanup completion is not inferred" }
}

function recoveryStatus(record: ManagedRunRecord): string {
  switch (record.recovery.status) {
    case "not-required":
      return "Persisted record does not require recovery"
    case "required":
      return "Persisted record requires recovery revalidation"
    case "recovered":
      return "Persisted record says recovered; provider outcome and local cleanup remain separate claims"
    case "resume-unavailable":
      if (record.recovery.reasonCode === "local-apply-journal-quarantined") {
        return "Resume unavailable; the local apply journal is quarantined"
      }
      if (record.recovery.reasonCode === "machine-local-runtime-lost") {
        return "Resume unavailable; the exact machine-local runtime was lost"
      }
      return "Resume unavailable; this host does not interpret the bounded recovery reason"
  }
}

export function managedRecoveryPresentation(
  record: ManagedRunRecord,
  result?: ManagedRunResult,
): ManagedRecoveryPresentation | undefined {
  const cleanup = localCleanupStatus(result)
  const quarantined = record.recovery.reasonCode === "local-apply-journal-quarantined"
  const recoveryRecorded = record.recovery.status !== "not-required"
  const recoveryRelevant = [
    "prepared", "running", "review-required", "applying", "conflict", "unknown", "discarded",
  ].includes(record.state) && (
    ["review-required", "applying", "conflict", "unknown"].includes(record.state) ||
    recoveryRecorded || cleanup.pending
  )
  if (!recoveryRelevant) return undefined

  const common = {
    recovery: recoveryStatus(record),
    localCleanup: cleanup.label,
    canRetryRecovery: ["prepared", "running", "applying"].includes(record.state) ||
      record.recovery.status === "required" || (record.state === "discarded" && cleanup.pending),
    canOpenDiscardReview: ["review-required", "conflict"].includes(record.state),
  }
  if (quarantined) {
    return {
      ...common,
      kind: "quarantined",
      status: "Quarantined recovery state",
      meaning: "Suspect local recovery material is contained. No cleanup, apply, resume, or outcome success is claimed.",
    }
  }
  if (record.state === "conflict") {
    return {
      ...common,
      kind: "conflict",
      status: "Persisted apply conflict",
      meaning: "The reviewed write could not be applied exactly. Inspection and staged discard remain available; apply success is not claimed.",
    }
  }
  if (record.state === "review-required") {
    return {
      ...common,
      kind: "pending-review",
      status: "Pending human review",
      meaning: "Provider completion created provisional staged changes only. This is not approval, apply success, or Product outcome completion.",
    }
  }
  if (record.state === "applying" || record.state === "prepared" || record.state === "running") {
    return {
      ...common,
      kind: "recovery-deferred",
      status: record.state === "applying" ? "Apply or restart recovery is deferred" : "Restart recovery may be deferred",
      meaning: "The persisted state is non-terminal. Active ownership, applied effects, cleanup, and recovery completion are not inferred.",
    }
  }
  if (record.state === "unknown") {
    return {
      ...common,
      kind: cleanup.pending ? "local-cleanup-pending" : "unknown",
      status: cleanup.pending ? "Unknown outcome with local cleanup pending" : "Unknown outcome",
      meaning: "GAEP cannot verify the provider or workspace outcome. Dependent success and safe resume claims remain blocked.",
    }
  }
  return {
    ...common,
    kind: cleanup.pending ? "local-cleanup-pending" : "recovery-recorded",
    status: cleanup.pending ? "Local cleanup remains pending" : "Recovery state recorded",
    meaning: "This row reports persisted recovery metadata only; it is not an independent provider, apply, cleanup, or Product outcome attestation.",
  }
}

export function privacySafeRecoveryDiagnostic(error: unknown): PrivacySafeRecoveryDiagnostic {
  let code = "recovery-verification-failed"
  try {
    if (error && typeof error === "object" && "reasonCode" in error && typeof error.reasonCode === "string" &&
        portableRecoveryErrorCodes.has(error.reasonCode)) {
      code = error.reasonCode
    }
  } catch {
    // Hostile or malformed upstream errors are reduced to the stable generic code below.
  }
  return {
    code,
    message: "Recovery is deferred because GAEP could not verify the persisted and machine-local recovery boundary.",
    diagnostic: `Recovery boundary ${code}; raw local paths, credentials, and upstream error text are withheld.`,
  }
}

export function managedRecoveryPassPresentation(
  records: readonly ManagedRunRecord[],
  auditValid: boolean,
  limit = 200,
  total = records.length,
): ManagedRecoveryPassPresentation {
  if (!auditValid) {
    return {
      level: "warning",
      message: "The recovery pass returned, but the audit boundary is not valid. No recovery, cleanup, apply, or outcome success is claimed.",
    }
  }
  const observed = records.slice(0, limit)
  const deferred = observed.filter((record) => ["prepared", "running", "applying"].includes(record.state))
  const attention = observed.filter((record) => ["review-required", "conflict", "unknown"].includes(record.state) ||
    record.recovery.status !== "not-required")
  if (total > observed.length) {
    return {
      level: "warning",
      message: `The recovery pass returned and the audit is valid, but the host summary is bounded to the newest ${observed.length} of ${total} Managed Runs. No complete recovery or cleanup claim is made; review Runs & Evidence.`,
    }
  }
  if (deferred.length > 0) {
    return {
      level: "warning",
      message: `The recovery pass returned, but ${deferred.length} persisted Managed Run${deferred.length === 1 ? " remains" : "s remain"} non-terminal. Recovery is deferred; no apply, cleanup, or outcome success is claimed.`,
    }
  }
  if (attention.length > 0) {
    return {
      level: "information",
      message: `The recovery pass returned with ${attention.length} persisted Managed Run${attention.length === 1 ? "" : "s"} still requiring review, conflict resolution, or unknown-outcome attention. No cleanup or outcome success is claimed.`,
    }
  }
  return {
    level: "information",
    message: "The recovery pass returned and the bounded persisted inventory has no interrupted non-terminal Managed Run. This does not attest provider outcome or machine-local cleanup.",
  }
}

export async function revalidateManagedDiscardAfterError(
  previous: ManagedRunRecord,
  reader: ManagedDiscardErrorReader,
): Promise<ManagedDiscardErrorRevalidation> {
  const unknown = (): ManagedDiscardErrorRevalidation => ({
    status: "unknown",
    message: "The persisted discard outcome is unknown. Runs & Evidence is refreshing; no pending, discarded, cleanup, recovery, or outcome state is claimed.",
  })
  try {
    const [record, audit] = await Promise.all([
      reader.readManagedRun(previous.id),
      reader.verifyAudit(),
    ])
    const exactAdvancedDiscard = audit.valid &&
      record.id === previous.id &&
      record.productId === previous.productId &&
      record.initiativeId === previous.initiativeId &&
      record.runId === previous.runId &&
      record.bindingsDigest === previous.bindingsDigest &&
      record.revision > previous.revision &&
      record.state === "discarded" &&
      record.resultId !== undefined &&
      record.resultDigest !== undefined
    if (!exactAdvancedDiscard) return unknown()
    return {
      status: "persisted-discarded",
      record,
      message: `Managed Run ${record.id} has persisted state discarded. Machine-local cleanup, recovery completion, and provider outcome remain unknown.`,
    }
  } catch {
    return unknown()
  }
}
