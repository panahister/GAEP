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

internal class RiderProductController(private val client: GaepEngineClient) {
    fun readProduct(): String = renderProduct(client.readProductBinding())

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
