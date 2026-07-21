import type { ExecutableFingerprint } from "@gaep/agent-sdk"

export interface RuntimeBinding extends ExecutableFingerprint {
  adapterId: string
  observedAt: string
}

export type RuntimeBindingIndex = Record<string, RuntimeBinding>

export function runtimeBindingKey(workspacePath: string, adapterId: string): string {
  return `${workspacePath}\u0000${adapterId}`
}

export function sameExecutableFingerprint(
  expected: Pick<ExecutableFingerprint, "canonicalPath" | "digest" | "size" | "modifiedAtMs">,
  actual: Pick<ExecutableFingerprint, "canonicalPath" | "digest" | "size" | "modifiedAtMs">,
): boolean {
  return expected.canonicalPath === actual.canonicalPath &&
    expected.digest === actual.digest &&
    expected.size === actual.size &&
    expected.modifiedAtMs === actual.modifiedAtMs
}

