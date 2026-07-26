# Phase 0 — Provider/Model Read-Only Example (GAEP-P0-CS02)

Exercises the shared provider/model read-only slice over the versioned Engine Host protocol (v3)
and emits tracked, digest-verified acceptance artifacts.

## Run

```bash
npm run build          # shared engine + engine-host + extension
npm run release:cs02   # produces dist/phase0/cs02/ artifacts, manifest, checksums
npm run example:cs02   # emits acceptance report + evidence manifest
npm run evidence:cs02  # same, with digest verification
```

## Outputs

| Path | Tracked? | Contents |
|---|---|---|
| `acceptance/GAEP-P0-CS02_ACCEPTANCE_REPORT.json` | yes | Real provider truth, dashboard projection, host package states, source identity |
| `acceptance/GAEP-P0-CS02_EVIDENCE_MANIFEST.md` | yes | Commands, environment, provider/model truth, hashed artifacts (does not hash itself) |
| `evidence/*` | no (git-ignored) | Raw machine-local catalog/log output |

Provider detection is real. No analysis run is *claimed* by this example; a bounded read-only
analysis requires an initialized Product and is exercised by the Product Owner manual test and the
`packages/engine/src/read-only-analysis.test.ts` suite. Unavailable hosts/providers remain
`not-run`/`pending-environment`.
