# SCR-006 — Voyage List

## Business purpose

Provide one authoritative, filterable list for owned, partner, and 3rd-party feeder voyages while preserving their data differences and enabling detail/export access.

## Source references

- [Requirements FR-VOY-1, 2, 6, 7; FR-EXP](../../Requirement/requirements.md)
- [User Stories US-VOY-1/2, US-FDR-5, US-EXP-1/3](../../User%20story/stories.md)

## Primary personas

Schedule Viewer. Editor/Admin may access contextual management links; feeder editing remains in SCR-011.

## Entry points

- Sidebar `Voyages`.
- Service Workspace `View all voyages` with Service filter.
- Global search and generation success.

## Exit points

- Owned/partner row → SCR-007.
- Feeder row → SCR-011 read/edit depending permission.
- Export remains on page after download.

## Layout

Page header with total/result count and export. Inline search plus common filters, Advanced Filters drawer, customizable data table with pinned Voyage Number and row action, pagination.

## Information hierarchy

1. Voyage Number and CVN.
2. Voyage Type, Service/Line, Vessel, Operator.
3. Start/End, first/last port, port count.
4. Cycle/CPD/Rule and Voyage Lifecycle when applicable.

## Components

Data Table, Filter Bar, Advanced Filter Panel, Module Search, Voyage Type/Lifecycle Chips, local/UTC Time Pair in detail/expanded row, Column Customizer, Pagination, Export Menu, no-result state.

## Data fields

The source specifies 14 columns: Voyage Number; Line ID; Vessel Name; CVN; Vessel Operator; Start Date & Time; End Date & Time; Cycle; Cycle Plan; Rule ID; Number of Port Calls; First Port; Last Port; Voyage Lifecycle. Add Voyage Type as a visible classification/filter control, even if displayed as a chip adjacent to Voyage Number. For feeder rows, Line ID, Cycle, Cycle Plan, Rule ID, and Lifecycle are `Not applicable`/em dash—not zero or unknown.

## Actions

- **Primary:** Open voyage.
- **Secondary:** Filter/search, customize columns/density, export, open Service/Vessel detail.
- **Feeder Editor:** `Edit feeder voyage` routes to SCR-011; no inline owned/partner schedule edit.

## Permissions

All roles view/export. Editor/Admin can reach feeder edit and service/voyage management where supported. Schedule change action is never in list; it starts from detail/monitor and requires Simulation.

## Filters

Voyage Type, Service/Line, Vessel, Lifecycle, Start/End range, Cycle, first/last/any Port. Applied chips persist across detail/back.

## Sorting

Default Start descending/upcoming-first depending selected range. Support Voyage Number, Service, Vessel, Start, End, Lifecycle. CVN sort allowed but not treated unique.

## Search

Voyage Number, CVN, Vessel/IMO, Service Code, Port/UN/LOCODE. Duplicate CVN matches display date/service/voyage number.

## Validation

Filter date range validity. Export warns when no rows. No row-edit validation.

## States

Owned, partner, feeder; Planned, In-Progress, Completed; upcoming/past; duplicate CVN results; N/A feeder fields; selected/filter states.

## Empty state

First use: `No voyages have been created.` Viewer gets no creation action. Filtered: Clear filters. From Service context, link back to generation if Editor.

## Loading state

Keep table header/column widths stable; skeleton 8 rows. Sorting/filtering shows localized progress.

## Error state

Table load error with Retry; export error identifies format and leaves list intact.

## Success feedback

After generation deep link, banner: `12 voyages generated for service AEX.` Highlight newly created rows. Export: `Preparing Excel download…` then completion.

## Responsive behavior

Laptop default columns: Voyage Number/CVN, Type, Service, Vessel, Start, Lifecycle. Tablet expandable rows. Narrow cards include identity, vessel, type, start/end, first→last, lifecycle/health.

## Accessibility

Table caption and sort state, row links include both identifiers, N/A explicitly announced, column customizer keyboard-reorderable, export menu labeled with current filtered result count.

## Prototype interactions

- Search `AEX-071W` → two results to demonstrate duplicate-safe disambiguation.
- Open VOY-2026-0148 → SCR-007.
- Filter Feeder → feeder-only rows; edit → SCR-011.
- Customize columns → all 14 source fields.

## Assumptions

- Default column set and upcoming-first treatment are UX inferences.
- Export uses current filtered scope unless confirmed otherwise (GAP-041).

## Open questions

- Should `Voyage Type` be a 15th explicit column or embedded identity chip?
- Which list order is default: start descending or nearest operational event?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-VOY-6 | Unified list/type filter/read-mostly feeder | Confirmed |
| FR-VOY-7 | 14 fields and derived Start/End rules | Confirmed |
| FR-VOY-2 | Lifecycle values | Confirmed |
| FR-EXP | Export menu | Confirmed; default scope Assumed |

## Acceptance checklist

- [ ] Feeder N/A fields are not populated with invented values.
- [ ] Duplicate CVNs are disambiguated by Voyage Number.
- [ ] All 14 source fields are available.
- [ ] No direct schedule edit exists.

