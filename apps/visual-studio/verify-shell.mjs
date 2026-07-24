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
  requireText(remoteUi, new RegExp(`\\{Binding ${binding}(?:[,}])`, "u"),
    `Visual Studio Product workflow binding is missing: ${binding}`)
}
requireText(remoteUi, /Import local bundle as pending review/u,
  "Visual Studio import action does not communicate its pending-review boundary")
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
