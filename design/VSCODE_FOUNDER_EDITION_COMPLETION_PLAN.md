# GAEP VS Code Founder Edition Completion Contract

Status: approved implementation contract, local Founder Edition

## Outcome

The completed Founder Edition is a local-first VS Code platform for designing a long-lived Product, planning bounded engineering Initiatives and Changes, selecting and switching installed AI agents and models, executing governed work, and preserving reconstructable evidence. It must remain useful without a cloud account or running AI provider.

This contract governs the continuous implementation job authorized on 2026-07-21. Rider and Microsoft Visual Studio feature implementations are excluded. Existing cross-host contracts must remain portable and must not be replaced with VS Code-only semantics.

## Product boundaries

GAEP owns:

- portable Product, Initiative, Change, Work Item, decision, requirement, risk, evidence, context, workflow, run, effect, handoff, and trace records;
- validation, revision, lifecycle, policy, readiness, context, trace, evidence, recovery, and export behavior;
- an explicit distinction between technical provider access and GAEP governance records;
- local orchestration of supported installed agent runtimes;
- the VS Code experience for product design and governed execution.

GAEP does not own provider credentials, silently modify provider configuration, infer formal organizational authority, manufacture independent review, or claim that local Founder acceptance is a public specification approval or production Authorization Grant.

## Architecture

1. **Portable contracts**: versioned, schema-validated JSON and JSONL under `.gaep/`.
2. **Local machine bindings**: executable paths, fingerprints, process state, and secrets references in VS Code global storage or an equivalent machine-local boundary, never in portable Product records.
3. **Local engine**: platform-independent state, policy, workflow, evidence, trace, and recovery services.
4. **Agent adapter SDK**: capability discovery, selection validation, invocation compilation, event normalization, cancellation, resume, and explicit limitations.
5. **Managed execution boundary**: filtered environment, provider-native sandbox and approval mapping, process supervision, event capture, postcondition checks, and fail-closed completion.
6. **Host protocol**: versioned JSON-RPC operations with server-derived capabilities and safe error contracts.
7. **VS Code host**: workspace-trust-aware Product Studio, native commands, trees, forms, diagnostics, output, status, accessibility, and multi-root selection.

The engine owns semantics. The VS Code layer owns presentation and host integration. Provider output is evidence input, not authoritative state by itself.

## Capability completion matrix

### Product design

- Product identity cannot be recreated over existing state.
- A resumable design draft covers problem, users and stakeholders, jobs, alternatives, outcomes, success measures, principles, constraints, assumptions, scope, exclusions, first workflow, data and AI considerations, risks, architecture direction, and roadmap hypotheses.
- Design readiness reports missing, weak, conflicting, and intentionally deferred areas.
- Product lifecycle remains independent from every Initiative lifecycle.
- Product records use optimistic revisions and retain revision history for material changes.

### Delivery model

- Initiatives target one Product and use validated transitions.
- Changes bind exact subject baselines or an explicit genesis declaration.
- Work Items belong to one Change, form an acyclic dependency graph, and carry completion/evidence criteria.
- Requirements, decisions, risks, architecture records, and evidence can be created, revised, linked, searched, and inspected.
- Trace impact reports identify upstream intent, downstream work/evidence, unresolved links, and stale dependants.

### Agents, models, and tools

- Codex and Claude Code are detected without reading credentials.
- Detection records canonical executable identity, version, fingerprint, observation time, truth class, and limitations.
- Model, reasoning, permission, sandbox, search, tool, and provider-specific options are adapter-declared and validated.
- Portable selection records do not embed absolute executable paths.
- A deterministic fake/manual adapter supports offline tests and product-design rehearsal.
- Unknown, lossy, unsupported, stale, or changed capabilities are visible and fail closed when required.

### Governance and execution

- A charter binds exact Product, Initiative, selection, policy, context, and source revisions.
- Default policy denies external, destructive, publication, commit, push, deployment, spend, privilege, and credential effects.
- Advisory charter text is never represented as technical enforcement.
- Provider-native controls are compiled from the charter and displayed before launch.
- Unsafe provider choices cannot be enabled through workspace-controlled settings and require an explicit local risk decision where supported.
- Runs use validated transitions and cannot become completed from exit code alone.
- Required evidence, normalized provider completion, and workspace postconditions determine completion; partial or unknown outcomes remain distinct.
- Cancellation, timeout, crash, stale lock, restart recovery, quarantine, retry, and resume preserve prior history.
- Every run captures request, actual process identity, normalized events, before/after workspace state, changed files, evidence, warnings, and terminal disposition.

### Switching and orchestration

- A material agent, model, setting, policy, context, or scope change creates a versioned handoff.
- Handoffs contain completed work, unresolved matters, decisions, evidence, actual effects, workspace baseline, capability differences, and acceptance state.
- Sequential plans support dependencies, preconditions, outputs, evidence, retries, and stop conditions.
- Parallel execution is permitted only for non-conflicting declared scopes; Founder defaults parallel agent work to read-only analysis.
- Effectful overlapping work fails closed rather than racing in one workspace.
- No provider, model, tool, region, or manual fallback occurs silently.

### Context and evidence

- Context packs identify exact sources, purpose, recipient, trust dimensions, transformations, omissions, warnings, classification, digest, and sufficiency.
- External or retrieved content remains untrusted data unless a governed instruction source explicitly grants instruction privilege.
- Secret-shaped content is rejected or redacted from portable context, prompts, evidence, logs, and handoffs.
- Evidence records origin, subject, method, result, digest, collection time, limitations, and verification status.
- Audit verification detects mutation, sequence gaps, deletion, and tail truncation using a checkpoint/anchor strategy.
- Record mutation and audit receipt cannot be reported as committed when only one side succeeded.

### Portability and operations

- `.gaep` is readable and exportable without the extension or an AI provider.
- Export validates records, excludes machine-local bindings and secrets, produces a manifest and digests, and supports safe import preview.
- Workspace health explains malformed records, identity mismatch, stale bindings, audit problems, interrupted runs, and repair options without destructive auto-repair.
- Multi-root workspaces require an explicit Product root and never silently switch roots.
- File watchers refresh derived views without reload loops.
- Diagnostics include version, storage roots, adapter state, current Product/run references, and redacted errors.

### VS Code experience

- Product, Agent, and Governance remain distinct top-level regions.
- The first-run path is resumable and never launches an agent.
- Product Studio provides overview, design readiness, delivery, trace, run/evidence, and settings surfaces using VS Code theme tokens.
- Every operation is available through the Command Palette and keyboard.
- Focus order, labels, descriptions, errors, selection, contrast, zoom, narrow widths, reduced motion, and screen-reader semantics are verified.
- No static screenshot, generated image, custom font, gradient, decorative dashboard filler, or chat imitation is used.

## Storage and trust invariants

- Paths are lexically contained and symlink escapes are rejected for managed writes.
- Writes are atomic; concurrent modifications use revisions and lock leases.
- Stale locks are recoverable only after ownership and heartbeat checks.
- Portable data contains stable logical identities; local bindings contain host-specific paths and fingerprints.
- Workspace trust is required before executable discovery, Product mutation, or agent launch.
- Workspace settings cannot redirect trusted agent executables or disable mandatory launch confirmation.
- Child processes receive a documented allowlist of environment variables plus explicit adapter additions; known secret variables are not copied by default.
- Logs and errors are bounded, redacted, and free of prompts or provider credentials unless the user explicitly exports a reviewed evidence item.

## Verification gates

Completion requires retained evidence for:

1. schema and state-transition unit tests;
2. property and negative tests for containment, audit integrity, revisions, cycles, redaction, policy, and RPC validation;
3. adapter argument, stdin, environment, malformed-stream, timeout, cancellation, resume, version-change, and fake-runtime tests;
4. engine integration tests for the full Product-to-evidence workflow and every recovery path;
5. VS Code extension-host tests for trust, onboarding, multi-root selection, commands, trees, watchers, run lifecycle, and persisted restart state;
6. accessibility and narrow-layout inspection of every primary surface;
7. dependency, license-status, secret, static-security, and exhaustive Codex Security review with validated findings remediated or explicitly retained;
8. package-content inspection, clean-profile install, first-run smoke, upgrade from 0.1.0, rollback rehearsal, and final installation into the normal VS Code profile;
9. `git diff --check`, TypeScript type checking, all tests, build, documentation validation, and VSIX packaging;
10. a final readiness report that distinguishes verified local capability from formal approval, public distribution, signing, marketplace, live third-party, legal, and organizational evidence that did not occur.

## Definition of done

The job is done only when the packaged VSIX installed in the normal VS Code profile can create or open a Product, complete and resume product design, plan bounded work, select a detected or fake agent, compile and confirm enforceable controls, run or rehearse the work, capture evidence, recover interruption, switch through a handoff, inspect traceability and readiness, export the portable Product, and diagnose failures without editing JSON by hand.

Any excluded external certification or formal-human decision must be reported as an external non-claim, not hidden as an unfinished software feature and not fabricated as completed evidence.
