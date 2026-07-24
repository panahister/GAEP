# Phase 0 — Platform Readiness Example (GAEP-P0-CS01)

A repeatable, realistic example that exercises the shared readiness path end-to-end and produces
durable, inspectable evidence.

## What it does

1. Spawns the shared **engine-host** against a fresh temporary workspace.
2. Calls the protocol-**v2** `platformReadiness` RPC endpoint to obtain the **Base Snapshot**
   (provider readiness from `probeAgents`, workspace readiness from `workspaceHealth`, and the
   Four-IDE Host Matrix defaulted to `not-run`/`pending-environment`).
3. Runs the **engine-host RPC boundary check** (a contract/boundary result — **not** an IDE host row).
4. Performs the explicit merge (`composePlatformReadinessReport`). This runner does **not** execute
   the VS Code extension-host E2E, so VS Code produces **no observation** and stays `not-run`;
   Visual Studio, Rider, and Kiro are not executed and keep their `pending-environment` defaults.

## Run

```bash
npm run build          # engine-host + conformance must be built first
npm run example:phase0
```

## Outputs

| Path | Tracked? | Contents |
|---|---|---|
| `acceptance/GAEP-P0-CS01_READINESS_REPORT.json` | **yes** | Normalized, sanitized Final Platform Readiness Report |
| `acceptance/GAEP-P0-CS01_EVIDENCE_MANIFEST.md` | **yes** | Commands, environment, provider/host tables, and the SHA-256 digest of the report |
| `evidence/*` | no (git-ignored) | Machine-local raw engine-host snapshot and stderr |

The Evidence Manifest records the SHA-256 of the normalized report so the tracked artifacts are
self-verifying. Re-running regenerates all three; only the two `acceptance/` files are committed.
