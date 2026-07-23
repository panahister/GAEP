# SCR-008 — Simulation Cockpit

## Business purpose

Provide the exclusive controlled workspace for modelling executable-schedule changes, comparing multiple Draft scenarios, understanding recalculated downstream impact, and applying one chosen scenario with role-aware locking and audit feedback.

## Source references

- [Requirements FR-SIM-1…13/15; FR-SCH-1…8; FR-LS-CT](../../Requirement/requirements.md)
- [User Stories US-SIM-1…14; US-SCH-1/4a/5/6](../../User%20story/stories.md)

## Primary personas

Simulation Analyst; Administrator for unlock and all lower actions. Editor alone cannot run/apply unless also assigned Simulation.

## Entry points

- Voyage Detail `Create scenario`.
- Monitor deviation `Recover in Simulation` scoped to open/future calls.
- Existing Draft scenario deep link.

## Exit points

- Apply success → SCR-007 or SCR-002.
- Cancel/close → originating Voyage/Monitor; Draft may remain.
- Missing distance → SCR-013 contextual resolution and return.

## Layout

At 1440: 260 px Scenario Rail; flexible central schedule table/timeline; 360 px Inspector/Change Summary. Top workspace bar retains Voyage Number/CVN, Draft status, edit-lock owner, scenario actions. A persistent blue banner states `Draft scenario — executable schedule is unchanged until Apply.` Comparison is an alternate central view within the same screen.

## Information hierarchy

1. Scenario state and live-data separation.
2. Voyage/edit-lock context and locked calls.
3. Current scenario rotation/timing and changed values.
4. Recomputed downstream schedule and blockers.
5. Change summary/compare and Apply consequence.

## Components

Scenario Rail, DRAFT/APPLIED/DISCARDED chips, live/baseline/scenario legend, editable Route Sequence, Gantt/timeline, Milestone Inspector, Change Summary, compare diff, Add/Omit/Unomit/Reposition, Phase In/Out dialog, chaining controls, cut-off editor, Back to Baseline, actuals/Actualize, lock banner, Apply/Discard confirmations.

## Data fields

| Group | Fields | Notes |
|---|---|---|
| Scenario | ID/name (name provisional), status, author/time, changed-call count | Applied/Discarded terminal |
| Voyage | Voyage Number, CVN, Vessel/IMO, Service, lifecycle | CVN editable in scenario |
| Call | Position, Sequence, Port, Call Type, Distance, ECA, Speed, Transit, milestones, actuals, lock/omitted/changed | Shared schema with Line Study |
| Phase | New Vessel Name/IMO, From Location, To Location, Milestone ID, CVN decision | From/To existing locations only |
| Cut-off | Name/type provisional, milestone, signed offset | Recomputes with milestone |

## Actions

- **Primary:** Apply scenario.
- **Secondary:** Create/compare/discard scenario, Back to baseline, Add/Omit/Unomit/Reposition, edit milestones/distance/speed/CVN, phase in/out, chaining, cut-offs, maintain actuals/actualize.
- **Privileged:** Unlock locked call (Admin only).

## Permissions

Simulation role can model/compare/apply but cannot unlock. Administrator can unlock. Without Simulation, screen is inaccessible or read-only scenario summary depending future decision. Editor role alone uses schedule data elsewhere.

## Filters

Within sequence: All, Changed, Exceptions, Open/Future, Locked. Compare selector chooses 2–3 Draft scenarios.

## Sorting

Sequence order is fixed. Scenario rail defaults Draft by updated time, then terminal history.

## Search

Find port/UN/LOCODE within scenario; no global data sort.

## Validation

Only Draft is editable/applicable. Edit lock required. Locked calls uneditable until Admin unlock. From/To locations from current voyage; phase-in vessel cannot be deployed elsewhere. Added/repositioned legs require approved distance. Call type/location and milestone chronology match Line Study. Actualize requires populated actual fields. Omit keeps row visible and Sequence recomputes; Position stable. Apply blocks on unresolved validation and states exact affected live scope.

## States

No Draft, Draft clean/changed/recalculating/blocked, multiple Draft compare, recovery scope, edit lock unavailable, locked call, admin-unlocked, Applied terminal, Discarded terminal, stale baseline, apply pending/success/failure.

## Empty state

`No Draft scenarios. Create a scenario to model changes without affecting the executable voyage.` Compare empty: create/select at least two Drafts.

## Loading state

Acquire-lock progress; scenario skeleton. During recalculation, keep last stable schedule visible, disable affected edits, show progress strip, then mark changes.

## Error state

Lock error names owner and Retry; no Take over action. Apply failure states live schedule unchanged and preserves Draft. Missing distance provides exact pair/resolution. Recompute error marks affected rows.

## Success feedback

Apply: scenario becomes Applied, controls read-only, message names Voyage and changed calls, links to Detail/Monitor. Unlock/actualize show specific audited outcomes.

## Responsive behavior

Laptop collapses Inspector to drawer. Tablet selects one scenario at a time, uses stacked diff, and full-height call editor. Narrow is view-first; comparison and multi-row editing require larger screen.

## Accessibility

Draft banner first in reading order; scenario list keyboard-operable; reorder not drag-only; changed cells have text/indicator; timeline has table/diff alternative; confirmations announce impact; recompute completion announced politely.

## Prototype interactions

- Monitor recovery link opens S-03 scoped to future calls.
- Omit Aqaba → muted row, preserved Position, renumber, recalculation/change summary.
- Compare S-02/S-03 → factual diff frame.
- Apply → confirmation → Applied terminal → SCR-002 refreshed.
- Non-admin locked call → explanation; Admin variant unlocks after confirmation.

## Assumptions

- Scenario naming, comparison criteria, lock timeout/takeover, unlock reason, cut-off taxonomy, chaining bounds, and phase-in inheritance are unresolved (GAP-013–016, 034–036).
- Manual distance approval and milestone chronology details remain gaps (GAP-017/033).

## Open questions

- Can Apply affect chained voyages or only the active voyage?
- What is lock expiry/release and stale-baseline behavior?
- Which actual fields are required and who may actualize?
- Can scenarios be named/noted?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-SIM-1/2 | Draft isolation and multiple comparison | Confirmed |
| FR-SIM-3…10 | Phase, chain, CVN, port ops, baseline, milestones, cut-offs | Confirmed; detail gaps |
| FR-SIM-11/12 | Recompute/change summary/Apply terminal | Confirmed |
| FR-SIM-13 | Admin-only unlock | Confirmed |
| FR-SIM-15 | Deviation recovery scope | Confirmed |
| FR-SCH-7/8 | Pessimistic lock/missing distance | Confirmed; lock mechanics Missing |

## Acceptance checklist

- [ ] Draft/live distinction is always visible.
- [ ] Every supported modelling action is represented.
- [ ] Applied/Discarded are terminal.
- [ ] Apply failure never implies live data changed.

