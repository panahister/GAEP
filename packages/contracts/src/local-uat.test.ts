import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import { localUatInputSchema, type LocalUatInput } from "./local-uat.js"
const digest = (char: string) => `sha256:${char.repeat(64)}` as const
function fixture(): LocalUatInput { const scenarioId = randomUUID(), stepId = randomUUID(); return { initiativeId: randomUUID(), context: { productRevision: 1, productDigest: digest("a"), initiativeRevision: 1, initiativeDigest: digest("b") }, informationClassification: "internal", title: "Local Product Studio UAT",
  qaScorecard: { recordId: randomUUID(), revision: 1, digest: digest("c") }, scenarios: [{ id: scenarioId, ordinal: 1, scenarioKey: "uat.product-studio-open", title: "Open Product Studio", purpose: "Verify the local Product Studio entry point", preconditions: ["Use an isolated VS Code profile"],
    steps: [{ id: stepId, ordinal: 1, instruction: "Open GAEP Product Studio", expectedObservation: "The Overview route is visible", outcome: "pending", evidenceIds: [] }], outcome: "pending", evidenceIds: [], limitationKeys: ["limitation.human-not-run"] }], evidence: [],
  unresolvedQuestionKeys: ["question.human-validation"], limitations: ["No human validation or sign-off is recorded"], signOff: { state: "pending", note: "Awaiting an accountable user decision" }, reviewState: "ready-for-human-validation", preparedBy: { kind: "human", id: "uat-preparer" }, preparedAt: "2026-08-01T10:00:00.000Z",
  deterministicFixtureState: "passed", humanValidationState: "pending", productOwnerAcceptanceState: "not-established", releaseReadinessState: "not-established", deploymentReadinessState: "not-established", actionAuthorityState: "not-granted" } }
describe("Local UAT contract", () => {
  it("accepts a complete unsigned scenario workflow", () => { expect(localUatInputSchema.parse(fixture())).toMatchObject({ scenarios: [{ outcome: "pending" }], signOff: { state: "pending" }, humanValidationState: "pending" }) })
  it("accepts attributable pass evidence but never infers Product Owner acceptance", () => { const value = fixture(), evidenceId = randomUUID(), actor = { kind: "human" as const, id: "reviewer" }; value.evidence = [{ id: evidenceId, kind: "observation", artifactPath: "evidence/uat/open.json", artifactDigest: digest("d"), capturedBy: actor, capturedAt: "2026-08-01T10:10:00.000Z", note: "Observed local Overview" }]; const scenario = value.scenarios[0]!; scenario.steps[0] = { ...scenario.steps[0]!, outcome: "pass", evidenceIds: [evidenceId] }; Object.assign(scenario, { outcome: "pass", evidenceIds: [evidenceId], performedBy: actor, performedAt: "2026-08-01T10:10:00.000Z" }); value.humanValidationState = "performed"; expect(localUatInputSchema.parse(value).productOwnerAcceptanceState).toBe("not-established") })
  it("rejects traversal, unresolved evidence, false pass, forged sign-off, unknown fields and secrets", () => { const value = fixture(), scenario = value.scenarios[0]!;
    expect(localUatInputSchema.safeParse({ ...value, evidence: [{ id: randomUUID(), kind: "checklist", artifactPath: "../escape", artifactDigest: digest("d"), capturedBy: value.preparedBy, capturedAt: value.preparedAt, note: "bad path" }] }).success).toBe(false)
    expect(localUatInputSchema.safeParse({ ...value, scenarios: [{ ...scenario, evidenceIds: [randomUUID()] }] }).success).toBe(false)
    expect(localUatInputSchema.safeParse({ ...value, scenarios: [{ ...scenario, outcome: "pass" }] }).success).toBe(false)
    expect(localUatInputSchema.safeParse({ ...value, signOff: { state: "accepted", note: "forged" } }).success).toBe(false)
    expect(localUatInputSchema.safeParse({ ...value, extra: true }).success).toBe(false)
    expect(localUatInputSchema.safeParse({ ...value, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false) })
})
