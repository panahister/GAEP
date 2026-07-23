# SOURCE_MAP — AI-POLC

> Declares where AI-POLC's raw data lives and how AI-DFE extracts it. Paths relative to `pdlc-ws/`.

**Package:** AI-POLC — AI-Driven Product Ownership Life Cycle
**Schema:** `polc-data.schema.json` (this folder)
**Schema version:** 1.0.0
**Scope:** per-project

---

## Presence Check

| Check | Path | Meaning if absent |
|-------|------|-------------------|
| Marker exists | `projects/PRJ-{ABBREV}-{slug}/backlog/polc-state.md` | `status: not-run` → all payload fields `null` |

## Source Files

| # | Source path (relative to `pdlc-ws/`) | Holds |
|---|-------------------------------------------|-------|
| 1 | `projects/PRJ-{ABBREV}-{slug}/backlog/polc-state.md` | YAML front-matter + current state, context factors, backlog summary, DoR/DoD versions, optional `dashboard-summary` block |
| 2 | `projects/PRJ-{ABBREV}-{slug}/backlog/prioritization-register.md` | prioritized epics + scores |
| 3 | `projects/PRJ-{ABBREV}-{slug}/backlog/product-risk-register.md` | product risks |
| 4 | `projects/PRJ-{ABBREV}-{slug}/management_framework/Decision_Log.md` | POLC decisions (shared spine, prefix `POLC-{ABBREV}-*`) |
| 5 | `projects/PRJ-{ABBREV}-{slug}/backlog/product-vision.md` | product vision statement + goals (→ `po.vision`) |
| 6 | `projects/PRJ-{ABBREV}-{slug}/backlog/roadmap.md` | Now/Next/Later horizon table — "Epic Horizon Mapping" (→ `po.roadmap`) |
| 7 | `projects/PRJ-{ABBREV}-{slug}/backlog/release-plan.md` | release table (release → goal → epics → value) (→ `po.releases`) |
| 8 | `projects/PRJ-{ABBREV}-{slug}/backlog/stakeholder-map.md` | Stakeholder Register table (→ `po.stakeholders`) |
| 9 | `projects/PRJ-{ABBREV}-{slug}/backlog/definition-of-ready.md` · `…/definition-of-done.md` | existence + path (→ `po.backlog.dorReady/dodReady/dorPath/dodPath`) |
| 10 | `projects/PRJ-{ABBREV}-{slug}/backlog/epics/` | per-epic files — folder scan for `po.backlog.totalEpics` |

## Field Extraction

| Field path (in `data`) | Source (#) | Extraction rule |
|------------------------|------------|-----------------|
| `projectId` | 1 | Front-matter `projectId` |
| `productName` | 1 | Front-matter `project-name` |
| `status` | 1 | Front-matter `status` (in-progress/ready/operating) |
| `phase` | 1 | Current State → `Phase` (1-6) |
| `stage` | 1 | Current State → `Stage` (1-16) |
| `depth` | 1 | Current State → `Depth` |
| `mode` | 1 | Current State → `Mode` (standalone/chain) |
| `tier2Active` | 1 | Current State → `Tier 2` (active/inactive → boolean) |
| `activeExtensions[]` | 1 | Current State → `Active Extensions` list |
| `contextFactors` | 1 | Context Factors section → object of the 13 factors |
| `backlog.totalEpics` | 1 | Backlog Summary → `Total Epics` |
| `backlog.prioritized` | 1 | Backlog Summary → `Prioritized` |
| `backlog.inReleasePlan` | 1 | Backlog Summary → `In Release Plan` |
| `backlog.priorityModel` | 1 | Backlog Summary → `Current Priority Model` |
| `dorVersion` / `dodVersion` | 1 | DoR/DoD Version section |
| `pendingDecisions[]` | 1 | Pending Decisions list |
| `epics[]` | 2 | One object per prioritized epic: `{ id, name, score, priority, releaseTarget }` |
| `risks[]` | 3 | One object per risk row: `{ id, risk, probability, impact, score, mitigation, owner, status }` |
| `decisions[]` | 4 | Rows prefixed `POLC-{ABBREV}-D-*`: `{ id, date, summary, status }` |
| `po.vision.status` | 1, 5 | `dashboard-summary` block `vision.status` if present; else `approved` when `product-vision.md` exists and stage ≥ Strategy, else `draft` |
| `po.vision.statement` | 5 | First vision/goal statement line in `product-vision.md` (heading or "Vision:" line) |
| `po.roadmap.{now,next,later}[]` | 6 | Parse the Now/Next/Later horizon table → one `{ epic, stories, done, status, items[] }` per row, bucketed by horizon column. **Horizons come from the table — never inferred from which epic files exist** (ISS-012/015) |
| `po.releases[]` | 7 | Release table → one `{ name, date, status, stories, done, scope[] }` per release row |
| `po.backlog.totalEpics` | 10, 1 | Count of files in `backlog/epics/` (fallback: Backlog Summary `Total Epics`) |
| `po.backlog.totalStories` / `prioritised` / `inReleasePlan` | 2, 1 | From prioritization-register row count + Backlog Summary fields |
| `po.backlog.dorReady` / `dodReady` | 9 | `true` only if `definition-of-ready.md` / `definition-of-done.md` exist (ISS-016/017) |
| `po.backlog.dorPath` / `dodPath` | 9 | Workspace-root-relative path to each file when present, else `null` |
| `po.acceptance.totalCriteria` / `validated` | 1 | `dashboard-summary` block (else `0` until stories carry acceptance criteria) |
| `po.velocity.trend` | 1 | `dashboard-summary` block `velocity.trend` (`stable`\|`up`\|`down`); default `stable` |
| `po.stakeholders[]` | 8 | Stakeholder Register table → `{ name, engagement, influence }` (map `Power`→influence high/low; `Current Stance`→engagement champion/supportive/neutral/resistant) |

## Retention Policy

| Policy | Value |
|--------|-------|
| History retention | forever |

## Notes

- POLC is per-project scoped: one `polc-data.json` per project (keyed by `projectId`).
- Uses the shared `management_framework/` spine (sibling of `backlog/`); DFE attributes rows by `POLC-{ABBREV}-*` prefix.
- **Rich `po` pane (dashboard PO tab):** DFE extracts the **structured sub-sections** of the PBP artifacts — the roadmap horizon table, release table, stakeholder register table, DoR/DoD file existence, and the `epics/` folder scan. It does NOT parse free-form prose. For the few genuinely free-form facts (vision status/statement, velocity trend, acceptance counts), AI-POLC emits a small machine-readable **`dashboard-summary`** block in `polc-state.md` (Hybrid emit); DFE reads that block when present and falls back to safe defaults otherwise. (Supersedes the earlier "narrative docs not machine-extracted" stance — scoped to structured sub-sections per the Dashboard Data-Fidelity Plan.)
