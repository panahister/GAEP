# SCR-010 — Feeder Schedules

## Business purpose

Find, inspect, and enter the lightweight management flow for third-party feeder voyages without adding line-study, cycle-plan, cost, agreement, or milestone complexity.

## Source references

- [Requirements FR-FDR-1…4](../../Requirement/requirements.md)
- [User Stories US-FDR-1…5](../../User%20story/stories.md)

## Primary personas

Viewer for read-only list; Editor for create/update; Administrator inherits.

## Entry points

- Sidebar `Feeder Schedules`.
- Unified Voyage List filtered to Feeder.
- Main voyage linked-feeder section.

## Exit points

- Create/open → SCR-011.
- Linked main Voyage → SCR-007.
- `View alongside` → SCR-002 focused and toggle on.

## Layout

Page header with `Create feeder voyage`, search/filter bar, compact table, pagination, export if supported through voyage export. Optional link-state column and contextual actions.

## Information hierarchy

1. Feeder CVN and free-text Vessel Name.
2. Operator, first/last port, start/end derived from departure/arrival.
3. Port-call count and main-voyage link.
4. Last updated.

## Components

Data Table, Module Search, Operator/Date/Link filters, feeder type chip, link indicator, Pagination, empty/loading/error, action menu.

## Data fields

Feeder Voyage ID/Voyage Number if generated, CVN, free-text Vessel Name, Operator, first-port departure, last-port arrival, number of port calls, First Port, Last Port, linked main Voyage Number (provisional), last updated.

## Actions

- **Primary:** Create feeder voyage.
- **Secondary:** Open/view, Edit (Editor), view main voyage, view alongside, export.
- **No actions:** line study, CPD, costs, reconciliation, lifecycle transition.

## Permissions

Viewer opens read-only. Editor/Admin create/update. Unified-list feeder rows remain read-mostly and route here/form.

## Filters

Operator, date range, first/last/any Port, linked/unlinked (assumed), Vessel Name.

## Sorting

Default first-port departure descending/upcoming. Support CVN, Vessel Name, Operator, Start/End.

## Search

CVN, free-text Vessel Name, Operator, Voyage Number, Port.

## Validation

Filter dates only. Form rules belong to SCR-011.

## States

Linked/unlinked (assumed), upcoming/past, recently updated. No fabricated lifecycle.

## Empty state

`No feeder voyages have been created.` Editor sees Create; Viewer does not. Filter mismatch offers Clear filters.

## Loading state

Stable table skeleton and preserved filters.

## Error state

Localized list error with Retry; link action error preserves row.

## Success feedback

After form save: `Feeder voyage FDR-2026-0042 created.` Highlight row and offer `View alongside main voyage` if linked.

## Responsive behavior

Laptop concise columns. Tablet expandable rows. Narrow cards show CVN/vessel, operator, first→last, date, link.

## Accessibility

Free-text Vessel Name is not announced as a master-data link; N/A lifecycle absent; row action labels include feeder ID/CVN; link state is text.

## Prototype interactions

- Create → SCR-011 create.
- Open `FDR-2026-0042` → SCR-011 read/edit.
- View alongside → SCR-002 feeder toggle state.

## Assumptions

- Linked/unlinked list filter and one-main-voyage display depend on GAP-022.
- Feeder lifecycle intentionally absent (GAP-024).

## Open questions

- What identifier does the system generate for feeder voyages?
- What are feeder-to-main link cardinality and validity rules?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-FDR-1 | Create/update entry and list | Confirmed |
| FR-FDR-2 | Main link/alongside path | Confirmed behavior; link UX Missing |
| FR-FDR-3/4 | Operator reference; no commercial/cost data | Confirmed |

## Acceptance checklist

- [ ] No line study, CPD, cost, freight, or reconciliation appears.
- [ ] Vessel Name is clearly free text.
- [ ] Feeder rows route to SCR-011.

