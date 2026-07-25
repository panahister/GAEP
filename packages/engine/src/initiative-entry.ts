import {
  initiativeApplicabilitySubjectCatalogSchema,
  initiativeApplicabilitySubjectDefinitions,
  initiativeClassificationCompletenessDimensionIds,
  initiativeClassificationCompletenessPolicySchema,
  initiativeClassificationSchema,
  productSchema,
  type InitiativeApplicabilityMatrix,
  type InitiativeApplicabilitySubject,
  type InitiativeApplicabilitySubjectCatalog,
  type InitiativeClassification,
  type InitiativeClassificationCompletenessPolicy,
  type Product,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"

export interface InitiativeClassificationCompletenessAssessment {
  policy: InitiativeClassificationCompletenessPolicy
  policyDigest: string
  status: "missing" | "complete" | "incomplete"
  unknownDimensions: string[]
  unresolvedQuestionCount: number
  missingConditionalDimensions: string[]
  confidenceSufficient: boolean
}

export interface InitiativeApplicabilityCoverageAssessment {
  catalog: InitiativeApplicabilitySubjectCatalog
  catalogDigest: string
  status: "missing" | "complete" | "incomplete"
  coveredSubjectCount: number
  missingSubjects: InitiativeApplicabilitySubject[]
  unexpectedSubjects: InitiativeApplicabilitySubject[]
  mismatchedSubjects: InitiativeApplicabilitySubject[]
}

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function subjectKey(subject: InitiativeApplicabilitySubject): string {
  return `${subject.type}:${subject.key}`
}

export function composeInitiativeClassificationCompletenessPolicy(
  productValue: Product,
): InitiativeClassificationCompletenessPolicy {
  const product = productSchema.parse(productValue)
  return initiativeClassificationCompletenessPolicySchema.parse({
    schemaVersion: 1,
    kind: "initiative-classification-completeness-policy",
    policyVersion: "gaep-initiative-classification-completeness-v1",
    productId: product.id,
    productRevision: revisionOf(product),
    productDigest: canonicalDigest(product),
    productProfile: product.profile,
    requiredDimensions: [...initiativeClassificationCompletenessDimensionIds],
    minimumConfidence: "medium",
    unknownValueDisposition: "attention-required",
    unresolvedQuestionDisposition: "attention-required",
    regulatedPolicyDomainDisposition: "at-least-one-policy-domain-required",
    authorityBoundary: "completeness-policy-evaluates-classification-evidence-and-does-not-classify-approve-or-authorize",
  })
}

export function assessInitiativeClassificationCompleteness(
  productValue: Product,
  classificationValue?: InitiativeClassification,
): InitiativeClassificationCompletenessAssessment {
  const policy = composeInitiativeClassificationCompletenessPolicy(productValue)
  const policyDigest = canonicalDigest(policy)
  if (!classificationValue) {
    return {
      policy,
      policyDigest,
      status: "missing",
      unknownDimensions: [],
      unresolvedQuestionCount: 0,
      missingConditionalDimensions: [],
      confidenceSufficient: false,
    }
  }

  const classification = initiativeClassificationSchema.parse(classificationValue)
  const unknownDimensions = [
    classification.systemState === "unknown" ? "system-state" : undefined,
    classification.characteristics.userInterface === "unknown" ? "interface-posture" : undefined,
    classification.characteristics.data === "unknown" ? "data-posture" : undefined,
    classification.characteristics.integration === "unknown" ? "integration-posture" : undefined,
    classification.characteristics.exposure === "unknown" ? "exposure" : undefined,
    classification.sensitivities.includes("unknown") ? "sensitivity" : undefined,
    classification.expectedLifetime === "unknown" ? "expected-lifetime" : undefined,
    classification.risk.blastRadius === "unknown" ? "blast-radius" : undefined,
    classification.risk.reversibility === "unknown" ? "reversibility" : undefined,
    classification.risk.urgency === "unknown" ? "urgency" : undefined,
    classification.risk.costOfFailure === "unknown" ? "cost-of-failure" : undefined,
  ].filter((dimension): dimension is string => dimension !== undefined)
  const missingConditionalDimensions = classification.regulated && classification.policyDomains.length === 0
    ? ["regulated-policy-domain"]
    : []
  const confidenceSufficient = classification.confidence.level !== "low"
  const complete = unknownDimensions.length === 0
    && classification.unresolvedQuestions.length === 0
    && missingConditionalDimensions.length === 0
    && confidenceSufficient

  return {
    policy,
    policyDigest,
    status: complete ? "complete" : "incomplete",
    unknownDimensions,
    unresolvedQuestionCount: classification.unresolvedQuestions.length,
    missingConditionalDimensions,
    confidenceSufficient,
  }
}

export function composeInitiativeApplicabilitySubjectCatalog(
  productValue: Product,
  classificationValue: InitiativeClassification,
): InitiativeApplicabilitySubjectCatalog {
  const product = productSchema.parse(productValue)
  const classification = initiativeClassificationSchema.parse(classificationValue)
  return initiativeApplicabilitySubjectCatalogSchema.parse({
    schemaVersion: 1,
    kind: "initiative-applicability-subject-catalog",
    catalogVersion: "gaep-initiative-applicability-subjects-v1",
    productId: product.id,
    productRevision: revisionOf(product),
    productDigest: canonicalDigest(product),
    productProfile: product.profile,
    classificationDigest: canonicalDigest(classification),
    subjects: initiativeApplicabilitySubjectDefinitions.map((subject) => ({ ...subject })),
    authorityBoundary: "subject-catalog-defines-evaluation-coverage-and-does-not-decide-applicability-approve-or-authorize",
  })
}

export function assessInitiativeApplicabilityCoverage(
  productValue: Product,
  classificationValue: InitiativeClassification,
  matrix?: InitiativeApplicabilityMatrix,
): InitiativeApplicabilityCoverageAssessment {
  const catalog = composeInitiativeApplicabilitySubjectCatalog(productValue, classificationValue)
  const catalogDigest = canonicalDigest(catalog)
  if (!matrix) {
    return {
      catalog,
      catalogDigest,
      status: "missing",
      coveredSubjectCount: 0,
      missingSubjects: catalog.subjects,
      unexpectedSubjects: [],
      mismatchedSubjects: [],
    }
  }

  const catalogByKey = new Map(catalog.subjects.map((subject) => [subjectKey(subject), subject]))
  const matrixSubjects = [
    ...matrix.decisions.map((decision) => decision.subject),
    ...matrix.unresolvedSubjects.map((entry) => entry.subject),
  ]
  const matrixByKey = new Map(matrixSubjects.map((subject) => [subjectKey(subject), subject]))
  const missingSubjects = catalog.subjects.filter((subject) => !matrixByKey.has(subjectKey(subject)))
  const unexpectedSubjects = matrixSubjects.filter((subject) => !catalogByKey.has(subjectKey(subject)))
  const mismatchedSubjects = matrixSubjects.filter((subject) => {
    const expected = catalogByKey.get(subjectKey(subject))
    return expected !== undefined && expected.label !== subject.label
  })
  const coveredSubjectCount = catalog.subjects.length - missingSubjects.length - mismatchedSubjects.length
  const complete = missingSubjects.length === 0
    && unexpectedSubjects.length === 0
    && mismatchedSubjects.length === 0

  return {
    catalog,
    catalogDigest,
    status: complete ? "complete" : "incomplete",
    coveredSubjectCount,
    missingSubjects,
    unexpectedSubjects,
    mismatchedSubjects,
  }
}
