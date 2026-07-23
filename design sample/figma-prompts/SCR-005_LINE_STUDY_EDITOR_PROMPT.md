# SCR-005 Line Study Editor — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-005 — Line Study Editor`, a core data-heavy rotation authoring screen.

## 2. Business purpose
Author the service-linked Call Sequence, shared milestone data, derived transit/aggregates, and Port Segmentation.

## 3. User and role
Default Schedule Editor; provide Viewer read-only variant.

## 4. Context inside the ERP shell
Reuse shell; breadcrumb `Services / AEX / LS-02` and persistent parent Service context.

## 5. Layout structure
Header with operator fields/save state; tabs `Call Sequence | Port Segmentation`; compact aggregate band; sticky editable table; 520 px Milestone Editor drawer; dirty bottom bar.

## 6. Information hierarchy
Rotation order/validation → distance/speed/transit → type milestones → totals/segments.

## 7. Components
Editable Route Sequence, Position/Sequence columns, Port/Bound/Call Type selectors, distance fetch, Time Pairs, Milestone Editor variants, aggregate band, derived segmentation table, validation summary.

## 8. Data and sample content
Use five AEX calls. Show Jebel Ali Position 1/Sequence 1 Commercial WB; Sohar 2/2; Suez Canal 3/3 Operational; Jeddah 4/4; Aqaba 5/5. Use plausible NM/kn/transit and local/UTC milestone pairs. Show Total Duration 35 d, Sea Time, Distance, Average Speed.

## 9. Primary actions
`Save line study`.

## 10. Secondary actions
Add call, edit milestones, Move up/down, fetch distance, remove call, cancel changes.

## 11. Filters and search
Find port/UN/LOCODE; optional Validation issues only. Do not allow business-order sorting.

## 12. Validation
NB/SB/EB/WB only; Commercial/Technical→Port; Operational→Canal Passage; NM/kn; speed >0; approved distance; chronological milestones; calculated fields read-only; preserve Position and renumber active Sequence on omit/unomit/reorder.

## 13. Permissions
Viewer reads; Editor/Admin edits. Simulation role alone does not.

## 14. Statuses
New/empty, dirty/saving/saved, invalid, recalculating, missing distance, omitted row.

## 15. Empty state
No calls with Add first call; aggregates explain when calculation begins.

## 16. Loading state
Stable table skeleton and localized recalculation strip.

## 17. Error state
Link validation summary to row/field; API failure same-screen manual fallback; preserve dirty data.

## 18. Success feedback
`Line Study LS-02 saved. Transit times and 3 segments recalculated.`

## 19. Responsive behavior
Laptop pins essential columns; tablet summary rows/full-height editor; narrow view-only sequence and totals.

## 20. Accessibility
No drag-only reorder; row label states Position/Sequence/omitted; calculated values exposed as outputs; focus and error associations.

## 21. Prototype interactions
Select Sohar→Commercial drawer; Bound change→Segmentation recompute; missing distance→SCR-013; omit→numbering change; Save→success.

## 22. Linked screens
SCR-004 Service Workspace, SCR-013 Port Distances.

## 23. Visual constraints
Dense, precise table-first UI with drawer; no decorative route map.

## 24. Prohibited behavior
No capacity, cost, bunker, manual Transit Time, arbitrary sort, or unsupported location types.

## 25. Source traceability
FR-LS-1…5, FR-LS-CS, FR-LS-SEG, FR-LS-CT; US-LS-1…12.

## 26. Assumptions
Line Study naming/deletion, ECA validation, milestone equality, organization code/Owned reference are GAP-020/021/031/033.
