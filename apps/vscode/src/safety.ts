import type { AgentSetting, Initiative, Run } from "@gaep/contracts"

const blockedSettingValues: Readonly<Record<string, Readonly<Record<string, ReadonlySet<string>>>>> = {
  "codex-cli": {
    sandbox: new Set(["workspace-write", "danger-full-access"]),
  },
  "claude-code-cli": {
    permissionMode: new Set(["acceptEdits", "auto", "dontAsk"]),
  },
}

const allowedEnvironmentNames = new Set([
  "APPDATA",
  "COLORTERM",
  "COMSPEC",
  "HOMEDRIVE",
  "HOMEPATH",
  "HOME",
  "LANG",
  "LOCALAPPDATA",
  "LOGNAME",
  "NO_COLOR",
  "PATH",
  "PATHEXT",
  "SHELL",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "USER",
  "USERPROFILE",
  "WINDIR",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_RUNTIME_DIR",
])

const sensitiveEnvironmentName = /(API.?KEY|AUTH|BEARER|COOKIE|CREDENTIAL|PASSWORD|PRIVATE|SECRET|SESSION|TOKEN)/i

export function machineScopedSettingValue(
  inspected: { defaultValue?: string; globalValue?: string; workspaceValue?: string; workspaceFolderValue?: string } | undefined,
  fallback: string,
): string {
  const selected = inspected?.globalValue ?? inspected?.defaultValue
  return typeof selected === "string" && selected.trim() ? selected.trim() : fallback
}

export function constrainedSetting(agentId: string, setting: AgentSetting): AgentSetting {
  const blocked = blockedSettingValues[agentId]?.[setting.key]
  if (!blocked || !setting.options) return setting
  return { ...setting, options: setting.options.filter((option) => !blocked.has(option.value)) }
}

export function unsafeSelectionReasons(agentId: string, settings: Record<string, unknown>): string[] {
  const rules = blockedSettingValues[agentId]
  const reasons: string[] = []
  if (rules) {
    for (const [key, blocked] of Object.entries(rules)) {
      const value = settings[key]
      if (typeof value === "string" && blocked.has(value)) {
        reasons.push(`${key}=${value} is disabled by the GAEP VS Code safety boundary`)
      }
    }
  }
  if (agentId === "codex-cli" && settings.search === true) {
    reasons.push("search=true is disabled because Codex live search has no per-call provider approval")
  }
  return reasons
}

export function filteredAgentEnvironment(
  source: NodeJS.ProcessEnv,
  invocationOverrides: Readonly<Record<string, string>>,
  additionalAllowedNames: readonly string[] = [],
): NodeJS.ProcessEnv {
  const filtered: NodeJS.ProcessEnv = {}
  const allowedNames = new Set([...allowedEnvironmentNames, ...additionalAllowedNames].map((name) => name.toUpperCase()))
  for (const environment of [source, invocationOverrides]) {
    for (const [name, value] of Object.entries(environment)) {
      if (value === undefined || sensitiveEnvironmentName.test(name)) continue
      const normalizedName = name.toUpperCase()
      if (allowedNames.has(normalizedName) || normalizedName.startsWith("LC_")) filtered[name] = value
    }
  }
  return filtered
}

export function currentInitiative(initiatives: readonly Initiative[]): Initiative | undefined {
  return [...initiatives].sort((left, right) => {
    const priority = (initiative: Initiative): number => {
      if (initiative.state === "active") return 0
      if (initiative.state === "blocked") return 1
      if (initiative.state === "proposed") return 2
      return 3
    }
    return priority(left) - priority(right) || right.updatedAt.localeCompare(left.updatedAt)
  })[0]
}

export function initiativeRunEligibility(initiative: Initiative): { eligible: boolean; reason?: string } {
  switch (initiative.state) {
    case "active":
      return { eligible: true }
    case "proposed":
      return { eligible: false, reason: "Activate this proposed Initiative before preparing a run." }
    case "blocked":
      return { eligible: false, reason: "Resolve the blocker and return this Initiative to active before preparing a run." }
    case "completed":
      return { eligible: false, reason: "Completed Initiatives are terminal and cannot start another run." }
    case "cancelled":
      return { eligible: false, reason: "Cancelled Initiatives are terminal and cannot start another run." }
  }
}

export function newestRun(runs: readonly Run[]): Run | undefined {
  return [...runs].sort((left, right) => {
    const leftTime = left.endedAt ?? left.startedAt ?? ""
    const rightTime = right.endedAt ?? right.startedAt ?? ""
    return rightTime.localeCompare(leftTime)
  })[0]
}
