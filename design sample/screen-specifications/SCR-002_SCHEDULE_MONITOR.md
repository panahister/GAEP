# SCR-002 — Schedule Monitor

## Business purpose

Provide the read-only operational landing experience: compare baseline with executable/actual timing, surface deviations at a glance, understand projected downstream impact, and enter a user-led recovery workflow.

## Source references

- [Requirements FR-MON-1…6, FR-FDR-2](../../Requirement/requirements.md)
- [User Stories US-MON-1…6, US-FDR-4](../../User%20story/stories.md)

## Primary personas

Schedule Viewer. Operations/Line Management commonly combines Viewer + Editor + Simulation and can use `Recover in Simulation`.

## Entry points

- Default module landing after sign-in.
- Global search/notification deep link with voyage highlighted.
- `View in Schedule Monitor` from Voyage Detail or Apply success.

## Exit points

- Voyage row/header → SCR-007.
- Deviation action → SCR-008 recovery scenario.
- `Capture report` for Editor → SCR-009.

## Layout

Within the full ERP shell: page header, compact filtered exception summary, horizontal filter bar, view toggle `Timeline | Table`, full-width Gantt, and a collapsible lower/right last-known-position/detail panel. A 520 px right drawer opens for selected call/deviation.

## Information hierarchy

1. Active filters/time range and operational exceptions.
2. Voyage/vessel identity and current state.
3. Baseline vs executable/actual vs projected timeline.
4. Direct variance and current/next call.
5. Last-known textual/static position and detail.

## Components

Page Header, Filter Bar, exception tiles, Schedule Gantt, legend, Now marker, variance badges, feeder-alongside toggle, port/deviation drawer, static position card, table alternative, loading skeleton, banner.

## Data fields

| Group | Fields | Notes |
|---|---|---|
| Row identity | Service Code, Voyage Number, CVN, Vessel, Voyage Type, Lifecycle | Voyage Number is unique; CVN secondary |
| Call timing | Port/UN/LOCODE, baseline ETA/ETD, actual/executable, projected, signed variance | Local and UTC in drawer/table |
| Health | On time, Early, Late, At risk; deviation type/magnitude | Text + color/icon |
| Position | `At port X` / `In transit to Y`, coordinates, observed time | Static, not live AIS |

## Actions

- **Primary:** Inspect selected deviation/call; for combined Simulation role, Recover in Simulation.
- **Secondary:** Filter, zoom, toggle Table, feeder alongside, open Voyage Detail, Capture report, export current view.
- **No edit:** The timeline is read-only.

## Permissions

All roles can view. `Recover in Simulation` appears only with Simulation role; `Capture report` requires Editor. No timeline editing for any role.

## Filters

Time range, Service, Vessel, Voyage Type, Lifecycle/health. Applied chips and `Clear all`; persist in URL/prototype state. Exception tiles apply a health/deviation filter.

## Sorting

Default by next operational event/time, with exception severity grouping. Table can sort by start, end, service, vessel, and variance.

## Search

Search Voyage Number, CVN, vessel/IMO, service. Duplicate CVN results show Voyage Number and dates.

## Validation

End date cannot precede start date; overly wide ranges may prompt a shorter range for timeline readability without changing data access.

## States

Baseline-only, no actual, on time, early, late, at risk, omission, unplanned call, projected active, feeder alongside, selected call, no last position.

## Empty state

First/date-range: `No voyages are scheduled in this range.` Filtered: `No voyages match these filters.` Provide Adjust range/Clear filters.

## Loading state

Keep filter controls usable; skeleton row labels and timeline blocks. Filtering shows a thin localized progress bar, not a blank canvas.

## Error state

Timeline failure preserves filters and offers Retry and Table view. Map failure preserves text/coordinates. Partial voyage-row errors are localized.

## Success feedback

After returning from Apply, show a compact banner: `Scenario S-03 applied. The executable schedule has been refreshed.` Highlight changed future blocks briefly.

## Responsive behavior

Laptop collapses advanced filters. Tablet uses sticky row labels, shorter default range, horizontal scroll, and near-full-width drawer. Narrow defaults to Table/card summary; timeline remains optional horizontally scrollable.

## Accessibility

Legend uses text/pattern; blocks are focusable with full labels; variance text is visible; Table view is equivalent; zoom controls are buttons; static map is supplementary; filter result changes announced.

## Prototype interactions

- Click `+11 h` at Sohar → deviation drawer.
- Click `Recover in Simulation` → SCR-008 S-03 Draft.
- Click row identity → SCR-007.
- Toggle feeder alongside → linked feeder row appears/disappears.
- Toggle Table → accessible tabular frame.

## Assumptions

- Monitor is the module landing instead of an unsupported dashboard (GAP-045).
- Notification behavior and static map provider/freshness are provisional (GAP-037, GAP-039).
- Exception sorting is inferred, not a confirmed priority algorithm.

## Open questions

- Is “At risk” derived from a threshold distinct from deviation thresholds?
- What time range and grouping should be default?
- What makes a last-known report stale?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-MON-1 | Read-only status and previous/current/upcoming calls | Confirmed |
| FR-MON-2/3 | Layered Gantt and direct variance badge | Confirmed |
| FR-MON-4 | Detail, zoom, filters, colors, Now marker | Confirmed |
| FR-MON-5 | Text + static pin | Confirmed; provider Missing |
| FR-MON-6 | Projected non-committed layer | Confirmed |
| FR-FDR-2 | Feeder alongside toggle | Confirmed; link rules Missing |

## Acceptance checklist

- [ ] Timeline and Table views communicate the same facts.
- [ ] Projected is labeled non-committed.
- [ ] No edit control appears in Monitor.
- [ ] Main demo path reaches SCR-008 and returns after Apply.

