import { lstat, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(fileURLToPath(import.meta.url))
const output = join(root, "Gaep.VisualStudio", "bin", "Release", "net8.0-windows8.0")
const generated = join(root, "Gaep.VisualStudio", "obj", "Release", "net8.0-windows8.0")
const remoteUiSource = join(root, "Gaep.VisualStudio", "GaepToolWindowControl.xaml")

async function regularFile(path, maximumBytes) {
  const metadata = await lstat(path)
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 || metadata.size > maximumBytes) {
    throw new Error(`Visual Studio shell output is unsafe or outside its size bound: ${path}`)
  }
  return metadata
}

function requireText(value, pattern, message) {
  if (!pattern.test(value)) throw new Error(message)
}

await regularFile(join(output, "Gaep.VisualStudio.dll"), 16 * 1024 * 1024)
await regularFile(join(output, "Gaep.HostClient.dll"), 16 * 1024 * 1024)
await regularFile(join(generated, "extension.vsixmanifest"), 1024 * 1024)
await regularFile(join(generated, "extension.json"), 1024 * 1024)
await regularFile(remoteUiSource, 1024 * 1024)

const manifest = await readFile(join(generated, "extension.vsixmanifest"), "utf8")
requireText(manifest, /Id="Gaep\.VisualStudio\.90e45161-916c-4c39-b2bf-c2379c168fe9"/u, "Visual Studio extension ID changed")
requireText(manifest, /Version="0\.1\.0\.0"/u, "Visual Studio extension version changed")
requireText(manifest, /ExtensionType="VisualStudio\.Extensibility"/u, "Visual Studio extension is not out of process")
requireText(manifest, /Version="\[17\.14,\)"/u, "Visual Studio minimum host version changed")
for (const architecture of ["amd64", "arm64"]) {
  requireText(manifest, new RegExp(`<ProductArchitecture>${architecture}</ProductArchitecture>`, "u"),
    `Visual Studio ${architecture} package target is missing`)
}

const contributions = JSON.parse(await readFile(join(generated, "extension.json"), "utf8"))
if (!Array.isArray(contributions.toolWindows) || contributions.toolWindows.length !== 1 ||
    contributions.toolWindows[0]?.identifier !== "Gaep.VisualStudio.GaepToolWindow") {
  throw new Error("Visual Studio GAEP tool-window contribution is missing or ambiguous")
}
const commands = contributions.commandSets?.flatMap((set) => set.commands ?? []) ?? []
if (commands.length !== 1 || commands[0]?.name !== "Gaep.VisualStudio.OpenGaepToolWindowCommand" ||
    commands[0]?.displayName !== "%Gaep.OpenProductStudio.DisplayName%") {
  throw new Error("Visual Studio GAEP command contribution is missing or ambiguous")
}
if (!Array.isArray(contributions.services) || contributions.services.length !== 2 ||
    contributions.services.some((service) => service.host !== "dotnetExtensibility" || service.allowHostingInProcess !== false)) {
  throw new Error("Visual Studio GAEP services are not exclusively out of process")
}

const remoteUi = await readFile(remoteUiSource, "utf8")
for (const binding of [
  "WorkspacePath",
  "BundleId",
  "BundlePath",
  "RefreshProductCommand",
  "InitiativeId",
  "LoadInitiativeEntryCommand",
  "LoadSourceGovernanceCommand",
  "LoadBusinessUnderstandingCommand",
  "LoadBusinessCapabilityMapCommand",
  "LoadValueStreamModelCommand",
  "LoadOperatingModelCommand",
  "LoadBusinessRulesCommand",
  "LoadArchitectureChallengeModelCommand",
  "LoadDecisionRegisterCommand",
  "InitiativeTypes",
  "InitiativeClassification",
  "ClassifyInitiativeCommand",
  "InitiativeSubjectTypes",
  "InitiativeApplicabilityStatuses",
  "InitiativeApprovalStates",
  "InitiativeDecision",
  "AddInitiativeDecisionCommand",
  "InitiativeUnresolved",
  "AddInitiativeUnresolvedCommand",
  "InitiativeDraftSummary",
  "ClearInitiativeDraftCommand",
  "ResolveInitiativeApplicabilityCommand",
  "ShowPhaseDashboardCommand",
  "LoadChangeImpactCommand",
  "ShowChangeImpactCommand",
  "ShowAgentModelCommand",
  "AccessibleDashboardGroups",
  "SelectedAccessibleDashboardGroup",
  "LoadAccessibleTablesCommand",
  "AvailableAccessibleTables",
  "SelectedAccessibleTable",
  "AvailableAccessibleSortColumns",
  "SelectedAccessibleSortColumn",
  "AccessibleSortDirections",
  "SelectedAccessibleSortDirection",
  "AccessibleFilter",
  "RenderAccessibleTableCommand",
  "AccessibleCsv",
  "AvailableChangeChoices",
  "SelectedChangeChoice",
  "RefreshAgentReadinessCommand",
  "LoadAgentSelectionCommand",
  "SelectAgentCommand",
  "LoadAgentHandoffCommand",
  "CreateAgentHandoffCommand",
  "AvailableAgentChoices",
  "SelectedAgentChoice",
  "AvailableModelIds",
  "SelectedModelId",
  "AgentSettingInputs",
  "HandoffReason",
  "HandoffCompletedWork",
  "HandoffUnresolvedMatters",
  "HandoffDecisions",
  "HandoffEvidence",
  "ManagedCharterId",
  "ManagedWorkflowPlanId",
  "LoadManagedReadOnlyPreviewCommand",
  "ExecuteManagedReadOnlyCommand",
  "ManagedRunId",
  "ListManagedEvidenceCommand",
  "PreviousManagedEvidencePageCommand",
  "NextManagedEvidencePageCommand",
  "ReadManagedEvidenceCommand",
  "ManagedReviewRunId",
  "LoadManagedReviewCommand",
  "ApplyManagedReviewCommand",
  "DiscardManagedReviewCommand",
  "ListDesignImportsCommand",
  "ReadDesignImportCommand",
  "ImportDesignBundleCommand",
  "Status",
  "Output",
  "Busy",
]) {
  requireText(remoteUi, new RegExp(`\\{Binding ${binding}(?:[.,}])`, "u"),
    `Visual Studio Product workflow binding is missing: ${binding}`)
}
requireText(remoteUi, /Import local bundle as pending review/u,
  "Visual Studio import action does not communicate its pending-review boundary")
requireText(remoteUi, /Show Phase 0\/1A dashboards/u,
  "Visual Studio Product Studio does not expose the explicit phase-dashboard projection")
requireText(remoteUi, /Load exact Initiative entry/u,
  "Visual Studio Product Studio does not expose exact Initiative entry assessment")
requireText(remoteUi, /Inspect Source governance/u,
  "Visual Studio Product Studio does not expose exact Source governance")
requireText(remoteUi, /Inspect governed Business Understanding/u,
  "Visual Studio Product Studio does not expose governed Business Understanding")
requireText(remoteUi, /Inspect governed Architecture Challenge/u,
  "Visual Studio Product Studio does not expose governed Architecture Challenge")
requireText(remoteUi, /does not complete independent review, establish assurance, accept risk, approve architecture, establish readiness, or authorize action/u,
  "Visual Studio Architecture Challenge action does not communicate its no-authority boundary")
requireText(remoteUi, /Inspect governed Decision Register/u,
  "Visual Studio Product Studio does not expose governed Decision Register")
requireText(remoteUi, /does not establish decision effectiveness, approval, risk acceptance, baseline promotion, readiness, or action authority/u,
  "Visual Studio Decision Register action does not communicate its no-authority boundary")
requireText(remoteUi, /Classify or reclassify exact Initiative/u,
  "Visual Studio Product Studio does not expose governed Initiative classification")
requireText(remoteUi, /Resolve or re-resolve exact applicability/u,
  "Visual Studio Product Studio does not expose governed Initiative applicability")
requireText(remoteUi, /absence never means not applicable/u,
  "Visual Studio Initiative entry workflow does not preserve the explicit applicability boundary")
requireText(remoteUi, /Show exact Change and impact/u,
  "Visual Studio Product Studio does not expose exact Change and impact projection")
requireText(remoteUi, /Show exact Agent and model/u,
  "Visual Studio Product Studio does not expose exact Agent and model projection")
requireText(remoteUi, /Load exact accessible dashboard tables/u,
  "Visual Studio Product Studio does not expose exact accessible dashboard tables")
requireText(remoteUi, /Render accessible table and prepare visible CSV/u,
  "Visual Studio Product Studio does not expose accessible table filtering and CSV preparation")
requireText(remoteUi, /Copy visible rows as CSV/u,
  "Visual Studio Product Studio does not expose native visible-row CSV copy")
requireText(remoteUi, /ApplicationCommands\.Copy/u,
  "Visual Studio visible-row CSV copy is not confined to the native Remote UI text control")
requireText(remoteUi, /cannot select or switch an agent, create a handoff, launch a Run, authorize effects, establish readiness, or invent provider usage or cost/u,
  "Visual Studio Agent and model action does not communicate its no-authority and unavailable-metric boundary")
requireText(remoteUi, /Selection grants no Change approval, Risk acceptance, mutation, Run, Tool, write, or effect authority/u,
  "Visual Studio Change and impact action does not communicate its no-authority boundary")
requireText(remoteUi, /Confirm guarded selection/u,
  "Visual Studio selection action does not communicate its guarded confirmation boundary")
requireText(remoteUi, /Create versioned handoff/u,
  "Visual Studio handoff action does not communicate its versioned-record boundary")
requireText(remoteUi, /Load first Managed Run evidence page/u,
  "Visual Studio evidence dashboard does not expose bounded Managed Run inventory")
requireText(remoteUi, /Previous verified evidence page/u,
  "Visual Studio evidence dashboard does not expose previous-page navigation")
requireText(remoteUi, /Next verified evidence page/u,
  "Visual Studio evidence dashboard does not expose next-page navigation")
requireText(remoteUi, /Read Managed Run evidence/u,
  "Visual Studio evidence dashboard does not expose exact evidence detail")
requireText(remoteUi, /Apply exact reviewed inventory/u,
  "Visual Studio staged review does not expose exact apply")
requireText(remoteUi, /Discard exact staged review/u,
  "Visual Studio staged review does not expose exact discard")
requireText(remoteUi, /two cancel-default confirmations/u,
  "Visual Studio staged review does not communicate its two-confirmation boundary")

if (process.platform === "win32") {
  await regularFile(join(output, "Gaep.VisualStudio.vsix"), 128 * 1024 * 1024)
  process.stdout.write("GAEP Visual Studio native VSIX container verification: PASS\n")
} else {
  process.stdout.write("GAEP Visual Studio shell compile and generated-contribution verification: PASS\n")
  process.stdout.write("Native VSIX container and installation: UNVERIFIED because VsixUtil.exe requires Windows.\n")
}
