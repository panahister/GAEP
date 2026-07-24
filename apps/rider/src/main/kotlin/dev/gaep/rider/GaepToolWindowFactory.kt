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
import javax.swing.JButton
import javax.swing.JPanel
import javax.swing.JTextArea

class GaepToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val workspace = project.basePath
        if (workspace == null) {
            Messages.showErrorDialog(project, "Open a project before using GAEP.", "GAEP")
            return
        }
        val client = GaepEngineClient(Path.of(workspace))
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
                        status.text = "GAEP engine ready"
                        output.text = result
                        output.caretPosition = 0
                        buttons.forEach { it.isEnabled = true }
                    }
                }
                .onFailure { error ->
                    ApplicationManager.getApplication().invokeLater {
                        status.text = "GAEP request stopped"
                        output.text = safeError(error)
                        output.caretPosition = 0
                        buttons.forEach { it.isEnabled = true }
                    }
                }
        }
    }

    private fun safeError(error: Throwable): String = when (error) {
        is GaepHostException -> error.message ?: "The GAEP engine could not complete the request."
        is IllegalArgumentException -> error.message ?: "The GAEP request input was invalid."
        else -> "The configured local GAEP engine is unavailable. Verify the executable and digest settings, then retry."
    }
}
