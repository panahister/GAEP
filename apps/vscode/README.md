# GAEP for VS Code

GAEP turns a workspace into a governed Product repository and lets the user select an installed AI coding agent, model, and agent-specific settings before executing a bounded Initiative.

## First workflow

1. Open the GAEP activity-bar view.
2. Run `Initialize Product` and answer the product-direction questions.
3. Select Manual, Codex, or Claude Code, then choose an advertised model and adapter-specific settings. Manual uses a machine-local managed-in-process identity; Codex and Claude use verified machine-local executable fingerprints.
4. Create a bounded Initiative, then explicitly activate it when it is ready for execution.
5. Inspect the selected boundary in Product Studio. Phase 2 ends at selection and binding readiness: managed Run launch remains blocked until Phase 3 host wiring and verification are complete.

GAEP writes portable records under `.gaep`. It does not read or copy credentials from Codex, Claude Code, VS Code, or another extension.

## Product Studio

`GAEP: Open Product Studio` opens the code-native twelve-section Product design surface. It can start or resume the local design draft, save exact sections with optimistic revision checks and local-actor provenance, evaluate bounded design readiness, and create attributable Product/design revisions. Design readiness never implies implementation approval.

Delivery, scope, architecture, risks and decisions, agents and tools, runs and evidence, trace, and readiness expose live governed records rather than inferred file relationships. Changes, Work Items, Requirements, Decisions, Risks, Architecture records, Evidence, Context Packs, Workflow Plans, Tool Definitions, Run Tool Selections, and Trace links have create/edit or reassessment workflows in both Product Studio and the Command Palette. The native structured editor uses labeled fields, lists, and typed nested values; users do not need to edit repository JSON by hand. A rejected validation attempt remains resumable in extension memory, except secret-shaped input, which is rejected and discarded.

Tables and searches are bounded to 200 displayed records and explicitly report the full observed count when truncated. Portable views exclude machine-local executable paths and managed runtime identities; only the labeled runtime inspector may show a local binding. Export uses a same-location temporary file and atomic rename, while import is preview-only and performs no mutation. Export, import preview, trace impact, and workspace health preserve their claim boundaries and display unresolved engine health issues rather than treating structural success as approval.

Portable agent capabilities and selections do not contain executable paths or in-process runtime identities. VS Code keeps the selected machine-local binding in global state. Product Studio discriminates executable fingerprints from managed-in-process runtime identities and exposes either only in its explicitly labeled machine-local runtime inspector. An integrity-era v1 path-bearing selection is never trusted automatically: `GAEP: Review and Normalize Legacy Agent Selection` verifies its exact historical selection/capability binding, re-probes the same agent, preserves its exact model and every still-current valid setting, shows the server-derived normalization, and retires only the closed set of obsolete v1 controls after explicit acceptance. Migration is fail-closed when a retained setting is no longer valid, an unknown legacy setting exists, the historical binding differs, or any Charter, Run, Handoff, or managed execution artifact depends on the selection. The earlier agent-ID filename era predates checkpoint and governed-state integrity; it is quarantined for a dedicated reviewed repository bootstrap, and selection migration never synthesizes trusted state for it.

The extension requires a trusted VS Code workspace before it probes an executable, changes Product state, recovers a run, or starts an agent. In a multi-root workspace, select the folder that owns the Product with `GAEP: Select Product Root`. Agent executable paths are machine-scoped User Settings; repository and workspace overrides are ignored.

The supported selection boundaries are deliberately different. Manual is deterministic, offline, and managed in process. Codex is bound for isolated staged work whose source-workspace application requires exact review. Claude is bound for tool-free, context-only analysis from a fresh empty working directory. Selection and binding grant no Tool, effect, execution, approval, or application authority. Phase 3 must wire and verify those managed Run paths before the host enables launch.

Only active Initiatives can prepare runs. Proposed and blocked Initiatives explain the transition needed before execution; completed and cancelled Initiatives remain terminal. Agent/model changes after a run use a reviewed handoff that atomically records both the handoff and new selection, so a partial switch cannot be presented as complete.

Managed Charters remain separate from Agent Selection. The exact Workflow, Context Packs, Tools, permissions, effects, stop conditions, and evidence obligations must be resolved and confirmed before a managed Run can start. Manual and Claude context-only modes expose no Tools or workspace writes. Codex changes remain isolated until an exact staged inventory is reviewed and separately accepted for application.

Provider-native controls are inputs to the technical boundary, not substitutes for GAEP approval or authorization records. GAEP must refuse a managed Run when the selected adapter, machine-local binding, Workflow, Context, Tool inventory, or effect envelope cannot be revalidated exactly.

Provider processes receive a reduced environment. Common secret-bearing environment variables are not inherited; the installed CLI remains responsible for using its own authorized credential store.

GAEP fingerprints executable-backed adapters at selection and records the Manual runtime identity without introducing a fake path. Launch-time revalidation, process tracking, cancellation, staged review, and exact application remain Phase 3 host obligations and are not claimed complete by the Phase 2 selection UI.
