import { isAbsolute, relative, resolve } from "node:path"

import type { ExecutionCharter, ToolPermission } from "@gaep/contracts"

export interface CompiledPermission {
  capability: string
  mode: ToolPermission["mode"] | "absent" | "ambiguous"
  workspaceBounded: boolean
  explicitlyAllowed: boolean
  reason: string
}

function isExactWorkspaceScope(scope: string, workspacePath: string): boolean {
  const workspace = resolve(workspacePath)
  const target = resolve(workspace, scope)
  const difference = relative(workspace, target)
  return difference === "" && !isAbsolute(difference)
}

export function compileWorkspacePermission(
  charter: ExecutionCharter,
  capability: string,
  workspacePath: string,
): CompiledPermission {
  const matches = charter.permissions.filter((permission) => permission.capability === capability)
  if (matches.length === 0) {
    return {
      capability,
      mode: "absent",
      workspaceBounded: false,
      explicitlyAllowed: false,
      reason: `${capability} is absent`,
    }
  }
  if (matches.length !== 1) {
    return {
      capability,
      mode: "ambiguous",
      workspaceBounded: false,
      explicitlyAllowed: false,
      reason: `${capability} has ambiguous duplicate entries`,
    }
  }
  const permission = matches[0]!
  const workspaceBounded = permission.scope.length > 0 &&
    permission.scope.every((scope) => isExactWorkspaceScope(scope, workspacePath))
  return {
    capability,
    mode: permission.mode,
    workspaceBounded,
    explicitlyAllowed: permission.mode === "allow" && workspaceBounded,
    reason: permission.mode !== "allow"
      ? `${capability} is ${permission.mode}`
      : workspaceBounded
        ? `${capability} is explicitly allowed for the workspace root`
        : `${capability} is not exactly bounded to the workspace root`,
  }
}

export function assertNoUnsupportedEffects(charter: ExecutionCharter, providerLabel: string): void {
  const supported = new Set(["observe", "provisional", "reversible-change"])
  const unsupported = charter.expectedEffects.filter((effect) => !supported.has(effect))
  if (unsupported.length > 0) {
    throw new Error(`${providerLabel} CLI execution cannot enforce Charter effects: ${unsupported.join(", ")}`)
  }
}

export function assertOnlySupportedPermissions(
  charter: ExecutionCharter,
  capabilities: readonly string[],
  providerLabel: string,
): void {
  const unsupported = charter.permissions.filter((permission) =>
    permission.mode !== "deny" && !capabilities.includes(permission.capability),
  )
  if (unsupported.length > 0) {
    throw new Error(
      `${providerLabel} CLI execution cannot enforce Charter permissions: ${unsupported.map((item) => `${item.capability}=${item.mode}`).join(", ")}`,
    )
  }
}

export function requireExplicitWorkspacePermission(
  charter: ExecutionCharter,
  capability: string,
  workspacePath: string,
  providerLabel: string,
): CompiledPermission {
  const permission = compileWorkspacePermission(charter, capability, workspacePath)
  if (!permission.explicitlyAllowed) {
    throw new Error(
      `${providerLabel} CLI execution requires ${capability}=allow exactly at the workspace root: ${permission.reason}`,
    )
  }
  return permission
}
