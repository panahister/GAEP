package dev.gaep.rider

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileChooser.FileChooser
import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPanel
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.content.ContentFactory
import com.intellij.util.ui.JBUI
import java.awt.BorderLayout
import java.awt.GridLayout
import java.nio.file.Path
import java.util.UUID
import javax.swing.JButton
import javax.swing.JPanel
import javax.swing.JTextArea

private data class AgentSelectionDraft(
    val adapter: AgentReadinessSnapshot,
    val modelId: String,
    val settings: Map<String, PortableAgentSettingValue>,
)

private data class AgentHandoffDraft(
    val target: AgentSelectionDraft,
    val reason: String,
    val completedWork: List<String>,
    val unresolvedMatters: List<String>,
    val decisions: List<String>,
    val evidence: List<String>,
)

private class AgentSelectionCancelled : RuntimeException()

class GaepToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val workspace = project.basePath
        if (workspace == null) {
            Messages.showErrorDialog(project, "Open a project before using GAEP.", "GAEP")
            return
        }
        val client = try {
            RiderEngineClientFactory.create(Path.of(workspace))
        } catch (_: Exception) {
            Messages.showErrorDialog(
                project,
                "GAEP could not verify its engine boundary. Configure an absolute package-runtime path or an explicit external engine; no PATH fallback was attempted.",
                "GAEP Engine Unavailable",
            )
            return
        }
        val controller = RiderProductController(client)
        val status = JBLabel("GAEP engine has not been contacted")
        val output = JTextArea().apply {
            isEditable = false
            lineWrap = true
            wrapStyleWord = true
            border = JBUI.Borders.empty(8)
            accessibleContext.accessibleName = "GAEP Product result"
        }
        val buttons = mutableListOf<JButton>()
        val actions = JPanel(GridLayout(0, 2, 8, 8))

        fun addAction(label: String, task: () -> String) {
            val button = JButton(label).apply {
                addActionListener { runRequest(label, status, output, buttons, task) }
            }
            buttons += button
            actions.add(button)
        }

        addAction("Refresh Product") { controller.readProduct() }
        addAction("Show phase dashboards") { controller.readPhaseDashboard() }

        val changeImpactButton = JButton("Show Change and impact…").apply {
            addActionListener {
                beginChangeImpact(project, controller, status, output, buttons)
            }
        }
        buttons += changeImpactButton
        actions.add(changeImpactButton)

        addAction("Show Agent and model") { controller.readAgentModel() }

        addAction("Refresh agent readiness") { controller.readAgentReadiness() }

        val selectionButton = JButton("Select agent configuration…").apply {
            addActionListener {
                beginAgentSelection(project, controller, status, output, buttons)
            }
        }
        buttons += selectionButton
        actions.add(selectionButton)

        val handoffButton = JButton("Create versioned agent handoff…").apply {
            addActionListener {
                beginAgentHandoff(project, controller, status, output, buttons)
            }
        }
        buttons += handoffButton
        actions.add(handoffButton)

        val managedReadOnlyButton = JButton("Run managed read-only work…").apply {
            addActionListener {
                beginManagedReadOnly(project, controller, status, output, buttons)
            }
        }
        buttons += managedReadOnlyButton
        actions.add(managedReadOnlyButton)

        val managedEvidenceListButton = JButton("Browse Managed Run evidence…").apply {
            addActionListener {
                beginManagedEvidenceNavigation(project, controller, status, output, buttons)
            }
        }
        buttons += managedEvidenceListButton
        actions.add(managedEvidenceListButton)

        val managedEvidenceButton = JButton("Read Managed Run evidence…").apply {
            addActionListener {
                val managedRunId = Messages.showInputDialog(
                    project,
                    "Enter one exact Managed Run UUID from the bounded evidence list.",
                    "Read Managed Run Evidence",
                    Messages.getQuestionIcon(),
                ) ?: return@addActionListener
                runRequest("Read Managed Run evidence", status, output, buttons) {
                    controller.readManagedEvidence(managedRunId)
                }
            }
        }
        buttons += managedEvidenceButton
        actions.add(managedEvidenceButton)

        val managedReviewButton = JButton("Review pending staged Managed Run…").apply {
            addActionListener {
                beginManagedReview(project, controller, status, output, buttons)
            }
        }
        buttons += managedReviewButton
        actions.add(managedReviewButton)

        addAction("List design imports") { controller.listPortableDesignSnapshots() }

        val readButton = JButton("Read design import…").apply {
            addActionListener {
                val bundleId = Messages.showInputDialog(
                    project,
                    "Enter one exact portable-design bundle UUID.",
                    "Read Portable Design Metadata",
                    Messages.getQuestionIcon(),
                ) ?: return@addActionListener
                runRequest("Read design import", status, output, buttons) {
                    controller.readPortableDesignSnapshot(bundleId)
                }
            }
        }
        buttons += readButton
        actions.add(readButton)

        val importButton = JButton("Import local bundle…").apply {
            addActionListener {
                val descriptor = FileChooserDescriptorFactory.createSingleFolderDescriptor().apply {
                    title = "Select one local portable design bundle folder"
                    description = "Files, archives, remote URLs, OAuth and live design-tool accounts are not supported."
                }
                val selected = FileChooser.chooseFile(descriptor, project, null) ?: return@addActionListener
                val decision = Messages.showYesNoDialog(
                    project,
                    "Import one local folder as metadata and digests only? The result remains pending human review even when upstream sourceReview says approved.",
                    "Import as Pending Human Review",
                    "Import as Pending Review",
                    "Cancel",
                    Messages.getWarningIcon(),
                )
                if (decision != Messages.YES) return@addActionListener
                val actorId = System.getenv("GAEP_ACTOR_ID") ?: "gaep.rider-local-human"
                runRequest("Import local bundle", status, output, buttons) {
                    controller.importPortableDesignSnapshot(Path.of(selected.path), actorId)
                }
            }
        }
        buttons += importButton
        actions.add(importButton)

        val governance = JTextArea(
            "Change/Impact boundary: selection and projection are exact, audit-gated, read-only metadata views; " +
                "they cannot approve a Change, accept a Risk, mutate records, or authorize effects. " +
            "Agent boundary: Codex and Claude readiness is observation-only; guarded selection and versioned handoff record portable configuration and history only. " +
                "They cannot start or resume a provider, create a Run, approve tools or effects, or grant execution authority. " +
                "Managed read-only execution is a separate digest-bound command: every Tool permission remains denied, only observation is allowed, " +
                "and provider completion is reported separately from the governed outcome. " +
                "Managed Run evidence is an audit-gated, snapshot-bounded read-only view of portable counts and digests; " +
                "it cannot start, resume, cancel, apply, discard, approve, or infer outcome success. " +
                "Exact staged review is a separate two-confirmation flow bound to one Managed Run revision, preview digest, " +
                "complete changed-file inventory, and host-owned write envelope. Post-apply Workflow gates remain not assessed, " +
                "and persisted state does not prove machine-local cleanup. " +
                "Governance boundary: portable-design imports remain pending human review. " +
                "Upstream approval is not GAEP approval, a Design Baseline, implementation readiness, or release readiness. " +
                "Only validated metadata and digests are displayed; local paths and source content are withheld.",
        ).apply {
            isEditable = false
            isOpaque = false
            lineWrap = true
            wrapStyleWord = true
            border = JBUI.Borders.empty(0, 0, 8, 0)
            accessibleContext.accessibleName = "GAEP governance boundary"
        }
        val header = JBPanel<JBPanel<*>>(BorderLayout()).apply {
            add(status, BorderLayout.NORTH)
            add(governance, BorderLayout.CENTER)
        }
        val panel = JBPanel<JBPanel<*>>(BorderLayout(0, 8)).apply {
            border = JBUI.Borders.empty(8)
            add(header, BorderLayout.NORTH)
            add(JBScrollPane(output), BorderLayout.CENTER)
            add(actions, BorderLayout.SOUTH)
        }
        val content = ContentFactory.getInstance().createContent(panel, "Product", false)
        content.setDisposer(client)
        toolWindow.contentManager.addContent(content)
    }

    @Suppress("DEPRECATION")
    private fun beginChangeImpact(
        project: Project,
        controller: RiderProductController,
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
    ) {
        buttons.forEach { it.isEnabled = false }
        status.text = "Loading exact current Change catalog…"
        ApplicationManager.getApplication().executeOnPooledThread {
            runCatching { controller.readChangeImpactContext() }
                .onSuccess { context ->
                    ApplicationManager.getApplication().invokeLater {
                        if (context.catalog.items.isEmpty()) {
                            finishRequest(
                                status,
                                output,
                                buttons,
                                "GAEP Change/Impact catalog is empty",
                                "No current Change metadata is available for the exact Change/Impact dashboard.",
                            )
                            return@invokeLater
                        }
                        val labels = context.catalog.items.map { change ->
                            "${change.recordId} · ${change.state} · revision ${change.revision} · " +
                                change.effectEnvelope.joinToString(", ")
                        }.toTypedArray()
                        val selected = Messages.showChooseDialog(
                            project,
                            "Select one exact current Change (${context.catalog.items.size} of ${context.catalog.total}; " +
                                "${context.catalog.omitted} omitted). Selection grants no approval or effect authority.",
                            "Open Read-only Change/Impact Projection",
                            Messages.getQuestionIcon(),
                            labels,
                            labels.first(),
                        )
                        if (selected < 0) {
                            finishRequest(
                                status,
                                output,
                                buttons,
                                "GAEP Change/Impact selection cancelled",
                                "No Change/Impact projection was requested and no authority was granted.",
                            )
                            return@invokeLater
                        }
                        val change = context.catalog.items.getOrNull(selected)
                        if (change == null) {
                            finishRequest(
                                status,
                                output,
                                buttons,
                                "GAEP request stopped",
                                "Select one verified Change from the current exact catalog.",
                            )
                            return@invokeLater
                        }
                        status.text = "Loading exact Change/Impact projection…"
                        ApplicationManager.getApplication().executeOnPooledThread {
                            runCatching { controller.readChangeImpact(context, change) }
                                .onSuccess { rendered ->
                                    ApplicationManager.getApplication().invokeLater {
                                        finishRequest(status, output, buttons, "GAEP Change/Impact projection ready", rendered)
                                    }
                                }
                                .onFailure { error ->
                                    ApplicationManager.getApplication().invokeLater {
                                        finishRequest(status, output, buttons, "GAEP request stopped", safeError(error))
                                    }
                                }
                        }
                    }
                }
                .onFailure { error ->
                    ApplicationManager.getApplication().invokeLater {
                        finishRequest(status, output, buttons, "GAEP request stopped", safeError(error))
                    }
                }
        }
    }

    private fun beginManagedEvidenceNavigation(
        project: Project,
        controller: RiderProductController,
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
    ) {
        buttons.forEach { it.isEnabled = false }
        status.text = "Loading first verified Managed Run evidence page…"
        ApplicationManager.getApplication().executeOnPooledThread {
            runCatching { controller.listManagedEvidencePage() }
                .onSuccess { firstPage ->
                    ApplicationManager.getApplication().invokeLater {
                        continueManagedEvidenceNavigation(
                            project,
                            controller,
                            status,
                            output,
                            buttons,
                            mutableListOf(firstPage),
                        )
                    }
                }
                .onFailure { error ->
                    ApplicationManager.getApplication().invokeLater {
                        finishRequest(status, output, buttons, "GAEP request stopped", safeError(error))
                    }
                }
        }
    }

    @Suppress("DEPRECATION")
    private fun continueManagedEvidenceNavigation(
        project: Project,
        controller: RiderProductController,
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
        pages: MutableList<ManagedRunSummaryPage>,
    ) {
        val page = pages.last()
        val rendered = controller.renderManagedEvidencePage(page)
        output.text = rendered
        output.caretPosition = 0
        val firstDisplayed = if (page.items.isEmpty()) 0 else page.offset + 1
        status.text = "Managed Run evidence $firstDisplayed-${page.offset + page.items.size} of ${page.total}"
        val previous = "Previous Verified Page"
        val next = "Next Verified Page"
        val finish = "Finish Observation"
        val options = buildList {
            if (pages.size > 1) add(previous)
            if (page.hasMore) add(next)
            add(finish)
        }.toTypedArray()
        val choice = Messages.showDialog(
            project,
            "This page is bound to snapshot ${pages.first().snapshotDigest} and total ${pages.first().total}. " +
                "Navigation remains read-only and grants no Run, Tool, write, effect, apply, discard, approval, or outcome authority.",
            "Browse Verified Managed Run Evidence",
            options,
            options.lastIndex,
            Messages.getQuestionIcon(),
        )
        val selected = options.getOrNull(choice) ?: finish
        if (selected == finish) {
            finishRequest(status, output, buttons, "GAEP engine ready", rendered)
            return
        }
        if (selected == previous) {
            pages.removeAt(pages.lastIndex)
            ApplicationManager.getApplication().invokeLater {
                continueManagedEvidenceNavigation(project, controller, status, output, buttons, pages)
            }
            return
        }
        status.text = "Loading next verified Managed Run evidence page…"
        val firstPage = pages.first()
        ApplicationManager.getApplication().executeOnPooledThread {
            runCatching {
                controller.listManagedEvidencePage(
                    offset = page.offset + page.items.size,
                    limit = page.limit,
                    snapshotDigest = firstPage.snapshotDigest,
                    expectedTotal = firstPage.total,
                )
            }.onSuccess { nextPage ->
                ApplicationManager.getApplication().invokeLater {
                    pages += nextPage
                    continueManagedEvidenceNavigation(project, controller, status, output, buttons, pages)
                }
            }.onFailure { error ->
                ApplicationManager.getApplication().invokeLater {
                    finishRequest(status, output, buttons, "GAEP request stopped", safeError(error))
                }
            }
        }
    }

    private fun beginManagedReadOnly(
        project: Project,
        controller: RiderProductController,
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
    ) {
        val charterId = promptManagedUuid(
            project,
            label = "Execution Charter ID",
            prompt = "Enter the exact confirmed managed Execution Charter UUID.",
        ) ?: return
        val workflowPlanId = promptManagedUuid(
            project,
            label = "Workflow Plan ID",
            prompt = "Enter the exact Workflow Plan UUID bound by that Charter.",
        ) ?: return
        buttons.forEach { it.isEnabled = false }
        status.text = "Loading exact managed read-only preview…"
        ApplicationManager.getApplication().executeOnPooledThread {
            runCatching { controller.previewManagedReadOnly(charterId, workflowPlanId) }
                .onSuccess { preview ->
                    ApplicationManager.getApplication().invokeLater {
                        val previewText = controller.renderManagedReadOnlyPreview(preview)
                        output.text = previewText
                        output.caretPosition = 0
                        val decision = Messages.showDialog(
                            project,
                            "Attest this exact managed read-only preview?\n\n" +
                                "Preview digest: ${preview.previewDigest}\n" +
                                "Provider: ${preview.agentId} / ${preview.modelId} (${preview.adapterId})\n" +
                                "Strategy: ${preview.strategy}; steps: ${preview.stepIds.size}; gates: ${preview.gates.size}\n" +
                                "Declared reads: ${preview.readScopeCount}; context packs: ${preview.contextPackCount}\n\n" +
                                "Every Tool permission is denied. No write scope or non-observation effect is granted. " +
                                "The timeout is fixed at 120 seconds. This blocking local protocol does not provide interactive cancel or resume. " +
                                "Any Codex stage with changes, conflict, or pending review is discarded or rejected; only a proven zero-change stage may close automatically. " +
                                "Provider completion and governed outcome remain separate claims.",
                            "Attest Exact Managed Read-Only Preview",
                            arrayOf("Attest Exact Preview and Run", "Cancel"),
                            1,
                            Messages.getWarningIcon(),
                        )
                        if (decision != 0) {
                            finishRequest(
                                status,
                                output,
                                buttons,
                                "Managed read-only execution cancelled",
                                "$previewText\n\nExecution was cancelled. The preview granted no execution or effect authority.",
                            )
                            return@invokeLater
                        }
                        status.text = "Executing attested managed read-only work…"
                        ApplicationManager.getApplication().executeOnPooledThread {
                            val actorId = System.getenv("GAEP_ACTOR_ID") ?: "gaep.rider-local-human"
                            runCatching {
                                controller.executeManagedReadOnly(
                                    preview = preview,
                                    actorId = actorId,
                                    timeoutMs = 120_000,
                                )
                            }.onSuccess { result ->
                                ApplicationManager.getApplication().invokeLater {
                                    finishRequest(status, output, buttons, "GAEP managed read-only receipt verified", result)
                                }
                            }.onFailure { error ->
                                ApplicationManager.getApplication().invokeLater {
                                    finishRequest(status, output, buttons, "GAEP managed read-only request stopped", safeError(error))
                                }
                            }
                        }
                    }
                }
                .onFailure { error ->
                    ApplicationManager.getApplication().invokeLater {
                        finishRequest(status, output, buttons, "GAEP managed read-only request stopped", safeError(error))
                    }
                }
        }
    }

    private fun beginManagedReview(
        project: Project,
        controller: RiderProductController,
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
    ) {
        val managedRunId = promptManagedUuid(
            project,
            label = "Managed Run ID",
            prompt = "Enter the exact pending staged Managed Run UUID.",
            title = "Review Staged Managed Run",
        ) ?: return
        buttons.forEach { it.isEnabled = false }
        status.text = "Loading exact staged Managed Run review…"
        ApplicationManager.getApplication().executeOnPooledThread {
            runCatching { controller.readManagedReview(managedRunId) }
                .onSuccess { preview ->
                    ApplicationManager.getApplication().invokeLater {
                        val previewText = controller.renderManagedReviewPreview(preview)
                        output.text = previewText
                        output.caretPosition = 0
                        val options = buildList {
                            if (preview.canApply) add("Apply Exact Reviewed Inventory")
                            if (preview.canDiscard) add("Discard Staged Changes")
                            add("Cancel and Keep Pending")
                        }.toTypedArray()
                        val decisionIndex = Messages.showDialog(
                            project,
                            "Managed Run ${preview.managedRunId} revision ${preview.managedRunRevision} is ${preview.state}.\n\n" +
                                "${preview.staging.changeCount} exact staged file change(s); inventory " +
                                "${preview.staging.changedInventoryDigest}; preview ${preview.previewDigest}.\n\n" +
                                if (preview.canApply) {
                                    "Apply can change only the exact reviewed workspace-relative inventory and write envelope. " +
                                        "Post-apply Workflow gates will be recorded not assessed, so governed outcome success cannot be claimed.\n\n" +
                                        "Cancel keeps the review pending. Opening this view caused no mutation."
                                } else {
                                    "Apply is unavailable. Exact discard remains available for this recovery state.\n\n" +
                                        "Cancel keeps the review pending. Opening this view caused no mutation."
                                },
                            "Choose Exact Managed Review Decision",
                            options,
                            options.lastIndex,
                            Messages.getWarningIcon(),
                        )
                        val selected = options.getOrNull(decisionIndex)
                        if (selected == null || selected == "Cancel and Keep Pending") {
                            finishRequest(
                                status,
                                output,
                                buttons,
                                "Managed review kept pending",
                                "$previewText\n\nNo apply or discard decision was sent. The exact review remains pending.",
                            )
                            return@invokeLater
                        }
                        val apply = selected == "Apply Exact Reviewed Inventory"
                        val confirmationLabel = if (apply) "Confirm Exact Apply" else "Confirm Exact Discard"
                        val confirmation = Messages.showDialog(
                            project,
                            "$confirmationLabel for Managed Run ${preview.managedRunId}?\n\n" +
                                "Bound revision: ${preview.managedRunRevision}\n" +
                                "Preview: ${preview.previewDigest}\n" +
                                "Changes: ${preview.staging.changeCount}\n" +
                                "Inventory: ${preview.staging.changedInventoryDigest}\n\n" +
                                if (apply) {
                                    "Write envelope: ${preview.applyConfirmation?.writeEnvelope?.joinToString() ?: "none"}. " +
                                        "This can mutate those exact source-workspace paths. Workflow gates remain not assessed."
                                } else {
                                    "Discard persists a governed discarded state. Machine-local stage and recovery-journal " +
                                        "cleanup remain separate, unproven claims."
                                },
                            confirmationLabel,
                            arrayOf(confirmationLabel, "Cancel and Keep Pending"),
                            1,
                            Messages.getWarningIcon(),
                        )
                        if (confirmation != 0) {
                            finishRequest(
                                status,
                                output,
                                buttons,
                                "Managed review kept pending",
                                "$previewText\n\nThe final confirmation was cancelled. No decision was sent.",
                            )
                            return@invokeLater
                        }
                        status.text = if (apply) "Applying exact reviewed inventory…" else "Discarding exact staged review…"
                        ApplicationManager.getApplication().executeOnPooledThread {
                            val actorId = System.getenv("GAEP_ACTOR_ID") ?: "gaep.rider-local-human"
                            runCatching {
                                if (apply) {
                                    controller.applyManagedReview(preview, actorId)
                                } else {
                                    controller.discardManagedReview(preview, actorId)
                                }
                            }.onSuccess { transition ->
                                ApplicationManager.getApplication().invokeLater {
                                    val transitionText = controller.renderManagedReviewTransition(transition)
                                    val transitionStatus = if (apply) {
                                        "Exact apply persisted as ${transition.state}; Workflow gates not assessed"
                                    } else {
                                        "Exact discard persisted as ${transition.state}; cleanup not independently proven"
                                    }
                                    finishRequest(status, output, buttons, transitionStatus, transitionText)
                                }
                            }.onFailure { error ->
                                ApplicationManager.getApplication().invokeLater {
                                    finishRequest(status, output, buttons, "GAEP managed review stopped", safeError(error))
                                }
                            }
                        }
                    }
                }
                .onFailure { error ->
                    ApplicationManager.getApplication().invokeLater {
                        finishRequest(status, output, buttons, "GAEP managed review stopped", safeError(error))
                    }
                }
        }
    }

    private fun promptManagedUuid(
        project: Project,
        label: String,
        prompt: String,
        title: String = "Managed Read-Only Execution",
    ): String? {
        while (true) {
            val entered = Messages.showInputDialog(
                project,
                prompt,
                title,
                Messages.getQuestionIcon(),
            ) ?: return null
            val normalized = entered.trim()
            val parsed = runCatching {
                require(normalized.matches(Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")))
                UUID.fromString(normalized).also { require(it != UUID(0, 0)) }
            }
            if (parsed.isSuccess) return parsed.getOrThrow().toString()
            Messages.showErrorDialog(project, "$label must be a non-empty UUID.", title)
        }
    }

    private fun beginAgentSelection(
        project: Project,
        controller: RiderProductController,
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
    ) {
        buttons.forEach { it.isEnabled = false }
        status.text = "Loading verified agent capabilities…"
        ApplicationManager.getApplication().executeOnPooledThread {
            runCatching { controller.readAgentSelectionContext() }
                .onSuccess { context ->
                    ApplicationManager.getApplication().invokeLater {
                        val draft = runCatching { promptAgentSelection(project, context) }
                            .getOrElse { error ->
                                if (error is AgentSelectionCancelled) {
                                    finishRequest(
                                        status,
                                        output,
                                        buttons,
                                        "Agent Selection unchanged",
                                        "Selection was cancelled. No provider was started and no state changed.",
                                    )
                                } else {
                                    finishRequest(status, output, buttons, "GAEP request stopped", safeError(error))
                                }
                                return@invokeLater
                            }
                        if (draft == null) {
                            finishRequest(status, output, buttons, "Agent Selection unchanged", "Selection was cancelled. No provider was started and no state changed.")
                            return@invokeLater
                        }
                        val prior = (context.current as? AgentSelectionState.Selected)?.selection?.let {
                            " Current selection: ${it.agentId} / ${it.modelId}."
                        }.orEmpty()
                        val decision = Messages.showYesNoDialog(
                            project,
                            "Record ${draft.adapter.agentLabel} / ${draft.modelId} with ${draft.settings.size} explicit portable setting(s)?$prior " +
                                "This does not start a provider, create or resume a Run, approve tools or effects, or grant execution authority. " +
                                "The engine will reject active-Run, capability-drift, legacy, invalid, and post-Run changes that require a handoff.",
                            "Confirm Guarded Agent Selection",
                            "Confirm Selection",
                            "Cancel",
                            Messages.getWarningIcon(),
                        )
                        if (decision != Messages.YES) {
                            finishRequest(status, output, buttons, "Agent Selection unchanged", "Selection was cancelled. No provider was started and no state changed.")
                            return@invokeLater
                        }
                        status.text = "Recording guarded Agent Selection…"
                        ApplicationManager.getApplication().executeOnPooledThread {
                            val actorId = System.getenv("GAEP_ACTOR_ID") ?: "gaep.rider-local-human"
                            runCatching {
                                controller.selectAgent(
                                    draft.adapter.adapterId,
                                    draft.modelId,
                                    draft.settings,
                                    actorId,
                                )
                            }.onSuccess { result ->
                                ApplicationManager.getApplication().invokeLater {
                                    finishRequest(status, output, buttons, "GAEP engine ready", result)
                                }
                            }.onFailure { error ->
                                ApplicationManager.getApplication().invokeLater {
                                    finishRequest(status, output, buttons, "GAEP request stopped", safeError(error))
                                }
                            }
                        }
                    }
                }
                .onFailure { error ->
                    ApplicationManager.getApplication().invokeLater {
                        finishRequest(status, output, buttons, "GAEP request stopped", safeError(error))
                    }
                }
        }
    }

    private fun beginAgentHandoff(
        project: Project,
        controller: RiderProductController,
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
    ) {
        buttons.forEach { it.isEnabled = false }
        status.text = "Loading versioned handoff context…"
        ApplicationManager.getApplication().executeOnPooledThread {
            runCatching { controller.readAgentHandoffContext() }
                .onSuccess { context ->
                    ApplicationManager.getApplication().invokeLater {
                        val draft = runCatching { promptAgentHandoff(project, context) }
                            .getOrElse { error ->
                                if (error is AgentSelectionCancelled) {
                                    finishRequest(
                                        status,
                                        output,
                                        buttons,
                                        "Agent handoff unchanged",
                                        "Handoff was cancelled. No provider was started and no state changed.",
                                    )
                                } else {
                                    finishRequest(status, output, buttons, "GAEP request stopped", safeError(error))
                                }
                                return@invokeLater
                            }
                        val decision = Messages.showYesNoDialog(
                            project,
                            "Create a versioned handoff from terminal Run ${context.sourceRun.id}?\n\n" +
                                "Prior selection: ${context.current.agentId} / ${context.current.modelId}.\n" +
                                "Target selection: ${draft.target.adapter.agentLabel} / ${draft.target.modelId} with " +
                                "${draft.target.settings.size} explicit portable setting(s).\n" +
                                "Preserved entries: ${draft.completedWork.size} completed, ${draft.unresolvedMatters.size} unresolved, " +
                                "${draft.decisions.size} decisions, ${draft.evidence.size} evidence.\n\n" +
                                "The engine will atomically record the handoff and replace Agent Selection only after fresh capability verification. " +
                                "It will not start or resume a provider, create a Run, approve tools or effects, or grant execution authority.",
                            "Confirm Versioned Agent Handoff",
                            "Create Handoff and Switch",
                            "Cancel",
                            Messages.getWarningIcon(),
                        )
                        if (decision != Messages.YES) {
                            finishRequest(
                                status,
                                output,
                                buttons,
                                "Agent handoff unchanged",
                                "Handoff was cancelled. No provider was started and no state changed.",
                            )
                            return@invokeLater
                        }
                        status.text = "Recording versioned Agent Handoff…"
                        ApplicationManager.getApplication().executeOnPooledThread {
                            val actorId = System.getenv("GAEP_ACTOR_ID") ?: "gaep.rider-local-human"
                            runCatching {
                                controller.createAgentHandoff(
                                    context = context,
                                    toAdapterId = draft.target.adapter.adapterId,
                                    toModelId = draft.target.modelId,
                                    toSettings = draft.target.settings,
                                    reason = draft.reason,
                                    completedWork = draft.completedWork,
                                    unresolvedMatters = draft.unresolvedMatters,
                                    decisions = draft.decisions,
                                    evidence = draft.evidence,
                                    actorId = actorId,
                                )
                            }.onSuccess { result ->
                                ApplicationManager.getApplication().invokeLater {
                                    finishRequest(status, output, buttons, "GAEP engine ready", result)
                                }
                            }.onFailure { error ->
                                ApplicationManager.getApplication().invokeLater {
                                    finishRequest(status, output, buttons, "GAEP request stopped", safeError(error))
                                }
                            }
                        }
                    }
                }
                .onFailure { error ->
                    ApplicationManager.getApplication().invokeLater {
                        finishRequest(status, output, buttons, "GAEP request stopped", safeError(error))
                    }
                }
        }
    }

    private fun promptAgentHandoff(project: Project, context: AgentHandoffContext): AgentHandoffDraft {
        val target = promptAgentSelection(
            project,
            AgentSelectionContext(AgentSelectionState.Selected(context.current), context.available),
            "Select one verified local target adapter. The handoff records configuration and history only; it does not start an agent.",
        ) ?: throw AgentSelectionCancelled()
        require(context.current.adapterId != target.adapter.adapterId || context.current.modelId != target.modelId ||
            !PortableDesignProtocol.portableSettingsEqual(context.current.settings, target.settings)
        ) {
            "The handoff target is identical to the current portable Agent Selection. Choose a different adapter, model, or setting."
        }
        val reason = promptHandoffText(project, "Why is this provider, model, or setting switch required?", true)
        val completedWork = promptHandoffList(project, "Completed work to preserve, separated by commas")
        val unresolvedMatters = promptHandoffList(project, "Unresolved matters to preserve, separated by commas")
        val decisions = promptHandoffList(project, "Decisions to preserve, separated by commas")
        val evidence = promptHandoffList(project, "Portable evidence references to preserve, separated by commas")
        require(completedWork.isNotEmpty() || unresolvedMatters.isNotEmpty() || decisions.isNotEmpty() || evidence.isNotEmpty()) {
            "Record at least one completed-work, unresolved-matter, decision, or portable evidence entry before creating a handoff."
        }
        return AgentHandoffDraft(target, reason, completedWork, unresolvedMatters, decisions, evidence)
    }

    private fun promptHandoffList(project: Project, prompt: String): List<String> {
        val value = promptHandoffText(project, "$prompt Leave blank when none.", false)
        if (value.isEmpty()) return emptyList()
        return PortableDesignProtocol.normalizeHandoffTextList(value.split(',').map(String::trim), prompt)
    }

    private fun promptHandoffText(project: Project, prompt: String, required: Boolean): String {
        while (true) {
            val entered = Messages.showInputDialog(
                project,
                prompt,
                "Versioned Agent Handoff",
                Messages.getQuestionIcon(),
            ) ?: throw AgentSelectionCancelled()
            if (!required && entered.isBlank()) return ""
            val normalized = runCatching {
                PortableDesignProtocol.normalizeHandoffText(
                    entered,
                    if (required) "Handoff reason" else "Handoff detail",
                    minimum = if (required) 2 else 1,
                    maximum = if (required) 5_000 else 2_000,
                )
            }
            if (normalized.isSuccess) return normalized.getOrThrow()
            Messages.showErrorDialog(project, safeError(normalized.exceptionOrNull()!!), "Versioned Agent Handoff")
        }
    }

    @Suppress("DEPRECATION")
    private fun promptAgentSelection(
        project: Project,
        context: AgentSelectionContext,
        prompt: String = "Select one verified local agent adapter. Selection records configuration only; it does not start an agent.",
    ): AgentSelectionDraft? {
        val adapterLabels = context.available.mapIndexed { index, adapter ->
            "${index + 1}. ${adapter.agentLabel} — ${adapter.adapterId} (${adapter.executionInterface}, ${adapter.interfaceMaturity})"
        }.toTypedArray()
        val chosenAdapter = Messages.showChooseDialog(
            project,
            prompt,
            "Select Agent Adapter",
            Messages.getQuestionIcon(),
            adapterLabels,
            adapterLabels.first(),
        )
        if (chosenAdapter < 0) return null
        val adapter = context.available.getOrNull(chosenAdapter)
            ?: throw IllegalArgumentException("Select one verified adapter from the current capability snapshot.")

        val manualModel = "Enter another model ID…"
        val modelLabels = adapter.models.mapIndexed { index, model ->
            "${index + 1}. ${model.label} — ${model.id} (${model.truthClass}${if (model.alias) ", alias" else ""})"
        } + manualModel
        val chosenModel = Messages.showChooseDialog(
            project,
            "Select a model for ${adapter.agentLabel}. The engine will verify it against the current capability snapshot.",
            "Select Agent Model",
            Messages.getQuestionIcon(),
            modelLabels.toTypedArray(),
            modelLabels.first(),
        )
        if (chosenModel < 0) return null
        val modelId = if (chosenModel == modelLabels.lastIndex) {
            val entered = Messages.showInputDialog(
                project,
                "Enter a portable model ID. The engine must verify it against the current adapter capabilities.",
                "Enter Agent Model ID",
                Messages.getQuestionIcon(),
            ) ?: return null
            PortableDesignProtocol.normalizeSelectionIdentifier(entered, "Model ID")
        } else {
            adapter.models[chosenModel].id
        }

        val settings = linkedMapOf<String, PortableAgentSettingValue>()
        adapter.settings.forEach { setting ->
            if (setting.sensitive) {
                throw IllegalArgumentException(
                    "${setting.label} requires a machine-local credential binding, which this portable Rider selection flow does not collect or store.",
                )
            }
            promptAgentSetting(project, setting)?.let { settings[setting.key] = it }
        }
        return AgentSelectionDraft(adapter, modelId, settings.toMap())
    }

    private fun promptAgentSetting(
        project: Project,
        setting: AgentSelectionSetting,
    ): PortableAgentSettingValue? = when (setting.kind) {
        "select" -> promptSelectSetting(project, setting)
        "boolean" -> promptBooleanSetting(project, setting)
        "number", "string", "string-list" -> promptTextSetting(project, setting)
        else -> throw IllegalArgumentException("${setting.label} has an unsupported portable setting kind.")
    }

    @Suppress("DEPRECATION")
    private fun promptSelectSetting(project: Project, setting: AgentSelectionSetting): PortableAgentSettingValue? {
        val useDefault = "Use adapter default — ${setting.defaultValue?.let(::formatSettingValue) ?: "no explicit override"}"
        val choices = buildList {
            if (!setting.required || setting.defaultValue != null) add(useDefault)
            addAll((setting.options ?: emptyList()).mapIndexed { index, option ->
                "${index + 1}. ${option.label} — ${option.value}"
            })
        }
        require(choices.isNotEmpty()) { "${setting.label} is required but the verified adapter declared no selectable values." }
        val chosen = Messages.showChooseDialog(
            project,
            setting.description,
            setting.label,
            Messages.getQuestionIcon(),
            choices.toTypedArray(),
            choices.first(),
        )
        if (chosen < 0) throw AgentSelectionCancelled()
        if (choices[chosen] == useDefault) return null
        val index = chosen - if (choices.first() == useDefault) 1 else 0
        val value = setting.options?.getOrNull(index)?.value
            ?: throw IllegalArgumentException("Select one verified value for ${setting.label}.")
        return PortableAgentSettingValue.Text(value)
    }

    @Suppress("DEPRECATION")
    private fun promptBooleanSetting(project: Project, setting: AgentSelectionSetting): PortableAgentSettingValue? {
        val canDefault = !setting.required || setting.defaultValue != null
        val choices = buildList {
            if (canDefault) add("Use adapter default — ${setting.defaultValue?.let(::formatSettingValue) ?: "no explicit override"}")
            add("True")
            add("False")
        }
        val chosen = Messages.showChooseDialog(
            project,
            setting.description,
            setting.label,
            Messages.getQuestionIcon(),
            choices.toTypedArray(),
            choices.first(),
        )
        if (chosen < 0) throw AgentSelectionCancelled()
        return when (choices[chosen]) {
            "True" -> PortableAgentSettingValue.Flag(true)
            "False" -> PortableAgentSettingValue.Flag(false)
            else -> null
        }
    }

    private fun promptTextSetting(project: Project, setting: AgentSelectionSetting): PortableAgentSettingValue? {
        while (true) {
            val initial = setting.defaultValue?.let(::formatSettingValue).orEmpty()
            val prompt = if (setting.kind == "string-list") {
                "${setting.description} Enter comma-separated values. Leave blank to use the adapter default when permitted."
            } else {
                "${setting.description} Leave blank to use the adapter default when permitted."
            }
            val entered = Messages.showInputDialog(project, prompt, setting.label, Messages.getQuestionIcon(), initial, null)
                ?: throw AgentSelectionCancelled()
            if (entered.isBlank() && (!setting.required || setting.defaultValue != null)) return null
            val parsed = runCatching {
                when (setting.kind) {
                    "number" -> {
                        val number = entered.toBigDecimal()
                        require(setting.minimum == null || number >= setting.minimum) {
                            "${setting.label} must be at least ${setting.minimum?.toPlainString()}"
                        }
                        require(setting.maximum == null || number <= setting.maximum) {
                            "${setting.label} must be at most ${setting.maximum?.toPlainString()}"
                        }
                        PortableAgentSettingValue.Decimal(number)
                    }
                    "string-list" -> {
                        val items = entered.split(',').map(String::trim)
                        require(items.isNotEmpty() && items.none(String::isEmpty)) {
                            "${setting.label} must be a comma-separated list of non-empty values"
                        }
                        PortableAgentSettingValue.TextList(
                            items.map { PortableDesignProtocol.normalizePortableSettingText(it, setting.label, minimum = 1) },
                        )
                    }
                    else -> PortableAgentSettingValue.Text(
                        PortableDesignProtocol.normalizePortableSettingText(entered, setting.label, minimum = 1),
                    )
                }
            }
            if (parsed.isSuccess) return parsed.getOrThrow()
            Messages.showErrorDialog(project, safeError(parsed.exceptionOrNull()!!), setting.label)
        }
    }

    private fun formatSettingValue(value: PortableAgentSettingValue): String = when (value) {
        is PortableAgentSettingValue.Text -> value.value
        is PortableAgentSettingValue.Decimal -> value.value.toPlainString()
        is PortableAgentSettingValue.Flag -> value.value.toString()
        is PortableAgentSettingValue.TextList -> value.value.joinToString(", ")
    }

    private fun runRequest(
        label: String,
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
        task: () -> String,
    ) {
        buttons.forEach { it.isEnabled = false }
        status.text = "$label…"
        ApplicationManager.getApplication().executeOnPooledThread {
            runCatching(task)
                .onSuccess { result ->
                    ApplicationManager.getApplication().invokeLater {
                        finishRequest(status, output, buttons, "GAEP engine ready", result)
                    }
                }
                .onFailure { error ->
                    ApplicationManager.getApplication().invokeLater {
                        finishRequest(status, output, buttons, "GAEP request stopped", safeError(error))
                    }
                }
        }
    }

    private fun finishRequest(
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
        statusText: String,
        result: String,
    ) {
        status.text = statusText
        output.text = result
        output.caretPosition = 0
        buttons.forEach { it.isEnabled = true }
    }

    private fun safeError(error: Throwable): String = when (error) {
        is GaepHostException -> error.message ?: "The GAEP engine could not complete the request."
        is IllegalArgumentException -> error.message ?: "The GAEP request input was invalid."
        else -> "The configured local GAEP engine is unavailable. Verify the executable and digest settings, then retry."
    }
}
