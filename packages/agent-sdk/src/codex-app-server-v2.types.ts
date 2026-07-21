/**
 * Pinned stable request-parameter surface produced by:
 *
 *   codex-cli 0.135.0
 *   codex app-server generate-ts --out <directory>
 *
 * This intentionally excludes fields emitted only with `--experimental`.
 * Keep the names and optionality aligned with the official generated v2
 * schemas before changing the managed app-server transport.
 */

export type CodexJsonValue = number | string | boolean | CodexJsonValue[] | {
  [key: string]: CodexJsonValue | undefined
} | null

export type CodexPersonality = "none" | "friendly" | "pragmatic"
export type CodexApprovalsReviewer = "user" | "auto_review" | "guardian_subagent"
export type CodexAskForApproval =
  | "untrusted"
  | "on-failure"
  | "on-request"
  | {
      granular: {
        sandbox_approval: boolean
        rules: boolean
        skill_approval: boolean
        request_permissions: boolean
        mcp_elicitations: boolean
      }
    }
  | "never"
export type CodexSandboxMode = "read-only" | "workspace-write" | "danger-full-access"
export type CodexThreadStartSource = "startup" | "clear"
export type CodexThreadSource = "user" | "subagent" | "memory_consolidation"
export type CodexReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh"
export type CodexReasoningSummary = "auto" | "concise" | "detailed" | "none"
export type CodexNetworkAccess = "restricted" | "enabled"
export type CodexImageDetail = "auto" | "low" | "high" | "original"

export type CodexTextElement = {
  byteRange: { start: number; end: number }
  placeholder: string | null
}

export type CodexUserInput =
  | { type: "text"; text: string; text_elements: CodexTextElement[] }
  | { type: "image"; detail?: CodexImageDetail; url: string }
  | { type: "localImage"; detail?: CodexImageDetail; path: string }
  | { type: "skill"; name: string; path: string }
  | { type: "mention"; name: string; path: string }

export type CodexSandboxPolicy =
  | { type: "dangerFullAccess" }
  | { type: "readOnly"; networkAccess: boolean }
  | { type: "externalSandbox"; networkAccess: CodexNetworkAccess }
  | {
      type: "workspaceWrite"
      writableRoots: string[]
      networkAccess: boolean
      excludeTmpdirEnvVar: boolean
      excludeSlashTmp: boolean
    }

export interface CodexInitializeParams {
  clientInfo: { name: string; title: string | null; version: string }
  capabilities: {
    experimentalApi: boolean
    requestAttestation: boolean
    optOutNotificationMethods?: string[] | null
  } | null
}

export interface CodexThreadStartParams {
  model?: string | null
  modelProvider?: string | null
  serviceTier?: string | null
  cwd?: string | null
  approvalPolicy?: CodexAskForApproval | null
  approvalsReviewer?: CodexApprovalsReviewer | null
  sandbox?: CodexSandboxMode | null
  config?: { [key: string]: CodexJsonValue | undefined } | null
  serviceName?: string | null
  baseInstructions?: string | null
  developerInstructions?: string | null
  personality?: CodexPersonality | null
  ephemeral?: boolean | null
  sessionStartSource?: CodexThreadStartSource | null
  threadSource?: CodexThreadSource | null
}

export interface CodexThreadResumeParams {
  threadId: string
  model?: string | null
  modelProvider?: string | null
  serviceTier?: string | null
  cwd?: string | null
  approvalPolicy?: CodexAskForApproval | null
  approvalsReviewer?: CodexApprovalsReviewer | null
  sandbox?: CodexSandboxMode | null
  config?: { [key: string]: CodexJsonValue | undefined } | null
  baseInstructions?: string | null
  developerInstructions?: string | null
  personality?: CodexPersonality | null
}

export interface CodexTurnStartParams {
  threadId: string
  input: CodexUserInput[]
  cwd?: string | null
  approvalPolicy?: CodexAskForApproval | null
  approvalsReviewer?: CodexApprovalsReviewer | null
  sandboxPolicy?: CodexSandboxPolicy | null
  model?: string | null
  serviceTier?: string | null
  effort?: CodexReasoningEffort | null
  summary?: CodexReasoningSummary | null
  personality?: CodexPersonality | null
  outputSchema?: CodexJsonValue | null
}

export interface CodexTurnInterruptParams {
  threadId: string
  turnId: string
}

export interface CodexStableRequestParams {
  initialize: CodexInitializeParams
  "thread/start": CodexThreadStartParams
  "thread/resume": CodexThreadResumeParams
  "turn/start": CodexTurnStartParams
  "turn/interrupt": CodexTurnInterruptParams
}

