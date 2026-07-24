# GAEP Phase 0 Pre-Implementation Change Report — Correction Set GAEP-P0-CS01-C1

| Field | Value |
|---|---|
| **Report ID** | GAEP-P0-CS01-C1 |
| **Roadmap phase** | Phase 0 (internal milestone Phase 1A — Four-IDE Platform Foundation) |
| **Correction of** | GAEP-P0-CS01 (Implemented — Ready for Test) |
| **Status** | Accepted |
| **Revision** | R6 |
| **Product Owner approval** | 2026-07-24 — `APPROVE GAEP-P0-CS01-C1 EXACTLY AS PROPOSED` |
| **Date** | 2026-07-24 |
| **Author** | Claude Code |
| **Supersedes / Superseded by** | — |

> Stage A. This revision persists the correction report as a canonical, registered file and refines its content. No source, configuration, dependency, or delivery-tracker change is made by this revision; the correction set itself is not implemented until the exact Change Set ID below is approved.

### Revision history

| Revision | Date | Change |
|---|---|---|
| R6 | 2026-07-24 | Lifecycle-only update after Product Owner acceptance: recorded the successful manual VSIX installation and `GAEP: Show Platform Readiness` test, moved PLT-28 from `🧪 Ready for Test` to `✅ Done`, and kept PLT-27/PLT-29 and Phase 0 open. No approved implementation contract or source scope changed. |
| R1 | 2026-07-24 | Initial correction proposal (chat only) responding to Codex verdict on GAEP-P0-CS01. |
| R2 | 2026-07-24 | Persisted as this canonical report file and registered as `Awaiting Approval`. Applied Codex R2 corrections: exact paths/filenames (no wildcards/ellipses); corrected F2 trust claim (consistency/integrity only, not producer authenticity) with a machine-readable manifest schema, a fixed tracked path, and path-normalization/traversal defenses hashing exact file bytes; executable command-return plan via a dedicated returning handler (no change to `safely()` or unrelated commands); executable lifecycle-validator test with exact fixture/test paths and command; and an evidence-bundle lifecycle that is atomic, env-gated, dedicated-command-driven, and change-set-scoped. |
| R5 | 2026-07-24 | Resolved the residual evidence-state contradiction with one explicit **current-attempt** model. `readinessEvidenceEnvelopeSchema` is now a **discriminated union** on `testOutcome` (`passed`: executed, snapshot required; `failed`: executed, snapshot optional, sanitized `failureCategory`+`failureSummary` required; `not-run`: `executionResult=not-executed`, snapshot optional, sanitized `unavailabilityReason` required, no observation). The producer **always publishes a verified current-attempt bundle** — including not-executed — so a stale `passed` bundle can never remain effective. `observation.json` becomes a governed **observation-result** artifact (`observationResultSchema`: `{ observation: HostConformanceObservation }` when executed, `{ observation: null }` when not-executed), keeping the exact two-artifact manifest. `run.mjs` consumes only the current verified bundle: passed→passed, failed→failed, `observation:null`/not-executed→`not-run`, invalid/stale→`not-run`. Updated file changes, schemas, manifest rules, producer behavior, and tests. |
| R4 | 2026-07-24 | Narrow truth-model correction (no redesign). Corrected failed-run behavior so a newer **executed failure** is never masked by an older passed bundle: three explicit outcomes (executed-passed → `state=passed`; executed-failed → sanitized envelope + `state=failed`; not-executed → no observation, Base `not-run`), and `run.mjs` consumes the **latest verified result for the current subject** by `observedAt`. Added an explicit `readinessEvidenceEnvelopeSchema`/`ReadinessEvidenceEnvelope` contract with positive/negative tests. Enforced the **exact** manifest artifact set (exactly one unique entry each for `readiness-evidence.json` and `observation.json`; reject missing/duplicate/extra/mismatch; the index `evidence-manifest.json` does not self-hash). Made candidate discovery deterministic via a dedicated `GAEP_E2E_CANDIDATE_DIR` env var (no stdout parsing). Added the five required tests. |
| R3 | 2026-07-24 | Applied Codex R2-verdict corrections: `readiness-evidence.json` is now an **evidence envelope** (schemaVersion, parentChangeSetId, correctionSetId, checkId, observedAt, executionResult, testOutcome, snapshot) with `observation.state` derived from and validated against the envelope outcome, and the manifest hashing **every** tracked artifact so tampering `observation.state` alone fails; the E2E suite writes only an **untracked temp candidate** and never publishes tracked files — `emit-vscode-observation.mjs` publishes only after **both** open and multi-root phases exit success and the candidate verifies; bundles are scoped to **both** `parentChangeSetId` and `correctionSetId` (wrong/missing → rejected); stale evidence is bound to a reproducible **subject/build digest** that `run.mjs` re-checks; lifecycle logic is extracted to a required helper `scripts/lib/report_lifecycle.rb` (no direct require of the executable validator); computation proof is separated from **rendering proof** via a testable formatter; and the undefined `F6` label was removed. |

## 1. Executive Summary

GAEP-P0-CS01 was implemented and handed off, then Codex returned **REVISION REQUIRED**. This correction set (**GAEP-P0-CS01-C1**) hardens five areas without changing the approved design direction and without advancing any Feature to `✅ Done`:

1. **Contract rigor** — the Four-IDE matrix is enforced exactly (one row per IDE; base rows limited to their approved defaults; `passed`/`failed` only via a matching executed observation; `row.host === observation.host`), and `composePlatformReadinessReport` runtime-validates the Base Snapshot before composition.
2. **Evidence integrity (not authenticity)** — observations are verified against a machine-readable, tracked Evidence Manifest with byte-exact digest recomputation and path-traversal defenses; the trust claim is corrected to consistency/integrity, explicitly **not** producer authenticity.
3. **Governance reconciliation** — the parent report's stale `Awaiting Approval` / "Stage B has not started" state is reconciled with the register, and `validate:docs` gains an **executable** lifecycle-consistency check with fixtures and a command.
4. **Boundary strictness** — `runEngineHostBoundaryCheck` passes v1 only on a specific `PROTOCOL_UPGRADE_REQUIRED` rejection; generic/transport errors fail; the example RPC client preserves error metadata.
5. **VS Code evidence (current-attempt model)** — the command returns computed readiness content via a dedicated returning handler; **computation proof** (schema-valid returned snapshot + no `.gaep` mutation) is separated from **rendering proof** (a testable formatter asserted to include provider, workspace, and all four host rows). The E2E writes only an untracked temp candidate; a dedicated producer **always publishes a verified current-attempt bundle** (executed-passed, executed-failed, or not-executed) so a stale `passed` bundle can never remain effective. The bundle's evidence envelope is a discriminated union; its governed observation-result is `{ observation }` (executed) or `{ observation: null }` (not-executed). The runner marks VS Code `passed`/`failed` only from the current verified bundle, and `not-run` for `observation:null`/invalid/stale.

All Feature statuses remain unchanged: PLT-27 `🟡 In Progress`, PLT-28 `🧪 Ready for Test`, PLT-29 `🟡 In Progress`. Nothing becomes `✅ Done`.

## 2. Baseline and Findings Confirmation

Confirmed by read-only inspection of the live tree:

- `packages/contracts/src/platform-readiness.ts`: `hostMatrix` is only `.length(4)` — no per-host uniqueness, no base-default value constraint, no `row.host === observation.host` check.
- `packages/conformance/src/index.ts`: `composePlatformReadinessReport` parses the final report but never validates `input.base`.
- Evidence: any regex-valid `evidenceDigest` and any `evidenceSource` string is accepted; no manifest cross-check, no digest recomputation.
- `packages/conformance/src/rpc-conformance.ts`: v1 probe treats **any** thrown error as a valid rejection; `examples/phase0-readiness/run.mjs` rejects with `new Error(message.error.message)`, discarding `code`/`kind`/`data`.
- Governance: the parent report `docs/06_Roadmap/pre_implementation_change_reports/PHASE_0_GAEP-P0-CS01_PRE_IMPLEMENTATION_CHANGE_REPORT.md` still shows `Status = Awaiting Approval` and a live closing `AWAITING PRODUCT OWNER APPROVAL` + "Stage B has not started", contradicting the register value `Implemented — Ready for Test`.
- `apps/vscode/src/extension.ts`: `gaep.showPlatformReadiness` is wrapped by `safely()` (returns `Promise<void>`, swallows failures) and returns nothing; the E2E cannot see computed content.

Confirmed error facts: in-process `EngineHost.dispatch` throws `HostRpcError { code: -32021, kind: "PROTOCOL_UPGRADE_REQUIRED" }`; generic failures normalize to `{ code: -32603, kind: "INTERNAL_ERROR" }`; over stdio, `apps/engine-host/src/main.ts` emits `error: { code, message, data: { kind } }`.

## 3. Finding-by-Finding Correction Plan

### F1 — Enforce the exact Four-IDE matrix
In `packages/contracts/src/platform-readiness.ts`:
- Shared refinement on both `platformReadinessSnapshotSchema.hostMatrix` and `platformReadinessReportSchema.hostMatrix`: length 4 **and** the set of `host` values equals exactly `{vscode, visual-studio, rider, kiro}` (rejects duplicate/missing/extra).
- `hostMatrixDefaultRowSchema.superRefine`: base-default `state` must equal the approved canonical default for that host — `vscode → not-run`; `visual-studio | rider | kiro → pending-environment` (so `passed`/`failed` cannot appear on a base-default row).
- Report observation row `superRefine`: `row.host === row.observation.host` **and** `row.state === row.observation.state`.
- In `packages/conformance/src/index.ts`, `composePlatformReadinessReport` calls `platformReadinessSnapshotSchema.parse(input.base)` before composition.

### F2 — Evidence integrity (corrected trust claim)
**Corrected claim:** manifest + digest validation establishes **consistency and integrity against the supplied durable evidence**. It rejects unmanifested evidence, unresolved sources, and digest mismatches. It **does not** prevent a caller from fabricating a *self-consistent* manifest + evidence bundle; **cryptographic producer authenticity remains out of scope** and is not claimed. See §6 for the manifest schema, path, and resolution rules.

### F3 — Governance reconciliation + executable lifecycle check
- Reconcile the parent report (record approval + Stage B handoff; remove stale live states; keep Stage A history as quotation; set `Status = Implemented — Ready for Test`).
- Extract the lifecycle logic into a dedicated helper `scripts/lib/report_lifecycle.rb` and `require_relative` it from **both** `scripts/validate_next_docs.rb` and `scripts/test/lifecycle_consistency_test.rb`. The test does **not** require the executable validator script (which is not refactored behind a `main` guard); it requires only the helper (see §8).

### F4 — Tighten `runEngineHostBoundaryCheck`
- Add `isProtocolUpgradeRequired(error)` = `error.kind === "PROTOCOL_UPGRADE_REQUIRED" || error.code === -32021 || error?.data?.kind === "PROTOCOL_UPGRADE_REQUIRED"`.
- v1 probe: resolves → `failed`; throws and `isProtocolUpgradeRequired` → `passed`; throws any other error → `failed` with a sanitized detail naming the unexpected `kind`/`code`.
- `examples/phase0-readiness/run.mjs` RPC client rejects with an `Error` carrying `.code`, `.kind` (from `error.data.kind`), and `.data`.

### F5 — Executable VS Code command-return + separated computation/rendering proof + verified bundle
See §7 (dedicated returning handler; testable formatter for rendering proof), §9 (evidence-envelope bundle lifecycle), and §10 (tests).

## 4. Proposed Correction Set — GAEP-P0-CS01-C1

**Implemented on approval (no design expansion):** F1 contract refinements; F2 evidence-manifest verification with a fixed schema/path and traversal defenses; F3 governance reconciliation + executable lifecycle validator; F4 boundary strictness + client metadata; F5 dedicated returning command handler, E2E content proof, and an atomic, env-gated, change-set-scoped evidence bundle.

**Out of scope:** cryptographic producer authenticity; GUI-client (VS/Rider/Kiro) wiring; any Feature transition to `✅ Done`; any status advance beyond the current PLT-27/28/29 values.

## 5. Exact Planned File Changes

| Path | Action | Findings | Change |
|---|---|---|---|
| `packages/contracts/src/platform-readiness.ts` | Modify | F1, F2 | Exact-matrix + base-default + host/observation-match refinements; add the discriminated-union `readinessEvidenceEnvelopeSchema`/`ReadinessEvidenceEnvelope`, `observationResultSchema`/`ObservationResult`, `evidenceManifestArtifactSchema`, and `evidenceManifestSchema` |
| `packages/contracts/src/platform-readiness.test.ts` | Modify | F1, F2 | Negative tests: duplicate/missing host, base-default `passed`, `row.host !== observation.host`; envelope union — `passed` requires a schema-valid snapshot; `failed` requires `failureCategory`/`failureSummary`; `not-run` requires `executionResult=not-executed` + `unavailabilityReason`; `observation:null` allowed only for not-executed; manifest exactly-two governed paths |
| `packages/conformance/src/index.ts` | Modify | F1, F2 | Validate Base before compose; verify observations against a supplied Evidence Manifest with byte-exact digest recomputation |
| `packages/conformance/src/evidence.ts` | Create | F2 | `loadEvidenceManifest(dir)`, `resolveEvidencePath(root, source)` (normalized, in-root only), `verifyObservation(observation, manifest, root)`; hashes exact file bytes |
| `packages/conformance/src/evidence.test.ts` | Create | F2 | Negative tests: unmanifested source, unresolved source, absolute path, `..` traversal, escaping root, digest mismatch; positive verify |
| `packages/conformance/src/rpc-conformance.ts` | Modify | F4 | `isProtocolUpgradeRequired`; strict v1 classification |
| `packages/conformance/src/rpc-conformance.test.ts` | Modify | F4 | v1 `PROTOCOL_UPGRADE_REQUIRED` → passed; v1 resolves → failed; v1 generic error → failed |
| `apps/vscode/src/platform-readiness-format.ts` | Create | F5 | Pure `formatPlatformReadinessLines(snapshot): string[]` (rendering logic extracted for testability) |
| `apps/vscode/src/platform-readiness-format.test.ts` | Create | F5 | Assert rendered lines include a provider line, a workspace line, and one line per each of the four host rows |
| `apps/vscode/src/extension.ts` | Modify | F5 | Dedicated returning handler for `gaep.showPlatformReadiness` that returns the computed snapshot and renders via `formatPlatformReadinessLines` (returns `undefined` on failure); `safely()` and all other commands unchanged |
| `apps/vscode/test/e2e/suite/index.cjs` | Modify | F5 | Assert the returned snapshot is schema-valid computed content (providers array; matrix exactly the four IDEs); keep no-`.gaep`-mutation assertion; under `GAEP_E2E_EMIT_OBSERVATION=1`, write an **untracked candidate** bundle (envelope `executionResult=executed` with `testOutcome=passed` on success or a sanitized `testOutcome=failed` on assertion failure) into the exact `GAEP_E2E_CANDIDATE_DIR`; never publish tracked files, and write no candidate when the host cannot execute |
| `examples/phase0-readiness/acceptance/vscode-e2e/readiness-evidence.json` | Create (via `evidence:vscode`, Stage B) | F1, F5 | Discriminated-union **evidence envelope** (schema in §6): common `schemaVersion, parentChangeSetId, correctionSetId, checkId, observedAt, subjectDigest`; variant fields per `testOutcome` |
| `examples/phase0-readiness/acceptance/vscode-e2e/observation.json` | Create (via `evidence:vscode`, Stage B) | F5 | Governed **observation-result** (`observationResultSchema`): `{ observation: HostConformanceObservation }` when executed (state from `testOutcome`), `{ observation: null }` when not-executed |
| `examples/phase0-readiness/acceptance/vscode-e2e/evidence-manifest.json` | Create (via `evidence:vscode`, Stage B) | F2, F3, F5 | Index manifest hashing **exactly** `readiness-evidence.json` + `observation.json` (no self-hash; schema in §6) |
| `examples/phase0-readiness/run.mjs` | Modify | F2, F4, F5 | Preserve RPC error metadata; load + re-verify the on-disk `vscode-e2e` bundle (envelope+manifest+observation-result schemas, exact two-artifact set, all-artifact digests, both change-set ids, subject digest vs current build) and map the current result: passed→`passed`, failed→`failed`, `observation:null`/not-executed→`not-run`, invalid/stale→`not-run` |
| `examples/phase0-readiness/emit-vscode-observation.mjs` | Create | F5 | Dedicated producer: creates the temp candidate dir, passes it via `GAEP_E2E_CANDIDATE_DIR`, sets `GAEP_E2E_EMIT_OBSERVATION=1`, runs the E2E; classifies the result (executed-passed / executed-failed / not-executed) and **always** verifies and atomically publishes the corresponding current-attempt bundle; never discovers the candidate by parsing stdout |
| `examples/phase0-readiness/acceptance/GAEP-P0-CS01_READINESS_REPORT.json` | Modify (regenerate) | F1, F2, F5 | Regenerated under stricter rules |
| `examples/phase0-readiness/acceptance/GAEP-P0-CS01_EVIDENCE_MANIFEST.md` | Modify (regenerate) | F2, F5 | Human-readable manifest; references the machine-readable manifest and the VS Code observation when present |
| `scripts/lib/report_lifecycle.rb` | Create | F3 | Dedicated helper module: `ReportLifecycle.inconsistencies(report_text, register_status)`; the single source of the lifecycle rules |
| `scripts/validate_next_docs.rb` | Modify | F3 | `require_relative "lib/report_lifecycle"`; apply `ReportLifecycle.inconsistencies` to each report/register pair and add any result to `errors` |
| `scripts/test/lifecycle_consistency_test.rb` | Create | F3 | `require_relative "../lib/report_lifecycle"` (helper only, **not** the validator script); prove contradictory fails and reconciled passes |
| `scripts/test/fixtures/lifecycle/contradictory_report.md` | Create | F3 | Fixture: report `Awaiting Approval` |
| `scripts/test/fixtures/lifecycle/contradictory_register.md` | Create | F3 | Fixture: register `Implemented — Ready for Test` |
| `scripts/test/fixtures/lifecycle/reconciled_report.md` | Create | F3 | Fixture: report `Implemented — Ready for Test` |
| `scripts/test/fixtures/lifecycle/reconciled_register.md` | Create | F3 | Fixture: register `Implemented — Ready for Test` |
| `package.json` (root) | Modify | F3, F5 | Add `"test:lifecycle": "ruby scripts/test/lifecycle_consistency_test.rb"` and `"evidence:vscode": "node examples/phase0-readiness/emit-vscode-observation.mjs"` |
| `docs/06_Roadmap/pre_implementation_change_reports/PHASE_0_GAEP-P0-CS01_PRE_IMPLEMENTATION_CHANGE_REPORT.md` | Modify | F3 | Record approval + Stage B handoff; set `Status = Implemented — Ready for Test`; remove stale live states; add R5 entry |
| `docs/06_Roadmap/pre_implementation_change_reports/README.md` | Modify | F3 | Keep both register rows consistent |
| `docs/06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md` | Modify | all | Change Log correction row (no status upgrades) |

No **Delete**/**Move**. No new runtime dependencies.

## 6. Evidence Envelope, Manifest Schema, Path, and Resolution Rules

**Bundle root (tracked, exact):** `examples/phase0-readiness/acceptance/vscode-e2e/` with exactly three artifacts: `readiness-evidence.json` (envelope), `observation.json` (observation-result), `evidence-manifest.json` (index).

**Evidence envelope — `readiness-evidence.json`** is a **discriminated union on `testOutcome`** with common fields `{ schemaVersion: 1, parentChangeSetId: "GAEP-P0-CS01", correctionSetId: "GAEP-P0-CS01-C1", checkId: string, observedAt: isoDatetime, subjectDigest: sha256Pattern }` and three variants describing the **current attempt**:

```jsonc
// executed + passed
{ "...common": "...", "executionResult": "executed", "testOutcome": "passed",
  "snapshot": { "...": "schema-valid PlatformReadinessSnapshot (REQUIRED)" } }

// executed + failed (computation may fail before a snapshot exists)
{ "...common": "...", "executionResult": "executed", "testOutcome": "failed",
  "failureCategory": "assertion | phase | computation",
  "failureSummary": "sanitized one-line summary (no paths/logs/secrets)",
  "snapshot": { "...": "OPTIONAL" } }

// not-executed (host/environment unavailable)
{ "...common": "...", "executionResult": "not-executed", "testOutcome": "not-run",
  "unavailabilityReason": "sanitized one-line reason",
  "snapshot": { "...": "OPTIONAL" } }
```

- `subjectDigest` binds the envelope to the **tested extension subject**: a reproducible digest over `apps/vscode/dist/extension.cjs`, computed identically by the producer and by `run.mjs`.
- **Observation-result — `observation.json`** (`observationResultSchema`): `{ "observation": <HostConformanceObservation> }` when executed (the observation `state` derived from `testOutcome`: `passed`→`passed`, `failed`→`failed`), or `{ "observation": null }` when not-executed. `observation: null` is permitted **only** for a `not-run`/not-executed envelope.

**Machine-readable manifest — `evidence-manifest.json`** (hashes **every** tracked bundle artifact):

```json
{
  "schemaVersion": 1,
  "parentChangeSetId": "GAEP-P0-CS01",
  "correctionSetId": "GAEP-P0-CS01-C1",
  "host": "vscode",
  "checkId": "vscode.extension-host.e2e",
  "subjectDigest": "sha256:<64-hex>",
  "artifacts": [
    { "path": "readiness-evidence.json", "digest": "sha256:<64-hex>" },
    { "path": "observation.json", "digest": "sha256:<64-hex>" }
  ]
}
```

Contract types:
- `readinessEvidenceEnvelopeSchema` / `ReadinessEvidenceEnvelope` = `z.discriminatedUnion("testOutcome", [passed, failed, notRun])` (strict) as above — `passed` requires `snapshot`; `failed` requires `failureCategory` + `failureSummary`; `not-run` requires `executionResult="not-executed"` + `unavailabilityReason`.
- `observationResultSchema` / `ObservationResult` = `{ observation: hostConformanceObservationSchema } | { observation: null }` (strict), with `null` allowed only alongside a not-executed envelope.
- `evidenceManifestArtifactSchema` = `{ path: enum("readiness-evidence.json","observation.json"), digest: sha256Pattern }`.
- `evidenceManifestSchema` = `{ schemaVersion: 1, parentChangeSetId: string, correctionSetId: string, host: readinessHost, checkId: string, subjectDigest: sha256Pattern, artifacts: evidenceManifestArtifactSchema[] }`, refined to require **exactly two** artifacts whose `path` set equals `{readiness-evidence.json, observation.json}` — no missing, duplicate, or extra entries.

**Index note:** `evidence-manifest.json` is the **index** over the other two artifacts; it does **not** list or hash itself (no self-hash).

**Resolution root:** `examples/phase0-readiness/acceptance/vscode-e2e/`. `resolveEvidencePath(root, source)`:
- rejects absolute paths;
- rejects any `source` whose normalized form contains `..` or escapes `root` (verified by prefix check on the resolved absolute path);
- returns the in-root absolute path only when the normalized relative path stays inside `root`.

**Verification (`verifyEvidenceBundle`) — the bundle is accepted only if ALL hold:**
1. Envelope parses under `readinessEvidenceEnvelopeSchema` (union variant selected by `testOutcome`); `observation.json` parses under `observationResultSchema`; manifest parses under `evidenceManifestSchema`.
2. `parentChangeSetId === "GAEP-P0-CS01"` **and** `correctionSetId === "GAEP-P0-CS01-C1"` in envelope and manifest (missing either, or a different `correctionSetId`, → reject).
3. The manifest `artifacts[]` `path` set equals exactly `{readiness-evidence.json, observation.json}` (missing/duplicate/extra → reject). For **each**: `resolveEvidencePath` succeeds (in-root) and `sha256(readFileSync(resolvedPath))` — hashing **exact file bytes (Buffer)** — equals the recorded digest, so editing the envelope or observation-result without regenerating all digests fails.
4. Cross-consistency: for an **executed** envelope, `observation.observation` is present, its `state` equals the state derived from `testOutcome` (`passed→passed`, `failed→failed`), and its `evidenceDigest` equals the manifest digest for `readiness-evidence.json`; for a **not-executed** envelope, `observation.observation === null`.
5. `subjectDigest` (in envelope and manifest) equals the digest of the **current** built extension subject; a mismatch (stale build) → reject.

**Outcome mapping (current attempt) after verification:** verified `passed` → VS Code `passed`; verified `failed` → VS Code `failed`; verified not-executed (`observation: null`) → **no** HostConformanceObservation, VS Code Base `not-run`; absent/unverifiable/stale bundle → **no** observation, VS Code `not-run`. The on-disk bundle is the single current result; each atomic publish overwrites the prior one, so an older `passed` can never remain effective after a newer executed-failure or not-executed publish.

**Trust boundary (explicit):** this proves the bundle is internally consistent, complete, and bound to the tested subject and this correction set; it does **not** prevent a caller from fabricating a self-consistent envelope+manifest, and it does **not** establish cryptographic producer authenticity.

## 7. Command-Return Plan + Separated Computation/Rendering Proof (executable)

- Do **not** modify `safely()` (it returns `Promise<void>` and swallows) and do not touch unrelated commands.
- Register `gaep.showPlatformReadiness` with a **dedicated inline handler** that: checks trust, computes `engine.computePlatformReadiness()`, renders read-only via `formatPlatformReadinessLines(snapshot)`, and **returns the snapshot**. On failure it logs + shows the error message and returns `undefined` (no rethrow, so no UX regression).
- **Computation proof (E2E):** the E2E awaits the returned value and asserts it is a schema-valid snapshot with the exact four-IDE matrix, and that no `.gaep` was created. If computation fails, the handler returns `undefined`, the assertion fails, and the E2E fails.
- **Rendering proof (unit):** the rendering logic lives in a pure, testable formatter `apps/vscode/src/platform-readiness-format.ts` (`formatPlatformReadinessLines(snapshot): string[]`). `apps/vscode/src/platform-readiness-format.test.ts` asserts the returned lines contain a provider line (per provider), a workspace line, and exactly one line for each of the four host rows (`vscode`, `visual-studio`, `rider`, `kiro`). This separates *what is computed* (E2E) from *what is rendered* (unit).

## 8. Lifecycle-Validator Test Plan (executable)

- **Fixtures:** `scripts/test/fixtures/lifecycle/contradictory_report.md`, `.../contradictory_register.md`, `.../reconciled_report.md`, `.../reconciled_register.md`.
- **Helper:** `scripts/lib/report_lifecycle.rb` exposes `ReportLifecycle.inconsistencies(report_text, register_status)`; it is the single source of the rule and is `require_relative`-d by both the validator and the test.
- **Test:** `scripts/test/lifecycle_consistency_test.rb` `require_relative "../lib/report_lifecycle"` (helper only — it does **not** require the executable validator, which has no `main` guard) and asserts: contradictory pair → non-empty result (fails); reconciled pair → empty (passes). Non-zero exit on failure.
- **Command:** `ruby scripts/test/lifecycle_consistency_test.rb` (also wired as `npm run test:lifecycle`).
- The main `validate:docs` additionally applies the same check to the real reports; **this C1 report** (`Status = Awaiting Approval`, register row `Awaiting Approval`) and the reconciled parent report are both lifecycle-validated on every run.

## 9. Evidence-Bundle Lifecycle and Failed-Run Truth Model

**Deterministic candidate discovery.** `examples/phase0-readiness/emit-vscode-observation.mjs` creates the temporary candidate directory itself and passes its **exact** path to the E2E via a dedicated env var `GAEP_E2E_CANDIDATE_DIR` (alongside `GAEP_E2E_EMIT_OBSERVATION=1`). `apps/vscode/test/e2e/suite/index.cjs` writes the candidate only into that directory — the producer never discovers it by parsing stdout.

**The producer classifies the current attempt into exactly one of three results and ALWAYS publishes a verified current-attempt bundle** (this is what prevents a stale `passed` from remaining effective):

- **Executed and passed** (both phases run and all assertions pass): candidate envelope `executionResult=executed`, `testOutcome=passed`, snapshot present; observation-result `{ observation: <state=passed> }` → published `state=passed`.
- **Executed and failed** (a phase/assertion/computation fails): candidate envelope `executionResult=executed`, `testOutcome=failed`, sanitized `failureCategory`/`failureSummary` (snapshot only if it was computed); observation-result `{ observation: <state=failed> }` → published `state=failed`.
- **Not executed** (the extension host/environment cannot run — e.g. no VS Code baseline, so the suite never runs and writes no candidate): the **producer** detects the absent candidate + non-launch, then **synthesizes** the current-attempt bundle itself — envelope `executionResult=not-executed`, `testOutcome=not-run`, sanitized `unavailabilityReason`; observation-result `{ observation: null }` → published, contributing **no** observation (Base `not-run`).

**Authoring split:** the suite writes the candidate only for the two executed cases (`passed`/`failed`) into `GAEP_E2E_CANDIDATE_DIR`; the producer synthesizes the not-executed candidate when no suite candidate is present after the run.

**Atomic publish (all three cases).** The producer waits for the E2E process to finish, obtains the candidate (from `GAEP_E2E_CANDIDATE_DIR`, or synthesized for not-executed), computes the current `subjectDigest` over `apps/vscode/dist/extension.cjs`, verifies with `verifyEvidenceBundle` (§6), and only then atomically (`writeFile` temp + `rename`) replaces the three artifacts in `acceptance/vscode-e2e/`. A verification failure exits non-zero and publishes nothing (leaving the prior bundle, which `run.mjs` still re-verifies against the current build).

**No incidental writes:** ordinary `npm run test:vscode:extension-host` (no `GAEP_E2E_EMIT_OBSERVATION`) is assert-only and modifies **no** tracked acceptance artifacts.

**Consumption (`run.mjs`) — current-attempt only.** The runner loads the on-disk bundle and re-verifies it every time (§6, including `subjectDigest` == current build). It then maps the current result: verified `passed` → `passed`; verified `failed` → `failed`; verified not-executed (`observation: null`) → no observation, `not-run`; absent/unverifiable/stale → no observation, `not-run`. Because the on-disk bundle is the single published current result and each publish atomically overwrites the prior one, an older `passed` is never reused after a newer executed-failure or not-executed publish.

## 10. Tests

- **F1:** reject duplicate/missing/extra IDE rows, base-default `passed`/`failed`, `row.host !== observation.host`; accept canonical matrix. (`packages/contracts/src/platform-readiness.test.ts`)
- **F2 (paths/manifest/envelope):** reject unresolved source, absolute path, `..` traversal, path escaping root, digest mismatch, missing/wrong `parentChangeSetId`/`correctionSetId`, mismatched `subjectDigest`; the manifest must contain **exactly the two governed artifact paths** (missing/duplicate/extra → reject); reject envelope-union schema failures; **reject tampering** of the envelope or observation-result without regenerating all digests; accept a complete, byte-verified, subject-bound bundle. (`packages/conformance/src/evidence.test.ts`; envelope union parse cases in `packages/contracts/src/platform-readiness.test.ts`)
- **F5/current-attempt truth model:**
  - **failure before snapshot creation** still publishes a valid `failed` result (envelope `testOutcome=failed`, no `snapshot`, `failureCategory=computation`; observation `state=failed`) that verifies and yields VS Code `failed`;
  - **not-executed after a prior `passed`** replaces it as the current result and yields VS Code `not-run` (`observation: null`);
  - **`observation: null` is allowed only for a not-executed envelope** (rejected for `passed`/`failed`);
  - **`passed` requires** a schema-valid `snapshot` **and** a `passed` observation;
  - **a `failed` observation's `state` must match** the `failed` envelope outcome (mismatch → reject);
  - the published bundle always has **exactly the two governed artifact paths**. (`packages/conformance/src/evidence.test.ts`, `packages/contracts/src/platform-readiness.test.ts`)
- **F4:** v1 `PROTOCOL_UPGRADE_REQUIRED` → passed; v1 resolves → failed; v1 generic/internal error → failed. (`packages/conformance/src/rpc-conformance.test.ts`)
- **F5 (computation proof):** E2E asserts the returned schema-valid snapshot with the exact four-IDE matrix + no `.gaep` mutation. (`apps/vscode/test/e2e/suite/index.cjs`)
- **F5 (rendering proof):** the formatter yields a provider line, a workspace line, and one line for each of the four host rows. (`apps/vscode/src/platform-readiness-format.test.ts`)
- **F3:** `ruby scripts/test/lifecycle_consistency_test.rb` (via `ReportLifecycle.inconsistencies`) proves contradictory fails / reconciled passes; `npm run validate:docs` stays `PASS`.
- Full suite: `npm run typecheck`, `npm test`, `npm run validate:docs`, `npm run test:lifecycle`, `npm run example:phase0` (+ `npm run evidence:vscode` to produce and verify the VS Code observation bundle).

## 11. Tracker Impact, Risks, and Expected Output

**Tracker impact:** no status change. PLT-27 `🟡 In Progress`, PLT-28 `🧪 Ready for Test`, PLT-29 `🟡 In Progress`. One Change Log correction row (GAEP-P0-CS01-C1). No feature → `✅ Done`.

**Risks:**

| ID | Risk | Mitigation |
|---|---|---|
| C1-R1 | E2E writing dirties the tree | Env-gated + atomic post-assertion writes; default runs write nothing |
| C1-R2 | Stricter matrix rejects legacy shapes | No external producers exist; all in-repo builders emit the canonical matrix |
| C1-R3 | Self-consistent fabricated bundle | Documented explicitly as out of scope; integrity/consistency only, no producer authenticity |
| C1-R4 | Path traversal via `evidenceSource` | Normalized, in-root-only resolution; absolute/`..`/escape rejected; byte-exact hashing |
| C1-R5 | Stale/wrong-change-set/wrong-build bundle marks VS Code passed | Envelope+manifest require both `parentChangeSetId` and `correctionSetId`; all-artifact digest re-verification; `subjectDigest` must equal the current built extension; `run.mjs` re-verifies on every run |
| C1-R6 | Suite dirties the tree by publishing directly | Suite writes only an untracked temp candidate; only `evidence:vscode` publishes, atomically, after both phases succeed |

**Expected output:** stricter contracts and compose-time Base validation; manifest-verified, traversal-safe, byte-exact evidence checks; boundary check that distinguishes `PROTOCOL_UPGRADE_REQUIRED` from generic failures; a returning VS Code command proving computed content; consistent, machine-checked report/register lifecycle; and a durable VS Code observation produced only by a dedicated command and consumed only after verification.

## 12. Approval Request

**Resolved — approval granted and Stage B executed.** The Stage A request below is retained as history; it is no longer a live state.

> *(Stage A, historical)* "Proposed approval command: `APPROVE GAEP-P0-CS01-C1 EXACTLY AS PROPOSED` — AWAITING PRODUCT OWNER APPROVAL."

**Product Owner approval (recorded):** 2026-07-24 — `APPROVE GAEP-P0-CS01-C1 EXACTLY AS PROPOSED`.

**Stage B handoff (recorded):** implemented 2026-07-24. No Feature status changed (PLT-27 `🟡 In Progress`, PLT-28 `🧪 Ready for Test`, PLT-29 `🟡 In Progress`); nothing set to `✅ Done`. Evidence, commands, and results are recorded in the tracker Change Log.

**Product Owner acceptance (recorded):** accepted 2026-07-24 after the Product Owner installed the GAEP VSIX and manually executed `GAEP: Show Platform Readiness`. The displayed output contained the computed provider/workspace readiness and exact Four-IDE host matrix. PLT-28 advanced from `🧪 Ready for Test` to `✅ Done`; PLT-27 and PLT-29 remain `🟡 In Progress`, and Phase 0 remains open. The raw `.gaep/manifest.json` `ENOENT` visible for a separate Product-dependent command on the uninitialized workspace is a deferred prerequisite-UX gap, not a failure of this correction set.
