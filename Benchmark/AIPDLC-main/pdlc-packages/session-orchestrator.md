---
inclusion: always
---
<!-- Copyright (c) 2026 Mohammad Maheri. Licensed under Apache 2.0. See LICENSE. Attribution required - see NOTICE. -->
# AIFLC Session Orchestrator — AI-* PDLC Family

> **This is the ONLY always-loaded steering file for the AI-* PDLC Family.** All package cores live in the uniform home `.aiflc/pdlc/` (OI-158) and are **not** auto-loaded — this orchestrator `Read`s the relevant core on demand when a package is activated. This keeps the context window free for actual work.

---

## Purpose

Prevent context overload. Instead of loading all package workflows into every session, this orchestrator:
1. Detects what the user wants to do
2. `Read`s ONLY the relevant package core from `.aiflc/pdlc/` (and its rule-details on demand)
3. Provides the activation keys as a routing table

---

## Activation Keys (Quick Reference)

> **Full trigger registry (all package keys + all agent shortcuts):**
> `Read` `.aiflc/pdlc/TRIGGER_KEYS_REFERENCE.md`

| Key | Package | When to Use |
|-----|---------|-------------|
| `_ILC_` | AI-ILC | New idea capture, evaluation, go/no-go |
| `_PILC_` | AI-PILC | Project initiation from requirements |
| `_PPM_` | AI-PPM | Portfolio management, cross-project governance |
| `_FLO_` | AI-FLO | Flow routing, entity position tracking |
| `_POLC_` | AI-POLC | Product backlog, product ownership |
| `_UXD_` | AI-UXD | UX design, personas, journeys, design system |
| `_ADLC_` | AI-ADLC | Architecture / system design |
| `_DWG_` | AI-DWG | Development workspace generation |
| `_GCE_` | AI-GCE | Compliance / enforcement governance |
| `_TGE_` | AI-TGE | Test governance, coverage analysis |
| `_DFE_` | AI-DFE | Data fabric (gather/shape/distribute) |
| `_ACTIVE_` | (read-only) | Report which package is currently active |
| `DAT__` | AI-DFE | Data operations (gather, status, discover) |
| `DFA__` | AI-DFE | Data fabric audit (read-only report) |
| `DHC__` | AI-DFE | Data fabric bootstrap readiness check |
| `FHC__` | AI-FLO | FLO health check — "is this workspace FLO-ready?" |
| `FIA__` | AI-FLO | FLO integrity audit — "is FLO's state correct?" |

---

## Session Detection Logic

When the user starts a session WITHOUT an explicit activation key, determine intent from their message:

> All cores live under the uniform home `.aiflc/pdlc/`. When you route to a package, `Read` its core file first, then its rule-details folder (`.aiflc/pdlc/ai-<pkg>-rule-details/`) on demand.

| User Intent Signal | Route To (`Read`) |
|-------------------|-------------------|
| "I have an idea" / "new idea" / "evaluate this" | `.aiflc/pdlc/ai-ilc-rules/core-workflow.md` |
| "initiate project" / "start project" / "PIP" | `.aiflc/pdlc/ai-pilc-rules/core-workflow.md` |
| "portfolio" / "cross-project" / "prioritize projects" | `.aiflc/pdlc/ai-ppm-rules/core-engine.md` |
| "route" / "flow" / "handoff" / "where is entity" | `.aiflc/pdlc/ai-flo-rules/core-engine.md` |
| "backlog" / "epics" / "product ownership" / "prioritize" | `.aiflc/pdlc/ai-polc-rules/core-workflow.md` |
| "UX" / "personas" / "journeys" / "design system" / "user experience" | `.aiflc/pdlc/ai-uxd-rules/core-workflow.md` |
| "architecture" / "system design" / "containers" / "C4" | `.aiflc/pdlc/ai-adlc-rules/core-workflow.md` |
| "workspace" / "generate workspace" / "steering files" | `.aiflc/pdlc/ai-dwg-rules/core-generator.md` |
| "compliance" / "hooks" / "enforcement" / "rules derivation" | `.aiflc/pdlc/ai-gce-rules/core-engine.md` |
| "test governance" / "test strategy" / "coverage" | `.aiflc/pdlc/ai-tge-rules/core-engine.md` |
| "data" / "gather" / "DAT__" / "DFA__" / "freshness" | `.aiflc/pdlc/ai-dfe-rules/core-engine.md` |
| "FHC__" / "FLO health" / "is workspace ready for FLO" | `.aiflc/pdlc/ai-flo-rules/core-engine.md` → run FLO Health Check agent |
| "FIA__" / "FLO integrity" / "routing state" | `.aiflc/pdlc/ai-flo-rules/core-engine.md` → run Flow Integrity agent |
| "resume" / "continue" / "where was I" | Check `*-state.md` files for in-progress package → `Read` that one's core from `.aiflc/pdlc/` |
| Ambiguous / general question | Ask: "Which AI-* package are you working with?" and list the keys |

---

## Resume Detection

When user says "resume" or "continue" without specifying a package:

1. Scan for any `*-state.md` with status ≠ "complete":
   - `{family}-ws/ideas/ilc-state.md` → check if an idea is in-progress
   - `{family}-ws/projects/*/pip/pilc-state.md` → check if PIP is in-progress
   - `{family}-ws/projects/*/backlog/polc-state.md` → check status field
   - `{family}-ws/projects/*/architecture/adlc-state.md` → check status
   - `{family}-ws/projects/*/ux/uxd-state.md` → check status
   - `{family}-ws/portfolio/ppm-state.md` → check status
2. If exactly ONE package is in-progress → `Read` that package's core from `.aiflc/pdlc/` and resume.
3. If MULTIPLE packages are in-progress → present the list, ask user which to resume.
4. If NONE in-progress → ask what they want to do.

---

## Multi-Package Isolation (Enforced)

- Only ONE package steering file is active at a time.
- A package switch NEVER happens without a direct user order or explicit confirmation.
- When switching, announce: "Active package: AI-{XXX}" as the first line.
- The `_ACTIVE_` key reports the current active package without switching.

---

<!-- BEGIN WORKFLOW-DISCIPLINE v1 (synced from WORKFLOW_DISCIPLINE_CONTRACT.md — do not edit inline) -->
## Workflow Discipline (Enforced)

These rules bind whenever any AI-* package is active. An AI assistant's default
habit — being helpful by generating from memory — silently breaks a structured
methodology. Discipline over improvisation.

1. **Read before you execute.** Never produce a package's outputs from training or
   memory. When a package activates, `Read`/`Load` its core first, then load the
   relevant rule-detail file before executing any stage. If you have not read it,
   say so and read it — do not reconstruct it.
2. **Trace every output to a source.** Each element you produce traces to a package
   file, a package template, or the user's own input — never to unstated "industry
   best practice." When you assert something the package governs, name where it
   comes from.
3. **No unilateral deviation.** Do not skip, reorder, combine, or auto-progress past
   a gate on your own initiative. The USER may direct any of these — when they do,
   confirm it and log it. Every gate needs explicit user approval before you proceed.
4. **One package at a time.** See "Multi-Package Isolation (Enforced)" above.
5. **Self-check for drift.** If you are about to say "based on my knowledge…",
   "I'll optimise this by combining…", or "I don't need to read the package…" —
   STOP, and read the file or ask the user instead.
6. **Deviation is an exception, not a shortcut.** If a deviation seems warranted,
   propose it, get explicit user approval, log it in the governance spine, then
   resume the prescribed workflow.
<!-- END WORKFLOW-DISCIPLINE -->

---

## State Awareness (Lightweight)

> **PLACEHOLDER — populated per workspace.** A static source cannot know per-workspace package status. A future Workspace Initiator (or a manual update) fills this in from the actual `*-state.md` files. Leave as-is in the package source.

- **Active project:** {populated per workspace}
- **Packages complete:** {populated per workspace}
- **Package in-progress:** {populated per workspace}
- **Packages not started:** {populated per workspace}

> Update this section when a package transitions. This gives the orchestrator lightweight awareness without loading full state files.

---

## Governance Spine — Lessons Capture (`LRN__`)

`LRN__` is a **family-wide** trigger recognized in any session, independent of the active package. When the user types `LRN__` (optionally followed by the lesson text), or at a natural session end, capture a lesson into the active project's governance spine `{family}-ws/projects/PRJ-{ABBREV}-{slug}/management_framework/Lessons_Learned.md`. `Read` `common/lessons-capture.md` from the active package under `.aiflc/pdlc/` for the full procedure: resolve-or-create the spine → draft the entry → assign `{PHASE}-{ABBREV}-L-{N}` → append (report-and-confirm; never edits another phase's rows). See `.aiflc/pdlc/MANAGEMENT_FRAMEWORK_CONTRACT.md`.

---

## What This File Does NOT Do

- Does NOT contain any package workflow logic (that stays in each package's core under `.aiflc/pdlc/`).
- Does NOT make routing decisions for the family (that is AI-FLO's job).
- Does NOT auto-activate packages based on state changes.
- Does NOT replace the activation key system — it supplements it with intent detection.

---

*Session Orchestrator v1.0.0 | AI-* PDLC Family | Author: Maheri*
