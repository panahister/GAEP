<!-- Copyright (c) 2026 Mohammad Maheri. Licensed under the Apache License, Version 2.0. See LICENSE. Attribution required - see NOTICE. -->
# PDLC — Migration Catalogue (Artifact Feature Migrations)

> **What this is.** The list of *output-feature improvements* the family upgrade agent (`UPG__`) can retrofit into an existing `pdlc-ws/` workspace. When a PDLC package gains a new output feature, the feature is added here so workspaces created by an earlier version can be brought up to the current feature set without re-running the workflows.
>
> **Who reads it.** The `UPG__` family upgrade agent (`family-upgrade-agent.md`). Installed once per workspace (create-if-absent) by whichever PDLC package the user installs.
>
> **Design principle — detect by inspecting the artifact, not by trusting a version number.** Every migration carries a **Detection** check that inspects the actual `pdlc-ws/` files. A migration is "pending" only if detection finds artifacts lacking the feature. This makes every migration **idempotent** and independent of any manifest or version stamp.
>
> **AI-agnostic.** Every transform is expressed as plain markdown edits any assistant can perform on any platform.

---

## How the upgrade agent uses this file

For each **installed** package (detected by the presence of `.aiflc/pdlc/ai-{code}-rules/`), the agent:
1. Reads migrations whose **Applies to** includes that package.
2. Runs each migration's **Detection** against that package's `pdlc-ws/` artifacts.
3. Collects pending migrations (detection found artifacts lacking the feature) into a per-package list.
4. Presents the list and asks the user to **Apply** or **Skip** — per package.
5. For applied migrations: performs the **Transform**, honoring `ownership` (see table below).
6. Logs a governance entry and moves to the next package.

---

## Migration index

| ID | Feature | Applies to | Status |
|----|---------|-----------|:------:|
| **M1** | Clickable reference links | all 9 packages | Active |
| **M2** | Visual pairing (table + Mermaid diagram) | packages with framework tables (PILC, ADLC, POLC, PPM) | Active |

### Ownership handling (applies to every migration)

All transforms are **additive** — wrap existing code text in a link, add an anchor before a row, or insert a diagram after a table. Never rewrite or remove content.

| Ownership class | Migration behavior |
|-----------------|--------------------|
| tool-managed / `generated` | Apply directly |
| living / team-adopted / `hybrid` | Preview diff and confirm — additive edits preserve all custom content; `<!-- custom -->` regions untouched |
| user-locked / `user` | Skip and report |

---

## M1 — Clickable reference links

**Feature.** Codes defined in another generated file are written as relative markdown links (see `common/reference-linking.md`). In preview they render as clean clickable text; clicking opens the defining file.

**Applies to.** Every `pdlc-ws/` artifact that mentions a code defined elsewhere — project folders, idea register, management framework registers, architecture decisions.

**Detection (is it pending?).** Find **bare** code tokens (not already inside a `[…](…)` link) matching PDLC code patterns AND whose definition file exists:
- `IDEA-\d+` → `pdlc-ws/ideas/{NNN}-{slug}/idea.md`
- `PRJ-[A-Z]+-\d{4}-\d+` → `pdlc-ws/projects/PRJ-{ABBREV}-{slug}/`
- `ADR-\d+` → `pdlc-ws/projects/*/architecture/decisions/ADR-{NNN}.md`
- `CR-[A-Z]+-\d{4}-\d+` → change register
- If bare tokens with existing definition targets are found → **M1 is pending**.

**Transform.**
1. For each register this package owns, ensure every defined row carries a portable anchor (`<a id="code-id"></a>`). Add missing anchors; never duplicate.
2. Replace each detected bare code with a relative link to its definition, computing the relative path from the editing file to the target per `OUTPUT_AND_STATE_CONTRACT.md` layout.
3. Leave codes without a definition file as plain text; note in the run report.

**Idempotency.** Already-linked codes and existing anchors are detected and left untouched.

---

## M2 — Visual pairing (table + Mermaid diagram)

**Feature.** Framework artifacts pair their authoritative table with a Mermaid diagram beneath it. Table stays authoritative (machine-parseable); diagram is the human view. Diagram type: `flowchart` for hierarchy/sequence/process; `quadrantChart` for two-axis scored matrices.

**Applies to.** Framework artifacts with authoritative tables: PIP (PILC), Architecture Package / ADR log (ADLC), Backlog (POLC), Portfolio (PPM).

**Detection (is it pending?).** Find files with an authoritative table that have no accompanying ` ```mermaid ` block following it → **M2 is pending**.

**Transform.** Insert a `mermaid` fenced block immediately after the table, choosing the correct diagram type per the artifact. Populate nodes from table rows using existing labels/`{placeholder}`s. Obey `evidence-or-abstain` — no fabricated data.

**Idempotency.** Artifacts already having a paired Mermaid block are detected and skipped.

---

## Adding a future migration

1. Add a row to the **Migration index** and a full section (Feature · Applies to · Detection · Transform · Idempotency · Ownership handling).
2. Detection MUST inspect the artifact — never rely solely on a version number.
3. Transform MUST be idempotent and expressed as platform-neutral markdown edits.
4. No change to `UPG__` itself is needed — the agent reads this catalogue at run time.

---

*PDLC Migration Catalogue · read by the `UPG__` family upgrade agent · Author: Maheri*
