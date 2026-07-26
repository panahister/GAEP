package dev.gaep.rider

import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.extensions.PluginId
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
import java.util.concurrent.atomic.AtomicReference
import javax.swing.JButton
import javax.swing.JPanel
import javax.swing.JTextArea

/**
 * GAEP-P0-CS02 — Rider Tool Window: read-only provider/model dashboard driven over the packaged
 * Engine Host protocol v3. It resolves the INSTALLED plugin path (so the digest-verified linux-x64
 * SEA is launched), keeps ONE persistent client per Product root, and drives REAL selection: the
 * provider and model are chosen from the live providerCatalog (never hardcoded), and the analysis
 * runs against one or more governed Context Pack IDs the user supplies. Request construction and
 * validation live in the pure {@link GaepRequests} (unit-tested).
 */
class GaepToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val workspace = project.basePath
        if (workspace == null) {
            Messages.showErrorDialog(project, "Open a project before using GAEP.", "GAEP")
            return
        }
        val pluginPath = PluginManagerCore.getPlugin(PluginId.getId("dev.gaep.platform"))?.pluginPath
        if (pluginPath == null) {
            Messages.showErrorDialog(project, "The installed GAEP plugin path could not be resolved.", "GAEP")
            return
        }
        val client = GaepEngineClient(java.nio.file.Path.of(workspace), pluginPath)
        val lastRunId = AtomicReference<String?>(null)

        val status = JBLabel("GAEP engine has not been contacted")
        val output = JTextArea().apply {
            isEditable = false
            lineWrap = true
            wrapStyleWord = true
            border = JBUI.Borders.empty(8)
        }
        val actions = JPanel().apply {
            add(JButton("Dashboard").apply {
                addActionListener { run(client, status, output, lastRunId) { it.request("dashboardProjection") } }
            })
            add(JButton("Provider catalog").apply {
                addActionListener { run(client, status, output, lastRunId) { it.request("providerCatalog") } }
            })
            add(JButton("Select provider / model…").apply {
                addActionListener { selectProviderModel(project, client, status, output, lastRunId) }
            })
            add(JButton("Start analysis…").apply {
                addActionListener { startAnalysis(project, client, status, output, lastRunId) }
            })
            add(JButton("Refresh run").apply {
                addActionListener {
                    val runId = lastRunId.get() ?: return@addActionListener showNeedsRun(status)
                    run(client, status, output, lastRunId) { it.request("readAnalysisRun", GaepRequests.runScopedParams(runId)) }
                }
            })
            add(JButton("Cancel run").apply {
                addActionListener {
                    val runId = lastRunId.get() ?: return@addActionListener showNeedsRun(status)
                    run(client, status, output, lastRunId) { it.request("cancelAnalysisRun", GaepRequests.runScopedParams(runId)) }
                }
            })
        }
        val panel = JBPanel<JBPanel<*>>(BorderLayout()).apply {
            border = JBUI.Borders.empty(8)
            add(status, BorderLayout.NORTH)
            add(JBScrollPane(output), BorderLayout.CENTER)
            add(actions, BorderLayout.SOUTH)
        }
        val content = ContentFactory.getInstance().createContent(panel, "Product", false)
        content.setDisposer(client)
        toolWindow.contentManager.addContent(content)
    }

    private fun showNeedsRun(status: JBLabel) { status.text = "Start an analysis first" }

    /** Choose a provider then a model from the live catalog (never hardcoded), then select it. */
    private fun selectProviderModel(project: Project, client: GaepEngineClient, status: JBLabel, output: JTextArea, lastRunId: AtomicReference<String?>) {
        status.text = "Loading provider catalog..."
        ApplicationManager.getApplication().executeOnPooledThread {
            val catalog = runCatching { client.request("providerCatalog") }.getOrElse { error ->
                ApplicationManager.getApplication().invokeLater { status.text = "GAEP engine unavailable"; output.text = error.message ?: "unavailable" }
                return@executeOnPooledThread
            }
            val providers = GaepRequests.parseProviderIds(catalog)
            ApplicationManager.getApplication().invokeLater {
                if (providers.isEmpty()) { status.text = "No providers detected"; return@invokeLater }
                val adapterId = Messages.showEditableChooseDialog("Select a provider", "GAEP Provider", null, providers.toTypedArray(), providers.first(), null)
                    ?: return@invokeLater
                val models = GaepRequests.parseModelIds(catalog, adapterId)
                if (models.isEmpty()) { status.text = "The selected provider exposes no models"; return@invokeLater }
                val modelId = Messages.showEditableChooseDialog("Select a model", "GAEP Model", null, models.toTypedArray(), models.first(), null)
                    ?: return@invokeLater
                run(client, status, output, lastRunId) { it.request("selectProviderModel", GaepRequests.selectProviderModelParams(adapterId, modelId)) }
            }
        }
    }

    /** Gather one or more governed Context Pack IDs + an objective, then start the analysis. */
    private fun startAnalysis(project: Project, client: GaepEngineClient, status: JBLabel, output: JTextArea, lastRunId: AtomicReference<String?>) {
        val idsInput = Messages.showInputDialog(project, "Governed Context Pack IDs (comma-separated)", "GAEP Analysis", null) ?: return
        val objective = Messages.showInputDialog(project, "Analysis objective", "GAEP Analysis", null) ?: return
        val ids = idsInput.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        val params = try {
            GaepRequests.startAnalysisParams(objective, ids)
        } catch (error: IllegalArgumentException) {
            status.text = error.message ?: "Invalid analysis request"
            return
        }
        run(client, status, output, lastRunId) { it.request("startReadOnlyAnalysis", params) }
    }

    private fun run(client: GaepEngineClient, status: JBLabel, output: JTextArea, lastRunId: AtomicReference<String?>, call: (GaepEngineClient) -> String) {
        status.text = "Running..."
        ApplicationManager.getApplication().executeOnPooledThread {
            runCatching { call(client) }
                .onSuccess { response ->
                    GaepRequests.extractRunId(response)?.let { lastRunId.set(it) }
                    ApplicationManager.getApplication().invokeLater { status.text = "GAEP engine ready"; output.text = response }
                }
                .onFailure { error ->
                    ApplicationManager.getApplication().invokeLater { status.text = "GAEP engine unavailable"; output.text = error.message ?: error.javaClass.simpleName }
                }
        }
    }
}
