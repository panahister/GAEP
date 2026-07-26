import { z } from "zod"

/**
 * GAEP-P0-CS02 — reproducible, non-self-referential source identity (INV-27).
 *
 * `sourceTreeDigest` is the ONLY equivalence and staleness identity. `baseCommit` and `dirty`
 * are provenance metadata and must never accept or reject an artifact, so a locally built dirty
 * tree and a committed CI tree with byte-identical inputs compare equal.
 */
export const sourceIdentitySchema = z.object({
  /** Equivalence + staleness identity: SHA-256 over the canonical enumerated build inputs. */
  sourceTreeDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  /** Provenance only: the commit that was HEAD when the build started. */
  baseCommit: z.string().regex(/^[0-9a-f]{40}$/),
  /** Provenance only: whether included inputs differed from `baseCommit` at build time. */
  dirty: z.boolean(),
}).strict()

export type SourceIdentity = z.infer<typeof sourceIdentitySchema>

/** Equivalence compares ONLY `sourceTreeDigest` (INV-27). */
export function sourceIdentityMatches(left: SourceIdentity, right: SourceIdentity): boolean {
  return left.sourceTreeDigest === right.sourceTreeDigest
}
