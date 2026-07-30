package dev.gaep.rider

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileChooser.FileChooser
import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.ide.CopyPasteManager
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
import java.awt.datatransfer.StringSelection
import java.nio.file.Path
import java.time.Instant
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
private class InitiativeEntryCancelled : RuntimeException()

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

        val initiativeEntryButton = JButton("Inspect Initiative entry…").apply {
            addActionListener { beginInitiativeEntry(project, controller, status, output, buttons, "inspect") }
        }
        buttons += initiativeEntryButton
        actions.add(initiativeEntryButton)

        val classifyInitiativeButton = JButton("Classify Initiative…").apply {
            addActionListener { beginInitiativeEntry(project, controller, status, output, buttons, "classify") }
        }
        buttons += classifyInitiativeButton
        actions.add(classifyInitiativeButton)

        val resolveApplicabilityButton = JButton("Resolve Initiative applicability…").apply {
            addActionListener { beginInitiativeEntry(project, controller, status, output, buttons, "resolve") }
        }
        buttons += resolveApplicabilityButton
        actions.add(resolveApplicabilityButton)

        val sourceGovernanceButton = JButton("Inspect Source governance…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Source bytes, locators, local paths, credentials, and authority are withheld.",
                    "GAEP Source Governance",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Source governance", status, output, buttons) {
                    controller.readSourceGovernance(initiativeId)
                }
            }
        }
        buttons += sourceGovernanceButton
        actions.add(sourceGovernanceButton)

        val businessUnderstandingButton = JButton("Inspect Business Understanding…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Business narrative, personal assignments, Source content, local paths, credentials, and authority are withheld.",
                    "GAEP Business Understanding",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Business Understanding", status, output, buttons) {
                    controller.readBusinessUnderstanding(initiativeId)
                }
            }
        }
        buttons += businessUnderstandingButton
        actions.add(businessUnderstandingButton)

        val businessCapabilityMapButton = JButton("Inspect Business Capability Map…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Capability narrative, personal assignments, Source content, local paths, credentials, and authority are withheld.",
                    "GAEP Business Capability Map",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Business Capability Map", status, output, buttons) {
                    controller.readBusinessCapabilityMap(initiativeId)
                }
            }
        }
        buttons += businessCapabilityMapButton
        actions.add(businessCapabilityMapButton)

        val valueStreamModelButton = JButton("Inspect Value Stream Model…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Value-stream narrative, personal assignments, Source content, local paths, credentials, and authority are withheld.",
                    "GAEP Value Stream Model",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Value Stream Model", status, output, buttons) {
                    controller.readValueStreamModel(initiativeId)
                }
            }
        }
        buttons += valueStreamModelButton
        actions.add(valueStreamModelButton)

        val operatingModelButton = JButton("Inspect Operating Model…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Operating narrative, personal assignments, Source content, local paths, credentials, and authority are withheld.",
                    "GAEP Operating Model",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Operating Model", status, output, buttons) {
                    controller.readOperatingModel(initiativeId)
                }
            }
        }
        buttons += operatingModelButton
        actions.add(operatingModelButton)

        val businessRulesButton = JButton("Inspect Business Rules…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Rule narrative, Source content, personal data, local paths, credentials, and authority are withheld.",
                    "GAEP Business Rules",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Business Rules", status, output, buttons) {
                    controller.readBusinessRuleCatalog(initiativeId)
                }
            }
        }
        buttons += businessRulesButton
        actions.add(businessRulesButton)

        val businessArchitectureBaselineButton = JButton("Inspect Architecture Baseline…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Architecture narrative, Source content, personal data, local paths, credentials, and authority are withheld.",
                    "GAEP Business Architecture Baseline",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Architecture Baseline", status, output, buttons) {
                    controller.readBusinessArchitectureBaseline(initiativeId)
                }
            }
        }
        buttons += businessArchitectureBaselineButton
        actions.add(businessArchitectureBaselineButton)

        val systemSolutionArchitectureButton = JButton("Inspect System/Solution Architecture…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Architecture narrative, Source content, personal data, local paths, credentials, and authority are withheld.",
                    "GAEP System/Solution Architecture",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect System/Solution Architecture", status, output, buttons) {
                    controller.readSystemSolutionArchitecture(initiativeId)
                }
            }
        }
        buttons += systemSolutionArchitectureButton
        actions.add(systemSolutionArchitectureButton)

        val boundedContextModelButton = JButton("Inspect Bounded Context Ownership…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Boundary language, contract narrative, Source content, personal data, local paths, credentials, and authority are withheld.",
                    "GAEP Bounded Context and Ownership",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Bounded Context Ownership", status, output, buttons) {
                    controller.readBoundedContextModel(initiativeId)
                }
            }
        }
        buttons += boundedContextModelButton
        actions.add(boundedContextModelButton)

        val securityPrivacyAssessmentButton = JButton("Inspect Security, Privacy, and Threat Assessment…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Threat scenarios, control and data content, Source content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Security, Privacy, and Threat Assessment",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Security, Privacy, and Threat Assessment", status, output, buttons) {
                    controller.readSecurityPrivacyAssessment(initiativeId)
                }
            }
        }
        buttons += securityPrivacyAssessmentButton
        actions.add(securityPrivacyAssessmentButton)

        val processModelButton = JButton("Inspect Process Model…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Process narrative, transition guards, approval content, Source content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Process Model",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Process Model", status, output, buttons) {
                    controller.readProcessModel(initiativeId)
                }
            }
        }
        buttons += processModelButton
        actions.add(processModelButton)

        val dataModelButton = JButton("Inspect Data Model…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Entity attributes, relationships, lifecycle content, Source content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Data Model",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Data Model", status, output, buttons) {
                    controller.readDataModel(initiativeId)
                }
            }
        }
        buttons += dataModelButton
        actions.add(dataModelButton)

        val authorizationModelButton = JButton("Inspect Authorization Model…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Principal identifiers, role assignments, rules, conditions, approval content, Source content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Authorization Model",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Authorization Model", status, output, buttons) {
                    controller.readAuthorizationModel(initiativeId)
                }
            }
        }
        buttons += authorizationModelButton
        actions.add(authorizationModelButton)

        val eventIntegrationModelButton = JButton("Inspect Event and Integration Model…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Event payloads, command inputs, mapping content, external locators, Source content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Event and Integration Model",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Event and Integration Model", status, output, buttons) {
                    controller.readEventIntegrationModel(initiativeId)
                }
            }
        }
        buttons += eventIntegrationModelButton
        actions.add(eventIntegrationModelButton)

        val failureRecoveryModelButton = JButton("Inspect Failure and Recovery Model…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Failure evidence, operational telemetry, retry keys, compensation content, recovery steps, Source content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Failure and Recovery Model",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Failure and Recovery Model", status, output, buttons) {
                    controller.readFailureRecoveryModel(initiativeId)
                }
            }
        }
        buttons += failureRecoveryModelButton
        actions.add(failureRecoveryModelButton)

        val architectureChallengeButton = JButton("Inspect Architecture Challenge…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Challenge content, assumptions, evidence, findings, responses, Source content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Architecture Challenge",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Architecture Challenge", status, output, buttons) {
                    controller.readArchitectureChallengeModel(initiativeId)
                }
            }
        }
        buttons += architectureChallengeButton
        actions.add(architectureChallengeButton)

        val decisionRegisterButton = JButton("Inspect Decision Register…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Decision questions, options, recommendations, outcomes, rationale, evidence, subject content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Decision Register",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Decision Register", status, output, buttons) {
                    controller.readDecisionRegister(initiativeId)
                }
            }
        }
        buttons += decisionRegisterButton
        actions.add(decisionRegisterButton)

        val riskRegisterButton = JButton("Inspect Risk Register…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Risk statements, assessments, controls, treatments, residual risk, evidence, related-record content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Risk Register",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Risk Register", status, output, buttons) {
                    controller.readRiskRegister(initiativeId)
                }
            }
        }
        buttons += riskRegisterButton
        actions.add(riskRegisterButton)

        val evidenceRegistryButton = JButton("Inspect Evidence Registry…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Claim statements, evidence observations, methods, warrants, quality details, Source content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Evidence Registry",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Evidence Registry", status, output, buttons) {
                    controller.readEvidenceRegistry(initiativeId)
                }
            }
        }
        buttons += evidenceRegistryButton
        actions.add(evidenceRegistryButton)

        val endToEndTraceabilityButton = JButton("Inspect End-to-End Traceability…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Node content, link rationale, transformation detail, Source content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP End-to-End Traceability",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect End-to-End Traceability", status, output, buttons) {
                    controller.readEndToEndTraceability(initiativeId)
                }
            }
        }
        buttons += endToEndTraceabilityButton
        actions.add(endToEndTraceabilityButton)

        val p0P4ReadinessGateButton = JButton("Inspect P0-P4 Readiness Gate…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Output content, criteria, findings, waiver rationale, decision content, Evidence content, Source content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP P0-P4 Readiness Gate",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect P0-P4 Readiness Gate", status, output, buttons) {
                    controller.readP0P4ReadinessGate(initiativeId)
                }
            }
        }
        buttons += p0P4ReadinessGateButton
        actions.add(p0P4ReadinessGateButton)

        val p5HandoffPackageButton = JButton("Inspect P5 Handoff Package…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Item content, summaries, omissions, uncertainties, Source content, personal data, local paths, secrets, credentials, destinations, and authority are withheld.",
                    "GAEP P5 Handoff Package",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect P5 Handoff Package", status, output, buttons) {
                    controller.readP5HandoffPackage(initiativeId)
                }
            }
        }
        buttons += p5HandoffPackageButton
        actions.add(p5HandoffPackageButton)

        val designApplicabilityButton = JButton("Inspect Design Applicability…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Rationales, Source content, journeys, design content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Design Applicability",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Design Applicability", status, output, buttons) {
                    controller.readDesignApplicability(initiativeId)
                }
            }
        }
        buttons += designApplicabilityButton
        actions.add(designApplicabilityButton)

        val designPersonaRoleButton = JButton("Inspect Design Personas and Roles…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Persona content, behaviors, constraints, Source content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Design Personas and Roles",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Design Personas and Roles", status, output, buttons) {
                    controller.readDesignPersonaRoleModel(initiativeId)
                }
            }
        }
        buttons += designPersonaRoleButton
        actions.add(designPersonaRoleButton)

        val userJourneyButton = JButton("Inspect User Journeys…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Journey steps, touchpoints, personas, Source content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP User Journeys",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect User Journeys", status, output, buttons) {
                    controller.readUserJourneyModel(initiativeId)
                }
            }
        }
        buttons += userJourneyButton
        actions.add(userJourneyButton)

        val informationArchitectureButton = JButton("Inspect Information Architecture…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Node, route, content, persona, Source, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Information Architecture",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Information Architecture", status, output, buttons) {
                    controller.readInformationArchitectureModel(initiativeId)
                }
            }
        }
        buttons += informationArchitectureButton
        actions.add(informationArchitectureButton)

        val screenStateInventoryButton = JButton("Inspect Screen and State Inventory…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Platform, screen, state, variant, route, persona, Source, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Screen and State Inventory",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Screen and State Inventory", status, output, buttons) {
                    controller.readScreenStateInventory(initiativeId)
                }
            }
        }
        buttons += screenStateInventoryButton
        actions.add(screenStateInventoryButton)

        val designRequirementsButton = JButton("Inspect Design Requirements…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Requirement, outcome, Work Item, design target, Source, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Design Requirements",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Design Requirements", status, output, buttons) {
                    controller.readDesignRequirements(initiativeId)
                }
            }
        }
        buttons += designRequirementsButton
        actions.add(designRequirementsButton)

        val backlogHierarchyButton = JButton("Inspect Backlog Hierarchy…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Backlog objectives, criteria, scope, owners, Requirement content, personal data, local paths, secrets, credentials, priority, commitment, readiness, assignment, execution, and authority are withheld.",
                    "GAEP Backlog Hierarchy",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Backlog Hierarchy", status, output, buttons) {
                    controller.readBacklogHierarchy(initiativeId)
                }
            }
        }
        buttons += backlogHierarchyButton
        actions.add(backlogHierarchyButton)

        val mvpSliceDefinitionButton = JButton("Inspect MVP and Vertical Slices…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Slice titles, rationales, objectives, criteria, scope content, Requirement content, personal data, local paths, secrets, credentials, priority, commitment, scope approval, readiness, assignment, execution, and authority are withheld.",
                    "GAEP MVP and Vertical Slice Definition",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect MVP and Vertical Slices", status, output, buttons) {
                    controller.readMvpSliceDefinition(initiativeId)
                }
            }
        }
        buttons += mvpSliceDefinitionButton
        actions.add(mvpSliceDefinitionButton)

        val prioritizationModelButton = JButton("Inspect Prioritization Model…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Dimension estimates, evidence identities, uncertainty, slice content, personal data, local paths, secrets, credentials, priority, commitment, approval, readiness, assignment, execution, and authority are withheld.",
                    "GAEP Prioritization Model",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Prioritization Model", status, output, buttons) {
                    controller.readPrioritizationModel(initiativeId)
                }
            }
        }
        buttons += prioritizationModelButton
        actions.add(prioritizationModelButton)

        val acceptanceCriteriaButton = JButton("Inspect Acceptance Criteria…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Criterion text, Requirement identities, verification evidence, personal data, local paths, secrets, credentials, criterion validity, completeness, Requirement satisfaction, priority, commitment, approval, readiness, assignment, execution, acceptance, and authority are withheld.",
                    "GAEP Acceptance Criteria",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Acceptance Criteria", status, output, buttons) {
                    controller.readAcceptanceCriteria(initiativeId)
                }
            }
        }
        buttons += acceptanceCriteriaButton
        actions.add(acceptanceCriteriaButton)

        val definitionOfReadyButton = JButton("Inspect Definition of Ready…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Rules, rationales, evidence and assessor identities, personal data, local paths, secrets, credentials, prerequisite truth, admission, readiness, exception or waiver authority, phase entry, assignment, execution, implementation permission, acceptance, and action authority are withheld.",
                    "GAEP Definition of Ready",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Definition of Ready", status, output, buttons) {
                    controller.readDefinitionOfReady(initiativeId)
                }
            }
        }
        buttons += definitionOfReadyButton
        actions.add(definitionOfReadyButton)

        val definitionOfDoneButton = JButton("Inspect Definition of Done…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Rules, rationales, evidence and assessor identities, personal data, local paths, secrets, credentials, evidence truth, test success, quality, Requirement or Acceptance Criteria satisfaction, approval, ready or done, exception or waiver authority, implementation completeness, merge, release, deployment, assignment, execution, acceptance, and action authority are withheld.",
                    "GAEP Definition of Done",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Definition of Done", status, output, buttons) {
                    controller.readDefinitionOfDone(initiativeId)
                }
            }
        }
        buttons += definitionOfDoneButton
        actions.add(definitionOfDoneButton)

        val implementationUnitModelButton = JButton("Inspect Implementation Unit Model…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Unit titles, boundaries, Story, Task, Requirement, repository, module, owner, evidence, rationale, personal data, local paths, secrets, credentials, repository truth, ownership appointment, dependency or impact completeness, implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, deployment, and action authority are withheld.",
                    "GAEP Implementation Unit Model",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Implementation Unit Model", status, output, buttons) {
                    controller.readImplementationUnitModel(initiativeId)
                }
            }
        }
        buttons += implementationUnitModelButton
        actions.add(implementationUnitModelButton)

        val dependencyMappingButton = JButton("Inspect Dependency Mapping…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Unit, node, edge, evidence, rationale, estimate, owner, repository, module, Requirement, architecture, risk, test, personal data, local paths, secrets, credentials, dependency truth or completeness, critical-path authority, sequencing commitment, ownership appointment, implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, deployment, and action authority are withheld.",
                    "GAEP Dependency Mapping",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Dependency Mapping", status, output, buttons) {
                    controller.readDependencyMapping(initiativeId)
                }
            }
        }
        buttons += dependencyMappingButton
        actions.add(dependencyMappingButton)

        val technologyProfileButton = JButton("Inspect Technology Profile…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Technology names, versions, constraints, evidence, rationale, unit, architecture, repository, toolchain, license and security-policy content, personal data, local paths, secrets, credentials, technology approval, support commitment, compatibility truth or completeness, licensing or security approval, exception or waiver authority, architecture-baseline designation, implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, deployment, and action authority are withheld.",
                    "GAEP Technology Profile",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Technology Profile", status, output, buttons) {
                    controller.readTechnologyProfile(initiativeId)
                }
            }
        }
        buttons += technologyProfileButton
        actions.add(technologyProfileButton)

        val boilerplateRegistryButton = JButton("Inspect Boilerplate Registry…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Boilerplate names, locators, versions, capabilities, limitations, evidence, rationale, technology, unit, architecture, repository, template, license and security-policy content, personal data, local paths, secrets, credentials, organizational designation, endorsement, approval, support commitment, compatibility truth or completeness, licensing or security approval, exception or waiver, selection or binding, architecture baseline, implementation readiness or completeness, assignment, execution, acceptance, merge, release, deployment, and action authority are withheld.",
                    "GAEP Boilerplate Registry",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Boilerplate Registry", status, output, buttons) {
                    controller.readBoilerplateRegistry(initiativeId)
                }
            }
        }
        buttons += boilerplateRegistryButton
        actions.add(boilerplateRegistryButton)

        val designSystemTokenContractButton = JButton("Inspect Design System and Token Contract…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Token values, component content, requirements, Source, design, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Design System and Token Contract",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Design System and Token Contract", status, output, buttons) {
                    controller.readDesignSystemTokenContract(initiativeId)
                }
            }
        }
        buttons += designSystemTokenContractButton
        actions.add(designSystemTokenContractButton)

        val accessibilityDesignRulesButton = JButton("Inspect Accessibility Design Rules…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Rule procedures, evidence, requirements, Source, design, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Accessibility Design Rules",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Accessibility Design Rules", status, output, buttons) {
                    controller.readAccessibilityDesignRules(initiativeId)
                }
            }
        }
        buttons += accessibilityDesignRulesButton
        actions.add(accessibilityDesignRulesButton)

        val responsiveMultiPlatformTargetsButton = JButton("Inspect Responsive and Multi-Platform Targets…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Breakpoint rules, behavior procedures, evidence, requirements, Source, design, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Responsive and Multi-Platform Targets",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Responsive and Multi-Platform Targets", status, output, buttons) {
                    controller.readResponsiveMultiPlatformTargets(initiativeId)
                }
            }
        }
        buttons += responsiveMultiPlatformTargetsButton
        actions.add(responsiveMultiPlatformTargetsButton)

        val manualFigmaExecutionPathButton = JButton("Inspect Manual Figma Execution Path…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Handoff content, instructions, Figma identifiers, returned design, evidence, requirements, Source, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Manual Figma Execution Path",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Manual Figma Execution Path", status, output, buttons) {
                    controller.readManualFigmaExecutionPath(initiativeId)
                }
            }
        }
        buttons += manualFigmaExecutionPathButton
        actions.add(manualFigmaExecutionPathButton)

        val figmaMcpCapabilityDiscoveryButton = JButton("Inspect Figma MCP Capability Discovery…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Tool names, schemas, permissions, limits, versions, Source, Figma content, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Figma MCP Capability Discovery",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Figma MCP Capability Discovery", status, output, buttons) {
                    controller.readFigmaMcpCapabilityDiscovery(initiativeId)
                }
            }
        }
        buttons += figmaMcpCapabilityDiscoveryButton
        actions.add(figmaMcpCapabilityDiscoveryButton)

        val figmaReadSnapshotButton = JButton("Inspect Figma Read Snapshot…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Figma file, component, collection, variable, external identity, value, Source, personal data, local paths, secrets, credentials, permissions, and authority are withheld.",
                    "GAEP Figma Read Snapshot",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Figma Read Snapshot", status, output, buttons) {
                    controller.readFigmaReadSnapshot(initiativeId)
                }
            }
        }
        buttons += figmaReadSnapshotButton
        actions.add(figmaReadSnapshotButton)

        val figmaContextImportButton = JButton("Inspect Figma Context Import…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Brief, Requirement, constraint, Context Item, Figma target, tool, Source, personal data, local paths, secrets, credentials, permissions, and authority are withheld.",
                    "GAEP Figma Context Import",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Figma Context Import", status, output, buttons) {
                    controller.readFigmaContextImport(initiativeId)
                }
            }
        }
        buttons += figmaContextImportButton
        actions.add(figmaContextImportButton)

        val outboundDesignBriefPackageButton = JButton("Inspect Outbound Design Brief Package…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Brief, Requirement, constraint, Context Item, Figma target, tool, Source, transformation, disclosure, personal data, local paths, secrets, credentials, permissions, and authority are withheld.",
                    "GAEP Outbound Design Brief Package",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Outbound Design Brief Package", status, output, buttons) {
                    controller.readOutboundDesignBriefPackage(initiativeId)
                }
            }
        }
        buttons += outboundDesignBriefPackageButton
        actions.add(outboundDesignBriefPackageButton)

        val governedFigmaWriteButton = JButton("Inspect Governed Figma Write…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Brief, Requirement, constraint, Context Item, Figma target, tool, Source, approval actor, permission evidence, recovery detail, personal data, local paths, secrets, credentials, and authority are withheld.",
                    "GAEP Governed Figma Write",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Governed Figma Write", status, output, buttons) {
                    controller.readGovernedFigmaWrite(initiativeId)
                }
            }
        }
        buttons += governedFigmaWriteButton
        actions.add(governedFigmaWriteButton)

        val finalizedFigmaSnapshotImportButton = JButton("Inspect Finalized Figma Snapshot Import…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Figma content, names, external identities, Source content, authorization actors, personal data, local paths, secrets, credentials, permissions, and authority are withheld.",
                    "GAEP Finalized Figma Snapshot Import",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Finalized Figma Snapshot Import", status, output, buttons) {
                    controller.readFinalizedFigmaSnapshotImport(initiativeId)
                }
            }
        }
        buttons += finalizedFigmaSnapshotImportButton
        actions.add(finalizedFigmaSnapshotImportButton)

        val designToRequirementBindingButton = JButton("Inspect Design-to-Requirement Binding…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Figma content, external identities, Requirement text, Decision content, Source content, human attribution, personal data, local paths, secrets, credentials, permissions, and authority are withheld.",
                    "GAEP Design-to-Requirement Binding",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Design-to-Requirement Binding", status, output, buttons) {
                    controller.readDesignToRequirementBinding(initiativeId)
                }
            }
        }
        buttons += designToRequirementBindingButton
        actions.add(designToRequirementBindingButton)

        val designerReadyGateButton = JButton("Inspect Designer-Ready Gate…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Design content, criteria, findings, exception rationale, Decision content, Source content, human attribution, personal data, local paths, secrets, credentials, permissions, and authority are withheld.",
                    "GAEP Designer-Ready Gate",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Designer-Ready Gate", status, output, buttons) {
                    controller.readDesignerReadyGate(initiativeId)
                }
            }
        }
        buttons += designerReadyGateButton
        actions.add(designerReadyGateButton)

        val designDeltaButton = JButton("Inspect Design Delta…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Design and delta content, external identities, evidence, Source content, human attribution, personal data, local paths, secrets, credentials, permissions, and authority are withheld.",
                    "GAEP Design Delta",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Design Delta", status, output, buttons) {
                    controller.readDesignDelta(initiativeId)
                }
            }
        }
        buttons += designDeltaButton
        actions.add(designDeltaButton)

        val designConflictResolutionButton = JButton("Inspect Design Conflict Resolution…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Design, delta, resolution, evidence, Source, human-attribution, personal, local-path, secret, credential, permission, and authority content is withheld.",
                    "GAEP Design Conflict Resolution",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Design Conflict Resolution", status, output, buttons) {
                    controller.readDesignConflictResolution(initiativeId)
                }
            }
        }
        buttons += designConflictResolutionButton
        actions.add(designConflictResolutionButton)

        val humanDesignApprovalButton = JButton("Inspect Human Design Approval…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Design, decision rationale, conditions, evidence, Source, human-attribution, personal, local-path, secret, credential, permission, and authority content is withheld.",
                    "GAEP Human Design Approval",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Human Design Approval", status, output, buttons) {
                    controller.readHumanDesignApproval(initiativeId)
                }
            }
        }
        buttons += humanDesignApprovalButton
        actions.add(humanDesignApprovalButton)

        val designBaselineButton = JButton("Inspect Design Baseline…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Design, rationale, evidence, Source, human-attribution, personal, local-path, secret, credential, permission, and authority content is withheld.",
                    "GAEP Design Baseline",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Design Baseline", status, output, buttons) {
                    controller.readDesignBaseline(initiativeId)
                }
            }
        }
        buttons += designBaselineButton
        actions.add(designBaselineButton)

        val designDriftDetectionButton = JButton("Inspect Design Drift…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Design, Requirement, implementation, Source, human-attribution, personal, local-path, secret, credential, permission, and authority content is withheld.",
                    "GAEP Design Drift Detection",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Inspect Design Drift Detection", status, output, buttons) {
                    controller.readDesignDriftDetection(initiativeId)
                }
            }
        }
        buttons += designDriftDetectionButton
        actions.add(designDriftDetectionButton)

        addAction("Show phase dashboards") { controller.readPhaseDashboard() }

        val phase2UxFigmaButton = JButton("Show Phase 2 UX and Figma dashboard…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Design, Requirement, Figma, Source, human, personal, local-path, secret, credential, permission, and authority content is withheld.",
                    "GAEP Phase 2 UX and Figma Dashboard",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Show Phase 2 UX and Figma dashboard", status, output, buttons) {
                    controller.readPhase2UxFigmaDashboard(initiativeId)
                }
            }
        }
        buttons += phase2UxFigmaButton
        actions.add(phase2UxFigmaButton)

        val phase2IntegratedButton = JButton("Show Phase 2 Change, Impact, Agent and Model dashboard…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Design, Product, Run, provider output, prompts, source bytes, machine paths, credentials, permissions, and authority content is withheld.",
                    "GAEP Phase 2 Change, Impact, Agent and Model Dashboard",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Show Phase 2 Change, Impact, Agent and Model dashboard", status, output, buttons) {
                    controller.readPhase2ChangeImpactAgentModelDashboard(initiativeId)
                }
            }
        }
        buttons += phase2IntegratedButton
        actions.add(phase2IntegratedButton)

        val phase1SummaryButton = JButton("Show Phase 1 summary…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Narrative, findings, evidence content, owners, local paths, credentials, and authority are withheld.",
                    "GAEP Phase 1 Summary",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Show Phase 1 summary", status, output, buttons) {
                    controller.readPhase1Summary(initiativeId)
                }
            }
        }
        buttons += phase1SummaryButton
        actions.add(phase1SummaryButton)

        val phase1ChangeImpactButton = JButton("Show Phase 1 Change and impact…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Narrative, output content, findings, evidence content, owners, local paths, credentials, and authority are withheld.",
                    "GAEP Phase 1 Change and Impact",
                )?.let(UUID::fromString) ?: return@addActionListener
                val changeId = promptManagedUuid(
                    project,
                    "Change ID",
                    "Enter one exact current Change UUID from the governed Change catalog. Selection grants no approval, revalidation, risk acceptance, or effect authority.",
                    "GAEP Phase 1 Change and Impact",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Show Phase 1 Change and impact", status, output, buttons) {
                    controller.readPhase1ChangeImpact(initiativeId, changeId)
                }
            }
        }
        buttons += phase1ChangeImpactButton
        actions.add(phase1ChangeImpactButton)

        val changeImpactButton = JButton("Show Change and impact…").apply {
            addActionListener {
                beginChangeImpact(project, controller, status, output, buttons)
            }
        }
        buttons += changeImpactButton
        actions.add(changeImpactButton)

        addAction("Show Agent and model") { controller.readAgentModel() }

        val phase1AgentModelButton = JButton("Show Phase 1 Agent and model…").apply {
            addActionListener {
                val initiativeId = promptManagedUuid(
                    project,
                    "Initiative ID",
                    "Enter one exact Initiative UUID. Provider output, prompts, Run narrative, evidence content, machine paths, credentials, and authority are withheld.",
                    "GAEP Phase 1 Agent and Model",
                )?.let(UUID::fromString) ?: return@addActionListener
                runRequest("Show Phase 1 Agent and model", status, output, buttons) {
                    controller.readPhase1AgentModel(initiativeId)
                }
            }
        }
        buttons += phase1AgentModelButton
        actions.add(phase1AgentModelButton)

        val accessibleTablesButton = JButton("Browse accessible dashboard tables…").apply {
            addActionListener {
                beginAccessibleDashboardTables(project, controller, status, output, buttons)
            }
        }
        buttons += accessibleTablesButton
        actions.add(accessibleTablesButton)

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
            "Initiative entry boundary: the exact assessment is read-only; classification and applicability require " +
                "explicit human inputs and confirmation. Absence never means not applicable, and no entry action grants " +
                "approval, readiness, or execution authority. " +
            "Source governance boundary: the Initiative-bound view contains bounded Source, candidate Baseline, and " +
                "Provenance metadata only. It exposes no Source bytes, locators, local paths, or credentials and cannot " +
                "designate a Baseline, approve readiness, transfer authority, or authorize action. " +
            "Business Understanding boundary: the Initiative-bound view contains exact governed record identities, " +
                "revisions, digests, states, counts, and assessment status only. It exposes no business narrative, personal " +
                "assignments, Source content, locators, local paths, or credentials and cannot approve, appoint, decide, " +
                "designate readiness, or authorize action. " +
            "Change/Impact boundary: selection and projection are exact, audit-gated, read-only metadata views; " +
                "they cannot approve a Change, accept a Risk, mutate records, or authorize effects. " +
            "Agent boundary: Codex and Claude readiness is observation-only; guarded selection and versioned handoff record portable configuration and history only. " +
                "They cannot start or resume a provider, create a Run, approve tools or effects, or grant execution authority. " +
                "Managed read-only execution is a separate digest-bound command: every Tool permission remains denied, only observation is allowed, " +
                "and provider completion is reported separately from the governed outcome. " +
                "Managed Run evidence is an audit-gated, snapshot-bounded read-only view of portable counts and digests; " +
                "it cannot start, resume, cancel, apply, discard, approve, or infer outcome success. " +
                "Accessible dashboard tables use native keyboard dialogs and this screen-reader named result area to sort and filter " +
                "only already-verified metadata, then optionally copy only visible rows as formula-neutralized CSV. They write no file. " +
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
    private fun beginInitiativeEntry(
        project: Project,
        controller: RiderProductController,
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
        operation: String,
    ) {
        val initiativeId = promptManagedUuid(
            project,
            "Initiative ID",
            "Enter one exact Initiative UUID. Narrative, evidence content, owners, local paths and credentials remain withheld.",
            "GAEP Initiative Entry",
        )?.let(UUID::fromString) ?: return
        buttons.forEach { it.isEnabled = false }
        status.text = "Loading exact Initiative entry assessment…"
        ApplicationManager.getApplication().executeOnPooledThread {
            runCatching { controller.readInitiativeEntryContext(initiativeId) }
                .onSuccess { context ->
                    ApplicationManager.getApplication().invokeLater {
                        val current = controller.renderInitiativeEntry(context)
                        output.text = current
                        output.caretPosition = 0
                        if (operation == "inspect") {
                            finishRequest(status, output, buttons, "GAEP Initiative entry assessment ready", current)
                            return@invokeLater
                        }
                        if (operation == "resolve" && context.assessment.classification.status != "current") {
                            finishRequest(
                                status,
                                output,
                                buttons,
                                "GAEP Initiative applicability stopped",
                                "$current\n\nRecord a classification bound to the current Product revision before resolving applicability.",
                            )
                            return@invokeLater
                        }
                        val actorId = runCatching {
                            PortableDesignProtocol.normalizeActorId(
                                System.getenv("GAEP_ACTOR_ID") ?: "gaep.rider-local-human",
                            )
                        }.getOrElse { error ->
                            finishRequest(status, output, buttons, "GAEP request stopped", safeError(error))
                            return@invokeLater
                        }
                        val draft = runCatching {
                            if (operation == "classify") {
                                promptInitiativeClassification(project).also {
                                    PortableDesignProtocol.initiativeClassificationInputToJson(it)
                                }
                            } else {
                                promptInitiativeApplicability(project, actorId).also {
                                    PortableDesignProtocol.initiativeApplicabilityInputToJson(it)
                                }
                            }
                        }.getOrElse { error ->
                            if (error is InitiativeEntryCancelled) {
                                finishRequest(
                                    status,
                                    output,
                                    buttons,
                                    "GAEP Initiative entry unchanged",
                                    "$current\n\nThe entry workflow was cancelled. No classification or applicability request was sent.",
                                )
                            } else {
                                finishRequest(status, output, buttons, "GAEP Initiative entry stopped", safeError(error))
                            }
                            return@invokeLater
                        }
                        val classification = draft as? InitiativeClassificationInput
                        val applicability = draft as? InitiativeApplicabilityMatrixInput
                        val summary = if (classification != null) {
                            "Record ${classification.primaryType} classification with " +
                                "${classification.secondaryTypes.size} secondary type(s), " +
                                "${classification.evidence.size} evidence reference(s), and " +
                                "${classification.unresolvedQuestions.size} unresolved question(s)? " +
                                "Classification guides profile selection only and grants no approval or action authority."
                        } else {
                            val matrix = applicability ?: throw IllegalArgumentException("Initiative applicability input is missing")
                            "Record ${matrix.decisions.size} explicit applicability decision(s) and " +
                                "${matrix.unresolvedSubjects.size} unresolved subject(s)? Absence is never treated as not applicable, " +
                                "and this matrix grants no approval, readiness, or action authority."
                        }
                        val decision = Messages.showYesNoDialog(
                            project,
                            summary,
                            if (classification != null) "Record Exact Initiative Classification" else "Record Exact Applicability Matrix",
                            if (classification != null) "Record Exact Classification" else "Record Exact Applicability Matrix",
                            "Cancel Without Changes",
                            Messages.getWarningIcon(),
                        )
                        if (decision != Messages.YES) {
                            finishRequest(
                                status,
                                output,
                                buttons,
                                "GAEP Initiative entry unchanged",
                                "$current\n\nFinal confirmation was cancelled. No classification or applicability request was sent.",
                            )
                            return@invokeLater
                        }
                        status.text = if (classification != null) {
                            "Recording exact Initiative classification…"
                        } else {
                            "Recording exact Initiative applicability matrix…"
                        }
                        ApplicationManager.getApplication().executeOnPooledThread {
                            runCatching {
                                if (classification != null) {
                                    controller.classifyInitiative(context, classification, actorId)
                                } else {
                                    controller.resolveInitiativeApplicability(context, applicability!!, actorId)
                                }
                            }.onSuccess { rendered ->
                                ApplicationManager.getApplication().invokeLater {
                                    finishRequest(status, output, buttons, "GAEP Initiative entry updated and revalidated", rendered)
                                }
                            }.onFailure { error ->
                                ApplicationManager.getApplication().invokeLater {
                                    finishRequest(status, output, buttons, "GAEP Initiative entry stopped", safeError(error))
                                }
                            }
                        }
                    }
                }
                .onFailure { error ->
                    ApplicationManager.getApplication().invokeLater {
                        finishRequest(status, output, buttons, "GAEP Initiative entry stopped", safeError(error))
                    }
                }
        }
    }

    private fun promptInitiativeClassification(project: Project): InitiativeClassificationInput {
        val initiativeTypes = listOf(
            "product", "platform", "product-increment", "feature", "epic", "backlog-item", "service", "module",
            "client-application", "mobile-application", "api", "integration", "migration", "modernization", "refactoring",
            "technical-debt-remediation", "security-remediation", "infrastructure", "devops", "observability", "library",
            "sdk", "cli", "worker", "event-processor", "defect-fix", "experiment", "research", "data-capability",
            "ai-capability",
        )
        val primaryType = entryChoice(project, "Primary Initiative type", initiativeTypes)
        val secondaryTypes = entryClosedList(
            project,
            "Secondary Initiative types",
            initiativeTypes.filterNot(primaryType::equals),
            required = false,
        )
        var sensitivities: List<String>
        while (true) {
            val selected = entryClosedList(
                project,
                "Sensitivities",
                listOf("security", "privacy", "data", "safety", "financial", "operational", "none", "unknown"),
                required = true,
            )
            if ("none" !in selected || selected.size == 1) {
                sensitivities = selected
                break
            }
            Messages.showErrorDialog(project, "Sensitivity 'none' cannot be combined with another value.", "Sensitivities")
        }
        return InitiativeClassificationInput(
            primaryType = primaryType,
            secondaryTypes = secondaryTypes,
            systemState = entryChoice(project, "System state", listOf("greenfield", "brownfield", "mixed", "unknown")),
            changePosture = entryChoice(
                project,
                "Change posture",
                listOf("new", "existing", "replacement", "modernization", "migration", "retirement", "mixed"),
            ),
            motivations = entryClosedList(
                project,
                "Motivations",
                listOf("business-driven", "technical", "regulatory", "operational", "security-driven", "mixed"),
                required = true,
            ),
            characteristics = InitiativeClassificationCharacteristics(
                userInterface = entryChoice(project, "User-interface characteristic", listOf("ui-bearing", "non-ui", "unknown")),
                data = entryChoice(project, "Data characteristic", listOf("data-bearing", "stateless", "unknown")),
                integration = entryChoice(
                    project,
                    "Integration characteristic",
                    listOf("integration-heavy", "isolated", "mixed", "unknown"),
                ),
                interactionModes = entryClosedList(
                    project,
                    "Interaction modes",
                    listOf("synchronous", "asynchronous", "batch", "streaming", "interactive", "mixed"),
                    required = true,
                ),
                exposure = entryChoice(project, "Exposure", listOf("internal", "partner", "public", "mixed", "unknown")),
            ),
            regulated = entryChoice(project, "Is this Initiative regulated?", listOf("yes", "no")) == "yes",
            policyDomains = entryIdentifierList(project, "Policy domains, separated by commas. Leave blank when none.", false),
            sensitivities = sensitivities,
            expectedLifetime = entryChoice(
                project,
                "Expected lifetime",
                listOf("short-lived", "medium-term", "long-lived", "indefinite", "unknown"),
            ),
            maintenanceHorizon = entryText(project, "Maintenance horizon", true),
            risk = InitiativeClassificationRisk(
                blastRadius = entryChoice(project, "Risk: blast radius", listOf("localized", "multi-unit", "organization", "external", "unknown")),
                reversibility = entryChoice(
                    project,
                    "Risk: reversibility",
                    listOf("reversible", "partially-reversible", "irreversible", "unknown"),
                ),
                urgency = entryChoice(project, "Risk: urgency", listOf("low", "normal", "high", "critical", "unknown")),
                costOfFailure = entryChoice(project, "Risk: cost of failure", listOf("low", "medium", "high", "critical", "unknown")),
            ),
            dependencies = entryTextList(project, "Dependencies, separated by commas. Leave blank when none.", false),
            affectedAssets = entryTextList(project, "Affected assets, separated by commas. Leave blank when none.", false),
            owner = entryText(project, "Initiative classification owner", true),
            accountableAuthority = entryText(project, "Accountable human authority", true),
            confidence = InitiativeClassificationConfidence(
                level = entryChoice(project, "Classification confidence", listOf("low", "medium", "high")),
                basis = entryText(project, "Evidence-based confidence rationale", true),
            ),
            evidence = listOf(
                InitiativeEntrySource(
                    entryChoice(
                        project,
                        "Primary classification evidence kind",
                        listOf("rule", "policy", "evidence", "requirement", "dependency", "human-decision"),
                    ),
                    entryText(project, "Primary classification evidence reference", true),
                ),
            ),
            unresolvedQuestions = entryTextList(
                project,
                "Unresolved classification questions, separated by commas. Leave blank when none.",
                false,
            ),
            rationale = entryText(project, "Classification rationale", true, minimum = 10, maximum = 10_000),
        )
    }

    private fun promptInitiativeApplicability(
        project: Project,
        actorId: String,
    ): InitiativeApplicabilityMatrixInput {
        val decisions = mutableListOf<InitiativeApplicabilityDecisionInput>()
        do {
            val index = decisions.size + 1
            val subject = promptInitiativeSubject(project, "Decision $index")
            val status = entryChoice(
                project,
                "Decision $index status",
                listOf(
                    "required", "recommended", "optional", "not-applicable", "deferred", "conditionally-required",
                    "already-satisfied", "reused", "blocked", "awaiting-human-decision",
                ),
            )
            val approvalState = if (status == "awaiting-human-decision") {
                "pending"
            } else {
                entryChoice(project, "Decision $index approval state", listOf("not-required", "pending", "approved", "rejected"))
            }
            val conditionRequired = status in setOf("deferred", "conditionally-required", "blocked")
            val relatedRecords = if (status in setOf("already-satisfied", "reused")) {
                listOf(
                    InitiativeRelatedRecord(
                        recordType = entryIdentifier(project, "Decision $index related record type"),
                        recordId = entryUuid(project, "Decision $index related record UUID"),
                        revision = entryRevision(project, "Decision $index related record revision"),
                        digest = entryDigest(project, "Decision $index related record SHA-256 digest"),
                    ),
                )
            } else {
                emptyList()
            }
            decisions += InitiativeApplicabilityDecisionInput(
                subject = subject,
                status = status,
                rationale = entryText(project, "Decision $index rationale", true, minimum = 10, maximum = 10_000),
                sources = listOf(
                    InitiativeEntrySource(
                        entryChoice(
                            project,
                            "Decision $index primary source kind",
                            listOf("rule", "policy", "evidence", "requirement", "dependency", "human-decision"),
                        ),
                        entryText(project, "Decision $index primary source reference", true),
                    ),
                ),
                owner = entryText(project, "Decision $index owner", true),
                accountableApprover = if (approvalState != "not-required" || status == "awaiting-human-decision") {
                    entryText(project, "Decision $index accountable approver", true)
                } else {
                    null
                },
                dependencies = entryIdentifierList(
                    project,
                    "Decision $index dependency keys, separated by commas. Leave blank when none.",
                    false,
                ),
                conditions = entryTextList(
                    project,
                    "Decision $index conditions, separated by commas." + if (conditionRequired) " At least one is required." else " Leave blank when none.",
                    conditionRequired,
                ),
                reviewTriggers = entryTextList(
                    project,
                    "Decision $index review triggers, separated by commas.",
                    true,
                ),
                approval = InitiativeApplicabilityApproval(
                    state = approvalState,
                    conditions = entryTextList(
                        project,
                        "Decision $index approval conditions, separated by commas. Leave blank when none.",
                        false,
                    ),
                    decidedBy = if (approvalState in setOf("approved", "rejected")) actorId else null,
                    decidedAt = if (approvalState in setOf("approved", "rejected")) Instant.now() else null,
                ),
                relatedRecords = relatedRecords,
                relatedImplementationUnits = entryIdentifierList(
                    project,
                    "Decision $index related implementation-unit keys, separated by commas. Leave blank when none.",
                    false,
                ),
            )
        } while (
            Messages.showYesNoDialog(
                project,
                "Add another explicit applicability decision? Absence is not treated as not applicable.",
                "Initiative Applicability Matrix",
                "Add Another Decision",
                "Continue to Unresolved Subjects",
                Messages.getQuestionIcon(),
            ) == Messages.YES
        )
        val unresolved = mutableListOf<InitiativeUnresolvedSubject>()
        while (
            Messages.showYesNoDialog(
                project,
                "Record an explicitly unresolved applicability subject?",
                "Initiative Applicability Matrix",
                "Add Unresolved Subject",
                "Finish Matrix",
                Messages.getQuestionIcon(),
            ) == Messages.YES
        ) {
            val index = unresolved.size + 1
            unresolved += InitiativeUnresolvedSubject(
                subject = promptInitiativeSubject(project, "Unresolved subject $index"),
                reason = entryText(project, "Unresolved subject $index reason", true),
                owner = entryText(project, "Unresolved subject $index owner", true),
            )
        }
        return PortableDesignProtocol.completeInitiativeApplicabilityCoverage(
            InitiativeApplicabilityMatrixInput(decisions, unresolved),
            actorId,
        )
    }

    private fun promptInitiativeSubject(project: Project, prefix: String) = InitiativeApplicabilitySubject(
        type = entryChoice(
            project,
            "$prefix subject type",
            listOf("phase", "activity", "artifact", "capability", "test-method", "test-level", "approval", "evidence-obligation"),
        ),
        key = entryIdentifier(project, "$prefix stable subject key"),
        label = entryText(project, "$prefix human-readable subject label", true),
    )

    @Suppress("DEPRECATION")
    private fun entryChoice(project: Project, title: String, options: List<String>): String {
        val selected = Messages.showChooseDialog(
            project,
            "Choose one exact value.",
            title,
            Messages.getQuestionIcon(),
            options.toTypedArray(),
            options.first(),
        )
        return options.getOrNull(selected) ?: throw InitiativeEntryCancelled()
    }

    private fun entryClosedList(
        project: Project,
        title: String,
        options: List<String>,
        required: Boolean,
    ): List<String> {
        while (true) {
            val entered = Messages.showInputDialog(
                project,
                "Enter comma-separated values from: ${options.joinToString()}." + if (required) " At least one is required." else " Leave blank when none.",
                title,
                Messages.getQuestionIcon(),
            ) ?: throw InitiativeEntryCancelled()
            val values = entered.split(',').map(String::trim).filter(String::isNotEmpty).distinct()
            if ((!required || values.isNotEmpty()) && values.all(options::contains)) return values
            Messages.showErrorDialog(project, "Use only the listed exact values${if (required) " and select at least one" else ""}.", title)
        }
    }

    private fun entryText(
        project: Project,
        prompt: String,
        required: Boolean,
        minimum: Int = 2,
        maximum: Int = 2_000,
    ): String {
        while (true) {
            val entered = Messages.showInputDialog(project, prompt, "GAEP Initiative Entry", Messages.getQuestionIcon())
                ?: throw InitiativeEntryCancelled()
            if (!required && entered.isBlank()) return ""
            val normalized = runCatching {
                PortableDesignProtocol.normalizeHandoffText(entered, prompt, minimum, maximum)
            }
            if (normalized.isSuccess) return normalized.getOrThrow()
            Messages.showErrorDialog(project, safeError(normalized.exceptionOrNull()!!), "GAEP Initiative Entry")
        }
    }

    private fun entryTextList(project: Project, prompt: String, required: Boolean): List<String> {
        while (true) {
            val entered = entryText(project, prompt, required, minimum = if (required) 2 else 0, maximum = 10_000)
            if (entered.isEmpty()) return emptyList()
            val values = entered.split(',').map(String::trim).filter(String::isNotEmpty).distinct()
            val validated = runCatching {
                require(!required || values.isNotEmpty())
                PortableDesignProtocol.normalizeHandoffTextList(values, prompt)
            }
            if (validated.isSuccess) return validated.getOrThrow()
            Messages.showErrorDialog(project, safeError(validated.exceptionOrNull()!!), "GAEP Initiative Entry")
        }
    }

    private fun entryIdentifierList(project: Project, prompt: String, required: Boolean): List<String> {
        while (true) {
            val values = entryTextList(project, prompt, required)
            if (values.all { it.matches(Regex("^[a-z][a-z0-9.-]{0,127}$")) }) return values
            Messages.showErrorDialog(
                project,
                "Identifiers must start with a lower-case letter and contain only lower-case letters, numbers, dots, or hyphens.",
                "GAEP Initiative Entry",
            )
        }
    }

    private fun entryIdentifier(project: Project, prompt: String): String = entryIdentifierList(project, prompt, true).singleOrNull()
        ?: throw IllegalArgumentException("$prompt requires one exact identifier without commas.")

    private fun entryUuid(project: Project, prompt: String): UUID {
        while (true) {
            val value = entryText(project, prompt, true, minimum = 36, maximum = 36)
            val parsed = runCatching { UUID.fromString(value).also { require(it != UUID(0, 0)) } }
            if (parsed.isSuccess) return parsed.getOrThrow()
            Messages.showErrorDialog(project, "$prompt must be a non-empty UUID.", "GAEP Initiative Entry")
        }
    }

    private fun entryRevision(project: Project, prompt: String): Long {
        while (true) {
            val value = entryText(project, prompt, true, minimum = 1, maximum = 16)
            val parsed = value.toLongOrNull()
            if (parsed != null && parsed in 1..PortableDesignProtocol.MAX_SAFE_PRODUCT_REVISION) return parsed
            Messages.showErrorDialog(project, "$prompt must be a positive protocol-safe integer.", "GAEP Initiative Entry")
        }
    }

    private fun entryDigest(project: Project, prompt: String): String {
        while (true) {
            val value = entryText(project, prompt, true, minimum = 71, maximum = 71).lowercase()
            if (value.matches(Regex("^sha256:[0-9a-f]{64}$"))) return value
            Messages.showErrorDialog(project, "$prompt must use sha256 followed by 64 lower-case hexadecimal characters.", "GAEP Initiative Entry")
        }
    }

    @Suppress("DEPRECATION")
    private fun beginAccessibleDashboardTables(
        project: Project,
        controller: RiderProductController,
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
    ) {
        val groups = arrayOf(
            "Phase dashboard tables — exact phase-panel metadata",
            "Change and impact tables — exact Work Item, artifact, effect, trace, Decision, and Risk metadata",
            "Agent and model tables — exact capability, selection, Run, handoff, and unavailable-metric metadata",
        )
        val selectedGroup = Messages.showChooseDialog(
            project,
            "Select one accessible dashboard table group. All rows remain read-only verified metadata.",
            "Browse Accessible GAEP Dashboard Tables",
            Messages.getQuestionIcon(),
            groups,
            groups.first(),
        )
        if (selectedGroup < 0) return
        buttons.forEach { it.isEnabled = false }
        when (selectedGroup) {
            0 -> loadAccessibleTables(
                status,
                output,
                buttons,
                project,
                "Loading exact Phase dashboard tables…",
                controller::readPhaseDashboardTables,
            )
            1 -> beginAccessibleChangeImpactTables(project, controller, status, output, buttons)
            2 -> loadAccessibleTables(
                status,
                output,
                buttons,
                project,
                "Loading exact Agent/Model dashboard tables…",
                controller::readAgentModelTables,
            )
            else -> finishRequest(
                status,
                output,
                buttons,
                "GAEP request stopped",
                "Select one verified accessible dashboard table group.",
            )
        }
    }

    private fun loadAccessibleTables(
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
        project: Project,
        loadingStatus: String,
        task: () -> List<AccessibleMetadataTable>,
    ) {
        status.text = loadingStatus
        ApplicationManager.getApplication().executeOnPooledThread {
            runCatching(task)
                .onSuccess { tables ->
                    ApplicationManager.getApplication().invokeLater {
                        promptAccessibleTable(project, tables, status, output, buttons)
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
    private fun beginAccessibleChangeImpactTables(
        project: Project,
        controller: RiderProductController,
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
    ) {
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
                                "No current Change metadata is available for accessible Change/Impact tables.",
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
                                "${context.catalog.omitted} omitted). Table selection grants no approval or effect authority.",
                            "Browse Accessible Change/Impact Tables",
                            Messages.getQuestionIcon(),
                            labels,
                            labels.first(),
                        )
                        val change = context.catalog.items.getOrNull(selected)
                        if (change == null) {
                            finishRequest(
                                status,
                                output,
                                buttons,
                                "GAEP accessible table selection cancelled",
                                "No table was opened, nothing was copied, and no authority was granted.",
                            )
                            return@invokeLater
                        }
                        loadAccessibleTables(
                            status,
                            output,
                            buttons,
                            project,
                            "Loading exact Change/Impact dashboard tables…",
                        ) { controller.readChangeImpactTables(context, change) }
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
    private fun promptAccessibleTable(
        project: Project,
        tables: List<AccessibleMetadataTable>,
        status: JBLabel,
        output: JTextArea,
        buttons: List<JButton>,
    ) {
        if (tables.isEmpty()) {
            finishRequest(status, output, buttons, "GAEP accessible tables unavailable", "No verified table was returned.")
            return
        }
        val tableLabels = tables.map { table ->
            "${table.title} — ${table.rows.size} verified row${if (table.rows.size == 1) "" else "s"}; " +
                "${table.omitted} omitted upstream"
        }.toTypedArray()
        val selectedTableIndex = Messages.showChooseDialog(
            project,
            "Select one accessible metadata table. Sorting and filtering use only its already-visible columns.",
            "Select Accessible Metadata Table",
            Messages.getQuestionIcon(),
            tableLabels,
            tableLabels.first(),
        )
        val table = tables.getOrNull(selectedTableIndex)
        if (table == null) {
            finishRequest(
                status,
                output,
                buttons,
                "GAEP accessible table selection cancelled",
                "No table was opened, nothing was copied, and no authority was granted.",
            )
            return
        }
        val sortLabels = (listOf("Keep verified source order") + table.columns.map { "Sort by ${it.label}" }).toTypedArray()
        val selectedSort = Messages.showChooseDialog(
            project,
            "Choose a visible column for deterministic text sorting with row-ID tie breaking.",
            "Sort ${table.title}",
            Messages.getQuestionIcon(),
            sortLabels,
            sortLabels.first(),
        )
        if (selectedSort < 0) {
            finishRequest(
                status,
                output,
                buttons,
                "GAEP accessible table selection cancelled",
                "No table was opened, nothing was copied, and no authority was granted.",
            )
            return
        }
        val sortKey = if (selectedSort == 0) null else table.columns.getOrNull(selectedSort - 1)?.key
            ?: throw IllegalArgumentException("Select one visible table column.")
        val direction = if (sortKey == null) {
            null
        } else {
            val directions = arrayOf("Ascending — A to Z", "Descending — Z to A")
            when (
                Messages.showChooseDialog(
                    project,
                    "Choose the deterministic sort direction.",
                    "Sort ${table.title}",
                    Messages.getQuestionIcon(),
                    directions,
                    directions.first(),
                )
            ) {
                0 -> AccessibleTableSortDirection.ASCENDING
                1 -> AccessibleTableSortDirection.DESCENDING
                else -> {
                    finishRequest(
                        status,
                        output,
                        buttons,
                        "GAEP accessible table selection cancelled",
                        "No table was opened, nothing was copied, and no authority was granted.",
                    )
                    return
                }
            }
        }
        val filter = promptAccessibleFilter(project, table.title) ?: run {
            finishRequest(
                status,
                output,
                buttons,
                "GAEP accessible table selection cancelled",
                "No table was opened, nothing was copied, and no authority was granted.",
            )
            return
        }
        val view = AccessibleDashboardTables.view(table, filter, sortKey, direction)
        output.text = AccessibleDashboardTables.render(view)
        output.caretPosition = 0
        status.text = "${table.title}: showing ${view.rows.size} of ${table.rows.size} verified rows"
        buttons.forEach { it.isEnabled = true }
        if (view.rows.isEmpty()) return
        val copy = Messages.showYesNoDialog(
            project,
            "Copy ${view.rows.size} visible metadata row${if (view.rows.size == 1) "" else "s"} and only " +
                "the visible columns as formula-neutralized CSV? No file will be written.",
            "Copy Visible Rows as CSV",
            "Copy Visible Rows as CSV",
            "Finish Without Copying",
            Messages.getQuestionIcon(),
        )
        if (copy != Messages.YES) return
        CopyPasteManager.getInstance().setContents(StringSelection(AccessibleDashboardTables.csv(view)))
        status.text = "${table.title}: copied ${view.rows.size} visible metadata row${if (view.rows.size == 1) "" else "s"} as CSV"
    }

    private fun promptAccessibleFilter(project: Project, title: String): String? {
        while (true) {
            val filter = Messages.showInputDialog(
                project,
                "Optionally match up to 256 characters against only the visible verified metadata columns. " +
                    "Leave empty to show every verified row.",
                "Filter $title",
                Messages.getQuestionIcon(),
            ) ?: return null
            if (filter.length <= 256) return filter
            Messages.showErrorDialog(project, "Use at most 256 characters.", "Filter $title")
        }
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
