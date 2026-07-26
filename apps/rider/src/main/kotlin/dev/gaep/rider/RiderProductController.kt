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
