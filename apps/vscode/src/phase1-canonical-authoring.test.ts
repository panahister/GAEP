import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { GaepEngine } from "@gaep/engine"
import { afterEach, describe, expect, it } from "vitest"

import {
  commitPhase1CanonicalDraft,
  nextPhase1AuthoringTarget,
  phase1CanonicalAuthoringFailureMarkdown,
  phase1CanonicalRecordKinds,
  validatePhase1CanonicalDraft,
} from "./phase1-canonical-authoring.js"
import { candidateSourceRecordInput } from "./product-chat-source-recording.js"
import { buildProductJourneyExportFiles, buildProductJourneyMarkdown, buildProductJourneyReview } from "./product-journey-markdown-export.js"

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
    expect(markdown).toContain("## P0–P4 boundary")

    const files = await buildProductJourneyExportFiles(engine, initiative.id, { generatedAt: "2026-08-05T00:00:00.000Z" })
    const paths = files.map((file) => file.path)
    expect(paths).toContain("README.md")
    expect(paths).toContain("01_product-definition/product-definition.md")
    expect(paths).toContain("02_initiative-definition/initiative-definition.md")
    expect(paths).toContain("05_source-intake/sources.md")
    const intakeFile = files.find((file) => file.path === "05_source-intake/sources.md")!
    expect(intakeFile.contents).toContain("| Source | Summary | Type | Classification | Revision | Content digest |")
    expect(intakeFile.contents).toContain("non-authoritative candidate input")
    expect(paths).toContain("08_product-discovery/business-understanding.md")
    // No governed classification/applicability/baseline exists in this fixture, so those files are absent.
    expect(paths).not.toContain("03_initiative-classification/initiative-classification.md")
    expect(paths).not.toContain("04_initiative-applicability/initiative-applicability.md")
    const readme = files.find((file) => file.path === "README.md")!
    expect(readme.contents).toContain("gaep_export: \"product-journey\"")
    expect(readme.contents).toContain("| Checkpoint | Status | Revision / coverage |")
    const businessUnderstanding = files.find((file) => file.path === "08_product-discovery/business-understanding.md")!
    expect(businessUnderstanding.contents.startsWith("---\n")).toBe(true)
    expect(businessUnderstanding.contents).toContain("record: \"business-understanding\"")
    expect(businessUnderstanding.contents).toContain("revision: 2")
    expect(businessUnderstanding.contents).toContain("# Product discovery — Business Understanding")

    const review = await buildProductJourneyReview(engine, initiative.id, { generatedAt: "2026-08-05T00:00:00.000Z" })
    expect(review.sections).toHaveLength(12)
    expect(review.sections[0]).toMatchObject({ id: "product-definition", heading: "## 1. Product definition" })
    expect(review.sections.find((section) => section.id === "product-discovery")).toMatchObject({
      heading: "## 8. Product discovery",
    })
    // A navigable table-of-contents links every checkpoint.
    expect(review.markdown).toContain("## Checkpoints")
    expect(review.markdown).toContain("1. [Product definition](#1-product-definition)")
    // Each checkpoint heading the sections map advertises is actually present in the document.
    for (const section of review.sections) expect(review.markdown).toContain(`\n${section.heading}\n`)
    // Governed discovery content is rendered inline under its checkpoint.
    expect(review.markdown).toContain("## 8. Product discovery")
    expect(review.markdown).toContain("### Business Understanding")
    expect(review.markdown).not.toContain("```json")
    // Per-checkpoint accountable/responsible role guidance (candidate, no authority).
    expect(review.markdown).toContain("**Responsible:** product-manager · **Accountable:** business-owner")
    expect(review.markdown).toContain("Competence and organizational authority are assessed separately")

    const referenceLinks = [
      { id: "l1", label: "IMO SOLAS", url: "https://example.org/solas", note: "Safety convention", addedAt: "2026-08-05T00:00:00.000Z" },
    ]
    const reviewWithLinks = await buildProductJourneyReview(engine, initiative.id, { generatedAt: "2026-08-05T00:00:00.000Z", referenceLinks })
    expect(reviewWithLinks.markdown).toContain("## Reference links")
    expect(reviewWithLinks.markdown).toContain("https://example.org/solas")
    const filesWithLinks = await buildProductJourneyExportFiles(engine, initiative.id, { generatedAt: "2026-08-05T00:00:00.000Z", referenceLinks })
    expect(filesWithLinks.map((file) => file.path)).toContain("reference-links.md")
    expect(filesWithLinks.find((file) => file.path === "reference-links.md")!.contents).toContain("IMO SOLAS")
    // Absent by default when no links are supplied.
    expect(files.map((file) => file.path)).not.toContain("reference-links.md")
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

  it("deterministically normalizes only contract-declared canonical ordering", () => {
    const sourceA = {
      sourceId: "10000000-0000-4000-8000-000000000001",
      sourceRevision: 1,
      recordDigest: `sha256:${"a".repeat(64)}`,
      contentDigest: `sha256:${"b".repeat(64)}`,
    }
    const sourceB = {
      sourceId: "10000000-0000-4000-8000-000000000002",
      sourceRevision: 2,
      recordDigest: `sha256:${"c".repeat(64)}`,
      contentDigest: `sha256:${"d".repeat(64)}`,
    }
    const unorderedSources = [sourceB, sourceA]
    const statement = (text: string) => ({ text, disposition: "unknown", sources: unorderedSources })
    const validation = validatePhase1CanonicalDraft("business-understanding", {
      initiativeId: "20000000-0000-4000-8000-000000000001",
      context: {
        productRevision: 1,
        productDigest: `sha256:${"e".repeat(64)}`,
        initiativeRevision: 2,
        initiativeDigest: `sha256:${"f".repeat(64)}`,
      },
      informationClassification: "internal",
      problem: statement("Fragmented schedule tools prevent one consistent operational planning view."),
      currentState: statement("Current Product evidence describes multiple disconnected planning workflows."),
      targetState: statement("A controlled service-to-voyage workflow supports reviewed operational recovery."),
      scope: {
        included: ["Voyage planning", "Service planning"],
        excluded: ["Public customer portal", "Automated vessel control"],
        boundaries: ["Zulu boundary", "Alpha boundary"],
      },
      objectives: [
        { id: "zulu-objective", ...statement("Provide a reviewed operational recovery workflow for schedule deviations.") },
        { id: "alpha-objective", ...statement("Create one governed schedule planning source for operational users.") },
      ],
      constraints: [],
      assumptions: [],
      unresolvedQuestions: [
        { id: "zulu-question", question: "Who approves production schedule recovery decisions across operating teams?", blocking: true, sources: unorderedSources, reviewTrigger: "Owner review" },
        { id: "alpha-question", question: "Which integration boundary is authoritative for imported voyage actuals?", blocking: true, sources: unorderedSources, reviewTrigger: "Architecture review" },
      ],
      glossary: [
        { term: "Voyage", definition: statement("A governed operational sailing instance derived from an approved service plan.") },
        { term: "Service", definition: statement("A recurring maritime schedule pattern used to generate operational voyages.") },
      ],
      limitations: ["Zulu limitation", "Alpha limitation"],
    })

    expect(validation.errors).toEqual([])
    expect(validation.valid).toBe(true)
    const normalized = validation.value as {
      currentState: { sources: Array<{ sourceId: string }> }
      scope: { boundaries: string[] }
      objectives: Array<{ id: string }>
      unresolvedQuestions: Array<{ id: string; sources: Array<{ sourceId: string }> }>
      glossary: Array<{ term: string; definition: { sources: Array<{ sourceId: string }> } }>
      limitations: string[]
    }
    expect(normalized.currentState.sources.map((source) => source.sourceId)).toEqual([sourceA.sourceId, sourceB.sourceId])
    expect(normalized.scope.boundaries).toEqual(["Alpha boundary", "Zulu boundary"])
    expect(normalized.objectives.map((objective) => objective.id)).toEqual(["alpha-objective", "zulu-objective"])
    expect(normalized.unresolvedQuestions.map((question) => question.id)).toEqual(["alpha-question", "zulu-question"])
    expect(normalized.unresolvedQuestions[0]?.sources.map((source) => source.sourceId)).toEqual([sourceA.sourceId, sourceB.sourceId])
    expect(normalized.glossary.map((entry) => entry.term)).toEqual(["Service", "Voyage"])
    expect(normalized.glossary[0]?.definition.sources.map((source) => source.sourceId)).toEqual([sourceA.sourceId, sourceB.sourceId])
    expect(normalized.limitations).toEqual(["Alpha limitation", "Zulu limitation"])
    expect(unorderedSources.map((source) => source.sourceId)).toEqual([sourceB.sourceId, sourceA.sourceId])
  })

  it("reports canonical authoring interruption without attachment or login misinformation", () => {
    const markdown = phase1CanonicalAuthoringFailureMarkdown({
      label: "Business Understanding",
      advisorLabel: "Codex · GPT-5.6-Sol",
      error: new Error("Codex did not complete the governed advisory turn (interrupted)."),
      priorCandidatePreserved: true,
    })

    expect(markdown).toContain("# Business Understanding authoring unavailable")
    expect(markdown).toContain("managed authoring turn was interrupted")
    expect(markdown).toContain("prior advisory candidate was received")
    expect(markdown).toContain("No Product Journey record, revision")
    expect(markdown).not.toMatch(/attachment|selected files|provider login/iu)
  })

  it("attributes a provider schema rejection to GAEP instead of the selected advisor", () => {
    const markdown = phase1CanonicalAuthoringFailureMarkdown({
      label: "Business Understanding",
      advisorLabel: "Codex · GPT-5.6-Sol",
      error: new Error("invalid_json_schema: required is missing ownerRoleKey"),
      priorCandidatePreserved: false,
    })

    expect(markdown).toContain("GAEP's provider-facing canonical schema was rejected")
    expect(markdown).toContain("internal GAEP contract-translation failure")
    expect(markdown).toContain("update GAEP")
    expect(markdown).not.toContain("Codex · GPT-5.6-Sol did not complete")
  })
})
