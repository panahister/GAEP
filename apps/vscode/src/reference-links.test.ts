import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { addReferenceLink, readReferenceLinks, removeReferenceLink } from "./reference-links.js"

describe("reference links portable candidate store", () => {
  let workspace: string | undefined

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    workspace = undefined
  })

  it("returns an empty list when no store exists", async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-links-"))
    expect(await readReferenceLinks(workspace)).toEqual([])
  })

  it("adds, persists, and reads back valid links without duplicates", async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-links-"))
    await addReferenceLink(workspace, { label: "IMO SOLAS", url: "https://example.org/solas", note: "Safety convention" })
    const afterSecond = await addReferenceLink(workspace, { label: "Port schedule", url: "https://example.org/ports" })
    expect(afterSecond).toHaveLength(2)
    // Duplicate URL is ignored.
    const afterDuplicate = await addReferenceLink(workspace, { label: "Again", url: "https://example.org/solas" })
    expect(afterDuplicate).toHaveLength(2)
    const persisted = await readReferenceLinks(workspace)
    expect(persisted.map((link) => link.label)).toEqual(["IMO SOLAS", "Port schedule"])
    expect(persisted[0]).toMatchObject({ url: "https://example.org/solas", note: "Safety convention" })
  })

  it("rejects non-HTTP(S) URLs and empty labels", async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-links-"))
    await expect(addReferenceLink(workspace, { label: "Bad", url: "file:///etc/passwd" })).rejects.toThrow(/http/)
    await expect(addReferenceLink(workspace, { label: "  ", url: "https://example.org" })).rejects.toThrow(/label/)
  })

  it("removes a link by id", async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-links-"))
    const links = await addReferenceLink(workspace, { label: "Doc", url: "https://example.org/doc" })
    const remaining = await removeReferenceLink(workspace, links[0]!.id)
    expect(remaining).toEqual([])
    expect(await readReferenceLinks(workspace)).toEqual([])
  })
})
