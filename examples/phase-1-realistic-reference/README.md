# Phase 1 realistic reference example

This example binds one canonical `Atlas Release Readiness` Product and Initiative to the complete governed P0–P4 candidate chain. It executes both deterministic provider paths, materializes two independently inspectable `.gaep` stores, compares their exact structural evidence, and publishes a 25-item output catalog without treating local completion as Product readiness or acceptance.

Build and create a new artifact directory:

```bash
npm run example:phase1-reference -- --artifacts /tmp/gaep-phase1-reference
```

Reopen and independently verify the scenario, provider receipts, comparison, output catalog, both portable stores, audit chains, managed Runs, readiness evaluations, handoffs, receipt, and complete file inventory:

```bash
npm run verify:example:phase1-reference -- /tmp/gaep-phase1-reference
```

The target directory must not already exist. Generation uses a private staging directory, refuses reuse or overwrite, verifies the complete result before an atomic rename, and removes only its own staging directory after failure. The final artifact contains:

- the exact repository scenario and a digest-bound 25-output catalog;
- independently source-verified Codex and Claude receipts plus their structural comparison;
- one Codex and one Claude `workspace/.gaep` store containing the complete governed record chain;
- a derived receipt that reopens both stores and reconciles Product, Initiative, health, audit, Run, readiness, and handoff evidence; and
- a manifest covering every regular artifact file except the manifest itself.

Added, removed, replaced, oversized, non-regular, symlinked, source-drifted, audit-invalid, or semantically inconsistent content fails verification. The artifact contains deterministic reference data and no live credentials or provider access. It does not establish a real Product baseline, provider quality, native-host acceptance, Product Owner acceptance, readiness, security assurance, release authorization, deployment approval, or action authority.
