---
id: GAEP-SELF-020
title: P03-C1 Guideline UX and Decision-Support Correction Report
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: P03-C1 source-first onboarding, Source lifecycle, checkpoint presentation, Product-by-capability decision support, future-state projection, validation, visual inspection, VSIX packaging, and installation evidence
normative_level: informative
classification: internal
provenance: P03-C1 correction of rejected P03 commit 61e0a5390e4aebe955ea53078bd49038c3c44843 while preserving accepted P02-C2 base afae368c7772b0e0156e25defdcbe0147f0a5e65
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies: []
informative_references:
  - ../000_READ_FIRST.md
  - ../99_Registries_and_References/011_METHODOLOGY_REFERENCE_CATALOG.json
  - ../99_Registries_and_References/013_MARKET_EVIDENCE_AND_BENCHMARK_REGISTRY.json
  - ../99_Registries_and_References/014_GUIDELINE_PROJECTION_MANIFEST.json
  - ../99_Registries_and_References/014_GUIDELINE_PROJECTION_MANIFEST.schema.json
  - 016_P01_FINAL_CORRECTION_EXECUTION_REPORT.md
  - 018_P02_MARKET_BENCHMARK_CORRECTION_REPORT.md
  - 019_P03_VISUAL_GUIDELINE_EXECUTION_REPORT.md
  - ../../../apps/vscode/media/GAEP_GUIDE.md
  - ../../../apps/vscode/media/GAEP_MARKET_DECISION_GUIDE.md
  - ../../../scripts/templates/GAEP_GUIDE.template.md
supersedes: []
---

# P03-C1 Guideline UX and Decision-Support Correction Report

## Status and authority boundary

P03-C1 is implemented as a correction candidate and is not self-accepted. This Proposed, informative, internal receipt records implementation and verification evidence; it does not rewrite the rejected P03 receipt or convert it into acceptance. It does not approve GAEP, the Guideline, the target operating model, a Source, a market conclusion, a Product choice, a claim, publication, rollout, release, production use, security, compliance, readiness, or organizational authority. Product Owner acceptance remains unresolved. P04 has not started.

## Repository, history, and correction branch

| Field | Evidence |
|---|---|
| Repository | `/Users/mehdipanahi/Documents/test` |
| Accepted P02-C2 base | `afae368c7772b0e0156e25defdcbe0147f0a5e65` |
| Rejected P03 head | `61e0a5390e4aebe955ea53078bd49038c3c44843`; preserved and reachable |
| Correction branch | `feature/p03-c1-guideline-ux`; created from rejected P03 and pushed before correction work |
| Phase 1 | `98aa7b5acba4cbefd210a19bb08093a89697ca6b` — `fix(guideline): establish P03-C1 UX projection contract` |
| Phase 2 | `f0402f1c07d8f6778d777ff1d0327d535cd76174` — `fix(guideline): implement source-first and checkpoint guidance` |
| Phase 3 | `da54cee853ce5f8592d0634d7211e6db8ce8b3f2` — `fix(guideline): project evidence-backed market decision views` |
| Phase 4 | `75611f4d2531efaf097e4f1b80edf3902b201256` — `test(guideline): enforce P03-C1 product acceptance requirements` |
| Report commit | The commit whose subject is `docs(governance): record P03-C1 correction evidence`; its immutable SHA is resolved after commit rather than embedded self-referentially |
| P03-C1 range | `98aa7b5acba4cbefd210a19bb08093a89697ca6b` through the report commit containing this file |
| History operations | No reset, rebase, amend, squash, merge, tag, release, deployment, force-push, deletion, or history rewrite |

P00, P01, accepted P02-C2, rejected P03, and this correction remain reachable. The work did not modify `/Users/mehdipanahi/Documents/Project/Test GAEP V5`.

## Exact canonical inputs and projection bindings

| Input | Identity/version | SHA-256 | P03-C1 use |
|---|---|---|---|
| Methodology Reference Catalog | `GAEP-REG-011` v0.4.0; schema v2.1.0 | `6859769b56eeae9025dfff5407113dbc7b22ec7809e518d69a399effb156b209` | 16 assessed references, 25 concerns/mappings, limitations, freshness, official links, and collapsed cards |
| Market Evidence and Benchmark Registry | `GAEP-REG-013` v0.2.1; schema v2.1.0 | `3dcfe5531a1bb4630dc3afdb2990389728e2d39cac2ac915986badb9fe9e5c17` | 15 Products, 30 capabilities, 450 cells, exact support/availability assertions, evidence, dates, and limitations |
| Canonical Terminology Index | `GAEP-REG-005` v0.3.0 | `9e5765683133d3904742bd9a05be7a3323d83848b7015d06a864f5e37af6aca5` | Product, Initiative, Source, Baseline, Provenance, evidence, and authority vocabulary |
| Runtime presentation contract | `runtime-product-journey-presentation` v1.0.0 | `445797601923593b842041c02b630bbebdb4d9a16d9ccbf9540800ad6d192c54` | Stable checkpoint identities/order, states, overlays, actions, prerequisites, limitations, maturity, and compatibility metadata |
| Extension package contribution surface | `gaep-vscode-package` v0.1.0 | `7c9fcd2afc58b29e3b97fa22cfad94e7f053e1f878748a1582bf31647d102eac` | Exact Command Palette actions, Chat commands, package files, and version |
| Guideline Projection Manifest | `GAEP-REG-014` v0.3.0; schema v1.1.0 | `fbb922ce49d074244af19e0ad92e222038b5d1250e951c9fa7e02d262ffea653` | Source lifecycle, current/target/roadmap crosswalk, coverage audit, generated artifacts, and four audience layers |
| Manifest Schema | strict Draft 2020-12 v1.1.0 | `2d59d89815b98354f1e929e4730d5d43d3efd563d2f775239412d4ac873a2e7c` | Fail-closed shape, enum, cardinality, path, authority, migration, and source-event constraints |

P01 and P02 canonical files remained byte-identical to their accepted Git state. Their exact version/digest bindings are regenerated into maintainer details, not duplicated as handwritten truth.

## Generated architecture and artifacts

`GAEP-REG-014`, the narrative template, the shared runtime presentation contract, and the exact P01/P02 registries feed `scripts/lib/guideline_projection.mjs`. `scripts/render_guideline.mjs` writes both artifacts and `--check` compares exact bytes:

| Artifact | Size | SHA-256 | Role |
|---|---:|---|---|
| `apps/vscode/media/GAEP_GUIDE.md` | 1,105 lines; 90,197 bytes | `8babfc3640d47aaf9d133c54611192d257f6aa6db3166301910560e90ba8baeb` | Progressive orientation, first session, checkpoint/source guidance, current/target/roadmap views, and appendices |
| `apps/vscode/media/GAEP_MARKET_DECISION_GUIDE.md` | 990 lines; 363,607 bytes | `6872b090e4fe09ce1594aee7fdd93caeab1c5c46face0e3fd43a17c0652e5b7e` | Complete readable 15 × 30 Product/capability projection with exact cell evidence |

The decision guide is bundled in the VSIX and linked from the main Guide. It is generated, schema/semantics validated, drift checked, and not a raw JSON experience. Manual edits to either output fail deterministic validation.

## Resolution of the five rejected-review findings

### 1. First-session onboarding is source-first and truthful

The approximately three-minute Start Here route now begins with a trusted Product workspace and optional File, Folder, Useful Link, or No sources paths before the existing/new Product choice. Every displayed action is validated against actual VS Code contributions and runtime Chat commands. The Guide explains that `/adopt` needs readable documents, `/initialize` may proceed without sources, and `/intake` waits for current Product/Initiative/applicability prerequisites.

Selection/attachment, reasoning over exact content, reviewed candidate Source recording, acceptance, and explicit governed commit are five visibly separate boundaries. A Useful Link records portable metadata and is never fetched or read. Link-only input is not content evidence. Missing evidence remains visible. AI/document-derived candidates do not become governed until human review, exact acceptance, and `@gaep /commit CONFIRM`.

### 2. The complete Source lifecycle is visible without inventing runtime support

Source Intake, Source Baseline, and Source Provenance have distinct machine-readable concepts, review boundaries, revision rules, Adopt boundaries, and non-authority clauses. A vertical visual and event matrix cover Added, Changed, Removed/Excluded, Superseded, and Unavailable.

| Event | Honest current classification | Safe boundary |
|---|---|---|
| Source added | implemented, awaiting Product Owner acceptance | Explicit candidate recording; Baseline and Provenance remain separate decisions |
| Source content changed | partial | Preserve prior identity/revision; review exact new content and affected downstream work |
| Source removed or intentionally excluded | unsupported/unavailable | No claimed removal workflow; preserve records and use an explicit bounded candidate/workaround |
| Source superseded | unsupported/unavailable | No automatic inference; explicit scoped human decision only |
| Source temporarily unavailable/inaccessible | partial | Preserve known identity/revision and visible missing evidence; do not infer content or validity |

Every event exposes what the user sees, required user action, preserved/created record, Baseline review, Provenance review, possible downstream revalidation, current workaround, and what is not authorized. Filename, date, wording, locator, similarity, or replacement intent can never infer supersession.

### 3. Checkpoint state and navigation presentation is canonical and non-deceptive

`apps/vscode/src/product-journey-presentation.ts` is the shared presentation contract used by Product Studio and the Guideline. Primary progression is separate from attention overlays.

| Kind | Canonical labels |
|---|---|
| Primary progression | `✓ Recorded`; `◆ Candidate ready for review`; `! Needs decisions`; `Ⅱ Waiting for prerequisite`; `● Current`; `→ Next`; `○ Not started` |
| Attention overlays | `! Needs attention`; `⛔ Blocked`; `? Unresolved / Open questions` |

Each state/indicator includes meaning, candidate/governed boundary, user action, progression rule, persistence, and non-authority. Studio presentation imports the same contract, and tests reject label drift. Text markers remain visible without color.

The old false dynamic “You are here” list is replaced by an explicitly static vertical Previous/Current/Next example containing current state, candidate/governed status, blocker count, open questions, and next CTA. It states that Product Studio or `@gaep /status` is the live source.

### 4. Product-by-capability decision support retains all canonical evidence

The generated decision guide exposes every one of the 450 canonical cells exactly once. Each capability has a collapsible four-column Product comparison: Product; Support; Delivery; Exact evidence, dates, and limitation. Support and delivery remain distinct. Non-Unknown support resolves through exact active support assertions and evidence; shipped delivery requires an exact availability assertion. Product overview URLs are identity links only and never substitute for cell evidence.

Unknown remains Unknown and does not become No or Unsupported. Roadmap, preview, inference, and community-extension states do not become shipped. Evidence review/as-of/access dates, locators, limitations, freshness, and authority boundaries remain visible. P01 methodologies remain outside Product scoring. There is no universal winner or aggregate score, and GAEP repository maturity remains separate from market support.

### 5. Progressive disclosure and future evolution are explicit and testable

The Guide opens with value, audience, Start Here, and the three-minute route. Maintenance commands, canonical paths, complete digests, drift instructions, and projection ownership moved into collapsed maintainer details. Methodology cards, claims, scenario/category detail, and every capability comparison use progressive disclosure.

Current Runtime, Target Product-to-Operations Operating Model, and Transition Roadmap are separate generated views. The current 12 checkpoints and target 19 nodes are versioned snapshots, not permanent cardinalities. Stable IDs and explicit order support insertion, removal, deprecation, reordering, renaming, splitting, merging, compatibility aliases, and migration metadata. No renderer behavior relies on a final array index or permanent sequence number.

All 30 accepted capabilities map to at least one target node. Every target node maps to canonical capabilities or an explicit proposed gap. Every current checkpoint has a retained/expanded/split/merged/replaced roadmap record with dependency, implementation status, Product Owner acceptance status, and migration state. Architecture and DDD precede architecture-bound backlog. Product Design is tool-neutral; Figma is an optional adapter. ERP is illustrative, never universal.

## Current, target, roadmap, and unresolved gap boundary

| View | Evidence meaning |
|---|---|
| Current Runtime | Only repository/runtime behavior, stable checkpoint IDs, actual sequence, implemented actions/prerequisites, limitations, and maturity |
| Target Operating Model | Intended Product-to-Operations coverage from Product intent through operations/feedback; maturity remains current/awaiting acceptance/partial/planned as derived from canonical evidence |
| Transition Roadmap | Proposed migration relationship; not evidence that a target node or renamed concept is implemented |
| Coverage audit | Exact P02 capabilities plus Product Owner requirement records, current/target mappings, dispositions, sources, and gaps |

Two proposed canonical gaps deliberately block acceptance:

- `GAEP-P03-GAP-001` — implementation-target form taxonomy needs an accepted P02/successor correction for the full web/mobile/PWA/dashboard/admin/API/event/worker/integration and multi-project breadth.
- `GAEP-P03-GAP-002` — Source removal, exclusion, supersession, and temporary-unavailability need a future accepted Source-governance contract and runtime workflow.

A visually complete target or roadmap is not implementation evidence. Later implementation of future checkpoints, design adapters, repository synchronization, agents, CI/CD, release, deployment, or operations requires separately authorized prompts.

## Permanent acceptance and evolution tests

P03-C1 adds 32 product-level tests covering first-session semantics, the five Source events, state/indicator projection, live/static boundaries, all 450 market cells, exact assertion/evidence resolution, progressive disclosure, and future evolution. Synthetic tests prove:

- an added runtime checkpoint and an added target node project without renderer changes;
- reordering changes presentation without changing stable identity;
- renaming requires compatibility/migration metadata;
- splitting is representable;
- an unmapped capability fails validation;
- a newly mapped planned capability appears automatically and never becomes implemented;
- current, target, and transition states cannot be conflated;
- ERP remains illustrative, Figma cannot become a lifecycle stage, and architecture/DDD remain before backlog;
- backlog coverage retains target slice/repository topology mappings; and
- maturity, order, CTA, generated-file, or canonical-input drift invalidates stale output.

The prior P01/P02/P03 hostile suites remain intact, including exact digest/version drift, generated-file modification, Figma-as-phase, backlog-before-architecture/DDD, planned-as-implemented, Unknown-as-No, unsupported approval/publication, and accepted P01/P02 file mutation.

## Verification results

| Command or suite | Exact result |
|---|---|
| Focused Guideline | PASS — Schema/CLI 11; semantic/hostile 31; P03-C1 product acceptance/evolution 32; projection/package 10; total 84/84, zero skips |
| P01 methodology suites | PASS — Node 34/34; Ruby 10 + 48 + 5 runs, 221 assertions; total 97 test runs, zero skips/failures |
| P02 market suites | PASS — Schema 15; semantic/hostile 56; projection 12; total 83/83, zero skips/failures |
| `npm run check` | PASS — 1,590 passed of 1,591 total test runs; one environment-gated root-only file-ownership test skipped; zero failures |
| Documentation validation | PASS — strict methodology, market, Guideline, and Next-doc validation; zero warnings |
| Typecheck and build | PASS — `tsc -b` and all workspace builds |
| Projection drift | PASS — both generated artifacts byte-current |
| `git diff --check` | PASS |
| Native VS Code Extension Host | PASS — development activation/Guide preview, multi-root safety, isolated upgrade/reinstall/rollback/uninstall/final install, exact installed VSIX activation, Product Studio, recovery workflow, no implicit workspace mutation, and four-asset parity |
| Deterministic packaging | PASS — normalized file order, metadata, and timestamps |

The unfiltered `npm run check` breakdown is: Vitest 1,281 passed and one skipped of 1,282; Visual Studio CI contract 4/4; provider/example scenarios 41/41; P01 97/97; P02 83/83; and P03/P03-C1 84/84. The single skip is the intentional root-only ownership test on a non-root host.

`@vscode/test-electron` forces workspace trust disabled in its harness. The documented untrusted-host interaction limitation remains unchanged; no claim beyond the tested host behavior is made.

## Installed Markdown visual inspection

Visual QA used the normal installed VS Code 1.131.0 executable with a temporary isolated user-data directory and the active installed extension directory `/Users/mehdipanahi/.vscode/extensions`. It opened the actual installed files at `/Users/mehdipanahi/.vscode/extensions/gaep.gaep-vscode-0.1.0/media/`. Wide captures used 1,400 × 940; narrow captures used 720 × 940. The auxiliary Chat pane and host onboarding overlays were removed before inspection. Screenshots are temporary review evidence and are not committed.

| Theme/pane and artifact | Inspection result |
|---|---|
| Dark 2026, wide — `/private/tmp/p03c1-dark-wide-opening.png` | PASS — value/audience/Start Here precede maintenance; authority boundary, contents, hierarchy, wrapping, and contrast are readable |
| Dark 2026, wide — `/private/tmp/p03c1-dark-wide-quick-start.png` | PASS — vertical File/Folder/Link/No-source branching precedes adopt/initialize |
| Dark 2026, wide — `/private/tmp/p03c1-dark-wide-quick-start-methods.png` | PASS — source-method table and five non-conflated governance boundaries are readable |
| Dark 2026, wide — `/private/tmp/p03c1-dark-wide-source-lifecycle.png` | PASS — vertical Intake/Baseline/Provenance/change flow is readable and monochrome-safe |
| Dark 2026, narrow — `/private/tmp/p03c1-dark-narrow-position.png` | PASS — Previous/Current/Next, governed/candidate, blocker/open-question, CTA, and static/live boundary remain visible |
| Dark 2026, narrow — `/private/tmp/p03c1-dark-narrow-states.png` | PASS — text markers, overlays, and runtime mapping wrap without relying on color |
| Dark 2026, narrow — `/private/tmp/p03c1-dark-narrow-methodology.png` | PASS — all dense methodology cards are collapsed by default and long titles wrap |
| Light 2026, wide — `/private/tmp/p03c1-light-wide-mixed-capability.png` | PASS — CAP-101 shows adjacent Unknown and Partial/shipped cells, exact assertion/evidence links, dates, and limitations |
| Light 2026, wide — `/private/tmp/p03c1-light-wide-unknown-capability.png` | PASS — CAP-127 visibly renders Unknown, not No, with explicit absence-of-evidence limitation |
| Light 2026, narrow — `/private/tmp/p03c1-light-narrow-unknown-capability.png` | PASS — four columns remain distinguishable and wrap rather than lose Product/capability pairing |
| Light 2026, narrow — `/private/tmp/p03c1-light-narrow-evidence-wrap.png` | PASS — long review and limitation text wraps within the evidence column without clipping or semantic loss |

This engineering visual inspection is not Product Owner visual acceptance.

## Deterministic VSIX, active installation, and parity

Deterministic VSIX before the report commit: `apps/vscode/dist/gaep-vscode.vsix`, extension `gaep.gaep-vscode@0.1.0`, SHA-256 `685432bba3ad33e3159a92f6926a1579a0a9dbff5c7f51c8042060aa3d88f9a9`.

| Packaged asset | SHA-256 | Source | VSIX package | Active normal installation |
|---|---|---:|---:|---:|
| `dist/extension.cjs` | `5a63a32e1b5889b268a8629c5cbdb2783f6f2e54ce40f2681124829557679be4` | match | match | match |
| `dist/studio-client.js` | `b0bf87d69d1b8980e7f8d2a21fdbe5a5ed6f0180a53a75ee6a592ae4880d3fc6` | match | match | match |
| `media/GAEP_GUIDE.md` | `8babfc3640d47aaf9d133c54611192d257f6aa6db3166301910560e90ba8baeb` | match | match | match |
| `media/GAEP_MARKET_DECISION_GUIDE.md` | `6872b090e4fe09ce1594aee7fdd93caeab1c5c46face0e3fd43a17c0652e5b7e` | match | match | match |

The active normal profile inventory reports exactly `gaep.gaep-vscode@0.1.0` for GAEP. The exact deterministic VSIX is rebuilt and force-installed again after this report commit; because this report and test harness are not VSIX inputs, any post-report digest mismatch blocks closeout.

## Changed-file inventory

| Area | Files |
|---|---|
| Shared runtime presentation | `apps/vscode/src/product-journey-presentation.ts`; `studio-client.ts`; `studio-protocol.ts` |
| Projection contract | `docs/next/99_Registries_and_References/014_GUIDELINE_PROJECTION_MANIFEST.json`; `.schema.json` |
| Renderer and narrative | `scripts/lib/guideline_projection.mjs`; `scripts/render_guideline.mjs`; `scripts/templates/GAEP_GUIDE.template.md` |
| Generated/bundled output | `apps/vscode/media/GAEP_GUIDE.md`; `apps/vscode/media/GAEP_MARKET_DECISION_GUIDE.md`; `apps/vscode/package.json` |
| Permanent tests | `scripts/guideline_schema.test.mjs`; `guideline_semantics.test.mjs`; `guideline_projection.test.mjs`; `guideline_product_acceptance.test.mjs`; root `package.json` |
| Installed-package verification | `apps/vscode/test/e2e/run.mjs`; `apps/vscode/test/e2e/suite/index.cjs` |
| This evidence receipt | `docs/next/06_GAEP_On_GAEP/020_P03_C1_GUIDELINE_UX_CORRECTION_REPORT.md` |

## Known limitations and unresolved decisions

- Product Owner acceptance remains unresolved; both proposed canonical gaps block honest acceptance.
- Complete Source removal/exclusion/supersession/unavailability workflows are not current runtime capabilities. The Guide supplies conservative current workarounds without claiming implementation.
- The runtime still uses its legacy final-checkpoint wording; migration to the Product Design target abstraction is planned, not implemented.
- The 12 current checkpoints and 19 target nodes are current snapshots. Future additions must supply presentation/migration/coverage metadata or validation fails.
- Market evidence remains bounded to the accepted `2026-08-08` research snapshot. Unknown is preserved, and no winner score is authorized.
- Future target nodes do not implement Product Design adapters, repository synchronization, implementation agents, code generation, CI/CD, release, deployment, or operations behavior.
- The Extension Host cannot prove genuine untrusted-workspace UI behavior because its runner disables the trust boundary. Unit/semantic safety gates remain separate evidence.
- Visual screenshots are temporary engineering evidence. They do not establish accessibility certification, Product Owner acceptance, or support on untested hosts/themes.

## Git close contract

After this report commit, closeout requires: push the final branch; confirm upstream ahead/behind `0/0`; confirm clean worktree and empty stash; rebuild the deterministic VSIX from final HEAD; confirm the recorded digest; force-install that exact artifact in the active normal profile; re-read installed ID/version and all four source/package/installed hashes; rerun installed-package Extension Host verification; and reconfirm clean Git state. These mutable closing facts are reported in the final handoff after the non-self-referential report commit.

P03-C1 remains implemented but not accepted. P04 was not started.
