# GAEP Evidence Manifest — GAEP-P0-CS02

**Change Set ID:** GAEP-P0-CS02
**Generated at:** 2026-07-26T11:31:48.990Z
**Source tree digest:** sha256:d42db791994d9e388570fe10f1f0e250ca6fe7e21aca75c994be4c3e96185861
**Base commit / dirty (provenance only):** a4b3381e8027a97e2ffbb380a7c96d47202c7276 / true

## Commands

- `npm run build`
- `npm run release:cs02 -- --verify`
- `npm run example:cs02 -- --verify`

## Environment (observed)

- OS/arch: darwin/arm64; Node: v26.5.0
- Codex present: yes
- Claude Code present: yes (2.1.218)

## Read-only analysis (protocol v3 RPC)

- Provider/model: gaep.claude-code-cli / sonnet
- Context Pack: `765b0a6c-c4b7-4027-8adf-5dad9dc9adf5` (governed)
- Terminal state: **failed** (auth-unavailable)
- Persisted: selection=yes, run=yes, pre-run evidence=yes, result evidence=no
- Product source mutated: **no**; unauthorized `.gaep` write: **none**
- Result digest: n/a

## Provider / model truth

- `gaep.codex-cli`: detected; auth=auth-unverified; models=gpt-5.6-sol[observed], gpt-5.6-terra[observed], gpt-5.6-luna[observed], gpt-5.5[observed], gpt-5.2[observed]; analysis=not-run
- `gaep.claude-code-cli`: detected; auth=auth-unverified; models=sonnet[provider-declared,alias], opus[provider-declared,alias]; analysis=failed

## Host packages (truthful)

- vscode: build=built, install=not-run, workflow=not-run
- kiro: build=built, install=not-run, workflow=not-run
- visual-studio: build=not-built, install=pending-environment, workflow=pending-environment
- rider: build=not-built, install=pending-environment, workflow=pending-environment

## Hashed artifacts (this manifest does NOT hash itself)

- `acceptance/GAEP-P0-CS02_ACCEPTANCE_REPORT.json`: sha256:c165a9ed68b826971b4e65b38c13807d2c14b251a80c79724f1ebe4e515fc3b7
- `dist/phase0/cs02/package-manifest.json`: sha256:fa13f1daa0904dfce9d6e80142d2ddca012f8c4d71e5224f89271c662fbc1797
- `dist/phase0/cs02/SHA256SUMS.txt`: sha256:7c72a5a2854e4be2e2d89906c6ee6bd4ab83de24acf618e1889fb34cb521ed1c

## Trust boundary

Digests establish integrity and consistency against the supplied artifacts; they do **not** establish cryptographic producer authenticity. Unavailable hosts/providers remain `not-run`/`pending-environment` and are never marked passed.

## Known gaps

- Visual Studio (`requires-windows-visual-studio`) and Rider (`requires-jdk21`) build via external lanes; not executed here.
- Kiro install/workflow require a Kiro installation.
- Codex analysis requires an available Codex runtime.
- A `completed` Claude analysis requires an authenticated Claude Code runtime; a classified `auth-unavailable` is a truthful environment blocker, never a pass.
