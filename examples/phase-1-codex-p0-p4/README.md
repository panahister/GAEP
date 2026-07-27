# Phase 1 Codex P0-P4 Acceptance Fixture

This fixture exercises one complete synthetic candidate Product chain through GAEP's shared governed engine and isolated Codex app-server transport. It exists to make P1-30 repeatable, inspectable, and hostile-verifiable without live credentials or network access.

## What the workflow proves

- the shared engine creates 21 ordered governed P0-P4 candidate records;
- the exact current chain is evaluated through the 25-output P0-P4 Readiness Gate;
- a 25-item P5 Handoff Package preserves applicable and explicitly not-applicable output states;
- a Context Pack binds every created candidate record, the readiness gate, and the handoff by exact identity, revision, and digest;
- a resolved Workflow Plan and confirmed Charter admit one observation-only managed run;
- the real Codex app-server v2 transport is exercised through a deterministic local server fixture;
- the managed stage produces zero changes and the audit, preview, result, evidence, event, and Context bindings reconcile exactly;
- the resulting semantic receipt is deterministic across repeated runs.

## What the workflow does not prove

The fixture does not contact a live provider and does not establish authentication, entitlement, reachability, model quality, usage, cost, native-host acceptance, Product Owner acceptance, readiness authority, security assurance, release authorization, or deployment approval. The generated records are candidate test data, not an approved Product baseline. A passing readiness evaluation remains an evaluation result, not permission.

No new IDE protocol is introduced for P1-30. The workflow composes the existing shared-engine P0-P5 records and managed Codex execution capabilities whose bounded projections are already covered by the four-host conformance contract. Native-host acceptance remains separate and unestablished.

## Run and verify

Run the deterministic acceptance workflow:

```bash
npm run acceptance:codex-p0-p4
```

Write a new private receipt without overwriting an existing file:

```bash
npm run acceptance:codex-p0-p4 -- --output /path/to/new-receipt.json
```

Verify a receipt against the current integration test and fake app-server source digests:

```bash
npm run verify:acceptance:codex-p0-p4 -- /path/to/receipt.json
```

Run the repeatability, no-overwrite, and hostile receipt tests:

```bash
npm run test:acceptance:codex-p0-p4
```

The executable workflow is defined by `packages/engine/src/business-understanding.test.ts`. The runner and strict verifier are `scripts/run_codex_p0_p4_acceptance.mjs` and `scripts/verify_codex_p0_p4_receipt.mjs`.
