package dev.gaep.rider

import java.nio.file.Path
import java.util.Locale
import java.util.UUID

internal data class AgentSelectionContext(
    val current: AgentSelectionState,
    val available: List<AgentReadinessSnapshot>,
)

internal data class AgentHandoffContext(
    val current: AgentSelection,
    val sourceRun: AgentRun,
    val available: List<AgentReadinessSnapshot>,
)

internal data class ChangeImpactContext(
    val product: ProductBinding,
    val catalog: ChangeImpactChangeCatalog,
)

internal class RiderProductController(private val client: GaepEngineClient) {
    fun readProduct(): String = renderProduct(client.readProductBinding())

    fun readInitiativeEntryContext(initiativeId: UUID): InitiativeEntryContext {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val assessment = client.assessInitiativeEntry(initiativeId)
        require(
            assessment.initiativeRevision == initiative.revision && assessment.productId == initiative.productId &&
                assessment.productId == product.id && assessment.productRevision == product.revision &&
                assessment.productDigest == product.digest
        ) {
            "The Initiative changed while its entry assessment was read. Refresh the exact record."
        }
        val classification = initiative.classification
        val completeness = assessment.classification.completeness
        require(
            when (assessment.classification.status) {
                "missing" -> classification == null && assessment.classification.digest == null
                "current" -> classification != null && assessment.classification.digest == classification.digest &&
                    classification.productRevision == assessment.productRevision &&
                    classification.productDigest == assessment.productDigest &&
                    classification.completenessPolicyVersion == completeness.policyVersion &&
                    classification.completenessPolicyDigest == completeness.policyDigest
                "stale" -> classification != null && assessment.classification.digest == classification.digest &&
                    (classification.productRevision != assessment.productRevision ||
                        classification.productDigest != assessment.productDigest ||
                        classification.completenessPolicyVersion != completeness.policyVersion ||
                        classification.completenessPolicyDigest != completeness.policyDigest)
                else -> false
            },
        ) { "The Initiative classification assessment is not bound to the exact current record." }
        val applicability = initiative.applicability
        val coverage = assessment.applicability.coverage
        require(
            when (assessment.applicability.status) {
                "missing" -> applicability == null && assessment.applicability.matrixRevision == null &&
                    assessment.applicability.digest == null
                "current" -> applicability != null && applicability.state == "current" &&
                    assessment.applicability.matrixRevision == applicability.revision &&
                    assessment.applicability.digest == applicability.digest &&
                    assessment.applicability.decisionCount == applicability.decisionCount &&
                    assessment.applicability.unresolvedSubjectCount == applicability.unresolvedSubjectCount &&
                    applicability.subjectCatalog?.catalogVersion == coverage.catalogVersion &&
                    applicability.subjectCatalog?.digest == coverage.catalogDigest &&
                    applicability.subjectCatalog?.subjectCount == coverage.subjectCount
                "stale" -> applicability != null &&
                    assessment.applicability.matrixRevision == applicability.revision &&
                    assessment.applicability.digest == applicability.digest &&
                    assessment.applicability.decisionCount == applicability.decisionCount &&
                    assessment.applicability.unresolvedSubjectCount == applicability.unresolvedSubjectCount
                else -> false
            },
        ) { "The Initiative applicability assessment is not bound to the exact current record." }
        require(
            when (coverage.status) {
                "unavailable" -> coverage.catalogVersion == null && coverage.catalogDigest == null &&
                    coverage.subjectCount == 0 && assessment.classification.status == "missing"
                "missing" -> applicability == null && coverage.catalogVersion != null && coverage.catalogDigest != null
                "complete", "incomplete" -> assessment.applicability.status == "current" &&
                    coverage.catalogVersion != null && coverage.catalogDigest != null
                "stale" -> assessment.applicability.status == "stale" &&
                    coverage.catalogVersion != null && coverage.catalogDigest != null
                else -> false
            },
        ) { "The Initiative applicability coverage is not bound to the exact current catalog." }
        return InitiativeEntryContext(initiative, assessment)
    }

    fun renderInitiativeEntry(context: InitiativeEntryContext): String = buildString {
        val initiative = context.initiative
        val assessment = context.assessment
        appendLine("GAEP Initiative entry assessment")
        appendLine()
        appendLine("Initiative ID: ${initiative.id}")
        appendLine("Initiative revision: ${initiative.revision}")
        appendLine("Lifecycle state: ${initiative.state}")
        appendLine(
            "Classification: ${assessment.classification.status}" +
                initiative.classification?.let { " · ${it.primaryType} / ${it.productProfile}" }.orEmpty(),
        )
        appendLine("Classification completeness: ${assessment.classification.completeness.status}")
        appendLine("Completeness policy: ${assessment.classification.completeness.policyVersion}")
        appendLine(
            "Classification gaps: ${assessment.classification.completeness.unknownDimensionCount} unknown · " +
                "${assessment.classification.completeness.unresolvedQuestionCount} unresolved question(s) · " +
                "${assessment.classification.completeness.missingConditionalDimensionCount} missing conditional dimension(s)",
        )
        appendLine(
            "Classification confidence sufficient: ${assessment.classification.completeness.confidenceSufficient}",
        )
        appendLine(
            "Applicability: ${assessment.applicability.status} · matrix revision " +
                (assessment.applicability.matrixRevision ?: "not recorded"),
        )
        appendLine("Applicability coverage: ${assessment.applicability.coverage.status}")
        appendLine(
            "Canonical subject coverage: ${assessment.applicability.coverage.coveredSubjectCount}/" +
                assessment.applicability.coverage.subjectCount,
        )
        appendLine(
            "Coverage gaps: ${assessment.applicability.coverage.missingSubjectCount} missing · " +
                "${assessment.applicability.coverage.unexpectedSubjectCount} unexpected · " +
                "${assessment.applicability.coverage.mismatchedSubjectCount} mismatched",
        )
        appendLine("Decisions: ${assessment.applicability.decisionCount}")
        appendLine("Unresolved subjects: ${assessment.applicability.unresolvedSubjectCount}")
        appendLine("Awaiting human decisions: ${assessment.applicability.pendingHumanDecisionCount}")
        appendLine("Blocked decisions: ${assessment.applicability.blockedDecisionCount}")
        appendLine("Pending approvals: ${assessment.applicability.pendingApprovalCount}")
        appendLine("Rejected approvals: ${assessment.applicability.rejectedApprovalCount}")
        appendLine("Assessment: ${assessment.state}")
        assessment.reasons.forEach { appendLine("  - $it") }
        appendLine()
        appendLine(
            "Boundary: entry assessment is read-only and grants no approval, readiness, not-applicable inference, " +
                "or action authority.",
        )
        append(
            "Product and Initiative narrative, evidence content, owners, local paths, credentials, and raw engine " +
                "output are withheld from this compact view.",
        )
    }

    fun readSourceGovernance(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readSourceGovernance(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) {
            "The Product or Initiative changed while Source governance was read. Refresh the exact records."
        }
        return renderSourceGovernance(projection)
    }

    fun renderSourceGovernance(projection: SourceGovernanceProjection): String = buildString {
        appendLine("GAEP Source governance")
        appendLine()
        appendLine(
            "Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · " +
                projection.initiativeState,
        )
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Records: ${projection.sourceCount} Sources · ${projection.baselineCount} candidate Baselines · " +
                "${projection.provenanceCount} Provenance records",
        )
        appendLine(
            "Gaps: ${projection.staleSourceCount} stale · ${projection.unknownAuthorityCount} unknown authority · " +
                "${projection.unbaselinedSourceCount} unbaselined · " +
                "${projection.unprovenancedSourceCount} unprovenanced",
        )
        appendLine("Current candidate Baseline: ${projection.currentBaseline ?: "not recorded"}")
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        appendLine("Governed Sources")
        projection.sources.take(50).forEach { source ->
            appendLine(
                "  - ${source.title} · ${source.id}@${source.revision} · owner ${source.owner} · " +
                    "authority ${source.semanticAuthority} · ${source.knowledgeDisposition} · " +
                    "${source.freshness}/${source.availability}",
            )
        }
        if (projection.sources.size > 50) appendLine("  - ${projection.sources.size - 50} more withheld from this compact view")
        appendLine()
        appendLine("Candidate Source Baselines")
        projection.baselines.take(50).forEach { baseline ->
            appendLine(
                "  - ${baseline.title} · ${baseline.id}@${baseline.revision} · " +
                    "${baseline.memberCount} exact Source(s) · ${baseline.assessmentStatus}",
            )
        }
        if (projection.baselines.size > 50) appendLine("  - ${projection.baselines.size - 50} more withheld from this compact view")
        appendLine()
        appendLine("Source Provenance")
        projection.provenance.take(50).forEach { provenance ->
            appendLine(
                "  - ${provenance.id} · ${provenance.targetKind} · ${provenance.disposition} · " +
                    "${provenance.sourceCount} Source(s) · ${provenance.transformationCount} transformation(s)",
            )
        }
        if (projection.provenance.size > 50) appendLine("  - ${projection.provenance.size - 50} more withheld from this compact view")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this is a bounded metadata projection. It contains no Source bytes, locators, local paths, " +
                "or credentials and grants no Baseline designation, approval, readiness, authority transfer, or action authority.",
        )
    }

    fun readBusinessUnderstanding(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readBusinessUnderstanding(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) {
            "The Product or Initiative changed while Business Understanding was read. Refresh the exact records."
        }
        return renderBusinessUnderstanding(projection)
    }

    fun renderBusinessUnderstanding(projection: BusinessUnderstandingProjection): String = buildString {
        appendLine("GAEP governed Business Understanding")
        appendLine()
        appendLine(
            "Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · " +
                projection.initiativeState,
        )
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Assessment gaps: ${projection.unresolvedQuestionCount} unresolved questions · " +
                "${projection.blockingQuestionCount} blocking questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.businessUnderstanding?.let { record ->
            appendLine("Business Understanding: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine(
                "Business counts: ${record.objectiveCount} objectives · ${record.constraintCount} constraints · " +
                    "${record.assumptionCount} assumptions · ${record.unresolvedQuestionCount} unresolved questions · " +
                    "${record.glossaryTermCount} glossary terms",
            )
        } ?: appendLine("Business Understanding: not recorded")
        appendLine()
        projection.stakeholderModel?.let { record ->
            appendLine("Stakeholder Model: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine(
                "Stakeholder counts: ${record.stakeholderCount} stakeholders · " +
                    "${record.representedCategoryCount} represented categories · " +
                    "${record.unresolvedCategoryCount} unresolved categories · " +
                    "${record.verifiedAuthorityCount} verified authority claims",
            )
        } ?: appendLine("Stakeholder Model: not recorded")
        appendLine()
        projection.outcomeModel?.let { record ->
            appendLine("Outcome Model: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine(
                "Outcome counts: ${record.outcomeCount} outcomes · ${record.measureCount} measures · " +
                    "${record.countermetricCount} countermetrics · ${record.burdenMeasureCount} burden measures · " +
                    "${record.observedBaselineCount} observed baselines",
            )
        } ?: appendLine("Outcome Model: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view contains record identities, revisions, digests, states, counts, and " +
                "assessment status only. It exposes no business narrative, personal assignments, Source content, locators, " +
                "local paths, or credentials and grants no approval, appointment, decision, readiness, or action authority.",
        )
    }

    fun readBusinessCapabilityMap(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readBusinessCapabilityMap(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) {
            "The Product or Initiative changed while the Business Capability Map was read. Refresh the exact records."
        }
        return renderBusinessCapabilityMap(projection)
    }

    fun renderBusinessCapabilityMap(projection: BusinessCapabilityMapProjection): String = buildString {
        appendLine("GAEP governed Business Capability Map")
        appendLine()
        appendLine(
            "Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · " +
                projection.initiativeState,
        )
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Assessment counts: ${projection.capabilityCount} capabilities · ${projection.ownedCapabilityCount} owned · " +
                "${projection.unownedCapabilityCount} unowned · ${projection.objectiveCoverageCount} objectives covered · " +
                "${projection.outcomeCoverageCount} outcomes covered",
        )
        appendLine(
            "Gaps and uncertainty: ${projection.openGapCount} open gaps · ${projection.criticalGapCount} critical gaps · " +
                "${projection.unknownCurrentMaturityCount} unknown current maturity · " +
                "${projection.unassessedPriorityCount} unassessed priority · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.capabilityMap?.let { record ->
            appendLine("Business Capability Map: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine(
                "Map counts: ${record.capabilityCount} capabilities · ${record.ownedCapabilityCount} owned · " +
                    "${record.openGapCount} open gaps · ${record.criticalGapCount} critical gaps · " +
                    "${record.candidatePriorityCount} candidate priorities",
            )
        } ?: appendLine("Business Capability Map: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view contains record identities, revisions, digests, states, counts, and " +
                "assessment status only. It exposes no capability narrative, personal assignments, Source content, locators, " +
                "local paths, or credentials and grants no priority approval, baseline, readiness, or action authority.",
        )
    }

    fun readValueStreamModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readValueStreamModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) {
            "The Product or Initiative changed while the Value Stream Model was read. Refresh the exact records."
        }
        return renderValueStreamModel(projection)
    }

    fun renderValueStreamModel(projection: ValueStreamModelProjection): String = buildString {
        appendLine("GAEP governed Value Stream Model")
        appendLine()
        appendLine(
            "Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · " +
                projection.initiativeState,
        )
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Assessment counts: ${projection.valueStreamCount} value streams · ${projection.ownedValueStreamCount} owned · " +
                "${projection.unownedValueStreamCount} unowned · ${projection.stageCount} stages · " +
                "${projection.dependencyCount} dependencies · ${projection.capabilityCoverageCount} capabilities covered · " +
                "${projection.outcomeCoverageCount} outcomes covered",
        )
        appendLine(
            "Flow gaps: ${projection.absentFlowEvidenceCount} stages without evidence · " +
                "${projection.openBottleneckCount} open bottlenecks · ${projection.criticalBottleneckCount} critical bottlenecks · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.valueStreamModel?.let { record ->
            appendLine("Value Stream Model: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine(
                "Model counts: ${record.valueStreamCount} value streams · ${record.ownedValueStreamCount} owned · " +
                    "${record.stageCount} stages · ${record.dependencyCount} dependencies · " +
                    "${record.openBottleneckCount} open bottlenecks · ${record.criticalBottleneckCount} critical bottlenecks",
            )
        } ?: appendLine("Value Stream Model: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view contains record identities, revisions, digests, states, counts, and " +
                "assessment status only. It exposes no value-stream narrative, personal assignments, Source content, locators, " +
                "local paths, or credentials and grants no baseline, priority, readiness, or action authority.",
        )
    }

    fun readOperatingModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readOperatingModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Operating Model was read. Refresh the exact records." }
        return renderOperatingModel(projection)
    }

    fun renderOperatingModel(projection: OperatingModelProjection): String = buildString {
        appendLine("GAEP governed Operating Model")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Structural counts: ${projection.roleCount} roles · ${projection.governanceSystemCount} governance systems · " +
                "${projection.decisionRightCount} decision rights · ${projection.forumCount} forums · ${projection.cycleCount} cycles",
        )
        appendLine(
            "Candidate gaps: ${projection.unassignedAppointingAuthorityCount} appointing authorities · " +
                "${projection.insufficientCapacityCount} capacity · ${projection.unfundedCapacityCount} funding · " +
                "${projection.unassignedDecisionAuthorityCount} decision authorities · ${projection.supportCapacityGapCount} support capacity · " +
                "${projection.emergencyAuthorityGapCount} emergency authority · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.operatingModel?.let { record ->
            appendLine("Operating Model: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine(
                "Model counts: ${record.roleCount} roles · ${record.decisionRightCount} decision rights · " +
                    "${record.forumCount} forums · ${record.cycleCount} cycles",
            )
        } ?: appendLine("Operating Model: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no operating narrative, personal assignments, Source content, " +
                "locators, local paths, or credentials and grants no appointment, funding, baseline, readiness, or action authority.",
        )
    }

    fun readBusinessRuleCatalog(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readBusinessRuleCatalog(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Business Rule Catalog was read. Refresh the exact records." }
        return renderBusinessRuleCatalog(projection)
    }

    fun renderBusinessRuleCatalog(projection: BusinessRuleCatalogProjection): String = buildString {
        appendLine("GAEP governed Business Rule Catalog")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Rule counts: ${projection.ruleCount} rules · ${projection.sourceBackedRuleCount} source-backed · " +
                "${projection.nonExceptionableRuleCount} non-exceptionable · ${projection.enforcementTargetCount} enforcement targets · " +
                "${projection.exceptionCount} exceptions",
        )
        appendLine(
            "Candidate gaps: ${projection.unassignedEnforcementTargetCount} unassigned targets · " +
                "${projection.unverifiedEnforcementTargetCount} unverified targets · " +
                "${projection.unassignedExceptionAuthorityCount} unassigned exception authorities · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.businessRuleCatalog?.let { record ->
            appendLine("Business Rule Catalog: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine(
                "Catalog counts: ${record.ruleCount} rules · ${record.enforcementTargetCount} enforcement targets · " +
                    "${record.exceptionCount} exceptions · ${record.nonExceptionableRuleCount} non-exceptionable",
            )
        } ?: appendLine("Business Rule Catalog: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no rule narrative, Source content, personal data, locators, local paths, " +
                "or credentials and does not evaluate policy, grant exceptions, deploy enforcement, approve a baseline, " +
                "establish readiness, or authorize action.",
        )
    }

    fun readBusinessArchitectureBaseline(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readBusinessArchitectureBaseline(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Business Architecture Baseline was read. Refresh the exact records." }
        return renderBusinessArchitectureBaseline(projection)
    }

    fun renderBusinessArchitectureBaseline(projection: BusinessArchitectureBaselineProjection): String = buildString {
        appendLine("GAEP governed Business Architecture Baseline candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage counts: ${projection.coveredElementCount} covered · ${projection.includedElementCount} included · " +
                "${projection.excludedElementCount} excluded · ${projection.unresolvedElementCount} unresolved",
        )
        appendLine(
            "Coherence: ${projection.integrationClaimCount} integration claims · ${projection.consistencyCheckCount} consistency checks · " +
                "${projection.consistencyGapCount} gaps · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.baseline?.let { record ->
            appendLine("Baseline candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate counts: ${record.coveredElementCount} elements · ${record.integrationClaimCount} integration claims · " +
                    "${record.consistencyGapCount} consistency gaps",
            )
        } ?: appendLine("Baseline candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no architecture narrative, Source content, personal data, locators, " +
                "local paths, or credentials and does not designate or approve a baseline, establish readiness, grant " +
                "exceptions, deploy enforcement, or authorize action.",
        )
    }

    fun readSystemSolutionArchitecture(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readSystemSolutionArchitecture(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the System/Solution Architecture was read. Refresh the exact records." }
        return renderSystemSolutionArchitecture(projection)
    }

    fun renderSystemSolutionArchitecture(projection: SystemSolutionArchitectureProjection): String = buildString {
        appendLine("GAEP governed System/Solution Architecture candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage: ${projection.concernCount} concerns · ${projection.viewCount} views · " +
                "${projection.elementCount} elements · ${projection.relationCount} relations · " +
                "${projection.qualityAttributeCount} quality scenarios · ${projection.decisionCount} decisions · " +
                "${projection.conformanceCriterionCount} conformance criteria",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedQualityAttributeCount} quality scenarios · " +
                "${projection.unresolvedDecisionCount} decisions · ${projection.unresolvedConformanceCriterionCount} conformance criteria · " +
                "${projection.lifecycleGapCount} lifecycle consequences · ${projection.inconsistencyCount} inconsistencies · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.architecture?.let { record ->
            appendLine("Architecture candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate counts: ${record.concernCount} concerns · ${record.viewCount} views · ${record.elementCount} elements · " +
                    "${record.qualityAttributeCount} quality scenarios · ${record.decisionCount} decisions",
            )
        } ?: appendLine("Architecture candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no architecture narrative, Source content, personal data, locators, " +
                "local paths, or credentials and does not designate or approve an architecture baseline, establish readiness, " +
                "prove conformance, mandate technology, or authorize action.",
        )
    }

    fun readBoundedContextModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readBoundedContextModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Bounded Context Model was read. Refresh the exact records." }
        return renderBoundedContextModel(projection)
    }

    fun renderBoundedContextModel(projection: BoundedContextModelProjection): String = buildString {
        appendLine("GAEP governed Bounded Context and Ownership candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage: ${projection.boundedContextCount} contexts · ${projection.coreContextCount} core contexts · " +
                "${projection.languageTermCount} language terms · ${projection.contractCount} contracts · " +
                "${projection.relationshipCount} relationships",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedContractCount} contracts · ${projection.unresolvedRelationshipCount} relationships · " +
                "${projection.unassignedArchitectureElementCount} unassigned elements · ${projection.unownedDataAssetCount} unowned data assets · " +
                "${projection.unmappedCrossContextRelationCount} unmapped relations · ${projection.inconsistencyCount} inconsistencies · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.model?.let { record ->
            appendLine("Boundary candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate counts: ${record.boundedContextCount} contexts · ${record.contractCount} contracts · " +
                    "${record.relationshipCount} relationships",
            )
        } ?: appendLine("Boundary candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no boundary language, contract narrative, Source content, " +
                "personal data, locators, local paths, or credentials and does not appoint owners, accept ownership, " +
                "approve boundaries or contracts, establish readiness, or authorize action.",
        )
    }

    fun readSecurityPrivacyAssessment(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readSecurityPrivacyAssessment(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Security, Privacy, and Threat Assessment was read. Refresh the exact records." }
        return renderSecurityPrivacyAssessment(projection)
    }

    fun renderSecurityPrivacyAssessment(projection: SecurityPrivacyAssessmentProjection): String = buildString {
        appendLine("GAEP governed Security, Privacy, and Threat Assessment candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage: ${projection.assetCount} assets · ${projection.actorCount} actors · " +
                "${projection.trustBoundaryCount} trust boundaries · ${projection.dataClassCount} data classes · " +
                "${projection.dataFlowCount} data flows · ${projection.controlCount} controls · ${projection.threatCount} threats",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedThreatCount} threats · ${projection.unverifiedControlCount} controls · " +
                "${projection.unresolvedProcessingAuthorityCount} processing authorities · " +
                "${projection.uncoveredArchitectureElementCount} uncovered elements · " +
                "${projection.unmappedArchitectureRelationCount} unmapped relations · " +
                "${projection.unresolvedRequirementCount} profile requirements · ${projection.inconsistencyCount} inconsistencies · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.assessment?.let { record ->
            appendLine("Assessment candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate counts: ${record.assetCount} assets · ${record.trustBoundaryCount} trust boundaries · " +
                    "${record.dataClassCount} data classes · ${record.controlCount} controls · ${record.threatCount} threats",
            )
        } ?: appendLine("Assessment candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no threat scenarios, control content, data content, Source content, " +
                "personal data, locators, local paths, secrets, or credentials and does not approve a threat model, attest " +
                "control effectiveness, accept risk, approve processing, establish security readiness, or authorize action.",
        )
    }

    fun readProcessModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readProcessModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Process Model was read. Refresh the exact records." }
        return renderProcessModel(projection)
    }

    fun renderProcessModel(projection: ProcessModelProjection): String = buildString {
        appendLine("GAEP governed Process Model candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage: ${projection.processCount} processes · ${projection.stepCount} steps · " +
                "${projection.stateDimensionCount} state dimensions · ${projection.stateValueCount} state values · " +
                "${projection.transitionCount} transitions · ${projection.eventDefinitionCount} events · " +
                "${projection.approvalRequirementCount} approval requirements",
        )
        appendLine(
            "Candidate gaps: ${projection.uncoveredValueStreamCount} value streams · " +
                "${projection.uncoveredBoundedContextCount} bounded contexts · ${projection.uncoveredBusinessRuleCount} business rules · " +
                "${projection.unresolvedRequirementCount} requirements · ${projection.inconsistencyCount} inconsistencies · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.model?.let { record ->
            appendLine("Process candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate counts: ${record.processCount} processes · ${record.transitionCount} transitions · " +
                    "${record.approvalRequirementCount} approval requirements",
            )
        } ?: appendLine("Process candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no process narrative, transition guards, approval content, " +
                "Source content, personal data, locators, local paths, secrets, or credentials and does not approve " +
                "workflows, grant transition or execution authority, establish operational readiness, promote a baseline, or authorize action.",
        )
    }

    fun readDataModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readDataModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Data Model was read. Refresh the exact records." }
        return renderDataModel(projection)
    }

    fun renderDataModel(projection: DataModelProjection): String = buildString {
        appendLine("GAEP governed Data Model candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage: ${projection.entityCount} entities · ${projection.attributeCount} attributes · " +
                "${projection.relationshipCount} relationships · ${projection.lifecycleCount} lifecycles · " +
                "${projection.transformationCount} transformations",
        )
        appendLine(
            "Candidate gaps: ${projection.uncoveredBoundedContextCount} bounded contexts · " +
                "${projection.uncoveredSecurityDataClassCount} security data classes · ${projection.uncoveredProcessCount} processes · " +
                "${projection.unresolvedSystemOfRecordCount} systems of record · ${projection.unresolvedTransformationCount} transformations · " +
                "${projection.unresolvedRequirementCount} requirements · ${projection.inconsistencyCount} inconsistencies · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.model?.let { record ->
            appendLine("Data candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate counts: ${record.entityCount} entities · ${record.relationshipCount} relationships · " +
                    "${record.lifecycleCount} lifecycles",
            )
        } ?: appendLine("Data candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no entity attributes, relationships, lifecycle content, " +
                "Source content, personal data, locators, local paths, secrets, or credentials and does not approve " +
                "a data model or classification, appoint ownership, grant migration authority, establish operational " +
                "readiness, promote a baseline, or authorize action.",
        )
    }

    fun readAuthorizationModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readAuthorizationModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Authorization Model was read. Refresh the exact records." }
        return renderAuthorizationModel(projection)
    }

    fun renderAuthorizationModel(projection: AuthorizationModelProjection): String = buildString {
        appendLine("GAEP governed Authorization Model candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage: ${projection.principalCount} principals · ${projection.roleAssignmentCount} role assignments · " +
                "${projection.resourceCount} resources · ${projection.actionCount} actions · " +
                "${projection.approvalBindingCount} approval bindings · ${projection.ruleCount} rules",
        )
        appendLine(
            "Candidate gaps: ${projection.uncoveredOperatingRoleCount} operating roles · " +
                "${projection.uncoveredProcessCount} processes · ${projection.uncoveredDataEntityCount} data entities · " +
                "${projection.unresolvedIdentityCount} identities · ${projection.unresolvedRuleCount} rules · " +
                "${projection.unresolvedRequirementCount} requirements · ${projection.inconsistencyCount} inconsistencies · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.model?.let { record ->
            appendLine("Authorization candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate counts: ${record.principalCount} principals · ${record.actionCount} actions · " +
                    "${record.ruleCount} rules",
            )
        } ?: appendLine("Authorization candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no principal identifiers, role-assignment content, rules, " +
                "conditions, approval content, Source content, personal data, locators, local paths, secrets, or " +
                "credentials and does not verify identity, approve role assignments or standing authority, create " +
                "an authorization grant, enforce policy, establish operational readiness, promote a baseline, or authorize action.",
        )
    }

    fun readEventIntegrationModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readEventIntegrationModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Event and Integration Model was read. Refresh the exact records." }
        return renderEventIntegrationModel(projection)
    }

    fun renderEventIntegrationModel(projection: EventIntegrationModelProjection): String = buildString {
        appendLine("GAEP governed Event and Integration Model candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage: ${projection.eventTypeCount} event types · ${projection.commandCount} commands · " +
                "${projection.adapterCount} adapters · ${projection.externalContractCount} external contracts · " +
                "${projection.mappingCount} mappings · ${projection.routeCount} routes",
        )
        appendLine(
            "Candidate gaps: ${projection.uncoveredProcessEventCount} process events · " +
                "${projection.uncoveredProcessCount} processes · ${projection.uncoveredBoundedContextCount} bounded contexts · " +
                "${projection.uncoveredDataEntityCount} data entities · " +
                "${projection.uncoveredAuthorizationActionCount} authorization actions · " +
                "${projection.unknownMappingTruthCount} mapping truths · ${projection.unresolvedRequirementCount} requirements · " +
                "${projection.inconsistencyCount} inconsistencies · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.model?.let { record ->
            appendLine("Event and integration candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate counts: ${record.eventTypeCount} event types · ${record.commandCount} commands · " +
                    "${record.adapterCount} adapters · ${record.externalContractCount} external contracts · " +
                    "${record.mappingCount} mappings · ${record.routeCount} routes",
            )
        } ?: appendLine("Event and integration candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no event payloads, command inputs, mapping content, external " +
                "locators, Source content, personal data, local paths, secrets, or credentials and does not prove " +
                "event occurrence, send or deliver commands, accept external contracts, activate adapters, create " +
                "authorization grants, execute effects, establish operational readiness, promote a baseline, or authorize action.",
        )
    }

    fun readFailureRecoveryModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readFailureRecoveryModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Failure and Recovery Model was read. Refresh the exact records." }
        return renderFailureRecoveryModel(projection)
    }

    fun readArchitectureChallengeModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readArchitectureChallengeModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Architecture Challenge was read. Refresh the exact records." }
        return renderArchitectureChallengeModel(projection)
    }

    fun renderArchitectureChallengeModel(projection: ArchitectureChallengeModelProjection): String = buildString {
        appendLine("GAEP governed Architecture Challenge candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage: ${projection.challengeSubjectCount} challenge subjects · ${projection.assumptionCount} assumptions · " +
                "${projection.alternativeCount} alternatives · ${projection.findingCount} findings · ${projection.responseCount} responses",
        )
        appendLine(
            "Candidate gaps: ${projection.unrespondedFindingCount} unresponded findings · " +
                "${projection.unresolvedAssumptionCount} unresolved assumptions · ${projection.unresolvedRequirementCount} requirements · " +
                "${projection.inconsistencyCount} inconsistencies · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.model?.let { record ->
            appendLine("Architecture challenge candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
        } ?: appendLine("Architecture challenge candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no challenge content, assumptions, evidence, findings, responses, " +
                "Source content, personal data, local paths, secrets, or credentials and does not complete independent review, " +
                "establish assurance, accept risk, approve architecture, establish operational readiness, or authorize action.",
        )
    }

    fun readDecisionRegister(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readDecisionRegister(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Decision Register was read. Refresh the exact records." }
        return renderDecisionRegister(projection)
    }

    fun renderDecisionRegister(projection: DecisionRegisterProjection): String = buildString {
        appendLine("GAEP governed Decision Register candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine("Coverage: ${projection.decisionCount} decisions")
        appendLine(
            "Candidate gaps: ${projection.unresolvedDecisionCount} unresolved decisions · " +
                "${projection.selectedPendingDecisionCount} selected pending decisions · " +
                "${projection.deferredDecisionCount} deferred decisions · ${projection.unresolvedRequirementCount} requirements · " +
                "${projection.inconsistencyCount} inconsistencies · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.register?.let { record ->
            appendLine("Decision Register candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
        } ?: appendLine("Decision Register candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no decision questions, options, recommendations, outcomes, rationale, " +
                "evidence, subject content, personal data, local paths, secrets, or credentials and does not establish " +
                "decision effectiveness, approval, risk acceptance, baseline promotion, operational readiness, or action authority.",
        )
    }

    fun readRiskRegister(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readRiskRegister(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Risk Register was read. Refresh the exact records." }
        return renderRiskRegister(projection)
    }

    fun renderRiskRegister(projection: RiskRegisterProjection): String = buildString {
        appendLine("GAEP governed Risk Register candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage: ${projection.riskCount} risks · ${projection.proposedTreatmentCount} proposed treatments · " +
                "${projection.unassignedOwnerCount} owner assignments not established",
        )
        appendLine(
            "Candidate gaps: ${projection.notAssessedRiskCount} not assessed · " +
                "${projection.unresolvedResidualRiskCount} residual risks · ${projection.unverifiedControlCount} control effectiveness gaps · " +
                "${projection.unresolvedRequirementCount} requirements · ${projection.inconsistencyCount} inconsistencies · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.register?.let { record ->
            appendLine("Risk Register candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
        } ?: appendLine("Risk Register candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no risk statements, assessments, controls, treatments, residual risk, " +
                "evidence, related-record content, personal data, local paths, secrets, or credentials and does not establish " +
                "assessment fact, owner assignment, control effectiveness, risk acceptance, approval, exception, baseline promotion, " +
                "operational readiness, or action authority.",
        )
    }

    fun readEvidenceRegistry(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readEvidenceRegistry(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the Evidence Registry was read. Refresh the exact records." }
        return renderEvidenceRegistry(projection)
    }

    fun renderEvidenceRegistry(projection: EvidenceRegistryProjection): String = buildString {
        appendLine("GAEP governed Evidence Registry candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage: ${projection.claimCount} claims · ${projection.evidenceItemCount} evidence items · " +
                "${projection.linkCount} claim/evidence links",
        )
        appendLine(
            "Candidate gaps: ${projection.notAssessedClaimCount} claims not assessed · " +
                "${projection.notAssessedEvidenceCount} evidence items not assessed · " +
                "${projection.adverseEvidencePendingDispositionCount} adverse dispositions pending · " +
                "${projection.staleOrUnknownEvidenceCount} stale or unknown · ${projection.invalidatedEvidenceCount} invalidated · " +
                "${projection.unresolvedLinkCount} unresolved links · ${projection.unresolvedRequirementCount} requirements · " +
                "${projection.inconsistencyCount} inconsistencies · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.registry?.let { record ->
            appendLine("Evidence Registry candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
        } ?: appendLine("Evidence Registry candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no claim statements, evidence observations, methods, warrants, " +
                "quality details, Source content, personal data, local paths, secrets, or credentials and does not establish " +
                "claim validation, evidence sufficiency, assurance, review, approval, risk acceptance, operational readiness, or action authority.",
        )
    }

    fun readEndToEndTraceability(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readEndToEndTraceability(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while End-to-End Traceability was read. Refresh the exact records." }
        return renderEndToEndTraceability(projection)
    }

    fun renderEndToEndTraceability(projection: EndToEndTraceabilityProjection): String = buildString {
        appendLine("GAEP governed End-to-End Traceability candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage: ${projection.nodeCount} nodes · ${projection.relationshipCount} relationship types · " +
                "${projection.linkCount} links · ${projection.transformationCount} transformations",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedEndpointCount} unresolved endpoints · " +
                "${projection.notAssessedSemanticCount} semantic reviews pending · " +
                "${projection.missingSpineCount} missing spine segments · " +
                "${projection.unknownRelationshipCount} unknown relationships · " +
                "${projection.unresolvedRequirementCount} requirements · " +
                "${projection.inconsistencyCount} inconsistencies · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.traceability?.let { record ->
            appendLine("End-to-End Traceability candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
        } ?: appendLine("End-to-End Traceability candidate: not recorded")
        appendLine()
        appendLine("Coverage boundary: ${projection.coverageBoundary}")
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no node content, link rationale, transformation detail, Source content, " +
                "personal data, local paths, secrets, or credentials; absence does not prove no impact or relationship, and " +
                "presence does not establish relationship truth, completeness, approval, baseline promotion, operational " +
                "readiness, or action authority.",
        )
    }

    fun readP0P4ReadinessGate(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readP0P4ReadinessGate(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the P0-P4 Readiness Gate was read. Refresh the exact records." }
        return renderP0P4ReadinessGate(projection)
    }

    fun renderP0P4ReadinessGate(projection: P0P4ReadinessGateProjection): String = buildString {
        appendLine("GAEP governed P0-P4 Readiness Gate candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Evaluation result: ${projection.result}")
        appendLine("Outputs: ${projection.satisfiedOutputCount}/${projection.applicableOutputCount} applicable satisfied · ${projection.notApplicableOutputCount} candidate not applicable · ${projection.unresolvedApplicabilityCount} unresolved applicability")
        appendLine(
            "Candidate gaps: ${projection.blockedOutputCount} blocked · ${projection.failedOutputCount} failed · " +
                "${projection.incompleteOutputCount} incomplete · ${projection.conditionalOutputCount} conditional · " +
                "${projection.staleOrUnknownOutputCount} stale or unknown · ${projection.pendingOrInvalidWaiverCount} waiver gaps · " +
                "${projection.unresolvedDecisionCount} open decisions · ${projection.unmetConditionCount} unmet conditions · " +
                "${projection.unresolvedRequirementCount} requirements · ${projection.adverseEvidenceCount} adverse evidence · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.gate?.let { record ->
            appendLine("P0-P4 Readiness Gate candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Evaluation definition digest: ${record.evaluationDefinitionDigest}")
            appendLine("Candidate inventory: ${record.outputCount} outputs · ${record.waiverCount} waivers · ${record.unresolvedDecisionCount} open decisions · ${record.conditionCount} conditions")
        } ?: appendLine("P0-P4 Readiness Gate candidate: not recorded")
        appendLine()
        appendLine("Gate boundary: ${projection.gateBoundary}")
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: a readiness evaluation result does not grant approval, accept a waiver, authorize phase entry or implementation, " +
                "promote a baseline, establish Product readiness, or authorize action.",
        )
    }

    fun readP5HandoffPackage(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readP5HandoffPackage(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while the P5 Handoff Package was read. Refresh the exact records." }
        return renderP5HandoffPackage(projection)
    }

    fun renderP5HandoffPackage(projection: P5HandoffPackageProjection): String = buildString {
        appendLine("GAEP governed P5 Handoff Package candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState}")
        appendLine("Readiness result: ${projection.readinessResult} · transfer state: ${projection.transferState}")
        appendLine(
            "Items: ${projection.includedItemCount} included · ${projection.referenceOnlyItemCount} exact references · " +
                "${projection.omittedNotApplicableItemCount} candidate not applicable · ${projection.unresolvedItemCount} unresolved",
        )
        appendLine(
            "Candidate gaps: ${projection.staleOrUnknownItemCount} stale or unknown applicable items · " +
                "${projection.lossyTransformationCount} lossy transformations · ${projection.unresolvedRequirementCount} requirements · " +
                "${projection.conflictCount} conflicts · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.handoff?.let { record ->
            appendLine("P5 Handoff Package candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Readiness assessment digest: ${record.readinessStatusDigest}")
            appendLine("Candidate inventory: ${record.itemCount} items · ${record.requirementCount} requirements · ${record.deliveryMode} delivery")
        } ?: appendLine("P5 Handoff Package candidate: not recorded")
        appendLine()
        appendLine("Handoff boundary: ${projection.handoffBoundary}")
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: source ownership remains retained; complete for review is not acknowledgement, readiness approval, " +
                "design approval, a Design Baseline, P5 entry, transfer authority, write authority, or action authority.",
        )
    }

    fun readDesignApplicability(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readDesignApplicability(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Design Applicability was read. Refresh the exact records." }
        return renderDesignApplicability(projection)
    }

    fun readDesignPersonaRoleModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readDesignPersonaRoleModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Design Personas and Roles were read. Refresh the exact records." }
        return renderDesignPersonaRoleModel(projection)
    }

    fun renderDesignPersonaRoleModel(projection: DesignPersonaRoleProjection): String = buildString {
        appendLine("GAEP governed Design Personas and Roles candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Coverage: ${projection.personaCount} personas · ${projection.designRoleCount} design roles · " +
                "${projection.representedParticipantCategoryCount}/5 participant categories · " +
                "${projection.representedRoleKindCount}/4 role kinds",
        )
        appendLine(
            "Persona evidence: ${projection.humanReviewedPersonaCount} human-reviewed · " +
                "${projection.weakEvidencePersonaCount} weak-evidence",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedParticipantCategoryCount} unresolved participant categories · " +
                "${projection.unresolvedRoleKindCount} unresolved role kinds · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Design Personas and Roles candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Candidate inventory: ${record.personaCount} personas · ${record.designRoleCount} design roles · ${record.reviewState}")
        } ?: appendLine("Design Personas and Roles candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: purpose-limited candidate persona hypotheses and responsibilities only; no persona validation, " +
                "role appointment, competence verification, design approval, readiness, write, or action authority.",
        )
    }

    fun readUserJourneyModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readUserJourneyModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while User Journeys were read. Refresh the exact records." }
        return renderUserJourneyModel(projection)
    }

    fun renderUserJourneyModel(projection: UserJourneyProjection): String = buildString {
        appendLine("GAEP governed User Journeys candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine("Inventory: ${projection.journeyCount} journeys · ${projection.touchpointCount} touchpoints")
        appendLine(
            "Paths: ${projection.primaryPathCount} primary · ${projection.successPathCount} success · " +
                "${projection.failurePathCount} failure · ${projection.recoveryPathCount} recovery",
        )
        appendLine(
            "Scope coverage: ${projection.representedScopeCount} represented · ${projection.unresolvedScopeCount} unresolved",
        )
        appendLine(
            "Candidate gaps: ${projection.weakEvidencePathCount} weak-evidence paths · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("User Journeys candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Candidate inventory: ${record.journeyCount} journeys · ${record.touchpointCount} touchpoints · ${record.reviewState}")
        } ?: appendLine("User Journeys candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate journey structure and coverage metadata only; no observed-behavior proof, " +
                "journey validation, design approval, readiness, write, or action authority.",
        )
    }

    fun readInformationArchitectureModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readInformationArchitectureModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Information Architecture was read. Refresh the exact records." }
        return renderInformationArchitectureModel(projection)
    }

    fun renderInformationArchitectureModel(projection: InformationArchitectureProjection): String = buildString {
        appendLine("GAEP governed Information Architecture candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine("Inventory: ${projection.nodeCount} nodes · ${projection.rootNodeCount} roots · ${projection.routeCount} routes")
        appendLine(
            "Scope coverage: ${projection.representedScopeCount} represented · ${projection.unresolvedScopeCount} unresolved",
        )
        appendLine(
            "Candidate gaps: ${projection.weakEvidenceNodeCount} weak-evidence nodes · " +
                "${projection.weakEvidenceRouteCount} weak-evidence routes · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Information Architecture candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate inventory: ${record.nodeCount} nodes · ${record.rootNodeCount} roots · " +
                    "${record.routeCount} routes · ${record.reviewState}",
            )
        } ?: appendLine("Information Architecture candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate hierarchy, content-model, and route metadata only; no findability, " +
                "comprehension, accessibility, or content validation, design approval, readiness, write, or action authority.",
        )
    }

    fun readScreenStateInventory(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readScreenStateInventory(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Screen and State Inventory was read. Refresh the exact records." }
        return renderScreenStateInventory(projection)
    }

    fun renderScreenStateInventory(projection: ScreenStateInventoryProjection): String = buildString {
        appendLine("GAEP governed Screen and State Inventory candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Platforms: ${projection.platformCount} total · ${projection.targetedPlatformCount} targeted · " +
                "${projection.unresolvedPlatformCount} unresolved",
        )
        appendLine(
            "Inventory: ${projection.screenCount} screens · ${projection.stateCount} states · " +
                "${projection.variantCount} variants",
        )
        appendLine(
            "Route coverage: ${projection.representedRouteCount} represented · ${projection.unresolvedRouteCount} unresolved",
        )
        appendLine(
            "Scope coverage: ${projection.representedScopeCount} represented · ${projection.unresolvedScopeCount} unresolved",
        )
        appendLine(
            "Candidate gaps: ${projection.weakEvidenceItemCount} weak-evidence items · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Screen and State Inventory candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate inventory: ${record.platformCount} platforms · ${record.screenCount} screens · " +
                    "${record.stateCount} states · ${record.variantCount} variants · ${record.reviewState}",
            )
        } ?: appendLine("Screen and State Inventory candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate platform, screen, state, variant, and coverage metadata only; no UI " +
                "completeness, platform parity, state reachability, interaction quality, accessibility proof, design " +
                "approval, readiness, write, or action authority.",
        )
    }

    fun readDesignRequirements(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readDesignRequirements(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Design Requirements were read. Refresh the exact records." }
        return renderDesignRequirements(projection)
    }

    fun renderDesignRequirements(projection: DesignRequirementsProjection): String = buildString {
        appendLine("GAEP governed Design Requirements candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine(
            "Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState} · " +
                "catalog: ${projection.catalogCompletenessState}",
        )
        appendLine(
            "Inventory: ${projection.requirementCount} requirements · ${projection.mustPriorityCount} must-priority · " +
                "${projection.workItemCount} Work Items",
        )
        appendLine(
            "Outcome coverage: ${projection.representedOutcomeCount} represented · " +
                "${projection.unresolvedOutcomeCount} unresolved",
        )
        appendLine(
            "Backlog disposition: ${projection.linkedBacklogRequirementCount} linked · " +
                "${projection.notPlannedRequirementCount} not planned · " +
                "${projection.unresolvedBacklogRequirementCount} unresolved",
        )
        appendLine(
            "Candidate gaps: ${projection.weakEvidenceRequirementCount} weak-evidence requirements · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleDomainReferenceCount} stale domain references · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Design Requirements candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate inventory: ${record.requirementCount} requirements · " +
                    "${record.representedOutcomeCount} represented outcomes · ${record.workItemCount} Work Items · " +
                    record.reviewState,
            )
        } ?: appendLine("Design Requirements candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and digests only; no requirement validity, " +
                "completeness, priority approval, satisfaction, backlog commitment, design approval, readiness, " +
                "implementation, write, or action authority.",
        )
    }

    fun readBacklogHierarchy(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readBacklogHierarchy(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Backlog Hierarchy was read. Refresh the exact records." }
        return renderBacklogHierarchy(projection)
    }

    fun renderBacklogHierarchy(projection: BacklogHierarchyProjection): String = buildString {
        appendLine("GAEP governed Backlog Hierarchy candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine(
            "Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState} · " +
                "hierarchy: ${projection.hierarchyCompletenessState}",
        )
        appendLine(
            "Hierarchy: ${projection.epicCount} Epics · ${projection.featureCount} Features · " +
                "${projection.storyCount} Stories · ${projection.taskCount} Tasks",
        )
        appendLine(
            "Topology and trace: ${projection.rootCount} roots · ${projection.leafCount} leaves · " +
                "${projection.requirementTraceCount} Requirement traces",
        )
        appendLine(
            "Candidate gaps: ${projection.untracedStoryTaskCount} untraced delivery nodes · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleWorkItemCount} stale Work Items · ${projection.staleChangeCount} stale Changes · " +
                "${projection.staleRequirementCount} stale Requirements",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Backlog Hierarchy candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate hierarchy: ${record.epicCount} Epics · ${record.featureCount} Features · " +
                    "${record.storyCount} Stories · ${record.taskCount} Tasks · " +
                    "${record.requirementTraceCount} Requirement traces · ${record.reviewState}",
            )
        } ?: appendLine("Backlog Hierarchy candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, level counts, statuses, and digests only; no backlog " +
                "objectives, criteria, scope, owners, Requirement content, personal data, priority, commitment, " +
                "ready or done, implementation readiness, assignment, execution, implementation authority, or action authority.",
        )
    }

    fun readMvpSliceDefinition(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val hierarchy = client.readBacklogHierarchy(initiativeId)
        val projection = client.readMvpSliceDefinition(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while MVP and Vertical Slice Definition was read. Refresh the exact records." }
        projection.candidate?.let {
            val currentHierarchy = requireNotNull(hierarchy.candidate) {
                "The current Backlog Hierarchy is unavailable. Refresh the exact records."
            }
            require(
                projection.hierarchyRecordId == currentHierarchy.id &&
                    projection.hierarchyRevision == currentHierarchy.revision &&
                    projection.hierarchyDigest == currentHierarchy.digest && it.hierarchyDigest == currentHierarchy.digest
            ) { "The Backlog Hierarchy changed while MVP and Vertical Slice Definition was read. Refresh the exact records." }
        }
        return renderMvpSliceDefinition(projection)
    }

    fun renderMvpSliceDefinition(projection: MvpSliceDefinitionProjection): String = buildString {
        appendLine("GAEP governed MVP and Vertical Slice candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState} · scope: ${projection.scopeCompletenessState}")
        appendLine("Scope: ${projection.scopeNodeCount} nodes · ${projection.mvpNodeCount} MVP · ${projection.laterNodeCount} later · ${projection.excludedNodeCount} excluded")
        appendLine("Vertical Slices: ${projection.sliceCount} slices · ${projection.storyCount} Stories · ${projection.taskCount} Tasks · ${projection.dependencyCount} dependencies")
        appendLine(
            "Candidate gaps: ${projection.unassignedMvpStoryTaskCount} unassigned MVP Stories or Tasks · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleHierarchyCount} stale hierarchies · ${projection.invalidScopeCount} invalid scope entries · " +
                "${projection.invalidSliceCount} invalid slices",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("MVP and Vertical Slice candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Exact Backlog Hierarchy digest: ${record.hierarchyDigest}")
            appendLine("Candidate scope: ${record.scopeNodeCount} nodes · ${record.mvpNodeCount} MVP · ${record.laterNodeCount} later · ${record.excludedNodeCount} excluded")
            appendLine("Candidate slices: ${record.sliceCount} slices · ${record.storyCount} Stories · ${record.taskCount} Tasks · ${record.reviewState}")
        } ?: appendLine("MVP and Vertical Slice candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, scope and slice counts, statuses, and digests only; no slice " +
                "titles, rationales, objectives, criteria, scope content, Requirement content, personal data, priority, " +
                "commitment, scope approval, acceptance-criteria validity, ready or done, implementation readiness, " +
                "assignment, execution, implementation authority, or action authority.",
        )
    }

    fun readPrioritizationModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val mvp = client.readMvpSliceDefinition(initiativeId)
        val projection = client.readPrioritizationModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Prioritization Model was read. Refresh the exact records." }
        projection.candidate?.let {
            val currentMvp = requireNotNull(mvp.candidate) {
                "The current MVP and Vertical Slice candidate is unavailable. Refresh the exact records."
            }
            require(
                projection.mvpSliceDefinitionRecordId == currentMvp.id &&
                    projection.mvpSliceDefinitionRevision == currentMvp.revision &&
                    projection.mvpSliceDefinitionDigest == currentMvp.digest
            ) { "The MVP and Vertical Slice Definition changed while Prioritization Model was read. Refresh the exact records." }
        }
        return renderPrioritizationModel(projection)
    }

    fun renderPrioritizationModel(projection: PrioritizationModelProjection): String = buildString {
        appendLine("GAEP governed Prioritization Model candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine("Coverage: ${projection.subjectCount} slices · ${projection.scoredSubjectCount} scored · ${projection.unassessedSubjectCount} unassessed · ${projection.evidenceReferenceCount} evidence references · ${projection.tieCount} score ties")
        appendLine(
            "Candidate gaps: ${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleMvpSliceDefinitionCount} stale MVP definitions · ${projection.invalidSubjectCount} invalid subjects · " +
                "${projection.invalidScoreCount} invalid scores",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Prioritization Model candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Method digest: ${record.methodDigest}")
            appendLine("Candidate ranking digest: ${record.rankingDigest}")
            appendLine("Candidate coverage: ${record.subjectCount} slices · ${record.scoredSubjectCount} scored · ${record.evidenceReferenceCount} evidence references · ${record.reviewState}")
        } ?: appendLine("Prioritization Model candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, method, membership, ranking, and snapshot digests only; " +
                "no dimension estimates, evidence identities, uncertainty, slice content, personal data, evidence validity, priority, " +
                "commitment, scope decisions, approval, acceptance-criteria validity, ready or done, implementation readiness, " +
                "assignment, execution, implementation authority, or action authority.",
        )
    }

    fun readAcceptanceCriteria(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val hierarchy = client.readBacklogHierarchy(initiativeId)
        val mvp = client.readMvpSliceDefinition(initiativeId)
        val prioritization = client.readPrioritizationModel(initiativeId)
        val projection = client.readAcceptanceCriteria(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Acceptance Criteria was read. Refresh the exact records." }
        projection.candidate?.let {
            val currentHierarchy = requireNotNull(hierarchy.candidate) {
                "The current Backlog Hierarchy candidate is unavailable. Refresh the exact records."
            }
            val currentMvp = requireNotNull(mvp.candidate) {
                "The current MVP and Vertical Slice candidate is unavailable. Refresh the exact records."
            }
            val currentPrioritization = requireNotNull(prioritization.candidate) {
                "The current Prioritization Model candidate is unavailable. Refresh the exact records."
            }
            require(
                projection.hierarchyRecordId == currentHierarchy.id &&
                    projection.hierarchyRevision == currentHierarchy.revision &&
                    projection.hierarchyDigest == currentHierarchy.digest
            ) { "The Backlog Hierarchy changed while Acceptance Criteria was read. Refresh the exact records." }
            require(
                projection.mvpSliceDefinitionRecordId == currentMvp.id &&
                    projection.mvpSliceDefinitionRevision == currentMvp.revision &&
                    projection.mvpSliceDefinitionDigest == currentMvp.digest
            ) { "The MVP and Vertical Slice Definition changed while Acceptance Criteria was read. Refresh the exact records." }
            require(
                projection.prioritizationModelRecordId == currentPrioritization.id &&
                    projection.prioritizationModelRevision == currentPrioritization.revision &&
                    projection.prioritizationModelDigest == currentPrioritization.digest
            ) { "The Prioritization Model changed while Acceptance Criteria was read. Refresh the exact records." }
        }
        return renderAcceptanceCriteria(projection)
    }

    fun renderAcceptanceCriteria(projection: AcceptanceCriteriaProjection): String = buildString {
        appendLine("GAEP governed Acceptance Criteria candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine(
            "Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState} · " +
                "criterion set: ${projection.criterionSetCompletenessState} · Requirement coverage: ${projection.requirementCoverageState}",
        )
        appendLine(
            "Coverage: ${projection.subjectCount} Story/Task subjects · ${projection.coveredSubjectCount} covered · " +
                "${projection.uncoveredSubjectCount} uncovered · ${projection.criterionCount} criteria · " +
                "${projection.testableCriterionCount} testable · ${projection.unassessedCriterionCount} unassessed",
        )
        appendLine(
            "Traces and methods: ${projection.requirementTraceCount} Requirement traces · " +
                "${projection.uncoveredRequirementCount} uncovered Requirements · ${projection.verificationMethodCount} methods",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleHierarchyCount} stale hierarchies · ${projection.staleMvpSliceDefinitionCount} stale MVP definitions · " +
                "${projection.stalePrioritizationModelCount} stale prioritization models · ${projection.invalidCriterionCount} invalid criteria",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Acceptance Criteria candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Subject catalog digest: ${record.subjectCatalogDigest}")
            appendLine("Criterion catalog digest: ${record.criterionCatalogDigest}")
            appendLine("Verification-method catalog digest: ${record.verificationMethodCatalogDigest}")
            appendLine("Coverage digest: ${record.coverageDigest}")
            appendLine(
                "Candidate coverage: ${record.subjectCount} subjects · ${record.criterionCount} criteria · " +
                    "${record.testableCriterionCount} testable · ${record.requirementTraceCount} Requirement traces · " +
                    "${record.verificationMethodCount} methods · ${record.reviewState}",
            )
        } ?: appendLine("Acceptance Criteria candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and subject, criterion, method, coverage, and " +
                "snapshot digests only; no criterion text, Requirement identities, verification evidence, personal data, " +
                "criterion validity, completeness, Requirement satisfaction, priority, commitment, approval, ready or done, " +
                "implementation readiness, assignment, execution, acceptance, implementation authority, or action authority.",
        )
    }

    fun readDefinitionOfReady(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val hierarchy = client.readBacklogHierarchy(initiativeId)
        val mvp = client.readMvpSliceDefinition(initiativeId)
        val prioritization = client.readPrioritizationModel(initiativeId)
        val criteria = client.readAcceptanceCriteria(initiativeId)
        val projection = client.readDefinitionOfReady(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Definition of Ready was read. Refresh the exact records." }
        projection.candidate?.let {
            val currentHierarchy = requireNotNull(hierarchy.candidate) { "The current Backlog Hierarchy candidate is unavailable. Refresh the exact records." }
            val currentMvp = requireNotNull(mvp.candidate) { "The current MVP and Vertical Slice candidate is unavailable. Refresh the exact records." }
            val currentPrioritization = requireNotNull(prioritization.candidate) { "The current Prioritization Model candidate is unavailable. Refresh the exact records." }
            val currentCriteria = requireNotNull(criteria.candidate) { "The current Acceptance Criteria candidate is unavailable. Refresh the exact records." }
            require(
                projection.hierarchyRecordId == currentHierarchy.id && projection.hierarchyRevision == currentHierarchy.revision &&
                    projection.hierarchyDigest == currentHierarchy.digest
            ) { "The Backlog Hierarchy changed while Definition of Ready was read. Refresh the exact records." }
            require(
                projection.mvpSliceDefinitionRecordId == currentMvp.id && projection.mvpSliceDefinitionRevision == currentMvp.revision &&
                    projection.mvpSliceDefinitionDigest == currentMvp.digest
            ) { "The MVP and Vertical Slice Definition changed while Definition of Ready was read. Refresh the exact records." }
            require(
                projection.prioritizationModelRecordId == currentPrioritization.id && projection.prioritizationModelRevision == currentPrioritization.revision &&
                    projection.prioritizationModelDigest == currentPrioritization.digest
            ) { "The Prioritization Model changed while Definition of Ready was read. Refresh the exact records." }
            require(
                projection.acceptanceCriteriaRecordId == currentCriteria.id && projection.acceptanceCriteriaRevision == currentCriteria.revision &&
                    projection.acceptanceCriteriaDigest == currentCriteria.digest
            ) { "Acceptance Criteria changed while Definition of Ready was read. Refresh the exact records." }
        }
        return renderDefinitionOfReady(projection)
    }

    fun renderDefinitionOfReady(projection: DefinitionOfReadyProjection): String = buildString {
        appendLine("GAEP governed Definition of Ready candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.result} · review state: ${projection.reviewState}")
        appendLine(
            "Coverage: ${projection.subjectCount} Story/Task subjects · ${projection.policyEntryCount} prerequisites · " +
                "${projection.evaluationCount}/${projection.expectedEvaluationCount} evaluations · ${projection.missingEvaluationCount} missing",
        )
        appendLine(
            "Evaluation states: ${projection.candidateSatisfiedCount} candidate-satisfied · ${projection.notApplicableCount} not-applicable candidates · " +
                "${projection.notSatisfiedCount} not satisfied · ${projection.exceptionCandidateCount} exception candidates · " +
                "${projection.notAssessedCount} unassessed · ${projection.staleEvaluationCount} stale · ${projection.invalidEvaluationCount} invalid",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedQuestionCount} questions · ${projection.expiredCount} expired · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleHierarchyCount} stale hierarchies · " +
                "${projection.staleMvpSliceDefinitionCount} stale MVP definitions · " +
                "${projection.stalePrioritizationModelCount} stale prioritization models · " +
                "${projection.staleAcceptanceCriteriaCount} stale Acceptance Criteria",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Definition of Ready candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Policy version: ${record.policyVersion} · valid until ${record.validUntil}")
            appendLine("Subject catalog digest: ${record.subjectCatalogDigest}")
            appendLine("Policy digest: ${record.policyDigest}")
            appendLine("Evaluation digest: ${record.evaluationDigest}")
            appendLine("Receipt digest: ${record.receiptDigest}")
            appendLine(
                "Candidate coverage: ${record.subjectCount} subjects · ${record.policyEntryCount} prerequisites · " +
                    "${record.evaluationCount} evaluations · ${record.reviewState}",
            )
        } ?: appendLine("Definition of Ready candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, validity time, and subject, policy, evaluation, receipt, " +
                "and snapshot digests only; no rules, rationales, evidence identities, assessor identities, or personal data. " +
                "A candidate pass is an evaluation result, not admission, readiness, assignment, execution, implementation " +
                "permission, exception or waiver authority, phase entry, acceptance, or action authority.",
        )
    }

    fun readDefinitionOfDone(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val hierarchy = client.readBacklogHierarchy(initiativeId)
        val mvp = client.readMvpSliceDefinition(initiativeId)
        val prioritization = client.readPrioritizationModel(initiativeId)
        val criteria = client.readAcceptanceCriteria(initiativeId)
        val ready = client.readDefinitionOfReady(initiativeId)
        val projection = client.readDefinitionOfDone(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Definition of Done was read. Refresh the exact records." }
        projection.candidate?.let {
            val currentHierarchy = requireNotNull(hierarchy.candidate) { "The current Backlog Hierarchy candidate is unavailable. Refresh the exact records." }
            val currentMvp = requireNotNull(mvp.candidate) { "The current MVP and Vertical Slice candidate is unavailable. Refresh the exact records." }
            val currentPrioritization = requireNotNull(prioritization.candidate) { "The current Prioritization Model candidate is unavailable. Refresh the exact records." }
            val currentCriteria = requireNotNull(criteria.candidate) { "The current Acceptance Criteria candidate is unavailable. Refresh the exact records." }
            val currentReady = requireNotNull(ready.candidate) { "The current Definition of Ready candidate is unavailable. Refresh the exact records." }
            require(
                projection.hierarchyRecordId == currentHierarchy.id && projection.hierarchyRevision == currentHierarchy.revision &&
                    projection.hierarchyDigest == currentHierarchy.digest
            ) { "The Backlog Hierarchy changed while Definition of Done was read. Refresh the exact records." }
            require(
                projection.mvpSliceDefinitionRecordId == currentMvp.id && projection.mvpSliceDefinitionRevision == currentMvp.revision &&
                    projection.mvpSliceDefinitionDigest == currentMvp.digest
            ) { "The MVP and Vertical Slice Definition changed while Definition of Done was read. Refresh the exact records." }
            require(
                projection.prioritizationModelRecordId == currentPrioritization.id && projection.prioritizationModelRevision == currentPrioritization.revision &&
                    projection.prioritizationModelDigest == currentPrioritization.digest
            ) { "The Prioritization Model changed while Definition of Done was read. Refresh the exact records." }
            require(
                projection.acceptanceCriteriaRecordId == currentCriteria.id && projection.acceptanceCriteriaRevision == currentCriteria.revision &&
                    projection.acceptanceCriteriaDigest == currentCriteria.digest
            ) { "Acceptance Criteria changed while Definition of Done was read. Refresh the exact records." }
            require(
                projection.definitionOfReadyRecordId == currentReady.id && projection.definitionOfReadyRevision == currentReady.revision &&
                    projection.definitionOfReadyDigest == currentReady.digest
            ) { "Definition of Ready changed while Definition of Done was read. Refresh the exact records." }
        }
        return renderDefinitionOfDone(projection)
    }

    fun renderDefinitionOfDone(projection: DefinitionOfDoneProjection): String = buildString {
        appendLine("GAEP governed Definition of Done candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.result} · review state: ${projection.reviewState}")
        appendLine(
            "Coverage: ${projection.subjectCount} Story/Task subjects · ${projection.policyEntryCount} completion prerequisites · " +
                "${projection.evaluationCount}/${projection.expectedEvaluationCount} evaluations · ${projection.missingEvaluationCount} missing",
        )
        appendLine(
            "Evaluation states: ${projection.candidateSatisfiedCount} candidate-satisfied · ${projection.notApplicableCount} not-applicable candidates · " +
                "${projection.notSatisfiedCount} not satisfied · ${projection.exceptionCandidateCount} exception candidates · " +
                "${projection.notAssessedCount} unassessed · ${projection.staleEvaluationCount} stale · ${projection.invalidEvaluationCount} invalid",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedQuestionCount} questions · ${projection.expiredCount} expired · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleHierarchyCount} stale hierarchies · " +
                "${projection.staleMvpSliceDefinitionCount} stale MVP definitions · " +
                "${projection.stalePrioritizationModelCount} stale prioritization models · " +
                "${projection.staleAcceptanceCriteriaCount} stale Acceptance Criteria · " +
                "${projection.staleDefinitionOfReadyCount} stale Definitions of Ready",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Definition of Done candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Policy version: ${record.policyVersion} · valid until ${record.validUntil}")
            appendLine("Subject catalog digest: ${record.subjectCatalogDigest}")
            appendLine("Policy digest: ${record.policyDigest}")
            appendLine("Evaluation digest: ${record.evaluationDigest}")
            appendLine("Receipt digest: ${record.receiptDigest}")
            appendLine(
                "Candidate coverage: ${record.subjectCount} subjects · ${record.policyEntryCount} completion prerequisites · " +
                    "${record.evaluationCount} evaluations · ${record.reviewState}",
            )
        } ?: appendLine("Definition of Done candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, validity time, and subject, policy, evaluation, receipt, " +
                "and snapshot digests only; no rules, rationales, evidence identities, assessor identities, or personal data. " +
                "A candidate pass is an evaluation result, not completion, acceptance, approval, merge, release, deployment, " +
                "implementation completeness, exception or waiver authority, assignment, execution, or action permission.",
        )
    }

    fun readImplementationUnitModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val hierarchy = client.readBacklogHierarchy(initiativeId)
        val mvp = client.readMvpSliceDefinition(initiativeId)
        val criteria = client.readAcceptanceCriteria(initiativeId)
        val ready = client.readDefinitionOfReady(initiativeId)
        val done = client.readDefinitionOfDone(initiativeId)
        val projection = client.readImplementationUnitModel(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Implementation Unit Model was read. Refresh the exact records." }
        projection.candidate?.let {
            val currentHierarchy = requireNotNull(hierarchy.candidate) { "The current Backlog Hierarchy candidate is unavailable. Refresh the exact records." }
            val currentMvp = requireNotNull(mvp.candidate) { "The current MVP and Vertical Slice candidate is unavailable. Refresh the exact records." }
            val currentCriteria = requireNotNull(criteria.candidate) { "The current Acceptance Criteria candidate is unavailable. Refresh the exact records." }
            val currentReady = requireNotNull(ready.candidate) { "The current Definition of Ready candidate is unavailable. Refresh the exact records." }
            val currentDone = requireNotNull(done.candidate) { "The current Definition of Done candidate is unavailable. Refresh the exact records." }
            require(
                projection.hierarchyRecordId == currentHierarchy.id && projection.hierarchyRevision == currentHierarchy.revision &&
                    projection.hierarchyDigest == currentHierarchy.digest
            ) { "The Backlog Hierarchy changed while Implementation Unit Model was read. Refresh the exact records." }
            require(
                projection.mvpSliceDefinitionRecordId == currentMvp.id && projection.mvpSliceDefinitionRevision == currentMvp.revision &&
                    projection.mvpSliceDefinitionDigest == currentMvp.digest
            ) { "The MVP and Vertical Slice Definition changed while Implementation Unit Model was read. Refresh the exact records." }
            require(
                projection.acceptanceCriteriaRecordId == currentCriteria.id && projection.acceptanceCriteriaRevision == currentCriteria.revision &&
                    projection.acceptanceCriteriaDigest == currentCriteria.digest
            ) { "Acceptance Criteria changed while Implementation Unit Model was read. Refresh the exact records." }
            require(
                projection.definitionOfReadyRecordId == currentReady.id && projection.definitionOfReadyRevision == currentReady.revision &&
                    projection.definitionOfReadyDigest == currentReady.digest
            ) { "Definition of Ready changed while Implementation Unit Model was read. Refresh the exact records." }
            require(
                projection.definitionOfDoneRecordId == currentDone.id && projection.definitionOfDoneRevision == currentDone.revision &&
                    projection.definitionOfDoneDigest == currentDone.digest
            ) { "Definition of Done changed while Implementation Unit Model was read. Refresh the exact records." }
        }
        return renderImplementationUnitModel(projection)
    }

    fun renderImplementationUnitModel(projection: ImplementationUnitModelProjection): String = buildString {
        appendLine("GAEP governed Implementation Unit Model candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.state} · review state: ${projection.reviewState}")
        appendLine(
            "Coverage: ${projection.unitCount} units · ${projection.subjectCount} Story/Task subjects · " +
                "${projection.requirementReferenceCount} Requirement references · ${projection.repositoryCandidateCount} repository candidates · " +
                "${projection.ownerCandidateCount} owner candidates",
        )
        appendLine(
            "Dependencies and impact: ${projection.dependencyEdgeCount} dependency edges · " +
                "${projection.candidateAssessedBlastRadiusCount} blast radii candidate-assessed · " +
                "${projection.notAssessedBlastRadiusCount} not assessed",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedQuestionCount} questions · ${projection.missingSubjectCount} missing subjects · " +
                "${projection.invalidUnitCount} invalid units · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleHierarchyCount} stale hierarchies · ${projection.staleMvpSliceDefinitionCount} stale MVP definitions · " +
                "${projection.staleAcceptanceCriteriaCount} stale Acceptance Criteria · " +
                "${projection.staleDefinitionOfReadyCount} stale Definitions of Ready · " +
                "${projection.staleDefinitionOfDoneCount} stale Definitions of Done",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Implementation Unit Model candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Placement digest: ${record.placementDigest}")
            appendLine("Assessment receipt digest: ${record.assessmentReceiptDigest}")
            appendLine(
                "Candidate coverage: ${record.unitCount} units · ${record.subjectCount} subjects · " +
                    "${record.requirementReferenceCount} Requirement references · ${record.reviewState}",
            )
        } ?: appendLine("Implementation Unit Model candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and membership, placement, assessment-receipt, and " +
                "snapshot digests only; no unit titles, boundaries, Story, Task, or Requirement identities, repository keys, " +
                "module paths, owner identities, evidence, rationales, or personal data. Candidate completeness does not " +
                "establish repository truth, owner appointment, dependency or impact completeness, implementation readiness " +
                "or completeness, assignment, execution, approval, acceptance, merge, release, deployment, or action authority.",
        )
    }

    fun readDependencyMapping(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val hierarchy = client.readBacklogHierarchy(initiativeId)
        val mvp = client.readMvpSliceDefinition(initiativeId)
        val units = client.readImplementationUnitModel(initiativeId)
        val projection = client.readDependencyMapping(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Dependency Mapping was read. Refresh the exact records." }
        projection.candidate?.let {
            val currentHierarchy = requireNotNull(hierarchy.candidate) { "The current Backlog Hierarchy candidate is unavailable. Refresh the exact records." }
            val currentMvp = requireNotNull(mvp.candidate) { "The current MVP and Vertical Slice candidate is unavailable. Refresh the exact records." }
            val currentUnits = requireNotNull(units.candidate) { "The current Implementation Unit Model candidate is unavailable. Refresh the exact records." }
            require(
                projection.hierarchyRecordId == currentHierarchy.id && projection.hierarchyRevision == currentHierarchy.revision &&
                    projection.hierarchyDigest == currentHierarchy.digest
            ) { "The Backlog Hierarchy changed while Dependency Mapping was read. Refresh the exact records." }
            require(
                projection.mvpSliceDefinitionRecordId == currentMvp.id && projection.mvpSliceDefinitionRevision == currentMvp.revision &&
                    projection.mvpSliceDefinitionDigest == currentMvp.digest
            ) { "The MVP and Vertical Slice Definition changed while Dependency Mapping was read. Refresh the exact records." }
            require(
                projection.implementationUnitModelRecordId == currentUnits.id &&
                    projection.implementationUnitModelRevision == currentUnits.revision &&
                    projection.implementationUnitModelDigest == currentUnits.digest
            ) { "The Implementation Unit Model changed while Dependency Mapping was read. Refresh the exact records." }
        }
        return renderDependencyMapping(projection)
    }

    fun renderDependencyMapping(projection: DependencyMappingProjection): String = buildString {
        appendLine("GAEP governed Dependency Mapping candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.state} · review state: ${projection.reviewState}")
        appendLine(
            "Graph coverage: ${projection.nodeCount} nodes · ${projection.edgeCount} edges · " +
                "${projection.requiredEdgeCount} required · ${projection.conditionalEdgeCount} conditional · " +
                "${projection.advisoryEdgeCount} advisory",
        )
        appendLine(
            "Candidate critical path: ${projection.criticalPathUnitCount} units · " +
                "${projection.criticalPathCandidateEffortPoints} candidate effort points · " +
                "${projection.rootNodeCount} roots · ${projection.leafNodeCount} leaves",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedQuestionCount} questions · ${projection.missingNodeCount} missing nodes · " +
                "${projection.missingDeclaredEdgeCount} missing declared edges · ${projection.extraEdgeCount} extra edges · " +
                "${projection.invalidNodeCount} invalid nodes · ${projection.invalidEdgeCount} invalid edges · " +
                "${projection.cycleCount} cycles · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleHierarchyCount} stale hierarchies · ${projection.staleMvpSliceDefinitionCount} stale MVP definitions · " +
                "${projection.staleImplementationUnitModelCount} stale Implementation Unit Models",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Dependency Mapping candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Graph digest: ${record.graphDigest}")
            appendLine("Critical-path digest: ${record.criticalPathDigest}")
            appendLine("Assessment receipt digest: ${record.assessmentReceiptDigest}")
            appendLine(
                "Candidate coverage: ${record.nodeCount} nodes · ${record.edgeCount} edges · " +
                    "${record.criticalPathUnitCount} critical-path units · " +
                    "${record.criticalPathCandidateEffortPoints} candidate effort points · ${record.reviewState}",
            )
        } ?: appendLine("Dependency Mapping candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and graph, critical-path, assessment-receipt, and " +
                "snapshot digests only; no unit, node, edge, evidence, rationale, estimate, owner, repository, module, " +
                "Requirement, architecture, risk, test, or personal data. Candidate completeness does not establish " +
                "dependency truth or completeness, critical-path authority, sequencing commitment, ownership appointment, " +
                "implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, " +
                "deployment, or action authority.",
        )
    }

    fun readTechnologyProfile(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val units = client.readImplementationUnitModel(initiativeId)
        val dependencyMapping = client.readDependencyMapping(initiativeId)
        val projection = client.readTechnologyProfile(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Technology Profile was read. Refresh the exact records." }
        projection.candidate?.let {
            val currentUnits = requireNotNull(units.candidate) {
                "The current Implementation Unit Model candidate is unavailable. Refresh the exact records."
            }
            val currentDependencyMapping = requireNotNull(dependencyMapping.candidate) {
                "The current Dependency Mapping candidate is unavailable. Refresh the exact records."
            }
            require(
                projection.implementationUnitModelRecordId == currentUnits.id &&
                    projection.implementationUnitModelRevision == currentUnits.revision &&
                    projection.implementationUnitModelDigest == currentUnits.digest
            ) { "The Implementation Unit Model changed while Technology Profile was read. Refresh the exact records." }
            require(
                projection.dependencyMappingRecordId == currentDependencyMapping.id &&
                    projection.dependencyMappingRevision == currentDependencyMapping.revision &&
                    projection.dependencyMappingDigest == currentDependencyMapping.digest
            ) { "The Dependency Mapping changed while Technology Profile was read. Refresh the exact records." }
        }
        return renderTechnologyProfile(projection)
    }

    fun renderTechnologyProfile(projection: TechnologyProfileProjection): String = buildString {
        appendLine("GAEP governed Technology Profile candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.state} · review state: ${projection.reviewState}")
        appendLine(
            "Candidate coverage: ${projection.unitProfileCount} unit profiles · ${projection.technologyChoiceCount} choices · " +
                "${projection.exactVersionCandidateCount} exact versions · ${projection.rangeVersionCandidateCount} ranges · " +
                "${projection.unresolvedVersionCount} unresolved versions · ${projection.constraintCount} constraints",
        )
        appendLine(
            "Candidate policy gaps: ${projection.unsupportedChoiceCount} unsupported · " +
                "${projection.lifecycleRiskCount} lifecycle risks · ${projection.compatibilityConflictCount} compatibility conflicts · " +
                "${projection.licenseReviewRequiredCount} license reviews · ${projection.licenseProhibitedCount} license-prohibited · " +
                "${projection.securityReviewRequiredCount} security reviews · ${projection.securityNonconformantCount} security-nonconformant · " +
                "${projection.exceptionCandidateCount} exception candidates · ${projection.constraintConflictCount} constraint conflicts",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedQuestionCount} questions · ${projection.missingProfileCount} missing profiles · " +
                "${projection.invalidProfileCount} invalid profiles · ${projection.missingEvidenceCount} missing evidence · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleImplementationUnitModelCount} stale Implementation Unit Models · " +
                "${projection.staleDependencyMappingCount} stale Dependency Mappings",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Technology Profile candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Profile catalog digest: ${record.profileCatalogDigest}")
            appendLine("Selection catalog digest: ${record.selectionCatalogDigest}")
            appendLine("Compatibility assessment receipt digest: ${record.compatibilityAssessmentReceiptDigest}")
            appendLine("Assessment receipt digest: ${record.assessmentReceiptDigest}")
            appendLine(
                "Candidate coverage: ${record.unitProfileCount} unit profiles · ${record.technologyChoiceCount} choices · " +
                    "${record.constraintCount} constraints · ${record.reviewState}",
            )
        } ?: appendLine("Technology Profile candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and profile, selection, compatibility, assessment, " +
                "and snapshot digests only; no technology names, versions, constraints, evidence, rationale, unit, architecture, " +
                "repository, toolchain, license, security-policy, or personal data. Candidate completeness does not establish " +
                "technology approval, support commitment, compatibility truth or completeness, licensing or security approval, " +
                "exception or waiver authority, architecture-baseline designation, implementation readiness or completeness, " +
                "assignment, execution, approval, acceptance, merge, release, deployment, or action authority.",
        )
    }

    fun readBoilerplateRegistry(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val units = client.readImplementationUnitModel(initiativeId)
        val technologyProfile = client.readTechnologyProfile(initiativeId)
        val projection = client.readBoilerplateRegistry(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Boilerplate Registry was read. Refresh the exact records." }
        projection.candidate?.let {
            val currentUnits = requireNotNull(units.candidate) {
                "The current Implementation Unit Model candidate is unavailable. Refresh the exact records."
            }
            val currentTechnologyProfile = requireNotNull(technologyProfile.candidate) {
                "The current Technology Profile candidate is unavailable. Refresh the exact records."
            }
            require(
                projection.implementationUnitModelRecordId == currentUnits.id &&
                    projection.implementationUnitModelRevision == currentUnits.revision &&
                    projection.implementationUnitModelDigest == currentUnits.digest
            ) { "The Implementation Unit Model changed while Boilerplate Registry was read. Refresh the exact records." }
            require(
                projection.technologyProfileRecordId == currentTechnologyProfile.id &&
                    projection.technologyProfileRevision == currentTechnologyProfile.revision &&
                    projection.technologyProfileDigest == currentTechnologyProfile.digest
            ) { "The Technology Profile changed while Boilerplate Registry was read. Refresh the exact records." }
        }
        return renderBoilerplateRegistry(projection)
    }

    fun renderBoilerplateRegistry(projection: BoilerplateRegistryProjection): String = buildString {
        appendLine("GAEP governed Boilerplate Registry candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.state} · review state: ${projection.reviewState}")
        appendLine(
            "Candidate coverage: ${projection.entryCount} entries · ${projection.exactVersionCandidateCount} exact versions · " +
                "${projection.rangeVersionCandidateCount} ranges · ${projection.unresolvedVersionCount} unresolved versions · " +
                "${projection.mandatoryCandidateCount} mandatory candidates",
        )
        appendLine(
            "Candidate asset gaps: ${projection.unavailableEntryCount} unavailable · ${projection.integrityMismatchCount} integrity gaps · " +
                "${projection.provenanceGapCount} provenance gaps · ${projection.missingEvidenceCount} missing evidence",
        )
        appendLine(
            "Candidate policy gaps: ${projection.unsupportedEntryCount} unsupported · ${projection.lifecycleRiskCount} lifecycle risks · " +
                "${projection.technologyConflictCount} technology conflicts · ${projection.architectureConflictCount} architecture conflicts · " +
                "${projection.licenseReviewRequiredCount} license reviews · ${projection.licenseProhibitedCount} license-prohibited · " +
                "${projection.securityReviewRequiredCount} security reviews · ${projection.securityNonconformantCount} security-nonconformant · " +
                "${projection.exceptionCandidateCount} exception candidates",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedQuestionCount} questions · ${projection.invalidRegistryCount} invalid registries · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleImplementationUnitModelCount} stale Implementation Unit Models · " +
                "${projection.staleTechnologyProfileCount} stale Technology Profiles",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Boilerplate Registry candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Entry catalog digest: ${record.entryCatalogDigest}")
            appendLine("Source catalog digest: ${record.sourceCatalogDigest}")
            appendLine("Compatibility assessment receipt digest: ${record.compatibilityAssessmentReceiptDigest}")
            appendLine("Assessment receipt digest: ${record.assessmentReceiptDigest}")
            appendLine("Candidate coverage: ${record.entryCount} entries · ${record.mandatoryCandidateCount} mandatory candidates · ${record.reviewState}")
        }
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and entry, source, compatibility, assessment, and " +
                "snapshot digests only; no boilerplate names, locators, versions, capabilities, limitations, evidence, rationale, " +
                "technology, unit, architecture, repository, template, license, security-policy, or personal data. Candidate " +
                "completeness does not establish organizational designation, endorsement, approval, support commitment, " +
                "compatibility truth or completeness, licensing or security approval, exception or waiver, selection or binding, " +
                "architecture baseline, implementation readiness or completeness, assignment, execution, acceptance, merge, " +
                "release, deployment, or action authority.",
        )
    }

    fun readBoilerplateSelectionBinding(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val units = client.readImplementationUnitModel(initiativeId)
        val dependencyMapping = client.readDependencyMapping(initiativeId)
        val technologyProfile = client.readTechnologyProfile(initiativeId)
        val boilerplateRegistry = client.readBoilerplateRegistry(initiativeId)
        val projection = client.readBoilerplateSelectionBinding(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Boilerplate Selection and Binding was read. Refresh the exact records." }
        projection.candidate?.let {
            val currentUnits = requireNotNull(units.candidate) {
                "The current Implementation Unit Model candidate is unavailable. Refresh the exact records."
            }
            val currentDependencyMapping = requireNotNull(dependencyMapping.candidate) {
                "The current Dependency Mapping candidate is unavailable. Refresh the exact records."
            }
            val currentTechnologyProfile = requireNotNull(technologyProfile.candidate) {
                "The current Technology Profile candidate is unavailable. Refresh the exact records."
            }
            val currentBoilerplateRegistry = requireNotNull(boilerplateRegistry.candidate) {
                "The current Boilerplate Registry candidate is unavailable. Refresh the exact records."
            }
            require(
                projection.implementationUnitModelRecordId == currentUnits.id &&
                    projection.implementationUnitModelRevision == currentUnits.revision &&
                    projection.implementationUnitModelDigest == currentUnits.digest
            ) { "The Implementation Unit Model changed while Boilerplate Selection and Binding was read. Refresh the exact records." }
            require(
                projection.dependencyMappingRecordId == currentDependencyMapping.id &&
                    projection.dependencyMappingRevision == currentDependencyMapping.revision &&
                    projection.dependencyMappingDigest == currentDependencyMapping.digest
            ) { "The Dependency Mapping changed while Boilerplate Selection and Binding was read. Refresh the exact records." }
            require(
                projection.technologyProfileRecordId == currentTechnologyProfile.id &&
                    projection.technologyProfileRevision == currentTechnologyProfile.revision &&
                    projection.technologyProfileDigest == currentTechnologyProfile.digest
            ) { "The Technology Profile changed while Boilerplate Selection and Binding was read. Refresh the exact records." }
            require(
                projection.boilerplateRegistryRecordId == currentBoilerplateRegistry.id &&
                    projection.boilerplateRegistryRevision == currentBoilerplateRegistry.revision &&
                    projection.boilerplateRegistryDigest == currentBoilerplateRegistry.digest
            ) { "The Boilerplate Registry changed while Boilerplate Selection and Binding was read. Refresh the exact records." }
        }
        return renderBoilerplateSelectionBinding(projection)
    }

    fun renderBoilerplateSelectionBinding(projection: BoilerplateSelectionBindingProjection): String = buildString {
        appendLine("GAEP governed Boilerplate Selection and Binding candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.state} · review state: ${projection.reviewState}")
        appendLine(
            "Candidate coverage: ${projection.decisionCount} decisions · ${projection.selectedCandidateCount} selected · " +
                "${projection.notApplicableCandidateCount} not applicable · ${projection.deferredCandidateCount} deferred · " +
                "${projection.notAssessedCount} not assessed",
        )
        appendLine(
            "Candidate decision gaps: ${projection.missingUnitDecisionCount} missing unit decisions · " +
                "${projection.invalidSelectionCount} invalid selections · ${projection.registryGapCount} registry gaps · " +
                "${projection.profileMismatchCount} profile mismatches · ${projection.unitScopeMismatchCount} unit-scope mismatches · " +
                "${projection.versionMismatchCount} version mismatches · ${projection.missingEvidenceCount} missing evidence",
        )
        appendLine(
            "Candidate freshness gaps: ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleImplementationUnitModelCount} stale Implementation Unit Models · " +
                "${projection.staleDependencyMappingCount} stale Dependency Mappings · " +
                "${projection.staleTechnologyProfileCount} stale Technology Profiles · " +
                "${projection.staleBoilerplateRegistryCount} stale Boilerplate Registries · " +
                "${projection.invalidCandidateCount} invalid candidates · ${projection.unresolvedQuestionCount} questions",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Boilerplate Selection and Binding candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Unit decision catalog digest: ${record.unitDecisionCatalogDigest}")
            appendLine("Selection receipt digest: ${record.selectionReceiptDigest}")
            appendLine("Binding receipt digest: ${record.bindingReceiptDigest}")
            appendLine("Assessment receipt digest: ${record.assessmentReceiptDigest}")
            appendLine("Candidate coverage: ${record.decisionCount} decisions · ${record.selectedCandidateCount} selected · ${record.reviewState}")
        }
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and unit-decision, selection, binding, assessment, " +
                "and snapshot digests only; no boilerplate names, locators, versions, unit or profile identities, rationale, " +
                "conditions, alternatives, deviations, evidence, decision roles, or personal data. Candidate completeness " +
                "does not establish organizational designation, endorsement, approval, support commitment, effective selection " +
                "or binding, compatibility truth, completeness, or validation, licensing or security approval, exception or " +
                "waiver, source retrieval, import or instantiation, architecture baseline, implementation readiness or " +
                "completeness, assignment, execution, acceptance, merge, release, deployment, or action authority.",
        )
    }

    fun readBoilerplateCompatibilityValidation(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val units = client.readImplementationUnitModel(initiativeId)
        val dependencyMapping = client.readDependencyMapping(initiativeId)
        val technologyProfile = client.readTechnologyProfile(initiativeId)
        val boilerplateRegistry = client.readBoilerplateRegistry(initiativeId)
        val selectionBinding = client.readBoilerplateSelectionBinding(initiativeId)
        val projection = client.readBoilerplateCompatibilityValidation(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Boilerplate Compatibility Validation was read. Refresh the exact records." }
        projection.candidate?.let {
            val currentUnits = requireNotNull(units.candidate) {
                "The current Implementation Unit Model candidate is unavailable. Refresh the exact records."
            }
            val currentDependencyMapping = requireNotNull(dependencyMapping.candidate) {
                "The current Dependency Mapping candidate is unavailable. Refresh the exact records."
            }
            val currentTechnologyProfile = requireNotNull(technologyProfile.candidate) {
                "The current Technology Profile candidate is unavailable. Refresh the exact records."
            }
            val currentBoilerplateRegistry = requireNotNull(boilerplateRegistry.candidate) {
                "The current Boilerplate Registry candidate is unavailable. Refresh the exact records."
            }
            val currentSelectionBinding = requireNotNull(selectionBinding.candidate) {
                "The current Boilerplate Selection and Binding candidate is unavailable. Refresh the exact records."
            }
            require(
                projection.implementationUnitModelRecordId == currentUnits.id &&
                    projection.implementationUnitModelRevision == currentUnits.revision &&
                    projection.implementationUnitModelDigest == currentUnits.digest
            ) { "The Implementation Unit Model changed while Boilerplate Compatibility Validation was read. Refresh the exact records." }
            require(
                projection.dependencyMappingRecordId == currentDependencyMapping.id &&
                    projection.dependencyMappingRevision == currentDependencyMapping.revision &&
                    projection.dependencyMappingDigest == currentDependencyMapping.digest
            ) { "The Dependency Mapping changed while Boilerplate Compatibility Validation was read. Refresh the exact records." }
            require(
                projection.technologyProfileRecordId == currentTechnologyProfile.id &&
                    projection.technologyProfileRevision == currentTechnologyProfile.revision &&
                    projection.technologyProfileDigest == currentTechnologyProfile.digest
            ) { "The Technology Profile changed while Boilerplate Compatibility Validation was read. Refresh the exact records." }
            require(
                projection.boilerplateRegistryRecordId == currentBoilerplateRegistry.id &&
                    projection.boilerplateRegistryRevision == currentBoilerplateRegistry.revision &&
                    projection.boilerplateRegistryDigest == currentBoilerplateRegistry.digest
            ) { "The Boilerplate Registry changed while Boilerplate Compatibility Validation was read. Refresh the exact records." }
            require(
                projection.boilerplateSelectionBindingRecordId == currentSelectionBinding.id &&
                    projection.boilerplateSelectionBindingRevision == currentSelectionBinding.revision &&
                    projection.boilerplateSelectionBindingDigest == currentSelectionBinding.digest
            ) { "The Boilerplate Selection and Binding changed while Boilerplate Compatibility Validation was read. Refresh the exact records." }
        }
        return renderBoilerplateCompatibilityValidation(projection)
    }

    fun renderBoilerplateCompatibilityValidation(projection: BoilerplateCompatibilityValidationProjection): String = buildString {
        appendLine("GAEP governed Boilerplate Compatibility Validation candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.state} · review state: ${projection.reviewState}")
        appendLine(
            "Candidate coverage: ${projection.selectedBindingCount} selected bindings · ${projection.subjectCount} subjects · " +
                "${projection.dimensionAssessmentCount} dimension assessments",
        )
        appendLine(
            "Candidate outcomes: ${projection.compatibleCandidateCount} compatible · " +
                "${projection.incompatibleCandidateCount} incompatible · ${projection.exceptionCandidateCount} exception candidates · " +
                "${projection.notAssessedCount} not assessed",
        )
        appendLine(
            "Candidate validation gaps: ${projection.missingSubjectCount} missing subjects · " +
                "${projection.invalidSubjectCount} invalid subjects · ${projection.missingDimensionCount} missing dimensions · " +
                "${projection.missingEvidenceCount} missing evidence · ${projection.expiredAssessmentCount} expired assessments · " +
                "${projection.conflictingOutcomeCount} conflicting outcomes · ${projection.selectionBindingGapCount} selection-binding gaps",
        )
        appendLine(
            "Candidate freshness gaps: ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleImplementationUnitModelCount} stale Implementation Unit Models · " +
                "${projection.staleDependencyMappingCount} stale Dependency Mappings · " +
                "${projection.staleTechnologyProfileCount} stale Technology Profiles · " +
                "${projection.staleBoilerplateRegistryCount} stale Boilerplate Registries · " +
                "${projection.staleSelectionBindingCount} stale Selection Bindings · " +
                "${projection.invalidCandidateCount} invalid candidates · ${projection.unresolvedQuestionCount} questions",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Boilerplate Compatibility Validation candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Validation subject catalog digest: ${record.validationSubjectCatalogDigest}")
            appendLine("Dimension catalog digest: ${record.dimensionCatalogDigest}")
            appendLine("Evidence receipt digest: ${record.evidenceReceiptDigest}")
            appendLine("Validation receipt digest: ${record.validationReceiptDigest}")
            appendLine("Assessment receipt digest: ${record.assessmentReceiptDigest}")
            appendLine(
                "Candidate coverage: ${record.subjectCount} subjects · ${record.compatibleCandidateCount} compatible · " +
                    "${record.incompatibleCandidateCount} incompatible · ${record.exceptionCandidateCount} exception candidates · " +
                    "${record.notAssessedCount} not assessed · ${record.dimensionAssessmentCount} dimensions · ${record.reviewState}",
            )
        }
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and subject, dimension, evidence, validation, " +
                "assessment, and snapshot digests only; no boilerplate names, locators, versions, unit, profile, entry, or " +
                "binding identities, claims, evidence, assessors, or personal data. Candidate completeness does not establish " +
                "compatibility truth or completeness, a validation decision, actual asset behavior, test execution, design " +
                "validity, security, privacy, or licensing approval, exception or waiver, effective selection or binding, " +
                "source retrieval, import or instantiation, architecture baseline, implementation readiness or completeness, " +
                "assignment, execution, acceptance, merge, release, deployment, or action authority.",
        )
    }

    fun readFigmaToBoilerplateMapping(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val designApplicability = client.readDesignApplicability(initiativeId)
        val designSystem = client.readDesignSystemTokenContract(initiativeId)
        val responsiveTargets = client.readResponsiveMultiPlatformTargets(initiativeId)
        val finalizedSnapshot = client.readFinalizedFigmaSnapshotImport(initiativeId)
        val designBinding = client.readDesignToRequirementBinding(initiativeId)
        val designBaseline = client.readDesignBaseline(initiativeId)
        val units = client.readImplementationUnitModel(initiativeId)
        val technologyProfile = client.readTechnologyProfile(initiativeId)
        val registry = client.readBoilerplateRegistry(initiativeId)
        val selectionBinding = client.readBoilerplateSelectionBinding(initiativeId)
        val compatibilityValidation = client.readBoilerplateCompatibilityValidation(initiativeId)
        val projection = client.readFigmaToBoilerplateMapping(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Figma-to-Boilerplate Mapping was read. Refresh the exact records." }
        projection.candidate?.let {
            fun requireDependency(name: String, id: UUID, revision: Long, digest: String) {
                val reference = requireNotNull(projection.dependencies[name]) {
                    "The current $name candidate reference is unavailable. Refresh the exact records."
                }
                require(reference.recordId == id && reference.revision == revision && reference.digest == digest) {
                    "The $name candidate changed while Figma-to-Boilerplate Mapping was read. Refresh the exact records."
                }
            }
            designApplicability.candidate!!.let { requireDependency("designApplicability", it.id, it.revision, it.digest) }
            designSystem.candidate!!.let { requireDependency("designSystemTokenContract", it.id, it.revision, it.digest) }
            responsiveTargets.candidate!!.let { requireDependency("responsiveMultiPlatformTargets", it.id, it.revision, it.digest) }
            finalizedSnapshot.candidate!!.let { requireDependency("finalizedFigmaSnapshotImport", it.id, it.revision, it.digest) }
            designBinding.candidate!!.let { requireDependency("designToRequirementBinding", it.id, it.revision, it.digest) }
            designBaseline.candidate!!.let { requireDependency("designBaseline", it.id, it.revision, it.digest) }
            units.candidate!!.let { requireDependency("implementationUnitModel", it.id, it.revision, it.digest) }
            technologyProfile.candidate!!.let { requireDependency("technologyProfile", it.id, it.revision, it.digest) }
            registry.candidate!!.let { requireDependency("boilerplateRegistry", it.id, it.revision, it.digest) }
            selectionBinding.candidate!!.let { requireDependency("boilerplateSelectionBinding", it.id, it.revision, it.digest) }
            compatibilityValidation.candidate!!.let { requireDependency("boilerplateCompatibilityValidation", it.id, it.revision, it.digest) }
        }
        return renderFigmaToBoilerplateMapping(projection)
    }

    fun renderFigmaToBoilerplateMapping(projection: FigmaToBoilerplateMappingProjection): String = buildString {
        appendLine("GAEP governed Figma-to-Boilerplate Mapping candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.state} · review state: ${projection.reviewState}")
        appendLine("Candidate coverage: ${projection.designBindingCount} design bindings · ${projection.subjectCount} mapping subjects")
        appendLine(
            "Candidate outcomes: ${projection.mappedCandidateCount} mapped · ${projection.conflictCandidateCount} conflicts · " +
                "${projection.unmappedCandidateCount} unmapped · ${projection.notAssessedCount} not assessed",
        )
        appendLine(
            "Candidate kinds: ${projection.componentMappingCount} component · ${projection.tokenMappingCount} token · " +
                "${projection.layoutMappingCount} layout · ${projection.responsiveBehaviorMappingCount} responsive · " +
                "${projection.platformTargetMappingCount} platform-target",
        )
        appendLine(
            "Candidate mapping gaps: ${projection.missingSubjectCount} missing subjects · ${projection.invalidSubjectCount} invalid subjects · " +
                "${projection.targetGapCount} target gaps · ${projection.traceGapCount} trace gaps · ${projection.evidenceGapCount} evidence gaps",
        )
        appendLine(
            "Candidate freshness gaps: ${projection.staleBindingCount} stale bindings · ${projection.staleDependencyCount} stale dependencies · " +
                "${projection.invalidCandidateCount} invalid candidates · ${projection.unresolvedQuestionCount} questions",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Figma-to-Boilerplate Mapping candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Mapping subject catalog digest: ${record.mappingSubjectCatalogDigest}")
            appendLine("Target catalog digest: ${record.targetCatalogDigest}")
            appendLine("Trace receipt digest: ${record.traceReceiptDigest}")
            appendLine("Mapping receipt digest: ${record.mappingReceiptDigest}")
            appendLine("Assessment receipt digest: ${record.assessmentReceiptDigest}")
            appendLine(
                "Candidate coverage: ${record.subjectCount} subjects · ${record.mappedCandidateCount} mapped · " +
                    "${record.conflictCandidateCount} conflicts · ${record.unmappedCandidateCount} unmapped · " +
                    "${record.notAssessedCount} not assessed · ${record.reviewState}",
            )
        }
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and subject, target, trace, mapping, assessment, " +
                "and snapshot digests only; no Figma content, design-item, binding, unit, profile, registry-entry, " +
                "validation-subject, requirement, target-locator, evidence, reviewer, or personal data. This inspection " +
                "does not connect to or call Figma, establish returned Figma content, design validity, approval or baseline, " +
                "mapping truth or completeness, effective selection or compatibility truth, retrieve, import, instantiate, " +
                "generate or execute assets, establish implementation readiness or completeness, assign, execute, accept, " +
                "merge, release, deploy, or grant action authority.",
        )
    }

    fun readDesignToCodeBindingRegistry(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val designBaseline = client.readDesignBaseline(initiativeId)
        val finalizedSnapshot = client.readFinalizedFigmaSnapshotImport(initiativeId)
        val designBinding = client.readDesignToRequirementBinding(initiativeId)
        val figmaMapping = client.readFigmaToBoilerplateMapping(initiativeId)
        val units = client.readImplementationUnitModel(initiativeId)
        val technologyProfile = client.readTechnologyProfile(initiativeId)
        val selectionBinding = client.readBoilerplateSelectionBinding(initiativeId)
        val compatibilityValidation = client.readBoilerplateCompatibilityValidation(initiativeId)
        val projection = client.readDesignToCodeBindingRegistry(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Design-to-Code Binding Registry was read. Refresh the exact records." }
        projection.candidate?.let {
            fun requireDependency(name: String, id: UUID, revision: Long, digest: String) {
                val reference = requireNotNull(projection.dependencies[name]) {
                    "The current $name candidate reference is unavailable. Refresh the exact records."
                }
                require(reference.recordId == id && reference.revision == revision && reference.digest == digest) {
                    "The $name candidate changed while Design-to-Code Binding Registry was read. Refresh the exact records."
                }
            }
            designBaseline.candidate!!.let { requireDependency("designBaseline", it.id, it.revision, it.digest) }
            finalizedSnapshot.candidate!!.let { requireDependency("finalizedFigmaSnapshotImport", it.id, it.revision, it.digest) }
            designBinding.candidate!!.let { requireDependency("designToRequirementBinding", it.id, it.revision, it.digest) }
            figmaMapping.candidate!!.let { requireDependency("figmaToBoilerplateMapping", it.id, it.revision, it.digest) }
            units.candidate!!.let { requireDependency("implementationUnitModel", it.id, it.revision, it.digest) }
            technologyProfile.candidate!!.let { requireDependency("technologyProfile", it.id, it.revision, it.digest) }
            selectionBinding.candidate!!.let { requireDependency("boilerplateSelectionBinding", it.id, it.revision, it.digest) }
            compatibilityValidation.candidate!!.let {
                requireDependency("boilerplateCompatibilityValidation", it.id, it.revision, it.digest)
            }
        }
        return renderDesignToCodeBindingRegistry(projection)
    }

    fun renderDesignToCodeBindingRegistry(projection: DesignToCodeBindingRegistryProjection): String = buildString {
        appendLine("GAEP governed Design-to-Code Binding Registry candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.state} · review state: ${projection.reviewState}")
        appendLine(
            "Candidate coverage: ${projection.mappingSubjectCount} mapping subjects · ${projection.subjectCount} binding subjects",
        )
        appendLine(
            "Candidate outcomes: ${projection.boundCandidateCount} bound · ${projection.conflictCandidateCount} conflicts · " +
                "${projection.unboundCandidateCount} unbound · ${projection.notAssessedCount} not assessed",
        )
        appendLine(
            "Candidate binding gaps: ${projection.missingSubjectCount} missing subjects · ${projection.invalidSubjectCount} invalid subjects · " +
                "${projection.targetGapCount} target gaps · ${projection.traceGapCount} trace gaps · " +
                "${projection.evidenceGapCount} evidence gaps · ${projection.duplicateTargetCount} duplicate targets",
        )
        appendLine(
            "Candidate freshness gaps: ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleDependencyCount} stale dependencies · ${projection.invalidCandidateCount} invalid candidates · " +
                "${projection.unresolvedQuestionCount} questions",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Design-to-Code Binding Registry candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Binding subject catalog digest: ${record.bindingSubjectCatalogDigest}")
            appendLine("Code target catalog digest: ${record.codeTargetCatalogDigest}")
            appendLine("Trace receipt digest: ${record.traceReceiptDigest}")
            appendLine("Binding receipt digest: ${record.bindingReceiptDigest}")
            appendLine("Assessment receipt digest: ${record.assessmentReceiptDigest}")
            appendLine(
                "Candidate coverage: ${record.subjectCount} subjects · ${record.boundCandidateCount} bound · " +
                    "${record.conflictCandidateCount} conflicts · ${record.unboundCandidateCount} unbound · " +
                    "${record.notAssessedCount} not assessed · ${record.reviewState}",
            )
        }
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and subject, target, trace, binding, assessment, " +
                "and snapshot digests only; no Figma content, design-item, mapping, unit, requirement, repository, module, " +
                "path, symbol, evidence, reviewer, or personal data. This inspection does not connect to or call Figma, " +
                "establish returned Figma content, design validity, approval or baseline, mapping or binding truth or " +
                "completeness, repository, path, or symbol truth, create or change code targets, retrieve, import, " +
                "instantiate, generate or execute assets, establish implementation readiness or completeness, assign, " +
                "execute, accept, merge, release, deploy, or grant action authority.",
        )
    }

    fun readRouteScreenComponentMapping(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val informationArchitecture = client.readInformationArchitectureModel(initiativeId)
        val screenInventory = client.readScreenStateInventory(initiativeId)
        val designRequirements = client.readDesignRequirements(initiativeId)
        val designBaseline = client.readDesignBaseline(initiativeId)
        val designBinding = client.readDesignToRequirementBinding(initiativeId)
        val figmaMapping = client.readFigmaToBoilerplateMapping(initiativeId)
        val designCodeBinding = client.readDesignToCodeBindingRegistry(initiativeId)
        val units = client.readImplementationUnitModel(initiativeId)
        val acceptance = client.readAcceptanceCriteria(initiativeId)
        val projection = client.readRouteScreenComponentMapping(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Route, Screen, and Component Mapping was read. Refresh the exact records." }
        projection.candidate?.let {
            fun requireDependency(name: String, id: UUID, revision: Long, digest: String) {
                val reference = requireNotNull(projection.dependencies[name]) {
                    "The current $name candidate reference is unavailable. Refresh the exact records."
                }
                require(reference.recordId == id && reference.revision == revision && reference.digest == digest) {
                    "The $name candidate changed while Route, Screen, and Component Mapping was read. Refresh the exact records."
                }
            }
            informationArchitecture.candidate!!.let { requireDependency("informationArchitecture", it.id, it.revision, it.digest) }
            screenInventory.candidate!!.let { requireDependency("screenStateInventory", it.id, it.revision, it.digest) }
            designRequirements.candidate!!.let { requireDependency("designRequirements", it.id, it.revision, it.digest) }
            designBaseline.candidate!!.let { requireDependency("designBaseline", it.id, it.revision, it.digest) }
            designBinding.candidate!!.let { requireDependency("designToRequirementBinding", it.id, it.revision, it.digest) }
            figmaMapping.candidate!!.let { requireDependency("figmaToBoilerplateMapping", it.id, it.revision, it.digest) }
            designCodeBinding.candidate!!.let { requireDependency("designToCodeBindingRegistry", it.id, it.revision, it.digest) }
            units.candidate!!.let { requireDependency("implementationUnitModel", it.id, it.revision, it.digest) }
            acceptance.candidate!!.let { requireDependency("acceptanceCriteria", it.id, it.revision, it.digest) }
        }
        return renderRouteScreenComponentMapping(projection)
    }

    fun renderRouteScreenComponentMapping(projection: RouteScreenComponentMappingProjection): String = buildString {
        appendLine("GAEP governed Route, Screen, and Component Mapping candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.state} · review state: ${projection.reviewState}")
        appendLine(
            "Source coverage: ${projection.sourceRouteCount} routes · ${projection.sourceScreenCount} screens · " +
                "${projection.sourceStateCount} states · ${projection.sourceComponentCount} components",
        )
        appendLine(
            "Candidate coverage: ${projection.subjectCount} subjects · ${projection.routeSubjectCount} routes · " +
                "${projection.screenSubjectCount} screens · ${projection.stateSubjectCount} states · " +
                "${projection.componentSubjectCount} components",
        )
        appendLine(
            "Candidate outcomes: ${projection.mappedCandidateCount} mapped · ${projection.conflictCandidateCount} conflicts · " +
                "${projection.unmappedCandidateCount} unmapped · ${projection.notAssessedCount} not assessed",
        )
        appendLine(
            "Candidate relationships: ${projection.relationshipCount} total · ${projection.definedRelationshipCount} defined · " +
                "${projection.conflictRelationshipCount} conflicts · ${projection.notAssessedRelationshipCount} not assessed",
        )
        appendLine(
            "Candidate mapping gaps: ${projection.missingSubjectCount} missing subjects · ${projection.extraSubjectCount} extra subjects · " +
                "${projection.invalidSubjectCount} invalid subjects · ${projection.missingRelationshipCount} missing relationships · " +
                "${projection.invalidRelationshipCount} invalid relationships · ${projection.traceGapCount} trace gaps · " +
                "${projection.evidenceGapCount} evidence gaps · ${projection.componentPlacementGapCount} component placement gaps · " +
                "${projection.testHookGapCount} test-hook gaps",
        )
        appendLine(
            "Candidate freshness gaps: ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleDependencyCount} stale dependencies · ${projection.invalidCandidateCount} invalid candidates · " +
                "${projection.unresolvedQuestionCount} questions",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Route, Screen, and Component Mapping candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Subject catalog digest: ${record.subjectCatalogDigest}")
            appendLine("Relationship catalog digest: ${record.relationshipCatalogDigest}")
            appendLine("Trace receipt digest: ${record.traceReceiptDigest}")
            appendLine("Mapping receipt digest: ${record.mappingReceiptDigest}")
            appendLine("Assessment receipt digest: ${record.assessmentReceiptDigest}")
            appendLine(
                "Candidate coverage: ${record.subjectCount} subjects · ${record.relationshipCount} relationships · " +
                    "${record.mappedCandidateCount} mapped · ${record.conflictCandidateCount} conflicts · " +
                    "${record.unmappedCandidateCount} unmapped · ${record.notAssessedCount} not assessed · ${record.reviewState}",
            )
        }
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and subject, relationship, trace, mapping, " +
                "assessment, and snapshot digests only; no route patterns, screen, state, component, design, Requirement, " +
                "Acceptance Criteria, Implementation Unit, repository, module, path, symbol, test-hook, evidence, reviewer, " +
                "or personal data. This inspection does not connect to or call Figma, establish returned Figma content, " +
                "navigation or mapping truth, UI or design validity, repository or test truth, create or change code or " +
                "design targets, establish implementation readiness or completeness, assign, execute, accept, merge, " +
                "release, deploy, or grant action authority.",
        )
    }

    fun readTestMethodology(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val acceptance = client.readAcceptanceCriteria(initiativeId)
        val ready = client.readDefinitionOfReady(initiativeId)
        val done = client.readDefinitionOfDone(initiativeId)
        val units = client.readImplementationUnitModel(initiativeId)
        val dependencies = client.readDependencyMapping(initiativeId)
        val securityPrivacy = client.readSecurityPrivacyAssessment(initiativeId)
        val routeMapping = client.readRouteScreenComponentMapping(initiativeId)
        val projection = client.readTestMethodology(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Test Methodology was read. Refresh the exact records." }
        projection.candidate?.let {
            fun requireDependency(name: String, id: UUID, revision: Long, digest: String) {
                val reference = requireNotNull(projection.dependencies[name]) {
                    "The current $name candidate reference is unavailable. Refresh the exact records."
                }
                require(reference.recordId == id && reference.revision == revision && reference.digest == digest) {
                    "The $name candidate changed while Test Methodology was read. Refresh the exact records."
                }
            }
            acceptance.candidate!!.let { requireDependency("acceptanceCriteria", it.id, it.revision, it.digest) }
            ready.candidate!!.let { requireDependency("definitionOfReady", it.id, it.revision, it.digest) }
            done.candidate!!.let { requireDependency("definitionOfDone", it.id, it.revision, it.digest) }
            units.candidate!!.let { requireDependency("implementationUnitModel", it.id, it.revision, it.digest) }
            dependencies.candidate!!.let { requireDependency("dependencyMapping", it.id, it.revision, it.digest) }
            securityPrivacy.assessment!!.let { requireDependency("securityPrivacyAssessment", it.id, it.revision, it.digest) }
            routeMapping.candidate!!.let { requireDependency("routeScreenComponentMapping", it.id, it.revision, it.digest) }
        }
        return renderTestMethodology(projection)
    }

    fun renderTestMethodology(projection: TestMethodologyProjection): String = buildString {
        appendLine("GAEP governed Test Methodology candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.state} · review state: ${projection.reviewState}")
        appendLine(
            "Source coverage: ${projection.sourceUnitCount} units · ${projection.sourceRequirementCount} Requirements · " +
                "${projection.sourceCriterionCount} Acceptance Criteria · ${projection.sourceMappingSubjectCount} mapping subjects",
        )
        appendLine(
            "Candidate coverage: ${projection.scopeCount} scopes · ${projection.decisionCount} decisions · " +
                "${projection.environmentCount} environments · ${projection.dataPolicyCount} data policies · " +
                "${projection.evidenceExpectationCount} evidence expectations",
        )
        appendLine(
            "Candidate outcomes: ${projection.selectedDecisionCount} selected · ${projection.conflictDecisionCount} conflicts · " +
                "${projection.notApplicableDecisionCount} not applicable · ${projection.deferredDecisionCount} deferred · " +
                "${projection.notAssessedDecisionCount} not assessed",
        )
        appendLine("Candidate criteria: ${projection.entryCriterionCount} entry · ${projection.exitCriterionCount} exit")
        appendLine(
            "Candidate methodology gaps: ${projection.missingScopeCount} missing scopes · ${projection.extraScopeCount} extra scopes · " +
                "${projection.invalidDecisionCount} invalid decisions · ${projection.environmentGapCount} environment gaps · " +
                "${projection.dataPolicyGapCount} data-policy gaps · ${projection.ownershipGapCount} ownership gaps · " +
                "${projection.traceGapCount} trace gaps · ${projection.evidenceGapCount} evidence gaps · " +
                "${projection.criterionGapCount} criterion gaps",
        )
        appendLine(
            "Candidate freshness gaps: ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleDependencyCount} stale dependencies · ${projection.invalidCandidateCount} invalid candidates · " +
                "${projection.unresolvedQuestionCount} questions",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Test Methodology candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Scope catalog digest: ${record.scopeCatalogDigest}")
            appendLine("Methodology receipt digest: ${record.methodologyReceiptDigest}")
            appendLine("Environment receipt digest: ${record.environmentReceiptDigest}")
            appendLine("Data-policy receipt digest: ${record.dataPolicyReceiptDigest}")
            appendLine("Ownership receipt digest: ${record.ownershipReceiptDigest}")
            appendLine("Trace receipt digest: ${record.traceReceiptDigest}")
            appendLine("Assessment receipt digest: ${record.assessmentReceiptDigest}")
            appendLine(
                "Candidate coverage: ${record.scopeCount} scopes · ${record.decisionCount} decisions · " +
                    "${record.selectedDecisionCount} selected · ${record.conflictDecisionCount} conflicts · " +
                    "${record.environmentCount} environments · ${record.dataPolicyCount} data policies · " +
                    "${record.entryCriterionCount} entry criteria · ${record.exitCriterionCount} exit criteria · ${record.reviewState}",
            )
        }
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and methodology scope, environment, data, ownership, " +
                "trace, assessment, and snapshot digests only; no Requirement, criterion, method rationale, environment address, " +
                "test data, owner, evidence, result, personal data, secret, credential, or machine path. This inspection does not " +
                "establish methodology validity or completeness, environment availability, data fitness, privacy or security approval, " +
                "owner appointment, test execution or results, evidence or coverage truth, quality, implementation readiness, " +
                "acceptance, release, deployment, or action authority.",
        )
    }

    fun readTestInventory(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val acceptance = client.readAcceptanceCriteria(initiativeId)
        val risks = client.readRiskRegister(initiativeId)
        val units = client.readImplementationUnitModel(initiativeId)
        val routeMapping = client.readRouteScreenComponentMapping(initiativeId)
        val methodology = client.readTestMethodology(initiativeId)
        val projection = client.readTestInventory(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision && projection.initiativeDigest == initiative.digest &&
                projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Test Inventory was read. Refresh the exact records." }
        projection.candidate?.let {
            fun requireDependency(name: String, id: UUID, revision: Long, digest: String) {
                val reference = requireNotNull(projection.dependencies[name]) {
                    "The current $name candidate reference is unavailable. Refresh the exact records."
                }
                require(reference.recordId == id && reference.revision == revision && reference.digest == digest) {
                    "The $name candidate changed while Test Inventory was read. Refresh the exact records."
                }
            }
            acceptance.candidate!!.let { requireDependency("acceptanceCriteria", it.id, it.revision, it.digest) }
            risks.register!!.let { requireDependency("riskRegister", it.id, it.revision, it.digest) }
            units.candidate!!.let { requireDependency("implementationUnitModel", it.id, it.revision, it.digest) }
            routeMapping.candidate!!.let { requireDependency("routeScreenComponentMapping", it.id, it.revision, it.digest) }
            methodology.candidate!!.let { requireDependency("testMethodology", it.id, it.revision, it.digest) }
        }
        return renderTestInventory(projection)
    }

    fun renderTestInventory(projection: TestInventoryProjection): String = buildString {
        appendLine("GAEP governed Test Inventory candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.state} · review state: ${projection.reviewState}")
        appendLine(
            "Source coverage: ${projection.sourceCriterionCount} Acceptance Criteria · ${projection.sourceRiskCount} Risks · " +
                "${projection.sourceUnitCount} Implementation Units · ${projection.sourceMappingSubjectCount} mapping subjects · " +
                "${projection.sourceMethodologyScopeCount} methodology scopes",
        )
        appendLine(
            "Candidate inventory: ${projection.assetCount} tests · ${projection.catalogedAssetCount} cataloged · " +
                "${projection.conflictAssetCount} conflicts · ${projection.missingAssetCount} missing · " +
                "${projection.deferredAssetCount} deferred · ${projection.notAssessedAssetCount} not assessed",
        )
        appendLine(
            "Candidate asset states: ${projection.observedAssetCount} observed · ${projection.plannedAssetCount} planned · " +
                "${projection.automatedAssetCount} automated · ${projection.manualAssetCount} manual",
        )
        appendLine(
            "Candidate coverage gaps: ${projection.uncoveredCriterionCount} criteria · ${projection.uncoveredRiskCount} risks · " +
                "${projection.uncoveredUnitCount} units · ${projection.uncoveredMappingSubjectCount} mapping subjects · " +
                "${projection.uncoveredMethodologyScopeCount} methodology scopes",
        )
        appendLine(
            "Candidate integrity gaps: ${projection.duplicateIdentityCount} duplicates · ${projection.orphanAssetCount} orphans · " +
                "${projection.ownershipGapCount} ownership · ${projection.traceGapCount} trace · ${projection.evidenceGapCount} evidence",
        )
        appendLine(
            "Candidate freshness gaps: ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleDependencyCount} stale dependencies · ${projection.invalidCandidateCount} invalid candidates · " +
                "${projection.unresolvedQuestionCount} questions",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Test Inventory candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Catalog receipt digest: ${record.catalogReceiptDigest}")
            appendLine("Coverage receipt digest: ${record.coverageReceiptDigest}")
            appendLine("Trace receipt digest: ${record.traceReceiptDigest}")
            appendLine("Ownership receipt digest: ${record.ownershipReceiptDigest}")
            appendLine("Assessment receipt digest: ${record.assessmentReceiptDigest}")
            appendLine(
                "Candidate coverage: ${record.assetCount} tests · ${record.catalogedAssetCount} cataloged · " +
                    "${record.conflictAssetCount} conflicts · ${record.observedAssetCount} observed · " +
                    "${record.plannedAssetCount} planned · ${record.reviewState}",
            )
        }
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and test catalog, coverage, trace, ownership, " +
                "assessment, and snapshot digests only; no test title, path, code, steps, data, owner, evidence, result, " +
                "personal data, secret, credential, or machine path. This inspection does not establish test existence, " +
                "inventory validity or completeness, environment availability, privacy or security approval, owner appointment, " +
                "test execution or results, evidence or coverage truth, quality, implementation readiness, acceptance, release, " +
                "deployment, or action authority.",
        )
    }

    fun readDesignSystemTokenContract(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readDesignSystemTokenContract(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Design System and Token Contract was read. Refresh the exact records." }
        return renderDesignSystemTokenContract(projection)
    }

    fun renderDesignSystemTokenContract(projection: DesignSystemTokenContractProjection): String = buildString {
        appendLine("GAEP governed Design System and Token Contract candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine(
            "Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState} · " +
                "catalog: ${projection.catalogCompletenessState}",
        )
        appendLine(
            "Inventory: ${projection.designSystemCount} systems · ${projection.tokenCount} tokens · " +
                "${projection.variableCollectionCount} collections · ${projection.variableCount} variables · " +
                "${projection.componentCount} components",
        )
        appendLine(
            "Requirement coverage: ${projection.representedRequirementCount} represented · " +
                "${projection.unresolvedRequirementCount} unresolved",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedOwnershipCount} ownership · " +
                "${projection.unresolvedCatalogItemCount} catalog · " +
                "${projection.accessibilityReviewGapCount} accessibility review · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.stalePortableSnapshotCount} stale portable snapshots · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Design System and Token Contract candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate inventory: ${record.designSystemCount} systems · ${record.tokenCount} tokens · " +
                    "${record.variableCollectionCount} collections · ${record.variableCount} variables · " +
                    "${record.componentCount} components · ${record.representedRequirementCount} represented requirements · " +
                    record.reviewState,
            )
        } ?: appendLine("Design System and Token Contract candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and digests only; no system, token, variable, " +
                "or component validity, ownership authority, accessibility validation, design approval, baseline, " +
                "readiness, implementation, write, or action authority.",
        )
    }

    fun readAccessibilityDesignRules(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readAccessibilityDesignRules(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Accessibility Design Rules were read. Refresh the exact records." }
        return renderAccessibilityDesignRules(projection)
    }

    fun renderAccessibilityDesignRules(projection: AccessibilityDesignRulesProjection): String = buildString {
        appendLine("GAEP governed Accessibility Design Rules candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine(
            "Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState} · " +
                "catalog: ${projection.catalogCompletenessState}",
        )
        appendLine("Inventory: ${projection.targetCount} targets · ${projection.ruleCount} rules · ${projection.checkCount} checks")
        appendLine(
            "Rule applicability: ${projection.applicableRuleCount} applicable · ${projection.notApplicableRuleCount} not applicable · " +
                "${projection.unresolvedRuleCount} unresolved",
        )
        appendLine(
            "Check evidence: ${projection.humanReviewedCheckCount} human-reviewed · " +
                "${projection.evidenceRecordedCheckCount} evidence-recorded · ${projection.notAssessedCheckCount} not assessed · " +
                "${projection.contradictedCheckCount} contradicted",
        )
        appendLine(
            "Requirement coverage: ${projection.representedRequirementCount} represented · " +
                "${projection.unresolvedRequirementCount} unresolved",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedOwnershipCount} ownership · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Accessibility Design Rules candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate inventory: ${record.targetCount} targets · ${record.ruleCount} rules · ${record.checkCount} checks · " +
                    "${record.representedRequirementCount} represented requirements · ${record.reviewState}",
            )
        } ?: appendLine("Accessibility Design Rules candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and digests only; no accessibility conformance, " +
                "rule or check validity, legal compliance, ownership authority, design approval, baseline, readiness, " +
                "implementation, write, or action authority.",
        )
    }

    fun readResponsiveMultiPlatformTargets(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readResponsiveMultiPlatformTargets(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Responsive and Multi-Platform Targets were read. Refresh the exact records." }
        return renderResponsiveMultiPlatformTargets(projection)
    }

    fun renderResponsiveMultiPlatformTargets(projection: ResponsiveMultiPlatformTargetsProjection): String = buildString {
        appendLine("GAEP governed Responsive and Multi-Platform Targets candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Catalogs: targets ${projection.targetCatalogState} · breakpoints ${projection.breakpointCatalogState} · " +
                "behaviors ${projection.behaviorCatalogState}",
        )
        appendLine(
            "Inventory: ${projection.platformTargetCount} platform targets · ${projection.breakpointCount} breakpoints · " +
                "${projection.behaviorCount} behaviors · ${projection.checkCount} checks",
        )
        appendLine(
            "Behavior applicability: ${projection.applicableBehaviorCount} applicable · " +
                "${projection.unresolvedBehaviorCount} unresolved",
        )
        appendLine(
            "Check evidence: ${projection.humanReviewedCheckCount} human-reviewed · " +
                "${projection.evidenceRecordedCheckCount} evidence-recorded · ${projection.notAssessedCheckCount} not assessed · " +
                "${projection.contradictedCheckCount} contradicted",
        )
        appendLine(
            "Requirement coverage: ${projection.representedRequirementCount} represented · " +
                "${projection.unresolvedRequirementCount} unresolved",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedOwnershipCount} ownership · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Responsive and Multi-Platform Targets candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate inventory: ${record.platformTargetCount} platform targets · ${record.breakpointCount} breakpoints · " +
                    "${record.behaviorCount} behaviors · ${record.checkCount} checks · " +
                    "${record.representedRequirementCount} represented requirements · ${record.reviewState}",
            )
        } ?: appendLine("Responsive and Multi-Platform Targets candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and digests only; no responsive completeness, " +
                "platform parity, breakpoint or behavior validity, accessibility conformance, ownership authority, " +
                "design approval, baseline, readiness, implementation, write, or action authority.",
        )
    }

    fun readManualFigmaExecutionPath(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readManualFigmaExecutionPath(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Manual Figma Execution Path was read. Refresh the exact records." }
        return renderManualFigmaExecutionPath(projection)
    }

    fun renderManualFigmaExecutionPath(projection: ManualFigmaExecutionPathProjection): String = buildString {
        appendLine("GAEP governed Manual Figma Execution Path candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Catalogs: guide ${projection.guideCatalogState} · handoff ${projection.handoffCatalogState} · " +
                "return ${projection.returnContractState}",
        )
        appendLine(
            "Inventory: ${projection.scopeCount} scopes · ${projection.instructionCount} instruction stages · " +
                "${projection.checkCount} checks",
        )
        appendLine(
            "Check evidence: ${projection.humanReviewedCheckCount} human-reviewed · " +
                "${projection.evidenceRecordedCheckCount} evidence-recorded · ${projection.notAssessedCheckCount} not assessed · " +
                "${projection.contradictedCheckCount} contradicted",
        )
        appendLine(
            "Requirement coverage: ${projection.representedRequirementCount} represented · " +
                "${projection.unresolvedRequirementCount} unresolved",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedOwnershipCount} ownership · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Manual Figma Execution Path candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate inventory: ${record.scopeCount} scopes · ${record.instructionCount} instruction stages · " +
                    "${record.checkCount} checks · ${record.representedRequirementCount} represented requirements · " +
                    record.reviewState,
            )
        } ?: appendLine("Manual Figma Execution Path candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and digests only; no Figma connection, " +
                "execution or returned-design completeness, write authority, design approval, baseline, readiness, " +
                "implementation, or action authority.",
        )
    }

    fun readFigmaMcpCapabilityDiscovery(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readFigmaMcpCapabilityDiscovery(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Figma MCP Capability Discovery was read. Refresh the exact records." }
        return renderFigmaMcpCapabilityDiscovery(projection)
    }

    fun renderFigmaMcpCapabilityDiscovery(projection: FigmaMcpCapabilityDiscoveryProjection): String = buildString {
        appendLine("GAEP governed Figma MCP Capability Discovery candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Catalogs: tools ${projection.catalogState} · permissions ${projection.permissionModelState} · " +
                "limits ${projection.limitCatalogState} · versions ${projection.versionCatalogState}",
        )
        appendLine(
            "Inventory: ${projection.toolCount} tool observations · ${projection.advertisedToolCount} advertised · " +
                "${projection.unavailableToolCount} not advertised · ${projection.unknownAvailabilityCount} unknown",
        )
        appendLine(
            "Effects: ${projection.readToolCount} read · ${projection.writeToolCount} write · " +
                "${projection.unknownEffectCount} unknown",
        )
        appendLine(
            "Evidence: ${projection.humanReviewedToolCount} human-reviewed · " +
                "${projection.sourceRecordedToolCount} source-recorded · ${projection.notAssessedToolCount} not assessed",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedPermissionCount} permissions · ${projection.unresolvedLimitCount} limits · " +
                "${projection.unresolvedVersionCount} versions · ${projection.unresolvedOwnershipCount} ownership · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Figma MCP Capability Discovery candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate inventory: ${record.toolCount} tools · ${record.advertisedToolCount} advertised · " +
                    "${record.readToolCount} read · ${record.writeToolCount} write · ${record.reviewState}",
            )
        } ?: appendLine("Figma MCP Capability Discovery candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and digests only; no Figma connection or call, " +
                "credential request, permission grant, live availability or compatibility claim, write authority, design approval, " +
                "baseline, readiness, implementation, or action authority.",
        )
    }

    fun readFigmaReadSnapshot(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readFigmaReadSnapshot(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Figma Read Snapshot was read. Refresh the exact records." }
        return renderFigmaReadSnapshot(projection)
    }

    fun renderFigmaReadSnapshot(projection: FigmaReadSnapshotProjection): String = buildString {
        appendLine("GAEP governed Figma Read Snapshot candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine("Catalogs: snapshot ${projection.snapshotCompletenessState} · provenance ${projection.provenanceState}")
        appendLine(
            "Inventory: ${projection.fileCount} files · ${projection.componentCount} components · " +
                "${projection.variableCollectionCount} variable collections · ${projection.variableCount} variables",
        )
        appendLine(
            "Evidence: ${projection.humanReviewedItemCount} human-reviewed · " +
                "${projection.sourceRecordedItemCount} source-recorded · ${projection.notAssessedItemCount} not assessed",
        )
        appendLine(
            "Freshness and type gaps: ${projection.staleFileCount} stale at capture · " +
                "${projection.unknownFreshnessFileCount} unknown freshness · ${projection.unresolvedTypeCount} unresolved variable types",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedOwnershipCount} ownership · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Figma Read Snapshot candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate inventory: ${record.fileCount} files · ${record.componentCount} components · " +
                    "${record.variableCollectionCount} variable collections · ${record.variableCount} variables · ${record.reviewState}",
            )
        } ?: appendLine("Figma Read Snapshot candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and digests only; no Figma connection or call, " +
                "credential request, permission grant, external completeness claim, write authority, design validation or approval, " +
                "baseline, readiness, implementation, or action authority.",
        )
    }

    fun readFigmaContextImport(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readFigmaContextImport(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Figma Context Import was read. Refresh the exact records." }
        return renderFigmaContextImport(projection)
    }

    fun renderFigmaContextImport(projection: FigmaContextImportProjection): String = buildString {
        appendLine("GAEP governed Figma Context Import candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Selection: ${projection.contextSelectionState} · provenance ${projection.provenanceState} · " +
                "preview ${projection.previewState}",
        )
        appendLine(
            "Inventory: ${projection.contextPackCount} Context Packs · ${projection.sectionCount} sections · " +
                "${projection.contextItemCount} Context Items · ${projection.targetCount} Figma targets",
        )
        appendLine(
            "Evidence: ${projection.humanReviewedSectionCount} human-reviewed · " +
                "${projection.sourceRecordedSectionCount} source-recorded · ${projection.notAssessedSectionCount} not assessed · " +
                "${projection.unresolvedRedactionCount} redaction gaps",
        )
        appendLine(
            "Requirement coverage: ${projection.representedRequirementCount} represented · " +
                "${projection.unresolvedRequirementCount} unresolved",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedOwnershipCount} ownership · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Figma Context Import candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate inventory: ${record.contextPackCount} Context Packs · ${record.sectionCount} sections · " +
                    "${record.contextItemCount} Context Items · ${record.targetCount} Figma targets · " +
                    "${record.representedRequirementCount} represented Requirements · ${record.reviewState}",
            )
        } ?: appendLine("Figma Context Import candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and digests only; no context packaging or transfer, " +
                "Figma connection or call, credential request, permission grant, write, target or design validation, design approval, " +
                "baseline, readiness, implementation, or action authority.",
        )
    }

    fun readOutboundDesignBriefPackage(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readOutboundDesignBriefPackage(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Outbound Design Brief Package was read. Refresh the exact records." }
        return renderOutboundDesignBriefPackage(projection)
    }

    fun renderOutboundDesignBriefPackage(projection: OutboundDesignBriefPackageProjection): String = buildString {
        appendLine("GAEP governed Outbound Design Brief Package candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Manifest: ${projection.manifestState} · provenance ${projection.provenanceState} · " +
                "redaction ${projection.redactionReviewState} · preview ${projection.previewState}",
        )
        appendLine(
            "Inventory: ${projection.contextPackCount} Context Packs · ${projection.entryCount} entries · " +
                "${projection.contextItemCount} Context Items · ${projection.recipientCount} recipients",
        )
        appendLine(
            "Evidence: ${projection.humanReviewedEntryCount} human-reviewed · " +
                "${projection.sourceRecordedEntryCount} source-recorded · ${projection.notAssessedEntryCount} not assessed · " +
                "${projection.unresolvedRedactionCount} redaction gaps",
        )
        appendLine(
            "Requirement coverage: ${projection.representedRequirementCount} represented · " +
                "${projection.unresolvedRequirementCount} unresolved · ${projection.unresolvedDisclosureCount} unresolved disclosures",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Outbound Design Brief Package candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Manifest receipt: ${record.manifestFormat} · ${record.manifestDigest}")
            appendLine("Payload receipt: ${record.payloadDigest}")
            appendLine(
                "Candidate inventory: ${record.contextPackCount} Context Packs · ${record.entryCount} entries · " +
                    "${record.contextItemCount} Context Items · ${record.recipientCount} recipients · " +
                    "${record.representedRequirementCount} represented Requirements · " +
                    "${record.unresolvedDisclosureCount} unresolved disclosures · ${record.reviewState}",
            )
        } ?: appendLine("Outbound Design Brief Package candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and digests only; no package materialization or context transfer, " +
                "Figma connection or call, credential request, permission grant, write, target or design validation, design approval, " +
                "baseline, readiness, implementation, or action authority.",
        )
    }

    fun readGovernedFigmaWrite(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readGovernedFigmaWrite(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Governed Figma Write was read. Refresh the exact records." }
        return renderGovernedFigmaWrite(projection)
    }

    fun renderGovernedFigmaWrite(projection: GovernedFigmaWriteProjection): String = buildString {
        appendLine("GAEP governed Figma Write authorization-review candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine(
            "Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState} · " +
                "plan ${projection.writePlanState}",
        )
        appendLine(
            "Governance: preview ${projection.previewState} · approval ${projection.approvalState} · " +
                "permission evidence ${projection.permissionEvidenceState}",
        )
        appendLine(
            "Safety: idempotency ${projection.idempotencyState} · replay ${projection.replayProtectionState} · " +
                "recovery ${projection.recoveryPlanState}",
        )
        appendLine("Execution: ${projection.writeExecutionState} · result ${projection.writeResultState}")
        appendLine(
            "Candidate gaps: ${projection.unresolvedDisclosureCount} disclosures · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Candidate record: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Request receipt: ${record.requestFormat} · ${record.requestDigest}")
            appendLine("Effect receipt: ${record.effectDigest}")
            appendLine("Preview receipt: ${record.previewDigest ?: "not-generated"}")
            appendLine(
                "Package receipt: ${record.outboundPackage.recordId}@${record.outboundPackage.revision} · " +
                    "manifest ${record.outboundPackage.manifestDigest} · payload ${record.outboundPackage.payloadDigest}",
            )
            appendLine(
                "Target receipts: file ${record.externalFileIdentityDigest} · expected version " +
                    "${record.expectedExternalVersionDigest} · ${record.selectedEntryCount} selected entries",
            )
            appendLine(
                "Candidate states: preview ${record.previewState} · approval ${record.approvalState} · " +
                    "permission evidence ${record.permissionEvidenceState} · idempotency ${record.idempotencyState} · " +
                    "recovery ${record.recoveryPlanState} · review ${record.reviewState} · execution ${record.writeExecutionState}",
            )
        } ?: appendLine("Candidate record: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and digests only; no package materialization or context transfer, " +
                "Figma connection or call, credential request, permission grant, write authorization or execution, target or design validation, " +
                "design approval, baseline, readiness, implementation, or action authority.",
        )
    }

    fun readFinalizedFigmaSnapshotImport(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readFinalizedFigmaSnapshotImport(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Finalized Figma Snapshot Import was read. Refresh the exact records." }
        return renderFinalizedFigmaSnapshotImport(projection)
    }

    fun renderFinalizedFigmaSnapshotImport(projection: FinalizedFigmaSnapshotImportProjection): String = buildString {
        appendLine("GAEP finalized Figma Snapshot Import review candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Reconciliation: ${projection.reconciliationState} · provenance ${projection.provenanceState} · " +
                "completeness ${projection.snapshotCompletenessState}",
        )
        appendLine("Return authorization: ${projection.returnAuthorizationState}")
        appendLine(
            "Inventory: ${projection.itemCount} items · ${projection.humanReviewedItemCount} human-reviewed · " +
                "${projection.sourceRecordedItemCount} source-recorded · ${projection.notAssessedItemCount} not assessed",
        )
        appendLine("Execution: ${projection.importExecutionState} · result ${projection.importResultState}")
        appendLine(
            "Candidate gaps: ${projection.openConflictCount} open conflicts · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Candidate record: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Governed write: ${record.governedWrite.recordId}@${record.governedWrite.revision} · " +
                    "request ${record.governedWrite.requestDigest} · effect ${record.governedWrite.effectDigest}",
            )
            appendLine(
                "Return receipts: file ${record.externalFileIdentityDigest} · returned version " +
                    "${record.returnedExternalVersionDigest} · payload ${record.payloadDigest} · receipt ${record.receiptDigest}",
            )
            appendLine("Reconciliation receipt: ${record.reconciliationDigest}")
            appendLine(
                "Candidate inventory: ${record.itemCount} items · ${record.conflictCount} conflicts · " +
                    "return authorization ${record.returnAuthorizationState} · reconciliation ${record.reconciliationState} · " +
                    "provenance ${record.provenanceState} · review ${record.reviewState} · execution ${record.importExecutionState}",
            )
        } ?: appendLine("Candidate record: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, counts, statuses, and digests only; no content transfer or import, " +
                "Figma connection or call, credential request, permission grant, external-completeness proof, target or design validation, " +
                "design approval, baseline, readiness, implementation, or action authority.",
        )
    }

    fun readDesignToRequirementBinding(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readDesignToRequirementBinding(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Design-to-Requirement Binding was read. Refresh the exact records." }
        return renderDesignToRequirementBinding(projection)
    }

    fun renderDesignToRequirementBinding(projection: DesignToRequirementBindingProjection): String = buildString {
        appendLine("GAEP Design-to-Requirement Binding review candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Governance: reconciliation ${projection.reconciliationState} · candidate coverage " +
                "${projection.candidateCoverageState} · provenance ${projection.provenanceState}",
        )
        appendLine("Bindings: ${projection.bindingCount} total · ${projection.humanReviewedBindingCount} human-reviewed")
        appendLine(
            "Coverage: ${projection.boundDesignItemCount}/${projection.designItemCount} design items · " +
                "${projection.boundRequirementCount}/${projection.requirementCount} Requirements · " +
                "${projection.boundDecisionCount}/${projection.decisionCount} Decisions",
        )
        appendLine(
            "Candidate gaps: ${projection.unboundDesignItemCount} unbound design items · " +
                "${projection.unboundRequirementCount} unbound Requirements · ${projection.unboundDecisionCount} unbound Decisions · " +
                "${projection.openConflictCount} open conflicts · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Candidate record: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Finalized snapshot: ${record.finalizedSnapshot.recordId}@${record.finalizedSnapshot.revision} · " +
                    "catalog ${record.finalizedSnapshot.catalogDigest}",
            )
            appendLine(
                "Design Requirements: ${record.designRequirements.recordId}@${record.designRequirements.revision} · " +
                    "catalog ${record.designRequirements.catalogDigest}",
            )
            appendLine(
                "Decision Register: ${record.decisionRegister.recordId}@${record.decisionRegister.revision} · " +
                    "catalog ${record.decisionRegister.catalogDigest}",
            )
            appendLine("Reconciliation receipt: ${record.reconciliationDigest}")
            appendLine(
                "Candidate inventory: ${record.bindingCount} bindings · ${record.designItemCoverageCount} design items · " +
                    "${record.subjectCoverageCount} governed subjects · ${record.conflictCount} conflicts",
            )
        } ?: appendLine("Candidate record: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, exact dependency and catalog digests, counts, and statuses only; " +
                "no relationship-truth or coverage-completeness proof, Requirement satisfaction, Decision effectiveness, " +
                "external-completeness proof, design validation or approval, baseline, readiness, Figma connection or call, " +
                "credential request, permission grant, import or write execution, implementation, or action authority.",
        )
    }

    fun readDesignerReadyGate(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readDesignerReadyGate(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Designer-Ready Gate was read. Refresh the exact records." }
        return renderDesignerReadyGate(projection)
    }

    fun renderDesignerReadyGate(projection: DesignerReadyGateProjection): String = buildString {
        appendLine("GAEP Designer-Ready Gate candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate result: ${projection.candidateResult} · ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Coverage: ${projection.satisfiedCount} satisfied · ${projection.notApplicableCount} not-applicable candidates · " +
                "${projection.humanReviewedCount}/${projection.prerequisiteCount} human-reviewed",
        )
        appendLine(
            "Candidate gaps: ${projection.unsatisfiedCount} unsatisfied · ${projection.notAssessedCount} not assessed · " +
                "${projection.staleOrUnknownCount} stale/unknown · ${projection.pendingExceptionCount} pending exceptions · " +
                "${projection.invalidExceptionCount} invalid exceptions · ${projection.unresolvedQuestionCount} questions · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Candidate record: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Prerequisites: ${record.prerequisiteCount} exact · ${record.prerequisiteCatalogDigest}")
            appendLine(
                "Assessment: definition ${record.assessmentDefinitionDigest} · receipt ${record.assessmentReceiptDigest} · " +
                    "evaluations ${record.evaluationCatalogDigest}",
            )
            appendLine("Exception catalog: ${record.exceptionCatalogDigest}")
        } ?: appendLine("Candidate record: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, exact digests, counts, and results only; a passing candidate is an " +
                "evaluation result, not permission or readiness, and grants no completeness, validity, approval, baseline, " +
                "exception, waiver, acceptance, phase-entry, Figma connection, credential, permission, import, write, " +
                "implementation, or action authority.",
        )
    }

    fun readDesignDelta(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readDesignDelta(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Design Delta was read. Refresh the exact records." }
        return renderDesignDelta(projection)
    }

    fun renderDesignDelta(projection: DesignDeltaProjection): String = buildString {
        appendLine("GAEP Design Delta candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate result: ${projection.candidateResult} · ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Compared inventory: ${projection.sourceItemCount} source items · ${projection.targetItemCount} target items · " +
                "${projection.deltaCount} deltas",
        )
        appendLine(
            "Deltas: ${projection.addedCount} added · ${projection.changedCount} changed · " +
                "${projection.conflictingCount} conflicting · ${projection.missingCount} missing · " +
                "${projection.staleCount} stale · ${projection.unmappedCount} unmapped · " +
                "${projection.humanReviewedCount}/${projection.deltaCount} human-reviewed",
        )
        appendLine("Comparison governance: comparison ${projection.comparisonState} · provenance ${projection.provenanceState}")
        appendLine(
            "Candidate gaps: ${projection.unresolvedMappingCount} unresolved mappings · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Candidate record: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Dependencies: Designer-Ready ${record.designerReadyGate.recordId}@${record.designerReadyGate.revision} · " +
                    "finalized snapshot ${record.finalizedSnapshot.recordId}@${record.finalizedSnapshot.revision} · " +
                    "design binding ${record.designBinding.recordId}@${record.designBinding.revision}",
            )
            appendLine("Snapshots: source ${record.sourceSnapshotDigest} · target ${record.targetSnapshotDigest}")
            appendLine(
                "Comparison: definition ${record.comparisonDefinitionDigest} · receipt ${record.comparisonReceiptDigest} · " +
                    "catalog ${record.deltaCatalogDigest}",
            )
        } ?: appendLine("Candidate record: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, exact dependency, snapshot, comparison, receipt, catalog, counts, " +
                "and results only; this comparison is observational and establishes no delta or external completeness, " +
                "design validity, approval, baseline, readiness, conflict-resolution or synchronization authority, Figma " +
                "connection, credential, permission, import, write, implementation, or action authority.",
        )
    }

    fun readDesignConflictResolution(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readDesignConflictResolution(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Design Conflict Resolution was read. Refresh the exact records." }
        return renderDesignConflictResolution(projection)
    }

    fun renderDesignConflictResolution(projection: DesignConflictResolutionProjection): String = buildString {
        appendLine("GAEP Design Conflict Resolution candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate result: ${projection.candidateResult} · ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine("Conflict inventory: ${projection.conflictCount} conflicts · ${projection.resolutionCount} resolution candidates")
        appendLine(
            "Candidate actions: ${projection.acceptSourceCount} accept source · ${projection.acceptTargetCount} accept target · " +
                "${projection.mergeCount} merge · ${projection.rejectChangeCount} reject change · ${projection.escalateCount} escalate",
        )
        appendLine(
            "Recorded review: ${projection.humanReviewedCount}/${projection.resolutionCount} human-reviewed · " +
                "${projection.distinctActorDeclaredCount} distinct-actor declarations · ${projection.expiredCandidateCount} expired",
        )
        appendLine(
            "Candidate governance: coverage ${projection.coverageState} · provenance ${projection.provenanceState} · " +
                "separation of duties not enforced",
        )
        appendLine(
            "Candidate gaps: ${projection.unresolvedConflictCount} unresolved conflicts · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Candidate record: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Design Delta: ${record.designDelta.recordId}@${record.designDelta.revision} · " +
                    "${record.designDelta.conflictingCount} conflicts · catalog ${record.designDelta.deltaCatalogDigest}",
            )
            appendLine(
                "Resolution evidence: definition ${record.resolutionDefinitionDigest} · " +
                    "receipt ${record.resolutionReceiptDigest} · catalog ${record.resolutionCatalogDigest}",
            )
        } ?: appendLine("Candidate record: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, exact Design Delta binding, receipts, catalog digests, counts, " +
                "results, and recorded review states only; this view does not enforce separation of duties, resolve or " +
                "apply conflicts, synchronize design, establish validity, approval, baseline, or readiness, call Figma, " +
                "request credentials, grant permissions, execute imports or writes, or grant implementation or action authority.",
        )
    }

    fun readHumanDesignApproval(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readHumanDesignApproval(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Human Design Approval was read. Refresh the exact records." }
        return renderHumanDesignApproval(projection)
    }

    fun renderHumanDesignApproval(projection: HumanDesignApprovalProjection): String = buildString {
        appendLine("GAEP Human Design Approval decision candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate result: ${projection.candidateResult} · ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Prerequisites: ${projection.completePrerequisiteCount}/${projection.prerequisiteCount} complete · " +
                "${projection.decisionCount} recorded decision candidate",
        )
        appendLine(
            "Decision candidates: ${projection.approveCount} approve · ${projection.rejectCount} reject · " +
                "${projection.requestChangeCount} request change · ${projection.abstainCount} abstain",
        )
        appendLine(
            "Candidate gaps: ${projection.expiredDecisionCount} expired · ${projection.revokedDecisionCount} revoked · " +
                "${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references · " +
                "${projection.unresolvedQuestionCount} unresolved questions",
        )
        appendLine(
            "Authority: approver ${projection.approverAuthorityState} · separation of duties " +
                projection.separationOfDutiesEnforcementState,
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Candidate record: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Prerequisite catalog: ${record.prerequisiteCatalogDigest}")
            appendLine(
                "Exact finalized snapshot: ${record.subject.recordId}@${record.subject.revision} · " +
                    "${record.subject.itemCount} items · catalog ${record.subject.itemCatalogDigest}",
            )
            appendLine(
                "External identity/version digests: ${record.subject.externalFileIdentityDigest} · " +
                    record.subject.returnedExternalVersionDigest,
            )
            appendLine(
                "Decision evidence: definition ${record.decisionDefinitionDigest} · receipt ${record.decisionReceiptDigest} · " +
                    "scope ${record.scopeDigest}",
            )
            appendLine(
                "Recorded candidate: ${record.decisionKind ?: "not recorded"} · " +
                    "${record.decisionLifecycleState ?: "not recorded"} · ${record.decisionDigest ?: "not recorded"}",
            )
        } ?: appendLine("Candidate record: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, exact finalized-snapshot subject, prerequisite, scope, decision " +
                "receipt digests, counts, and recorded results only; this view does not verify approver authority, enforce " +
                "separation of duties, establish design approval, baseline, readiness, or phase entry, call Figma, request " +
                "credentials, grant permissions, execute imports or writes, or grant implementation or action authority.",
        )
    }

    fun readDesignBaseline(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readDesignBaseline(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Design Baseline was read. Refresh the exact records." }
        return renderDesignBaseline(projection)
    }

    fun renderDesignBaseline(projection: DesignBaselineProjection): String = buildString {
        appendLine("GAEP Design Baseline version candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate result: ${projection.candidateResult} · ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine(
            "Candidate inventory: ${projection.candidateSetCount} set · ${projection.designationCandidateCount} designation · " +
                "${projection.supersessionCandidateCount} supersession · ${projection.withdrawalCandidateCount} withdrawal · " +
                "${projection.restorationCandidateCount} restoration",
        )
        appendLine(
            "Candidate gaps: ${projection.expiredDesignationCount} expired · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references · ${projection.unresolvedQuestionCount} unresolved questions",
        )
        appendLine(
            "Authority: approval determination ${projection.approvalDeterminationState} · baseline designation " +
                projection.baselineDesignationState,
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Candidate record: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Exact approval candidate: ${record.approval.recordId}@${record.approval.revision} · " +
                    record.approval.assessmentState,
            )
            appendLine(
                "Exact finalized snapshot: ${record.subject.recordId}@${record.subject.revision} · " +
                    "${record.subject.itemCount} items · catalog ${record.subject.itemCatalogDigest}",
            )
            appendLine("Scope digest: ${record.scopeDigest}")
            appendLine(
                "Lineage: ${record.baselineLineageId} · candidate set ${record.candidateSetId}@${record.candidateSetRevision}",
            )
            appendLine("Version: ${record.semanticVersion} · policy ${record.versionPolicyDigest}")
            appendLine(
                "Designation evidence: definition ${record.designationDefinitionDigest} · receipt ${record.designationReceiptDigest}",
            )
            appendLine(
                "Designation candidate: ${record.designationKind ?: "not proposed"} · " +
                    (record.designationDigest ?: "not recorded"),
            )
            appendLine(
                "Exact predecessor: " + (record.supersedes?.let {
                    "${it.recordId}@${it.revision} · ${it.semanticVersion}"
                } ?: "initial candidate"),
            )
        } ?: appendLine("Candidate record: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: candidate identities, exact Human Design Approval and finalized-snapshot bindings, " +
                "version axes, lineage, scope and receipt digests, designation kind, predecessor, counts, and recorded " +
                "states only; this view does not convert an approval candidate into approval, verify approver authority, " +
                "enforce separation of duties, establish a Baseline Set designation, readiness, or phase entry, call " +
                "Figma, request credentials, grant permissions, execute imports or writes, or grant implementation or action authority.",
        )
    }

    fun readDesignDriftDetection(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        val projection = client.readDesignDriftDetection(initiativeId)
        require(
            projection.productId == product.id && projection.productRevision == product.revision &&
                projection.productDigest == product.digest && projection.initiativeId == initiative.id &&
                projection.initiativeRevision == initiative.revision &&
                projection.initiativeDigest == initiative.digest && projection.initiativeState == initiative.state
        ) { "The Product or Initiative changed while Design Drift Detection was read. Refresh the exact records." }
        return renderDesignDriftDetection(projection)
    }

    fun renderDesignDriftDetection(projection: DesignDriftDetectionProjection): String = buildString {
        appendLine("GAEP Design Drift Detection candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate result: ${projection.candidateResult} · ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine("Implementation targets: ${projection.humanReviewedImplementationTargetCount}/${projection.implementationTargetCount} human-reviewed")
        appendLine("Comparison paths: ${projection.requirementToDesignCount} requirement-to-design · ${projection.designToImplementationCount} design-to-implementation")
        appendLine("Classifications: ${projection.conformantCount} conformant · ${projection.driftCount} drift · ${projection.unassessedCount} unassessed")
        appendLine("Severity: ${projection.blockerCount} blocker · ${projection.highSeverityCount} high")
        appendLine("Remediation candidates: ${projection.remediationCandidateCount} recorded · ${projection.expiredRemediationCandidateCount} expired · effects not applied")
        appendLine("Candidate gaps: ${projection.staleBindingCount} stale bindings · ${projection.staleSourceReferenceCount} stale Source references · ${projection.unresolvedQuestionCount} unresolved questions")
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Candidate record: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Baseline candidate: ${record.designBaseline.recordId}@${record.designBaseline.revision} · ${record.designBaseline.semanticVersion} · designation ${record.designBaseline.baselineDesignationState}")
            appendLine("Returned design: ${record.returnedFigmaSnapshot.recordId}@${record.returnedFigmaSnapshot.revision} · returned version ${record.returnedFigmaSnapshot.returnedExternalVersionDigest}")
            appendLine("Design Requirements: ${record.designRequirements.recordId}@${record.designRequirements.revision} · ${record.designRequirements.catalogDigest}")
            appendLine("Design trace: ${record.designTrace.recordId}@${record.designTrace.revision} · ${record.designTrace.reconciliationDigest}")
            appendLine("Implementation target catalog: revision ${record.implementationTargetCatalogRevision} · ${record.implementationTargetCatalogDigest}")
            appendLine("Comparison: policy ${record.comparisonPolicyDigest} · receipt ${record.comparisonDigest}")
        } ?: appendLine("Candidate record: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: exact candidate identities, version axes, catalog and comparison digests, counts, " +
                "classifications, severities, review state, and non-effect status only; this view " +
                "does not establish an actual Baseline Set, drift completeness, external completeness, design or implementation validity, " +
                "approval, readiness, remediation effect, call Figma, import or write content, change implementation, " +
                "or grant action authority.",
        )
    }

    fun renderDesignApplicability(projection: DesignApplicabilityProjection): String = buildString {
        appendLine("GAEP governed Design Applicability candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Candidate assessment: ${projection.assessmentState} · review state: ${projection.reviewState}")
        appendLine("Coverage: ${projection.scopeCount} scopes · ${projection.decisionCount} explicit UX, UI, design-work, and Figma decisions")
        appendLine(
            "Candidate gaps: ${projection.unresolvedDecisionCount} unresolved decisions · ${projection.blockedDecisionCount} blocked decisions · " +
                "${projection.pendingApprovalCount} pending approvals · ${projection.rejectedApprovalCount} rejected approvals · " +
                "${projection.unresolvedDepthCount} unresolved depths · ${projection.unresolvedSourceCount} unresolved sources · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.candidate?.let { record ->
            appendLine("Design Applicability candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine("Candidate inventory: ${record.scopeCount} scopes · ${record.reviewState}")
        } ?: appendLine("Design Applicability candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Authority boundary: silence is never not applicable; this candidate does not approve design, establish a Design Baseline, " +
                "grant readiness, authorize implementation, write, or action.",
        )
    }

    fun renderFailureRecoveryModel(projection: FailureRecoveryModelProjection): String = buildString {
        appendLine("GAEP governed Failure and Recovery Model candidate")
        appendLine()
        appendLine("Initiative: ${projection.initiativeId} · revision ${projection.initiativeRevision} · ${projection.initiativeState}")
        appendLine("Assessment: ${projection.assessmentState}")
        appendLine(
            "Coverage: ${projection.failureModeCount} failure modes · ${projection.retryPolicyCount} retry policies · " +
                "${projection.compensationPlanCount} compensation plans · ${projection.recoveryPlanCount} recovery plans · " +
                "${projection.recoveryEvidenceDefinitionCount} recovery evidence definitions",
        )
        appendLine(
            "Candidate gaps: ${projection.uncoveredProcessCount} processes · ${projection.uncoveredCommandCount} commands · " +
                "${projection.uncoveredRouteCount} routes · ${projection.uncoveredAuthorizationActionCount} authorization actions · " +
                "${projection.unresolvedRecoveryEvidenceCount} recovery evidence definitions · " +
                "${projection.unresolvedRequirementCount} requirements · ${projection.inconsistencyCount} inconsistencies · " +
                "${projection.unresolvedQuestionCount} questions · ${projection.staleBindingCount} stale bindings · " +
                "${projection.staleSourceReferenceCount} stale Source references",
        )
        projection.reasons.forEach { appendLine("  - $it") }
        appendLine()
        projection.model?.let { record ->
            appendLine("Failure and recovery candidate: ${record.id}@${record.revision} · candidate · ${record.digest}")
            appendLine("Membership digest: ${record.membershipDigest}")
            appendLine(
                "Candidate counts: ${record.failureModeCount} failure modes · ${record.retryPolicyCount} retry policies · " +
                    "${record.compensationPlanCount} compensation plans · ${record.recoveryPlanCount} recovery plans · " +
                    "${record.recoveryEvidenceDefinitionCount} recovery evidence definitions",
            )
        } ?: appendLine("Failure and recovery candidate: not recorded")
        appendLine()
        appendLine("Snapshot digest: ${projection.snapshotDigest}")
        append(
            "Boundary: this privacy-safe view exposes no failure evidence, operational telemetry, retry keys, " +
                "compensation content, recovery steps, Source content, personal data, local paths, secrets, or credentials " +
                "and does not prove failure occurrence, establish retry safety, execute compensation or restoration, " +
                "establish recovery success, authorize return to service, establish operational readiness, promote a baseline, or authorize action.",
        )
    }

    fun classifyInitiative(
        context: InitiativeEntryContext,
        input: InitiativeClassificationInput,
        actorId: String,
    ): String {
        require(context.initiative.state !in setOf("completed", "cancelled")) {
            "Terminal Initiative ${context.initiative.state} entry records are immutable."
        }
        require(sameInitiativeEntryBinding(readInitiativeEntryContext(context.initiative.id), context)) {
            "The Initiative changed while the classification form was open. Refresh and review the exact revision."
        }
        val updated = client.classifyInitiative(context.initiative.id, context.initiative.revision, input, actorId)
        return renderInitiativeEntry(readInitiativeEntryContext(updated.id))
    }

    fun resolveInitiativeApplicability(
        context: InitiativeEntryContext,
        input: InitiativeApplicabilityMatrixInput,
        actorId: String,
    ): String {
        require(context.initiative.state !in setOf("completed", "cancelled")) {
            "Terminal Initiative ${context.initiative.state} entry records are immutable."
        }
        require(context.assessment.classification.status == "current") {
            "Record a classification bound to the current Product revision before resolving applicability."
        }
        require(sameInitiativeEntryBinding(readInitiativeEntryContext(context.initiative.id), context)) {
            "The Initiative changed while the applicability form was open. Refresh and review the exact revision."
        }
        val coverage = context.assessment.applicability.coverage
        val subjectCatalog = InitiativeApplicabilitySubjectCatalogBinding(
            catalogVersion = coverage.catalogVersion
                ?: throw IllegalArgumentException("The canonical applicability subject catalog is unavailable."),
            digest = coverage.catalogDigest
                ?: throw IllegalArgumentException("The canonical applicability subject catalog is unavailable."),
            subjectCount = coverage.subjectCount,
        )
        require(subjectCatalog.subjectCount > 0) {
            "The canonical applicability subject catalog is unavailable."
        }
        require(input.subjectCatalog == null || input.subjectCatalog == subjectCatalog) {
            "The applicability form targets a stale subject catalog. Refresh and review the exact catalog."
        }
        val updated = client.resolveInitiativeApplicability(
            context.initiative.id,
            context.initiative.revision,
            input.copy(subjectCatalog = subjectCatalog),
            actorId,
        )
        return renderInitiativeEntry(readInitiativeEntryContext(updated.id))
    }

    private fun sameInitiativeEntryBinding(left: InitiativeEntryContext, right: InitiativeEntryContext): Boolean =
        left.initiative == right.initiative &&
            left.assessment.copy(assessedAt = right.assessment.assessedAt) == right.assessment

    fun readPhaseDashboard(): String {
        val product = client.readProductBinding()
        return renderPhaseDashboard(client.readPhaseDashboard(product))
    }

    fun readPhase2UxFigmaDashboard(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        require(initiative.productId == product.id) {
            "The Initiative does not target the exact current Product. Reload the Product and Initiative."
        }
        return renderPhase2UxFigmaDashboard(client.readPhase2UxFigmaDashboard(product, initiative))
    }

    fun readPhase2UxFigmaDashboardTables(initiativeId: UUID): List<AccessibleMetadataTable> {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        require(initiative.productId == product.id) {
            "The Initiative does not target the exact current Product. Reload the Product and Initiative."
        }
        return AccessibleDashboardTables.phase2UxFigma(client.readPhase2UxFigmaDashboard(product, initiative))
    }

    fun readPhase2ChangeImpactAgentModelDashboard(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        require(initiative.productId == product.id) {
            "The Initiative does not target the exact current Product. Reload the Product and Initiative."
        }
        return renderPhase2ChangeImpactAgentModelDashboard(
            client.readPhase2ChangeImpactAgentModelDashboard(product, initiative),
        )
    }

    fun readPhase2ChangeImpactAgentModelDashboardTables(initiativeId: UUID): List<AccessibleMetadataTable> {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        require(initiative.productId == product.id) {
            "The Initiative does not target the exact current Product. Reload the Product and Initiative."
        }
        return AccessibleDashboardTables.phase2ChangeImpactAgentModel(
            client.readPhase2ChangeImpactAgentModelDashboard(product, initiative),
        )
    }

    fun readPhase1Summary(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        require(initiative.productId == product.id) {
            "The Initiative does not target the exact current Product. Reload the Product and Initiative."
        }
        return renderPhase1Summary(client.readPhase1Summary(product, initiative))
    }

    fun readPhase1ChangeImpact(initiativeId: UUID, changeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        require(initiative.productId == product.id) {
            "The Initiative does not target the exact current Product. Reload the Product and Initiative."
        }
        val catalog = client.listChangeImpactChanges(product)
        val change = catalog.items.singleOrNull { it.recordId == changeId }
            ?: error("The Change is not part of the verified current catalog. Reload and select the exact Change again.")
        return renderPhase1ChangeImpact(client.readPhase1ChangeImpact(product, initiative, change))
    }

    fun readPhaseDashboardTables(): List<AccessibleMetadataTable> {
        val product = client.readProductBinding()
        return AccessibleDashboardTables.phase(client.readPhaseDashboard(product))
    }

    fun readChangeImpactContext(): ChangeImpactContext {
        val product = client.readProductBinding()
        return ChangeImpactContext(product, client.listChangeImpactChanges(product))
    }

    fun readChangeImpact(context: ChangeImpactContext, change: ChangeImpactChangeReference): String {
        require(change in context.catalog.items) {
            "The selected Change is not part of the verified current catalog. Reload and select the Change again."
        }
        return renderChangeImpactDashboard(client.readChangeImpact(context.product, change))
    }

    fun readChangeImpactTables(
        context: ChangeImpactContext,
        change: ChangeImpactChangeReference,
    ): List<AccessibleMetadataTable> {
        require(change in context.catalog.items) {
            "The selected Change is not part of the verified current catalog. Reload and select the Change again."
        }
        return AccessibleDashboardTables.changeImpact(client.readChangeImpact(context.product, change))
    }

    fun readAgentModel(): String {
        val product = client.readProductBinding()
        return renderAgentModelDashboard(client.readAgentModel(product))
    }

    fun readPhase1AgentModel(initiativeId: UUID): String {
        val product = client.readProductBinding()
        val initiative = client.readInitiative(initiativeId)
        return renderPhase1AgentModelDashboard(client.readPhase1AgentModel(product, initiative))
    }

    fun readAgentModelTables(): List<AccessibleMetadataTable> {
        val product = client.readProductBinding()
        return AccessibleDashboardTables.agentModel(client.readAgentModel(product))
    }

    fun readAgentReadiness(): String = buildString {
        appendLine("GAEP Codex and Claude readiness")
        appendLine()
        appendLine("Observation only: this view cannot select a model, change settings, start an agent, resume work, or grant execution authority.")
        appendLine("Only verified, path-free capability metadata is shown. Executable paths, provider credentials, and raw engine output are withheld.")
        client.probeAgentReadiness().forEach { snapshot ->
            appendLine()
            append(renderAgentReadiness(snapshot))
        }
    }

    fun readAgentSelectionContext(): AgentSelectionContext {
        val current = client.readAgentSelection()
        if (current is AgentSelectionState.MigrationRequired) {
            throw IllegalArgumentException(
                "The existing legacy Agent Selection requires explicit migration review. Rider will not overwrite it implicitly.",
            )
        }
        if (current == AgentSelectionState.Invalid) {
            throw IllegalArgumentException(
                "The existing Agent Selection is invalid. Repair or review the governed record before selecting another agent.",
            )
        }
        val available = client.probeAgentReadiness().filter { it.detected && it.executionInterface != "unavailable" }
        require(available.isNotEmpty()) { "No verified local Codex or Claude adapter is currently available for selection." }
        return AgentSelectionContext(current, available)
    }

    fun selectAgent(
        adapterId: String,
        modelId: String,
        settings: Map<String, PortableAgentSettingValue>,
        actorId: String,
    ): String = renderAgentSelection(client.selectAgent(adapterId, modelId, settings, actorId))

    fun readAgentHandoffContext(): AgentHandoffContext {
        val current = when (val state = client.readAgentSelection()) {
            AgentSelectionState.Unselected -> throw IllegalArgumentException(
                "No prior Agent Selection exists. Use guarded selection before creating Runs or handoffs.",
            )
            is AgentSelectionState.MigrationRequired -> throw IllegalArgumentException(
                "The existing legacy Agent Selection requires explicit migration review before a versioned handoff.",
            )
            AgentSelectionState.Invalid -> throw IllegalArgumentException(
                "The existing Agent Selection is invalid. Repair or review the governed record before creating a handoff.",
            )
            is AgentSelectionState.Selected -> state.selection
        }
        val runs = client.listRuns()
        val active = runs.filterNot(::isTerminalRun)
        require(active.isEmpty()) {
            "A versioned handoff cannot be created while ${active.size} Run(s) are non-terminal. Stop, cancel, or reconcile the Run first."
        }
        val sourceRun = runs.firstOrNull()
            ?: throw IllegalArgumentException("No prior terminal Run exists to bind as the source of a versioned handoff.")
        require(samePortableBinding(sourceRun.agent, current)) {
            "The latest terminal Run is not bound to the current Agent Selection. Refresh or reconcile governed state before handing off."
        }
        val available = client.probeAgentReadiness().filter { it.detected && it.executionInterface != "unavailable" }
        require(available.isNotEmpty()) { "No verified local Codex or Claude adapter is currently available for handoff." }
        return AgentHandoffContext(current, sourceRun, available)
    }

    fun createAgentHandoff(
        context: AgentHandoffContext,
        toAdapterId: String,
        toModelId: String,
        toSettings: Map<String, PortableAgentSettingValue>,
        reason: String,
        completedWork: List<String>,
        unresolvedMatters: List<String>,
        decisions: List<String>,
        evidence: List<String>,
        actorId: String,
    ): String {
        require(!samePortableBinding(context.current, toAdapterId, toModelId, toSettings)) {
            "The handoff target is identical to the current portable Agent Selection. Choose a different adapter, model, or setting."
        }
        require(completedWork.isNotEmpty() || unresolvedMatters.isNotEmpty() || decisions.isNotEmpty() || evidence.isNotEmpty()) {
            "Record at least one completed-work, unresolved-matter, decision, or portable evidence entry before creating a handoff."
        }
        val freshSelection = client.readAgentSelection()
        val freshRuns = client.listRuns()
        val freshSource = freshRuns.firstOrNull()
            ?: throw IllegalArgumentException(
                "Agent Selection or Run history changed while the handoff form was open. No handoff was requested; reopen the flow and review fresh state.",
            )
        require(freshSelection is AgentSelectionState.Selected && freshSelection.selection == context.current &&
            freshRuns.all(::isTerminalRun) && freshSource == context.sourceRun &&
            samePortableBinding(freshSource.agent, context.current)
        ) {
            "Agent Selection or Run history changed while the handoff form was open. No handoff was requested; reopen the flow and review fresh state."
        }
        return renderAgentHandoff(
            client.createHandoff(
                fromRunId = context.sourceRun.id,
                productId = context.sourceRun.productId,
                initiativeId = context.sourceRun.initiativeId,
                toAdapterId = toAdapterId,
                toAgentId = context.available.single { it.adapterId == toAdapterId }.agentId,
                toModelId = toModelId,
                toSettings = toSettings,
                reason = reason,
                completedWork = completedWork,
                unresolvedMatters = unresolvedMatters,
                decisions = decisions,
                evidence = evidence,
                actorId = actorId,
            ),
        )
    }

    fun previewManagedReadOnly(charterId: String, workflowPlanId: String): ManagedReadOnlyPreview =
        client.previewManagedReadOnly(
            charterId = parseUuid(charterId, "Charter ID"),
            workflowPlanId = parseUuid(workflowPlanId, "Workflow Plan ID"),
        )

    fun renderManagedReadOnlyPreview(preview: ManagedReadOnlyPreview): String = buildString {
        appendLine("GAEP managed read-only execution preview")
        appendLine()
        appendLine("Exact preview digest: ${preview.previewDigest}")
        appendLine("Product: ${preview.productId}")
        appendLine("Initiative: ${preview.initiativeId}")
        appendLine("Charter: ${preview.charterId}")
        appendLine("Charter digest: ${preview.charterDigest}")
        appendLine("Workflow Plan: ${preview.workflowPlanId}")
        appendLine("Workflow Plan digest: ${preview.workflowPlanDigest}")
        appendLine("Provider binding: ${preview.agentId} / ${preview.modelId} (${preview.adapterId})")
        appendLine("Selection digest: ${preview.selectionDigest}")
        appendLine("Strategy: ${preview.strategy}")
        appendLine("Steps: ${preview.stepIds.size}")
        appendLine("Context packs: ${preview.contextPackCount}")
        appendLine("Declared reads: ${preview.readScopeCount}")
        appendLine("Evidence and stop gates: ${preview.gates.size}")
        preview.gates.forEach { gate ->
            appendLine("  - ${gate.key} [${gate.phase}]${gate.stepId?.let { "; step=$it" }.orEmpty()}")
            appendLine("    Criteria digest: ${gate.criteriaDigest}")
            if (gate.criteria.isEmpty()) appendLine("    Criteria: none declared")
            gate.criteria.forEach { appendLine("    - $it") }
        }
        appendLine()
        appendLine("Authority boundary: ${preview.authorityBoundary}")
        appendLine("Every Tool permission is denied. No tool definitions, write scopes, or non-observation effects are granted.")
        append("This preview does not execute work; the exact digest must be attested separately.")
    }

    fun executeManagedReadOnly(
        preview: ManagedReadOnlyPreview,
        actorId: String,
        timeoutMs: Int = 120_000,
    ): String = renderManagedReadOnlyReceipt(client.executeManagedReadOnly(preview, timeoutMs, actorId))

    fun listManagedEvidencePage(
        offset: Int = 0,
        limit: Int = 100,
        snapshotDigest: String? = null,
        expectedTotal: Int? = null,
    ): ManagedRunSummaryPage = client.listManagedEvidence(offset, limit, snapshotDigest, expectedTotal)

    fun listManagedEvidence(): String = renderManagedEvidencePage(listManagedEvidencePage())

    fun renderManagedEvidencePage(page: ManagedRunSummaryPage): String = buildString {
        appendLine("GAEP bounded Managed Run evidence")
        appendLine()
        appendLine("Snapshot: ${page.snapshotDigest}")
        appendLine("Offset / limit: ${page.offset} / ${page.limit}")
        appendLine("Displayed: ${page.items.size} of ${page.total}")
        appendLine("Omitted from this page: ${page.omittedCount}")
        appendLine("More pages available: ${yesNo(page.hasMore)}")
        if (page.items.isEmpty()) appendLine("No Managed Runs exist in the verified bounded inventory.")
        page.items.forEach { item ->
            appendLine()
            appendLine(
                "${item.managedRunId} · ${item.state} · ${item.mode}\n" +
                    "  Provider: ${item.adapterId} / ${item.agentId} / ${item.modelId}\n" +
                    "  Updated: ${item.updatedAt}; recovery=${item.recoveryStatus}; " +
                    "result=${if (item.hasResult) "bound" else "not bound"}; " +
                    "apply decision=${if (item.hasApplyDecision) "bound" else "not bound"}",
            )
        }
        appendLine()
        appendLine(
            "Boundary: this audit-gated observation cannot start, resume, cancel, apply, discard, approve, or grant " +
                "Run, Tool, write, effect, outcome, implementation-readiness, or release authority.",
        )
        append(
            "Raw provider output, prompts, context content, changed paths, source bytes, executable paths, process state, " +
                "workspace paths, and credentials are withheld.",
        )
    }

    fun readManagedEvidence(managedRunId: String): String =
        renderManagedEvidenceDetail(client.readManagedEvidence(parseUuid(managedRunId, "Managed Run ID")))

    fun readManagedReview(managedRunId: String): ManagedReviewPreview =
        client.readManagedReview(parseUuid(managedRunId, "Managed Run ID"))

    fun applyManagedReview(preview: ManagedReviewPreview, actorId: String): ManagedReviewTransition =
        client.applyManagedReview(preview, actorId)

    fun discardManagedReview(preview: ManagedReviewPreview, actorId: String): ManagedReviewTransition =
        client.discardManagedReview(preview, actorId)

    fun renderManagedReviewPreview(preview: ManagedReviewPreview): String = buildString {
        appendLine("GAEP exact staged Managed Run review")
        appendLine()
        appendLine("Managed Run: ${preview.managedRunId}")
        appendLine("Governed Run: ${preview.runId}")
        appendLine("Revision / state: ${preview.managedRunRevision} / ${preview.state}")
        appendLine("Product / Initiative: ${preview.productId} / ${preview.initiativeId}")
        appendLine("Bindings digest: ${preview.bindingsDigest}")
        appendLine("Result: ${preview.result.resultId} (${preview.result.resultDigest})")
        appendLine("Provider disposition: ${preview.result.providerDisposition}")
        appendLine(
            "Governed outcome before decision: ${preview.result.outcomeStatus} (${preview.result.outcomeBasis})",
        )
        appendLine("Evidence: ${preview.staging.evidenceId} (${preview.staging.evidenceDigest})")
        appendLine(
            "Stage: ${preview.staging.applyState}; baseline=${preview.staging.baselineDigest}; " +
                "final=${preview.staging.finalDigest}",
        )
        appendLine(
            "Complete bounded inventory: ${preview.staging.changeCount}/${preview.staging.changedInventoryLimit}; " +
                "omitted=${preview.staging.omittedCount}; digest=${preview.staging.changedInventoryDigest}",
        )
        appendLine(
            "Excluded staged paths: ${preview.staging.excludedPathCount}; " +
                "set digest=${preview.staging.excludedPathSetDigest}",
        )
        appendLine(
            "Apply available: ${yesNo(preview.canApply)}; discard available: ${yesNo(preview.canDiscard)}; " +
                "local journal observed: ${yesNo(preview.hasLocalJournal)}",
        )
        appendLine(
            "Exact write envelope: ${preview.applyConfirmation?.writeEnvelope?.joinToString() ?: "not available"}",
        )
        appendLine("Preview digest: ${preview.previewDigest}")
        appendLine(
            "Warnings: ${if (preview.result.warningCodes.isEmpty()) "none" else preview.result.warningCodes.joinToString()}",
        )
        appendLine()
        appendLine("Exact changed-file inventory")
        appendLine()
        if (preview.staging.changedInventory.isEmpty()) appendLine("No staged workspace file changes were recorded.")
        preview.staging.changedInventory.forEachIndexed { index, change ->
            appendLine("${index + 1}. ${change.kind.uppercase(Locale.ROOT)} ${change.path}")
            appendLine(
                "   Before: ${change.beforeDigest ?: "absent"}; ${change.beforeSize ?: 0} byte(s); " +
                    "mode ${change.beforeMode?.toString(8) ?: "absent"}",
            )
            appendLine(
                "   After: ${change.afterDigest ?: "absent"}; ${change.afterSize ?: 0} byte(s); " +
                    "mode ${change.afterMode?.toString(8) ?: "absent"}",
            )
        }
        appendLine()
        appendLine(
            "Boundary: this view authorizes no mutation. Apply or discard requires a separate exact " +
                "revision-and-preview-digest-bound human decision and a second cancel-default confirmation.",
        )
        appendLine(
            "Apply is limited to this exact changed inventory and write envelope. The host records post-apply " +
                "Workflow gates not assessed, so it cannot claim governed outcome satisfaction.",
        )
        append(
            "Provider output, prompts, context content, staged source bytes, absolute paths, executable paths, " +
                "process state, workspace paths and credentials are withheld.",
        )
    }

    fun renderManagedReviewTransition(transition: ManagedReviewTransition): String = buildString {
        val detail = transition.detail
        appendLine("GAEP managed staged-review transition")
        appendLine()
        appendLine("Decision: ${transition.decision}")
        appendLine("Managed Run: ${transition.managedRunId}")
        appendLine("Revision: ${transition.sourceManagedRunRevision} -> ${transition.managedRunRevision}")
        appendLine("Persisted state: ${transition.state}")
        appendLine("Source preview: ${transition.sourcePreviewDigest}")
        appendLine("Transition digest: ${transition.transitionDigest}")
        appendLine(
            "Apply available: ${yesNo(transition.canApply)}; discard available: ${yesNo(transition.canDiscard)}",
        )
        appendLine("Local journal observed: ${yesNo(transition.hasLocalJournal)}")
        appendLine("Result digest: ${detail.summary.resultDigest ?: "not bound"}")
        appendLine("Apply-decision digest: ${detail.summary.applyDecisionDigest ?: "not bound"}")
        appendLine("Provider disposition: ${detail.result?.providerDisposition ?: "not available"}")
        appendLine(
            "Governed outcome: ${detail.result?.let { "${it.outcomeStatus} (${it.outcomeBasis})" } ?: "not available"}",
        )
        appendLine()
        append(
            "Boundary: this receipt proves only the verified persisted transition. Provider completion, governed " +
                "outcome satisfaction, machine-local stage cleanup and recovery-journal cleanup remain separate claims.",
        )
    }

    fun listPortableDesignSnapshots(): String {
        val page = client.listPortableDesignSnapshots(offset = 0, limit = PortableDesignProtocol.DEFAULT_PAGE_SIZE)
        return buildString {
            appendLine("Portable design metadata: ${page.items.size} of ${page.total}")
            appendLine("Governance: ${page.governanceBoundary}")
            appendLine("Privacy: ${page.privacyBoundary}")
            if (page.items.isEmpty()) append("No snapshots were found on this page.")
            page.items.forEachIndexed { index, summary ->
                appendLine()
                appendLine()
                appendLine("${index + 1}. ${summary.title}")
                append(renderSummary(summary))
            }
        }
    }

    fun readPortableDesignSnapshot(bundleId: String): String {
        val normalized = parseUuid(bundleId, "Bundle ID")
        return renderSummary(client.readPortableDesignSnapshot(normalized))
    }

    fun importPortableDesignSnapshot(bundleRoot: Path, actorId: String): String {
        val initial = client.readProductBinding()
        val current = client.readProductBinding()
        if (current.id != initial.id || current.revision != initial.revision) {
            throw PortableDesignProtocol.productContextChanged()
        }
        val imported = client.importPortableDesignSnapshot(
            bundleRoot = bundleRoot,
            expectedProductId = initial.id,
            expectedProductRevision = initial.revision,
            actorId = actorId,
        )
        return buildString {
            appendLine("Imported into ${initial.name} at exact Product revision ${initial.revision}.")
            appendLine("The result remains pending human review; import validation is not approval or a baseline.")
            append(renderSummary(imported))
        }
    }

    private fun renderProduct(product: ProductBinding): String = buildString {
        appendLine("Product: ${product.name}")
        appendLine("Product ID: ${product.id}")
        append("Revision: ${product.revision}")
    }

    private fun renderPhaseDashboard(dashboard: PhaseDashboardFramework): String = buildString {
        appendLine("GAEP phase-scoped dashboard framework")
        appendLine()
        appendLine("Delivery phase: ${dashboard.phaseLabel}")
        appendLine("Exact Product revision: ${dashboard.productRevision}")
        appendLine("Product digest: ${dashboard.productDigest}")
        appendLine("Composition digest: ${dashboard.compositionDigest}")
        appendLine("Observed: ${dashboard.observedAt}")
        appendLine("Source: ${dashboard.sourceBoundary}")
        appendLine("Evidence freshness: ${dashboard.evidenceCues.freshness}")
        appendLine("Confidence: not assessed; no governed confidence evaluation is bound.")
        appendLine()
        dashboard.panels.forEach { panel ->
            appendLine(
                "${panel.title} · ${panel.role} · applicability=${panel.applicability.status} " +
                    "(${panel.applicability.basis}) · state=${panel.state}",
            )
        }
        appendLine()
        dashboard.limitations.forEach { appendLine("Limit: $it") }
        appendLine()
        appendLine(
            "Boundary: this is a read-only governed-state projection. It grants no mutation, applicability, phase-entry, " +
                "approval, readiness, acceptance, release, Run, Tool, or effect authority.",
        )
        append(
            "Product text, source bytes, local paths, provider output, prompts, executable state, and credentials are withheld.",
        )
    }

    private fun renderPhase2UxFigmaDashboard(dashboard: Phase2UxFigmaDashboard): String = buildString {
        appendLine("GAEP exact Phase 2 UX and Figma dashboard")
        appendLine()
        appendLine("Initiative: ${dashboard.initiativeId} · revision ${dashboard.initiativeRevision} · ${dashboard.initiativeState}")
        appendLine("Phase state: ${dashboard.phaseState}")
        appendLine(
            "Sources: ${dashboard.currentSourceCount} current · ${dashboard.attentionRequiredSourceCount} attention-required · " +
                "${dashboard.unavailableSourceCount} unavailable · 23 expected",
        )
        appendLine(
            "Experience: ${dashboard.personaCount} personas · ${dashboard.designRoleCount} design roles · " +
                "${dashboard.journeyCount} journeys · ${dashboard.screenCount} screens · ${dashboard.stateCount} states",
        )
        appendLine(
            "Design system: ${dashboard.requirementCount} requirements · ${dashboard.tokenCount} tokens · " +
                "${dashboard.componentCount} components · ${dashboard.accessibilityRuleCount} accessibility rules",
        )
        appendLine(
            "Figma and trace: ${dashboard.figmaFileCount} files · ${dashboard.designBindingCount} bindings · " +
                "connection ${dashboard.figmaConnectionState} · write ${dashboard.figmaWriteExecutionState} · " +
                "import ${dashboard.figmaImportExecutionState}",
        )
        appendLine(
            "Drift: ${dashboard.driftObservationCount} observations · ${dashboard.driftCount} drift · " +
                "${dashboard.unassessedDriftCount} unassessed · ${dashboard.remediationCandidateCount} remediation candidates",
        )
        appendLine(
            "Freshness: ${dashboard.freshnessState} · ${dashboard.staleBindingCount} stale bindings · " +
                "${dashboard.staleSourceReferenceCount} stale sources · ${dashboard.unresolvedQuestionCount} questions",
        )
        appendLine(
            "Product Owner acceptance: not established · approval: not established · Baseline Set designation: " +
                "not established · readiness and phase-entry authority: not established",
        )
        appendLine("Snapshot digest: ${dashboard.snapshotDigest}")
        appendLine()
        dashboard.sources.forEach { source ->
            appendLine("${source.title} · ${source.group} · ${source.availability} · ${source.assessmentState ?: "no state inferred"}")
        }
        appendLine()
        dashboard.limitations.forEach { appendLine("Limit: $it") }
        appendLine()
        append(
            "Boundary: this derived read-only view is not a second source of truth and grants no completeness, validity, " +
                "approval, baseline, readiness, phase-entry, Figma, remediation, implementation, release, or action authority.",
        )
    }

    private fun renderPhase2ChangeImpactAgentModelDashboard(
        dashboard: Phase2ChangeImpactAgentModelDashboard,
    ): String = buildString {
        appendLine("GAEP exact Phase 2 Change, Impact, Agent and Model dashboard")
        appendLine()
        appendLine("Initiative: ${dashboard.initiativeId}@${dashboard.initiativeRevision} · ${dashboard.initiativeState}")
        appendLine(
            "Synchronization: ${dashboard.synchronization.state} · design delta ${dashboard.synchronization.designDelta} · " +
                "conflicts ${dashboard.synchronization.conflictResolution} · human approval ${dashboard.synchronization.humanDesignApproval} · " +
                "baseline ${dashboard.synchronization.designBaseline} · drift ${dashboard.synchronization.designDriftDetection}",
        )
        appendLine(
            "Synchronization effects: ${dashboard.synchronization.synchronizationEffectState} · " +
                "Figma connection ${dashboard.synchronization.figmaConnectionState} · " +
                "write ${dashboard.synchronization.figmaWriteExecutionState} · import ${dashboard.synchronization.figmaImportExecutionState}",
        )
        appendLine(
            "Bounded impact: ${dashboard.impact.state} · ${dashboard.impact.requirementCount} requirements · " +
                "${dashboard.impact.designBindingCount} bindings · ${dashboard.impact.unboundDesignItemCount} unbound items · " +
                "${dashboard.impact.driftCount} drift · ${dashboard.impact.unassessedCount} unassessed",
        )
        appendLine("Impact boundary: bounded-not-complete · completeness not-established · design validity not-established · revalidation not-established")
        appendLine(
            "Capabilities: ${dashboard.capabilities.shown}/${dashboard.capabilities.total} shown · " +
                "${dashboard.capabilities.detected} detected · ${dashboard.capabilities.selected} selected · " +
                "selection ${dashboard.selectionState}",
        )
        appendLine(
            "Runs: ${dashboard.runs.shown}/${dashboard.runs.total} shown · ${dashboard.runs.terminal} terminal · " +
                "${dashboard.runs.nonTerminal} non-terminal · ${dashboard.runs.resultBound} results bound · " +
                "${dashboard.runs.actualEffectCount} recorded actual effects",
        )
        appendLine(
            "Handoffs: ${dashboard.handoffs.shown}/${dashboard.handoffs.total} shown · " +
                "${dashboard.handoffs.pendingAcknowledgement} pending acknowledgement · ${dashboard.handoffs.acknowledged} acknowledged",
        )
        appendLine("Provider usage and cost: unavailable/unavailable · live provider quality not-assessed · semantic output quality not-assessed")
        appendLine("Freshness: ${dashboard.freshnessState} · Phase 2 ${dashboard.phase2State} · Agent/Model ${dashboard.agentModelState}")
        appendLine(
            "Product Owner acceptance: ${dashboard.productOwnerAcceptance} · Run launch authority: " +
                "${dashboard.runLaunchAuthority} · effect authority: ${dashboard.effectAuthority}",
        )
        appendLine("Snapshot digest: ${dashboard.snapshotDigest}")
        appendLine("Phase 2 source digest: ${dashboard.phase2UxFigmaSnapshotDigest}")
        appendLine("Agent/Model source digest: ${dashboard.agentModelSnapshotDigest}")
        appendLine()
        dashboard.limitations.forEach { appendLine("Limit: $it") }
        appendLine()
        appendLine(
            "Boundary: these derived read-only views are not a second source of truth and grant no impact completeness, " +
                "design validity, provider quality, selection, Run launch, approval, baseline, readiness, remediation, " +
                "Figma, implementation, effect, release, or action authority.",
        )
        append(
            "Design content, Product text, Run narrative, provider output, prompts, source bytes, machine paths, " +
                "credentials, permissions, and sensitive setting values are withheld.",
        )
    }

    private fun renderPhase1Summary(summary: Phase1SummaryDashboard): String = buildString {
        appendLine("GAEP exact Phase 1 summary and readiness dashboard")
        appendLine()
        appendLine("Initiative: ${summary.initiativeId} · revision ${summary.initiativeRevision} · ${summary.initiativeState}")
        appendLine("Phase state: ${summary.phaseState}")
        appendLine("Declared gap indicators: ${summary.declaredGapCount} · attention signals: ${summary.attentionSignalCount}")
        appendLine(
            "P0-P4 readiness: ${summary.readinessResult} · ${summary.readinessSatisfiedOutputs}/" +
                "${summary.readinessApplicableOutputs} applicable outputs satisfied · ${summary.readinessGapCount} declared gaps",
        )
        appendLine(
            "P5 handoff: ${summary.handoffState} · ${summary.handoffTransferState} · ${summary.handoffIncludedItems}/" +
                "${summary.handoffTotalItems} items included · ${summary.handoffGapCount} declared gaps",
        )
        appendLine(
            "Freshness: ${summary.freshnessState} · ${summary.staleBindingCount} stale bindings · " +
                "${summary.staleSourceReferenceCount} stale Source references",
        )
        appendLine("Owners: unbound; no governed phase-owner assignment is bound.")
        appendLine("Product Owner acceptance: not established · readiness authority: not established · phase-entry authority: not established")
        appendLine("Snapshot digest: ${summary.snapshotDigest}")
        appendLine("Source: ${summary.sourceBoundary}")
        appendLine("Privacy: ${summary.privacyBoundary}")
        appendLine()
        summary.limitations.forEach { appendLine("Limit: $it") }
        appendLine()
        append(
            "Boundary: this read-only candidate summary grants no readiness, approval, acceptance, phase-entry, " +
                "release, Run, Tool, write, or action authority.",
        )
    }

    private fun renderPhase1ChangeImpact(dashboard: Phase1ChangeImpactDashboard): String = buildString {
        appendLine("GAEP exact Phase 1 Change and impact dashboard")
        appendLine()
        appendLine("Initiative: ${dashboard.initiativeId}@${dashboard.initiativeRevision} · ${dashboard.initiativeState}")
        appendLine("Change: ${dashboard.change.recordId}@${dashboard.change.revision} · ${dashboard.change.state}")
        appendLine(
            "Coverage: ${dashboard.currentTraceObservedOutputCount} current trace-observed · " +
                "${dashboard.attentionRequiredOutputCount} attention · " +
                "${dashboard.impactNotEstablishedOutputCount} impact not established",
        )
        appendLine(
            "Change scope: ${dashboard.changedArtifactCount} changed artifacts · ${dashboard.effectTargetCount} effect targets · " +
                "${dashboard.affectedUnitCount} affected trace units",
        )
        appendLine(
            "Freshness: ${dashboard.freshnessState} · ${dashboard.traceAttentionLinkCount} trace-attention links · " +
                "${dashboard.staleBindingCount} stale bindings",
        )
        appendLine("Owners: unbound · revalidation: not established · Change approval: not established")
        appendLine("Risk-acceptance authority, Product Owner acceptance, and effect authority: not established")
        appendLine("Snapshot digest: ${dashboard.snapshotDigest}")
        appendLine()
        appendLine("P0-P4 governed output impact coverage:")
        dashboard.outputs.forEach { output ->
            appendLine(
                "  ${output.outputKind} · readiness=${output.readinessApplicability}/${output.readinessEvaluationState}/" +
                    "${output.readinessFreshness} · impact=${output.impactState} · exact=${output.exactMatchedSubjectCount}/" +
                    "${output.readinessSubjectCount} · traces=${output.traceReferenceCount} · " +
                    "handoff=${output.handoffDisposition}/${output.handoffFreshness} · revalidation=${output.revalidationState}",
            )
        }
        appendLine()
        dashboard.limitations.forEach { appendLine("Limit: $it") }
        appendLine()
        append(
            "Boundary: trace presence proves only recorded links; absence does not prove no impact. This read-only " +
                "projection grants no impact-completeness, revalidation, approval, risk-acceptance, readiness, " +
                "effect, release, write, or action authority.",
        )
    }

    private fun renderChangeImpactDashboard(dashboard: ChangeImpactDashboard): String = buildString {
        fun locator(value: ChangeImpactLocator): String = value.value
        appendLine("GAEP exact Change and impact dashboard")
        appendLine()
        appendLine("Change: ${dashboard.change.recordId}")
        appendLine("Change revision / state: ${dashboard.change.revision} / ${dashboard.change.state}")
        appendLine("Change digest: ${dashboard.change.digest}")
        appendLine("Product revision: ${dashboard.productRevision}")
        appendLine("Product digest: ${dashboard.productDigest}")
        appendLine("Snapshot digest: ${dashboard.snapshotDigest}")
        appendLine("Effects: ${dashboard.change.effectEnvelope.joinToString(", ")}")
        appendLine(
            "Freshness: ${dashboard.freshness.state}; observed ${dashboard.observedAt}; " +
                "trace evaluated ${dashboard.freshness.evaluatedAt}",
        )
        appendLine("Source: ${dashboard.sourceBoundary}")
        appendLine("Evidence freshness: ${dashboard.evidenceCues.freshness}")
        appendLine("Confidence: not assessed; no governed confidence evaluation is bound.")
        appendLine("Approval: not established. The current contract has no general Change approval record.")
        appendLine()
        appendLine("Work Items (${dashboard.limits.workItems.shown}/${dashboard.limits.workItems.total}):")
        dashboard.workItems.forEach { entry ->
            appendLine("  ${entry.record.recordId}@${entry.record.revision} · ${entry.state} · ${entry.record.digest}")
        }
        appendLine()
        appendLine(
            "Changed artifacts (${dashboard.limits.changedArtifacts.shown}/${dashboard.limits.changedArtifacts.total}):",
        )
        dashboard.changedArtifacts.forEach { entry ->
            appendLine("  ${locator(entry.locator)} · ${entry.locator.kind} · Work Item ${entry.sourceWorkItem.recordId}")
        }
        appendLine()
        appendLine("Effect targets (${dashboard.limits.effectTargets.shown}/${dashboard.limits.effectTargets.total}):")
        dashboard.effectTargets.forEach { entry ->
            appendLine("  ${locator(entry.locator)} · ${entry.locator.kind} · Work Item ${entry.sourceWorkItem.recordId}")
        }
        appendLine()
        appendLine("Affected units (${dashboard.limits.affectedUnits.shown}/${dashboard.limits.affectedUnits.total}):")
        dashboard.affectedUnits.forEach { entry ->
            appendLine(
                "  ${entry.direction} · ${entry.endpoint.recordType}:${entry.endpoint.recordId} · " +
                    "${entry.relationship} · ${entry.trace.assessedState}",
            )
        }
        appendLine()
        appendLine("Related Decisions (${dashboard.limits.decisions.shown}/${dashboard.limits.decisions.total}):")
        dashboard.decisions.forEach { entry ->
            appendLine("  ${entry.record.recordId}@${entry.record.revision} · ${entry.state} · ${entry.outcome}")
        }
        appendLine()
        appendLine("Related Risks (${dashboard.limits.risks.shown}/${dashboard.limits.risks.total}):")
        dashboard.risks.forEach { entry ->
            appendLine(
                "  ${entry.record.recordId}@${entry.record.revision} · ${entry.state} · " +
                    "${entry.likelihood}/${entry.impact} · ${entry.acceptance}",
            )
        }
        appendLine()
        appendLine(
            "Trace attention: unresolved=${dashboard.freshness.unresolvedTraceLinks}; " +
                "invalid=${dashboard.freshness.invalidTraceLinks}; stale=${dashboard.freshness.staleTraceLinks}; " +
                "stale governance=${dashboard.freshness.staleGovernanceReferences}",
        )
        appendLine(
            "Omissions: ${if (dashboard.limits.truncated) "one or more bounded categories are truncated" else "none in bounded categories"}",
        )
        appendLine("Coverage: absence of a trace link does not prove absence of impact.")
        dashboard.limitations.forEach { appendLine("Limit: $it") }
        appendLine()
        appendLine(
            "Boundary: this read-only projection grants no Change approval, risk acceptance, mutation, Run, Tool, " +
                "write, effect, phase-entry, readiness, release, or outcome authority.",
        )
        append(
            "Product text, Change text, Work Item text, source bytes, absolute paths, provider output, prompts, " +
                "executable state, and credentials are withheld.",
        )
    }

    private fun renderPhase1AgentModelDashboard(dashboard: Phase1AgentModelDashboard): String = buildString {
        appendLine("GAEP exact Phase 1 Agent and Model execution truth")
        appendLine()
        appendLine(
            "Initiative: ${dashboard.initiativeId}@${dashboard.initiativeRevision}; ${dashboard.initiativeState}",
        )
        appendLine("Product revision: ${dashboard.productRevision}")
        appendLine(
            "Capabilities: ${dashboard.capabilities.shown}/${dashboard.capabilities.total} shown; " +
                "${dashboard.capabilities.detected} detected; ${dashboard.capabilities.unavailable} unavailable; " +
                "${dashboard.capabilities.selected} selected",
        )
        appendLine(
            "Runs: ${dashboard.runs.shown}/${dashboard.runs.total} shown; ${dashboard.runs.terminal} terminal; " +
                "${dashboard.runs.nonTerminal} non-terminal",
        )
        appendLine(
            "Managed results: ${dashboard.runs.resultBound} bound; " +
                "${dashboard.runs.actualEffectCount} recorded actual effects",
        )
        appendLine(
            "Outcomes: ${dashboard.runs.outcomes.satisfied} satisfied; ${dashboard.runs.outcomes.failed} failed; " +
                "${dashboard.runs.outcomes.notAssessed} not assessed; " +
                "${dashboard.runs.outcomes.indeterminate} indeterminate",
        )
        appendLine(
            "Handoffs: ${dashboard.handoffs.shown}/${dashboard.handoffs.total} shown; " +
                "${dashboard.handoffs.pendingAcknowledgement} pending acknowledgement; " +
                "${dashboard.handoffs.acknowledged} acknowledged",
        )
        appendLine("Provider usage and cost: unavailable")
        appendLine("Live provider quality: ${dashboard.liveProviderQuality}")
        appendLine("Semantic output quality: ${dashboard.semanticOutputQuality}")
        appendLine("Freshness: ${dashboard.freshnessState}; selection capability ${dashboard.selectionCapabilityState}")
        appendLine("Product Owner acceptance: ${dashboard.productOwnerAcceptance}")
        appendLine("Snapshot digest: ${dashboard.snapshotDigest}")
        appendLine()
        dashboard.limitations.forEach { appendLine("Limit: $it") }
        appendLine()
        appendLine(
            "Boundary: this read-only Initiative-scoped projection does not establish provider readiness or quality, " +
                "choose a provider, acknowledge a handoff, launch a Run, authorize effects, approve Phase 1, " +
                "record Product Owner acceptance, or grant release authority.",
        )
        appendLine(
            "Product text, Run narrative, provider output, prompts, source bytes, machine paths, credentials, and " +
                "sensitive setting values are withheld.",
        )
        appendLine()
        append(renderAgentModelDashboard(dashboard.agentModel))
    }

    private fun renderAgentModelDashboard(dashboard: AgentModelDashboard): String = buildString {
        appendLine("GAEP exact Agent and Model dashboard")
        appendLine()
        appendLine("Product revision: ${dashboard.productRevision}")
        appendLine("Product digest: ${dashboard.productDigest}")
        appendLine("Snapshot digest: ${dashboard.snapshotDigest}")
        appendLine(
            "Freshness: ${dashboard.freshness.state}; selection capability " +
                dashboard.freshness.selectionCapabilityState,
        )
        appendLine("Source: ${dashboard.sourceBoundary}")
        appendLine("Evidence freshness: ${dashboard.evidenceCues.freshness}")
        appendLine("Confidence: not assessed; no governed confidence evaluation is bound.")
        appendLine(
            "Capability observation range: ${dashboard.freshness.oldestCapabilityObservedAt} to " +
                dashboard.freshness.newestCapabilityObservedAt,
        )
        appendLine("Provider usage: unavailable; current Managed Run records have no provider usage contract.")
        appendLine("Provider cost: unavailable; current Managed Run records have no provider cost contract.")
        appendLine()
        val selection = dashboard.selection
        if (selection.status == "selected" || selection.status == "migration-required") {
            appendLine(
                "Selection: ${selection.status}; ${selection.adapterId}/${selection.agentId}; ${selection.modelId}",
            )
            appendLine("Selection digest: ${selection.selectionDigest}")
            appendLine("Selection capability: ${selection.capabilityState}; ${selection.capabilityDigest}")
            selection.settings.forEach { (key, value) ->
                appendLine("  setting $key=${renderSettingValue(value)}")
            }
        } else {
            appendLine("Selection: ${selection.status}")
        }
        appendLine()
        appendLine(
            "Observed capabilities (${dashboard.capabilityLimit.shown}/${dashboard.capabilityLimit.total}):",
        )
        dashboard.capabilities.forEach { capability ->
            appendLine(
                "  ${capability.adapterId}/${capability.agentId}; ${capability.agentLabel}; " +
                    "${capability.executionInterface}/${capability.interfaceMaturity}; " +
                    "models=${capability.modelCount}; selected=${capability.selected}; ${capability.capabilityDigest}",
            )
        }
        appendLine()
        appendLine("Runs (${dashboard.runLimit.shown}/${dashboard.runLimit.total}):")
        dashboard.runs.forEach { run ->
            val managed = if (run.managed.status == "observed") {
                "${run.managed.state}/attempt-${run.managed.attemptNumber}/${run.managed.resultStatus}"
            } else {
                run.managed.status
            }
            appendLine(
                "  ${run.recordId}@${run.revision}; ${run.state}; " +
                    "${run.adapterId}/${run.agentId}/${run.modelId}; managed=$managed",
            )
        }
        appendLine()
        appendLine("Agent/model handoffs (${dashboard.handoffLimit.shown}/${dashboard.handoffLimit.total}):")
        dashboard.handoffs.forEach { handoff ->
            appendLine(
                "  ${handoff.recordId}; Run ${handoff.fromRunId} -> " +
                    "${handoff.toAdapterId}/${handoff.toAgentId}/${handoff.toModelId}; ${handoff.state}",
            )
        }
        appendLine()
        appendLine(
            "Managed Run observations: ${dashboard.managedRunLimit.shown}/${dashboard.managedRunLimit.total}",
        )
        appendLine(
            "Omissions: ${if (dashboard.truncated) "one or more bounded categories are truncated" else "none in reported categories"}",
        )
        appendLine("Coverage: bounded current records do not prove provider-account or native-host readiness.")
        dashboard.limitations.forEach { appendLine("Limit: $it") }
        appendLine()
        appendLine(
            "Boundary: this read-only projection cannot select or switch an agent, create a handoff, launch a Run, " +
                "authorize a Tool/write/effect, approve an outcome, establish readiness, or grant release authority.",
        )
        append(
            "Product text, Run narrative, source bytes, absolute paths, provider output, prompts, executable state, " +
                "credentials, and sensitive setting values are withheld.",
        )
    }

    private fun renderAgentReadiness(snapshot: AgentReadinessSnapshot): String = buildString {
        appendLine(snapshot.agentLabel)
        appendLine("  Adapter: ${snapshot.adapterId} ${snapshot.adapterVersion}")
        appendLine("  Detected: ${yesNo(snapshot.detected)}")
        appendLine("  Runtime version: ${snapshot.runtimeVersion ?: "not observed"}")
        appendLine("  Interface: ${snapshot.executionInterface} (${snapshot.interfaceMaturity})")
        appendLine(
            "  Capabilities: resume=${yesNo(snapshot.supportsResume)}, cancel=${yesNo(snapshot.supportsCancel)}, " +
                "checkpoints=${yesNo(snapshot.supportsCheckpoints)}, model discovery=${yesNo(snapshot.supportsModelDiscovery)}, " +
                "tool selection=${yesNo(snapshot.supportsToolSelection)}",
        )
        appendLine("  Declared settings: ${snapshot.settingsCount}")
        appendLine("  Models observed: ${snapshot.models.size}")
        val models = snapshot.models.take(20)
        if (models.isEmpty()) appendLine("  - none observed")
        models.forEach { model ->
            appendLine("  - ${model.label} (${model.id}; ${model.truthClass}${if (model.alias) "; alias" else ""})")
        }
        if (snapshot.models.size > models.size) appendLine("  - ${snapshot.models.size - models.size} more withheld from this compact view")
        appendLine("  Limitations: ${snapshot.limitations.size}")
        val limitations = snapshot.limitations.take(20)
        if (limitations.isEmpty()) appendLine("  - none declared")
        limitations.forEach { appendLine("  - $it") }
        if (snapshot.limitations.size > limitations.size) {
            appendLine("  - ${snapshot.limitations.size - limitations.size} more withheld from this compact view")
        }
        append("  Observed at: ${snapshot.observedAt}")
    }

    private fun renderAgentSelection(selection: AgentSelection): String = buildString {
        appendLine("GAEP guarded Agent Selection")
        appendLine()
        appendLine("Agent: ${selection.agentId}")
        appendLine("Adapter: ${selection.adapterId}")
        appendLine("Model: ${selection.modelId}")
        appendLine(
            "Model evidence: ${selection.modelTruthClass}${if (selection.modelAlias == true) " (alias)" else ""}",
        )
        appendLine("Selected at: ${selection.selectedAt}")
        appendLine("Portable settings: ${selection.settings.size}")
        selection.settings.forEach { (key, value) -> appendLine("  - $key: ${renderSettingValue(value)}") }
        appendLine()
        appendLine(
            "Boundary: this record does not start a provider, create or resume a Run, approve tools or effects, or grant execution authority.",
        )
        append("Machine-local executable paths, credentials, and raw provider output are not included.")
    }

    private fun renderAgentHandoff(handoff: AgentHandoff): String = buildString {
        appendLine("GAEP versioned Agent Handoff")
        appendLine()
        appendLine("Handoff: ${handoff.id}")
        appendLine("Source Run: ${handoff.fromRunId}")
        appendLine("Target: ${handoff.toAgent.agentId} / ${handoff.toAgent.modelId}")
        appendLine("Created at: ${handoff.createdAt}")
        appendLine(
            "Workspace observation: dirty=${handoff.workspaceBaseline.dirty ?: "unknown"}; " +
                "changed files=${handoff.workspaceBaseline.changedFiles.size}; " +
                "truth=${handoff.workspaceBaseline.truthClass ?: "not recorded"}",
        )
        appendLine(
            "Preserved entries: completed=${handoff.completedWork.size}; unresolved=${handoff.unresolvedMatters.size}; " +
                "decisions=${handoff.decisions.size}; evidence=${handoff.evidence.size}",
        )
        appendLine("Capability differences:")
        handoff.capabilityDifferences.forEach { appendLine("  - $it") }
        appendLine()
        appendLine(
            "Boundary: the handoff atomically replaced portable Agent Selection, but did not start or resume a provider, " +
                "create a Run, approve tools or effects, or grant execution authority.",
        )
        append("Machine-local paths, credentials, provider sessions, and raw provider output are not included.")
    }

    private fun renderManagedReadOnlyReceipt(receipt: ManagedReadOnlyReceipt): String = buildString {
        appendLine("GAEP managed read-only execution receipt")
        appendLine()
        appendLine("Governed Run: ${receipt.runId}")
        appendLine("Managed Run: ${receipt.managedRunId}")
        appendLine("Exact preview digest: ${receipt.previewDigest}")
        appendLine("Product: ${receipt.productId}")
        appendLine("Initiative: ${receipt.initiativeId}")
        appendLine("Provider binding: ${receipt.agentId} / ${receipt.modelId} (${receipt.adapterId})")
        appendLine("Mode: ${receipt.mode}")
        appendLine("Governed state: ${receipt.state}")
        appendLine("Provider disposition: ${receipt.providerDisposition}")
        appendLine("Governed outcome: ${receipt.outcomeStatus}")
        appendLine("Outcome basis: ${receipt.outcomeBasis}")
        appendLine("Completed steps: ${receipt.completedStepCount} of ${receipt.totalStepCount}")
        appendLine("Verified event count: ${receipt.eventCount}")
        appendLine("Result digest: ${receipt.resultDigest}")
        appendLine("Evidence digest: ${receipt.evidenceDigest}")
        appendLine("Warnings: ${receipt.warnings.size}")
        if (receipt.warnings.isEmpty()) appendLine("  - none")
        receipt.warnings.forEach { appendLine("  - $it") }
        appendLine("Started: ${receipt.startedAt}")
        appendLine("Ended: ${receipt.endedAt}")
        appendLine()
        appendLine("Provider completion and governed outcome are separate claims; one never substitutes for the other.")
        appendLine("Authority boundary: ${receipt.authorityBoundary}")
        append("No local paths, credentials, provider sessions, raw provider output, or source bytes are included.")
    }

    private fun renderManagedEvidenceDetail(detail: ManagedEvidenceDetail): String = buildString {
        val summary = detail.summary
        appendLine("GAEP exact Managed Run evidence detail")
        appendLine()
        appendLine("Managed Run: ${summary.managedRunId}")
        appendLine("Governed Run: ${summary.runId}")
        appendLine("Product / Initiative: ${summary.productId} / ${summary.initiativeId}")
        appendLine("State / mode: ${summary.state} / ${summary.mode}")
        appendLine("Provider: ${summary.adapterId} / ${summary.agentId} / ${summary.modelId}")
        appendLine(
            "Recovery: ${summary.recoveryStatus}; attempt ${summary.attemptNumber}; " +
                "checkpoints ${summary.workflowCheckpointCount}",
        )
        appendLine("Artifact status: ${detail.artifactStatus}")
        appendLine("Bindings digest: ${summary.bindingsDigest}")
        detail.result?.let { result ->
            appendLine()
            appendLine("Verified result:")
            appendLine("  Result: ${result.resultId} (${result.resultDigest})")
            appendLine("  Terminal state: ${result.terminalState}")
            appendLine("  Provider disposition: ${result.providerDisposition}; termination cause: ${result.terminationCause}")
            appendLine("  Governed outcome: ${result.outcomeStatus} (${result.outcomeBasis})")
            appendLine("  Warnings: ${if (result.warningCodes.isEmpty()) "none" else result.warningCodes.joinToString()}")
            appendLine("  Started / ended: ${result.startedAt} / ${result.endedAt}")
        } ?: appendLine("No committed result/evidence pair is bound to this record. No terminal outcome is inferred.")
        detail.evidence?.let { evidence ->
            appendLine()
            appendLine("Verified evidence:")
            appendLine("  Evidence: ${evidence.evidenceId} (${evidence.evidenceDigest})")
            appendLine(
                "  Events: ${evidence.eventCount}; lifecycle=${evidence.eventTypeCounts["lifecycle"]}; " +
                    "output=${evidence.eventTypeCounts["output"]}; item=${evidence.eventTypeCounts["item"]}; " +
                    "approval=${evidence.eventTypeCounts["approval"]}; warning=${evidence.eventTypeCounts["warning"]}; " +
                    "error=${evidence.eventTypeCounts["error"]}",
            )
            appendLine(
                "  Workflow: ${evidence.workflowStrategy}; ${evidence.completedStepCount}/${evidence.workflowStepCount} steps; " +
                    "${evidence.workflowAttemptCount} attempts",
            )
            appendLine(
                "  Charter gates: evidence=${evidence.charterEvidenceStatus}; stop=${evidence.charterStopStatus}; " +
                    "reason=${evidence.terminalReasonCode}",
            )
            appendLine(
                "  Actual effects: not-observed=${evidence.actualEffectCounts["not-observed"]}; " +
                    "provisional=${evidence.actualEffectCounts["observed-provisional"]}; " +
                    "applied=${evidence.actualEffectCounts["applied"]}; blocked=${evidence.actualEffectCounts["blocked"]}; " +
                    "unknown=${evidence.actualEffectCounts["unknown"]}",
            )
            evidence.staging?.let { staging ->
                appendLine(
                    "  Staging: ${staging.applyState}; changes=${staging.changeCount}; excluded=${staging.excludedPathCount}",
                )
                appendLine(
                    "  Stage digests: baseline=${staging.baselineDigest}; final=${staging.finalDigest}; " +
                        "inventory=${staging.changedInventoryDigest}",
                )
            } ?: appendLine("  Staging: not present")
            appendLine("  Captured: ${evidence.capturedAt}")
        }
        detail.applyDecision?.let { decision ->
            appendLine()
            appendLine("Verified apply-decision evidence (observation only):")
            appendLine("  Receipt: ${decision.receiptId} (${decision.receiptDigest})")
            appendLine(
                "  Bound revision: ${decision.managedRunRevision}; changed inventory count=${decision.changedInventoryCount}; " +
                    "write-envelope count=${decision.writeEnvelopeCount}",
            )
            appendLine("  Decided: ${decision.decidedAt}")
        }
        appendLine()
        appendLine(
            "Boundary: provider completion is separate from governed outcome. Apply-decision evidence records a past exact " +
                "decision and grants this view no apply, discard, approval, Tool, write, effect, implementation-readiness, " +
                "release, or future Run authority.",
        )
        append(
            "Raw provider output, prompts, context content, changed paths, source bytes, executable paths, process state, " +
                "workspace paths, and credentials are withheld.",
        )
    }

    private fun renderSettingValue(value: PortableAgentSettingValue): String = when (value) {
        is PortableAgentSettingValue.Text -> value.value
        is PortableAgentSettingValue.Decimal -> value.value.toPlainString()
        is PortableAgentSettingValue.Flag -> value.value.toString()
        is PortableAgentSettingValue.TextList -> value.value.joinToString(", ")
    }

    private fun isTerminalRun(run: AgentRun): Boolean = run.state in setOf(
        AgentRunState.COMPLETED,
        AgentRunState.FAILED,
        AgentRunState.CANCELLED,
    )

    private fun samePortableBinding(left: AgentSelection, right: AgentSelection): Boolean =
        samePortableBinding(left, right.adapterId, right.modelId, right.settings)

    private fun samePortableBinding(
        left: AgentSelection,
        adapterId: String,
        modelId: String,
        settings: Map<String, PortableAgentSettingValue>,
    ): Boolean = left.adapterId == adapterId && left.modelId == modelId &&
        PortableDesignProtocol.portableSettingsEqual(left.settings, settings)

    private fun yesNo(value: Boolean): String = if (value) "yes" else "no"

    private fun renderSummary(summary: PortableDesignSnapshotSummary): String = buildString {
        appendLine("Bundle ID: ${summary.bundleId}")
        appendLine("Product ID: ${summary.productId}")
        appendLine("Initiative ID: ${summary.initiativeId ?: "not-bound"}")
        appendLine("Classification: ${portableName(summary.classification.name)}")
        appendLine("Governance: ${summary.governance.state}; human review required=${summary.governance.humanReviewRequired}")
        appendLine("Source review: ${portableName(summary.sourceReview.status.name)} upstream claim; GAEP approval=${summary.sourceReview.gaepApproval}")
        appendLine("Source: ${summary.source.tool}; ${portableName(summary.source.exportMethod.name)}")
        appendLine(
            "Counts: artifacts=${summary.counts.artifacts}, normalized tokens=${summary.counts.normalizedDesignTokens}, " +
                "validation checks=${summary.counts.validationChecks}, limitations=${summary.counts.recordedLimitations}",
        )
        appendLine("Snapshot digest: ${summary.digests.snapshot}")
        appendLine("Evidence digest: ${summary.digests.evidence}")
        appendLine("Manifest digest: ${summary.digests.manifest}")
        appendLine("Inventory digest: ${summary.digests.artifactInventory}")
        appendLine("Source exported: ${summary.timestamps.sourceExportedAt}")
        appendLine("Imported: ${summary.timestamps.importedAt}")
        append("Privacy: ${summary.privacyBoundary}")
    }

    private fun parseUuid(value: String, label: String): UUID {
        val normalized = value.trim()
        require(normalized.matches(Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"))) {
            "$label must be a UUID"
        }
        return try {
            UUID.fromString(normalized).also { require(it != UUID(0, 0)) { "$label must be a non-empty UUID" } }
        } catch (_: IllegalArgumentException) {
            throw IllegalArgumentException("$label must be a UUID")
        }
    }

    private fun portableName(value: String): String = value.lowercase(Locale.ROOT).replace('_', '-')
}
