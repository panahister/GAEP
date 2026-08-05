import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { GaepEngine } from "@gaep/engine"
import { afterEach, describe, expect, it } from "vitest"

import {
  commitPhase1CanonicalDraft,
  nextPhase1AuthoringTarget,
  phase1CanonicalRecordKinds,
  validatePhase1CanonicalDraft,
} from "./phase1-canonical-authoring.js"
import { candidateSourceRecordInput } from "./product-chat-source-recording.js"
import { buildProductJourneyMarkdown } from "./product-journey-markdown-export.js"

describe("Phase 1 canonical authoring", () => {
  let workspace: string | undefined

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    workspace = undefined
  })

  it("selects the first absent canonical record and exposes only exact governed bindings", async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-phase1-authoring-"))
    const engine = new GaepEngine(workspace, [])
    const actorId = "product-owner"
    const product = await engine.createProduct({
      name: "Scheduler",
      summary: "A governed scheduler planning workspace for a bounded Product journey.",
      problem: "Product planning facts need canonical Phase 1 records.",
      affectedUsers: "Product and engineering teams",
      desiredOutcome: "Review exact pre-implementation Product records.",
      successSignals: ["Every record remains attributable and reviewable"],
      firstWorkflow: "Author the next canonical Product record.",
      exclusions: ["Implementation authority"],
      profile: "internal-tool",
    }, actorId)
    const initiative = await engine.createInitiative({
      title: "Plan scheduler capability",
      outcome: "Create an exact candidate planning foundation.",
      scope: ["Pre-implementation planning"],
      exclusions: ["Release"],
    }, actorId)
    const source = await engine.sourceGovernance.createSource(candidateSourceRecordInput({
      initiativeId: initiative.id,
      source: {
        label: "requirements.docx",
        format: "docx",
        byteLength: 200,
        contentDigest: `sha256:${"a".repeat(64)}`,
      },
      actorId,
      assessedAt: "2026-08-03T00:00:00.000Z",
    }), actorId)

    const target = await nextPhase1AuthoringTarget(engine, initiative.id)
    expect(target).toMatchObject({
      kind: "business-understanding",
      label: "Business Understanding",
      ordinal: 1,
      total: 23,
    })
    expect(phase1CanonicalRecordKinds).toHaveLength(23)
    expect(target?.context).toMatchObject({
      exactBindings: {
        initiativeId: initiative.id,
        context: { productRevision: product.revision, initiativeRevision: initiative.revision },
        sourceReferences: [{
          sourceId: source.id,
          sourceRevision: source.revision,
          contentDigest: source.contentDigest,
        }],
      },
    })
    expect(target?.schema).toMatchObject({ type: "object" })
    expect((target?.context as { authoringRules: string[] }).authoringRules).toEqual(expect.arrayContaining([
      expect.stringContaining("human is never responsible"),
      expect.stringContaining("draft the answer from Product, Initiative, Sources"),
    ]))

    const bindings = target!.context as {
      exactBindings: { initiativeId: string; context: object; sourceReferences: object[] }
    }
    const statement = (text: string) => ({
      text,
      disposition: "unknown",
      sources: bindings.exactBindings.sourceReferences,
    })
    const draft = {
      initiativeId: bindings.exactBindings.initiativeId,
      context: bindings.exactBindings.context,
      informationClassification: "internal",
      problem: statement("Planning facts remain scattered across candidate Product documents."),
      currentState: statement("The Initiative has an exact Source foundation but no canonical discovery record."),
      targetState: statement("The Product team can review one attributable candidate Business Understanding."),
      scope: {
        included: ["Pre-implementation Product discovery"],
        excluded: ["Implementation authority"],
        boundaries: ["Candidate planning evidence only"],
      },
      objectives: [{
        id: "review-candidate-context",
        ...statement("Review one exact attributable Product context before downstream architecture work."),
      }],
      constraints: [],
      assumptions: [],
      unresolvedQuestions: [],
      glossary: [],
      limitations: ["Candidate Sources are non-authoritative until separately reviewed"],
    }
    expect(validatePhase1CanonicalDraft("business-understanding", draft).valid).toBe(true)
    const committed = await commitPhase1CanonicalDraft(engine, "business-understanding", draft, actorId)
    expect(committed).toMatchObject({ kind: "business-understanding", revision: 1, operation: "created" })

    const revisionTarget = await nextPhase1AuthoringTarget(engine, initiative.id, "business-understanding")
    expect(revisionTarget).toMatchObject({
      kind: "business-understanding",
      operation: "revise",
      current: { id: committed.id, revision: 1, history: [{ revision: 1 }] },
    })
    expect(revisionTarget?.downstream.find((candidate) => candidate.kind === "stakeholder-model")).toMatchObject({
      recorded: false,
    })
    const revised = await commitPhase1CanonicalDraft(engine, "business-understanding", {
      ...draft,
      limitations: [...draft.limitations, "Revised after human review"],
    }, actorId, { id: committed.id, expectedRevision: 1 })
    expect(revised).toMatchObject({ kind: "business-understanding", revision: 2, operation: "revised" })
    expect((await nextPhase1AuthoringTarget(engine, initiative.id, "business-understanding"))?.current?.history)
      .toHaveLength(2)
    expect((await nextPhase1AuthoringTarget(engine, initiative.id))?.kind).toBe("stakeholder-model")

    const markdown = await buildProductJourneyMarkdown(engine, initiative.id, {
      generatedAt: "2026-08-05T00:00:00.000Z",
    })
    expect(markdown).toContain("# Scheduler — Product Journey")
    expect(markdown).toContain("| Checkpoint | Status | Revision / coverage | Purpose |")
    expect(markdown).toContain("```mermaid")
    expect(markdown).toContain("Event Storming and detailed assurance")
    expect(markdown).toContain("# Product discovery — Business Understanding")
    expect(markdown).toContain("Current revision: **2** · History: **2 revision(s)**")
    expect(markdown).toContain("## Pre-Figma boundary")
  })

  it("fails closed with precise schema paths instead of accepting prose or partial records", () => {
    expect(validatePhase1CanonicalDraft("business-understanding", "prose")).toMatchObject({
      valid: false,
      errors: [expect.stringContaining("root")],
    })
    const partial = validatePhase1CanonicalDraft("business-understanding", {
      initiativeId: "00000000-0000-4000-8000-000000000001",
    })
    expect(partial.valid).toBe(false)
    expect(partial.errors.some((error) => error.startsWith("context:"))).toBe(true)
  })
})
