<!-- Copyright (c) 2026 Mohammad Maheri. Licensed under Apache 2.0. See LICENSE. Attribution required - see NOTICE. -->
# Idea Register

**Purpose:** Portfolio funnel view — every idea submitted to this pipeline, regardless of outcome.
**Created:** {date}
**Last Updated:** {date}

---

## Active Ideas

| ID | Name | Folder | Status | Score | Decision | Route | Created | Last Updated |
|----|------|--------|--------|:-----:|----------|-------|---------|--------------|
| — | *No active ideas* | — | — | — | — | — | — | — |

---

## Parked Ideas

| ID | Name | Folder | Parked Reason | Score | Revisit Date |
|----|------|--------|---------------|:-----:|--------------|
| — | *None* | — | — | — | — |

---

## Rejected Ideas

| ID | Name | Folder | Rejection Reason | Score | Date |
|----|------|--------|-----------------|:-----:|------|
| — | *None* | — | — | — | — |

---

## Routed Ideas (Completed)

| ID | Name | Folder | Route | Score | Brief Produced | Destination | Date |
|----|------|--------|-------|:-----:|---------------|-------------|------|
| — | *None* | — | — | — | — | — | — |

---

## Idea Scoring Matrix (visual)

> The idea funnel at a glance — value (y) against effort (x). The funnel tables above stay authoritative (DFE-extracted for the portfolio dashboard); this diagram is the human view. Plot each evaluated idea by value and effort (or swap the axes for desirability × feasibility) to see fast-track, park, and reject zones.

```mermaid
quadrantChart
    title Idea Value / Effort
    x-axis Low Effort --> High Effort
    y-axis Low Value --> High Value
    quadrant-1 Strategic bets — shape &amp; scope
    quadrant-2 Quick wins — fast-track
    quadrant-3 Low priority — park
    quadrant-4 Reconsider — likely reject
    "{Idea 1}": [0.25, 0.85]
    "{Idea 2}": [0.80, 0.80]
    "{Idea 3}": [0.30, 0.25]
    "{Idea 4}": [0.85, 0.30]
```

---

## Status Definitions

| Status | Meaning |
|--------|---------|
| **Captured** | Raw idea logged; not yet shaped |
| **Shaped** | Structured problem/solution statement confirmed |
| **Evaluated** | Scored against criteria; decision pending |
| **Scoped** | Boundaries and effort estimate agreed |
| **Approved** | Go decision made; routing pending |
| **Routed** | Brief produced and handed to successor (terminal) |
| **Parked** | Valid idea, not pursuing now; revisit date set |
| **Rejected** | Evaluated and determined not to proceed (terminal) |

---

## Numbering Convention

Ideas are numbered sequentially: `1`, `2`, `3`...
Numbers are never reused, even for rejected ideas.

Each idea's per-idea subfolder is keyed by the **zero-padded** form of this ID: `001-{idea-slug}/`, `002-{idea-slug}/`, … The folder name is **stable** — it never changes when the idea is parked, rejected, or routed (status is tracked here in the Register and in each artifact's `Status` field, not in the folder name).

---

*Template Version: 1.0.0 | AI-ILC — AI-Driven Idea Life Cycle*
