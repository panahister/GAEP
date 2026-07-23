# SCR-007 — Voyage Detail

## Business purpose

Present one voyage's identity, lifecycle, rotation, planned/actual/projected timing, deviations, locks, and last-known position, while routing every schedule change through Simulation.

## Source references

- [Requirements FR-VOY-2/5; FR-SCH-1…8; FR-MON-1/5/6](../../Requirement/requirements.md)
- [User Stories US-VOY-2/5; US-SCH-1…6](../../User%20story/stories.md)

## Primary personas

Viewer for inspection; Simulation Analyst for scenario entry; Editor for report capture; Administrator for privileged unlock only inside Simulation.

## Entry points

- Voyage List, Schedule Monitor, Service Workspace, global search, notification, report result.

## Exit points

- Create/recover scenario → SCR-008.
- Capture report → SCR-009.
- Service Code → SCR-004.
- View in Monitor → SCR-002.

## Layout

Detail page header with Voyage Number, CVN, type/lifecycle, vessel, service, and actions. Summary grid beneath. Tabs: `Schedule`, `Overview`, optional `Activity` (provisional). Schedule tab contains single-voyage route/timeline plus authoritative port-call table. Selected call opens detail drawer. Static position card sits alongside current-call summary.

## Information hierarchy

1. Unique voyage identity and current lifecycle.
2. Current/next call and schedule health.
3. Ordered port rotation with planned/actual/projected and locks.
4. Vessel/service/cycle metadata.
5. Deviations and last-known position.

## Components

Page Header, summary definition list, lifecycle chip, route timeline, port-call table, Time Pair, baseline/actual/projected legend, lock/omitted indicators, Deviation panel, Static Position, detail drawer, Export Menu, provisional Activity timeline.

## Data fields

| Group | Fields | Notes |
|---|---|---|
| Identity | Voyage Number, CVN, Voyage Type, Lifecycle, Service/Line ID | CVN non-unique |
| Vessel | Name, IMO, Operator, operator type | Feeder details route elsewhere |
| Generation | Cycle, CPD, Rule ID or `Ad-hoc`; Start/End | Source-derived; not applicable as appropriate |
| Port Call | Position, Sequence, Port, Call Type, planned/actual/projected ETA/ETD/milestones, status, deviation, locked/omitted | Local + UTC |
| Position | Text status, coordinates, report timestamp | Static only |

## Actions

- **Primary:** Create scenario / Recover in Simulation when deviation and Simulation role.
- **Secondary:** Capture report (Editor), Export schedule, View in Monitor, open Service/Vessel.
- **Lifecycle transition:** show only if guards are confirmed; omit from main prototype because guards are missing.

## Permissions

All view. Simulation role gets scenario action. Editor gets Capture report. Administrator has no direct Unlock here; unlock happens inside a scenario.

## Filters

Within port-call table: `All | Exceptions | Open/Future | Locked`; optional layer toggle.

## Sorting

Port calls fixed by Position/Sequence; no arbitrary sort. Activity newest first if approved.

## Search

Find port within rotation by name/UN/LOCODE.

## Validation

No direct schedule field editing. Manual lifecycle transition is not designed until guard rules are confirmed. Export requires data.

## States

Planned/In-Progress/Completed; baseline-only; actuals present; projected deviation; locked previous/current; open next/future; omitted; ad-hoc; no position; edit-lock information.

## Empty state

No actuals: clear informational panel, not an empty page. No deviations: `No active deviations detected.` Missing rotation is an error because a voyage must have calls.

## Loading state

Header metadata and port rows skeleton; position panel independently loads.

## Error state

Rotation failure preserves identity and offers Retry. Static map failure preserves text. Stale/deleted voyage shows not-found with return to Voyage List.

## Success feedback

After report capture: `Departure actuals recorded. A delay of 11 h was detected.` After Apply: `Scenario S-03 applied; future schedule updated.`

## Responsive behavior

Laptop stacks position card below summary if needed. Tablet uses vertical rotation and expandable call cards. Narrow prioritizes identity/current-next/deviation; full milestone detail opens as full-screen sheet.

## Accessibility

Ordered call list/table; locked/omitted text; time pairs clearly labeled; timeline has table equivalent; drawer focus returns; Activity timestamps use UTC and semantic list.

## Prototype interactions

- Select Sohar call → drawer with baseline vs actual +11 h.
- Create recovery scenario → SCR-008.
- Capture report → SCR-009 with voyage preselected.
- View in Monitor → SCR-002 focused voyage.

## Assumptions

- Activity UI is provisional because audit visibility is missing (GAP-038).
- Lifecycle transitions omitted due missing guard rules (GAP-007).
- Static map freshness/provider provisional (GAP-037).

## Open questions

- Who can transition lifecycle and under what guards?
- Is Activity visible to Viewer or Administrator only?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| US-VOY-5 | Rotation/status/CVN/vessel/service/type | Confirmed |
| FR-SCH-1 | No direct schedule edit; Simulation action | Confirmed |
| FR-SCH-5 | Local + UTC times | Confirmed |
| FR-SCH-6 | Locked current/previous, next open | Confirmed |
| FR-MON-5/6 | Position and projected schedule | Confirmed |

## Acceptance checklist

- [ ] Voyage Number and CVN are distinct.
- [ ] Port order cannot be arbitrarily sorted.
- [ ] Schedule change only opens SCR-008.
- [ ] Projected state is visibly non-committed.

