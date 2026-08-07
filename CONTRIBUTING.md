# Contributing to GAEP

## Current status

GAEP contains a local Founder Edition implementation alongside pre-implementation product and specification design. Contributions may improve the implementation when they are explicitly authorized for a bounded development scope, and may improve problem evidence, semantics, profiles, scenarios, trust, assurance, adoption, or governance. Existing code does not make the proposed specification approved, conformant, release-ready, or production-authorized; those determinations remain separately gated.

## Authority

A merged or committed contribution is not automatically an approved GAEP requirement. Candidate documents remain Proposed unless an exact version receives a complete approval record.

## Contribution expectations

- preserve the legacy Draft corpus unless a migration decision explicitly authorizes change;
- place candidate redesign work under `docs/next/`;
- follow the Document Metadata Contract and Normative Language and Conformance document;
- give normative requirements stable IDs and verification methods;
- bind changes to an explicit lineage/revision subject and declare compatibility, migration and invalidation consequences;
- distinguish evidence, inference, hypothesis, recommendation, decision and unknown;
- reference canonical terms instead of creating near-synonyms;
- separate normative dependencies from informative references;
- identify affected requirements, profiles, registries, scenarios and migration consequences;
- identify whether a result is a Gate Evaluation, Review Conclusion, Decision Outcome, Approval Determination, Authorization Grant or effect; never collapse them into a generic approval;
- keep standing authority, policy evaluation and executable authorization separate;
- avoid secrets, unnecessary personal data, confidential production information and unlicensed third-party material;
- include negative cases and burden consequences, not only intended behavior;
- do not claim current provider behavior without current authoritative evidence.

## Review dimensions

Changes are reviewed for product value, semantic ownership, cross-document consistency, security, privacy, AI risk, assurance, operations, adoption burden, portability, accessibility, legal/IP impact and migration compatibility as applicable.

Every expansion should also pass a subtraction review: can the same outcome be achieved with fewer concepts, required fields, state values, roles, artifacts or approval steps? Complexity that cannot show a proportional value or risk reduction remains a candidate gap, not a default requirement.

## Incremental development and push discipline

Every authorized implementation prompt must use the following repository workflow. This workflow preserves user and prior-agent work; it does not make a commit, test result, package, or push into Product Owner acceptance or implementation authority.

### Opening checkpoint

1. Read the applicable repository instructions and authority documents.
2. Inspect the current branch, upstream, ahead/behind state, staged, unstaged, untracked, ignored-package, stash, and linked-worktree state.
3. Treat unrelated inherited changes as valuable until reviewed. Do not discard, overwrite, reset, clean, or silently reformat them.
4. Before beginning the new prompt, review, verify, commit, and push any legitimate pre-existing dirty state as a separate preservation baseline. Exclude credentials, local runtime state, acceptance-workspace state, caches, logs, and generated package output.
5. If verification is not green, preserve the work with an explicitly labelled WIP commit and record every failing command honestly.

### Systemic implementation slices

- Implement shared platform patterns rather than checkpoint-specific or screenshot-specific patches.
- Split large prompts into cohesive cross-layer outcomes and commit each stable verified slice; do not wait for the whole prompt before preserving a meaningful milestone.
- When a pattern applies across GAEP, evaluate contracts and schemas, engine/runtime behavior, persistence and migration, protocol and projections, Product Studio, Chat, commands/actions, export, the Guideline, tests, and packaging.
- Preserve proposal, review, decision, approval, authorization, readiness, implementation, release, and acceptance as distinct claims at every layer.

### Commit and push quality

- Keep one meaningful outcome per commit and use a descriptive conventional commit message.
- Avoid unrelated formatting churn and never commit secrets, credentials, machine-local paths or state, editor caches, logs, temporary files, or Product Owner acceptance workspaces.
- Run the tests relevant to the slice before committing. A failing milestone must be explicitly identified as WIP and explain the failure.
- Push the opening preservation baseline, each stable green milestone, and the final handoff to the current upstream branch.
- Never force-push, rewrite history, merge, tag, release, deploy, or open a pull request without separate authority for that action.

### Final verification and handoff

1. Run the complete relevant verification suite, documentation validation, production build, package contract, and supported Extension Host checks.
2. Build the current installable extension with the repository's canonical script, install that exact artifact, and verify package-to-installed parity where supported.
3. Record the artifact version and digest, final branch/HEAD/upstream state, verification results, skipped or environmental checks, and final working-tree state.
4. Before closing the prompt, explicitly assess Guideline impact, visual lifecycle impact, methodology/reference impact, benchmark and executive-claim impact, migration impact, and Product Owner acceptance-test impact.
5. State what remains unverified. Packaging, installation, compilation, automated tests, a Git commit, or a push never constitutes Product Owner acceptance, baseline designation, approval, readiness, release, deployment, or action authority.

## Open contribution model

The public contribution and contributor-license model is not decided. External distribution or contribution acceptance requires the decisions recorded in `docs/next/00_GAEP_Product_Strategy/008_DISTRIBUTION_LICENSE_AND_ECOSYSTEM.md`.
