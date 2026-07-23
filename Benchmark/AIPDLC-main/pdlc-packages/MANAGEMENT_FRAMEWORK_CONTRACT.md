# Management Framework — Shared Cross-Family Governance Contract (Canonical)

**Version:** 2.0.0
**Date:** 2026-07-11
**Author:** Maheri
**Authored under:** `#persona-process-designer` (lead) + `#persona-compliance-governance` (support)
**Status:** CANONICAL — this is the single source of truth for the AIFLC governance spine across **all** families. Each family carries a verbatim copy at its family root (`1.dev/{family}/MANAGEMENT_FRAMEWORK_CONTRACT.md`), propagated by the sync script (never hand-copied). Mirrors the GATE_PROTOCOL propagation model.

> **Lineage.** Generalized from the PDLC-local contract v1.3.0 (project-scoped). v2.0.0 makes the contract **scope-agnostic** so every family — product (PDLC), enterprise-architecture (BALC, DALC, …), and strategy (SFLC, SXLC) — carries one uniform governance spine. See `ai-packagebuilder/sessions-open-items/02-in-progress/management-framework-uniformity/MANAGEMENT_FRAMEWORK_UNIFORMITY_DESIGN.md` for the design record.

---

## 1. Purpose

The `management_framework/` is a **governance spine** — the auditable trail of decisions, changes, issues, actions, assumptions, and lessons captured as work moves through a family's package chain.

Every family carries one, so a reader always finds governance in the same place under the same names. The spine is **not a package**: no package owns or orchestrates the others. It is a shared artifact each package *contributes to* — append-only, non-destructive — without coupling packages or breaking standalone use.

Cross-scope governance (managing *many* projects/entities, or governing the package set) is out of scope here — that is portfolio-engine (e.g. AI-PPM) and runtime-compliance (e.g. AI-GCE) territory.

---

## 2. Scope Model (v2.0.0 — the generalization)

The spine is anchored to a **scope** — the unit of work a family governs. The scope key is one of:

| Scope key | Families | Scope unit | `entityId` source |
|-----------|----------|-----------|-------------------|
| `project` | PDLC | one project | `PRJ-{ABBREV}-{slug}` |
| `enterprise-entity` | BALC, DALC, AALC, TALC | one enterprise / legal entity | `architectureId` / `entityId` |
| `strategy-cycle` | SFLC, SXLC | one strategy formulation/execution cycle | strategy `entityId` |

Every `*-state.md` marker already carries an `entityId` (GATE_PROTOCOL §6), so the scope anchor always exists — no new state field is required.

### 2.1 Spine location — keyed to scope topology (R1/R2/R3)

Location resolves against the family's existing **scope topology** (declared once at the family's chain head, inherited downstream):

| Topology | Spine location |
|----------|----------------|
| **R1** (single entity/project) | `{family}-ws/management_framework/` — one spine at the family workspace root |
| **R2 / R3** (group routes, multiple entities) | `{family}-ws/entities/{entityId}/management_framework/` — one spine per entity |
| **PDLC (project scope)** | `pdlc-ws/projects/PRJ-{ABBREV}-{slug}/management_framework/` — one spine per project (the project *is* the entity) |

The rule is uniform: **one spine per scope instance**, placed as a sibling of that scope's role folders. WHERE within those bounds is still user-overridable — detection is always by marker, never a hardcoded path.

---

## 3. Detection by Marker

| Element | Value |
|---|---|
| **Folder** | `management_framework/` (located per §2.1) |
| **Marker file** | `MANAGEMENT_FRAMEWORK.md` (the spine index/README — its presence means "a spine exists here") |
| **Detection strategy** | Resolve the scope root (§2.1) → scan (`./management_framework/`, scope root, predecessor output folder) → ask the user if ambiguous |

```
Shared management framework marker: management_framework/MANAGEMENT_FRAMEWORK.md
```

---

## 4. Contribution Behavior — Append-if-Exists, Create-if-Absent

```
1. Detect the spine (by marker — §3), scoped per §2.1.
2. IF a spine exists (MANAGEMENT_FRAMEWORK.md found):
      → APPEND this package's entries to the existing registers.
      → Use this package's scope-qualified ID prefix ({PKG}-{SCOPE}-{TYPE}-{N}) so IDs never collide — across packages OR across scope instances.
      → Register the package in the index's "Contributing Packages" table.
3. IF no spine exists:
      → CREATE management_framework/ with the marker + this package's registers.
      → The package operates exactly as it does standalone.
```

Append is **additive and non-destructive**. A package NEVER edits or deletes another package's rows.

---

## 5. Register Set (uniform across all families)

Six registers. All six are available to every family; a family/package only creates the register files it actually writes to.

| Register | File | ID type |
|---|---|---|
| Decision Log | `Decision_Log.md` | `{PKG}-{SCOPE}-D-{N}` |
| Change Log | `Change_Log.md` | `{PKG}-{SCOPE}-C-{N}` |
| Issue Log | `Issue_Log.md` | `{PKG}-{SCOPE}-I-{N}` |
| **Lessons Learned** | `Lessons_Learned.md` | `{PKG}-{SCOPE}-L-{N}` |
| Action Items | `Action_Items.md` | `{PKG}-{SCOPE}-A-{N}` |
| Assumptions & Dependencies | `Assumptions_Dependencies.md` | `{PKG}-{SCOPE}-AD-{N}` |

> **ID format:** `{PKG}-{SCOPE}-{TYPE}-{N}` — `{PKG}` is the contributing package code (e.g. `PILC`, `ADLC`, `BAG`, `DGV`, `SAG`, `SPR`); `{SCOPE}` is the scope handle (project `{ABBREV}`, or `{entityId}`); `{TYPE}` ∈ {D,C,I,L,A,AD}; `{N}` sequential per §8. Legacy PDLC single-project IDs (`{PHASE}-{TYPE}-{NNN}`) remain valid — never renumber.

### 5.1 Two adoption modes (per §9 matrix)

A family conforms to this contract in one of two ways per register:

- **Adopt** — the family instantiates the register file directly and its packages append rows. (Default for families without a native equivalent.)
- **Link** — the family already maintains a native authoritative artifact for that concern (e.g. an architecture-debt register, a Phase-H change review). The native artifact stays the **single source of truth**; the spine register is a **linked view/index** that forward-links to the native store, and the native store back-links to the spine index. **No row duplication, no dual-write.**

The Lessons Learned register is **always Adopt** (no family has a native equivalent — it is the universal add).

---

## 6. Register Schemas

Every register carries a **Contributor** column (the `{PKG}` that wrote the row).

### Decision_Log.md
```markdown
| ID | Contributor | Date | Decision | Context | Options Considered | Chosen | Rationale | Made By |
|----|-------------|------|----------|---------|--------------------|--------|-----------|---------|
```

### Change_Log.md
```markdown
| ID | Contributor | Date | Change | Reason | Impact | Approved By |
|----|-------------|------|--------|--------|--------|-------------|
```

### Issue_Log.md
```markdown
| ID | Contributor | Date | Issue | Severity | Area | Status | Resolution | Resolved |
|----|-------------|------|-------|:--------:|------|:------:|-----------|----------|
```

### Lessons_Learned.md
```markdown
| ID | Contributor | Date | Lesson | Context | Recommended Action | Status |
|----|-------------|------|--------|---------|--------------------|--------|
```

### Action_Items.md
```markdown
| ID | Contributor | Date | Action | Owner | Due | Status |
|----|-------------|------|--------|-------|-----|--------|
```

### Assumptions_Dependencies.md
```markdown
| ID | Contributor | Date | Assumption / Dependency | Type | Impact if Invalid | Status |
|----|-------------|------|-------------------------|------|-------------------|--------|
```

---

## 7. The Index File (Marker)

`MANAGEMENT_FRAMEWORK.md` is both the marker and the human entry point.

```markdown
<!-- AIFLC governance spine | contract v2.0.0 | family: {family} | scope: {scope-key} -->

# Management Framework

Consolidated governance spine for this {scope}. Each package of the {family} chain
appends its decisions, changes, issues, actions, assumptions, and lessons here.

## Registers
| Register | Purpose | Mode |
|----------|---------|------|
| Decision_Log.md | Decisions below formal-artifact threshold | adopt / link |
| Change_Log.md | Scope / approach / timeline changes | adopt / link |
| Issue_Log.md | Blockers and problems | adopt / link |
| Lessons_Learned.md | Insights to carry forward | adopt |
| Action_Items.md | Tracked follow-ups | adopt / link |
| Assumptions_Dependencies.md | Assumptions & dependencies | adopt / link |

## Linked Native Instruments (link-mode registers)
| Spine register | Native source of truth | Location |
|----------------|------------------------|----------|
| {e.g. Issue_Log} | {e.g. architecture-debt register} | {native path} |

## Contributing Packages
| Package | First Contributed | Registers Touched |
|---------|-------------------|-------------------|

## Conventions
- Entry IDs are scope-qualified: {PKG}-{SCOPE}-{TYPE}-{N}.
- Entries are append-only — never edit or delete another package's rows.
- Link-mode registers point to the native store; do not duplicate rows.
```

---

## 8. ID Assignment Protocol (Numbering)

```
1. READ the target register file.
2. SCAN all rows matching this package+scope+type prefix ({PKG}-{SCOPE}-{TYPE}-*).
3. FIND the highest {N} for that prefix.
4. ASSIGN {N} = highest + 1 (or 1 if none).
5. WRITE the new entry.
```

- Never hardcode a start; always scan for the current max.
- Never reuse removed IDs (non-destructive).
- Each `{PKG}-{SCOPE}-{TYPE}` group has an independent counter.
- **Concurrency:** single-user/single-agent model — scan-and-increment is race-free. Parallel-writer locking is explicitly deferred.
- **Carry-forward:** where a spine is carried into a downstream workspace, numbering continues from the highest existing `{N}` — never resets.

---

## 9. Lessons Capture Mechanism (universal)

The Lessons Learned register is populated by two mechanisms, present in every family:

1. **On-demand trigger — `LRN__`** (log a lesson learned). A destination-workspace trigger recognized in any package; appends a lesson entry to the active scope's `Lessons_Learned.md` (creating the spine if absent, per §4). Report-and-confirm; writes only on user assent. Registered in each family's `TRIGGER_KEYS_REFERENCE.md` (Rule 19).
2. **Session-end offer.** A common behavior (`common/lessons-capture.md`, referenced by every package core) that, at a natural session-close or gate point, offers: *"Capture any lessons from this session into the governance spine?"* Report-and-confirm.

> **Forward hook (deferred).** `Lessons_Learned.md` is the intended input corpus for a future per-family **decision engine** (the family's governance package reading captured lessons to inform gates/decisions). This contract reserves the linkage; the engine is not built here.

---

## 10. Per-Family Conformance Matrix

`✅ adopt` = instantiate register · `🔗 link` = cross-reference native source of truth · `— ` = n/a.

| Register | PDLC | BALC | DALC | SFLC | SXLC |
|----------|:----:|:----:|:----:|:----:|:----:|
| Decision Log | ✅ | 🔗 ARB/governance decisions (AI-BAG) | 🔗 governance decisions (AI-DGV) | ✅ (guardrails/statement → adopt) | ✅ |
| Change Log | ✅ | 🔗 ADM Phase-H delta review | 🔗 Phase-H delta review (AI-DRA) | 🔗 SES re-formulation | 🔗 SPR review loop |
| Issue Log | ✅ | 🔗 architecture-debt register | 🔗 architecture-debt register | ✅ | ✅ |
| Action Items | ✅ | 🔗 debt remediation items | 🔗 debt remediation items | ✅ | ✅ |
| Assumptions & Deps | ✅ | 🔗 `evidence-or-abstain` `[ASSUMPTION]` roll-up | 🔗 same | 🔗 same | 🔗 same |
| **Lessons Learned** | ✅ | ✅ (new) | ✅ (new) | ✅ (new) | ✅ (new) |

> **AALC & TALC (EA-track Waves 3–4)** follow the **same link/adopt pattern as BALC/DALC**: Decision Log 🔗 ADR register / governance decisions · Change Log 🔗 ADM Phase-H delta review · Issue Log & Action Items 🔗 architecture-debt register (TALC also migration-risk) · Assumptions & Deps 🔗 `evidence-or-abstain` `[ASSUMPTION]` roll-up · **Lessons Learned ✅ adopt**.

**Contributing packages per family** (packages that append to the spine):

- **PDLC:** ILC, PILC, ADLC, POLC, UXD, DWG (required producers) + GCE, TGE (contributors). PPM/FLO excluded (cross-scope / routing).
- **BALC:** BAV, BCM, VSM, OMD, BAG (governance package is primary spine writer). FLO/DFE excluded (fabric).
- **DALC:** DAD, DGV, DMO, DPL, MDM, DPS, DRA (AI-DGV + AI-DRA primary). FLO/DFE excluded.
- **SFLC:** SES, SDA, SVM, SCP, SAG (AI-SAG primary). FLO/DFE excluded.
- **SXLC:** SXI, OKR, BSC, SIP, SPR (AI-SPR primary). FLO/DFE excluded.
- **AALC:** AAD, APM, INT, AMD, AOA, AAG (AI-AAG primary spine writer). FLO/DFE excluded (fabric).
- **TALC:** TAD, CIS, RES, SEC, PEM, TGF, ERM (AI-ERM with AI-TGF primary). FLO/DFE excluded (fabric).

---

## 11. Standalone vs. Chain Behavior

| Mode | Behavior |
|------|----------|
| **Standalone** | No spine exists → package creates `management_framework/` with its own registers. Self-contained (honors  intent). |
| **Chain** | Spine exists → package appends its entries and registers itself in the index. One consolidated record per scope. |
| **Brownfield** | Non-conforming spine present → add marker + Contributor column non-destructively; do not renumber existing entries. |
| **Group routes (R2/R3)** | One spine per entity under `{family}-ws/entities/{entityId}/` — IDs carry the `{entityId}` so entities never collide. |

---

## 12. Boundaries (What This Contract Does NOT Do)

1. **Not a package.** No orchestration — a shared artifact contract only.
2. **Does not replace family-native formal artifacts.** ADRs, architecture-debt registers, requirements registers, guardrails, performance reviews remain authoritative; link-mode registers point at them (§5.1).
3. **Does not enforce compliance.** Runtime governance remains the compliance engine's job.
4. **Not cross-scope governance.** Managing many projects/entities is the portfolio engine's job.
5. **Does not hardcode location.** WHERE the spine lives is user-overridable within the §2.1 bounds.

---

## 13. Propagation

- **Canonical:** this file (`ai-packagebuilder/governance/MANAGEMENT_FRAMEWORK_CONTRACT.md`).
- **Per-family copy:** `1.dev/{family}/MANAGEMENT_FRAMEWORK_CONTRACT.md` (verbatim), written by `sync-governance-contract-to-families.ps1` and refreshed at `DEV__ promote`. Never hand-copied.
- **PDLC note:** the historical `1.dev/pdlc/contracts/MANAGEMENT_FRAMEWORK_CONTRACT.md` becomes a pointer stub to the root copy.

---

*Contract Version: 2.0.0 | Canonical shared cross-family governance spine | Generalized from PDLC v1.3.0 | Authored under #persona-process-designer + #persona-compliance-governance*
