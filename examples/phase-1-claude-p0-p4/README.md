# Phase 1 Claude P0-P4 Acceptance Fixture

This fixture exercises one complete synthetic candidate Product chain through GAEP's shared governed engine and the production Claude CLI stream-JSON invocation/parser boundary. It makes P1-31 repeatable, inspectable, and hostile-verifiable without live credentials or network access.

## What the workflow proves

- the shared engine creates 21 ordered governed P0-P4 candidate records;
- the exact current chain is evaluated through the 25-output P0-P4 Readiness Gate;
- a 25-item P5 Handoff Package preserves applicable and explicitly not-applicable output states;
- a Context Pack binds every created candidate record, the readiness gate, and the handoff by exact identity, revision, and digest;
- a resolved Workflow Plan and confirmed Charter admit one observation-only managed run;
- the production Claude invocation builder and stream-JSON parser are exercised through a deterministic local executable fixture;
- the invocation remains tool-free, context-only, fresh-process, non-resumable, and outside every write or external-effect envelope;
- raw provider postcondition status remains `not-assessed`, while one exact attested Workflow evaluator governs the satisfied Workflow result;
- normalized output redaction, audit, preview, result, evidence, event, and Context bindings reconcile exactly;
- the resulting semantic receipt is deterministic across repeated runs.

## What the workflow does not prove

The fixture does not contact a live provider and does not establish authentication, entitlement, reachability, model quality, usage, cost, native-host acceptance, Product Owner acceptance, readiness authority, security assurance, release authorization, or deployment approval. The generated records are candidate test data, not an approved Product baseline. A passing readiness evaluation remains an evaluation result, not permission.

The Claude lane does not advertise resume, Tool selection, filesystem access, writes, browser/MCP access, or effects. P1-31 does not widen that production boundary. No new IDE protocol is introduced; native-host acceptance remains separate and unestablished.

## Run and verify

Run the deterministic acceptance workflow:

```bash
npm run acceptance:claude-p0-p4
```

Write a new private receipt without overwriting an existing file:

```bash
npm run acceptance:claude-p0-p4 -- --output /path/to/new-receipt.json
```

Verify a receipt against the exact current integration region and fake stream source digests:

```bash
npm run verify:acceptance:claude-p0-p4 -- /path/to/receipt.json
```

Run repeatability, no-overwrite, and hostile receipt tests:

```bash
npm run test:acceptance:claude-p0-p4
```

The executable workflow is defined by `packages/engine/src/business-understanding.test.ts`. The runner and strict verifier are `scripts/run_claude_p0_p4_acceptance.mjs` and `scripts/verify_claude_p0_p4_receipt.mjs`.
