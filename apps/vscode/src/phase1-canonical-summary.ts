/**
 * Shared, privacy-safe summarizer for governed canonical Product Journey record
 * projections.
 *
 * The Product Studio Overview must show meaningful inline content for every one
 * of the 23 canonical records instead of a bare "Recorded" / "Missing" status.
 * Rather than hand-maintaining 23 bespoke summaries, this reads the count and
 * status metadata every record projection already exposes (`*Count` numeric
 * fields plus `revision` and `state`) and renders a concise headline.
 *
 * It deliberately never surfaces digests, membership digests or exact UUIDs —
 * those remain under the Advanced/Audit disclosure per the UX requirements.
 */

export interface CanonicalRecordMetric {
  readonly label: string
  readonly value: number
}

export interface CanonicalRecordSummary {
  /** Whether a governed record projection was present. */
  readonly present: boolean
  readonly revision?: number
  readonly state?: string
  /** One-line human-readable headline, e.g. "3 objectives · 5 constraints". */
  readonly headline: string
  /** Metric rows extracted from the projection's `*Count` fields. */
  readonly metrics: CanonicalRecordMetric[]
  /**
   * Multi-line inline presentation: a status line followed by one line per
   * metric. Suitable for a `kind: "list"` Product Journey detail row.
   */
  readonly lines: string[]
}

const NOT_CREATED = "Not yet created"

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function words(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/[-_]/gu, " ")
    .trim()
    .toLocaleLowerCase("en-US")
}

function pluralize(noun: string, count: number): string {
  if (count === 1) return noun
  if (/(?:s|x|z|ch|sh)$/u.test(noun)) return `${noun}es`
  if (/[^aeiou]y$/u.test(noun)) return `${noun.slice(0, -1)}ies`
  return `${noun}s`
}

/**
 * Summarize a single canonical record projection object (the extracted record,
 * e.g. `projection.businessUnderstanding` or `projection.model`). Passing
 * `undefined` yields a not-yet-created summary so callers can render a uniform
 * inline state for missing components.
 */
export function summarizeCanonicalRecord(
  record: unknown,
  options: { readonly maxMetrics?: number } = {},
): CanonicalRecordSummary {
  const value = asRecord(record)
  if (!value) {
    return { present: false, headline: NOT_CREATED, metrics: [], lines: [NOT_CREATED] }
  }

  const revision = typeof value.revision === "number" ? value.revision : undefined
  const state = typeof value.state === "string" && value.state.trim() ? value.state.trim() : undefined

  const maxMetrics = options.maxMetrics ?? 8
  const metrics: CanonicalRecordMetric[] = []
  for (const [key, raw] of Object.entries(value)) {
    if (metrics.length >= maxMetrics) break
    if (!key.endsWith("Count")) continue
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue
    const base = words(key.slice(0, -"Count".length))
    if (!base) continue
    metrics.push({ label: pluralize(base, raw), value: raw })
  }

  const statusLine = [
    "Governed",
    revision !== undefined ? `revision ${revision}` : undefined,
    state ? state : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ")

  const headline = metrics.length > 0
    ? metrics.map((metric) => `${metric.value} ${metric.label}`).join(" · ")
    : statusLine

  const lines = [statusLine, ...metrics.map((metric) => `${metric.value} ${metric.label}`)]

  return { present: true, revision, state, headline, metrics, lines }
}
