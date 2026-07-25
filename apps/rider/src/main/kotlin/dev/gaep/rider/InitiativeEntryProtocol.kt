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
)

data class InitiativeClassificationView(
    val primaryType: String,
    val productProfile: String,
    val productRevision: Long,
    val productDigest: String,
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
    val classification: InitiativeClassificationView?,
    val applicability: InitiativeApplicabilityView?,
)

data class InitiativeEntryAssessmentClassification(val status: String, val digest: String?)

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
