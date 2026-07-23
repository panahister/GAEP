# SCR-011 — Feeder Voyage Form

## Business purpose

Create or update a third-party feeder voyage using only the confirmed minimal header and multi-call arrival/departure schedule.

## Source references

- [Requirements FR-FDR-1a/2/3/4](../../Requirement/requirements.md)
- [User Stories US-FDR-1…4](../../User%20story/stories.md)

## Primary personas

Schedule Editor; Viewer read-only; Administrator inherits.

## Entry points

- Feeder Schedules create/open.
- Unified Voyage List feeder row.

## Exit points

- Save → SCR-010 or remain in detail.
- Linked main voyage → SCR-007.
- Cancel → SCR-010.

## Layout

Full page or wide form with compact header fields, optional Main Voyage link section (provisional), and an editable feeder port-call table. Save/Cancel in page header/bottom dirty bar. No Line Study/CPD tabs.

## Information hierarchy

1. CVN, Vessel Name, Operator.
2. Ordered port rotation and arrival/departure pairs.
3. Derived first departure/last arrival and link context.

## Components

Text Field, Organisation Selector, optional main-voyage selector, minimal editable Route Sequence, Port Selector, Time Pair, reorder controls, validation summary, dirty bar.

## Data fields

| Group | Fields | Notes |
|---|---|---|
| Header | CVN, Vessel Name (free text), Operator Organisation | CVN free-form/non-unique; vessel not validated to master |
| Link | Main Voyage Number (provisional) | Required behavior missing |
| Call | Position/order, Port, Arrival, Departure | Multiple calls; no Call Type, distance, speed, milestones |

## Actions

- **Primary:** Create feeder voyage / Save changes.
- **Secondary:** Add call, reorder, remove call, Cancel, View main voyage.

## Permissions

Viewer reads. Editor/Admin edit. No Simulation workflow required for feeder update according to current source; do not force feeder updates through Simulation.

## Filters

Not applicable.

## Sorting

Fixed call order; no table sorting.

## Search

Port selector by name/UN/LOCODE; Operator by organization name/code/type.

## Validation

Operator, Vessel Name, CVN, and at least two port calls are provisionally required based on meaningful multi-call rotation; exact minimum call count is not stated. Each row needs Port, Arrival, Departure. Enforce Arrival ≤ Departure at a call and chronological sequence between calls as a reasonable provisional rule. No master-data validation on Vessel Name.

## States

Create/edit/read-only, dirty/saving/saved, invalid row, linked/unlinked, local/UTC if confirmed.

## Empty state

New form starts with two blank call rows or one row + `Add port call`; the safer implementation decision remains open.

## Loading state

Header and 3 call-row skeleton; save localized.

## Error state

Field/row errors with summary; save failure retains data. Linking error does not lose schedule.

## Success feedback

`Feeder voyage FDR-2026-0042 created.` or `Feeder schedule updated.` Offer View in Voyage List/Monitor.

## Responsive behavior

Tablet uses call cards/full-height row editor. Narrow shows read-only or one call form at a time; full multi-row reorder prefers larger screen.

## Accessibility

Free-text nature explained in helper text; row order explicit; reorder buttons; arrival/departure labels include port; local/UTC labels consistent if used.

## Prototype interactions

- Add/reorder call.
- Save valid demo feeder → SCR-010 success.
- View alongside main voyage → SCR-002.

## Assumptions

- Link cardinality, minimum call count, chronology strictness, and dual local/UTC requirement need confirmation (GAP-022/023).
- Organisation code is provisional (GAP-020).

## Open questions

- Is a main-voyage link required at creation?
- What is the minimum number of calls?
- Must feeder times display/store local and UTC?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-FDR-1a | Minimal header and arrival/departure rotation | Confirmed |
| FR-FDR-3 | Operator from Organisation | Confirmed |
| DR-54 | Free-text Vessel Name, CVN | Confirmed |
| FR-FDR-2 | Link/alongside | Confirmed concept; UX Missing |

## Acceptance checklist

- [ ] No owned/partner milestone fields appear.
- [ ] Vessel Name is not a master selector.
- [ ] Multiple calls can be added and reordered accessibly.

