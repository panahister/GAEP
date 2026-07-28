# GAEP Evidence Manifest — GAEP-P0-CS02

**Change Set ID:** GAEP-P0-CS02
**Generated at:** 2026-07-28T06:59:05.237Z
**Source tree digest:** sha256:26497eef92b7c2d4f2c55f3e10ed459482bf2f41be7ed609b9c98d184a278890
**Base commit / dirty (provenance only):** 8c051e5098685def721e7d88baf17f8a180cbabc / true

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
- Context Pack: `623cd626-8740-42bd-9bce-718c93a2c93b` (governed)
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

- `acceptance/GAEP-P0-CS02_ACCEPTANCE_REPORT.json`: sha256:b563edf01fefd47a5b5d652d77d283fbd9c9aabb5174e7e3f445b39d02ac87bb
- `dist/phase0/cs02/package-manifest.json`: sha256:5f553517d42677ad96940101ae8cccc4116d5a63275a82c01219822df9fbf71d
- `dist/phase0/cs02/SHA256SUMS.txt`: sha256:945cb3a9a8982b1ca288d7e635d25c5c896a3167c6284e4c2a81aee4a7b92c17

## Trust boundary

Digests establish integrity and consistency against the supplied artifacts; they do **not** establish cryptographic producer authenticity. Unavailable hosts/providers remain `not-run`/`pending-environment` and are never marked passed.

## Known gaps

- Visual Studio (`requires-windows-visual-studio`) and Rider (`requires-jdk21`) build via external lanes; not executed here.
- Kiro install/workflow require a Kiro installation.
- Codex analysis requires an available Codex runtime.
- A `completed` Claude analysis requires an authenticated Claude Code runtime; a classified `auth-unavailable` is a truthful environment blocker, never a pass.
