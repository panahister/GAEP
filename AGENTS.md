@/Users/aligeek/.codex/RTK.md

# GAEP Repository Agent Instructions

This file applies to the whole repository. It is the durable operating contract for Codex, Claude Code, and any other coding agent working in GAEP. A more deeply nested `AGENTS.md` may add path-specific rules. System instructions, explicit user instructions, and repository authority documents take precedence over this file.

Codex must also read [`CODEX.md`](CODEX.md) before implementation. Other agents should use its current-state and continuation sections when compatible with their runtime.

## 1. Product identity

GAEP is a governed engineering control plane, not a prompt library or an ordinary code generator. It preserves explicit, versioned, reviewable continuity between:

```text
Product intent
-> Initiative scope
-> architecture and design
-> requirements and backlog
-> implementation candidates
-> tests and evidence
-> human decisions
-> release and learning
```

The current implementation is local-first. Portable governed records live under a workspace's `.gaep/` directory. Product Studio inside VS Code is the primary user-facing surface for the current local product work.

North-star, target-platform, first-release, and current-implementation claims are different things. Never present a target capability as currently available without repository evidence.

## 2. Authority and source-of-truth order

Before deciding product meaning or delivery status, use this order:

1. the active user instruction;
2. the applicable system and agent instructions;
3. [`docs/01_Foundation/001_GAEP_CONSTITUTION.md`](docs/01_Foundation/001_GAEP_CONSTITUTION.md) and other higher-authority approved documents;
4. [`docs/GAEP_PLATFORM_PRODUCT_IDENTITY_MANIFEST.md`](docs/GAEP_PLATFORM_PRODUCT_IDENTITY_MANIFEST.md) for product identity and horizons;
5. [`docs/06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md`](docs/06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md) for feature status and acceptance state;
6. [`docs/06_Roadmap/055_GAEP_CONTINUOUS_IMPLEMENTATION_CONTROL.md`](docs/06_Roadmap/055_GAEP_CONTINUOUS_IMPLEMENTATION_CONTROL.md) for the live execution checkpoint and exact next action;
7. the newest committed code, tests, evidence, package, and Git history;
8. the proposed `docs/next/` corpus where the active task depends on it.

Dashboards, projections, receipts, reports, comments, and this file are not alternative sources of Product truth. If a snapshot in this file disagrees with current Git or the control documents, investigate and use the newest verified durable checkpoint.

## 3. Mandatory startup procedure

Before modifying anything:

1. read this file, `CODEX.md`, `/Users/aligeek/.codex/RTK.md`, the Product Identity Manifest, the tracker, and the continuous-implementation control document;
2. inspect the current branch, full HEAD, upstream divergence, status, staging area, recent commits, and timestamps;
3. inspect the latest relevant phase report, VS Code checkpoint receipt, VSIX, tests, and documentation;
4. identify the active Feature ID and exact subtask from the newest verified checkpoint;
5. inventory all dependencies named by that feature before defining a new contract;
6. preserve every pre-existing user change, including staged, unstaged, and untracked work;
7. investigate any dirty-tree or checkpoint discrepancy before editing;
8. continue safely when work can be isolated; stop only if a genuine conflict cannot be preserved.

Never rely on conversation memory or hashes copied into this file without refreshing the repository first.

## 4. Current execution boundary

Until the Product Owner explicitly changes the active execution instruction:

- prioritize the local VS Code product and Product Studio;
- make shared contract, engine, protocol, or adapter changes only when required by the VS Code feature;
- preserve compatibility for existing hosts with the smallest necessary shared adjustment;
- do not add new Kiro, Rider, or Visual Studio functionality, commands, views, packages, tests, evidence, or conformance projections;
- do not edit host-specific Kiro, Rider, or Visual Studio files unless a shared change would otherwise cause an unavoidable compile-time break and the minimal compatibility edit is safe;
- do not record this operating priority as a permanent product-scope change, cancellation, deprecation, rejection, deferral, acceptance decision, or release decision;
- preserve all historical non-VS-Code implementations and evidence unchanged;
- do not claim a new four-host conformance checkpoint during the VS Code-only work wave.

This is an execution priority, not a modification of GAEP's target multi-host product architecture.

## 5. Approved local work and prohibited actions

Within an active implementation task, ordinary local work may include code and documentation edits, focused tests, shared-and-VS-Code regression tests, deterministic local evidence, isolated extension-host verification, VSIX creation, and small local commits.

Unless the current user explicitly grants broader authority, do not:

- access or expose credentials, secrets, tokens, keychains, private prompts, or sensitive environment values;
- call live Codex, Claude, Figma, OAuth, marketplace, or other external services;
- mutate external accounts, cloud systems, production data, or external environments;
- install or change the normal-profile VS Code extension;
- push branches, open pull requests, publish packages, sign releases, release, or deploy;
- create a real governed stage or apply generated changes outside the repository implementation task;
- bypass authentication, entitlement, administrator policy, workspace trust, or runtime restrictions;
- infer or manufacture human approval, Product Owner acceptance, security acceptance, native-host acceptance, provider acceptance, release authorization, or deployment authorization.

Use temporary isolated VS Code user-data and extension directories for lifecycle testing.

## 6. Architecture and feature implementation pattern

Implement each governed feature in this order unless current repository dependencies require a smaller preliminary compatibility fix:

1. inventory and exact-bind all predecessor records;
2. define a versioned shared contract and strict validation schema;
3. implement immutable engine lifecycle and history;
4. create deterministic digests and receipts;
5. implement fail-closed assessment, stale-binding rejection, and health projection;
6. expose only the protocol transport required by VS Code;
7. add Product Studio data-source projections;
8. render the feature in the actual accessible Product Studio client;
9. add VS Code commands, views, refresh, loading, empty, offline, interrupted, and error behavior where applicable;
10. add focused contract, engine, protocol, Product Studio, and VS Code tests;
11. run the affected shared-and-VS-Code regression gate;
12. build and verify the VSIX in isolated profiles when locally supported;
13. write a privacy-safe scoped receipt and documentation;
14. update tracker and control checkpoint without overstating status;
15. create small reviewable local commits at durable boundaries.

Prefer the established `packages/contracts` -> `packages/engine` -> `apps/vscode` flow. Reuse current schemas, canonicalization, receipt, history, health, protocol, and Product Studio patterns instead of creating parallel semantics.

## 7. Candidate truth and fail-closed semantics

GAEP distinguishes candidate metadata from observed or authorized truth. Contracts and UI must keep these separate:

- a repository-relative path candidate is not proof that a file exists;
- a symbol candidate is not source inspection;
- a generated-output candidate is not generated output;
- an expected test is not a test asset, execution, result, coverage, or quality finding;
- a Figma identity/version is not live Figma retrieval or design approval;
- a provider/model candidate is not availability, execution, output quality, or provider acceptance;
- a stage, apply, discard, rollback, conflict, or recovery candidate is not a real effect or outcome;
- local evidence is not approval, authorization, release, or deployment truth.

Required behavior:

- exact-bind identity, revision, digest, and predecessor lineage;
- reject missing, duplicated, stale, conflicting, unbounded, malformed, or privacy-unsafe data;
- record gaps, conflicts, stale bindings, unanswered questions, not-performed actions, and not-assessed properties explicitly;
- never convert absence of evidence into success;
- keep decision authority attributable, scoped, version-bound, and human-controlled;
- keep candidate trace metadata separate from repository, source, symbol, output, test-result, approval, and acceptance truth.

## 8. Privacy, confinement, and deterministic evidence

Persist or report only what the applicable schema requires. Prefer bounded counts, enums, repository-relative paths, stable identifiers, digests, and status values.

Do not include:

- absolute machine paths;
- environment values or credentials;
- raw provider output or prompts;
- source bytes when a digest and bounded metadata are sufficient;
- unbounded command output;
- local usernames, process details, or unrelated workspace contents.

Validate repository-relative paths, path normalization, traversal rejection, symlink/no-follow assumptions, archive contents, stage confinement, stale bindings, tamper detection, message origins, command authority, CSP/local-resource restrictions, and evidence redaction where applicable.

Automated security checks may identify and fix local defects, but they cannot grant security approval. Follow any applicable security skill or repository security policy before a security scan.

## 9. Product Studio quality rules

Product Studio is a governed projection of engine state and the primary VS Code product surface.

- Adding a data-source table is not enough: verify the actual client renders it.
- Every declared Delivery table or feature projection needs a visible renderer test.
- Preserve accessible headings, landmarks, tables, names, descriptions, keyboard behavior, focus, status announcements, reduced-motion behavior, and contrast assumptions.
- Cover loading, empty, valid, invalid/error, offline, interrupted, refresh, reopen, and multi-root behavior when relevant.
- Keep display projections bounded and privacy-safe.
- A health projection must fail closed on missing or inconsistent predecessor data.
- Do not silently mutate the workspace while opening, refreshing, or inspecting Product Studio.
- Do not treat DOM/unit coverage as manual visual, native accessibility, or Product Owner acceptance.

The historical renderer omission fixed by commit `565d0325` is a permanent regression lesson: test the visible Product Studio output, not only the protocol and data source.

## 10. Editing and Git discipline

- Use `rtk` before every shell command. Use `rtk proxy` when exact/raw output is needed.
- Search with `rg` or `rg --files` first.
- Use `apply_patch` for manual file edits.
- Do not use destructive Git commands or overwrite unrelated changes.
- Do not use `pnpm`; this repository is npm-workspace based. Avoid commands that create an unrequested lockfile or workspace manifest.
- Do not modify generated artifacts by hand when a deterministic repository script owns them.
- Stage only the files belonging to the current checkpoint.
- Review the staged diff before every commit.
- Never amend or rewrite user commits without explicit instruction.
- Never push.
- Use small commits whose messages describe the implemented VS Code/shared outcome. Do not mention the temporary non-VS-Code priority as a product decision.

Suggested checkpoint sequence for a new feature:

```text
feat: define <feature> contract
feat: add <feature> engine
feat: show <feature> in Product Studio
docs: record <feature> VS Code evidence
docs: seal <feature> continuation checkpoint
```

Use fewer commits when the change is genuinely atomic; do not create empty or misleading checkpoint commits.

## 11. Validation commands

Choose the smallest affected gate during development, then run the broad relevant gate before sealing. All commands are from the repository root.

```bash
rtk proxy npx vitest run <focused-files> --maxWorkers=4
rtk npm run typecheck
rtk proxy npx vitest run packages apps/vscode --maxWorkers=4
rtk npm run validate:docs
rtk proxy npm run package:vscode
rtk proxy npm run test:vscode:extension-host
rtk proxy npm run test:vscode:local-e2e
rtk proxy npm run test:vscode:local-e2e-report
```

Run only the gates relevant to the changed feature. Do not run non-VS-Code host package, native, or conformance suites during the current priority wave.

Important packaging rule: the extension-host lifecycle can rebuild the VSIX. Record the final package size and SHA-256 only after the last command that can rebuild it. Do not rebuild after issuing an exact package receipt. A matching extension version does not prove matching contents.

The current artifact path is:

```text
apps/vscode/dist/gaep-vscode.vsix
```

## 12. Evidence and acceptance vocabulary

State exactly what a check establishes and what it does not.

Use these distinct terms:

- **local unit/integration pass:** deterministic process-level behavior;
- **local isolated extension-host pass:** activation and automated host behavior in a temporary profile;
- **package lifecycle pass:** tested local install/upgrade/reinstall/rollback/uninstall flow for the exact receipt artifact;
- **native manual acceptance:** a human verified behavior in the supported host and environment;
- **live-provider/Figma validation:** real authorized service interaction;
- **security acceptance:** accountable review and decision, not just scan output;
- **Product Owner acceptance:** explicit attributable acceptance of an exact version;
- **release-ready:** all declared release gates satisfied for an exact artifact;
- **released/deployed:** authorized external action actually performed.

Never collapse one category into another. The isolated Electron harness currently disables workspace-trust enforcement; therefore it does not establish native untrusted-workspace behavior. Same-profile restart plus explicit reopen does not establish automatic native window/webview restoration.

Receipts must include the source checkpoint, commands/results, exact scope, bounded evidence, package identity when relevant, privacy statement, limitations, and authority boundary.

## 13. Tracker and control-document rules

- Update only Feature IDs actually touched.
- `In Progress` means implementation exists but one or more required gates remain open.
- Coding agents may advance a feature only as far as `Ready for Test` when the tracker's conditions are truly met.
- `Done` requires explicit Product Owner acceptance plus the required evidence.
- Recount all 168 Feature Registry rows after a status change; never edit summary totals by intuition.
- Preserve the canonical inventory: 35 `PLT-*`, 36 `P1-*`, 26 `P2-*`, 24 `P3A-*`, 30 `P3B-*`, and 17 `P4-*` features.
- Do not reinterpret historical four-host evidence when producing a VS Code-only checkpoint.
- Keep control-document `Last stable checkpoint`, `Active work`, `Next exact action`, limitations, and resume point synchronized with the committed state.
- A report, evidence file, or tracker edit is not sealed until it is committed and the checkpoint references the correct commit.

## 14. Interruption and continuation

Before an interruption or natural checkpoint, record:

- branch, full HEAD, upstream divergence, and clean/dirty/staged state;
- commits completed in the current feature;
- active Feature ID and exact unfinished subtask;
- tests run, exact pass/fail/skip counts, and tests not run;
- evidence paths and final VSIX identity if already stable;
- unresolved defects, blockers, limitations, and acceptance boundaries;
- exact next command or code action.

When the user says `continue`:

1. treat it as authorization to resume the same approved local work;
2. briefly revalidate Git, tracker, control, evidence, and package state;
3. preserve user changes;
4. use the newest verified repository checkpoint;
5. do not restart completed work;
6. do not ask for routine approval;
7. continue through subsequent correctly ordered VS Code work until exhausted or genuinely blocked.

A manual interruption pauses execution only; it is not cancellation or acceptance.

## 15. Stop conditions

Stop and ask the user only when:

- required authority materially exceeds the active instruction;
- credentials, live-provider access, external mutation, publication, release, or deployment are required;
- conflicting user changes cannot be preserved safely;
- multiple materially different product outcomes cannot be resolved from repository contracts and evidence;
- an unrecoverable environment or permission failure prevents meaningful progress.

An ordinary test failure, type error, stale generated file, package problem, or local implementation defect is not a stop condition. Diagnose, fix, rerun, and continue. If one optional gate is externally blocked, preserve the limitation and continue independent local work.

## 16. Communication

Report outcomes plainly and distinguish confirmed evidence from inference. During continuous work, keep updates concise and include:

```text
STATUS: active wave/feature
DONE: committed outcomes
IN PROGRESS: exact atomic task
VALIDATED: commands and results
BLOCKERS: genuine blockers or none
NEXT: exact next action
CHECKPOINT: branch and commit
```

Do not use a local success to claim native, live, security, human, release, or deployment acceptance.
