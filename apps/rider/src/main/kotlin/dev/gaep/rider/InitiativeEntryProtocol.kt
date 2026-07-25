package dev.gaep.rider

import java.time.Instant
import java.util.UUID

data class InitiativeClassificationCharacteristics(
    val userInterface: String,
    val data: String,
    val integration: String,
    val interactionModes: List<String>,
    val exposure: String,
)

data class InitiativeClassificationRisk(
    val blastRadius: String,
    val reversibility: String,
    val urgency: String,
    val costOfFailure: String,
)

data class InitiativeClassificationConfidence(val level: String, val basis: String)

data class InitiativeEntrySource(val kind: String, val reference: String, val digest: String? = null)

data class InitiativeClassificationInput(
    val primaryType: String,
    val secondaryTypes: List<String>,
    val systemState: String,
    val changePosture: String,
    val motivations: List<String>,
    val characteristics: InitiativeClassificationCharacteristics,
    val regulated: Boolean,
    val policyDomains: List<String>,
    val sensitivities: List<String>,
    val expectedLifetime: String,
    val maintenanceHorizon: String,
    val risk: InitiativeClassificationRisk,
    val dependencies: List<String>,
    val affectedAssets: List<String>,
    val owner: String,
    val accountableAuthority: String,
    val confidence: InitiativeClassificationConfidence,
    val evidence: List<InitiativeEntrySource>,
    val unresolvedQuestions: List<String>,
    val rationale: String,
)

data class InitiativeApplicabilitySubject(val type: String, val key: String, val label: String)

internal val canonicalInitiativeApplicabilitySubjects = listOf(
    InitiativeApplicabilitySubject("phase", "intake", "Initiative intake"),
    InitiativeApplicabilitySubject("phase", "initiative-classification", "Initiative classification"),
    InitiativeApplicabilitySubject("phase", "existing-system-assessment", "Existing-system and lifecycle-state assessment"),
    InitiativeApplicabilitySubject("phase", "scope-criticality-assessment", "Scope and criticality assessment"),
    InitiativeApplicabilitySubject("phase", "applicability-assessment", "Applicability assessment"),
    InitiativeApplicabilitySubject("phase", "architecture-assurance-resolution", "Architecture and assurance resolution"),
    InitiativeApplicabilitySubject("phase", "implementation-verification", "Implementation and verification"),
    InitiativeApplicabilitySubject("phase", "release-operation-learning", "Release, operation, and learning"),
    InitiativeApplicabilitySubject("activity", "product-discovery", "Product discovery"),
    InitiativeApplicabilitySubject("activity", "business-architecture", "Business architecture"),
    InitiativeApplicabilitySubject("activity", "experience-design", "Experience and interaction design"),
    InitiativeApplicabilitySubject("activity", "existing-system-discovery", "Existing-system discovery"),
    InitiativeApplicabilitySubject("activity", "human-ai-challenge", "Human-AI challenge"),
    InitiativeApplicabilitySubject("activity", "threat-modeling", "Threat modeling"),
    InitiativeApplicabilitySubject("activity", "identity-authorization-analysis", "Identity and authorization analysis"),
    InitiativeApplicabilitySubject("activity", "technology-selection", "Technology selection"),
    InitiativeApplicabilitySubject("activity", "change-impact-analysis", "Change and impact analysis"),
    InitiativeApplicabilitySubject("artifact", "initiative-profile", "Initiative Profile"),
    InitiativeApplicabilitySubject("artifact", "applicability-matrix", "Applicability Matrix"),
    InitiativeApplicabilitySubject("artifact", "source-baseline", "Source baseline"),
    InitiativeApplicabilitySubject("artifact", "requirements-acceptance", "Requirements and acceptance criteria"),
    InitiativeApplicabilitySubject("artifact", "architecture-assets", "Architecture Assets"),
    InitiativeApplicabilitySubject("artifact", "technology-profile", "Technology Profile"),
    InitiativeApplicabilitySubject("artifact", "assurance-strategy", "Assurance Strategy and Profile"),
    InitiativeApplicabilitySubject("artifact", "release-evidence", "Release evidence package"),
    InitiativeApplicabilitySubject("capability", "design-reference-integration", "Design-reference integration"),
    InitiativeApplicabilitySubject("capability", "governed-agent-execution", "Governed agent execution"),
    InitiativeApplicabilitySubject("capability", "managed-staging", "Managed staged changes"),
    InitiativeApplicabilitySubject("capability", "provider-model-handoff", "Provider and model handoff"),
    InitiativeApplicabilitySubject("test-method", "unit-testing", "Unit testing"),
    InitiativeApplicabilitySubject("test-method", "integration-testing", "Integration testing"),
    InitiativeApplicabilitySubject("test-method", "consumer-contract-testing", "Consumer contract testing"),
    InitiativeApplicabilitySubject("test-method", "security-testing", "Security testing"),
    InitiativeApplicabilitySubject("test-method", "usability-accessibility-testing", "Usability and accessibility testing"),
    InitiativeApplicabilitySubject("test-level", "component", "Component test level"),
    InitiativeApplicabilitySubject("test-level", "service", "Service test level"),
    InitiativeApplicabilitySubject("test-level", "system", "System test level"),
    InitiativeApplicabilitySubject("test-level", "acceptance", "Acceptance test level"),
    InitiativeApplicabilitySubject("approval", "initiative-entry", "Initiative entry approval"),
    InitiativeApplicabilitySubject("approval", "architecture", "Architecture approval"),
    InitiativeApplicabilitySubject("approval", "security", "Security approval"),
    InitiativeApplicabilitySubject("approval", "implementation", "Implementation approval"),
    InitiativeApplicabilitySubject("approval", "release", "Release approval"),
    InitiativeApplicabilitySubject("evidence-obligation", "classification", "Classification evidence"),
    InitiativeApplicabilitySubject("evidence-obligation", "applicability", "Applicability evidence"),
    InitiativeApplicabilitySubject("evidence-obligation", "traceability", "Traceability evidence"),
    InitiativeApplicabilitySubject("evidence-obligation", "test-results", "Test result evidence"),
    InitiativeApplicabilitySubject("evidence-obligation", "approval", "Approval evidence"),
    InitiativeApplicabilitySubject("evidence-obligation", "rollback-operability", "Rollback and operability evidence"),
)

data class InitiativeApplicabilitySubjectCatalogBinding(
    val catalogVersion: String,
    val digest: String,
    val subjectCount: Int,
)

data class InitiativeApplicabilityApproval(
    val state: String,
    val conditions: List<String>,
    val decidedBy: String? = null,
    val decidedAt: Instant? = null,
)

data class InitiativeRelatedRecord(
    val recordType: String,
    val recordId: UUID,
    val revision: Long,
    val digest: String,
)

data class InitiativeApplicabilityDecisionInput(
    val subject: InitiativeApplicabilitySubject,
    val status: String,
    val rationale: String,
    val sources: List<InitiativeEntrySource>,
    val owner: String,
    val accountableApprover: String? = null,
    val dependencies: List<String>,
    val conditions: List<String>,
    val reviewTriggers: List<String>,
    val approval: InitiativeApplicabilityApproval,
    val relatedRecords: List<InitiativeRelatedRecord>,
    val relatedImplementationUnits: List<String>,
)

data class InitiativeUnresolvedSubject(
    val subject: InitiativeApplicabilitySubject,
    val reason: String,
    val owner: String,
)

data class InitiativeApplicabilityMatrixInput(
    val decisions: List<InitiativeApplicabilityDecisionInput>,
    val unresolvedSubjects: List<InitiativeUnresolvedSubject>,
    val subjectCatalog: InitiativeApplicabilitySubjectCatalogBinding? = null,
)

data class InitiativeClassificationView(
    val primaryType: String,
    val productProfile: String,
    val productRevision: Long,
    val productDigest: String,
    val completenessPolicyVersion: String?,
    val completenessPolicyDigest: String?,
    val classifiedBy: String,
    val classifiedAt: Instant,
    val digest: String,
    val inputDigest: String,
)

data class InitiativeApplicabilityView(
    val revision: Long,
    val initiativeRevision: Long,
    val state: String,
    val decisionCount: Int,
    val unresolvedSubjectCount: Int,
    val classificationDigest: String,
    val subjectCatalog: InitiativeApplicabilitySubjectCatalogBinding?,
    val evaluatedBy: String,
    val evaluatedAt: Instant,
    val digest: String,
    val inputDigest: String,
)

data class InitiativeEntryRecord(
    val id: UUID,
    val revision: Long,
    val productId: UUID,
    val state: String,
    val digest: String,
    val classification: InitiativeClassificationView?,
    val applicability: InitiativeApplicabilityView?,
)

data class InitiativeClassificationCompletenessAssessment(
    val status: String,
    val policyVersion: String,
    val policyDigest: String,
    val unknownDimensionCount: Int,
    val unresolvedQuestionCount: Int,
    val missingConditionalDimensionCount: Int,
    val confidenceSufficient: Boolean,
)

data class InitiativeEntryAssessmentClassification(
    val status: String,
    val digest: String?,
    val completeness: InitiativeClassificationCompletenessAssessment,
)

data class InitiativeApplicabilityCoverageAssessment(
    val status: String,
    val catalogVersion: String?,
    val catalogDigest: String?,
    val subjectCount: Int,
    val coveredSubjectCount: Int,
    val missingSubjectCount: Int,
    val unexpectedSubjectCount: Int,
    val mismatchedSubjectCount: Int,
)

data class InitiativeEntryAssessmentApplicability(
    val status: String,
    val matrixRevision: Long?,
    val digest: String?,
    val decisionCount: Int,
    val unresolvedSubjectCount: Int,
    val pendingHumanDecisionCount: Int,
    val blockedDecisionCount: Int,
    val pendingApprovalCount: Int,
    val rejectedApprovalCount: Int,
    val coverage: InitiativeApplicabilityCoverageAssessment,
)

data class InitiativeEntryAssessment(
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val classification: InitiativeEntryAssessmentClassification,
    val applicability: InitiativeEntryAssessmentApplicability,
    val state: String,
    val reasons: List<String>,
    val assessedAt: Instant,
)

data class InitiativeEntryContext(
    val initiative: InitiativeEntryRecord,
    val assessment: InitiativeEntryAssessment,
)
