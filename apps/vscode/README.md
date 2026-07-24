# GAEP for VS Code

GAEP turns a workspace into a governed Product repository and lets the user select an installed AI coding agent, model, and agent-specific settings before executing a bounded Initiative.

## First workflow

1. Open the GAEP activity-bar view.
2. Run `Initialize Product` and answer the product-direction questions.
3. Select a detected executable agent, model, and safe settings. Codex supports isolated staged execution; Claude Code supports only the tool-free, context-only managed mode.
4. Create a bounded Initiative, then explicitly activate it when it is ready for execution.
5. Create and resolve an exact Workflow Plan with sufficient Context Packs and any enabled Tool Definitions needed by the run.
6. Run `Create Managed Charter and Start Run`, review the exact Workflow, Context, Tool, effect, and scope bindings, then confirm the Charter and process launch separately.
7. Explicitly assess each natural-language Workflow gate. For Codex changes, open the exact staged inventory and choose apply, discard, or keep pending; provider completion never self-asserts Product outcome completion.

GAEP writes portable records under `.gaep`. It does not read or copy credentials from Codex, Claude Code, VS Code, or another extension.

## Product Studio

`GAEP: Open Product Studio` opens the code-native twelve-section Product design surface. It can start or resume the local design draft, save exact sections with optimistic revision checks and local-actor provenance, evaluate bounded design readiness, and create attributable Product/design revisions. Design readiness never implies implementation approval.

Delivery, scope, architecture, risks and decisions, agents and tools, runs and evidence, trace, and readiness expose live governed records rather than inferred file relationships. Changes, Work Items, Requirements, Decisions, Risks, Architecture records, Evidence, Context Packs, Workflow Plans, Tool Definitions, Run Tool Selections, and Trace links have create/edit or reassessment workflows in both Product Studio and the Command Palette. The native structured editor uses labeled fields, lists, and typed nested values; users do not need to edit repository JSON by hand. A rejected validation attempt remains resumable in extension memory, except secret-shaped input, which is rejected and discarded.

Tables and searches are bounded to 200 displayed records and explicitly report the full observed count when truncated. Portable views exclude machine-local executable paths; only the labeled runtime inspector may show a local binding. Export uses a same-location temporary file and atomic rename, while import is preview-only and performs no mutation. Export, import preview, trace impact, and workspace health preserve their claim boundaries and display unresolved engine health issues rather than treating structural success as approval.

Portable agent capabilities and selections do not contain executable paths. VS Code keeps the verified executable fingerprint only in machine-local global state and exposes its path only in Product Studio's explicitly labeled machine-local runtime inspector. A legacy path-bearing selection is never trusted automatically: `GAEP: Reconfirm and Migrate Legacy Agent Selection` re-probes the same agent and requires explicit reconfirmation before the engine writes the portable replacement.

The extension requires a trusted VS Code workspace before it probes an executable, changes Product state, recovers a run, or starts an agent. In a multi-root workspace, select the folder that owns the Product with `GAEP: Select Product Root`. Agent executable paths are machine-scoped User Settings; repository and workspace overrides are ignored.

The separate launch confirmation is mandatory. Managed Codex runs execute in an isolated staging workspace; only exact intrinsic shell and workspace-write Tool bindings can be compiled, and every source-workspace change waits for an inventory-bound human apply decision. Managed Claude runs use a fresh tool-free, context-only directory with no workspace access, MCP, settings, browser, slash commands, or resume. Unsupported permissions and effects fail closed.

Only active Initiatives can prepare runs. Proposed and blocked Initiatives explain the transition needed before execution; completed and cancelled Initiatives remain terminal. Agent/model changes after a run use a reviewed handoff that atomically records both the handoff and new selection, so a partial switch cannot be presented as complete.

Managed Charters exactly bind the resolved Workflow Plan, Context Packs, Tool Definitions, requested effects, and portable workspace scopes. Tool presence does not grant authority: any Tool selection is recorded separately, high-impact Tools require explicit human confirmation, and commit, push, deploy, publish, external communication, spend, privilege change, and destructive actions remain denied by the VS Code compiler.

Agent-native permissions and the isolated stage are technical control boundaries; they do not substitute for GAEP approval or authorization records. Natural-language preconditions, outputs, evidence criteria, and stop conditions require an explicit human assessment and are never treated as machine-proven. The current review surface exposes the complete path/kind/digest/size/mode inventory but not staged file contents; durable restart recovery can discard a retained stage, while exact apply and provider resume currently require the same engine session.

Provider processes receive a reduced environment. Common secret-bearing environment variables are not inherited; the installed CLI remains responsible for using its own authorized credential store.

GAEP fingerprints the exact executable at selection and again immediately before launch. It tracks each provider process it starts; Product-root changes wait for confirmed process exit, configuration changes are deferred while a run is active, and extension deactivation attempts graceful termination followed by force escalation before unloading.

The VSIX bundles the GAEP engine implementation into the extension process; it does not resolve a separate engine from `PATH`. The exact installed-package lifecycle test activates only the installed `0.1.0` VSIX, runs its audit-gated bounded recovery/evidence inventory against an empty isolated workspace, requires the exact private-safe empty result, and proves that Product Studio and this read-only engine workflow create no `.gaep` state. This is one local package workflow, not real-provider acceptance, supported-OS certification, publisher provenance/signing, Product readiness, or release approval.
