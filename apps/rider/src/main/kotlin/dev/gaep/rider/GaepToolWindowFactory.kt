package dev.gaep.rider

import com.intellij.openapi.application.ApplicationManager
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
        val client = GaepEngineClient(java.nio.file.Path.of(workspace))
        val status = JBLabel("GAEP engine has not been contacted")
        val output = JTextArea().apply {
            isEditable = false
            lineWrap = true
            wrapStyleWord = true
            border = JBUI.Borders.empty(8)
        }
        val actions = JPanel().apply {
            add(JButton("Check engine").apply {
                addActionListener { request(client, "ping", status, output) }
            })
            add(JButton("Detect agents").apply {
                addActionListener { request(client, "probeAgents", status, output) }
            })
            add(JButton("Read Product").apply {
                addActionListener { request(client, "readProduct", status, output) }
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

    private fun request(client: GaepEngineClient, method: String, status: JBLabel, output: JTextArea) {
        status.text = "Running $method..."
        ApplicationManager.getApplication().executeOnPooledThread {
            runCatching { client.request(method) }
                .onSuccess { response ->
                    ApplicationManager.getApplication().invokeLater {
                        status.text = "GAEP engine ready"
                        output.text = response
                    }
                }
                .onFailure { error ->
                    ApplicationManager.getApplication().invokeLater {
                        status.text = "GAEP engine unavailable"
                        output.text = error.message ?: error.javaClass.simpleName
                    }
                }
        }
    }
}
