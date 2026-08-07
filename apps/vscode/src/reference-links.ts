import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"

import { containsSecretShapedValue } from "@gaep/contracts"

/**
 * User-provided useful links are portable, non-governed candidate references.
 * GAEP surfaces them and offers them to advisor steps as candidate context, but
 * it never fetches them, treats them as governed truth, or derives authority
 * from them. The store lives under `.gaep/candidates` and carries no secrets.
 */
export interface ReferenceLink {
  readonly id: string
  readonly label: string
  readonly url: string
  readonly note: string
  readonly addedAt: string
}

export interface ReferenceLinkStore {
  readonly schemaVersion: 1
  readonly kind: "gaep-reference-links"
  readonly links: ReferenceLink[]
  readonly authorityBoundary: "non-governed-candidate-references-are-not-fetched-and-grant-no-authority"
}

const STORE_FILE = "reference-links-v1.json"
const AUTHORITY_BOUNDARY = "non-governed-candidate-references-are-not-fetched-and-grant-no-authority"
const MAX_LINKS = 200

export function referenceLinksPath(workspacePath: string): string {
  return join(workspacePath, ".gaep", "candidates", STORE_FILE)
}

function isReferenceLink(value: unknown): value is ReferenceLink {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Partial<ReferenceLink>
  return typeof candidate.id === "string" && candidate.id.length > 0 && candidate.id.length <= 128 &&
    typeof candidate.label === "string" && candidate.label.length > 0 && candidate.label.length <= 200 &&
    typeof candidate.url === "string" && /^https?:\/\/\S+$/u.test(candidate.url) && candidate.url.length <= 2048 &&
    typeof candidate.note === "string" && candidate.note.length <= 2000 &&
    typeof candidate.addedAt === "string" && !Number.isNaN(Date.parse(candidate.addedAt))
}

export function isReferenceLinkStore(value: unknown): value is ReferenceLinkStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Partial<ReferenceLinkStore>
  return candidate.schemaVersion === 1 && candidate.kind === "gaep-reference-links" &&
    candidate.authorityBoundary === AUTHORITY_BOUNDARY &&
    Array.isArray(candidate.links) && candidate.links.length <= MAX_LINKS && candidate.links.every(isReferenceLink)
}

export async function readReferenceLinks(workspacePath: string): Promise<ReferenceLink[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(referenceLinksPath(workspacePath), "utf8"))
    if (!isReferenceLinkStore(parsed)) throw new Error("The persisted reference-links store failed integrity validation")
    return parsed.links
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
}

async function writeReferenceLinks(workspacePath: string, links: ReferenceLink[]): Promise<void> {
  const store: ReferenceLinkStore = {
    schemaVersion: 1,
    kind: "gaep-reference-links",
    links,
    authorityBoundary: AUTHORITY_BOUNDARY,
  }
  if (!isReferenceLinkStore(store)) throw new Error("Refusing to persist an invalid reference-links store")
  const target = referenceLinksPath(workspacePath)
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
  await rename(temporary, target)
}

/**
 * Validate and append a reference link. Fails closed on non-HTTP(S) URLs,
 * secret-shaped values, oversize input, or exceeding the store cap.
 */
export async function addReferenceLink(
  workspacePath: string,
  input: { label: string; url: string; note?: string },
): Promise<ReferenceLink[]> {
  const label = input.label.trim()
  const url = input.url.trim()
  const note = (input.note ?? "").trim()
  if (!label) throw new Error("A reference link requires a short label.")
  if (!/^https?:\/\/\S+$/u.test(url)) throw new Error("A reference link URL must start with http:// or https://.")
  if (containsSecretShapedValue(url) || containsSecretShapedValue(label) || containsSecretShapedValue(note)) {
    throw new Error("The reference link looks like it contains a secret; GAEP does not store credentials.")
  }
  const existing = await readReferenceLinks(workspacePath)
  if (existing.some((link) => link.url === url)) return existing
  if (existing.length >= MAX_LINKS) throw new Error(`GAEP stores at most ${MAX_LINKS} reference links.`)
  const link: ReferenceLink = { id: randomUUID(), label, url, note, addedAt: new Date().toISOString() }
  const next = [...existing, link]
  await writeReferenceLinks(workspacePath, next)
  return next
}

export async function removeReferenceLink(workspacePath: string, id: string): Promise<ReferenceLink[]> {
  const existing = await readReferenceLinks(workspacePath)
  const next = existing.filter((link) => link.id !== id)
  if (next.length !== existing.length) await writeReferenceLinks(workspacePath, next)
  return next
}
