# SCR-005 — Line Study Editor

## Business purpose

Author the service-linked reusable call sequence, call-type milestones, operator classification, derived transit/aggregates, and system-derived port segmentation that voyage generation uses.

## Source references

- [Requirements FR-LS-1…5, FR-LS-CS, FR-LS-SEG, FR-LS-CT](../../Requirement/requirements.md)
- [User Stories US-LS-1…12](../../User%20story/stories.md)

## Primary personas

Schedule Editor. Viewer receives read-only access. Shared milestone behavior must match Simulation Analyst experience in SCR-008.

## Entry points

- Service Workspace → Line Studies → create/open.
- Missing-distance return from SCR-013.

## Exit points

- Save and return to Service Workspace.
- Breadcrumb back to Service.
- Missing distance → SCR-013 contextual pair.
- `Create ad-hoc voyage` may return to SCR-004 dialog.

## Layout

Full-width data editor within shell. Header retains service/line-study identity, operator fields, save state. Tabs: `Call Sequence` and `Port Segmentation`. On Call Sequence: compact aggregate band, sticky editable table, and 520 px right Milestone Editor drawer for selected row. Bottom action bar appears only with unsaved changes.

## Information hierarchy

1. Service and Line Study identity/save state.
2. Rotation order and validation.
3. Required distance/speed/transit facts.
4. Type-specific milestones and durations.
5. Derived voyage totals and segments.

## Components

Page Header, Tabs, editable Route/Port Sequence, Port/Bound/Call Type selectors, distance fetch action, local/UTC Time Pair, Milestone Editor, aggregate band, Segmentation table, reorder controls, validation summary, dirty bar.

## Data fields

| Group | Fields | Notes |
|---|---|---|
| Header | Line Study ID/Name (name assumed), Operator Type, Business Partner Code | Service link permanent |
| Call row | Position, Sequence Number, Port, Bound ID, Call Type, Overall Distance NM, ECA Distance NM, Port Time Zone, Speed kn, Transit Time | Position/Sequence/Transit system-managed as specified |
| Commercial milestones | EOSP, Maneuvering In, Berthing, Start/End Operations, Unberthing, Maneuvering Out, SOSP | Timestamps editable; adjacent durations calculated |
| Operational milestones | EOSP, Maneuvering In, Start/End Passage, Maneuvering Out, SOSP | Location must be Canal Passage |
| Technical milestones | EOSP, Maneuvering In, Berthing, Unberthing, Maneuvering Out, SOSP | Location must be Port |
| Aggregates | Total Voyage Duration, Total Sea Time, Total Distance, Average Speed | Read-only |
| Segments | Segment Type/ID/Name, first/last Sequence Number and Location ID | Read-only, derived on Bound change |

## Actions

- **Primary:** Save line study.
- **Secondary:** Add call, edit row/milestones, Move up/down, fetch distance, remove call, cancel changes.
- **Contextual:** Omit/unomit variants shown only where Line Study omission is confirmed through shared sequence behavior; do not imply executable change.

## Permissions

Viewer sees read-only table/drawer. Editor/Admin can edit. No Simulation role alone unless combined with Editor.

## Filters

Not needed for the normal sequence. Optional `Show validation issues only` when errors exist.

## Sorting

Fixed by Position/Sequence; user sorting is disabled because order is business data.

## Search

Find within calls by port/UN/LOCODE. Search does not reorder rows.

## Validation

Bound only NB/SB/EB/WB. Call Type only three values. Commercial/Technical require Port; Operational requires Canal Passage. Distance in NM and speed in kn; speed >0. Approved pair required. ECA Distance non-negative and no greater than Overall Distance (reasonable constraint requiring confirmation). Milestones follow chronological order; calculated durations read-only. Sequence auto-renumbers after structural changes while Position is preserved for omitted calls.

## States

New/empty, read-only, editing, dirty, saving, saved, row invalid, missing/proposed distance, recalculating, omitted, locked-by-service-use only if business later defines it.

## Empty state

`No calls in this Line Study. Add the first call to define the rotation.` Disable aggregate/segmentation values with `Calculated after complete legs are available.`

## Loading state

Header and table skeleton. Recalculation keeps rows visible and shows a progress strip plus `Recalculating schedule…`.

## Error state

Validation summary links to rows/fields. API failure opens same-screen manual fallback or SCR-013. Save failure preserves dirty data and identifies no changes were applied.

## Success feedback

`Line Study LS-02 saved. Transit times and 3 segments recalculated.` Mark clean state and update Last saved time.

## Responsive behavior

Laptop pins Position/Sequence/Port and moves milestones to drawer. Tablet uses summary rows and full-height row editor. Narrow view shows sequence and totals read-only; bulk editing requires larger screen.

## Accessibility

Table order is explicit; reorder uses buttons and keyboard; row accessible name includes Position and active Sequence; calculated fields are text outputs; milestone group headings and error associations are clear; dirty navigation prompts are keyboard accessible.

## Prototype interactions

- Select Sohar row → Commercial milestone drawer.
- Change Bound at Suez → Segmentation recompute indicator.
- Missing pair action → SCR-013; return updates Transit Time.
- Omit sample → row remains muted, Position stable, Sequence renumbers.
- Save → success variant.

## Assumptions

- Line Study name/label, deletion behavior, ECA ≤ total validation, and milestone equality rules need confirmation (GAP-031/033).
- Organisation code and Owned partner behavior unresolved (GAP-020/021).

## Open questions

- Can a used Line Study be edited, versioned, deactivated, or deleted?
- Is ECA Distance always ≤ Overall Distance?
- Are equal adjacent milestone timestamps allowed?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-LS-CS-1/1b | Editable rows, Position, Sequence | Confirmed |
| FR-LS-5/CS-2/3 | Transit and aggregate calculations | Confirmed |
| FR-LS-SEG | Derived Segmentation tab | Confirmed |
| FR-LS-CT | Type-specific milestone drawer | Confirmed |
| FR-DIST-2a | Fetch from Call Sequence | Confirmed |

## Acceptance checklist

- [ ] No capacity, cost, or bunker modelling appears.
- [ ] Port type and Call Type rules are enforced.
- [ ] Position/Sequence behavior is clear.
- [ ] Milestone schema matches SCR-008.

