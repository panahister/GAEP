# SCR-013 — Port Distance Table

## Business purpose

Maintain the authoritative one-record-per-port-pair distance table, fetch external proposals, approve/reject them, provide manual fallback, and unblock transit-time calculations from Line Study or Simulation.

## Source references

- [Requirements FR-DIST-1…5d; FR-SCH-8](../../Requirement/requirements.md)
- [User Stories US-DIST-1…5; US-SCH-6](../../User%20story/stories.md)

## Primary personas

Editor for manual maintenance/fetch; Administrator for approve/reject; Viewer read-only.

## Entry points

- Reference Data → Port Distances.
- Contextual missing-distance link from SCR-005/008/004 with pair prefilled.

## Exit points

- Return to invoking screen after usable distance.
- Remain on table after maintenance.

## Layout

Page header with `Add distance`; search/filter bar; editable data table; proposal comparison drawer. When opened contextually, a top banner states `Required for AEJEA → SAJED` and offers Return after resolution.

## Information hierarchy

1. From/To pair and usable approval state.
2. Distance/ECA/Unit/Distance Type.
3. Source and proposal/current comparison.
4. Fetch/approval history metadata.

## Components

Editable Table, Port Selector, unit/number fields, Distance Type selector, Source/Status chips, Fetch action, Proposal drawer, approve/reject confirmation, API error banner with manual fallback, contextual return banner.

## Data fields

MVP visible: Location From, Location To, Distance, Unit, ECA Distance, Distance Type, Source, Approval Status (required by workflow). Deferred fields Vessel Capacity From/To and Valid From/To must not appear in the operational UI. Distance Types: Great Circle, Rhumb Line, Navigable, Seasonal. Unit defaults NM; ECA same unit.

## Actions

- **Primary:** Add/Save manual distance.
- **Secondary:** Fetch from external service, edit, open proposal/current comparison, Retry.
- **Privileged:** Approve or Reject proposed distance; self-approval allowed.

## Permissions

Viewer reads. Editor adds/edits/fetches but cannot approve/reject. Administrator all. Context returns only after a distance is usable.

## Filters

From/To Location, Source API/Manual, Approval Status, Distance Type. Quick filter `Needs approval` for Admin.

## Sorting

Default Location From then Location To. Support Status, Source, Updated.

## Search

Location names and UN/LOCODE for either side.

## Validation

From and To required and cannot be identical (reasonable). At most one record per ordered pair. Distance >0; ECA ≥0 and provisionally ≤ Distance; Unit NM for calculations; Distance Type required. Proposed API value cannot be used until Approved. Manual approval behavior is unresolved.

## States

Manual, API Proposed, API Approved, Rejected/history, API timeout, existing approved + pending proposal (provisional), contextual missing pair, saving/approving.

## Empty state

`No port distances match these filters.` First use offers Add and Fetch when pair selected.

## Loading state

Table skeleton; fetch shows progress only in the pair row/drawer; approval action locks proposal controls.

## Error state

`Port Distance service did not respond. Enter the distance manually in this panel or try again.` Duplicate pair directs to existing row. Save/approval failure preserves proposal/current value.

## Success feedback

`Distance AEJEA → SAJED approved and available for calculation.` Contextual `Return to Line Study` button. Manual save message identifies source.

## Responsive behavior

Laptop table with drawer. Tablet shows pair, distance, source/status then expands details. Narrow contextual single-pair resolution is supported; bulk table editing prefers larger screen.

## Accessibility

Pair labels include names/codes/direction; status text; proposal before/after comparison table; error action focus; no color-only approval; unit suffix announced.

## Prototype interactions

- Context pair OMSOH → EGSUZ loads.
- Fetch success → Proposed drawer.
- Admin Approve → usable success → return to SCR-005/008.
- API timeout → same-screen manual entry.

## Assumptions

- Manual approval, proposal coexistence/replacement, API provider, and some numeric validation are unresolved (GAP-017–019).

## Open questions

- Are manual records immediately usable/Approved?
- Does a proposal coexist with the current Approved record until approval?
- Is pair direction ordered or symmetric?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-DIST-1/5 | Editable authoritative table/fields | Confirmed |
| FR-DIST-2/2a | Fetch and contextual entry points | Confirmed |
| FR-DIST-3 | Proposed→Approved, self-approval | Confirmed for fetched |
| FR-DIST-4 | API error/manual fallback | Confirmed |
| FR-SCH-8 | Contextual blocker resolution | Confirmed |

## Acceptance checklist

- [ ] Deferred capacity/validity fields are absent.
- [ ] ECA Distance is separate from Distance Type.
- [ ] One pair record and approval dependency are clear.
- [ ] API failure never dead-ends the user.

