# VS Code Founder Edition 0.2.0 — Phase 2 Agent Selection Checkpoint

Status: PASS

Captured: 2026-07-23T11:24:14Z (`2026-07-23T14:54:14+03:30`)

## Purpose

This record captures the completed Phase 2 selection, model, settings, machine-local binding, switching, handoff, and compatibility boundary for the VS Code Founder Edition. It is implementation evidence only. It does not approve the GAEP specification candidate, authorize public distribution or marketplace publication, or authorize Phase 3 managed Run launch.

## Repository checkpoint

- Branch at final capture: `freez/codex-normal-phases`
- Phase 2 base commit: `885f5fb50102cb02fe233ca226188e265a181877`
- Base commit subject: `docs: record Founder 0.2.0 phase 1 checkpoint`
- Base Git tree: `81aac8acac4f69a29bde52a23cfec08ea6045c06`
- Phase 2 integration commit present at capture: `3ba67f941990341220dd502a12b3d369eef3c1ca`
- Integration commit subject: `feat: implement agent selection and diagnostic safety features`
- Integration Git tree: `0d79ac6c2d5a18d4e25ff73e76c7f44dc97c3565`
- Upstream: `origin/freez/codex-normal-phases`
- Ahead/behind at capture: `0/0`
- Final audit corrections after the integration commit: intentionally uncommitted pending the next explicit Git instruction
- Codex commit or push performed in this Phase 2 task: no; the branch switch, integration commit, and upstream update occurred externally during final validation
- `git diff --check`: PASS

## Approved Phase 2 boundary

Phase 2 makes an Agent Selection and its local runtime binding reviewable and safe to persist. It does not launch a managed Run.

The supported selections are:

- Manual: deterministic, offline, managed in process, with a machine-local runtime identity and no fabricated executable path.
- Codex: a verified executable binding and observed model catalog where available, prepared for the isolated staged boundary; no source-workspace application authority is granted by selection.
- Claude Code: a verified executable binding, provider alias or explicit model, and the tool-free context-only boundary; no Tool or workspace mutation authority is granted by selection.

Selection grants no Tool, effect, execution, approval, deployment, or application authority. Those decisions remain bound to later Workflow, Charter, managed execution, review, and application controls.

## Completed capabilities

### Selection and model truth

- Manual, Codex, and Claude are probed through one explicit selection workflow.
- Unavailable, inconsistent, changed, or unverified runtimes fail closed.
- Model IDs, truth class, nullable alias status, and adapter-specific limitations are shown in the exact confirmation.
- Codex model-catalog ordering, reasoning options, and input modalities are canonicalized for stable review.
- Custom model identifiers are accepted only for the supported Codex and Claude boundaries.
- Model-specific reasoning options are filtered to the selected model.
- Empty optional settings are omitted rather than converted into material persisted values.
- Sensitive settings and machine-path-bearing portable settings are rejected.
- Setting declarations and values are checked for type, option, default, bounds, required-value, and portability consistency.

### Machine-local runtime binding

- Portable `.gaep` selections and capability snapshots contain no executable path or managed runtime identity.
- VS Code stores executable fingerprints or the Manual managed runtime ID in machine-local global state.
- Executable bindings require an exact requested path, canonical path, digest, size, modification time, adapter identity, agent identity, interface, runtime version, and capability match.
- Managed-in-process bindings require the exact adapter, agent, capability, and runtime identity.
- Binding persistence is rolled back when the governed selection mutation fails.
- Product Studio exposes local binding details only in the labeled machine-local inspector; portable snapshots remain path-free.

### Switching and handoff

- Selection mutations are serialized and bound to the selected Product root, workspace trust state, context generation, exact current selection digest, and freshly revalidated runtime probe.
- Prepared, running, paused, unknown, nonterminal managed, pending-review, conflict, and active provider-process states block switching.
- A material change after an exactly bound Run requires a terminal source Run and an exact accepted handoff.
- The source must be the newest terminal Run bound to the exact current selection.
- Handoff review binds the exact ID, creation time, current selection digest, target capability state, model truth, settings, workspace baseline, changed files, completed work, unresolved matters, decisions, evidence, and capability differences.
- Preview and commit preserve the same handoff ID and creation time; stale previews and stale current selections fail closed.
- Handoff and new selection are committed atomically, and the target machine-local binding is retained only after successful commit.
- A material no-op does not rewrite selection time or governed state, but still requires exact current-state binding and no unresolved work.
- Capability snapshots are content-addressed and immutable; observation time does not rewrite an existing logical snapshot.

### Integrity-era legacy v1 compatibility

- Legacy executable paths are separated from the portable candidate and never copied into the v2 selection.
- Integrity-era Codex v1 settings (`reasoningEffort`, read-only `sandbox`, and fail-closed `approvalPolicy`) and Claude v1 settings (`effort`, `permissionMode`, tool lists, and positive `maxBudgetUsd`) are covered by migration tests.
- Earlier Codex `search` and path-valued `profile` state is recognized only as quarantined compatibility knowledge. A local profile value is removed from the portable candidate and is not exposed by the protocol, diagnostics, or migration audit.
- Migration is server-derived. The caller cannot supply a replacement model or settings.
- The exact adapter, agent, model, still-declared valid settings, current capability digest, model truth, and alias state are preserved or recomputed under the closed normalization rule.
- Only the known obsolete v1 control keys may be retired, and the exact portable normalization must be explicitly accepted.
- Unknown settings, invalid retained settings, changed legacy state, changed capabilities, changed preview, a historical selection/capability digest mismatch, or a missing/conflicting historical capability snapshot fail closed.
- Supported integrity-era migration verifies the historical path-inclusive capability digest against the identity-digest capability snapshot before atomically rewriting it without the executable path.
- The earlier agent-ID capability filename era predates audit checkpoint and governed-state support. A precise pre-integrity signature returns `MIGRATION_INTEGRITY_BOOTSTRAP_REQUIRED`; no checkpoint, governed state, or trusted inventory is synthesized inside selection migration. A damaged modern integrity workspace remains `AUDIT_INVALID` and is not mislabeled as pre-integrity.
- Any existing Charter, Run, Handoff, or managed execution artifact blocks this narrow normalization. This prevents migration from becoming a handoff bypass; a workspace with dependent v1 history requires a dedicated corpus migration.
- The migration audit records only portable provenance: previous portable selection digest, normalization profile and version, portable normalization digest, retained and dropped keys, current capability digest, and the no-bound-artifacts disposition.

### Host protocol and diagnostics

- Engine-host protocol version 3 adds exact selection reads, guarded selection mutation, server-derived legacy migration preview/commit, and exact handoff preview/commit.
- Protocol v1 and v2 clients receive a stable upgrade-required error for v3-only methods before obsolete parameter shapes are parsed.
- Stable host errors distinguish stale selection, unresolved selection work, required handoff, stale migration preview, dependent legacy history, incompatible retained settings, invalid historical capability binding, unrecognized migration rules, and pre-integrity bootstrap requirements.
- VS Code diagnostics redact secret-shaped text, bearer values, control bytes, Windows/UNC/file/tilde/POSIX machine paths, and output beyond 4,096 characters.
- Product-root paths and provider failures pass through the central diagnostic sanitizer.

## Phase 3 stop line

`GAEP: Create Charter and Start Run` remains disabled in the views, and `gaep.prepareRun` fails immediately through the Phase 2 gate before creating or changing `.gaep` Product, Charter, Run, or runtime state. Manual, Codex, and Claude launch-time execution, process lifecycle, cancellation, staged review, conflict handling, and exact source-workspace application remain Phase 3 work and are not claimed by this checkpoint.

## Verification evidence

Command: `npm run check:founder`

Result: PASS

- TypeScript project-reference compilation: PASS
- Vitest files: 40 passed
- Tests: 392 passed, 1 skipped, 393 total
- Expected skip: the root-only foreign-UID managed-stage-registry test cannot run as the non-root local user
- Focused Phase 2 regression suite: 9 files, 156 tests passed
- Integrity-era Codex and Claude capability-evolution fixtures: PASS
- Historical path-inclusive selection/capability binding verification: PASS
- Pre-integrity agent-ID repository quarantine without trust synthesis: PASS
- Invalid retained Claude zero budget: correctly blocked
- Legacy dependent execution history: correctly blocked
- Candidate documentation structural validation: PASS
- Candidate documents: 83
- Requirement definitions: 868
- Active Core contracts: 8
- Active Core requirements: 160
- Documentation warnings: 0
- VS Code production bundle build: PASS
- Extension-host activation and contributed command registration: PASS
- Four native GAEP views and Product Studio opening: PASS
- Phase 2 `gaep.prepareRun` non-mutation stop line: PASS
- Explicit multi-root non-mutation scenario: PASS

## Verification limitations

- The Extension Development Host exercises activation, commands, views, Product Studio opening, the Phase 2 Run stop line, and multi-root non-mutation. It does not automate the modal Agent picker, model/settings prompts, Memento binding rollback, migration confirmation, or handoff confirmation end to end. Those paths are covered at helper, adapter, contract, engine, host, Studio, and tree levels, but this checkpoint does not misrepresent them as UI-automation coverage.
- The extension-host harness disables workspace trust through its Electron launch configuration. Untrusted-host interaction remains outside that harness, although trusted-workspace checks are present in the implementation.
- No VSIX version bump, package, installation, upgrade, marketplace action, or public distribution was performed in Phase 2.
- Candidate documentation validation is structural; it does not resolve the candidate's declared authority, approval, or evidence blockers.

## Phase 2 conclusion

The VS Code Founder Edition now has a fail-closed, portable, exact, and migration-aware Agent Selection boundary for Manual, Codex, and Claude. The Phase 2 implementation gate is complete and reproducibly green. Phase 3 managed Run wiring remains intentionally blocked and requires separate authorization.
