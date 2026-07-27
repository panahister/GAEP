# Phase 1 Provider Output Comparison

This P1-32 acceptance harness compares the exact current deterministic P1-30 Codex and P1-31 Claude receipts. It separates structural parity that can be proved from quality and preference claims that cannot.

## Assessed criteria

The harness compares six exact receipt projections:

1. governed P0–P4 record kinds and count;
2. readiness result, counts, applicability, and authority state;
3. P5 handoff state, counts, acknowledgement, and transfer-authority state;
4. terminal Workflow state, provider disposition, governed outcome, and step completion;
5. audit, preview, result, evidence, event, and Context binding integrity; and
6. receipt and managed-readonly authority boundaries.

It separately records semantic output quality and live-provider operational quality as `not-assessed` because portable receipts intentionally retain no raw provider output and both runs use deterministic local fixtures.

## Expected divergence

The comparison records provider identity, managed execution mode, staging evidence, provider-postcondition evidence, and runtime warning evidence as expected runtime differences. These differences are not provider defects and do not establish a winner.

The resulting receipt always preserves `providerPreference: not-established` and `automaticSelectionAuthority: not-granted`. It is not evidence of live-provider quality, realistic Product readiness, Product Owner acceptance, security completion, release authorization, or deployment approval.

## Run and verify

```bash
npm run acceptance:provider-comparison
npm run acceptance:provider-comparison -- --output /path/to/new-comparison.json
npm run verify:acceptance:provider-comparison -- /path/to/comparison.json
npm run test:acceptance:provider-comparison
```

Optional `--codex` and `--claude` arguments accept repository-relative receipt paths. Both source receipts must pass their own strict current-source verifiers before comparison.
