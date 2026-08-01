const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:password|passwd|api[_-]?key|access[_-]?key|secret[_-]?access[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*["']?[^\s,;"']{20,}["']?/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}={0,2}\b/i,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
]

export function containsSecretShapedValue(value: unknown): boolean {
  if (typeof value === "string") return secretPatterns.some((pattern) => pattern.test(value))
  if (Array.isArray(value)) return value.some(containsSecretShapedValue)
  if (value && typeof value === "object") return Object.values(value).some(containsSecretShapedValue)
  return false
}

export function redactSecretShapedText(value: string): { text: string; redactions: number } {
  let text = value
  let redactions = 0
  for (const pattern of secretPatterns) {
    const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)
    text = text.replace(global, () => {
      redactions += 1
      return "[REDACTED_SECRET]"
    })
  }
  return { text, redactions }
}
