<!-- Copyright (c) 2026 Mohammad Maheri. Licensed under the Apache License, Version 2.0. See LICENSE. Attribution required - see NOTICE. -->
# PDLC Family Convention — Reference Linking (Clickable Code Cross-References)

> **Family-level convention — authored once, referenced by every PDLC package** (sibling to `session-continuity.md` and `content-validation.md`). Load at workflow start. Applies to every artifact a PDLC package writes into `pdlc-ws/`.

## Why this exists

A reader opens a `pdlc-ws/` file dense with codes — `IDEA-014`, `PRJ-CRM-2026-001`, `ADR-007`, a `projectId` — and cannot tell where any of them are defined. Cross-references are invisible: the code names the thing, but the reader has to hunt for its definition.

**The rule fixes that:** whenever a package writes a code that is *defined in another file it generated*, it writes the code as a **relative markdown link to that definition**. In preview mode the link renders as clean clickable text (the path is hidden) — click `ADR-007` and its defining file opens at that spot. The reference reads exactly as before; it is now navigable.

This is **AI-agnostic and renderer-agnostic** — plain markdown links and HTML anchors work in every markdown viewer and IDE (Kiro, VS Code, GitHub, Cursor, and all other platforms PDLC ships to). No platform-specific syntax.

## The rule

When you emit a code that is defined in another generated file, emit it as a relative link instead of bare text. There are two shapes, split by where the definition lives.

### Tier 1 — Object references (MANDATORY, zero-anchor)

If the code owns its own file or folder, link straight to that file — no anchor needed.

| Reference | Definition lives in | Emit as |
|-----------|---------------------|---------|
| `IDEA-{NNN}` | `pdlc-ws/ideas/{NNN}-{slug}/idea.md` | `[IDEA-014](../ideas/014-{slug}/idea.md)` |
| `PRJ-{ABBREV}-{YYYY}-{NNN}` | `pdlc-ws/projects/PRJ-{ABBREV}-{slug}/` | `[PRJ-CRM-2026-001](../projects/PRJ-CRM-portal/)` |
| `projectId` correlation key | the project root `pilc-state.md` or `adlc-state.md` | `[{projectId}](../projects/PRJ-{ABBREV}-{slug}/pip/pilc-state.md)` |
| Package state / handoff marker | `pdlc-ws/projects/*/pip/pilc-state.md`, `*/architecture/adlc-state.md`, etc. | link to the state file |
| A whole deliverable (PIP, Architecture Package, etc.) | its file under the project folder | `[{label}]({relative-path-to-file})` |

### Tier 2 — Register-row references (anchored)

If the code is a **row inside a shared register** (a table), emit an HTML anchor on the definition row and link references to `register.md#anchor`.

| Reference | Register (definition file) | Emit as |
|-----------|----------------------------|---------|
| `ADR-{NNN}` | `pdlc-ws/projects/*/architecture/decisions/ADR-{NNN}.md` | `[ADR-007](../architecture/decisions/ADR-007.md)` (own file — Tier 1) |
| `CR-{ID}` (change request) | change register in project | `[CR-CRM-2026-003](../management_framework/change-register.md#cr-crm-2026-003)` |
| `IDEA-{NNN}` in register row | `pdlc-ws/ideas/` register | `[IDEA-014](../ideas/014-{slug}/idea.md)` |
| `derivedFrom` / `aliasOf` provenance keys | upstream object's file | link to the upstream file (Tier 1) |

**Anchor emission (definition side).** When a package writes a shared register table, it emits a portable HTML anchor before each defined row:

```markdown
| ID | Item | … |
|----|------|---|
| <a id="cr-crm-2026-003"></a>CR-CRM-2026-003 | {description} | … |
```

- Use `<a id="…"></a>` — honored by every renderer. **Never** use `{#custom-id}`.
- The anchor id is the code lowercased, hyphens preserved.

## How the link is built (deterministic)

The generator always knows the file it is writing and the target's location (fixed by the `pdlc-ws/` layout in `OUTPUT_AND_STATE_CONTRACT.md`). The relative path is computed from those — never guessed.

## Safe degradation (never emit a broken link)

- **Unknown / not-yet-created target** — leave as **plain text**. Never emit a dead link.
- **Same-file reference** — stays plain text (or an in-file `#anchor` only where a long file benefits).
- **Aliased / merged codes** — link to the surviving definition (per `TRACEABILITY_CONTRACT.md`).
- **Provenance metadata** — `derivedFrom`, `projectId`, `originType` in YAML front-matter stay as plain YAML values (front-matter is not rendered markdown).

## Scope

- Applies to **new output** from this version forward.
- Existing `pdlc-ws/` files are retrofitted by `UPG__` — see `MIGRATION_CATALOGUE.md`. Re-running is safe (already-linked references are detected and left as-is).
- Templates stay 100% generic: link targets use `{placeholder}`/relative-path forms filled at generation time.

---

*PDLC family convention · Reference Linking · authored once, referenced by every package · Author: Maheri*
