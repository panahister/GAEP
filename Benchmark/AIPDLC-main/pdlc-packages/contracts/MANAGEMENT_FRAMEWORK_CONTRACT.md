# Management Framework — PDLC Supplement (pointer)

**Version:** 2.0.0-pdlc
**Date:** 2026-07-11
**Status:** POINTER + PDLC-specific supplement.

> **The canonical contract now lives at the family root:** `../MANAGEMENT_FRAMEWORK_CONTRACT.md` (propagated verbatim from the shared canonical `ai-packagebuilder/governance/MANAGEMENT_FRAMEWORK_CONTRACT.md`, v2.0.0). All shared behavior — scope model, detection-by-marker, contribution behavior, register set, ID protocol, lessons capture (`LRN__`), boundaries — is defined there and is uniform across every AIFLC family.
>
> This file remains only to (a) preserve existing relative links that point at `contracts/MANAGEMENT_FRAMEWORK_CONTRACT.md`, and (b) hold the **PDLC-specific elaborations** below that do not apply to other families.

---

## PDLC-Specific Elaborations

These extend — never contradict — the root canonical contract for the PDLC (product/project) family.

### P1. Project scope & phase-code map

PDLC's scope key is `project` (§2 of the canonical). The scope handle is the project abbrev from `PRJ-{ABBREV}-{slug}`; entry IDs are `{PHASE}-{ABBREV}-{TYPE}-{N}`. Contributing phases:

| Phase | Package | Contribution |
|-------|---------|--------------|
| `ILC`  | AI-ILC  | Contributor — idea-stage decisions seed the spine |
| `PILC` | AI-PILC | Required producer — full 6-register PMO governance |
| `ADLC` | AI-ADLC | Required producer — architecture governance (ADRs remain separate) |
| `POLC` | AI-POLC | Required producer — product-ownership governance |
| `UXD`  | AI-UXD  | Required producer — UX-design governance |
| `DWG`  | AI-DWG  | Required producer — workspace-generation governance |
| `GCE`  | AI-GCE  | Contributor — compliance-governance decisions (`.governance/` stays authoritative) |
| `TGE`  | AI-TGE  | Contributor — test-governance decisions (`.tge/` stays authoritative) |

Excluded (structural, per canonical §12): `PPM` (portfolio scope) and `FLO` (routing).

### P2. Spine location (project layout)

`pdlc-ws/projects/PRJ-{ABBREV}-{slug}/management_framework/` — one spine per project, sibling of the project's role folders. See `OUTPUT_AND_STATE_CONTRACT.md`.

### P3. Carry-forward at the AI-DWG hinge

When AI-DWG generates a project's dev workspace, the per-project spine is **carried forward** into `{slug}-workspace/management_framework/`. Dev-workspace phases (DWG/GCE/TGE) append there because that workspace is opened on its own. Numbering continues per the canonical §8 (never resets).

### P4. Dashboards hub

`management_framework/dashboards/` is governed by the sibling `DASHBOARD_FRAMEWORK_CONTRACT.md` (v1.1.0). Per-project dashboards live inside the per-project spine; portfolio dashboards live at `pdlc-ws/portfolio/`. The governance registers themselves remain scoped per the canonical §5.

---

*PDLC supplement to the canonical shared governance contract. For all shared behavior see `../MANAGEMENT_FRAMEWORK_CONTRACT.md`.*
