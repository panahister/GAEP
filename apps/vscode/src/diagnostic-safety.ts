import { redactSecretShapedText } from "@gaep/contracts"

const diagnosticLimit = 4_096

export function sanitizeDiagnosticText(value: string): string {
  const secretRedacted = redactSecretShapedText(value).text
  const sanitized = secretRedacted
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
    .replace(/\bBearer\s+[^\s,;]+/giu, "Bearer [REDACTED]")
    .replace(/\b(token|secret|password|passwd|api[_-]?key|access[_-]?key)\s*[:=]\s*[^\s,;]+/giu, "$1=[REDACTED]")
    .replace(/\b[A-Za-z]:[\\/][^\s"'<>]*/gu, "[MACHINE_PATH]")
    .replace(/(^|[\s(="'])\\\\[^\s"'<>]*/gu, "$1[MACHINE_PATH]")
    .replace(/(^|[\s(="'])file:\/\/[^\s"'<>)]*/gu, "$1[MACHINE_PATH]")
    .replace(/(^|[\s(="'])~[\\/][^\s"'<>)]*/gu, "$1[MACHINE_PATH]")
    .replace(/(^|[\s(="'])\/(?!\/)[^\s"'<>)]*/gu, "$1[MACHINE_PATH]")
  return sanitized.length <= diagnosticLimit
    ? sanitized
    : `${sanitized.slice(0, diagnosticLimit - 14)}...[TRUNCATED]`
}

export function safeErrorMessage(error: unknown, fallback: string): string {
  return sanitizeDiagnosticText(error instanceof Error ? error.message : fallback)
}
