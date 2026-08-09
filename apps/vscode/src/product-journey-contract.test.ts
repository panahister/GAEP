import { describe, expect, it } from "vitest"

import {
  existingProductJourneyCheckpointIds,
  journeyCheckpointLabels,
  type ExistingProductJourneyCheckpointId,
} from "./existing-product-journey-coverage.js"
import { existingProductAdoptionFollowThrough } from "./existing-product-adoption-review.js"
import {
  currentProductJourneyCheckpointIds,
  currentProductJourneyCheckpointPresentation,
  productJourneyCompetencyProfileIds,
  productJourneyRoleArchetypeIds,
} from "./product-journey-presentation.js"

describe("systemic current-runtime Product Journey contract", () => {
  it("provides complete, ordered, stable execution metadata for every current checkpoint", () => {
    expect(currentProductJourneyCheckpointPresentation.length).toBeGreaterThan(0)
    expect(new Set(currentProductJourneyCheckpointIds).size).toBe(currentProductJourneyCheckpointIds.length)
    expect(currentProductJourneyCheckpointPresentation.map((entry) => entry.order)).toEqual(
      currentProductJourneyCheckpointPresentation.map((entry) => entry.order).toSorted((left, right) => left - right),
    )
    for (const checkpoint of currentProductJourneyCheckpointPresentation) {
      expect(checkpoint.stableTitle).toBe(checkpoint.label)
      expect(checkpoint.purpose).toBeTruthy()
      expect(checkpoint.whyItExists).toBeTruthy()
      expect(checkpoint.entryConditions.length).toBeGreaterThan(0)
      expect(checkpoint.requiredRoleArchetypeIds.length).toBeGreaterThan(0)
      expect(checkpoint.requiredCompetencyProfileIds.length).toBeGreaterThan(0)
      expect(checkpoint.prominentQuestions.length).toBeGreaterThan(0)
      expect(checkpoint.executionSubsteps.length).toBeGreaterThan(0)
      expect(checkpoint.exitCriteria.length).toBeGreaterThan(0)
      expect(checkpoint.blockers.length).toBeGreaterThan(0)
      expect(checkpoint.authorityEffects.length).toBeGreaterThan(0)
    }
  })

  it("makes every substep evidence-, failure-, authority-, RACI-, and audit-complete", () => {
    const stepIds = new Set<string>()
    const accountableRoles = new Set<string>()
    for (const checkpoint of currentProductJourneyCheckpointPresentation) {
      for (const step of checkpoint.executionSubsteps) {
        expect(stepIds.has(step.stepId)).toBe(false)
        stepIds.add(step.stepId)
        expect(step.purpose).toBeTruthy()
        expect(step.responsibleRoleIds.length).toBeGreaterThan(0)
        expect(step.evidenceProduced.length).toBeGreaterThan(0)
        expect(step.evidenceConsumed.length).toBeGreaterThan(0)
        expect(step.reviewCriteria.length).toBeGreaterThan(0)
        expect(step.failureConditions.length).toBeGreaterThan(0)
        expect(step.blockerBehavior).toBeTruthy()
        expect(step.retryRevisionPath).toBeTruthy()
        expect(step.auditEventEffect).toBeTruthy()
        expect(step.authorityEffect).toBeTruthy()
        expect(step.responsibilityEnforcement).toBe("policy-only-not-runtime-authenticated")
        expect(Array.isArray(step.persistedAuditFieldIds)).toBe(true)
        if (["human-decision", "governed-commit"].includes(step.interactionType)) {
          expect(step.accountableRoleId).toBeTruthy()
          accountableRoles.add(step.accountableRoleId!)
        }
      }
    }
    expect(accountableRoles.size).toBeGreaterThan(1)
    expect(accountableRoles).not.toEqual(new Set(["product-owner"]))
  })

  it("uses checkpoint-specific execution and keeps acceptance separate from commit", () => {
    const signatures = currentProductJourneyCheckpointPresentation.map((checkpoint) =>
      checkpoint.executionSubsteps.map((step) => `${step.interactionType}:${step.purpose}`).join("|"))
    expect(new Set(signatures).size).toBe(signatures.length)
    for (const checkpoint of currentProductJourneyCheckpointPresentation) {
      const acceptIndex = checkpoint.executionSubsteps.findIndex((step) => step.currentAction?.value.includes("@gaep /accept"))
      const commitIndex = checkpoint.executionSubsteps.findIndex((step) => step.currentAction?.value.includes("@gaep /commit CONFIRM"))
      if (checkpoint.checkpointId === "source-intake") {
        expect(acceptIndex).toBe(-1)
        expect(commitIndex).toBe(-1)
        continue
      }
      expect(acceptIndex).toBeGreaterThanOrEqual(0)
      expect(commitIndex).toBeGreaterThan(acceptIndex)
      expect(checkpoint.executionSubsteps[commitIndex]!.purpose).not.toMatch(/perform(?:s|ing)? acceptance/i)
    }
  })

  it("models Source Intake content review and /record without inventing acceptance", () => {
    const sourceIntake = currentProductJourneyCheckpointPresentation.find((entry) => entry.checkpointId === "source-intake")!
    const actions = sourceIntake.executionSubsteps.flatMap((step) =>
      [...(step.currentAction?.value.matchAll(/@gaep \/([a-z]+)/g) ?? [])].map((match) => match[1]))
    expect(actions).toEqual(expect.arrayContaining(["intake", "manifest", "align", "record"]))
    expect(actions).not.toEqual(expect.arrayContaining(["accept", "commit"]))
    expect(sourceIntake.executionSubsteps.find((step) => step.currentAction?.value.includes("/record"))?.authorityEffect)
      .toMatch(/candidate Source identities only/i)
  })

  it("binds all role and competency references to canonical identities", () => {
    const roles = new Set<string>(productJourneyRoleArchetypeIds)
    const competencies = new Set<string>(productJourneyCompetencyProfileIds)
    for (const checkpoint of currentProductJourneyCheckpointPresentation) {
      for (const role of checkpoint.requiredRoleArchetypeIds) expect(roles.has(role)).toBe(true)
      for (const competency of checkpoint.requiredCompetencyProfileIds) expect(competencies.has(competency)).toBe(true)
      for (const step of checkpoint.executionSubsteps) {
        for (const role of [...step.responsibleRoleIds, ...step.consultedRoleIds, ...step.informedRoleIds, ...step.independentAssuranceRoleIds]) expect(roles.has(role)).toBe(true)
      }
    }
  })

  it("derives adoption order and the historical final alias from the same labels", () => {
    expect(existingProductJourneyCheckpointIds.length).toBe(currentProductJourneyCheckpointIds.length)
    expect(existingProductJourneyCheckpointIds.at(-1)).toBe("design-implementation-handoff")
    expect(journeyCheckpointLabels["design-implementation-handoff"]).toBe("P0–P4 readiness and handoff")
    expect(currentProductJourneyCheckpointPresentation.filter((entry) => entry.terminal)).toHaveLength(1)
    for (const checkpoint of currentProductJourneyCheckpointPresentation) {
      const compatibilityId = checkpoint.adoptionFollowThrough.compatibilityCheckpointId ?? checkpoint.checkpointId
      expect(existingProductAdoptionFollowThrough(compatibilityId as ExistingProductJourneyCheckpointId)).toEqual({
        command: checkpoint.adoptionFollowThrough.command,
        prompt: checkpoint.adoptionFollowThrough.prompt,
        title: checkpoint.adoptionFollowThrough.title,
      })
    }
  })
})
