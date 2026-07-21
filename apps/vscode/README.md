# GAEP for VS Code

GAEP turns a workspace into a governed Product repository and lets the user select an installed AI coding agent, model, and agent-specific settings before executing a bounded Initiative.

## First workflow

1. Open the GAEP activity-bar view.
2. Run `Initialize Product` and answer the product-direction questions.
3. Select a detected executable agent, model, and safe settings. Claude Code is currently detection-only until GAEP can enforce an outer execution boundary.
4. Create a bounded Initiative, then explicitly activate it when it is ready for execution.
5. Run `Create Charter and Start Run` and review the observe-only profile.
6. Review and confirm the charter, including its explicit workspace-root local-command allowance, then confirm the agent-process launch.

GAEP writes portable records under `.gaep`. It does not read or copy credentials from Codex, Claude Code, VS Code, or another extension.

Portable agent capabilities and selections do not contain executable paths. VS Code keeps the verified executable fingerprint only in machine-local global state and exposes its path only in Product Studio's explicitly labeled machine-local runtime inspector. A legacy path-bearing selection is never trusted automatically: `GAEP: Reconfirm and Migrate Legacy Agent Selection` re-probes the same agent and requires explicit reconfirmation before the engine writes the portable replacement.

The extension requires a trusted VS Code workspace before it probes an executable, changes Product state, recovers a run, or starts an agent. In a multi-root workspace, select the folder that owns the Product with `GAEP: Select Product Root`. Agent executable paths are machine-scoped User Settings; repository and workspace overrides are ignored.

The separate launch confirmation is mandatory. Direct Codex execution is restricted to its read-only, network-disabled sandbox with the provider's `never` approval mode, so writes and unavailable escalation prompts fail closed. `workspace-write`, `danger-full-access`, and direct live-search enablement are not selectable through this host. Claude Code can be inspected but cannot launch until a managed outer workspace, process, network, and per-call effect boundary exists.

Only active Initiatives can prepare runs. Proposed and blocked Initiatives explain the transition needed before execution; completed and cancelled Initiatives remain terminal. Agent/model changes after a run use a reviewed handoff that atomically records both the handoff and new selection, so a partial switch cannot be presented as complete.

CLI Charters contain no per-command `ask` mode because the current non-interactive transport has no GAEP approval callback. The supplied profile uses the portable `.` workspace-root scope for workspace analysis and local commands inside Codex's read-only sandbox. It denies all workspace modification, network access, and high-impact actions such as commit, push, deploy, publish, spend, privilege change, and deletion.

Agent-native permissions are the technical control boundary for direct execution. They do not substitute for GAEP approval or authorization records. GAEP refuses direct execution when that boundary cannot enforce the effective profile; effectful work will use an isolated staging workspace and controlled apply path rather than advisory denials.

Provider processes receive a reduced environment. Common secret-bearing environment variables are not inherited; the installed CLI remains responsible for using its own authorized credential store.

GAEP fingerprints the exact executable at selection and again immediately before launch. It tracks each provider process it starts; Product-root changes wait for confirmed process exit, configuration changes are deferred while a run is active, and extension deactivation attempts graceful termination followed by force escalation before unloading.
