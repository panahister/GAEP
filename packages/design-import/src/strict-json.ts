import type { JsonValue } from "./schema.js"
import { PortableDesignImportError } from "./errors.js"

export interface StrictJsonLimits {
  readonly maxDepth: number
  readonly maxNodes: number
  readonly maxStringLength: number
  readonly maxObjectKeyLength: number
}

const defaultLimits: StrictJsonLimits = {
  maxDepth: 32,
  maxNodes: 100_000,
  maxStringLength: 50_000,
  maxObjectKeyLength: 256,
}

class StrictJsonParser {
  private index = 0
  private nodes = 0

  constructor(
    private readonly input: string,
    private readonly limits: StrictJsonLimits,
  ) {}

  parse(): JsonValue {
    this.skipWhitespace()
    const result = this.parseValue(0)
    this.skipWhitespace()
    if (this.index !== this.input.length) this.fail("Unexpected content after the JSON value")
    return result
  }

  private parseValue(depth: number): JsonValue {
    if (depth > this.limits.maxDepth) this.fail("JSON nesting exceeds the import limit")
    this.nodes += 1
    if (this.nodes > this.limits.maxNodes) this.fail("JSON node count exceeds the import limit")

    const marker = this.input[this.index]
    if (marker === "{") return this.parseObject(depth)
    if (marker === "[") return this.parseArray(depth)
    if (marker === '"') return this.parseString(this.limits.maxStringLength)
    if (marker === "t") return this.parseLiteral("true", true)
    if (marker === "f") return this.parseLiteral("false", false)
    if (marker === "n") return this.parseLiteral("null", null)
    return this.parseNumber()
  }

  private parseObject(depth: number): { [key: string]: JsonValue } {
    this.index += 1
    this.skipWhitespace()
    const result: { [key: string]: JsonValue } = Object.create(null) as { [key: string]: JsonValue }
    const keys = new Set<string>()
    if (this.input[this.index] === "}") {
      this.index += 1
      return result
    }

    while (true) {
      if (this.input[this.index] !== '"') this.fail("Object keys must be JSON strings")
      const key = this.parseString(this.limits.maxObjectKeyLength)
      if (["__proto__", "prototype", "constructor"].includes(key)) this.fail("Reserved object keys are not importable")
      if (keys.has(key)) this.fail("Duplicate object keys are not importable")
      keys.add(key)
      this.skipWhitespace()
      if (this.input[this.index] !== ":") this.fail("Object keys must be followed by a colon")
      this.index += 1
      this.skipWhitespace()
      result[key] = this.parseValue(depth + 1)
      this.skipWhitespace()
      const delimiter = this.input[this.index]
      if (delimiter === "}") {
        this.index += 1
        return result
      }
      if (delimiter !== ",") this.fail("Object entries must be separated by a comma")
      this.index += 1
      this.skipWhitespace()
    }
  }

  private parseArray(depth: number): JsonValue[] {
    this.index += 1
    this.skipWhitespace()
    const result: JsonValue[] = []
    if (this.input[this.index] === "]") {
      this.index += 1
      return result
    }

    while (true) {
      result.push(this.parseValue(depth + 1))
      this.skipWhitespace()
      const delimiter = this.input[this.index]
      if (delimiter === "]") {
        this.index += 1
        return result
      }
      if (delimiter !== ",") this.fail("Array entries must be separated by a comma")
      this.index += 1
      this.skipWhitespace()
    }
  }

  private parseString(maxLength: number): string {
    const start = this.index
    this.index += 1
    let escaped = false
    while (this.index < this.input.length) {
      const code = this.input.charCodeAt(this.index)
      const character = this.input[this.index]
      if (!escaped && character === '"') {
        this.index += 1
        let value: unknown
        try {
          value = JSON.parse(this.input.slice(start, this.index))
        } catch {
          this.fail("Invalid JSON string escape")
        }
        if (typeof value !== "string") this.fail("Invalid JSON string")
        if (value.length > maxLength) this.fail("JSON string exceeds the import limit")
        for (let offset = 0; offset < value.length; offset += 1) {
          const unit = value.charCodeAt(offset)
          if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = value.charCodeAt(offset + 1)
            if (!(next >= 0xdc00 && next <= 0xdfff)) this.fail("JSON strings cannot contain unpaired surrogates")
            offset += 1
          } else if (unit >= 0xdc00 && unit <= 0xdfff) {
            this.fail("JSON strings cannot contain unpaired surrogates")
          }
        }
        return value
      }
      if (!escaped && code < 0x20) this.fail("JSON strings cannot contain unescaped control characters")
      if (!escaped && character === "\\") escaped = true
      else escaped = false
      this.index += 1
    }
    this.fail("Unterminated JSON string")
  }

  private parseLiteral<T extends boolean | null>(literal: string, value: T): T {
    if (!this.input.startsWith(literal, this.index)) this.fail("Invalid JSON literal")
    this.index += literal.length
    return value
  }

  private parseNumber(): number {
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u.exec(this.input.slice(this.index))
    if (!match) this.fail("Invalid JSON value")
    this.index += match[0].length
    const value = Number(match[0])
    if (!Number.isFinite(value)) this.fail("JSON numbers must be finite")
    return value
  }

  private skipWhitespace(): void {
    while (this.index < this.input.length && /[\t\n\r ]/u.test(this.input[this.index] ?? "")) this.index += 1
  }

  private fail(message: string): never {
    throw new PortableDesignImportError("invalid-json", message)
  }
}

export function parseStrictJson(
  input: string,
  limits: Partial<StrictJsonLimits> = {},
): JsonValue {
  return new StrictJsonParser(input, { ...defaultLimits, ...limits }).parse()
}
