# PDLC-UPG-01 — Family Upgrade Agent (`UPG__`)

> **Family-level agent** (Type: Migration). Installed once per workspace — **create-if-absent** — by whichever PDLC package the user installs. Applies new output-feature improvements to an EXISTING `pdlc-ws/` workspace so a workspace built by an earlier version reaches the current feature set, without re-running the workflows. Report-and-confirm: previews every change and asks per package before writing.

## Purpose

When PDLC packages gain new **output features** (clickable reference links, visual table+diagram pairing, and future improvements), workspaces created earlier don't have them. `UPG__` walks the installed packages, finds which improvements are missing from the existing artifacts, and retrofits them with the user's per-package confirmation. It reads the family `MIGRATION_CATALOGUE.md` for the list of improvements — the agent itself never hardcodes a transform.

**AI-agnostic:** all detection and edits are plain markdown operations any assistant can perform on any platform (Kiro, VS Code, Cursor, Codex, Copilot, …). The trigger is recognized via the session orchestrator, not a platform-specific runtime.

## When to Invoke

- After upgrading one or more PDLC packages to a newer version.
- Any time the user wants their existing `pdlc-ws/` artifacts brought up to the current feature set.
- On demand via `UPG__`. Safe to run repeatedly — it is idempotent (already-applied improvements are detected and skipped).

## How It Works

1. **Detect installed packages.** Scan `.aiflc/pdlc/ai-*-rules/` — each present core means that package is installed. (Optionally read any package version stamp as an ordering hint only.)
2. **Load the catalogue.** Read `.aiflc/pdlc/MIGRATION_CATALOGUE.md` — the list of migrations, each with a Detection check and a Transform.
3. **Compute pending improvements per package.** For each installed package, run every applicable migration's **Detection** against that package's owned `pdlc-ws/` artifacts. A migration is *pending* only if detection finds artifacts lacking the feature. Detection — not a version number — is the source of truth.
4. **Report.** Show a summary:
   - packages installed,
   - packages already current (nothing pending → skipped),
   - packages with pending improvements (which improvements, how many files affected).
5. **Confirm per package.** For each package with pending work, ask: *"AI-{XXX} has {N} improvement(s) available ({feature list}). Apply / Skip?"* The user decides one package at a time.
6. **Apply (confirmed packages only).** Perform each migration's **Transform** on that package's artifacts. All transforms are additive (wrap text, add an anchor, add a diagram). Honor each artifact's `ownership` field:
   - tool-managed (regenerated) → apply directly,
   - living / team-adopted (e.g. `ownership: business-architecture`) → preview the diff and confirm (additive edits preserve all custom content; `<!-- custom -->` regions are never touched),
   - user-locked / read-only → skip and report.
   Preview the full change set before writing.
7. **Record.** Log a governance entry (what was applied, per package, file count) to `.governance/` (or the workspace governance log). Leave skipped packages untouched so they resurface on the next `UPG__`.

## Checks / Guarantees

1. **Domain-scoped** — each package's artifacts are migrated only within that package's own `pdlc-ws/` territory; the agent never edits another package's files or the DFE store schemas.
2. **Idempotent** — re-running finds nothing to do on an already-upgraded workspace.
3. **Never breaks a reference** — M1 leaves a code as plain text if its definition file is absent (reported, not linked).
4. **Evidence-or-abstain preserved** — M2 diagrams reflect only what the source table asserts; no fabricated positioning.
5. **Non-destructive** — additive edits only (wrap text, add anchors, add diagrams); existing content and custom-marked regions are preserved.

## Consequences (if skipped)

No governance debt — this is an enhancement pass, not a compliance gate. Skipping simply means existing artifacts keep the older presentation (bare codes, tables without diagrams). New output from the upgraded packages already carries the features; `UPG__` only retrofits the backlog of older files.

## Recovery

Nothing to recover — safe to run anytime. If a preview looks wrong, decline it; no change is written without confirmation. Re-run after resolving any reported "definition file absent" gaps to complete the link retrofit.

## Output

A per-package report: pending improvements found, files changed (or previewed), files skipped by ownership, and any codes left unlinked (definition absent). Written to the workspace governance log; never mutates package machinery.

## Related

- Catalogue of improvements: `MIGRATION_CATALOGUE.md` (family root, installed to `.aiflc/pdlc/`).
- Feature conventions: `common/reference-linking.md` (M1), `FAMILY_STRUCTURE.md` §6 Visual elements (M2).
- Agent anatomy: `AGENT_GOVERNANCE_CONTRACT.md` §4.
- Report-only quality audits (separate concern): the per-package `XXX__` quality agents.
