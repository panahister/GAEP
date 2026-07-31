package dev.gaep.rider

import java.util.Locale

internal enum class AccessibleTableSortDirection { ASCENDING, DESCENDING }

internal data class AccessibleTableColumn(val key: String, val label: String)

internal data class AccessibleTableRow(val id: String, val cells: Map<String, String>)

internal data class AccessibleMetadataTable(
    val id: String,
    val title: String,
    val columns: List<AccessibleTableColumn>,
    val rows: List<AccessibleTableRow>,
    val total: Long,
    val omitted: Long,
    val snapshotDigest: String,
    val sourceBoundary: String,
    val authorityBoundary: String,
)

internal data class AccessibleTableView(
    val table: AccessibleMetadataTable,
    val rows: List<AccessibleTableRow>,
    val filter: String,
    val sortKey: String?,
    val sortDirection: AccessibleTableSortDirection?,
)

internal object AccessibleDashboardTables {
    private val portableKey = Regex("^[a-z][a-z0-9-]{0,63}$")
    private val digest = Regex("^sha256:[0-9a-f]{64}$")
    private val formulaPrefix = Regex("^\\s*[=+\\-@]")

    fun exact(table: AccessibleMetadataTable): AccessibleMetadataTable {
        require(portableKey.matches(table.id)) { "Accessible table IDs must be portable kebab-case values" }
        require(table.title.isNotBlank() && table.title.length <= 160) {
            "Accessible table titles must contain 1 to 160 characters"
        }
        require(table.columns.size in 1..64) { "Accessible tables require 1 to 64 visible columns" }
        require(table.rows.size <= 1_000) { "Accessible tables can expose at most 1,000 already-bounded rows" }
        require(table.total >= table.rows.size && table.omitted == table.total - table.rows.size) {
            "Accessible table totals must exactly reconcile with visible and omitted rows"
        }
        require(digest.matches(table.snapshotDigest)) { "Accessible tables require one exact snapshot digest" }
        require(table.sourceBoundary.isNotBlank() && table.authorityBoundary.isNotBlank()) {
            "Accessible tables require explicit source and authority boundaries"
        }
        val columnKeys = table.columns.map { column ->
            require(portableKey.matches(column.key)) { "Accessible table column keys must be portable values" }
            require(column.label.isNotBlank() && column.label.length <= 160) {
                "Accessible table column labels must contain 1 to 160 characters"
            }
            column.key
        }
        require(columnKeys.distinct().size == columnKeys.size) { "Accessible table column keys must be unique" }
        require(table.rows.map(AccessibleTableRow::id).distinct().size == table.rows.size) {
            "Accessible table row IDs must be unique"
        }
        table.rows.forEach { row ->
            require(row.id.isNotEmpty() && row.id.length <= 256) { "Accessible table row IDs must be bounded" }
            require(row.cells.keys == columnKeys.toSet()) {
                "Accessible table rows must contain exactly the visible columns"
            }
            require(row.cells.values.all { it.length <= 4_000 }) { "Accessible table cells must be bounded strings" }
        }
        return table.copy(
            columns = table.columns.map(AccessibleTableColumn::copy),
            rows = table.rows.map { row -> row.copy(cells = row.cells.toMap()) },
        )
    }

    fun view(
        table: AccessibleMetadataTable,
        filter: String = "",
        sortKey: String? = null,
        sortDirection: AccessibleTableSortDirection? = null,
    ): AccessibleTableView {
        val exact = exact(table)
        require(filter.length <= 256) { "Accessible table filters can contain at most 256 characters" }
        require((sortKey == null) == (sortDirection == null)) {
            "Accessible table sort column and direction must be supplied together"
        }
        require(sortKey == null || exact.columns.any { it.key == sortKey }) {
            "Accessible table sort column must be one of the visible columns"
        }
        val normalizedFilter = filter.trim().lowercase(Locale.ROOT)
        var rows = exact.rows.filter { row ->
            normalizedFilter.isEmpty() || exact.columns.any { column ->
                row.cells.getValue(column.key).lowercase(Locale.ROOT).contains(normalizedFilter)
            }
        }
        if (sortKey != null && sortDirection != null) {
            rows = rows.sortedWith { left, right ->
                val comparison = left.cells.getValue(sortKey).compareTo(right.cells.getValue(sortKey))
                val deterministic = if (comparison == 0) left.id.compareTo(right.id) else comparison
                if (sortDirection == AccessibleTableSortDirection.ASCENDING) deterministic else -deterministic
            }
        }
        return AccessibleTableView(exact, rows, filter, sortKey, sortDirection)
    }

    fun render(view: AccessibleTableView): String = buildString {
        val sort = if (view.sortKey == null) {
            "source order"
        } else {
            val label = view.table.columns.single { it.key == view.sortKey }.label
            "$label, ${view.sortDirection!!.name.lowercase(Locale.ROOT)}"
        }
        appendLine("GAEP accessible metadata table: ${view.table.title}")
        appendLine()
        appendLine(
            "Showing ${view.rows.size} of ${view.table.rows.size} verified rows; ${view.table.omitted} omitted upstream; " +
                "source total ${view.table.total}.",
        )
        appendLine("Sort: $sort")
        appendLine("Filter: ${view.filter.trim().ifEmpty { "none" }}")
        appendLine("Snapshot digest: ${view.table.snapshotDigest}")
        appendLine("Source boundary: ${view.table.sourceBoundary}")
        appendLine()
        if (view.rows.isEmpty()) appendLine("No verified rows match the current filter.")
        view.rows.forEachIndexed { index, row ->
            appendLine(
                "${index + 1}. " + view.table.columns.joinToString(" · ") { column ->
                    "${column.label}: ${row.cells.getValue(column.key)}"
                },
            )
        }
        appendLine()
        append("Boundary: ${view.table.authorityBoundary}")
    }

    fun csv(view: AccessibleTableView): String {
        fun cell(value: String): String {
            val neutralized = if (formulaPrefix.containsMatchIn(value) || value.firstOrNull() in listOf('\t', '\r', '\n')) {
                "'$value"
            } else {
                value
            }
            return "\"${neutralized.replace("\"", "\"\"")}\""
        }
        return buildList {
            add(view.table.columns.joinToString(",") { cell(it.label) })
            view.rows.forEach { row ->
                add(view.table.columns.joinToString(",") { column -> cell(row.cells.getValue(column.key)) })
            }
        }.joinToString("\r\n")
    }

    fun phase(dashboard: PhaseDashboardFramework): List<AccessibleMetadataTable> = listOf(
        table(
            id = "phase-panels",
            title = "${dashboard.phaseLabel} panels",
            columns = columns(
                "panel-id" to "Panel ID", "title" to "Title", "role" to "Role",
                "applicability" to "Applicability", "basis" to "Applicability basis", "state" to "State",
                "decision" to "Decision binding",
            ),
            rows = dashboard.panels.map { panel ->
                row(
                    panel.id,
                    "panel-id" to panel.id,
                    "title" to panel.title,
                    "role" to panel.role,
                    "applicability" to panel.applicability.status,
                    "basis" to panel.applicability.basis,
                    "state" to panel.state,
                    "decision" to (panel.applicability.decision?.let {
                        "${it.recordId}@${it.revision} · ${it.digest}"
                    } ?: "not bound"),
                )
            },
            total = dashboard.panels.size.toLong(),
            omitted = 0,
            snapshotDigest = dashboard.compositionDigest,
            sourceBoundary = "governed-repository-and-engine-only",
            authorityBoundary = "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence",
        ),
    )

    fun phase2UxFigma(dashboard: Phase2UxFigmaDashboard): List<AccessibleMetadataTable> {
        val common = Triple(
            dashboard.snapshotDigest,
            "current-governed-product-initiative-and-phase-2-projections-only",
            "phase-2-dashboard-is-a-derived-read-only-view-not-a-second-source-of-truth-or-completeness-validity-approval-baseline-readiness-remediation-figma-implementation-or-action-authority",
        )
        return listOf(
            table(
                id = "phase2-summary",
                title = "Phase 2 UX and Figma summary",
                columns = columns("area" to "Area", "inventory" to "Inventory", "boundary" to "Authority boundary"),
                rows = listOf(
                    row(
                        "experience", "area" to "Experience",
                        "inventory" to "${dashboard.personaCount} personas · ${dashboard.designRoleCount} roles · " +
                            "${dashboard.journeyCount} journeys · ${dashboard.screenCount} screens · ${dashboard.stateCount} states",
                        "boundary" to "Counts do not establish completeness or validity.",
                    ),
                    row(
                        "figma", "area" to "Figma and trace",
                        "inventory" to "${dashboard.figmaFileCount} files · ${dashboard.designBindingCount} bindings",
                        "boundary" to "Connection ${dashboard.figmaConnectionState}; write ${dashboard.figmaWriteExecutionState}; " +
                            "import ${dashboard.figmaImportExecutionState}.",
                    ),
                    row(
                        "governance", "area" to "Governance",
                        "inventory" to "${dashboard.currentSourceCount} current · ${dashboard.attentionRequiredSourceCount} attention · " +
                            "${dashboard.unavailableSourceCount} unavailable",
                        "boundary" to "Approval, Baseline Set, readiness, phase entry, and remediation effects are not established.",
                    ),
                ),
                total = 3L,
                omitted = 0L,
                snapshotDigest = common.first,
                sourceBoundary = common.second,
                authorityBoundary = common.third,
            ),
            table(
                id = "phase2-sources",
                title = "Phase 2 governed source projections",
                columns = columns(
                    "source" to "Source", "group" to "Group", "projection-kind" to "Projection kind",
                    "availability" to "Availability", "assessment" to "Assessment",
                ),
                rows = dashboard.sources.map { source ->
                    row(
                        source.id, "source" to source.title, "group" to source.group,
                        "projection-kind" to source.projectionKind, "availability" to source.availability,
                        "assessment" to (source.assessmentState ?: "no state inferred"),
                    )
                },
                total = dashboard.sources.size.toLong(),
                omitted = 0L,
                snapshotDigest = common.first,
                sourceBoundary = common.second,
                authorityBoundary = common.third,
            ),
        )
    }

    fun phase3a(dashboard: Phase3aDashboard): List<AccessibleMetadataTable> {
        val sourceBoundary =
            "current-governed-product-initiative-p3a-projections-and-explicit-sealed-local-workflow-evidence-only"
        val authorityBoundary =
            "phase-3a-dashboard-is-a-derived-read-only-view-not-completeness-priority-readiness-waiver-ownership-implementation-acceptance-release-deployment-or-action-authority"
        return listOf(
            table(
                id = "phase3a-views",
                title = "Phase 3A dashboard views",
                columns = columns(
                    "view" to "View", "state" to "State", "sources" to "Source coverage",
                    "signals" to "Candidate and evidence signals", "attention" to "Attention signals",
                    "workflows" to "Workflow evidence",
                ),
                rows = dashboard.views.map { view ->
                    row(
                        view.id,
                        "view" to view.title,
                        "state" to view.state,
                        "sources" to "${view.currentSourceCount} current · ${view.attentionRequiredSourceCount} attention · ${view.unavailableSourceCount} unavailable",
                        "signals" to "${view.candidateCount} candidates · ${view.evidenceReferenceCount} evidence references",
                        "attention" to "${view.gapCount} gaps · ${view.conflictCount} conflicts · ${view.staleCount} stale · ${view.unresolvedCount} unresolved",
                        "workflows" to "${view.workflowEvidenceCount} sealed local deterministic",
                    )
                },
                total = dashboard.views.size.toLong(),
                omitted = 0L,
                snapshotDigest = dashboard.snapshotDigest,
                sourceBoundary = sourceBoundary,
                authorityBoundary = authorityBoundary,
            ),
            table(
                id = "phase3a-sources",
                title = "Phase 3A governed source projections",
                columns = columns(
                    "source" to "Source", "group" to "Group", "availability" to "Availability",
                    "assessment" to "Assessment", "attention" to "Attention signals",
                ),
                rows = dashboard.sources.map { source ->
                    row(
                        source.id,
                        "source" to source.title,
                        "group" to source.group,
                        "availability" to source.availability,
                        "assessment" to (source.assessmentState ?: "no state inferred"),
                        "attention" to "${source.gapCount} gaps · ${source.conflictCount} conflicts · ${source.staleCount} stale · ${source.unresolvedCount} unresolved",
                    )
                },
                total = 20L,
                omitted = 0L,
                snapshotDigest = dashboard.snapshotDigest,
                sourceBoundary = sourceBoundary,
                authorityBoundary = authorityBoundary,
            ),
            table(
                id = "phase3a-workflows",
                title = "Bounded provider workflow evidence",
                columns = columns(
                    "provider" to "Provider", "availability" to "Availability", "mode" to "Execution mode",
                    "live" to "Live acceptance", "quality" to "Semantic quality", "authority" to "Authority",
                ),
                rows = dashboard.workflows.map { workflow ->
                    row(
                        workflow.provider,
                        "provider" to workflow.provider,
                        "availability" to workflow.availability,
                        "mode" to workflow.executionMode,
                        "live" to workflow.liveAcceptance,
                        "quality" to workflow.semanticQuality,
                        "authority" to workflow.authority,
                    )
                },
                total = 2L,
                omitted = 0L,
                snapshotDigest = dashboard.snapshotDigest,
                sourceBoundary = sourceBoundary,
                authorityBoundary = authorityBoundary,
            ),
        )
    }

    fun phase2ChangeImpactAgentModel(
        dashboard: Phase2ChangeImpactAgentModelDashboard,
    ): List<AccessibleMetadataTable> {
        val sourceBoundary = "exact-derived-phase-2-dashboard-and-current-initiative-scoped-agent-model-metadata-only"
        val authorityBoundary =
            "phase-2-change-impact-agent-model-dashboard-is-derived-read-only-evidence-not-a-second-source-of-truth-impact-completeness-design-validity-provider-quality-selection-run-launch-approval-baseline-readiness-remediation-effect-release-or-action-authority"
        return listOf(
            table(
                id = "phase2-synchronization-change",
                title = "Phase 2 synchronization change evidence",
                columns = columns("source" to "Governed source", "state" to "Availability", "effect" to "Effect boundary"),
                rows = listOf(
                    row("design-delta", "source" to "Design delta", "state" to dashboard.synchronization.designDelta, "effect" to "Not applied"),
                    row("conflicts", "source" to "Conflict resolution", "state" to dashboard.synchronization.conflictResolution, "effect" to "Not applied"),
                    row("approval", "source" to "Human design approval", "state" to dashboard.synchronization.humanDesignApproval, "effect" to "Not applied"),
                    row("baseline", "source" to "Design baseline", "state" to dashboard.synchronization.designBaseline, "effect" to "Not applied"),
                    row("drift", "source" to "Design drift detection", "state" to dashboard.synchronization.designDriftDetection, "effect" to "Not applied"),
                ),
                total = 5L, omitted = 0L, snapshotDigest = dashboard.snapshotDigest,
                sourceBoundary = sourceBoundary, authorityBoundary = authorityBoundary,
            ),
            table(
                id = "phase2-bounded-impact",
                title = "Phase 2 bounded impact signals",
                columns = columns("area" to "Area", "counts" to "Observed counts", "boundary" to "Coverage boundary"),
                rows = listOf(
                    row(
                        "trace", "area" to "Design and trace",
                        "counts" to "${dashboard.impact.requirementCount} requirements · ${dashboard.impact.designBindingCount} bindings · ${dashboard.impact.unboundDesignItemCount} unbound items",
                        "boundary" to "Impact completeness and design validity are not established.",
                    ),
                    row(
                        "drift", "area" to "Drift",
                        "counts" to "${dashboard.impact.driftObservationCount} observations · ${dashboard.impact.driftCount} drift · ${dashboard.impact.unassessedCount} unassessed",
                        "boundary" to "No remediation or revalidation effect is applied.",
                    ),
                ),
                total = 2L, omitted = 0L, snapshotDigest = dashboard.snapshotDigest,
                sourceBoundary = sourceBoundary, authorityBoundary = authorityBoundary,
            ),
            table(
                id = "phase2-agent-model-execution",
                title = "Initiative-scoped agent and model execution truth",
                columns = columns("area" to "Area", "counts" to "Bounded counts", "authority" to "Authority boundary"),
                rows = listOf(
                    row(
                        "capabilities", "area" to "Capabilities and selection",
                        "counts" to "${dashboard.capabilities.shown}/${dashboard.capabilities.total} shown · ${dashboard.capabilities.detected} detected · ${dashboard.capabilities.selected} selected",
                        "authority" to "No automatic selection or provider preference authority.",
                    ),
                    row(
                        "runs", "area" to "Runs and Managed Runs",
                        "counts" to "${dashboard.runs.shown}/${dashboard.runs.total} shown · ${dashboard.runs.terminal} terminal · ${dashboard.runs.resultBound} results bound",
                        "authority" to "No Run launch or effect authority.",
                    ),
                    row(
                        "handoffs", "area" to "Handoffs",
                        "counts" to "${dashboard.handoffs.shown}/${dashboard.handoffs.total} shown · ${dashboard.handoffs.acknowledged} acknowledged",
                        "authority" to "No handoff acknowledgement or action authority.",
                    ),
                ),
                total = 3L, omitted = 0L, snapshotDigest = dashboard.snapshotDigest,
                sourceBoundary = sourceBoundary, authorityBoundary = authorityBoundary,
            ),
        )
    }

    fun changeImpact(dashboard: ChangeImpactDashboard): List<AccessibleMetadataTable> {
        val common = Triple(
            dashboard.snapshotDigest,
            "current-governed-records-and-bounded-trace-analysis",
            "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects",
        )
        fun bounded(
            id: String,
            title: String,
            columns: List<AccessibleTableColumn>,
            rows: List<AccessibleTableRow>,
            limit: ChangeImpactLimit,
        ) = table(id, title, columns, rows, limit.total, limit.omitted, common.first, common.second, common.third)
        return listOf(
            bounded(
                "change-work-items",
                "Change Work Items",
                columns("record-id" to "Record ID", "revision" to "Revision", "state" to "State", "digest" to "Digest"),
                dashboard.workItems.map { entry ->
                    row(
                        entry.record.recordId.toString(),
                        "record-id" to entry.record.recordId.toString(),
                        "revision" to entry.record.revision.toString(),
                        "state" to entry.state,
                        "digest" to entry.record.digest,
                    )
                },
                dashboard.limits.workItems,
            ),
            bounded(
                "changed-artifacts",
                "Changed artifacts",
                columns("locator" to "Locator", "kind" to "Kind", "work-item" to "Source Work Item"),
                dashboard.changedArtifacts.mapIndexed { index, entry ->
                    row(
                        "${entry.sourceWorkItem.recordId}:artifact:$index",
                        "locator" to entry.locator.value,
                        "kind" to entry.locator.kind,
                        "work-item" to entry.sourceWorkItem.recordId.toString(),
                    )
                },
                dashboard.limits.changedArtifacts,
            ),
            bounded(
                "effect-targets",
                "Effect targets",
                columns("locator" to "Locator", "kind" to "Kind", "work-item" to "Source Work Item"),
                dashboard.effectTargets.mapIndexed { index, entry ->
                    row(
                        "${entry.sourceWorkItem.recordId}:effect:$index",
                        "locator" to entry.locator.value,
                        "kind" to entry.locator.kind,
                        "work-item" to entry.sourceWorkItem.recordId.toString(),
                    )
                },
                dashboard.limits.effectTargets,
            ),
            bounded(
                "affected-units",
                "Affected units",
                columns(
                    "direction" to "Direction", "endpoint" to "Endpoint", "relationship" to "Relationship",
                    "trace-state" to "Trace state", "trace-id" to "Trace ID",
                    "assessment-digest" to "Assessment digest",
                ),
                dashboard.affectedUnits.map { entry ->
                    row(
                        "${entry.trace.recordId}:${entry.direction}:${entry.endpoint.recordId}",
                        "direction" to entry.direction,
                        "endpoint" to "${entry.endpoint.recordType}:${entry.endpoint.recordId}",
                        "relationship" to entry.relationship,
                        "trace-state" to entry.trace.assessedState,
                        "trace-id" to entry.trace.recordId.toString(),
                        "assessment-digest" to entry.trace.assessmentDigest,
                    )
                },
                dashboard.limits.affectedUnits,
            ),
            bounded(
                "related-decisions",
                "Related Decisions",
                columns(
                    "record-id" to "Record ID", "revision" to "Revision", "state" to "State",
                    "outcome" to "Outcome", "digest" to "Digest",
                ),
                dashboard.decisions.map { entry ->
                    row(
                        entry.record.recordId.toString(),
                        "record-id" to entry.record.recordId.toString(),
                        "revision" to entry.record.revision.toString(),
                        "state" to entry.state,
                        "outcome" to entry.outcome,
                        "digest" to entry.record.digest,
                    )
                },
                dashboard.limits.decisions,
            ),
            bounded(
                "related-risks",
                "Related Risks",
                columns(
                    "record-id" to "Record ID", "revision" to "Revision", "state" to "State",
                    "likelihood" to "Likelihood", "impact" to "Impact", "acceptance" to "Acceptance",
                    "digest" to "Digest",
                ),
                dashboard.risks.map { entry ->
                    row(
                        entry.record.recordId.toString(),
                        "record-id" to entry.record.recordId.toString(),
                        "revision" to entry.record.revision.toString(),
                        "state" to entry.state,
                        "likelihood" to entry.likelihood,
                        "impact" to entry.impact,
                        "acceptance" to entry.acceptance,
                        "digest" to entry.record.digest,
                    )
                },
                dashboard.limits.risks,
            ),
        )
    }

    fun agentModel(dashboard: AgentModelDashboard): List<AccessibleMetadataTable> {
        val snapshot = dashboard.snapshotDigest
        val source = "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata"
        val authority = "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects"
        fun bounded(
            id: String,
            title: String,
            columns: List<AccessibleTableColumn>,
            rows: List<AccessibleTableRow>,
            limit: AgentModelLimit,
        ) = table(id, title, columns, rows, limit.total, limit.omitted, snapshot, source, authority)
        val selection = dashboard.selection
        return listOf(
            bounded(
                "agent-capabilities",
                "Observed agent capabilities",
                columns(
                    "agent" to "Agent", "adapter-version" to "Adapter version", "runtime-version" to "Runtime version",
                    "detected" to "Detected", "interface" to "Execution interface", "maturity" to "Interface maturity",
                    "models" to "Model count", "selected" to "Selected", "observed-at" to "Observed at",
                    "digest" to "Capability digest",
                ),
                dashboard.capabilities.map { capability ->
                    row(
                        "${capability.adapterId}:${capability.agentId}",
                        "agent" to "${capability.adapterId}/${capability.agentId} · ${capability.agentLabel}",
                        "adapter-version" to capability.adapterVersion,
                        "runtime-version" to (capability.runtimeVersion ?: "not observed"),
                        "detected" to capability.detected.toString(),
                        "interface" to capability.executionInterface,
                        "maturity" to capability.interfaceMaturity,
                        "models" to capability.modelCount.toString(),
                        "selected" to capability.selected.toString(),
                        "observed-at" to capability.observedAt.toString(),
                        "digest" to capability.capabilityDigest,
                    )
                },
                dashboard.capabilityLimit,
            ),
            table(
                "agent-selection",
                "Current Agent Selection",
                columns(
                    "status" to "Status", "agent" to "Agent", "model" to "Model",
                    "truth-class" to "Model truth class", "alias" to "Model alias",
                    "capability-state" to "Capability state", "selected-at" to "Selected at",
                    "selection-digest" to "Selection digest", "capability-digest" to "Capability digest",
                ),
                listOf(
                    row(
                        "current-selection",
                        "status" to selection.status,
                        "agent" to if (selection.adapterId != null) "${selection.adapterId}/${selection.agentId}" else "not available",
                        "model" to (selection.modelId ?: "not available"),
                        "truth-class" to (selection.modelTruthClass ?: "not available"),
                        "alias" to (selection.modelAlias?.toString() ?: "not available"),
                        "capability-state" to (selection.capabilityState ?: "not available"),
                        "selected-at" to (selection.selectedAt?.toString() ?: "not available"),
                        "selection-digest" to (selection.selectionDigest ?: "not available"),
                        "capability-digest" to (selection.capabilityDigest ?: "not available"),
                    ),
                ),
                1,
                0,
                snapshot,
                source,
                authority,
            ),
            bounded(
                "agent-runs",
                "Agent Runs and Managed evidence",
                columns(
                    "run-id" to "Run ID", "revision" to "Revision", "state" to "State", "agent" to "Agent",
                    "model" to "Model", "managed-state" to "Managed state", "managed-result" to "Managed result",
                ),
                dashboard.runs.map { run ->
                    row(
                        run.recordId.toString(),
                        "run-id" to run.recordId.toString(),
                        "revision" to run.revision.toString(),
                        "state" to run.state,
                        "agent" to "${run.adapterId}/${run.agentId}",
                        "model" to run.modelId,
                        "managed-state" to if (run.managed.status == "observed") {
                            "${run.managed.state} · attempt ${run.managed.attemptNumber}"
                        } else {
                            run.managed.status
                        },
                        "managed-result" to (run.managed.resultStatus ?: "not observed"),
                    )
                },
                dashboard.runLimit,
            ),
            bounded(
                "agent-handoffs",
                "Agent and model handoffs",
                columns(
                    "handoff-id" to "Handoff ID", "from-run" to "From Run", "target" to "Target selection",
                    "state" to "State", "created-at" to "Created at",
                ),
                dashboard.handoffs.map { handoff ->
                    row(
                        handoff.recordId.toString(),
                        "handoff-id" to handoff.recordId.toString(),
                        "from-run" to handoff.fromRunId.toString(),
                        "target" to "${handoff.toAdapterId}/${handoff.toAgentId}/${handoff.toModelId}",
                        "state" to handoff.state,
                        "created-at" to handoff.createdAt.toString(),
                    )
                },
                dashboard.handoffLimit,
            ),
            table(
                "provider-metrics",
                "Provider usage and cost metadata",
                columns("metric" to "Metric", "state" to "State", "basis" to "Basis"),
                listOf(
                    row(
                        "usage",
                        "metric" to "Usage",
                        "state" to "unavailable",
                        "basis" to "current-managed-records-have-no-provider-usage-or-cost-contract",
                    ),
                    row(
                        "cost",
                        "metric" to "Cost",
                        "state" to "unavailable",
                        "basis" to "current-managed-records-have-no-provider-usage-or-cost-contract",
                    ),
                ),
                2,
                0,
                snapshot,
                source,
                authority,
            ),
        )
    }

    private fun table(
        id: String,
        title: String,
        columns: List<AccessibleTableColumn>,
        rows: List<AccessibleTableRow>,
        total: Long,
        omitted: Long,
        snapshotDigest: String,
        sourceBoundary: String,
        authorityBoundary: String,
    ) = exact(
        AccessibleMetadataTable(
            id,
            title,
            columns,
            rows,
            total,
            omitted,
            snapshotDigest,
            sourceBoundary,
            authorityBoundary,
        ),
    )

    private fun columns(vararg values: Pair<String, String>): List<AccessibleTableColumn> =
        values.map { AccessibleTableColumn(it.first, it.second) }

    private fun row(id: String, vararg values: Pair<String, String>): AccessibleTableRow =
        AccessibleTableRow(id, values.toMap())
}
