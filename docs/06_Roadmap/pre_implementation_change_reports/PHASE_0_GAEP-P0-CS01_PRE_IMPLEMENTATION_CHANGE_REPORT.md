# GAEP Phase 0 Pre-Implementation Change Report

| Field | Value |
|---|---|
| **Report ID** | GAEP-P0-CS01 |
| **Roadmap phase** | Phase 0 (internal milestone: Phase 1A — Four-IDE Platform Foundation) |
| **Change Set ID** | GAEP-P0-CS01 |
| **Scope (Feature IDs audited)** | PLT-01 … PLT-35 (PLT-30 analyzed as a Phase 2 dependency only) |
| **Status** | Implemented — Ready for Test |
| **Revision** | R5 |
| **Product Owner approval** | 2026-07-24 — `APPROVE GAEP-P0-CS01 EXACTLY AS PROPOSED` |
| **Stage B handoff** | Implemented 2026-07-24; PLT-27 → `🟡 In Progress`, PLT-28 → `🧪 Ready for Test`, PLT-29 → `🟡 In Progress`. See the Change Log in [054_GAEP_FEATURE_DELIVERY_TRACKER.md](../054_GAEP_FEATURE_DELIVERY_TRACKER.md). Corrections tracked by [GAEP-P0-CS01-C1](PHASE_0_GAEP-P0-CS01-C1_PRE_IMPLEMENTATION_CHANGE_REPORT.md). |
| **Date** | 2026-07-24 |
| **Author** | Claude Code |
| **Supersedes / Superseded by** | — |

### Revision history

| Revision | Date | Change |
|---|---|---|
| R1 | 2026-07-24 | Initial Stage A report. |
| R2 | 2026-07-24 | Revised in response to Codex review verdict **REVISION REQUIRED**. Corrections: real `validate:docs` = FAIL recorded + validator Stage B change planned; canonical `packages/contracts/src/host.ts` RPC contract changes added; cross-host consumption claim corrected (VS Code uses in-process `GaepEngine`; Rider/VS clients omit `protocolVersion: 2`; Kiro has no client — cross-host client wiring deferred to a later CS); readiness truth model corrected (host rows are explicit conformance observations, never inferred from `probeAgents()`/`workspaceHealth()`); workspace-package plan completed (root `tsconfig.json` + `package-lock.json`); durable Evidence Manifest added and made a precondition for PLT-28; D1/D2/D3 resolved. Change Set ID, `Awaiting Approval` status, and tracker statuses unchanged. |
| R3 | 2026-07-24 | Second Codex-review revision. Corrections: removed the stale "docs validation PASS" statement from the Executive Summary (code tests pass; doc validation currently FAILS with the 3 known mapping errors); defined the exact Base-Snapshot → HostConformanceObservation → Final Report **merge flow** and named the responsible function/contract/file; VS Code host-conformance is `passed` only when the extension-host E2E actually passes, otherwise `not-run` (engine/RPC/unit/command-registration tests are not host-conformance evidence); corrected the E2E file plan (`run.mjs` removed unless the runner needs changes; assertions go in `apps/vscode/test/e2e/suite/index.cjs`, executing and verifying read-only command behavior); added a tracked normalized `GAEP-P0-CS01_READINESS_REPORT.json` referenced+hashed by the Evidence Manifest, with PLT-28 gated on both. Change Set ID, `Awaiting Approval` status, and tracker statuses unchanged. |
| R5 | 2026-07-24 | Governance reconciliation under approved correction set GAEP-P0-CS01-C1: recorded the exact Product Owner approval (`APPROVE GAEP-P0-CS01 EXACTLY AS PROPOSED`, 2026-07-24) and the Stage B handoff; set `Status = Implemented — Ready for Test` to match the Change Set Register; removed the stale live `Awaiting Approval` / "Stage B has not started" state (retained only as quoted Stage A history). Tracker statuses unchanged by this revision. |
| R4 | 2026-07-24 | Consistency-only Codex-review revision (no design expansion). Corrections applied consistently across Proposed Change Set, Exact Planned File Changes, Expected Product Output, Architecture Impact, Validation Plan, and Tracker Impact Preview: the engine's `computePlatformReadiness()` produces **only** the Base Snapshot and accepts **no** host-conformance input (its four IDE rows stay `not-run`/`pending-environment`); a non-executed host produces **no** `HostConformanceObservation`, so Visual Studio/Rider/Kiro produce none and keep their Base defaults, and VS Code produces one only if its extension-host E2E executes (else no observation, stays `not-run`); the **engine-host RPC boundary check is a contract/boundary result, not an IDE host row**, and the Four-IDE matrix contains only VS Code/Visual Studio/Rider/Kiro; `composePlatformReadinessReport` **rejects direct host-state overrides** and accepts only schema-validated observations with `host, checkId, state, truthClass, observedAt, evidenceSource, executionResult, evidenceDigest` — provenance is recorded and validated against the Evidence Manifest, **TypeScript types do not authenticate the producer and cryptographic authenticity is not established by this CS**; only machine-local raw logs under `evidence/` are git-ignored while the normalized JSON + Manifest under `acceptance/` stay tracked. Change Set ID, `Awaiting Approval` status, and tracker statuses unchanged. |

> Stage A is read-only. No source, configuration, dependency, lockfile, generated artifact, or the delivery tracker has been modified by this assessment or this revision. The working tree was verified before and after all read-only checks (typecheck, `vitest`, and docs validation) and is unchanged.

## 1. Executive Summary

**Current condition.** The Phase 0 foundation is real but **single-host**. There is a genuine shared TypeScript engine (`packages/engine`), a shared contracts/agent-SDK layer, a working engine-host JSON-RPC boundary (`apps/engine-host`), and a substantial VS Code extension (~1,949-line `extension.ts`). **Build truth:** code tests pass (`npm test` → 36 files / 309 passed, 1 skipped; `npm run typecheck` clean), but **documentation validation currently FAILS** — `npm run validate:docs` returns `result: FAIL` with the three known operational-report mapping errors (this reports folder's files are treated as unmapped legacy documents; see §2 and the Stage B validator fix in §5/§9). The other three IDEs are **not at parity**: Visual Studio is a plain `net8.0` class library (not a VSIX project), Rider is a ~137-line Kotlin scaffold with a real IntelliJ-Platform Gradle config, and **Kiro has no code at all**. Provider execution (managed Codex/Claude runs, staging, terminals) currently lives **inside the VS Code extension**, not in the shared engine — so the RPC boundary the other three hosts consume cannot yet drive governed execution. This is the central architectural gap behind the "four-IDE parity" claim.

**Most important verified gaps.**
1. **No host-neutral readiness/conformance surface.** There is no single, shared "Platform/Host Readiness" snapshot produced by the engine and consumed identically by all hosts — the Phase 0 dashboard has no real cross-host data source (PLT-21/22/24/26 are VS-Code-only tree views).
2. **No conformance suite, example runner, or acceptance-report pipeline** (PLT-27/28/29 are Backlog) — there is no repeatable evidence artifact for Phase 0.
3. **Execution logic is forked into the VS Code host**, weakening the "one shared engine, no behavioral forks" requirement (PLT-01).

**Recommended first change set (GAEP-P0-CS01).** Implement a **host-neutral Platform Readiness computation in the shared engine**, add a canonical **engine-host v2 RPC endpoint** (`platformReadiness`) for out-of-process hosts to consume in a *later* change set, add a **conformance-harness skeleton** and a **runnable Phase-0 readiness example** that emits durable, inspectable evidence, and add a **read-only VS Code surface** that reads the snapshot **in-process via `GaepEngine`** (VS Code's actual architecture today). This CS does **not** wire Visual Studio, Rider, or Kiro clients to the new endpoint.

**Why first.** This is the smallest vertical slice that creates the *single real data source* every Phase 0 dashboard, conformance check, and acceptance report depends on. It is fully testable in this macOS environment (no Codex, Windows, Java, or Kiro required), it moves execution-relevant truth into the shared engine (advancing PLT-01), and it establishes the evidence pipeline (PLT-28) before any four-IDE packaging work — which cannot be validated here anyway.

## 2. Repository and Baseline State

- **Current branch:** `codex/gaep-founder-edition` (tracks `origin/codex/gaep-founder-edition`).
- **Working-tree state (must be preserved — all pre-existing):**
  - `M docs/000_READ_FIRST.md`
  - `M docs/GAEP_PLATFORM_PRODUCT_IDENTITY_MANIFEST.md`
  - `M docs/next/08_Roadmap_and_Adoption/004_LEGACY_MIGRATION_MAP.md`
  - `?? docs/06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md` (untracked — the governing tracker itself)
  - `?? .idea/claudeCodeEditorTabs.xml` (IDE-generated during the session; not authored here, not touched)
  - This report and its folder are new documentation artifacts, created at the Product Owner's explicit request; they do not implement GAEP-P0-CS01.
- **Available build/test commands (verified present):** `npm run build`, `npm run typecheck` (✅ passed), `npm test` → vitest (✅ **36 files / 309 passed, 1 skipped**), `npm run validate:docs` → ruby (❌ **result: FAIL — see below**), `npm run package:vscode` (vsce present in `node_modules/.bin`), `npm run test:vscode:extension-host` (downloads Electron — **not run**, avoids network/side effects).
- **Documentation validation — real current result:** `npm run validate:docs` returns **`result: FAIL`** with exactly **3 errors** (0 warnings). All three are attributed to `docs/next/08_Roadmap_and_Adoption/004_LEGACY_MIGRATION_MAP.md` and read `missing legacy document 06_Roadmap/pre_implementation_change_reports/<file>` for the three files in this reports folder (`README.md`, `_TEMPLATE_PHASE_N_PRE_IMPLEMENTATION_CHANGE_REPORT.md`, and this report). **Root cause (verified):** `scripts/validate_next_docs.rb` (lines ~415–423) globs every non-`docs/next` Markdown file under `docs/` and errors unless each is backtick-referenced in the legacy migration map. It therefore treats these operational delivery records as *unmapped legacy documents*. The earlier R1 claim that validation "remains PASS" was incorrect and is retracted. The planned Stage B fix to the validator is in §5 and §9.
- **OS constraints:** Darwin 25.5.0 (arm64), Node 22+, Ruby 2.6.10 present.
- **Windows for Visual Studio validation:** ❌ not available; `dotnet` not installed.
- **Rider sandbox testing:** ❌ not available; no Java runtime and no Gradle (`runIde`/`buildPlugin` cannot execute here).
- **Kiro installation testing:** ❌ not available; no Kiro tooling and **no Kiro source in the repo**.
- **Codex / Claude Code executables:** Codex ❌ **not found on PATH**; Claude Code ✅ present at a Homebrew path.
- **Provider authentication readiness:** Cannot be safely determined. Only a non-effectful presence/version probe is appropriate; no command was run that would touch credentials, log in, or make network calls. No secrets/tokens/credentials are exposed in this report.

## 3. Evidence-Based PLT Feature Assessment

Evidence gathered by direct file inspection plus a full passing test run. "Done" claims for detection features are **runtime-unverified** here (Codex absent; Claude auth not probed).

| Feature ID | Tracker status | Evidence found | Verified gap | Recommended action | Proposed status after this CS |
|---|---|---|---|---|---|
| PLT-01 Shared Engine | 🟡 | `packages/engine` (engine/product-studio/managed-execution/repository) + engine-host RPC | Managed execution (runs/staging/terminals) lives in `apps/vscode/src`, not the shared boundary → host fork | Move readiness truth into engine; plan execution relocation later | 🟡 (evidence strengthened) |
| PLT-02 Portable `.gaep` | ✅ | `repository.ts`, `workspace-staging.ts`, `portable-boundary.test.ts`; tests pass | Only exercised via VS Code path | Keep; add to conformance regression | ✅ (unchanged) |
| PLT-03 VS Code VSIX | 🟡 | `apps/vscode` `vsce package` script, esbuild, e2e host tests | Not built/installed/accepted here | No change this CS | 🟡 |
| PLT-04 VS native VSIX | ❌ | `Gaep.HostClient.csproj` = `net8.0` **class library**, not VSIX | No VSIX project/manifest; no Windows/dotnet | No change (out of env) | ❌ |
| PLT-05 Four-IDE parity | ❌ | — | No conformance contract/matrix | Seed via PLT-27 skeleton | ❌ |
| PLT-06 Codex detection | ✅ | `adapters/codex` probe + `parseModelCatalog` + unit tests | **Codex not installed → runtime detection unverified**; no four-host regression | Flag discrepancy; keep, cover in conformance | ✅ (discrepancy noted) |
| PLT-07 Claude detection | 🟡 | `adapters/claude` probe; Claude exe present | Auth/readiness + host paths incomplete | No change this CS | 🟡 |
| PLT-08 Codex model discovery | 🟡 | `parseModelCatalog` reads `models[]` | No four-IDE conformance; runtime-unverified | No change | 🟡 |
| PLT-09 Claude model discovery | 🟡 | Hardcoded `sonnet`/`opus` aliases; `supportsModelDiscovery:false` | No execution-backed verification | No change | 🟡 |
| PLT-10 Safe Codex analysis | 🟡 | `managed-codex-run.ts`, `managed-execution.ts` | Four-host acceptance incomplete | No change | 🟡 |
| PLT-11 Safe Claude analysis | ❌ | `managed-claude.ts` `createManagedClaudeAnalysisInvocation` + tests exist; **but `ClaudeAdapter.buildInvocation` throws and it is not wired into engine-host** | Not integrated/executed end-to-end | Report discrepancy (code exists, not wired); keep ❌ | ❌ (discrepancy noted) |
| PLT-12 Staged Codex effectful | 🟡 | `managed-stage-registry.ts`, apply-decision handling (recent commits) | End-to-end acceptance incomplete | No change | 🟡 |
| PLT-13 Staged Claude effectful | ❌ | Adapter throws on invocation | No managed effectful path | No change | ❌ |
| PLT-14 Provider switching | 🟡 | `selectAgent` RPC + extension UI | No bidirectional workflow acceptance | No change | 🟡 |
| PLT-15 Model switching | 🟡 | Selection partial | Provenance + four-host incomplete | No change | 🟡 |
| PLT-16 Versioned handoff | 🟡 | `createHandoff` RPC method | Contract/acceptance incomplete | No change | 🟡 |
| PLT-17 Manual/fake adapter | ✅ | `manual-adapter.ts` + tests | Must remain in conformance suite | Keep; reference in PLT-27 | ✅ (unchanged) |
| PLT-18 Context/Run envelope | 🟡 | `charter.ts`, execution contracts | Not all hosts/providers | No change | 🟡 |
| PLT-19 Normalized evidence | 🟡 | Partial normalization | Schema/conformance not final | No change | 🟡 |
| PLT-20 Install/upgrade/rollback | 🟡 | VS Code package script only | No upgrade/rollback tests | No change | 🟡 |
| PLT-21 Dashboard shell | 🟡 | 4 VS Code tree views (Product/Agent/Governance/Runs) | VS-Code-only; no cross-host shell | Add shared readiness data source | 🟡 (evidence strengthened) |
| PLT-22 Phase-scoped framework | ❌ | — | No framework/contract | Seed data contract only | ❌ |
| PLT-23 Change/Impact dashboard | 🟡 | `productStudio.analyzeImpact` (trace impact) | Completeness/freshness incomplete | No change | 🟡 |
| PLT-24 Agent/Model dashboard | 🟡 | Agent tree view (selection/model/binding) | Execution truth + four-host incomplete | Feed from readiness snapshot | 🟡 (evidence strengthened) |
| PLT-25 Accessible tables | 🟡 | `studio-accessibility.test.ts` (axe-core) | Full a11y conformance incomplete | No change | 🟡 |
| PLT-26 Freshness/evidence cues | 🟡 | `truthClass` fields on models/settings | Policy/validation incomplete | Add `observedAt`/freshness to snapshot | 🟡 (evidence strengthened) |
| PLT-27 Four-IDE conformance suite | ❌ | — | No shared contract tests / matrix | **Create harness skeleton (engine-host boundary check + VS Code observation only if its E2E executes; VS/Rider/Kiro not executed → no observations, keep Base defaults)** | 🟡 In Progress |
| PLT-28 Realistic example runner | ❌ | — | No runner/canonical path | **Create `examples/phase0-readiness/` runner + evidence** | 🧪 Ready for Test |
| PLT-29 Per-phase package/acceptance report | ❌ | — | No delivery pipeline | **Create acceptance-report generator stub** | 🟡 In Progress |
| PLT-30 Figma MCP | ❌ | — | Phase 2 | **Analyze only — out of scope** | ❌ (unchanged) |
| PLT-31 Rider plugin | 🟡 | Real `intellij.platform` Gradle config + Kotlin tool-window/client scaffold | Workflow/packaging incomplete; no Java/Gradle here | No change (out of env) | 🟡 |
| PLT-32 Kiro package | ❌ | **No Kiro source anywhere** | Nothing exists | No change (out of env) | ❌ |
| PLT-33 Kiro smoke tests | ❌ | — | No harness | No change (out of env) | ❌ |
| PLT-34 VS Windows install tests | ❌ | — | No Windows env | No change (out of env) | ❌ |
| PLT-35 Rider sandbox/install tests | ❌ | — | No Java/Gradle | No change (out of env) | ❌ |

**Discrepancies flagged (not edited pre-approval):** PLT-06 is marked ✅ but is only unit/fixture-verified (Codex absent); PLT-11 is marked ❌ yet a tested managed-analysis invocation builder exists (just unwired). Both should be reconciled in a later change set once four-host execution is real.

## 4. Proposed First Change Set — GAEP-P0-CS01

**Title:** Phase 0 Platform Readiness Computation, engine-host v2 Endpoint, VS Code Read-Only Surface, Conformance Harness Skeleton, and Readiness Example.

**Corrected CS01 outcome (one sentence):** shared readiness **computation in the engine** + an **engine-host v2 `platformReadiness` endpoint** (exercised by the example runner and conformance harness, not yet by the GUI hosts) + a **VS Code read-only surface** reading the snapshot **in-process via `GaepEngine`**.

**Implemented now (host-neutral core + VS Code only, macOS-testable):**
1. A shared contract in `packages/contracts` defining three separate types: **`PlatformReadinessSnapshot`** (the Base Snapshot — provider rows from `probeAgents()`, workspace rows from `workspaceHealth()`, and a **Four-IDE Host Matrix** of exactly VS Code / Visual Studio / Rider / Kiro whose rows default to a state in `{ not-run, pending-environment }`); **`HostConformanceObservation`** (a separate record type emitted only by executed host checks); and **`PlatformReadinessReport`** (the Final Report after merge). Host-matrix state is **never inferred** from provider or workspace probes.
2. **`computePlatformReadiness()`** in `packages/engine` produces **only the Base `PlatformReadinessSnapshot`**: provider readiness (`probeAgents()`) + workspace readiness (`workspaceHealth()`) + the Four-IDE Host Matrix with every host row defaulted to `not-run`/`pending-environment`. It **accepts no host-conformance input** and makes no host claim, with unit tests asserting the defaults are unchanged.
3. **Canonical RPC contract:** add `platformReadiness` to `hostMethodSchema` and `hostRequestSchema` in `packages/contracts/src/host.ts`, plus contract tests for the method shape and protocol-version behavior. Add the matching **engine-host v2-only** dispatch `case "platformReadiness"` in `apps/engine-host`. This endpoint is the *future* shared boundary; in this CS it is consumed **only** by the example runner and conformance harness.
4. A **conformance-harness skeleton** package `packages/conformance` (PLT-27) with two clearly separated outputs. (a) An **engine-host RPC boundary check** — a **contract/boundary result**, reported separately; it is **not** an IDE host row and never appears in the Four-IDE Host Matrix. (b) IDE **`HostConformanceObservation`** records, emitted **only for hosts that were actually executed**. In this CS: **VS Code produces an observation only if its extension-host E2E actually executes** (`passed`/`failed` per the result); if the E2E does not run, VS Code produces **no observation** and its Base default (`not-run`) is unchanged. **Visual Studio, Rider, and Kiro are not executed, so they produce no observations**, and their Base defaults (`pending-environment`) remain unchanged after composition. **Engine, RPC, unit, and command-registration tests are explicitly *not* treated as VS Code host-conformance evidence.** The harness supplies only executed-check observations to the merge; it fabricates no readiness.
5. A **realistic readiness example** at `examples/phase0-readiness/` (PLT-28) that spawns the engine-host, calls the v2 `platformReadiness` endpoint, runs `composePlatformReadinessReport`, writes machine-local raw logs under `evidence/` (git-ignored), and **produces (i) a tracked, normalized, sanitized `acceptance/GAEP-P0-CS01_READINESS_REPORT.json` and (ii) a versioned Evidence Manifest that references and hashes that normalized report** (see §5).
6. **VS Code surfacing (PLT-21/24 evidence):** a read-only `gaep.showPlatformReadiness` command that obtains the snapshot **in-process from the already-instantiated `GaepEngine`** (matching `apps/vscode/src/extension.ts`, which calls `new GaepEngine(...)` directly — it does **not** spawn the engine-host) and renders it read-only (no new webview). The extension-host E2E (`apps/vscode/test/e2e/suite/index.cjs`) **executes** the command and verifies its **read-only behavior** (it returns/renders the snapshot and mutates no `.gaep` state), in addition to asserting registration. This E2E pass/fail is what sets the VS Code host-conformance row (item 4).

**Readiness truth model (correction).** Provider readiness ← `probeAgents()`; workspace readiness ← `workspaceHealth()`; **host installation/conformance readiness ← executed conformance observations only**. No code path infers a host's install/conformance state from provider or workspace probes. A Base host-matrix row carries only its default state (`not-run`/`pending-environment`); after merge, a row is replaced by an observation (with `truthClass`, `observedAt`, `evidenceSource`, and a state of `passed`/`failed`) **only** where a host was actually executed. Missing data stays `not-run`/`pending-environment`, never a positive or negative inference.

**Readiness composition flow (exact).** The snapshot and the final report are produced in three explicit, auditable steps with no hidden shared state, no implicit file loading, and no caller-supplied readiness accepted as evidence:

1. **Base Snapshot — produced by the engine.** `GaepEngine.computePlatformReadiness()` (implemented in `packages/engine/src/platform-readiness.ts`, typed by `PlatformReadinessSnapshot` in `packages/contracts/src/platform-readiness.ts`) returns a **Base `PlatformReadinessSnapshot`** containing (a) provider readiness from `probeAgents()`, (b) workspace readiness from `workspaceHealth()`, and (c) the **Four-IDE Host Matrix** (VS Code / Visual Studio / Rider / Kiro only), each row hard-defaulted to `not-run` or `pending-environment`. The engine makes **no** host install/conformance claim and accepts **no** host readiness argument.
2. **Host checks — executed separately by the harness.** `packages/conformance` runs a host's conformance check independently **only when that host is actually executed**, emitting one schema-validated **`HostConformanceObservation`** record per executed check with at least `{ host, checkId, state, truthClass, observedAt, evidenceSource, executionResult, evidenceDigest }`. A host that is **not executed produces no observation**. In this CS that means Visual Studio, Rider, and Kiro produce **no** observations, and VS Code produces one **only if** its extension-host E2E executes.
3. **Explicit merge — Final Report.** The merge is performed by a single named function **`composePlatformReadinessReport(base: PlatformReadinessSnapshot, observations: HostConformanceObservation[]): PlatformReadinessReport`** in **`packages/conformance/src/index.ts`**, typed by **`PlatformReadinessReport`** in **`packages/contracts/src/platform-readiness.ts`**. It returns the **Final Platform Readiness Report**, overwriting a host's default row **only** where a matching, schema-valid observation exists; any host without an observation keeps its `not-run`/`pending-environment` Base default (so VS/Rider/Kiro are unchanged, and VS Code stays `not-run` when its E2E did not run). It **rejects direct host-state overrides** and accepts **only schema-validated `HostConformanceObservation` records** carrying the required fields above; it reads no ambient file or global. **Trust boundary:** TypeScript types do **not** authenticate the producer of an observation. Provenance (`checkId`, `evidenceSource`, `evidenceDigest`, `observedAt`) is **recorded and validated against the Evidence Manifest**; **cryptographic authenticity of observations is not established by this CS** and is left to a later change set.

Responsible artifacts (single source of truth for the merge): contract types in `packages/contracts/src/platform-readiness.ts`; base builder in `packages/engine/src/platform-readiness.ts`; merge function `composePlatformReadinessReport` in `packages/conformance/src/index.ts`.

**Remaining for later Phase 0 change sets:**
- **Cross-host client integration (explicit follow-up CS):** update `apps/rider/src/main/kotlin/dev/gaep/rider/GaepEngineClient.kt` and `apps/visual-studio/Gaep.HostClient/EngineClient.cs` to send `protocolVersion: 2` and call `platformReadiness` (both currently omit `protocolVersion`), and **create a Kiro client** (none exists) — each with its own tests. **This CS does not touch those client files.**
- Relocating managed execution into the shared engine (PLT-01/10/12); VS Code webview dashboard framework (PLT-22); Change/Impact and Agent/Model full views (PLT-23/24); real four-IDE conformance **execution** (PLT-05/27); VS VSIX (PLT-04), Rider packaging/tests (PLT-31/35), Kiro package/tests (PLT-32/33), VS Windows tests (PLT-34); upgrade/rollback (PLT-20); Claude/Codex execution parity (PLT-11/13/14/15/16).

**Explicitly out of scope:** PLT-30 (Figma, Phase 2); any modification to the Rider/Visual Studio/Kiro clients; any Codex-runtime-dependent, Windows-dependent, Java/Gradle-dependent, or Kiro-dependent validation; any status change to `✅ Done`.

This is deliberately a thin vertical slice through the readiness/evidence axis, not a bulk completion — consistent with the "smallest coherent increment, safely reviewable and testable" mandate.

## 5. Exact Planned File Changes

| Path | Action | Feature IDs | Planned change | Reason | Expected result |
|---|---|---|---|---|---|
| `packages/contracts/src/platform-readiness.ts` | Create | PLT-01,21,26 | Zod schemas + types for **`PlatformReadinessSnapshot`** (base), **`HostConformanceObservation`**, and **`PlatformReadinessReport`** (final) | Single host-neutral readiness + merge contract | Shared schemas all hosts/tests/harness import |
| `packages/contracts/src/platform-readiness.test.ts` | Create | PLT-01,26 | Schema validation tests | Prove parse/reject | Passing unit tests |
| `packages/contracts/src/index.ts` | Modify | PLT-01 | Export new schema/types | Public contract surface | Importable from `@gaep/contracts` |
| `packages/contracts/src/host.ts` | Modify | PLT-01,21 | Add `platformReadiness` to `hostMethodSchema` (enum) and as a variant in `hostRequestSchema` (discriminated union); type flows to `HostRequest` | Canonical RPC contract must define the method | RPC method is contract-valid |
| `packages/contracts/src/host.test.ts` | Create | PLT-01,21 | Contract tests: `platformReadiness` accepted; params validated; protocol-version behavior (`protocolVersion: 2` accepted, absent/v1 handled per existing rules) | Prove the contract, incl. version gating | Passing contract tests |
| `packages/engine/src/platform-readiness.ts` | Create | PLT-01,24,26 | `computePlatformReadiness()` produces **only the Base Snapshot**: provider (`probeAgents()`) + workspace (`workspaceHealth()`) + Four-IDE Host Matrix defaulted to `not-run`/`pending-environment`; **accepts no host-conformance input** | Move readiness truth into shared engine; engine makes no host claim | Deterministic Base Snapshot builder |
| `packages/engine/src/platform-readiness.test.ts` | Create | PLT-01,26 | Unit tests (Codex-absent/Claude-present shapes; **all four host rows stay defaulted**; no host input accepted) | Verify the engine emits only defaults for hosts | Passing tests |
| `packages/engine/src/engine.ts` | Modify | PLT-01 | Add method delegating to `computePlatformReadiness` | Engine API entry | Engine exposes readiness |
| `packages/engine/src/index.ts` | Modify | PLT-01 | Export readiness helper | Reuse by host/example | Importable |
| `apps/engine-host/src/host.ts` | Modify | PLT-01,21 | Add `case "platformReadiness"` gated as v2-only (via existing `v2OnlyMethods`) | Future shared boundary; consumed this CS only by the example runner + conformance harness | RPC returns snapshot |
| `apps/engine-host/src/host.test.ts` | Modify | PLT-01 | Dispatch test for new method incl. v1-rejection path | Prove RPC dispatch + version gating | Passing test |
| `packages/conformance/package.json` | Create | PLT-27 | New workspace package manifest | Conformance harness home | Buildable package |
| `packages/conformance/tsconfig.json` | Create | PLT-27 | TS project config | Compile harness | Typechecks |
| `packages/conformance/src/index.ts` | Create | PLT-27 | Export **`composePlatformReadinessReport(base, observations)`** (the sole merge function) + JSON matrix-report generator | Explicit, single-source merge of observations into the base snapshot | Final report + matrix artifact |
| `packages/conformance/src/rpc-conformance.ts` | Create | PLT-27,05 | Run the **engine-host RPC boundary check** (a contract/boundary result, **not** an IDE host row); emit a schema-valid `HostConformanceObservation` (`host, checkId, state, truthClass, observedAt, evidenceSource, executionResult, evidenceDigest`) **only for hosts actually executed** — VS Code only if its E2E runs; VS/Rider/Kiro produce none | Only executed checks yield observations; boundary result kept separate from the Four-IDE matrix | Boundary result + any executed observations |
| `packages/conformance/src/rpc-conformance.test.ts` | Create | PLT-27 | Vitest: non-executed hosts produce no observation; caller overrides rejected; boundary result excluded from IDE matrix; unknown-stays-unknown | Prove harness + truth model | Passing tests |
| `examples/phase0-readiness/README.md` | Create | PLT-28 | Canonical example + run instructions + evidence layout | Documented example path | Runnable docs |
| `examples/phase0-readiness/run.mjs` | Create | PLT-28,29 | Spawn engine-host, call v2 `platformReadiness`, run `composePlatformReadinessReport`, write machine-local raw logs to `evidence/`, then emit the **tracked normalized report** and the **Evidence Manifest** | Repeatable inspectable example | Normalized report + durable manifest |
| `examples/phase0-readiness/acceptance/GAEP-P0-CS01_READINESS_REPORT.json` | Create | PLT-28 | **Tracked, normalized, sanitized** Final Platform Readiness Report (deterministic field order, no machine-local paths, no secrets/env values) | Durable, diff-able readiness evidence | Versioned readiness proof |
| `examples/phase0-readiness/acceptance/GAEP-P0-CS01_EVIDENCE_MANIFEST.md` | Create | PLT-28,29 | **Versioned, durable** Evidence Manifest: Change Set ID; exact commands; results; timestamps; environment (OS/arch/Node/provider presence); `truthClass`; **SHA-256 digest of the tracked normalized report** + digests of any tracked artifacts; known gaps; machine-local raw-output location | Make PLT-28 evidence durable, reference + hash the normalized report | Tracked acceptance record |
| `examples/phase0-readiness/.gitignore` | Create | PLT-28 | Ignore only machine-local raw logs under `evidence/` (the normalized report and manifest under `acceptance/` remain tracked) | Keep raw/machine-local output untracked, keep normalized proof tracked | Clean tree; durable proof committed |
| `apps/vscode/src/extension.ts` | Modify | PLT-21,24 | Register `gaep.showPlatformReadiness`; obtain snapshot **in-process from the existing `GaepEngine`** (no engine-host spawn); render read-only | User-visible readiness in the one host we can test; matches VS Code's in-process architecture | Command shows snapshot |
| `apps/vscode/package.json` | Modify | PLT-21 | Contribute command + activation event | Command Palette entry | Command available |
| `apps/vscode/test/e2e/suite/index.cjs` | Modify | PLT-21 | Assert `gaep.showPlatformReadiness` is registered, **execute** it, and verify read-only behavior (renders the snapshot; no `.gaep` mutation) | Host-conformance evidence for the VS Code row | Passing E2E (when run) sets VS Code `passed`, else `not-run` |
| `tsconfig.json` (root) | Modify | PLT-27 | Add `{ "path": "packages/conformance" }` to `references` | New package must join the `tsc -b` solution | Root typecheck covers it |
| `package.json` (root) | Modify | PLT-27,28 | Add `packages/conformance` to `workspaces`; add `conformance:phase0` + `example:phase0` scripts | Wire new package/scripts | Scripts runnable |
| `package-lock.json` (root) | Modify | PLT-27 | Regenerated by `npm install` to register the new workspace and resolve `@gaep/*` intra-repo dependencies | Lockfile must reflect the new workspace | Deterministic install |
| `scripts/validate_next_docs.rb` | Modify | PLT-28,29 | Exempt `docs/06_Roadmap/pre_implementation_change_reports/**` from the legacy-migration glob (treat as operational delivery records); add positive validation of report **naming**, **required sections**, **allowed statuses**, and **approval markers** | Fix the current FAIL without weakening doc governance | `validate:docs` returns PASS and enforces report structure |
| `docs/06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md` | Modify (**Stage B only**) | PLT-27,28,29 (+evidence for 01,21,24,26) | Update statuses/evidence/Status Summary + Change Log | Delivery-status contract | Accurate tracker |

No **Move** or **Delete** actions are proposed. No deletions → no separate deletion approval required.

**Workspace-package participation (`packages/conformance`).** The new package joins the monorepo exactly like the existing ones: it is added to the root `package.json` `workspaces` array (so `npm install` links it and resolves its `@gaep/contracts`/`@gaep/engine` dependencies from the workspace, updating `package-lock.json`); it ships its own `tsconfig.json` referenced from the root `tsconfig.json` `references` (so `npm run typecheck` = `tsc -b` builds it in dependency order); `npm run build --workspaces --if-present` builds it if it defines a `build` script; and its `*.test.ts` files are picked up by the root `vitest run` (`npm test`) with no extra configuration. No new third-party runtime dependency is introduced — only intra-repo `@gaep/*` links and Node built-ins.

## 6. Expected Product Output

**Observable after implementation:**
- A host-neutral Base Snapshot produced by the engine, with provider presence (Codex: not-detected here; Claude: detected), model availability, workspace health, and the **Four-IDE Host Matrix** (VS Code / Visual Studio / Rider / Kiro) defaulted to `not-run`/`pending-environment`. It is reachable **two ways this CS**: **in-process** by VS Code (via `GaepEngine`), and **over the engine-host v2 endpoint** by the example runner and conformance harness. Visual Studio, Rider, and Kiro do **not** consume it yet (their clients are unchanged).
- **VS Code:** new Command Palette entry **"GAEP: Show Platform Readiness"** rendering the snapshot read-only (no state mutation, respects the existing workspace-trust stop line).
- A **runnable example** producing machine-local raw logs under `examples/phase0-readiness/evidence/` (git-ignored), plus **two tracked, durable artifacts** under `acceptance/`: the normalized `GAEP-P0-CS01_READINESS_REPORT.json` and the `GAEP-P0-CS01_EVIDENCE_MANIFEST.md` (which references and SHA-256-hashes the normalized report, and records environment, commands, results, and known gaps).
- A **separate engine-host RPC boundary result** (contract/boundary check — **not** an IDE host row) and a **Four-IDE Host Matrix** in which VS Code carries an observation **only if** its E2E executed, and Visual Studio / Rider / Kiro carry their Base `not-run`/`pending-environment` defaults (**no observations produced**).
- Provider/model **selection behavior is unchanged**; this CS only *reports* readiness, it does not add switching.

| IDE | Expected package | Install method | Test method | Expected user-visible result |
|---|---|---|---|---|
| VS Code | None new (existing `.vsix` unchanged) | n/a this CS | Extension-host E2E executes the read-only command; **host row = `passed` only if the E2E passes, else `not-run`** (run after approval) | "GAEP: Show Platform Readiness" shows the snapshot (in-process) |
| Visual Studio | None | n/a (no Windows/dotnet) | Not executed → **no observation**; Base default `pending-environment` | **No change; client not modified this CS** — will consume the v2 endpoint only after a later client-integration CS |
| Rider | None | n/a (no Java/Gradle) | Not executed → **no observation**; Base default `pending-environment` | **No change; client not modified this CS** |
| Kiro | None | n/a (no Kiro) | Not executed → **no observation**; Base default `pending-environment` | **No change; no client exists** |

**This CS does not claim four-IDE support and does not claim four-host RPC consumption.** Only VS Code receives a user-visible surface (in-process). Visual Studio, Rider, and Kiro remain scaffold/absent; because they are not executed they produce **no observations**, so their Four-IDE Host Matrix rows keep their Base `not-run`/`pending-environment` defaults. Wiring their clients to the v2 endpoint is a separately listed later change set.

## 7. Architecture and Compatibility Impact

- **Shared-engine boundary:** Readiness computation is added to `packages/engine` (not any host), reinforcing "one shared engine." No behavioral fork is introduced. VS Code reaches it **in-process** (it already constructs `new GaepEngine(...)` in `apps/vscode/src/extension.ts`); the `computePlatformReadiness()` function is the single implementation both paths call.
- **Host-adapter / RPC boundary:** The new `platformReadiness` method is defined in the canonical contract (`packages/contracts/src/host.ts`: `hostMethodSchema` + `hostRequestSchema`) and dispatched by the engine-host as **v2-only**, consistent with the existing `v2OnlyMethods` gating; v1 clients are unaffected. **Current fact:** the Rider (`GaepEngineClient.kt`) and Visual Studio (`EngineClient.cs`) clients build requests **without `protocolVersion`**, and **Kiro has no client** — so none of the three out-of-process GUI hosts can call a v2-only method today. This CS deliberately leaves those clients untouched; the endpoint is exercised only by the in-repo example runner and conformance harness (which send `protocolVersion: 2`). Wiring the GUI clients is a separate later CS.
- **Readiness truth boundary:** The engine emits only the Base Snapshot (Four-IDE Host Matrix defaulted); host install/conformance state is set solely by **executed** conformance observations at merge time, never derived from provider/workspace probes. The **engine-host RPC boundary check is a separate contract/boundary result and is not an IDE host row**. Unknown data stays `not-run`/`pending-environment`.
- **Portable `.gaep` workspace:** Read-only; the snapshot reads workspace health but performs **no mutation**, preserving portability and the trust stop line.
- **Provider-adapter impact:** Consumes existing `probeAgents()`; no adapter behavior changes; no credentials read.
- **Compatibility/migration:** Purely additive schema/method + new package + new example dir. No existing contracts change shape; no lockfile-breaking dependency is required (harness/example use in-repo packages and Node built-ins).
- **Security/permissions:** No new executable inspection, no network, no credential access; readiness reflects only non-effectful presence/version probing already implemented.
- **Upgrade/rollback:** Additive and reversible; deleting the new files/method restores prior behavior. Only machine-local raw logs under `examples/phase0-readiness/evidence/` are git-ignored; the normalized readiness JSON and the Evidence Manifest under `examples/phase0-readiness/acceptance/` remain tracked as durable evidence.

## 8. Dashboard Impact

- **Platform/Host Readiness (Phase 0 primary):** Gains its **first real data source** — the readiness report, surfaced in VS Code via the new command. Real sources are **kept separate by truth class**: provider rows ← `engine.probeAgents()`; workspace rows ← `engine.workspaceHealth()`; **Four-IDE Host Matrix rows ← executed conformance observations from `packages/conformance`** (never inferred). The engine-host RPC boundary result is shown separately and is not an IDE host row. Hosts not executed render at their Base `not-run`/`pending-environment` default.
- **Change/Impact view:** No new view this CS; the Four-IDE Host Matrix rows are the seed data a later Change/Impact view will consume. Real source: executed conformance observations.
- **Agent/Model view:** Existing Agent tree can display provider/model readiness fields from the snapshot (evidence strengthened; no restructure). Real source: adapter capabilities inside the snapshot (provider truth class).
- **Freshness/evidence indicators:** `observedAt` + `evidenceSource` + `truthClass` are carried end-to-end so cues reflect real probe/observation time and provenance, and so unknown host state is visibly unknown rather than shown as ready.

## 9. Validation and Test Plan

**Executable in this environment (macOS):**
- **Contracts:** `packages/contracts/src/host.test.ts` — `platformReadiness` accepted by `hostMethodSchema`/`hostRequestSchema`; params validated; protocol-version behavior (v2 accepted; absent/v1 handled per existing rules).
- **Shared engine:** unit tests for `computePlatformReadiness` (Codex-absent, Claude-present, workspace-health variants; host rows default to `not-run`/`pending-environment`; unknown-stays-unknown); `npm run typecheck`, `npm test`.
- **Engine-host:** dispatch test for `platformReadiness` incl. v1-rejection path.
- **Conformance harness + merge:** vitest over `composePlatformReadinessReport` asserting (a) a host with no observation keeps its Base `not-run`/`pending-environment` default; (b) a direct host-state override / caller-supplied readiness value is rejected (only schema-valid `HostConformanceObservation` records with the required fields count); (c) **VS Code is `passed` only when fed a passing extension-host E2E observation, and produces no observation (staying `not-run`) when the E2E does not execute**; (d) engine/RPC/unit/command-registration results are never mapped to a host-conformance row, and the engine-host boundary result never appears in the Four-IDE matrix; and (e) VS/Rider/Kiro, not being executed, produce **no observations** and keep their Base `pending-environment` defaults.
- **Realistic example + durable evidence:** run `examples/phase0-readiness/run.mjs`; assert it emits the **tracked normalized** `acceptance/GAEP-P0-CS01_READINESS_REPORT.json` (schema-valid, sanitized, deterministic) **and** the `acceptance/GAEP-P0-CS01_EVIDENCE_MANIFEST.md` whose recorded SHA-256 matches the normalized report on disk, with environment, commands, results, and known gaps. **PLT-28 advances to `🧪 Ready for Test` only if BOTH the normalized report and the Evidence Manifest are generated and validated (digest match).**
- **Docs:** `npm run validate:docs` — **currently FAIL (3 errors)**; the planned `scripts/validate_next_docs.rb` change (exempt this folder from legacy mapping + add report-structure checks) is expected to return it to **PASS** while newly enforcing report naming/sections/statuses/approval markers. This transition (FAIL → PASS) will be re-verified in Stage B.
- **VS Code:** `studio-accessibility` axe-core suite remains green.

**Requires Windows or another environment (declared, not run):**
- Visual Studio VSIX build/install (PLT-04/34); Rider `runIde`/`buildPlugin` sandbox (PLT-31/35); Kiro install (PLT-32/33).

**Requires Product Owner interaction / post-approval:**
- **VS Code extension-host e2e (D3, resolved):** `npm run test:extension-host` downloads an Electron/VS Code baseline (network). It will be **run after approval**; if the download is unavailable in the execution environment, the result will be recorded as **`Not Run`** in the Evidence Manifest and acceptance will **not** be overstated (dispatch/unit coverage stands in the interim).
- Confirming Claude/Codex **authentication readiness** on the target machine (no login/network will be triggered by the agent).

**Not covered this CS (declared gaps):** cross-provider execution parity, model switching provenance, upgrade/rollback, four-IDE runtime conformance, GUI-host RPC client wiring.

## 10. Risks, Blockers, and Decisions Required

| ID | Type | Description | Impact | Recommended decision | Owner |
|---|---|---|---|---|---|
| R1 | Environment | No Codex/Windows/Java-Gradle/Kiro here → 3 of 4 IDEs and Codex runtime unverifiable | Four-IDE acceptance cannot be earned this CS | Accept macOS+VS Code scope; treat others as `pending-environment` | Product Owner |
| R2 | Architecture | Managed execution lives in VS Code host, not shared engine (PLT-01) | Blocks true parity long-term | Approve a **later** CS to relocate execution into engine; not this CS | Product Owner |
| R3 | Data accuracy | PLT-06 (✅) runtime-unverified; PLT-11 (❌) has unwired tested code | Tracker slightly inaccurate | Reconcile in a later execution-parity CS; leave statuses untouched now | Product Owner |
| D1 | Decision (**Resolved**) | Workspace package path and example path | Sets repo conventions | **Resolved: use `packages/conformance` and `examples/phase0-readiness`.** | Product Owner to confirm |
| D2 | Decision (**Resolved**) | VS Code surface scope | Limits user-visible scope | **Resolved: keep the minimal read-only command** (no webview dashboard this CS). | Product Owner to confirm |
| D3 | Testing (**Resolved**) | Extension-host e2e downloads a VS Code baseline (network) | May be unavailable in CI | **Resolved: run `test:extension-host` after approval; if unavailable, record `Not Run` in the Evidence Manifest and do not overstate acceptance.** | Product Owner to confirm |

R1–R3 remain open risks for Product Owner decision. D1–D3 are pre-resolved in this revision (per the Codex review) and require only confirmation; no product, architecture, security, packaging, or compatibility decision has been silently made.

## 11. Tracker Impact Preview

Proposed transitions (**not applied**; would occur only in Stage B, capped at `🧪 Ready for Test`):

- **PLT-27:** `❌ Backlog` -> `🟡 In Progress`
  - Reason: conformance harness skeleton exists (engine-host boundary check + optional VS Code observation); VS/Rider/Kiro are not executed and keep their Base `pending-environment` defaults, so the four-IDE suite is not complete.
  - Evidence that will be required: passing `rpc-conformance` tests + generated matrix report artifact (boundary result separate from the Four-IDE matrix).
- **PLT-28:** `❌ Backlog` -> `🧪 Ready for Test` **(conditional on durable evidence)**
  - Reason: repeatable readiness example runs and emits inspectable output at a canonical path.
  - Evidence that will be required: the **tracked normalized** `examples/phase0-readiness/acceptance/GAEP-P0-CS01_READINESS_REPORT.json` **and** the versioned `acceptance/GAEP-P0-CS01_EVIDENCE_MANIFEST.md` whose recorded SHA-256 matches that report (environment, commands, results, known gaps). Machine-local raw logs under `evidence/` remain git-ignored. **If either durable artifact is missing or the digest does not match, PLT-28 stays `🟡 In Progress`.**
- **PLT-29:** `❌ Backlog` -> `🟡 In Progress`
  - Reason: the normalized report + Evidence Manifest generator exists but is not yet a full per-phase package/checksum pipeline.
  - Evidence that will be required: generated `GAEP-P0-CS01_READINESS_REPORT.json` and `GAEP-P0-CS01_EVIDENCE_MANIFEST.md` with a verified digest match and environment capture.
- **PLT-01 / PLT-21 / PLT-24 / PLT-26:** remain `🟡 In Progress` (evidence strengthened only — new shared readiness capability, RPC data source, snapshot fields; no status advance).
- Status Summary and Change Log would be recomputed in the same Stage B change.

No feature would be set to `✅ Done`.

## 12. Approval Request

**Resolved — approval granted and Stage B executed.** The Stage A request below is retained as history; it is no longer a live state.

> *(Stage A, historical)* "Proposed approval command: `APPROVE GAEP-P0-CS01 EXACTLY AS PROPOSED` — AWAITING PRODUCT OWNER APPROVAL."

**Product Owner approval (recorded):** 2026-07-24 — `APPROVE GAEP-P0-CS01 EXACTLY AS PROPOSED`.

**Stage B handoff (recorded):** implemented 2026-07-24. Tracker transitions: PLT-27 `❌ Backlog -> 🟡 In Progress`; PLT-28 `❌ Backlog -> 🧪 Ready for Test`; PLT-29 `❌ Backlog -> 🟡 In Progress`. Evidence and commands are recorded in the tracker Change Log. No feature was set to `✅ Done`; Product Owner test and acceptance remain outstanding.

**Follow-up:** review findings are addressed by correction set [GAEP-P0-CS01-C1](PHASE_0_GAEP-P0-CS01-C1_PRE_IMPLEMENTATION_CHANGE_REPORT.md).
