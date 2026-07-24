# Phase reports

This directory contains generated, private-safe phase-scoped evidence projections. Each report binds exact package, host, provider, conformance, example, and validation receipts while preserving incomplete native, live-provider, security, readiness, release, and human-acceptance states.

Generate a new no-overwrite Phase 0 / 1A report only from a clean tracked worktree:

```bash
npm run report:phase0 -- evidence/phase-reports/<timestamp>-phase-0-local.json
```

Verify an existing report against the current bound source receipts and package bytes:

```bash
npm run verify:phase0-report -- evidence/phase-reports/<timestamp>-phase-0-local.json
```

A passing report is evidence consistency, not phase completion, Product acceptance, security approval, release authorization, or deployment approval.
