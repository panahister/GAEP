# GAEP Phase 0 Pre-Implementation Change Report — GAEP-P0-CS02

| Field | Value |
|---|---|
| **Report ID** | GAEP-P0-CS02 |
| **Roadmap phase** | Phase 0 (internal milestone Phase 1A — Four-IDE Platform Foundation) |
| **Change Set ID** | GAEP-P0-CS02 |
| **Scope (Feature IDs audited)** | PLT-01, PLT-03…PLT-11, PLT-14…PLT-16, PLT-18…PLT-21, PLT-24, PLT-26, PLT-27, PLT-29, PLT-31…PLT-35 (PLT-28 regression only — already `✅ Done`) |
| **Status** | In Implementation |
| **Product Owner approval** | 2026-07-24 — `APPROVE GAEP-P0-CS02 EXACTLY AS PROPOSED` |
| **Revision** | R3 |
| **Date** | 2026-07-24 |
| **Author** | Claude Code |
| **Supersedes / Superseded by** | — |

### Revision history

| Revision | Date | Change |
|---|---|---|
| R5 | 2026-07-26 | Defect-correction pass (no scope change, no new report); Status remains **In Implementation**. Corrects the R4 claim of "a realistic example that runs a real bounded analysis": the R4 example in fact bypassed protocol v3 (direct `GaepEngine` + `readOnlyAnalysis.start()`, fabricated context) and finished `provider-error`. Now the example drives the full v3 RPC vertical slice (real Product + governed Context Pack → providerCatalog → selectProviderModel → startReadOnlyAnalysis → poll readAnalysisRun) and its `--verify` exits non-zero on `provider-error`/`internal`/`protocol-error`/`timeout`/`source-mutation`. Also: real Codex read-only dispatch with staging cleanup + integration test; cancel/timeout now snapshot the full workspace before finalizing (post-abort writes fail closed as `source-mutation`); atomic Engine Host lock with an ownership nonce + persistent VS Code client per Product root; diagnosed the Claude `provider-error` as a misclassified auth failure now surfaced and classified `auth-unavailable`; real Node 22.11.0 archive/executable digests + download-verify lane + SEA workflows + schema-valid build-only evidence; Rider compile fix + real v3 actions and a real VisualStudio.Extensibility Tool Window/command/RemoteUI (native compilation external-lane blocked: JDK 21 / Windows + VS 2022). PLT-03 remains `🟡 In Progress`; no Feature is `✅ Done`. |
| R1 | 2026-07-24 | Initial CS02 Stage A contract. |
| R3 | 2026-07-24 | Consistency-only correction (no scope change): unified the **auth model** so `auth-unverified` never blocks the first explicit attempt (state model, INV-07, AC-35 aligned); corrected the **governed mutation allowlist** to the real portable paths and moved the Engine Host PID/lock to a **machine-local, digest-keyed location outside `.gaep`**; made `truthClass`/alias **server-derived** (removed from the `selectProviderModel` request, new INV-31, `MODEL_NOT_PERMITTED`); froze **`sourceTreeDigest` as the sole equivalence/staleness identity** with `baseCommit`/`dirty` as provenance-only, and expanded the canonical input set to every artifact-producing file; froze the **complete SEA build procedure** (blob → pinned+checksum-verified Node → copy → `postject` injection → macOS signature removal/ad-hoc re-sign → final digest → package) and **reduced the CS02 platform matrix to lanes that actually produce a SEA** (VS `win32-x64`, Rider `linux-x64` only); replaced the flat 13-field claim with the **exact discriminated manifest union** (11 common; built = 13; not-built = 14); and fixed stale paths, the single `ProviderCatalogService` name, build-only AC-18/AC-19, AC-21 built-only verification, and the AC-28…AC-41 environment split. |
| R4 | 2026-07-24 | Stage B implemented and the current handoff's defects corrected in place (no new report): real protocol-v3 VS Code commands (provider/model Quick Picks, run/poll/cancel), durable `ReadOnlyAnalysisService` (persisted `.gaep/runs`+`.gaep/evidence`, restart reload, orphan reconcile, service-boundary timeout), `host-conformance` composition consumed by `dashboardProjection`, `ProviderCatalogService.selectProviderModel()` delegating to `selectAgent`, `supportedHostProtocolVersionSchema` includes v3, staged VSIX packaging that embeds the digest-verified Engine Host with a passing extracted-package v3 smoke test, `release --verify` recomputes digests and `sourceTreeDigest`, and a realistic example that runs a real bounded analysis and proves no source mutation. Recorded the Product Owner approval, set Status to `Implemented — Ready for Test`, and removed the live approval marker. PLT-03 remains `🟡 In Progress` pending Product-Owner install/upgrade/uninstall/workflow evidence. No Feature is `✅ Done`. |
| R3 | 2026-07-24 | Consistency-only correction (see prior revision note). |
| R2 | 2026-07-24 | Corrections applied in one revision: froze **Engine Host packaging, platform matrix, bootstrap, digest verification, and no-PATH-fallback rule** (§4.1) and routed VS Code through the same RPC boundary; preserved **one selection source of truth** at `.gaep/runtime/selection.json` (`agentSelectionSchema` v2, no new file, no migration) with provenance via existing audit/handoff records (§4.2); added the **complete v3 request/response and long-running execution contract** incl. concurrency, idempotency, races, orphan recovery, and sanitized error kinds (§4.3); froze **one bounded Context Pack** for both providers, corrected the **authentication catch-22** and the **provider-network** statement (§4.4); planned the **parameterized evidence verifier with a strict CS01/C1 compatibility wrapper**, fixed the manifest field count to **13**, enumerated hashed files, and removed manifest self-reference (§4.5); replaced the impossible `sourceRevision === HEAD` rule with a **non-self-referential `sourceIdentity`** (§4.6); made artifact truth a **discriminated built/not-built state** and every tracker transition **conditional on evidence produced in Stage B** — only PLT-03 may reach `🧪 Ready for Test` (§4.7, §11); and aligned the **Visual Studio out-of-process `VisualStudio.Extensibility` model** with the existing README plus four host READMEs and a root install guide (§4.8). Status remains `Awaiting Approval`. |

> **Stage A is read-only.** Creating this report and its Register row is allowed; do not modify source, config, dependencies, lockfiles, generated acceptance artifacts, or the delivery tracker before explicit Product Owner approval of the exact Change Set ID.

> **One-pass standard.** This report is the complete implementation and acceptance contract, not a discussion draft. Every discoverable ambiguity is resolved below. `N/A — reason` is used where a field does not apply.

## 1. Executive Summary

**Verified current condition.** GAEP-P0-CS01 + C1 delivered a host-neutral Platform Readiness snapshot, an engine-host v2 `platformReadiness` endpoint, the conformance/evidence machinery, and one accepted VS Code surface (PLT-28 `✅ Done`). The platform is still **single-host and read-only-about-itself**: the engine-host exposes 19 methods but **no provider execution**; `packages/engine/src/managed-execution.ts` holds a full `ManagedExecutionService`, yet it is unreachable over RPC, and `apps/vscode/src/run-terminal.ts:102` spawns provider processes **inside the VS Code host**. Visual Studio is a `net8.0` class library with no VSIX project; Rider is a Kotlin scaffold with a Gradle wrapper; Kiro has no package at all. A user cannot yet select a provider, select a model, or run an analysis in any IDE.

**Smallest coherent vertical increment.** CS02 delivers the **first usable provider/model vertical slice distributed to all four IDE hosts**: engine-host **protocol v3** exposes provider catalog, selection, and a bounded **read-only analysis** owned by the shared engine; four version-aligned installable artifacts at **0.2.0**; a host-neutral dashboard projection; and digest-verified acceptance evidence.

**Why this must precede later work.** Effectful execution (CS03+) cannot be governed until provider execution has a single shared owner, selection provenance is portable, and each host has an installable artifact with real conformance evidence. Doing this after effectful work would bake the VS Code-only execution fork into the platform.

**Expected outcome.** The Product Owner installs the artifact for an available IDE, opens the GAEP surface, sees Platform Readiness on an uninitialized workspace with a friendly "Initialize Product first" state, initializes the example Product, probes Codex/Claude Code, selects a provider + model, runs one bounded read-only analysis, and inspects a truthful result with provenance and freshness — with machine-verifiable digests.

**What will remain incomplete.** Codex is not installed on this host, so every Codex-execution row stays `not-run`. Visual Studio requires Windows, Rider requires a JDK, and Kiro is not installed, so those hosts remain `not-run`/`pending-environment` until their external lanes actually execute and their evidence is imported. Because a build is not an installation and an installation is not a workflow, **only PLT-03 can reach `🧪 Ready for Test` in this change set**; every other audited Feature stays `🟡 In Progress`. No effectful execution, preview/apply, Figma, or publication is included.

### Acceptance summary

Every row is **conditional on evidence actually produced during Stage B**. Where the required environment does not execute, the row's maximum status is `🟡 In Progress` and its host observation stays `not-run`/`pending-environment`.

| Outcome | Acceptance evidence | Maximum tracker status |
|---|---|---|
| Shared read-only provider execution over engine-host v3 | v3 protocol + read-only enforcement suites; executed Claude analysis run record | `🟡 In Progress` (cross-host parity unexecuted) |
| VS Code installable 0.2.0 artifact + complete package lifecycle | `dist/phase0/cs02/gaep-vscode-0.2.0.vsix` built, installed, upgraded, uninstalled, workflow smoke executed, evidence imported | `🧪 Ready for Test` (**only Feature eligible**) |
| Claude Code detection, model selection/switching, one real analysis | Executed against Claude Code 2.1.218 with truth classes | `🟡 In Progress` (single host executed) |
| Codex detection/analysis | Codex absent → `not-run`; no pass claimed | `🟡 In Progress` |
| Visual Studio / Rider / Kiro artifacts and workflows | External lanes; not executed here → `not-built` / `pending-environment` | `🟡 In Progress` |
| Per-phase package manifest, checksums, acceptance report, evidence manifest | Digest-verified artifacts; manifest records `not-built` for absent artifacts | `🟡 In Progress` (incomplete four-host coverage) |

## 2. Repository and Baseline State

- **Current branch and commit/worktree basis:** `codex/gaep-founder-edition` at `964dc8b` ("PHASE_0_GAEP-P0-CS01_PRE_IMPLEMENTATION"); **worktree is clean** (`git status` → "clean — nothing to commit"; 379 tracked files). The prior CS01/C1 changes and the `Benchmark/` deletion are **already committed** — there is no dirty state to preserve, and nothing in this Stage A turn alters tracked content other than this report and the Register row.
- **Pre-existing modified/untracked files that must remain untouched:** `.idea/claudeCodeEditorTabs.xml` (IDE-generated, untracked) — not read, not modified, not staged.
- **Relevant implementation paths inspected:** `packages/contracts/src/{host,platform-readiness,managed-execution,agent}.ts`; `packages/engine/src/{engine,platform-readiness,managed-execution}.ts`; `packages/conformance/src/{index,evidence,rpc-conformance}.ts`; `packages/agent-sdk/src/{process,managed-claude,managed-claude-run,managed-codex-run,codex-app-server}.ts`; `packages/adapters/{codex,claude}/src/index.ts`; `apps/engine-host/src/{host,main,rpc}.ts`; `apps/vscode/src/{extension,run-terminal,platform-readiness-format}.ts`; `apps/rider/**`; `apps/visual-studio/**`; `examples/phase0-readiness/**`.
- **Existing behavior verified from source:**
  - `apps/engine-host/src/host.ts:23` `PROTOCOL_VERSION = 2`, `SUPPORTED_PROTOCOL_VERSIONS = [1, 2]`, 19 dispatch cases, `v2OnlyMethods` gate. **No provider-execution method exists.**
  - `packages/engine/src/managed-execution.ts` exposes `start`, `cancel`, `list`, `read`, `readResult`, `readEvidence`, `applyPendingReview`, `discardPendingReview` — shared, but not reachable over RPC.
  - `apps/vscode/src/run-terminal.ts:102` calls `spawn(this.invocation.executable, …)` — **host-local provider execution** (the fork CS02 must supersede for read-only analysis).
  - `packages/contracts/src/managed-execution.ts:24` `managedExecutionModeSchema = ["codex-staged","manual-offline","claude-context-only"]`; `managedRunStateSchema` (line 30) includes `prepared|running|completed|failed|cancelled|timed-out|…`.
  - `packages/adapters/claude/src/index.ts` sets `supportsModelDiscovery: false` and emits `sonnet`/`opus` with `truthClass: "provider-declared"`, `alias: true`; `ClaudeAdapter.buildInvocation` throws (effectful blocked). `packages/agent-sdk/src/managed-claude.ts` builds a tool-free, empty-cwd, `--tools ""` stream-JSON invocation.
  - `packages/adapters/codex/src/index.ts` parses an executed model catalog into `truthClass: "observed"`.
  - **Engine Host distribution (verified):** `apps/engine-host/package.json` declares `bin: { "gaep-engine": "dist/main.js" }`. `apps/rider/src/main/kotlin/dev/gaep/rider/GaepEngineClient.kt:15` resolves `System.getenv("GAEP_ENGINE_EXECUTABLE") ?: "gaep-engine"` and spawns it with `ProcessBuilder`; `apps/visual-studio/Gaep.HostClient/EngineClient.cs:18` resolves `?? "gaep-engine"` and spawns it with `ProcessStartInfo`. **Both currently depend on a mutable executable found on `PATH`.** `apps/vscode/src/extension.ts:388` constructs `new GaepEngine(...)` **in-process** and never launches the Engine Host. **No IDE artifact packages an Engine Host runtime today.**
  - **Selection source of truth (verified):** `packages/contracts/src/agent.ts:176` `agentSelectionSchema` with `schemaVersion: z.literal(2)`, plus `legacyAgentSelectionV1Schema` (line 185) as the v1 compatibility reader. `packages/engine/src/engine.ts` persists it at `runtime/selection.json` (lines 405, 500, 913) and reads it via `readSelection()` (line 433); `packages/engine/src/repository.ts:822` includes `runtime/selection.json` in the portable export set. **A second selection file would fork the source of truth.**
  - **Context Pack contract (verified):** `packages/contracts/src/product-studio.ts:839` `contextPackSchema` (`kind: "context-pack"`, wrapped in `rejectSecrets`), bound through `executionManagedReferenceSchema` / `managedExactBindingSchema` (`packages/contracts/src/execution.ts:53`, `packages/contracts/src/managed-execution.ts:104`). **A separate context source is unnecessary and forbidden.**
  - **Evidence verifier scoping (verified):** `packages/conformance/src/evidence.ts` hard-codes `PARENT_CHANGE_SET_ID = "GAEP-P0-CS01"`, `CORRECTION_SET_ID = "GAEP-P0-CS01-C1"`, and `VSCODE_HOST = "vscode"`, and the contract literals in `packages/contracts/src/platform-readiness.ts` pin the same values. **CS02 evidence cannot be produced without planned changes here.**
  - **Visual Studio model (verified):** `apps/visual-studio/README.md` already declares the **out-of-process `VisualStudio.Extensibility`** model over the same `gaep-engine` stdio protocol, and already states that release packaging "will not invoke a mutable executable found later on `PATH` without digest verification." R2 preserves this documented model; R1's VSSDK ToolWindow proposal is withdrawn as inconsistent with the repository.
- **Baseline commands and exact results (re-run read-only this turn):** `node --version` → `v26.5.0`; `ruby --version` → `2.6.10p210`; `git rev-parse --short HEAD` → `964dc8b`.
- **OS/tooling constraints:** macOS (Darwin arm64). `dotnet` **not found**; `java` **not found** ("Unable to locate a Java Runtime"); `gradle` **not found** (a Gradle **wrapper** exists at `apps/rider/gradlew` + `gradle/wrapper/gradle-wrapper.jar`, but it still requires a JDK).
- **Visual Studio / Rider / Kiro test environments available?** Visual Studio **no** (macOS host; no `dotnet`); Rider **partially** — `/Applications/Rider.app` is installed but no JDK, so `./gradlew buildPlugin` cannot run locally; Kiro **no** (`/Applications/Kiro.app` absent).
- **Codex / Claude Code executables available?** Codex **no** (`which codex` → not found). Claude Code **yes** — `/opt/homebrew/bin/claude`, `claude --version` → `2.1.218 (Claude Code)`.
- **Provider authentication readiness safely determinable?** **Partially.** Presence + `--version` are safe and observed. Authentication readiness is **not** implied by detection and will only be reported when a non-effectful, non-interactive probe returns a definitive signal; otherwise `auth-unverified`. No credential is read, printed, or persisted.
- **Facts that are observed vs configured vs provider-declared vs not observed:** *Observed*: Claude Code presence and version `2.1.218`; VS Code and Rider app presence; absence of Codex, Kiro, `dotnet`, `java`, `gradle`; uninitialized workspace (no `.gaep/`). *Provider-declared*: Claude `sonnet`/`opus` aliases. *Configured*: `gaep.codex.executable`, `gaep.claude.executable` settings. *Not observed*: Codex runtime/version/catalog; Claude authenticated-session state; Visual Studio and Kiro host behavior.

## 3. Evidence-Based Feature Assessment

| Feature ID | Tracker status | Evidence found | Verified gap | Recommended action | Proposed status after this CS |
|---|---|---|---|---|---|
| PLT-01 Shared Engine | `🟡 In Progress` | Engine + v2 endpoint; `ManagedExecutionService` shared | Provider execution not reachable over RPC; VS Code spawns locally | Add v3 read-only analysis owned by engine; hosts consume RPC | `🟡 In Progress` |
| PLT-03 VS Code VSIX | `🟡 In Progress` | `vsce package` script; accepted 0.1.0 install (C1) | No 0.2.0 release artifact; no upgrade/uninstall evidence | Build 0.2.0, execute install/upgrade/uninstall/workflow | `🧪 Ready for Test` |
| PLT-04 VS native VSIX | `❌ Backlog` | `Gaep.HostClient.csproj` = net8.0 **class library** only | No VSIX project, no Windows, no `dotnet` | Create the out-of-process `VisualStudio.Extensibility` project (per the existing README) + external Windows lane (not executed here) | `🟡 In Progress` |
| PLT-05 Four-IDE parity | `❌ Backlog` | Shared contracts only | No cross-host executed matrix | Shared v3 contract + parity conformance rows; only VS Code executed | `🟡 In Progress` |
| PLT-06 Codex Detection | `✅ Done` | Adapter probe + catalog parser + unit tests | Codex absent locally → runtime unverified | **No status change**; add regression evidence only | `✅ Done` (unchanged) |
| PLT-07 Claude Detection | `🟡 In Progress` | Adapter probe; Claude 2.1.218 observed | Auth readiness truth + host paths incomplete | Report detection + version + explicit `auth-unverified` truth | `🟡 In Progress` (single-host / provider unavailable) |
| PLT-08 Codex Model Discovery | `🟡 In Progress` | `parseModelCatalog` marks `observed` | No Codex runtime → nothing observable | Implement selection path; record `not-run` | `🟡 In Progress` |
| PLT-09 Claude Model Discovery | `🟡 In Progress` | `sonnet`/`opus` provider-declared aliases | No selection/switching surface; configured IDs unlabelled | Display+select aliases and configured IDs with truth class | `🟡 In Progress` (single-host / provider unavailable) |
| PLT-10 Safe Codex Analysis | `🟡 In Progress` | `managed-codex-run.ts` read-only sandbox builder | Cannot execute (Codex absent) | Wire to v3 read-only path; leave `not-run` | `🟡 In Progress` |
| PLT-11 Safe Claude Analysis | `❌ Backlog` | `managed-claude.ts` tool-free builder exists, unwired | Not reachable; never executed end-to-end | Wire via v3; execute one real bounded analysis | `🟡 In Progress` (single-host / provider unavailable) |
| PLT-14 Provider Switching | `🟡 In Progress` | `selectAgent` RPC | Requires both providers to prove bidirectional switch | Implement switching + provenance; Codex leg `not-run` | `🟡 In Progress` |
| PLT-15 Model Switching | `🟡 In Progress` | Partial selection | No provenance-preserving switch | Implement + execute `sonnet`↔`opus` switch | `🟡 In Progress` (single-host / provider unavailable) |
| PLT-16 Versioned Handoff | `🟡 In Progress` | `createHandoff` RPC | Cross-provider handoff needs both providers | Preserve provenance on switch; cross-provider leg `not-run` | `🟡 In Progress` |
| PLT-18 Context/Run Envelope | `🟡 In Progress` | `charter.ts`, execution contracts | No envelope for read-only analysis | Record scope/authority/model/limits per analysis run | `🟡 In Progress` (single-host / provider unavailable) |
| PLT-19 Normalized Evidence | `🟡 In Progress` | C1 evidence machinery | Not applied to provider runs | Normalize analysis run records + evidence | `🟡 In Progress` (single-host / provider unavailable) |
| PLT-20 Install/Upgrade/Rollback | `🟡 In Progress` | VS Code package script | Only one host; no upgrade/rollback evidence | Execute VS Code lifecycle; document others | `🟡 In Progress` |
| PLT-21 Dashboard Shell | `🟡 In Progress` | VS Code trees + readiness command | No host-neutral projection contract | Add `dashboardProjection` v3 + VS Code render | `🟡 In Progress` |
| PLT-24 Agent/Model Dashboard | `🟡 In Progress` | Agent tree shows selection | No run state/cost-usage/handoff evidence; one host | Add projection fields; cost/usage unavailable from providers | `🟡 In Progress` |
| PLT-26 Freshness/Evidence Cues | `🟡 In Progress` | `observedAt`/`truthClass`/`evidenceSource` in readiness | Not applied to provider/model/run views | Extend cues + explicit stale/invalid states | `🟡 In Progress` (single-host / provider unavailable) |
| PLT-27 Four-IDE Conformance Suite | `🟡 In Progress` | Boundary check + merge + observations | Only VS Code executable | Add per-host conformance rows; 3 hosts `not-run` | `🟡 In Progress` |
| PLT-28 Realistic Example Runner | `✅ Done` | CS01/C1 runner + digest-verified bundle | — | **Regression evidence only; not reopened** | `✅ Done` (unchanged) |
| PLT-29 Per-Phase Package/Acceptance Report | `🟡 In Progress` | Evidence manifest generator | No package manifest/checksums/acceptance report | Produce release artifacts; absent hosts recorded `not-built` | `🟡 In Progress` (single-host / provider unavailable) |
| PLT-31 Rider Plugin | `🟡 In Progress` | Gradle wrapper + IntelliJ plugin config + tool window | No JDK locally; no workflow/packaging | Implement client + packaging; external lane | `🟡 In Progress` |
| PLT-32 Kiro Package | `❌ Backlog` | None | No Kiro package identity | Produce independent `gaep-kiro` package | `🟡 In Progress` |
| PLT-33 Kiro Smoke Tests | `❌ Backlog` | None | Kiro not installed | Create harness + documented steps; `not-run` | `🟡 In Progress` |
| PLT-34 VS Windows Install Tests | `❌ Backlog` | None | No Windows | Create CI lane; unexecuted | `🟡 In Progress` |
| PLT-35 Rider Sandbox/Install Tests | `❌ Backlog` | None | No JDK | Create lane + tasks; unexecuted | `🟡 In Progress` |

**Tracker/reality discrepancy reported (not edited):** PLT-06 is `✅ Done` but Codex has never been runtime-verified on this machine; its Done state rests on unit/fixture coverage. CS02 does **not** reopen it and does **not** claim Codex execution.

## 4. Proposed Change Set — GAEP-P0-CS02

- **Title:** First Installable Four-IDE Provider/Model Read-Only Vertical Slice.
- **Implemented now:** engine-host **protocol v3** with eight new v3-only methods; a shared `ReadOnlyAnalysisService` in `packages/engine` that owns provider-process orchestration for analysis; portable provider/model selection with provenance; a host-neutral dashboard projection; four **0.2.0** IDE artifacts under one normalized release root; friendly uninitialized-Product UX; per-host conformance/evidence bundles; the `phase0-provider-model` realistic example; release package manifest + checksums + acceptance report + evidence manifest.
- **Remaining for later change sets:** effectful execution and Preview→Approval→Apply→Recovery; Figma/MCP; Product Lifecycle P0–P4 expansion; design-to-code; backlog generation; release publishing and marketplace distribution; signing/notarization.
- **Explicitly out of scope:** everything in the OUT OF SCOPE list of the governing prompt, plus any unrelated cleanup/refactoring and any reopening of CS01/C1 or PLT-28.
- **No behavior or architecture fork introduced:** all four hosts consume the same v3 contracts and the same projection; hosts render only. The existing VS Code `run-terminal.ts` staged path is **not** extended and is **not** used by CS02's read-only analysis.

### Frozen implementation contract

| ID | Invariant / rule | Input or trigger | Required behavior | Forbidden behavior |
|---|---|---|---|---|
| INV-01 | Shared authority | Any host action | Product state, capability snapshots, selection, execution policy, run state, evidence come from the engine **via engine-host RPC**. **All four hosts, including VS Code, use the RPC boundary for every CS02 command** | A host computing/persisting GAEP semantics locally; VS Code calling a CS02 service directly on an in-process `GaepEngine` |
| INV-02 | Single execution owner | Read-only analysis start | `ReadOnlyAnalysisService` (engine, behind the Engine Host) orchestrates the provider process; hosts only call RPC | Any IDE plugin spawning a provider process for CS02 analysis |
| INV-21 | Bundled Engine Host only | Host launches Engine Host | Launch only the Engine Host shipped inside that IDE artifact, after digest verification | Resolving `gaep-engine` from `PATH` in a production package; silent PATH fallback |
| INV-22 | Engine Host integrity | Before spawn | Verify the bundled runtime's SHA-256 against the artifact-embedded `engine-host.sha256`; mismatch ⇒ refuse to start | Spawning an unverified or substituted runtime |
| INV-23 | One selection source of truth | Selection read/write | `.gaep/runtime/selection.json` under `agentSelectionSchema` (schemaVersion 2) is the only current selection record; v3 `selectProviderModel` delegates to `GaepEngine.selectAgent()` | Creating a second selection file or a parallel selection schema |
| INV-24 | One bounded context | Analysis start | Both providers receive the same normalized Context Pack text, digest-bound to `contextPackDigest` + `sourceIdentity` | Sending different scope to Codex vs Claude; unbounded context |
| INV-25 | One active analysis per Product root | `startReadOnlyAnalysis` | At most one non-terminal run per `.gaep` root; a second start returns `ANALYSIS_ALREADY_RUNNING` | Concurrent provider processes for one Product root |
| INV-26 | Terminal-state immutability | Run reaches terminal state | `completed`/`failed`/`cancelled`/`timed-out` records are never rewritten | Mutating a terminal run record |
| INV-27 | Non-self-referential source identity | Artifact/evidence identity | `sourceIdentity` = immutable `baseCommit` + `sourceTreeDigest` over enumerated build inputs, excluding all generated outputs | Binding identity to current `HEAD` or hashing a manifest into itself |
| INV-28 | Discriminated artifact truth | Package manifest entry | `built` requires `artifactPath` + `artifactSha256`; `not-built` requires `artifactSha256: null` + allowlisted `notBuiltReason` | Claiming an artifact exists, or listing a missing artifact in `SHA256SUMS.txt` |
| INV-29 | Build ≠ install ≠ workflow | Host evidence | A compile/build publishes only `buildState`; `installTestState`/`workflowTestState` require that host's real install/workflow execution | Publishing a `passed` host observation from a build |
| INV-30 | External-evidence import authority | Importing a CI bundle | An external host bundle is imported only when its `sourceIdentity` matches and it was produced by that host's lane; a locally generated `not-run` bundle never overwrites a valid current-subject external `passed` | Local placeholder erasing a valid external result |
| INV-03 | Read-only enforcement | Analysis run | Codex runs with read-only sandbox; Claude runs tool-free/context-only from an empty temp cwd | Any write capability, tool authority, or apply/preview path |
| INV-04 | Product source immutability | Analysis run | Digest set of all Product files outside `.gaep/` is identical before and after; mismatch ⇒ run `failed`, fail closed | Recording success when any Product source file changed |
| INV-05 | Governed mutation allowlist | Analysis run | Only these portable paths may change: `.gaep/runtime/selection.json`, `.gaep/runs/**`, `.gaep/evidence/**`, `.gaep/audit/**`, and governed Context Pack records read/created by the scenario. Nothing else under `.gaep/` and nothing outside it | Mutating Product source under the guise of governed state; writing machine-local state (PID/lock) into portable `.gaep` |
| INV-31 | Server-derived model truth | `selectProviderModel` | The Engine Host derives `truthClass` (`observed`/`provider-declared`/`configured`) and alias state from the **current server-side catalog** and the model ID; an unknown but permitted custom ID is assigned `configured` | Accepting a caller-supplied `truthClass`; letting a caller promote a model to `observed` |
| INV-06 | Provider truth | Catalog/probe | `observed` only from an executed provider catalog; Claude `sonnet`/`opus` stay `provider-declared` aliases; user-entered IDs are `configured` | Labelling an alias or configured ID as `observed` |
| INV-07 | Detection ≠ auth, but never a dead end | Probe / explicit attempt | Detection reports presence/version only and yields `auth-unverified`; an explicit user-initiated read-only attempt is always permitted from `auth-unverified` and resolves it to `auth-ready` (observed for that attempt) or `auth-unavailable` | Implying authentication from detection; blocking the first explicit attempt because the state is `auth-unverified`; persisting raw authentication output |
| INV-08 | Absent provider truth | Provider missing/unexecuted | State is `not-observed` / run is `not-run` | Marking absent or unexecuted provider `passed` |
| INV-09 | Portable provenance | Selection/switch | Persist adapterId, modelId, truthClass, alias flag, capabilityDigest, selectedAt, priorSelection ref, prior run refs | Persisting executable paths, credentials, provider session IDs, raw env, or secrets |
| INV-10 | Switching preserves history | Provider/model switch | Prior run records, capability digest, audit chain, and provenance links survive | Deleting/rewriting prior runs or audit entries |
| INV-11 | Host-neutral projection | Dashboard render | All hosts render the same `dashboardProjection` payload; every field has one authoritative engine source | A host deriving a displayed truth locally |
| INV-12 | Four-IDE package identity | Packaging | Each host has a distinct, independently installable, version-aligned `0.2.0` artifact | Reusing the VS Code artifact as Kiro evidence |
| INV-13 | Host evidence truth | Conformance row | `passed` only after that host's package + workflow actually executed in that host | Inferring a host pass from build/compile/unit tests or another host |
| INV-14 | Fail-closed evidence | Missing/invalid/tampered/stale/mismatched evidence | No observation; row falls back to `not-run`/`pending-environment` | Preserving an older `passed` |
| INV-15 | Integrity not authenticity | Evidence verification | Claim consistency/integrity against supplied artifacts only | Claiming cryptographic producer authenticity |
| INV-16 | Uninitialized-workspace UX | Product action without `.gaep/manifest.json` | Friendly `product-uninitialized` state ("Initialize Product first"); readiness stays available read-only | Showing ENOENT, stack traces, or absolute paths |
| INV-17 | Sanitization | Any persisted/displayed failure | Only allowlisted categories/summaries; no absolute paths, usernames, temp dirs, env values, provider raw stderr, or secrets | Persisting raw error text or provider stderr |
| INV-18 | Protocol compatibility | RPC | v3 methods are v3-only; v1/v2 requests to them fail `PROTOCOL_UPGRADE_REQUIRED`; all pre-existing v1/v2 behavior unchanged | Breaking or silently altering v1/v2 semantics |
| INV-19 | Status discipline | Tracker update | Max `🧪 Ready for Test`, only with complete evidence for that Feature | Any `✅ Done`, or bulk advancement |
| INV-20 | Version alignment | Release | All four artifacts + manifest + checksums carry exactly `0.2.0` | Mixed or placeholder versions |

### State and failure model

| Preconditions / event | Executed? | Required state | Required artifact or UI result | Retry / rollback behavior |
|---|---:|---|---|---|
| Provider present, auth verified, analysis completes | yes | run `completed` | Run record + sanitized result + evidence bundle; dashboard shows `completed` + freshness | Re-run creates a new run; prior run retained |
| Provider present, analysis fails (provider error) | yes | run `failed` | Allowlisted `failureCategory`/`failureSummary`; no raw stderr | Re-run allowed; failure retained as current attempt |
| Provider present, user cancels | yes | run `cancelled` | Cancellation recorded with `terminationCause: cancel-request` | Re-run allowed |
| Provider present, exceeds bound | yes | run `timed-out` | `terminationCause: timeout`, sanitized summary | Re-run allowed |
| Provider absent (`codex` not found) | no | provider `not-observed`, run `not-run` | Dashboard shows not-detected + "provider unavailable"; no run created | No retry until provider installed |
| Provider detected, auth not yet verified | n/a | `detected` + `auth-unverified` | Explicit user-initiated read-only attempt is **permitted**; dashboard shows `auth-unverified` without blocking | The attempt itself resolves the state (next two rows) |
| Explicit attempt succeeds from `auth-unverified` | yes | run `completed`; `auth-ready` recorded **observed for that attempt** | Result rendered; auth truth updated | Re-run re-verifies |
| Explicit attempt fails authentication | yes | run `failed` (`failureCategory: auth-unavailable`); provider `auth-unavailable` | Allowlisted category only; raw authentication output never persisted | Retry after the user authenticates externally |
| Workspace has no `.gaep/manifest.json` | n/a | `product-uninitialized` | Friendly "Initialize Product first"; readiness still shown | Retry after initialization |
| Product source digest changed during run | yes | run `failed` (`failureCategory: source-mutation`) | Run marked failed; mutation recorded | Fail closed; never reported as success |
| Host package not installed/executed | no | host row `not-run` | Conformance matrix row `not-run` | Runs only when that host executes |
| Host environment unavailable (VS/Kiro/Rider JDK) | no | host row `pending-environment` | Matrix row `pending-environment` + reason | External lane may later publish a real row |
| Evidence missing/invalid/tampered/stale/subject-mismatched | n/a | rejected | No observation; row `not-run` | Never preserves older `passed` |
| Rollback (uninstall artifact) | yes | host row `not-run` after uninstall | Uninstall smoke recorded; `.gaep` records retained | Reinstall re-runs workflow |

### Trust and authority boundary

- **Trusted inputs and their authority:** engine-computed capability snapshots, workspace health, run records, and evidence produced by `packages/engine` and verified by `packages/conformance`.
- **Untrusted/caller-controlled inputs:** all RPC params (adapterId, modelId, objective text, runId), host-supplied observation candidates, on-disk evidence bundles, provider stdout/stderr. **`truthClass` and alias state are never accepted from a caller** — the Engine Host derives them from its own catalog (INV-31).
- **Runtime validation required:** every RPC param parsed by its zod schema; every evidence artifact parsed and digest-verified; provider output parsed and sanitized before persistence.
- **Integrity/provenance guarantees:** SHA-256 over exact file bytes; manifest membership; subject-digest binding; change-set scoping.
- **Authenticity guarantees explicitly not claimed:** no signature or producer authentication; a self-consistent fabricated bundle is not detectable and this is stated in the evidence manifest.
- **Secret/path/log sanitization rules:** persisted/displayed failures use only the allowlisted `analysisFailureCategory` values; provider stdout is truncated to 8 KiB, control characters stripped, and absolute-path-shaped substrings (`/…`, `~/…`, `C:\…`) redacted to `[redacted-path]`; provider stderr is never persisted; environment values and credentials are never read into records.

### 4.1 Engine Host distribution and bootstrap (frozen)

**Packaging technology.** The Engine Host is bundled by esbuild into one platform-neutral CommonJS file, `gaep-engine-host-0.2.0.cjs`, from `apps/engine-host/src/main.ts`. Two launch profiles consume it:

- **Electron-based hosts (VS Code, Kiro):** the extension spawns the IDE's own Node runtime — `process.execPath` with `ELECTRON_RUN_AS_NODE=1` — running the `.cjs` shipped **inside** the artifact. No external Node and no `PATH` lookup.
- **Non-Node hosts (Visual Studio, Rider):** the artifact ships a platform-specific **Node Single Executable Application (SEA)** built with `node --experimental-sea-config`, wrapping the same `.cjs`.

**Platform/architecture matrix supported by CS02.**

**Option B is frozen: the CS02 support matrix is reduced to targets actually produced by approved lanes.**

| Host | Supported platform(s) in CS02 | Producing lane | Engine Host artifact |
|---|---|---|---|
| VS Code | platform-neutral | local `npm run release:cs02` | `gaep-engine-host-0.2.0.cjs` |
| Kiro | platform-neutral | local `npm run release:cs02` | `gaep-engine-host-0.2.0.cjs` |
| Visual Studio | `win32-x64` only | `.github/workflows/cs02-visual-studio.yml` (`windows-2022`) | `gaep-engine-host-0.2.0-win32-x64.exe` |
| Rider | `linux-x64` only | `.github/workflows/cs02-rider.yml` (`ubuntu-22.04`) | `gaep-engine-host-0.2.0-linux-x64` |

`darwin-arm64`, `darwin-x64`, `win32-x64` (Rider), `linux-arm64`, and `win32-arm64` are **explicitly not supported in CS02** because no approved lane produces their SEA. They are reported as `pending-environment`, never as supported. A Rider install on an unsupported platform surfaces `engine-host-platform-unsupported` and the host row stays `not-run`.

**Complete SEA build procedure (frozen, `apps/engine-host/build-sea.mjs`).** For each target the script: (1) bundles the CJS via `build-bundle.mjs`; (2) generates the SEA blob with `node --experimental-sea-config apps/engine-host/sea-config.json`; (3) selects the exact target Node runtime — the runner's own `process.execPath`, pinned to the Node version recorded in `apps/engine-host/node-target.json`; (4) verifies that Node executable's SHA-256 against the pinned digest in the same file and aborts on mismatch; (5) copies it to the output name; (6) injects the blob with **`postject`** (`postject <out> NODE_SEA_BLOB <blob> --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`), adding `--macho-segment-name NODE_SEA` on macOS; (7) on macOS removes the existing signature with `codesign --remove-signature` before injection and re-signs ad-hoc (`codesign --sign -`) after, and on Windows leaves the binary unsigned (signing is out of CS02 scope); (8) computes the final runtime SHA-256 and writes `engine-host.sha256`; (9) packages the executable **only after** step 8 succeeds. Any failed step yields **no artifact** and a `not-built` manifest entry.

**Runtime availability gate.** The Visual Studio and Rider package jobs must build or download the exact source-matched Engine Host runtime **before** embedding it. A missing or digest-mismatched target runtime produces `buildState: not-built` with reason `external-lane-not-executed`; a partially usable package is never produced.

**Output paths.** `dist/phase0/cs02/engine-host/gaep-engine-host-0.2.0.cjs`, `dist/phase0/cs02/engine-host/gaep-engine-host-0.2.0-<platform>-<arch>[.exe]`, and `dist/phase0/cs02/engine-host/SHA256SUMS.txt`.

**Bundling into IDE artifacts.** VS Code/Kiro VSIX embed the `.cjs` at `dist/engine-host/gaep-engine-host-0.2.0.cjs` plus `dist/engine-host/engine-host.sha256`. The Visual Studio VSIX embeds the `win32-x64` SEA at `EngineHost/`; the Rider plugin zip embeds the `linux-x64` SEA at `engine-host/` — each with its `engine-host.sha256`. No other SEA target is embedded in CS02.

**Location and launch.** Each host resolves the runtime **relative to its own installed artifact root** (VS Code/Kiro: `context.extensionUri`; Visual Studio: extension install dir; Rider: plugin path), never from `PATH` or a user setting.

**Digest verification before launch.** The launcher reads the sibling `engine-host.sha256`, recomputes SHA-256 over the runtime's exact bytes, and compares. Mismatch or missing digest ⇒ **no spawn**, surface `engine-host-integrity-failed`, host row `not-run`.

**Lifecycle.** *Startup:* spawn, then a `ping` handshake asserting `protocolVersion: 3` within 10 s or fail `engine-host-start-timeout`. *Shutdown:* close stdin, wait 5 s, then terminate the process group. *Crash:* mark in-flight runs `failed` (`failureCategory: internal`), surface a friendly message, allow restart. *Orphan:* the launcher writes a **machine-local** lock outside the Product workspace at `<os-user-state-dir>/gaep/engine-host/<sha256(productRootAbsolutePath)>.json` (`os.homedir()/.gaep-state/engine-host/` on macOS/Linux, `%LOCALAPPDATA%\\gaep\\engine-host\\` on Windows). It never enters portable `.gaep`, evidence, package manifests, or Git. On startup a recorded PID that is no longer a GAEP host is cleared and any `running` record is reconciled per §4.3. *Upgrade:* a new artifact version terminates the old host before the new one starts; version skew between plugin and bundled host is impossible because both are `0.2.0` and verified by digest.

**Development override.** `GAEP_ENGINE_EXECUTABLE` is honored **only** when `GAEP_DEV_ENGINE=1`; both are ignored in production packages. A production package must never silently fall back to a mutable `PATH` executable (INV-21).

**Version alignment.** Engine Host bundle, all four IDE artifacts, and the package manifest all carry exactly `0.2.0` (INV-20).

### 4.2 Provider-selection source of truth (frozen)

**Approach (b) is frozen: keep the existing schema; no new file, no migration.**

- **Exact schema version:** `agentSelectionSchema`, `schemaVersion: 2` (`packages/contracts/src/agent.ts:176`), unchanged.
- **Exact persistence path:** `.gaep/runtime/selection.json` — the single current selection record. `.gaep/selection/provider-model.json` proposed in R1 is **withdrawn**.
- **Compatibility with v1/v2 records:** the existing `legacyAgentSelectionV1Schema` compatibility reader and the `migrateLegacySelection` RPC are retained unchanged. **No schema or path migration is introduced by CS02**, so no migration trigger or rollback is required; any earlier statement to that effect stands because nothing is migrated.
- **v1/v2 `selectAgent` and v3 `selectProviderModel` convergence:** `selectProviderModel` is a thin v3 wrapper that validates CS02 truth-class rules and then calls the **same** `GaepEngine.selectAgent()`. Both write the same record and emit the same audit event; `readProviderSelection` and `readSelection()` read the same file.
- **Capability digest and runtime binding revalidation:** `selectAgent()` re-probes the adapter host-side and recomputes `capabilityDigest`; the machine-local runtime binding is revalidated by the Engine Host exactly as for `prepareRun` (`CAPABILITIES_CHANGED` / `EXECUTABLE_CHANGED` / `EXECUTABLE_UNAVAILABLE`), and never persisted in the portable record.
- **Prior selection and Run history preservation:** provenance is recorded through the **existing governed records** — the audit chain retains every prior `agent.selection.*` event, prior analysis runs remain under `.gaep/runs/**`, and cross-provider continuity uses the existing `createHandoff` record. Nothing is deleted or rewritten (INV-10).

### 4.3 v3 RPC and long-running execution contract (frozen)

All eight methods are **v3-only** (`v3OnlyMethods`); a v1/v2 request receives `PROTOCOL_UPGRADE_REQUIRED` (`-32021`); an unsupported version receives `UNSUPPORTED_PROTOCOL_VERSION` (`-32020`). All param objects are `.strict()`.

| Method | Request | Response | Error kinds |
|---|---|---|---|
| `providerCatalog` | `{}` | `providerCatalogSchema`: `{ observedAt, providers: [{ adapterId, agentId, agentLabel, detected, runtimeVersion?, authReadiness, authTruthClass, capabilityDigest, models: [{ id, label, truthClass, alias }] (≤512) }] (≤64) }` | `CAPABILITIES_NOT_AVAILABLE` |
| `readProviderSelection` | `{}` | `{ selection: agentSelectionSchema \| null, provenance: { priorSelectionCount, priorRunIds (≤100) } }` | `PRODUCT_UNINITIALIZED` |
| `selectProviderModel` | `{ actorId?, adapterId (1–200), modelId (1–500), settings }` — **no caller-supplied `truthClass`** | `{ selection: agentSelectionSchema, resolvedTruthClass, alias }` | `INVALID_PARAMS`, `PRODUCT_UNINITIALIZED`, `CAPABILITIES_CHANGED`, `EXECUTABLE_CHANGED`, `EXECUTABLE_UNAVAILABLE`, `MODEL_NOT_PERMITTED` |
| `startReadOnlyAnalysis` | `{ actorId?, objective (4–4000), contextPackIds (1–20 uuid), timeoutMs (1000–600000, default 120000), idempotencyKey (uuid) }` | `{ analysisRunId (uuid), state: "running", startedAt, envelope }` | `PRODUCT_UNINITIALIZED`, `NO_SELECTION`, `PROVIDER_UNAVAILABLE`, `AUTH_UNAVAILABLE`, `ANALYSIS_ALREADY_RUNNING`, `CONTEXT_PACK_NOT_FOUND`, `CONTEXT_TOO_LARGE` |
| `readAnalysisRun` | `{ analysisRunId (uuid) }` | `analysisRunRecordSchema` | `ANALYSIS_NOT_FOUND` |
| `listAnalysisRuns` | `{ limit (1–100, default 20) }` | `{ runs: analysisRunRecordSchema[] }` newest-first by `startedAt` | `PRODUCT_UNINITIALIZED` |
| `cancelAnalysisRun` | `{ analysisRunId (uuid), reason? (≤200) }` | `{ analysisRunId, state }` | `ANALYSIS_NOT_FOUND` |
| `dashboardProjection` | `{}` | `dashboardProjectionSchema` (§8) | *(none — always returns a projection, including empty/uninitialized states)* |

**Interaction model.**
- **Persisted before process start:** the run record (`state: "running"`), the envelope (scope, authority, adapterId, modelId, truthClass, `contextPackDigest`, `sourceIdentity`, limits, `startedAt`, `idempotencyKey`), and the pre-run Product digest snapshot. Only then is the provider process spawned.
- **Return semantics:** `startReadOnlyAnalysis` returns **immediately** with `state: "running"`; it never blocks on the provider.
- **Concurrency:** at most one non-terminal run per Product root (INV-25); a second start ⇒ `ANALYSIS_ALREADY_RUNNING` carrying the active `analysisRunId`.
- **Idempotency:** a repeated `idempotencyKey` within the same Product root returns the **existing** run record instead of starting a second run.
- **List:** newest-first by `startedAt`, maximum 100.
- **Polling:** hosts call `readAnalysisRun` (recommended 1 s interval); there is no push channel in CS02.
- **Cancel idempotency:** cancelling an already-terminal run is a **no-op success** returning the existing terminal state.
- **Cancel-vs-completion race:** the first terminal transition wins and is immutable (INV-26); a cancel that arrives after completion returns `completed`.
- **Timeout/hard stop:** at `timeoutMs` the process group is signalled, then force-killed after 5 s; the run becomes `timed-out` with `terminationCause: timeout`.
- **Engine Host restart recovery:** on startup, any `running` record whose recorded PID is absent or not a GAEP child is reconciled to `failed` with `failureCategory: internal` and `terminationCause: process-loss`. Terminal records are never touched.
- **Host disconnect:** stdin close terminates the Engine Host and its provider child; the run is reconciled on next start as above. A disconnect never leaves a stale `running` record visible as success.
- **Sanitized RPC errors:** every error is `{ code, message, data: { kind } }` with an allowlisted `kind` from the table above; messages are constant strings containing no path, environment value, or provider output.

### 4.4 Bounded context, authentication, and provider-network truth (frozen)

**Context.** The engine builds the analysis context **only** from governed `contextPackSchema` records (`kind: "context-pack"`) named by `contextPackIds`. There is no second context source and no implicit workspace upload.

- **Bounds:** 1–20 packs; total normalized context ≤ **256 KiB**; objective 4–4000 characters.
- **Digest/binding:** the normalized context text is hashed to `contextPackDigest` (SHA-256 over exact UTF-8 bytes) and recorded with `sourceIdentity` in the envelope.
- **Same context for both providers:** the identical normalized text is supplied to Codex and Claude Code, so **switching provider or model cannot silently change analysis scope** (INV-24).
- **Exclusions:** `contextPackSchema` is already wrapped in `rejectSecrets`; the normalizer additionally strips absolute-path-shaped substrings and never includes environment values.
- **Temporary workspace lifecycle:** each run uses a fresh `mkdtemp` directory; it is removed on completion, failure, cancellation, and timeout, and reconciled on Engine Host restart.
- **Truthful provider asymmetry (declared limitation):** Claude Code runs **tool-free from an empty temporary directory**, so it can read nothing beyond the supplied context. Codex runs in a **read-only sandbox rooted at the Product workspace**, so it *can technically read workspace files beyond the declared Context Pack* while remaining unable to write. This asymmetry is recorded as a `knownLimitation` on every Codex analysis record and shown in the dashboard; it is **not** presented as equivalent isolation.

**Authentication state model (corrected).** Detection still never implies authentication. `auth-unverified` is a *neutral* state, not a permanent block: an **explicit user-initiated read-only attempt is permitted** from `auth-unverified`, and its outcome resolves the state — a successful run records `auth-ready` **observed for that attempt**, while a classified authentication failure records `auth-unavailable`. No credentials and no raw authentication error text are persisted; only the allowlisted category is stored.

**Provider-network truth (corrected).** A provider CLI inherently performs its own network transport to its vendor service; CS02 does not and cannot prevent that. The accurate claim is: **GAEP grants no arbitrary workspace Tool authority and no additional network authority** — it adds no tools, no MCP, no browser, and no write capability. Any earlier phrasing implying "no network" is superseded by this statement.

### 4.5 Evidence implementability without breaking CS01/C1 (frozen)

`packages/conformance/src/evidence.ts` and the pinned literals in `packages/contracts/src/platform-readiness.ts` are **refactored to a parameterized verifier plus a strict CS01/C1 compatibility wrapper**:

- `verifyEvidenceBundleFor(spec, bundleDir, currentSubjectDigest)` where `spec = { parentChangeSetId, correctionSetId, host, checkId, artifactNames }`.
- `verifyEvidenceBundle(bundleDir, subjectDigest)` is retained as a wrapper pinned to `GAEP-P0-CS01` / `GAEP-P0-CS01-C1` / `vscode`, so **CS01/C1 evidence continues to verify unchanged** and existing tests pass without modification.
- Contract literals become parameterized enums (`changeSetIdSchema`, `readinessHostSchema` reused) while the C1 wrapper enforces the original literals.

**CS02 scoping.** `parentChangeSetId: "GAEP-P0-CS02"`, `correctionSetId: null`, `host ∈ {vscode, visual-studio, rider, kiro}`, `checkId ∈ { "vscode.extension-host.e2e", "visual-studio.vsix.workflow", "rider.plugin.workflow", "kiro.extension.workflow" }`. Per-host producer authority: only that host's own lane may publish its bundle (INV-30). A CS02 bundle is **not** accepted by substituting strings into a C1 envelope — the CS02 envelope requires `sourceIdentity`, `packageVersion`, and `host`, which the C1 schema does not contain, so a rewritten C1 envelope fails schema validation.

**Corrected evidence defects.**
- The package-manifest entry is a **discriminated union on `buildState`**, not a fixed 13-field record:
  - **Common fields (11), present in both variants:** `changeSetId`, `packageVersion`, `ideHost`, `targetIdeRange`, `sourceIdentity`, `artifactPath` (the *planned* path — retained in both variants so a not-built artifact remains identifiable), `buildState`, `installTestState`, `workflowTestState`, `observedAt`, `evidenceSource`.
  - **`buildState: "built"` adds (2):** `artifactSha256` (`sha256:<64-hex>`, required) and `knownLimitation` (string or `null`). **Total 13 fields.**
  - **`buildState: "not-built"` adds (3):** `artifactSha256: null`, `notBuiltReason` (allowlisted, required **only** in this variant), and `knownLimitation` (string or `null`). **Total 14 fields.**
  - `sourceRevision` and `subjectDigest` are collapsed into the single `sourceIdentity` field.
- `GAEP-P0-CS02_EVIDENCE_MANIFEST.md` hashes exactly these files and **does not hash itself**: `GAEP-P0-CS02_ACCEPTANCE_REPORT.json`, `dist/phase0/cs02/package-manifest.json`, `dist/phase0/cs02/SHA256SUMS.txt`, and, for each host with a bundle, `acceptance/<host>/readiness-evidence.json`, `acceptance/<host>/observation.json`, `acceptance/<host>/evidence-manifest.json`.
- **Current-attempt authority:** a locally generated `not-run` bundle **never** overwrites a valid external bundle whose `sourceIdentity` matches the current subject. Local producers may write only the `vscode` bundle; the other three are written only by importing their lane artifact.

### 4.6 Source identity (frozen, non-self-referential)

`sourceRevision === current HEAD` is **withdrawn** as impossible for tracked generated manifests. Frozen replacement:

```
sourceIdentity = { sourceTreeDigest: "sha256:<64-hex>",   // equivalence + staleness identity
                   baseCommit: <40-hex>,                  // provenance metadata only
                   dirty: <boolean> }                      // provenance metadata only
```

**Equivalence rule (frozen).** `sourceTreeDigest` alone determines artifact/evidence equivalence and staleness. `baseCommit` and `dirty` are recorded for provenance and are **never** used to accept or reject. A locally built dirty tree and a committed CI tree with byte-identical included inputs therefore compare **equal**; any `sourceTreeDigest` difference rejects the artifact.

- **`baseCommit`:** the immutable commit that was `HEAD` **when the build started** (recorded, never re-checked against a later `HEAD`).
- **`sourceTreeDigest`:** SHA-256 over the canonical newline-joined list of `"<sha256-of-file-bytes>  <repo-relative-posix-path>"` lines, sorted **byte-ascending by path**.
- **Included paths (every artifact-producing input):** root `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.base.json`; every `packages/*/package.json` and `packages/*/tsconfig.json`; all `packages/**/src/**`; every `apps/*/package.json` and `apps/*/tsconfig.json`; `apps/*/src/**`; `apps/vscode/esbuild.mjs`; `apps/kiro/build.mjs`; `apps/engine-host/build-bundle.mjs`, `apps/engine-host/build-sea.mjs`, `apps/engine-host/sea-config.json`; `apps/rider/build.gradle.kts`, `apps/rider/settings.gradle.kts`, `apps/rider/gradle.properties`, `apps/rider/gradle/wrapper/gradle-wrapper.properties`, the SHA-256 of `apps/rider/gradle/wrapper/gradle-wrapper.jar`, `apps/rider/src/main/resources/META-INF/plugin.xml`; all `apps/visual-studio/**/*.cs`, `**/*.csproj`, `**/*.vsixmanifest`, and VS package-definition inputs; `scripts/**`; and `.github/workflows/cs02-visual-studio.yml`, `.github/workflows/cs02-rider.yml`.
- **Excluded paths (generated/irrelevant):** `dist/**`, `**/dist/**`, `node_modules/**`, `.git/**`, `docs/**`, `examples/**/acceptance/**`, `examples/**/evidence/**`, `**/*.tsbuildinfo`, `.idea/**`.
- **Dirty worktree:** `dirty: true` when tracked included files differ from `baseCommit`; the digest is still computed over on-disk bytes, so identity remains exact.
- **Local vs external comparison:** both compute the identical algorithm over the same include/exclude lists, and matching compares **only `sourceTreeDigest`**, so a CI bundle and a local run are comparable without network access and provenance differences never cause a false rejection.
- **No self-reference:** every generated output is excluded, so committing `package-manifest.json`, `SHA256SUMS.txt`, or any acceptance artifact cannot change `sourceIdentity`.
- **Staleness:** if any included input changes, `sourceTreeDigest` changes and every artifact/evidence bound to the previous identity is **stale** ⇒ rejected ⇒ host rows fall back to `not-run` (INV-14).

### 4.7 Artifact truth, CI lanes, and evidence import (frozen)

Five distinct facts are tracked separately and never conflated: **planned → built → installed → workflow executed → host observation passed**.

Package-manifest entries are a discriminated union on `buildState`:

- `built` ⇒ `artifactPath` (string) and `artifactSha256` (`sha256:<64-hex>`) **required**;
- `not-built` ⇒ `artifactSha256: null` and `notBuiltReason` from the allowlist `{ "requires-windows-visual-studio", "requires-jdk21", "requires-kiro-install", "external-lane-not-executed" }`.

`SHA256SUMS.txt` contains **only artifacts that exist on disk**. `installTestState` and `workflowTestState` are each `passed | failed | not-run | pending-environment` and may be `passed` **only** from a real install/workflow execution in that host (INV-29).

**External lane contract** — each workflow defines: **trigger** `workflow_dispatch` + `push` on `codex/gaep-founder-edition`; **build** the exact command below; **artifact upload** to `dist/phase0/cs02/`; **evidence-bundle upload** of the three-file host bundle; **download/import** via `npm run evidence:import -- --host <host> --artifact <downloaded-dir>`, which verifies `sourceIdentity` and every digest before writing into the tracked acceptance set; **importer** = the Product Owner or a maintainer running that command.

| Host | Build command | Publishes at most | Never publishes |
|---|---|---|---|
| Visual Studio | `msbuild apps/visual-studio/Gaep.VisualStudio/Gaep.VisualStudio.csproj /p:Configuration=Release` | `buildState: passed` | install/workflow states |
| Rider | `./gradlew buildPlugin verifyPlugin` | `buildState: passed` | `runIde`/installed-workflow states |
| Kiro | `node apps/kiro/build.mjs` | `buildState: passed` | install/workflow states (README steps alone are **not** evidence) |
| VS Code | `npm run release:cs02` + `npm run test:vscode:extension-host` | `buildState`, `installTestState`, `workflowTestState` when each actually executes | another host's states |

### 4.8 Host implementation and documentation alignment (frozen)

**Visual Studio model.** The existing documented **out-of-process `VisualStudio.Extensibility`** model is preserved (`apps/visual-studio/README.md`), communicating over the same `gaep-engine` stdio protocol as Rider. R1's in-process VSSDK ToolWindow proposal is **withdrawn**; no evidence-based reason exists to replace the documented model. `Gaep.HostClient` remains the IDE-independent protocol client and gains v3 wrappers plus bundled-runtime resolution.

Documentation is updated so a Product Owner can install and operate each host: `apps/vscode/README.md`, `apps/visual-studio/README.md`, `apps/rider/README.md`, `apps/kiro/README.md`, and a new root `docs/06_Roadmap/CS02_INSTALL_AND_RELEASE_GUIDE.md` — each covering package installation, Engine Host bootstrap and digest verification, provider prerequisites, model truth classes, uninitialized-Product behavior, execution limitations (read-only; Codex sandbox read-breadth), test commands, upgrade, uninstall, and rollback.

## 5. Exact Planned File Changes

| Path | Action | Feature IDs / invariants | Exact planned change | Expected result |
|---|---|---|---|---|
| `packages/contracts/src/provider-catalog.ts` | Create | PLT-07/08/09, INV-06/07/23 | `providerTruthClassSchema`, `providerModelDescriptorSchema`, `providerCatalogEntrySchema`, `providerCatalogSchema`, `authReadinessSchema` = `auth-ready\|auth-unverified\|auth-unavailable`. **No selection record is defined here** — selection remains `agentSelectionSchema` | Catalog + auth truth contract |
| `packages/contracts/src/provider-catalog.test.ts` | Create | INV-06/07 | alias cannot be `observed`; configured ID labelled `configured`; detection never sets `auth-ready` | Passing contract tests |
| `packages/contracts/src/source-identity.ts` | Create | INV-27 | `sourceIdentitySchema` = `{ baseCommit (40-hex), sourceTreeDigest (sha256:64-hex), dirty (bool) }` | Non-self-referential identity |
| `packages/contracts/src/source-identity.test.ts` | Create | INV-27 | Rejects malformed commit/digest; accepts dirty identity | Passing contract tests |
| `packages/contracts/src/read-only-analysis.ts` | Create | PLT-10/11/18/19, INV-03/04/17 | `analysisRunStateSchema` = `running\|completed\|failed\|cancelled\|timed-out\|not-run`; `analysisFailureCategorySchema` = `provider-unavailable\|auth-unverified\|provider-error\|timeout\|cancelled\|source-mutation\|protocol-error\|internal`; `analysisRunEnvelopeSchema` (scope, authority, adapterId, modelId, truthClass, limits, startedAt); `analysisRunRecordSchema`; `analysisRunResultSchema` (sanitized text ≤ 8 KiB) | Read-only analysis contract |
| `packages/contracts/src/read-only-analysis.test.ts` | Create | INV-17 | Rejects raw absolute paths/newline-laden summaries; enforces allowlisted categories | Passing contract tests |
| `packages/contracts/src/dashboard-projection.ts` | Create | PLT-21/24/26, INV-11 | `dashboardProjectionSchema` with exactly the fields in §8 | Host-neutral read model |
| `packages/contracts/src/dashboard-projection.test.ts` | Create | INV-11 | Validates empty/unavailable/stale/invalid projection states | Passing contract tests |
| `packages/contracts/src/host.ts` | Modify | INV-18 | Add 8 methods to `hostMethodSchema` + `hostRequestSchema`: `providerCatalog`, `readProviderSelection`, `selectProviderModel`, `startReadOnlyAnalysis`, `readAnalysisRun`, `listAnalysisRuns`, `cancelAnalysisRun`, `dashboardProjection` | Canonical v3 RPC contract |
| `packages/contracts/src/host.test.ts` | Modify | INV-18 | Accept each v3 method; reject unknown params; assert v3 gating shape | Passing contract tests |
| `packages/contracts/src/index.ts` | Modify | — | Export the three new modules | Importable |
| `packages/engine/src/provider-catalog.ts` | Create | PLT-07/08/09/14/15, INV-06/07/23 | `ProviderCatalogService`: `catalog()` (probe + truth classes + auth readiness) and `selectProviderModel()` which validates CS02 truth rules then **delegates to the existing `GaepEngine.selectAgent()`**; writes **no new selection file** | One selection source of truth |
| `packages/engine/src/provider-catalog.test.ts` | Create | INV-06/07/09/10/23 | Delegation to `selectAgent` asserted; `.gaep/runtime/selection.json` is the only written selection path; switch preserves prior audit/run history; alias never `observed` | Passing tests |
| `packages/engine/src/source-identity.ts` | Create | INV-27 | `computeSourceIdentity(root)` per §4.6 include/exclude lists, sorted byte-ascending, excluding all generated outputs; returns `{ sourceTreeDigest, baseCommit, dirty }` | Reproducible identity |
| `packages/engine/src/engine-host-lock.ts` | Create | INV-05/21 | Machine-local PID/lock at `<os-user-state-dir>/gaep/engine-host/<sha256(productRootAbsolutePath)>.json`; never inside `.gaep` | Portable state stays clean |
| `packages/engine/src/engine-host-lock.test.ts` | Create | INV-05 | Lock path is outside the workspace; nothing is written into `.gaep`; stale PID reconciliation | Passing tests |
| `packages/engine/src/source-identity.test.ts` | Create | INV-27 | Local **dirty** tree and committed CI tree with identical included bytes compare **equal** (`sourceTreeDigest` match; differing `baseCommit`/`dirty` do not reject); changing any build script, `package.json` dependency, `plugin.xml`, SEA config, or packaging workflow **changes** the digest; committing generated evidence alone does **not** change it | Passing tests |
| `packages/engine/src/read-only-analysis.ts` | Create | PLT-10/11/18/19, INV-02/03/04/05 | `ReadOnlyAnalysisService`: `start()`, `read()`, `list()`, `cancel()`; builds Codex read-only-sandbox or Claude tool-free invocation via `@gaep/agent-sdk`; computes pre/post Product digest set; writes `.gaep/runs/**` + `.gaep/evidence/**` | Shared provider execution owner |
| `packages/engine/src/read-only-analysis.test.ts` | Create | INV-03/04/05/08/17 | Fake adapter: completed/failed/cancelled/timeout; source-mutation ⇒ failed; absent provider ⇒ `not-run`; sanitization | Passing tests |
| `packages/engine/src/source-guard.ts` | Create | INV-04/05 | `snapshotProductDigests(root)` / `assertNoProductMutation(before, after)` excluding `.gaep/`, `node_modules/`, `.git/` | Deterministic mutation guard |
| `packages/engine/src/source-guard.test.ts` | Create | INV-04/05 | Detects added/modified/deleted Product file; permits **only** the exact INV-05 allowlist; rejects an unlisted `.gaep` path; asserts no machine-local PID/lock is written into `.gaep` | Passing tests |
| `packages/engine/src/dashboard-projection.ts` | Create | PLT-21/24/26 | `buildDashboardProjection()` composing readiness, catalog, selection, latest run, host conformance | Single projection source |
| `packages/engine/src/dashboard-projection.test.ts` | Create | INV-11 | Empty/unavailable/stale/invalid states | Passing tests |
| `packages/engine/src/engine.ts` | Modify | PLT-01 | Instantiate and expose `providerSelection`, `readOnlyAnalysis`, `dashboardProjection` | Engine API surface |
| `packages/engine/src/index.ts` | Modify | — | Export new modules | Importable |
| `apps/engine-host/src/host.ts` | Modify | INV-02/18 | `PROTOCOL_VERSION = 3`; `SUPPORTED_PROTOCOL_VERSIONS = [1,2,3]`; new `v3OnlyMethods` set containing the 8 methods; 8 dispatch cases delegating to the engine | v3 endpoint live |
| `apps/engine-host/src/host.test.ts` | Modify | INV-18 | v3 negotiation; each v3 method rejected at v1/v2 with `PROTOCOL_UPGRADE_REQUIRED`; v1/v2 regression preserved | Passing tests |
| `packages/conformance/src/host-conformance.ts` | Create | PLT-05/27, INV-13/14 | `HOST_CHECK_IDS` for the four hosts; `observeHost()` requiring an executed result; `composeHostMatrix()` | Executed-only host rows |
| `packages/conformance/src/host-conformance.test.ts` | Create | INV-13/14 | Non-executed host ⇒ no observation; another host's result never transfers | Passing tests |
| `packages/conformance/src/index.ts` | Modify | — | Export `./host-conformance.js` | Importable |
| `apps/vscode/package.json` | Modify | PLT-03/20, INV-20 | Version → `0.2.0`; add commands `gaep.selectProvider`, `gaep.selectModel`, `gaep.runReadOnlyAnalysis`, `gaep.showAgentModelDashboard`, `gaep.cancelAnalysis`; add activation events; add `package:release` script emitting `dist/phase0/cs02/gaep-vscode-0.2.0.vsix` | VS Code 0.2.0 surface |
| `apps/vscode/src/provider-model-view.ts` | Create | PLT-21/24/26 | Renders `dashboardProjection` (no local truth derivation) | Native Agent/Model surface |
| `apps/vscode/src/provider-model-view.test.ts` | Create | INV-11/16 | Renders all states incl. `product-uninitialized`, stale, invalid | Passing tests |
| `apps/vscode/src/engine-host-client.ts` | Create | INV-01/02/21/22 | Spawns the **bundled** `dist/engine-host/gaep-engine-host-0.2.0.cjs` via `process.execPath` + `ELECTRON_RUN_AS_NODE=1` after verifying `engine-host.sha256`; stdio JSON-RPC client sending `protocolVersion: 3`; no `PATH` lookup | VS Code uses the shared RPC boundary |
| `apps/vscode/src/engine-host-client.test.ts` | Create | INV-21/22 | Digest mismatch ⇒ refuses to spawn; missing digest ⇒ refuses; `GAEP_ENGINE_EXECUTABLE` ignored unless `GAEP_DEV_ENGINE=1` | Passing tests |
| `apps/vscode/src/extension.ts` | Modify | PLT-03/21/24, INV-01/16 | Register the five CS02 commands **against the Engine Host RPC client** (not the in-process `GaepEngine`); friendly `product-uninitialized` prerequisite state | Usable VS Code slice on the shared boundary |
| `apps/vscode/test/e2e/suite/index.cjs` | Modify | INV-13/16 | Assert new commands registered, dashboard renders projection, uninitialized state friendly, no `.gaep` created by readiness | Executed VS Code evidence |
| `apps/kiro/package.json` | Create | PLT-32/33, INV-12 | Kiro package identity `gaep-kiro` publisher `gaep`, version `0.2.0`, `main` reusing the shared extension bundle | Independent Kiro package |
| `apps/kiro/README.md` | Create | PLT-33 | Kiro install + smoke-test steps | Kiro instructions |
| `apps/kiro/build.mjs` | Create | PLT-32 | Bundles the shared extension source and emits `dist/phase0/cs02/gaep-kiro-0.2.0.vsix` | Kiro artifact |
| `apps/visual-studio/Gaep.VisualStudio/Gaep.VisualStudio.csproj` | Create | PLT-04/34 | **Out-of-process `Microsoft.VisualStudio.Extensibility`** project (VS 2022 `[17.8,18.0)`), references `Gaep.HostClient`; embeds `EngineHost/gaep-engine-host-0.2.0-win32-x64.exe` + `EngineHost/engine-host.sha256` | VS extension project (documented model preserved) |
| `apps/visual-studio/Gaep.VisualStudio/GaepExtension.cs` | Create | PLT-04, INV-20 | `Extension` metadata: id `Gaep.VisualStudio`, version `0.2.0` | VSIX identity |
| `apps/visual-studio/Gaep.VisualStudio/GaepToolWindowContent.cs` | Create | PLT-04/21, INV-11 | Remote UI tool window rendering `dashboardProjection` verbatim | VS native surface |
| `apps/visual-studio/Gaep.HostClient/EngineClient.cs` | Modify | INV-18/21/22 | Send `protocolVersion: 3`; add v3 wrappers; resolve the **bundled** `EngineHost/` runtime relative to the install dir with digest verification; remove the `PATH` fallback | VS client speaks v3 on a verified runtime |
| `apps/visual-studio/Gaep.HostClient/EngineHostLocator.cs` | Create | INV-21/22 | Resolves + digest-verifies the bundled runtime; honors `GAEP_ENGINE_EXECUTABLE` only when `GAEP_DEV_ENGINE=1` | No silent PATH fallback |
| `apps/rider/src/main/kotlin/dev/gaep/rider/GaepEngineClient.kt` | Modify | INV-18/21/22 | Send `protocolVersion: 3`; add v3 wrappers; resolve the **bundled** per-platform SEA from the plugin path with digest verification; remove the `PATH` default | Rider client speaks v3 on a verified runtime |
| `apps/rider/src/main/kotlin/dev/gaep/rider/EngineHostLocator.kt` | Create | INV-21/22 | Platform/arch selection + SHA-256 verification; dev override gated by `GAEP_DEV_ENGINE=1` | No silent PATH fallback |
| `apps/rider/src/main/kotlin/dev/gaep/rider/GaepToolWindowFactory.kt` | Modify | PLT-21/31 | Render `dashboardProjection`; provider/model selection + analysis actions | Rider native surface |
| `apps/rider/build.gradle.kts` | Modify | PLT-31/35, INV-20 | `version = "0.2.0"`; configure `buildPlugin` output name `gaep-rider-0.2.0.zip`; enable `verifyPlugin` | Rider artifact |
| `.github/workflows/cs02-visual-studio.yml` | Create | PLT-04/34 | `windows-2022`; `msbuild Gaep.VisualStudio.csproj /p:Configuration=Release`; upload `dist/phase0/cs02/Gaep.VisualStudio-0.2.0.vsix` + host evidence bundle | External VS lane |
| `.github/workflows/cs02-rider.yml` | Create | PLT-31/35 | `ubuntu-22.04`; JDK 21; `./gradlew buildPlugin verifyPlugin`; upload `dist/phase0/cs02/gaep-rider-0.2.0.zip` + evidence | External Rider lane |
| `apps/engine-host/build-bundle.mjs` | Create | INV-21/22, PLT-01 | esbuild `src/main.ts` → `dist/phase0/cs02/engine-host/gaep-engine-host-0.2.0.cjs`; emit `engine-host.sha256` | Platform-neutral runtime |
| `apps/engine-host/sea-config.json` | Create | INV-21 | Node SEA config wrapping the bundled `.cjs` | SEA input |
| `apps/engine-host/node-target.json` | Create | INV-21/22 | Pinned target Node version + per-platform SHA-256 of the Node executable used for SEA injection | Verified SEA base |
| `apps/engine-host/build-sea.test.mjs` | Create | INV-21/22 | Asserts the 9-step procedure aborts on Node-checksum mismatch and emits no artifact; asserts final digest is written only after injection | Passing tests |
| `apps/engine-host/build-sea.mjs` | Create | INV-21/22 | Implements the frozen 9-step SEA procedure for the **only two CS02 targets** — `win32-x64` (VS lane) and `linux-x64` (Rider lane); emits per-file `engine-host.sha256`; aborts without an artifact on any failed step | Non-Node host runtimes |
| `apps/engine-host/package.json` | Modify | INV-20 | Version → `0.2.0`; add `build:bundle`, `build:sea` scripts | Version-aligned runtime |
| `packages/conformance/src/evidence.ts` | Modify | INV-14/15/30 | Add parameterized `verifyEvidenceBundleFor(spec, dir, subjectDigest)`; keep `verifyEvidenceBundle` as a **strict CS01/C1 wrapper** pinned to the original literals; add `sourceIdentity` + `packageVersion` checks for CS02 specs | Multi-host verification without breaking C1 |
| `packages/conformance/src/evidence.test.ts` | Modify | INV-14/15/30 | Existing C1 cases unchanged and still passing; new CS02 cases: wrong host, wrong change set, C1-envelope-substitution rejected, `sourceIdentity` mismatch rejected, local `not-run` cannot overwrite valid external `passed` | Passing tests |
| `packages/contracts/src/platform-readiness.ts` | Modify | INV-14/15 | Parameterize the pinned change-set literals into `changeSetIdSchema`; add `cs02EvidenceEnvelopeSchema` requiring `sourceIdentity`, `packageVersion`, `host` | CS02 envelope distinct from C1 |
| `packages/contracts/src/platform-readiness.test.ts` | Modify | INV-14/15 | C1 envelope still validates; a C1 envelope with substituted strings fails the CS02 schema | Passing tests |
| `scripts/import_cs02_evidence.mjs` | Create | INV-29/30 | `npm run evidence:import -- --host <host> --artifact <dir>`: verifies `sourceIdentity`, digests, host/check IDs, and producer authority before writing the tracked bundle | Governed external import |
| `scripts/build_cs02_release.mjs` | Create | PLT-29, INV-12/20/28 | Builds locally buildable artifacts (Engine Host bundle + SEA where the platform allows, VS Code VSIX, Kiro VSIX), normalizes names into `dist/phase0/cs02/`, writes `package-manifest.json` with **discriminated `built`/`not-built` entries** and `SHA256SUMS.txt` containing **only existing files** | Truthful release pipeline |
| `apps/vscode/README.md` | Modify | PLT-03/20 | Install, Engine Host bootstrap + digest verification, provider prerequisites, model truth, uninitialized behavior, limitations, test commands, upgrade, uninstall, rollback | PO-operable docs |
| `apps/visual-studio/README.md` | Modify | PLT-04/34 | Same sections for the out-of-process model + Windows lane | PO-operable docs |
| `apps/rider/README.md` | Modify | PLT-31/35 | Same sections + `buildPlugin`/`verifyPlugin`/`runIde` and install-from-disk | PO-operable docs |
| `apps/kiro/README.md` | Create | PLT-32/33 | Same sections + Kiro-specific install and smoke steps | PO-operable docs |
| `docs/06_Roadmap/CS02_INSTALL_AND_RELEASE_GUIDE.md` | Create | PLT-29 | Root guide: build, artifacts, install per host, evidence import, rollback | Single PO entry point |
| `examples/phase0-provider-model/README.md` | Create | PLT-28 (regression), PLT-29 | Exact scenario + commands | Documented example |
| `examples/phase0-provider-model/run.mjs` | Create | PLT-11/18/19/29 | Executes the §6 scenario; emits acceptance report + evidence manifest | Runnable example |
| `examples/phase0-provider-model/.gitignore` | Create | INV-17 | Ignores `evidence/` raw logs only | Raw logs untracked |
| `examples/phase0-provider-model/acceptance/GAEP-P0-CS02_ACCEPTANCE_REPORT.json` | Create (generated, tracked) | PLT-29 | Normalized acceptance report | Durable evidence |
| `examples/phase0-provider-model/acceptance/GAEP-P0-CS02_EVIDENCE_MANIFEST.md` | Create (generated, tracked) | PLT-29, INV-15 | Hashes every tracked CS02 artifact; states no-authenticity | Durable manifest |
| `dist/phase0/cs02/package-manifest.json` | Create (generated, tracked) | PLT-29, INV-12/20 | One entry per artifact with the 13 required fields | Machine-readable manifest |
| `dist/phase0/cs02/SHA256SUMS.txt` | Create (generated, tracked) | PLT-29 | SHA-256 of each produced artifact | Checksums |
| `.gitignore` | Modify | INV-12 | Ignore `dist/phase0/cs02/*.vsix` and `*.zip` (binaries) while tracking `package-manifest.json` + `SHA256SUMS.txt` | Binaries untracked, provenance tracked |
| `package.json` (root) | Modify | PLT-29 | Add `release:cs02`, `example:cs02`, `evidence:cs02` scripts; add `apps/kiro` workspace | Commands runnable |
| `tsconfig.json` (root) | Modify | — | Add `apps/kiro` reference if it emits TS (else `N/A — bundler-only`) | Typecheck covers it |
| `package-lock.json` | Modify | — | Regenerated by `npm install` for the new `apps/kiro` workspace and the `postject` devDependency | Deterministic install |
| `docs/06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md` | Modify (**Stage B only**) | PLT-* | Touched rows, Status Summary, Change Log per §11 | Accurate tracker |

**Generated-artifact ownership:** `scripts/build_cs02_release.mjs` creates the release artifacts, manifest, and checksums at release time; `examples/phase0-provider-model/run.mjs` creates the acceptance report and evidence manifest at example time. Binaries are untracked; manifest, checksums, acceptance report, and evidence manifest are tracked and digest-verified. No **Delete** or **Move** is proposed.

### Allowed implementation deviations

- A handoff may record a smaller internal variation only when all frozen invariants, paths, outputs, compatibility rules, and acceptance tests remain unchanged.
- Any change to product behavior, trust boundaries, artifacts, public contracts, Feature scope, or acceptance criteria requires a revised report and new approval.

## 6. Expected Product Output

- **User-visible behavior:** open the GAEP surface; see Platform/Host Readiness (works uninitialized); see a friendly "Initialize Product first" prerequisite for Product actions; after initialization, probe providers, pick provider + model, run one bounded read-only analysis, watch run state, read a sanitized result, and see truth class, capability digest, freshness, and evidence.
- **IDE commands, panels, dashboards, settings:** VS Code commands `GAEP: Select Provider`, `GAEP: Select Model`, `GAEP: Run Read-Only Analysis`, `GAEP: Cancel Analysis`, `GAEP: Show Agent and Model Dashboard`, plus existing `GAEP: Show Platform Readiness`. Equivalent native actions in the Visual Studio tool window, Rider tool window, and Kiro surface.
- **Provider/model behavior:** Codex and Claude Code share one selection contract; Codex models are `observed` only from an executed catalog; Claude `sonnet`/`opus` remain `provider-declared` aliases; custom IDs are `configured`; detection never implies authentication.
- **Generated packages/artifacts and exact paths:** `dist/phase0/cs02/gaep-vscode-0.2.0.vsix`, `dist/phase0/cs02/Gaep.VisualStudio-0.2.0.vsix`, `dist/phase0/cs02/gaep-rider-0.2.0.zip`, `dist/phase0/cs02/gaep-kiro-0.2.0.vsix`, `dist/phase0/cs02/package-manifest.json`, `dist/phase0/cs02/SHA256SUMS.txt`.
- **Realistic example path and exact run command:** `examples/phase0-provider-model/` — `npm run example:cs02`.
- **Expected reports, digests, and evidence:** `examples/phase0-provider-model/acceptance/GAEP-P0-CS02_ACCEPTANCE_REPORT.json` and `GAEP-P0-CS02_EVIDENCE_MANIFEST.md`, plus per-host bundles at `examples/phase0-provider-model/acceptance/<host>/{readiness-evidence.json,observation.json,evidence-manifest.json}` where `<host>` ∈ `vscode`, `visual-studio`, `rider`, `kiro`.

| IDE | Expected package | Install method | Test method | Expected user-visible result | Truth state if not executed |
|---|---|---|---|---|---|
| VS Code | `dist/phase0/cs02/gaep-vscode-0.2.0.vsix` (embeds `gaep-engine-host-0.2.0.cjs`) | `code --install-extension <path>` | `npm run test:vscode:extension-host` + PO manual workflow | Full slice: readiness, selection, analysis, dashboard | `not-run` |
| Visual Studio | `dist/phase0/cs02/Gaep.VisualStudio-0.2.0.vsix` (embeds `win32-x64` SEA) | VSIXInstaller on Windows | `.github/workflows/cs02-visual-studio.yml` **build only** + PO manual install/workflow | Remote UI tool window with the same projection | **`not-built` + `pending-environment`** (no Windows/`dotnet` here) |
| Rider | `dist/phase0/cs02/gaep-rider-0.2.0.zip` (embeds the `linux-x64` SEA; other platforms unsupported in CS02) | Rider → Settings → Plugins → Install from Disk | `.github/workflows/cs02-rider.yml` (`buildPlugin`, `verifyPlugin`) **build only** + PO manual `runIde`/install workflow | Tool window with the same projection | **`not-built` + `pending-environment`** (no JDK here) |
| Kiro | `dist/phase0/cs02/gaep-kiro-0.2.0.vsix` (independent identity `gaep.gaep-kiro`) | Kiro extension install from VSIX | Kiro-specific smoke steps executed **in Kiro** | Same projection in Kiro | **`pending-environment`** (Kiro not installed; VS Code success is not Kiro evidence) |

> Do not claim four-IDE support when a host only has a scaffold or was not executed. VS Code success is explicitly **not** Kiro evidence.

### Artifact and evidence contract

| Artifact | Exact schema/fields | Producer | Consumer/verifier | Tracked? | Freshness/staleness rule |
|---|---|---|---|---:|---|
| `dist/phase0/cs02/package-manifest.json` | `{schemaVersion:1, changeSetId:"GAEP-P0-CS02", version:"0.2.0", sourceIdentity, artifacts:[…]}`; each entry is a **discriminated union on `buildState`** (11 common fields; `built` = 13 total with a required `artifactSha256`; `not-built` = 14 total with `artifactSha256: null` + required `notBuiltReason`; `artifactPath` is retained in both variants as the planned path) — see §4.5 | `scripts/build_cs02_release.mjs` | `examples/phase0-provider-model/run.mjs`, `scripts/import_cs02_evidence.mjs` | yes | Rejected if `sourceIdentity` ≠ recomputed identity, or any `built` entry's digest mismatches. **Never compared against current `HEAD`** |
| `dist/phase0/cs02/SHA256SUMS.txt` | `<sha256>  <relative-path>` per line, **only for artifacts that exist on disk** | `scripts/build_cs02_release.mjs` | example runner + PO | yes | Must match on-disk artifacts; a `not-built` artifact must be absent from this file |
| `dist/phase0/cs02/engine-host/engine-host.sha256` | `<sha256>  <runtime-file-name>` | `apps/engine-host/build-bundle.mjs` / `build-sea.mjs` | each host launcher before spawn | yes | Mismatch ⇒ refuse to spawn (INV-22) |
| `examples/phase0-provider-model/acceptance/<host>/readiness-evidence.json` | `cs02EvidenceEnvelopeSchema`: discriminated on `testOutcome`, plus **required** `parentChangeSetId:"GAEP-P0-CS02"`, `host`, `packageVersion:"0.2.0"`, `sourceIdentity`, `checkId`, `subjectDigest` | that host's own lane only | `verifyEvidenceBundleFor` | yes | Bound to `subjectDigest` **and** `sourceIdentity`; either mismatch ⇒ rejected |
| `examples/phase0-provider-model/acceptance/<host>/observation.json` | `observationResultSchema` (`{observation}` or `{observation:null}`) | that host's own lane only | `verifyEvidenceBundleFor` | yes | `null` only for not-executed |
| `examples/phase0-provider-model/acceptance/<host>/evidence-manifest.json` | Index hashing exactly `readiness-evidence.json` + `observation.json`; **does not hash itself** | that host's own lane only | `verifyEvidenceBundleFor` | yes | Exactly two entries; missing/dup/extra ⇒ reject |
| `examples/phase0-provider-model/acceptance/GAEP-P0-CS02_ACCEPTANCE_REPORT.json` | Normalized: `sourceIdentity`, providers, models + truth classes, selection, run record, host matrix, package-manifest digest | `run.mjs` | PO + evidence manifest | yes | Regenerated each run; digest recorded in the evidence manifest |
| `examples/phase0-provider-model/acceptance/GAEP-P0-CS02_EVIDENCE_MANIFEST.md` | Change Set ID, commands, results, environment, truth classes, known gaps, raw-output location, explicit **no-authenticity** statement, and SHA-256 of exactly: `GAEP-P0-CS02_ACCEPTANCE_REPORT.json`, `dist/phase0/cs02/package-manifest.json`, `dist/phase0/cs02/SHA256SUMS.txt`, and for each host with a bundle `acceptance/<host>/{readiness-evidence.json,observation.json,evidence-manifest.json}`. **It does not hash itself** | `run.mjs` | PO | yes | Any listed digest mismatch ⇒ acceptance fails |
| `examples/phase0-provider-model/evidence/**` | Raw machine-local logs | `run.mjs` | — | **no** (git-ignored) | Never tracked |

Digest algorithm: SHA-256 over **exact file bytes**. Path containment: every manifest path resolves inside its bundle root; absolute paths, `..`, and root-escapes are rejected. Fail-closed rules follow CS01-C1. **Current-attempt behavior is intentionally extended for CS02:** CS01-C1 had a single local producer, whereas CS02 adds per-host producer authority and external-lane import (INV-30) — a local `not-run` bundle cannot overwrite a valid external bundle whose `sourceTreeDigest` matches the current subject. This is a deliberate addition, not unchanged C1 behavior.

## 7. Architecture, Compatibility, and Recovery Impact

- **Shared-engine and host-adapter boundaries:** the engine gains `ProviderCatalogService`, `ReadOnlyAnalysisService`, and `buildDashboardProjection`; the engine-host exposes them at v3. Hosts become thin clients. `apps/vscode/src/run-terminal.ts` is untouched and unused by CS02 analysis, ending the VS Code execution fork for this capability.
- **Public/runtime contract changes:** protocol `3`; eight additive v3-only methods; three new contract modules. No existing schema field changes shape.
- **Portable `.gaep` impact:** **no new selection file.** `.gaep/runtime/selection.json` (`agentSelectionSchema` v2) remains the single selection record; CS02 adds only `.gaep/runs/**`, `.gaep/evidence/**`, `.gaep/audit/**` events, and governed Context Pack records. The Engine Host PID/lock lives **outside** the workspace (§4.1) and never enters portable state. All records are portable — no absolute paths, credentials, session IDs, or env values.
- **Provider-adapter impact:** adapters keep their probe contracts; CS02 consumes the existing read-only invocation builders. Claude effectful invocation remains blocked.
- **Backward/forward compatibility:** v1/v2 requests are unchanged and regression-tested; v1/v2 clients calling a v3 method receive `PROTOCOL_UPGRADE_REQUIRED` (`-32021`). A v3 client against an older host receives `UNSUPPORTED_PROTOCOL_VERSION` and must degrade to readiness-only.
- **Migration requirements:** **none — and none are introduced.** CS02 deliberately retains `agentSelectionSchema` v2 at `.gaep/runtime/selection.json` and the existing v1 compatibility reader, so there is no selection schema or path migration, no migration trigger, and no migration rollback. Run and evidence directories are created on first use.
- **Security/permission impact:** provider processes run read-only (Codex read-only sandbox; Claude tool-free from an empty temp cwd) with an allowlisted child environment; no credential is read. **A provider CLI performs its own network transport to its vendor service — CS02 neither prevents nor claims to prevent that.** What GAEP guarantees is that it grants **no arbitrary workspace Tool authority and no additional network authority**: no tools, no MCP, no browser, no write capability. The Engine Host runtime is digest-verified before launch and never resolved from `PATH` in a production package.
- **Failure containment and fail-closed behavior:** any guard violation, schema failure, digest mismatch, or evidence problem fails the run or rejects the evidence; nothing is inferred and no older `passed` survives.
- **Rollback/recovery procedure and preserved evidence:** uninstall the IDE artifact (`code --uninstall-extension gaep.gaep-vscode`, Rider plugin remove, VSIXInstaller `/u`, Kiro extension remove); `.gaep` run/evidence/audit records are retained; the host conformance row returns to `not-run`; re-installing 0.2.0 and re-running the workflow restores a `passed` row only after real execution.

## 8. Dashboard Impact

| Dashboard/view | New or changed information | Authoritative data source | Truth/freshness cue | Empty/error/not-run state |
|---|---|---|---|---|
| Platform/Host Readiness | Unchanged fields + CS02 host rows | `engine.computePlatformReadiness()` + `packages/conformance` observations | `observedAt`, `truthClass`, `evidenceSource` | `not-run` / `pending-environment` |
| Agent/Model (new) | Product/workspace state; provider name + adapterId; detection state; runtime version; auth readiness + truth class; model list; model truth class; alias/configured/observed; current selection; capability digest; last probe time + freshness; current/last run state; sanitized completion/failure category; evidence source + digest; host package/conformance state | `engine.buildDashboardProjection()` (composing `probeAgents`, `GaepEngine.readSelection`, `ReadOnlyAnalysisService.read`, conformance matrix) | Per-field `truthClass` + `observedAt`; `stale` when older than the current subject/probe | `product-uninitialized`, `provider-unavailable`, `run-not-run`, `evidence-invalid`, `evidence-stale` |
| Change/Impact | `N/A — reason: unchanged in CS02 (no effectful change surface)` | — | — | — |

Every displayed field is a projection of an engine value; no host computes or overrides a displayed truth.

## 9. Validation and Acceptance Plan

| ID | Criterion / invariant | Exact test or command | Expected result | Environment | Evidence path |
|---|---|---|---|---|---|
| AC-01 | Type safety | `npm run typecheck` | clean | current | terminal |
| AC-02 | Full suite incl. new contracts/services | `npm test` | all pass | current | terminal |
| AC-03 | v3 negotiation + v1/v2 regression (INV-18) | `npm test -- apps/engine-host/src/host.test.ts` | v3 ok; v1/v2 → `PROTOCOL_UPGRADE_REQUIRED`; legacy unchanged | current | terminal |
| AC-04 | Catalog truth classes (INV-06/31) | `npm test -- packages/contracts/src/provider-catalog.test.ts` | alias≠observed; configured labelled; caller cannot supply `truthClass` | current | terminal |
| AC-05 | Codex read-only enforcement (INV-03) | `npm test -- packages/engine/src/read-only-analysis.test.ts -t codex` | read-only sandbox asserted; no write capability | current | terminal |
| AC-06 | Claude read-only/context-only (INV-03) | `npm test -- packages/engine/src/read-only-analysis.test.ts -t claude` | tool-free, empty cwd asserted | current | terminal |
| AC-07 | Provider absence + auth-unverified (INV-07/08) | `npm test -- packages/engine/src/read-only-analysis.test.ts -t unavailable` | `not-observed`/`not-run`; never passed | current | terminal |
| AC-08 | Switching + provenance (INV-09/10/23) | `npm test -- packages/engine/src/provider-catalog.test.ts` | prior runs/digest/audit preserved; only `.gaep/runtime/selection.json` written | current | terminal |
| AC-09 | Product source mutation detection (INV-04) | `npm test -- packages/engine/src/source-guard.test.ts` | mutation ⇒ run failed | current | terminal |
| AC-10 | Exact governed allowlist (INV-05) | `npm test -- packages/engine/src/source-guard.test.ts -t allowlist` | Only `.gaep/runtime/selection.json`, `.gaep/runs/**`, `.gaep/evidence/**`, `.gaep/audit/**`, and governed Context Pack records are permitted; any other `.gaep` path or any path outside it ⇒ violation | current | terminal |
| AC-11 | Uninitialized-workspace friendly UX (INV-16) | `npm test -- apps/vscode/src/provider-model-view.test.ts -t uninitialized` | "Initialize Product first"; no ENOENT/stack/path | current | terminal |
| AC-12 | Sanitization (INV-17) | `npm test -- packages/contracts/src/read-only-analysis.test.ts -t sanitiz` | no absolute path/newline/stderr/secret persisted | current | terminal |
| AC-13 | Missing/tampered/mismatched/stale evidence (INV-14) | `npm test -- packages/conformance/src/evidence.test.ts` | all rejected; no stale pass | current | terminal |
| AC-14 | Executed-only host rows (INV-13) | `npm test -- packages/conformance/src/host-conformance.test.ts` | non-executed ⇒ no observation | current | terminal |
| AC-15 | VS Code build/package | `npm run release:cs02` | `gaep-vscode-0.2.0.vsix` + manifest + checksums | current | `dist/phase0/cs02/` |
| AC-16 | VS Code install/upgrade/uninstall | `code --install-extension …0.2.0.vsix`; re-install over 0.1.0; `code --uninstall-extension gaep.gaep-vscode` | all succeed | current + PO | evidence manifest |
| AC-17 | VS Code workflow smoke | `npm run test:vscode:extension-host` | PASS incl. new commands + projection | current | `acceptance/vscode/` |
| AC-18 | Visual Studio **build only** (INV-29) | `.github/workflows/cs02-visual-studio.yml` | `win32-x64` SEA + VSIX built; publishes `buildState` only — `installTestState`/`workflowTestState` remain `not-run` | **external (Windows + VS 2022)** | `acceptance/visual-studio/` |
| AC-19 | Rider **build + verify only** (INV-29) | `.github/workflows/cs02-rider.yml` (`linux-x64` SEA, `./gradlew buildPlugin verifyPlugin`) | plugin zip + verifier report; publishes `buildState` only — `runIde`/install/workflow remain `not-run` | **external (JDK 21)** | `acceptance/rider/` |
| AC-20 | Kiro install/launch/workflow executed **in Kiro** (INV-29) | Kiro-specific smoke steps from `apps/kiro/README.md` executed in Kiro | install + workflow evidence; README steps alone are **not** evidence | **external (Kiro install)** | `acceptance/kiro/` |
| AC-21 | Checksum + version alignment (INV-20/28) | `npm run release:cs02 -- --verify` | every **built** artifact is `0.2.0` with a matching SHA-256 present in `SHA256SUMS.txt`; every `not-built` entry has `artifactSha256: null` + `notBuiltReason` and is **absent** from `SHA256SUMS.txt` | current | `SHA256SUMS.txt` |
| AC-22 | Realistic example | `npm run example:cs02` | acceptance report + evidence manifest, digests verified | current | `acceptance/` |
| AC-23 | Real Claude read-only analysis | `npm run example:cs02` (Claude present) | run `completed`, sanitized result, no source change | current (Claude 2.1.218) | acceptance report |
| AC-24 | Real Codex analysis | `npm run example:cs02` (Codex absent) | recorded `not-run`; never passed | **requires Codex runtime** | acceptance report |
| AC-25 | Documentation/lifecycle validation | `npm run validate:docs` and `npm run test:lifecycle` | PASS | current | terminal |
| AC-26 | Rollback/recovery | uninstall then re-verify | host row returns to `not-run`; `.gaep` evidence retained | current + PO | evidence manifest |
| AC-27 | PO manual acceptance | install artifact, open IDE, select provider+model, run analysis, inspect result | truthful result visible | **Product Owner** | acceptance note |
| AC-28 | Engine Host digest verification (INV-21/22) | `npm test -- apps/vscode/src/engine-host-client.test.ts` | mismatch/missing digest ⇒ refuse to spawn; no PATH fallback | current | terminal |
| AC-29 | Dev override gating (INV-21) | same suite, `-t dev-override` | `GAEP_ENGINE_EXECUTABLE` ignored unless `GAEP_DEV_ENGINE=1` | current | terminal |
| AC-30 | VS Code uses the RPC boundary (INV-01) | `npm test -- apps/vscode/src/engine-host-client.test.ts -t rpc-boundary` | CS02 commands issue `protocolVersion: 3` RPC, not in-process engine calls | current | terminal |
| AC-31 | One selection source of truth (INV-23) | `npm test -- packages/engine/src/provider-catalog.test.ts -t single-source` | only `.gaep/runtime/selection.json` written; `selectProviderModel` delegates to `selectAgent` | current | terminal |
| AC-32 | Concurrency/idempotency/cancel races (INV-25/26) | `npm test -- packages/engine/src/read-only-analysis.test.ts -t lifecycle` | second start ⇒ `ANALYSIS_ALREADY_RUNNING`; repeated key returns same run; terminal states immutable | current | terminal |
| AC-33 | Orphan recovery | same suite, `-t orphan` | stale `running` ⇒ `failed`/`process-loss`; terminal untouched | current | terminal |
| AC-34 | Bounded identical context (INV-24) | `npm test -- packages/engine/src/read-only-analysis.test.ts -t context` | same normalized text + digest for both providers; >256 KiB ⇒ `CONTEXT_TOO_LARGE` | current | terminal |
| AC-35 | Auth resolution path | same suite, `-t auth` | attempt allowed from `auth-unverified`; success ⇒ `auth-ready`; classified failure ⇒ `auth-unavailable`; no raw error persisted | current | terminal |
| AC-36 | Source identity non-self-reference (INV-27) | `npm test -- packages/engine/src/source-identity.test.ts` | generated outputs excluded; committing a manifest does not change identity | current | terminal |
| AC-37 | C1 evidence still verifies (INV-15) | `npm test -- packages/conformance/src/evidence.test.ts -t GAEP-P0-CS01` | all pre-existing C1 cases pass unchanged | current | terminal |
| AC-38 | CS02 envelope cannot be forged from C1 | same suite, `-t substitution` | string-substituted C1 envelope fails the CS02 schema | current | terminal |
| AC-39 | Import authority (INV-30) | `npm test -- packages/conformance/src/evidence.test.ts -t import-authority` | local `not-run` cannot overwrite a valid external current-subject `passed` | current | terminal |
| AC-40 | Discriminated artifact truth (INV-28) | `npm run release:cs02 -- --verify` | `not-built` entries have `artifactSha256: null` + reason and are absent from `SHA256SUMS.txt` | current | `package-manifest.json` |
| AC-41 | Build ≠ install ≠ workflow (INV-29) | `npm run evidence:import -- --host visual-studio --artifact <ci-dir>` | a build-only lane sets `buildState` only; install/workflow stay `not-run` | external | `acceptance/visual-studio/` |

### Required command set

- **Typecheck:** `npm run typecheck`
- **Unit/integration tests:** `npm test`
- **Documentation/lifecycle validation:** `npm run validate:docs` && `npm run test:lifecycle`
- **Host packaging/install test per applicable IDE:** `npm run release:cs02`; `npm run test:vscode:extension-host`; `.github/workflows/cs02-visual-studio.yml`; `.github/workflows/cs02-rider.yml`; `apps/kiro/README.md`
- **Realistic example:** `npm run example:cs02`
- **Evidence/digest verification:** `npm run evidence:cs02`
- **Product Owner manual test:** install `dist/phase0/cs02/gaep-vscode-0.2.0.vsix`, open VS Code, run `GAEP: Show Platform Readiness`, confirm the friendly uninitialized state, initialize the example Product, run `GAEP: Select Provider` → Claude Code, `GAEP: Select Model` → `sonnet`, `GAEP: Run Read-Only Analysis`, then `GAEP: Show Agent and Model Dashboard`.

**Environment split.** *Current macOS machine:* AC-01…AC-17, AC-21…AC-23, AC-25, AC-26, **AC-28…AC-40**. *Requires Windows + Visual Studio:* AC-18. *Requires JDK 21 (and Rider for manual):* AC-19. *Requires Kiro installation:* AC-20. *Requires an available/authenticated Codex runtime:* AC-24. *Requires an available/authenticated Claude Code runtime:* AC-23 (satisfied locally). *External lane import:* **AC-41**. *Product Owner manual:* AC-16 (partly), AC-27.

### Definition of Ready for Test

- [ ] Every approved file change is present; no unapproved scope expansion.
- [ ] Pre-existing user changes are preserved.
- [ ] All applicable positive and negative tests pass.
- [ ] Generated artifacts are present, sanitized, tracked/ignored as specified, and digest-verified.
- [ ] Unavailable environments remain explicitly `not-run`/`pending-environment`; no inferred pass.
- [ ] Tracker counts, touched Feature rows, Change Log, report status, and Register status agree.
- [ ] No Feature is set to `✅ Done` before explicit Product Owner acceptance.
- [ ] Handoff lists deviations, final commands/results, exact artifact paths/digests, known gaps, and manual acceptance steps.

## 10. Risks, Blockers, and Decisions Required

| ID | Type | Description | Impact | Required decision / mitigation | Owner | Must resolve before approval? |
|---|---|---|---|---|---|---:|
| R-01 | Environment | Codex absent | No real Codex execution evidence | Record `not-run`; never claim pass | Product Owner | no |
| R-02 | Environment | No Windows/`dotnet` | VS artifact cannot be built here | External lane `.github/workflows/cs02-visual-studio.yml`; row stays `pending-environment` until it runs | Product Owner | no |
| R-03 | Environment | No JDK | Rider artifact cannot be built here | External lane `.github/workflows/cs02-rider.yml` | Product Owner | no |
| R-04 | Environment | Kiro not installed | No Kiro install/workflow evidence | Produce the package; smoke steps documented; row `pending-environment` | Product Owner | no |
| R-05 | Architecture | Legacy VS Code `run-terminal.ts` staged path remains | Two execution paths coexist | CS02 forbids its use for analysis; full removal deferred to the effectful CS | Product Owner | no |
| R-06 | Truth | Claude exposes no model catalog | Models stay `provider-declared` | Never relabel aliases as observed | Product Owner | no |
| R-07 | Security | Provider stdout may embed paths/secrets | Leak into tracked evidence | Truncate 8 KiB, strip control chars, redact path-shaped substrings, never persist stderr | Product Owner | no |
| R-08 | Scope | CI lanes need a GitHub runner | Lanes may not execute soon | Lanes are defined and committed; evidence only when actually run | Product Owner | no |

All implementation-affecting decisions are frozen in §4–§8; the remaining items are genuine external environment blockers, not implicit assumptions.

## 11. Tracker Impact Preview

**Every transition below is conditional on the evidence actually produced during Stage B.** If the required evidence is not produced, the Feature keeps its current status. Shared-code success and VS Code success never advance a cross-host Feature.

- **PLT-03:** `🟡 In Progress` → `🧪 Ready for Test` — **the only Feature eligible for `🧪 Ready for Test` in CS02.** Reason: complete VS Code package lifecycle. Required evidence: `dist/phase0/cs02/gaep-vscode-0.2.0.vsix` built, installed, upgraded over 0.1.0, uninstalled, extension-host workflow executed, and `acceptance/vscode/` bundle imported with matching `sourceIdentity`. If any step is missing, PLT-03 stays `🟡 In Progress`.
- **PLT-04:** `❌ Backlog` → `🟡 In Progress` — Reason: out-of-process `VisualStudio.Extensibility` project and Windows lane created but neither built nor installed here. Required evidence: committed project + workflow; `buildState` only from the lane.
- **PLT-11, PLT-32, PLT-33, PLT-34, PLT-35:** `❌ Backlog` → `🟡 In Progress` — Reason: Claude read-only analysis path (PLT-11) is implemented and executed on **one** host only; Kiro package/harness and the VS/Rider lanes exist but were not executed in their required environments. Required evidence: committed implementation/workflow files with host rows explicitly `not-run`/`pending-environment`.
- **PLT-01, PLT-05, PLT-07, PLT-08, PLT-09, PLT-10, PLT-14, PLT-15, PLT-16, PLT-18, PLT-19, PLT-20, PLT-21, PLT-24, PLT-26, PLT-27, PLT-29, PLT-31:** remain `🟡 In Progress` — Reason: each requires evidence CS02 cannot produce in this environment (four-host execution, a Codex runtime, Windows, a JDK, or a Kiro install). Their implementation lands, but no complete acceptance evidence exists, so **none** advances to `🧪 Ready for Test`.
- **PLT-06 and PLT-28:** unchanged `✅ Done`; regression evidence only, not reopened.
- **Status Summary delta (recalculated from the evidence-based transitions above):**
  - Cross-platform capabilities: `35 | ✅ 4 | 🟡 21 → 26 | 🧪 0 → 1 | ❌ 10 → 4` (PLT-03 IP→RfT; PLT-04, PLT-11, PLT-32, PLT-33, PLT-34, PLT-35 Backlog→IP). Check: 4 + 26 + 1 + 4 = **35** ✓
  - All tracked features: `168 | ✅ 5 | 🟡 80 → 85 | 🧪 0 → 1 | ❌ 83 → 77`. Check: 5 + 85 + 1 + 77 = **168** ✓
  - If PLT-03's lifecycle evidence is incomplete, the delta becomes `🟡 86 / 🧪 0` and the summary is recomputed accordingly.
- **Change Log entry to add:** one row dated 2026-07-24, actor Claude Code, phase `Phase 0 / 1A`, listing the transitions above, the exact commands and results, artifact paths and digests, Product Owner acceptance `Not accepted — awaiting test`, and the note that no Feature became `✅ Done`.

> Implementation may advance a Feature only to `🧪 Ready for Test`. Never to `✅ Done` before Product Owner acceptance.

## 12. Approval Request

**Resolved — approved and Stage B implemented.** The Stage A request is retained as history; it is no longer a live state.

> *(Stage A, historical)* "Proposed approval command: `APPROVE GAEP-P0-CS02 EXACTLY AS PROPOSED` — AWAITING PRODUCT OWNER APPROVAL."

**Product Owner approval (recorded):** 2026-07-24 — `APPROVE GAEP-P0-CS02 EXACTLY AS PROPOSED`.

**Stage B handoff (recorded):** implemented 2026-07-24. Tracker transitions applied: PLT-04, PLT-11, PLT-32, PLT-33, PLT-34, PLT-35 `❌ Backlog -> 🟡 In Progress`. PLT-03 remains `🟡 In Progress` pending Product-Owner install/upgrade/uninstall/workflow evidence. No feature is `✅ Done`; Product Owner test and acceptance remain outstanding.
