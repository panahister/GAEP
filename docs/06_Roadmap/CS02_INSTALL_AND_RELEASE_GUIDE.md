# GAEP-P0-CS02 — Install and Release Guide

Single Product Owner entry point for the first installable four-IDE provider/model read-only slice.

## Build the release

```bash
npm ci
npm run build
npm run release:cs02          # dist/phase0/cs02/ artifacts, package-manifest.json, SHA256SUMS.txt
npm run example:cs02          # acceptance report + evidence manifest
```

`release:cs02` builds the platform-neutral Engine Host bundle, the VS Code VSIX (with the bundled
runtime embedded), and the Kiro package. Visual Studio (`win32-x64`) and Rider (`linux-x64`) are
built by the external lanes (`.github/workflows/cs02-visual-studio.yml`, `cs02-rider.yml`) and are
recorded `not-built`/`pending-environment` in `package-manifest.json` until those lanes run.

## Artifacts (version 0.2.0)

| Host | Artifact | Build here? |
|---|---|---|
| VS Code | `dist/phase0/cs02/gaep-vscode-0.2.0.vsix` | yes |
| Kiro | `dist/phase0/cs02/gaep-kiro-0.2.0.vsix` | yes |
| Visual Studio | `dist/phase0/cs02/Gaep.VisualStudio-0.2.0.vsix` | Windows lane only |
| Rider | `dist/phase0/cs02/gaep-rider-0.2.0.zip` | JDK 21 lane only |

## Engine Host bootstrap

Every host launches only the Engine Host runtime bundled inside its own installed artifact, after
verifying its SHA-256 against `engine-host.sha256`. Production packages never resolve `gaep-engine`
from `PATH`. A development override is honored only when `GAEP_DEV_ENGINE=1`.

## Provider prerequisites and model truth

- Install and authenticate Codex and/or Claude Code separately. GAEP never reads credentials.
- Detection does not imply authentication (`auth-unverified` until an explicit read-only attempt).
- Codex models are `observed` only from an executed catalog; Claude `sonnet`/`opus` are
  `provider-declared` aliases; a custom identifier is `configured`. Absent providers stay `not-run`.

## Per host: install, use, upgrade, uninstall, rollback

- **VS Code:** `code --install-extension dist/phase0/cs02/gaep-vscode-0.2.0.vsix`. Run
  `GAEP: Show Platform Readiness`, initialize the example Product, then `GAEP: Select Provider` →
  `GAEP: Select Model` → `GAEP: Run Read-Only Analysis` → `GAEP: Show Agent and Model Dashboard`.
  Upgrade by installing 0.2.0 over 0.1.0. Uninstall: `code --uninstall-extension gaep.gaep-vscode`.
  Rollback = uninstall; `.gaep` run/evidence/audit records are retained and the host row returns to `not-run`.
- **Kiro:** install `gaep-kiro-0.2.0.vsix` from disk in Kiro; run the same commands. VS Code success
  is not Kiro evidence — install and workflow must be executed in Kiro.
- **Visual Studio:** install `Gaep.VisualStudio-0.2.0.vsix` via VSIXInstaller on Windows; open the
  GAEP tool window. Uninstall via Extensions Manager.
- **Rider:** Settings → Plugins → Install Plugin from Disk → `gaep-rider-0.2.0.zip`; open the GAEP
  tool window. Uninstall via the Plugins list.

## Uninitialized Product

Product actions on a workspace without `.gaep/manifest.json` show a friendly "Initialize Product
first" state. Platform Readiness remains available and read-only before initialization. Raw ENOENT
errors, stack traces, and absolute paths are never shown.

## Execution limitations (CS02)

Read-only analysis only. Provider processes cannot change Product source files; only governed
`.gaep/{runtime/selection.json,runs,evidence,audit}` and Context Pack records may change. No
preview/apply, effectful tools, Figma, or code generation. Codex runs in a read-only sandbox and
can read workspace files beyond the declared Context Pack (recorded as a limitation); Claude runs
tool-free from an empty temporary directory.

## Evidence and truth

`package-manifest.json` + `SHA256SUMS.txt` and the acceptance report/evidence manifest establish
integrity/consistency against the produced artifacts — not cryptographic producer authenticity.
Unavailable hosts/providers remain `not-run`/`pending-environment` and are never marked passed.
