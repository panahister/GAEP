# GAEP Evidence Manifest — GAEP-P0-CS02

**Change Set ID:** GAEP-P0-CS02
**Generated at:** 2026-07-26T07:10:11.750Z
**Source tree digest:** sha256:d060104c9490cff74b1a442843877c0d929047031dce74aa255dd860286f0617
**Base commit / dirty (provenance only):** 964dc8b5a126e6dd100cafa8603f937f3fb0d100 / true

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
- Context Pack: `69fa35b6-6f12-4ac3-8307-89db25018a52` (governed)
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

- `acceptance/GAEP-P0-CS02_ACCEPTANCE_REPORT.json`: sha256:c7575ae1acf52781a8d033b38c8c6df9090aa10404acdf1939afc5cb8f934bd3
- `dist/phase0/cs02/package-manifest.json`: sha256:e3996fff51af5cf3f403ba99d47c572d541d5f8ecddb07bc6576b2fded98aa58
- `dist/phase0/cs02/SHA256SUMS.txt`: sha256:8c1dadee2c549c5179d52a169eac4e6b6b16a01348bfe715c8e2a60da08ac36b

## Trust boundary

Digests establish integrity and consistency against the supplied artifacts; they do **not** establish cryptographic producer authenticity. Unavailable hosts/providers remain `not-run`/`pending-environment` and are never marked passed.

## Known gaps

- Visual Studio (`requires-windows-visual-studio`) and Rider (`requires-jdk21`) build via external lanes; not executed here.
- Kiro install/workflow require a Kiro installation.
- Codex analysis requires an available Codex runtime.
- A `completed` Claude analysis requires an authenticated Claude Code runtime; a classified `auth-unavailable` is a truthful environment blocker, never a pass.
