# Canonical Phase 0 managed read-only example

This example exercises GAEP's real portable Product, Initiative, Context Pack, Workflow Plan, Execution Charter, digest-attested preview, managed execution, normalized evidence, audit, and bounded inventory contracts. It uses the in-process deterministic adapter, so it requires no provider account, credential, executable, or network access.

Run the disposable example and print its verified receipt:

```bash
npm run example:phase0
```

Create a new inspectable artifact directory containing `receipt.json` and the complete fixture-local `workspace/.gaep` store:

```bash
npm run example:phase0 -- --artifacts /tmp/gaep-phase0-example
```

The target directory must not already exist. The runner never reuses or overwrites an artifact directory. To save only the private-safe bounded receipt while deleting the temporary workspace after execution:

```bash
npm run example:phase0 -- --output /tmp/gaep-phase0-receipt.json
npm run verify:example:phase0 -- /tmp/gaep-phase0-receipt.json
```

`scenario.json` is the canonical governed input. `expected-summary.json` is the identity- and timestamp-independent semantic expectation. Generated Run IDs, timestamps, and record digests remain truthful and can differ on every execution; `summaryDigest` must remain exact across runs.

The receipt deliberately contains no raw provider output, provider thread/turn IDs, local paths, credentials, or source content. Its integrity section binds the portable managed record, result, evidence, event inventory, audit, and snapshot checks performed before output. The persisted `.gaep` store is available only when `--artifacts` is explicitly selected.

This is local deterministic example evidence. It does not validate a real provider, native IDE installation or interaction, accessibility, release acceptance, deployment approval, or production readiness.
