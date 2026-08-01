# GAEP Codex Continuation Runbook

This runbook supplements [`AGENTS.md`](AGENTS.md). Read and obey `AGENTS.md` first. It is written for Codex, but any coding agent may use the verified repository context and execution sequence below.

## 1. Mission

Finish the usable local VS Code GAEP product and its Product Studio experience through the ordered roadmap, using shared contracts and engine behavior where required. Work continuously within local authority, create durable checkpoints, and preserve strict distinctions between implementation, evidence, and acceptance.

Do not optimize for Marketplace publication. The immediate target is a complete local VSIX and Product Studio workflow that can be built, installed, tested, and used locally without changing the normal VS Code profile during automated verification.

## 2. Continuous execution authorization

The active Product Owner instruction authorizes continuous local VS Code/Product Studio implementation. After startup verification:

- do not ask for routine approval between features, test gates, evidence checkpoints, or local commits;
- fix ordinary implementation, compilation, test, documentation, and packaging failures and continue;
- create small local commits at durable boundaries;
- update VS Code-scoped evidence, tracker entries, and continuation checkpoints honestly;
- proceed to the next ordered VS Code-relevant task after sealing a feature;
- stop only for an authority, safety, unpreservable-conflict, materially ambiguous product decision, or unrecoverable environment blocker described in `AGENTS.md`.

Push, pull request, publication, signing, release, deployment, live-provider/Figma access, credentials, external mutation, normal-profile extension changes, and fabricated human acceptance remain outside authority.

## 3. Fresh-start commands

Run these read-only checks before editing:

```bash
rtk proxy sed -n '1,260p' /Users/aligeek/.codex/RTK.md
rtk proxy sed -n '1,320p' AGENTS.md
rtk proxy sed -n '1,320p' CODEX.md
rtk proxy git status --porcelain=v2 --branch
rtk git log -15 --date=iso-strict --pretty=format:'%h|%H|%ad|%s'
rtk proxy sed -n '1,110p' docs/06_Roadmap/055_GAEP_CONTINUOUS_IMPLEMENTATION_CONTROL.md
rtk proxy rg -n -C 4 'Latest resume checkpoint|Next exact action' docs/06_Roadmap/055_GAEP_CONTINUOUS_IMPLEMENTATION_CONTROL.md
rtk proxy sed -n '95,125p' docs/06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md
rtk proxy sed -n '248,310p' docs/06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md
rtk proxy find evidence/vscode-checkpoints -maxdepth 1 -type f -print | sort | tail -12
rtk proxy shasum -a 256 apps/vscode/dist/gaep-vscode.vsix
rtk proxy stat -f '%z bytes' apps/vscode/dist/gaep-vscode.vsix
```

If a file or package does not exist, record that fact instead of inventing a result. If the tree is dirty, inspect staged and unstaged diffs and preserve them before proceeding.

## 4. Verified creation-time snapshot

This snapshot was refreshed on 2026-08-01 in Asia/Tehran. It is a recovery hint, not a substitute for the fresh-start checks.

| Item | Verified value |
|---|---|
| Branch | `codex/gaep-hardwork-completion` |
| Last stable checkpoint | `79c76020dd38c6350c02ca048bca5a8e24ad1957` — `docs: seal P3B19 continuation checkpoint` |
| P3B-19 evidence commit | `1c5c32bcc24582e496c05330862acc59195d056d` — `docs: record P3B19 VS Code evidence` |
| P3B-19 implementation commit | `0bd9ed82caf406a83e7972df9e7a026818abe174` — `test(vscode): add local end-to-end report` |
| P3B-19 receipt | `evidence/vscode-checkpoints/20260801T074130Z-p3b19-local-vscode-e2e.json` |
| P3B-19 focused result | 10 files, 158 tests passed, 0 skipped |
| P3B-19 package | 1,231,926 bytes, SHA-256 `68cf7d440ced3b20dc494a6ae3e4f6879d4155f578864dac511bef1ca2e833e8` |
| Historical full conformance | P3B-09: 106 capabilities, 424/424 local four-host assessments |
| Native/live acceptance | 0/4 native hosts and 0/2 live providers accepted at the historical checkpoint |
| Active ordered feature | P3B-20 Local Security Testing |

The P3B-19 control seal was committed while this file was being prepared. Always use the actual current HEAD and tree state if the repository has advanced beyond `79c76020`.

The P3B-19 receipt establishes bounded local behavior only: isolated activation, Product Studio open/refresh, same-profile restart with explicit reopen, package lifecycle, installed-package activation, multi-root behavior, and unchanged fixture fingerprints. It does not establish automatic native webview restoration, native untrusted-workspace behavior, live providers, real Figma, other-host evidence, security approval, manual/Product Owner acceptance, release, publication, or deployment.

## 5. Durable Phase 3B checkpoint chain

Use this table to avoid restarting completed local work. Verify every hash before relying on it.

| Feature | Local checkpoints | Scoped receipt |
|---|---|---|
| P3B-09 Controlled Design-to-Code Generation | `52ebe0f`, `943da11`, `5cd967b`, `e909263`, `9a87a76`, control `a0134e6` | `evidence/phase-reports/20260731T185000Z-phase-3b-controlled-design-to-code-generation.json` |
| P3B-10 Design-to-Code Traceability | core `61fed8c`, Studio `ae5f8fc`, evidence `cb6f648`, seal `76b0c2a` | `evidence/vscode-checkpoints/20260731T191813Z-p3b10-design-to-code-traceability.json` |
| P3B-11 Boilerplate Constraint Enforcement | core `67cd323`, Studio `1db4022`, evidence `516b918`, seal `80f46bd` | `evidence/vscode-checkpoints/20260731T193136Z-p3b11-boilerplate-constraint-enforcement.json` |
| P3B-12 Backlog-to-Code Traceability | contract `ff7956f`, engine `6d76292`, Studio `00cf942`, evidence `6bef3e9`, seal `da30e65` | `evidence/vscode-checkpoints/20260731T201111Z-p3b12-backlog-to-code-traceability.json` |
| P3B-13 Apply/Discard Foundation | `17dbc3d`, `1e79238`, `cef4f9b`, `02975c4`, seal `57bf133` | `evidence/vscode-checkpoints/20260731T202731Z-p3b13-apply-discard-foundation.json` |
| P3B-14 Scoped Apply | `40457af`, `abc6ab3`, `9a5a198`, evidence `7512232`, seal `648d339` | `evidence/vscode-checkpoints/20260731T204326Z-p3b14-scoped-apply.json` |
| P3B-15 Rollback and Recovery | `8c91f91`, `f2015a0`, `1cf139e`, evidence `be8a644`, seal `c4ef8ed` | `evidence/vscode-checkpoints/20260731T205910Z-p3b15-rollback-recovery.json` |
| P3B-16 Change Conflict Detection | `140bb0e`, `aa025f4`, `faedf1d`, evidence `15c3224`, seal `07d7aee` | `evidence/vscode-checkpoints/20260731T211144Z-p3b16-change-conflict-detection.json` |
| P3B-17 Test Generation | contract `cfdb8f4`, engine `7dca31a`, Studio `8784262`, evidence `15c5ab6`, renderer fix `565d0325`, seal `c4fb90b` | `evidence/vscode-checkpoints/20260731T213608Z-p3b17-test-generation.json` |
| P3B-18 Unit and Integration Testing | contract `746d253`, engine `f39bf3f`, Studio `00a0b0f`, evidence `cf98595`, seal `7dbe157` | `evidence/vscode-checkpoints/20260801T072843Z-p3b18-unit-integration-testing.json` |
| P3B-19 Local VS Code End-to-End Testing | implementation `0bd9ed8`, evidence `1c5c32b`, seal `79c7602` | `evidence/vscode-checkpoints/20260801T074130Z-p3b19-local-vscode-e2e.json` |

Historical P3B-09 evidence passed 146 test files, 1,055 tests, 1 conditional skip, 41/41 canonical examples, 106 capabilities, and 424/424 local four-host assessments. That remains historical evidence only. Do not refresh or reframe it as current native-host acceptance during the VS Code-only wave.

## 6. Exact next implementation action

P3B-19 is durably sealed at `79c76020`. After confirming that Git still contains that checkpoint, start P3B-20 Local Security Testing.

1. Load and follow the applicable standard Codex Security repository-scan skill before scanning.
2. Define an offline scope limited to shared code required by VS Code, `apps/vscode`, its tests, package inputs, and relevant repository metadata.
3. Do not scan or mutate the normal-profile installed extension.
4. Cover at least:
   - contract validation and fail-closed behavior;
   - repository-relative path normalization, traversal, symlink/no-follow, and stage confinement;
   - secret-shaped input rejection and evidence privacy;
   - stale binding, tamper, digest, and receipt rejection;
   - archive/VSIX contents, package integrity, dependencies, and lockfile;
   - Product Studio webview CSP, local-resource roots, message origin/schema, and command authority;
   - workspace-trust behavior and known harness limitation;
   - provider/runtime argument construction and shell-injection avoidance where reachable from VS Code;
   - threat-control mapping for the local product boundary.
5. Validate every candidate finding against source and deterministic reproduction before calling it a defect.
6. Fix only confirmed in-scope local issues; add focused regression tests.
7. Rerun focused, typecheck, shared-and-VS-Code, documentation, VSIX, and isolated host gates affected by fixes.
8. Create a privacy-safe P3B-20 receipt. Automated results are local evidence, not security approval.
9. Update only P3B-20 tracker/control state and seal a durable checkpoint.
10. Continue immediately to P3B-21.

The Product Owner has authorized this new local-only offline assessment in the current control document. That authorization does not permit credentials, live services, external mutation, other-host scanning, or a claim of security acceptance.

## 7. Remaining VS Code roadmap in execution order

Follow the tracker order unless a prerequisite defect requires a narrowly scoped earlier fix.

1. **P3B-20 Security Testing:** offline shared/VS Code source, dependency, package, webview, confinement, privacy, and threat-control assessment; fix confirmed local defects; preserve human security gate.
2. **P3B-21 Accessibility Testing:** complete automated Product Studio/command/view coverage and local accessibility evidence; provide a manual checklist without fabricating manual acceptance.
3. **P3B-22 Visual Regression Testing:** create deterministic local fixtures and screenshot/baseline comparison for Product Studio; do not claim real Figma comparison without authorized real inputs.
4. **P3B-23 Performance and Reliability Testing:** define budgets; exercise bounded load, cancellation, partial failure, restart/reopen, storage limits, and recovery; disclose native power-loss and platform limits.
5. **P3B-24 Multi-Dimensional QA Scorecard:** compose functional, security-scan, accessibility, visual, performance, reliability, and open-gate truth without averaging away a fail-closed gate.
6. **P3B-25 UAT and Human Validation:** implement local scenario runner, evidence template, and Product Studio status; leave human signatures and acceptance unestablished until supplied.
7. **P3B-26 Requirement/Design/Code Drift Detection:** exact-bind and compare approved candidate baselines, generated targets, repository candidates, tests, and evidence; separate detected candidate drift from inspected source truth.
8. **P3B-27 Conform / Amend / Waive Decisions:** implement immutable, attributable, version-bound decision candidates and fail closed when authority or exact subject bindings are absent.
9. **P3B-28 Phase 3B Implementation and QA Dashboard:** provide accessible Product Studio readiness/change/test/quality/gap projection sourced from governed state.
10. **P3B-29 Phase 3B Change, Impact, Agent and Model Views:** integrate bounded impact and provider/model/run evidence without implying live quality or acceptance.
11. **P3B-30 Phase 3B Realistic Implementation Example:** produce a deterministic local canonical example and acceptance-gap report. Do not invent live Figma/provider or human approval.
12. **Phase 3B local seal:** run all relevant local shared/VS Code gates, create the final local package lifecycle receipt, record exact final VSIX bytes/hash, reconcile tracker/control/docs, and state all open external gates.
13. **P4-01 Release Manifest:** local exact artifact inventory, versions, checksums, evidence, limitations, and open gates.
14. **P4-02 Release Approval:** implement the local approval workflow and exact decision schema; do not create the approval.
15. **P4-03/P4-04 Deployment Automation and Evidence:** implement only safe local simulation/dry-run and evidence contracts; do not deploy or mutate an external environment.
16. **P4-05/P4-06 Rollback Plan and Validation:** local package/profile rollback rehearsal and deterministic evidence.
17. **P4-07/P4-08 Observability, Telemetry, KPI, and Outcome Measurement:** privacy-safe local instrumentation and Product Studio projections; no external telemetry without new authority.
18. **P4-09 Package Signing and Integrity:** checksum and verification may be local; actual signing requires authorized keys and remains an external gate.
19. **P4-10 Publish and Distribution:** implement/validate local packaging and publication preflight only; Marketplace/store publication is excluded.
20. **P4-11 through P4-16:** operational handoff, lessons, retrospective, rebaseline, next-change impact, portfolio, and release/learning dashboards as local governed workflows and Product Studio projections.
21. **P4-17 Realistic Release Example:** deterministic local package -> isolated install -> observe -> rollback -> learn scenario; leave real deployment and human acceptance open.
22. **Final local VS Code MVP seal:** exact clean commit, final local VSIX, isolated lifecycle and end-to-end pass, documentation, local security evidence, usability checklist, known limitations, and durable resume/use instructions.

Human UAT, live providers, real Figma, native untrusted-workspace behavior, security acceptance, signing authority, Product Owner acceptance, external release, publication, and deployment can remain honest external gates even after every locally implementable task is exhausted.

## 8. Per-feature implementation recipe

For every new P3B/P4 feature:

```text
Inventory predecessors and actual current implementation
-> define versioned contract/schema
-> add contract validation tests
-> add immutable engine lifecycle/history/receipts/health
-> add engine tests including stale/tamper/privacy failures
-> expose strict VS Code protocol
-> compose Product Studio data source
-> render accessible UI and all states
-> test the visible renderer, refresh, reopen, and multi-root behavior
-> run focused and broad relevant gates
-> build/test isolated VSIX lifecycle
-> issue scoped receipt with limitations
-> update tracker/control/resume point
-> commit durable checkpoints
-> proceed to next feature
```

Do not create actual Product truth where the feature only manages candidate metadata. Do not let a projection become an independent state store.

## 9. Test and package routine

During implementation:

```bash
rtk proxy npx vitest run <contract-test> <engine-test> <vscode-tests> --maxWorkers=4
rtk npm run typecheck
```

Before evidence:

```bash
rtk proxy npx vitest run packages apps/vscode --maxWorkers=4
rtk npm run validate:docs
rtk proxy npm run package:vscode
rtk proxy npm run test:vscode:extension-host
```

For local end-to-end/report changes:

```bash
rtk proxy npm run test:vscode:local-e2e
rtk proxy npm run test:vscode:local-e2e-report
```

Use a sufficiently long timeout for the broad Vitest and extension-host gates. If filtered `rtk` output appears buffered, rerun through `rtk proxy`; do not assume a hung process without checking it.

Never run Kiro, Rider, Visual Studio, full four-host conformance, or host package refresh commands during the active VS Code-only priority. Do not weaken tooling that still requires four hosts; create a clearly VS Code-scoped local receipt instead.

### Final package identity

`npm run test:vscode:extension-host` may rebuild `apps/vscode/dist/gaep-vscode.vsix`. Therefore:

1. finish every build/lifecycle command;
2. ensure no later step changes package inputs;
3. compute bytes and SHA-256;
4. write the receipt;
5. verify the receipt against the file;
6. do not rebuild afterward.

If documentation is packaged and changes after the hash, the old hash is not the final roadmap package hash. Rebuild and issue a fresh receipt.

## 10. Commit and evidence protocol

Before each commit:

```bash
rtk proxy git status --porcelain=v2 --branch
rtk proxy git diff --check
rtk proxy git diff --stat
rtk proxy git diff --cached --check
rtk proxy git diff --cached --stat
```

Stage only owned files. If another process or the user changes the tree while work is active, stop editing overlapping files, inspect the new commit/diff, rebase the plan on the newest state without rewriting it, and continue only when changes can be preserved.

Each receipt must record:

- schema version and kind;
- host `vscode` and execution `local-isolated`;
- exact source commit or explicit pre-commit source digest set;
- commands, results, file/test counts, and conditional skips;
- exact package identity when stable;
- workspace mutation fingerprint when applicable;
- privacy properties;
- explicit limitations;
- an authority boundary denying native/manual/live/security/Product Owner/release/deployment claims.

Do not include raw command output, absolute paths, environment values, secrets, prompts, or source bytes in public evidence.

## 11. Status and acceptance interpretation

The tracker counted 168 features at the creation snapshot: 4 Done, 123 In Progress, 24 Ready for Test, and 17 Backlog. These are complete Product-ledger counts, not a percentage of the local VS Code MVP. Recount from rows after any status change.

P3B-09 through P3B-19 are locally implemented/evidenced candidates but remain `In Progress` because their actual source/effect/live/native/human/security/release gates differ by feature and remain open. Do not bulk-promote them.

Use this verdict separation in every readiness report:

| Dimension | What local automation may establish | What remains separate |
|---|---|---|
| Local implementation | contracts, engine, protocol, UI, deterministic behavior | real Product truth and user value |
| Isolated host | activation, commands/views, Product Studio, lifecycle | normal-profile and full native/manual behavior |
| Providers/Figma | offline contracts and deterministic fixtures | authorized real service execution |
| Security | scan findings, fixes, regression tests | accountable security acceptance |
| UAT | runner, scenarios, templates | attributable human validation/signoff |
| Package | exact local VSIX and checksum | signing, publication, external distribution |
| Release/deployment | schemas, preflight, local rehearsal | approval and external action |

## 12. Durable interruption record

Before stopping, update the control document with a concise block containing:

```text
BRANCH: <branch>
HEAD: <full commit>
TREE: clean | staged/unstaged paths with ownership
COMPLETED COMMITS: <hash and outcome>
ACTIVE FEATURE: <Feature ID and name>
ACTIVE SUBTASK: <exact unfinished unit>
TESTS: <commands, pass/fail/skip counts, not-run gates>
EVIDENCE: <paths and package identity>
BLOCKERS/LIMITATIONS: <exact facts>
NEXT: <exact command or implementation action>
OPEN ACCEPTANCE: native, live, security, Product Owner, release, deployment, etc.
```

Commit the control update when it truthfully seals a clean checkpoint. If interrupted mid-change, do not pretend the feature is sealed; preserve a clear WIP record without overwriting user changes.

On a later `continue`, revalidate briefly, use the newest committed checkpoint, and resume immediately without requesting approval again.
