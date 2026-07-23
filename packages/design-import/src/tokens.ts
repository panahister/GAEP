import { containsSecretShapedValue } from "@gaep/contracts"

import { canonicalDigest } from "./digest.js"
import { PortableDesignImportError } from "./errors.js"
import {
  MAX_PORTABLE_DESIGN_TOKENS,
  normalizedDesignTokenSchema,
  type JsonValue,
  type NormalizedDesignToken,
} from "./schema.js"

const tokenNamePattern = /^[A-Za-z0-9_-]+$/u
const tokenTypePattern = /^[a-z][a-z0-9-]*$/u

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function optionalString(record: { [key: string]: JsonValue }, key: string, max: number): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new PortableDesignImportError("unsupported-content", `Design token ${key} must be a bounded non-empty string`)
  }
  return value.trim()
}

function validateType(value: string | undefined): string | undefined {
  if (value !== undefined && !tokenTypePattern.test(value)) {
    throw new PortableDesignImportError("unsupported-content", "Design token type is not portable")
  }
  return value
}

export function normalizeDesignTokens(artifactId: string, root: JsonValue): NormalizedDesignToken[] {
  if (!isObject(root)) {
    throw new PortableDesignImportError("unsupported-content", "Design token documents must contain an object root")
  }
  if (containsSecretShapedValue(root)) {
    throw new PortableDesignImportError("secret-shaped-content", "Design token content contains a secret-shaped value")
  }

  const tokens: NormalizedDesignToken[] = []

  const visit = (
    record: { [key: string]: JsonValue },
    segments: string[],
    inheritedType: string | undefined,
    depth: number,
    rootGroup = false,
  ): void => {
    if (depth > 16) throw new PortableDesignImportError("limit-exceeded", "Design token nesting exceeds the import limit")

    const hasValue = Object.hasOwn(record, "$value")
    const localType = validateType(optionalString(record, "$type", 80)) ?? inheritedType
    const description = optionalString(record, "$description", 2_000)

    if (hasValue) {
      const allowed = new Set(["$value", "$type", "$description"])
      if (Object.keys(record).some((key) => !allowed.has(key))) {
        throw new PortableDesignImportError("unsupported-content", "Design token leaves cannot mix metadata with child tokens")
      }
      if (segments.length === 0) {
        throw new PortableDesignImportError("unsupported-content", "The design token root cannot be a token leaf")
      }
      const value = record.$value
      if (value === undefined) throw new PortableDesignImportError("unsupported-content", "Design token leaves require a value")
      const path = segments.join(".")
      if (path.length > 512) throw new PortableDesignImportError("limit-exceeded", "Design token path exceeds the import limit")
      tokens.push(normalizedDesignTokenSchema.parse({
        artifactId,
        path,
        type: localType ?? "unknown",
        value,
        valueDigest: canonicalDigest(value),
        description,
      }))
      if (tokens.length > MAX_PORTABLE_DESIGN_TOKENS) {
        throw new PortableDesignImportError("limit-exceeded", "Design token count exceeds the import limit")
      }
      return
    }

    const allowedMetadata = new Set(["$type", "$description", ...(rootGroup ? ["$schema"] : [])])
    if (rootGroup && record.$schema !== undefined) {
      if (typeof record.$schema !== "string" || record.$schema.length > 2_000) {
        throw new PortableDesignImportError("unsupported-content", "Design token $schema must be a bounded URI")
      }
      let schemaUrl: URL
      try {
        schemaUrl = new URL(record.$schema)
      } catch {
        throw new PortableDesignImportError("unsupported-content", "Design token $schema must be an absolute HTTPS URI")
      }
      if (schemaUrl.protocol !== "https:" || schemaUrl.username || schemaUrl.password || schemaUrl.search || schemaUrl.hash) {
        throw new PortableDesignImportError("unsupported-content", "Design token $schema must be a credential-free HTTPS URI")
      }
    }
    const childEntries = Object.entries(record).filter(([key]) => !key.startsWith("$"))
    if (Object.keys(record).some((key) => key.startsWith("$") && !allowedMetadata.has(key))) {
      throw new PortableDesignImportError("unsupported-content", "Design token document contains unsupported metadata")
    }
    if (childEntries.length === 0) {
      throw new PortableDesignImportError("unsupported-content", "Design token groups cannot be empty")
    }
    for (const [key, child] of childEntries) {
      if (!tokenNamePattern.test(key) || key.length > 120) {
        throw new PortableDesignImportError("unsupported-content", "Design token names must be portable identifiers")
      }
      if (!isObject(child)) {
        throw new PortableDesignImportError("unsupported-content", "Design token groups and leaves must be objects")
      }
      visit(child, [...segments, key], localType, depth + 1)
    }
  }

  visit(root, [], undefined, 0, true)
  if (tokens.length === 0) throw new PortableDesignImportError("unsupported-content", "Design token documents must define at least one token")
  return tokens.sort((left, right) => left.path.localeCompare(right.path))
}
