# Phase 3A Claude Code Readiness Workflow

This fixture reproduces the exact ordered P3A-01 through P3A-20 candidate sequence from the sealed Codex readiness scenario for the Atlas Release Readiness reference Product. It binds the canonical Codex scenario and sealed workflow receipt, a freshly verified deterministic tool-free Claude receipt, current P3A-21 report and conformance evidence, two exact reopen observations, three fail-closed recovery cases, the Product Studio Implementation Readiness table, and all four host projections.

Run and verify it with:

```sh
npm run example:phase3a-claude-readiness -- evidence/examples/<new-artifact-directory>
npm run verify:example:phase3a-claude-readiness -- evidence/examples/<artifact-directory>
```

The artifact is deterministic offline evidence only. It does not call live Claude, read OAuth or keychain state, inject credentials, bypass administrator policy, prove supported-runtime availability or semantic model quality, establish real Product or readiness truth, waive a gap, appoint an owner, grant implementation authority, prove native-host interaction, complete security review, or authorize release or deployment.
