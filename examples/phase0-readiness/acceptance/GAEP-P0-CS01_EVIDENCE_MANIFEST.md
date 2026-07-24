# GAEP Evidence Manifest — GAEP-P0-CS01

**Change Set ID:** GAEP-P0-CS01
**Generated at:** 2026-07-24T08:56:53.296Z
**Engine version:** 0.1.0

## Commands

- `npm run build`
- `npm run example:phase0`

## Environment

- OS/arch: darwin/arm64
- Node: v26.5.0
- Codex present: no
- Claude Code present: yes

## Tracked normalized report

- Path: `acceptance/GAEP-P0-CS01_READINESS_REPORT.json`
- Truth class: report is composed only from provider probes, workspace health, and executed observations
- **SHA-256:** `sha256:158853a9e822ccd9b86dafe5f691aa0ae42b4a4f302e01c55611515ecf5d5b3a`

## Engine-host boundary result (not an IDE host row)

- `engine-host.platformReadiness.v2` → target `engine-host-rpc` → **passed**

## Provider readiness

| Adapter | Detected | Truth class |
|---|---|---|
| `gaep.codex-cli` | not-detected | `not-observed` |
| `gaep.claude-code-cli` | detected | `observed` |

## Four-IDE Host Matrix

| Host | State | Source |
|---|---|---|
| `vscode` | `passed` | executed observation |
| `visual-studio` | `pending-environment` | base-default (not executed) |
| `rider` | `pending-environment` | base-default (not executed) |
| `kiro` | `pending-environment` | base-default (not executed) |

## VS Code evidence (current attempt)

- verified VS Code observation (state=passed)
- Bundle path: `acceptance/vscode-e2e/` (produced by `npm run evidence:vscode`)

## Known gaps

- Visual Studio, Rider, and Kiro are not executed in this change set (no observations); rows stay at `pending-environment`.

## Raw (machine-local, git-ignored)

- `evidence/engine-host-base-snapshot.json`
- `evidence/engine-host.stderr.log`
