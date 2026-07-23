# SCR-007 Voyage Detail — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-007 — Voyage Detail`, a core read-first operational record.

## 2. Business purpose
Inspect voyage identity, lifecycle, rotation, plan/actual/projected timing, locks, deviations, and last-known position; route changes to Simulation.

## 3. User and role
Default combined Viewer + Editor + Simulation; provide Viewer-only action variant.

## 4. Context inside the ERP shell
Reuse shell; breadcrumb `Voyages / VOY-2026-0148`.

## 5. Layout structure
Detail header and actions; summary grid; tabs `Schedule | Overview | Activity` with Activity annotated provisional; single-voyage route timeline plus authoritative port-call table; position card; call drawer.

## 6. Information hierarchy
Voyage identity/lifecycle → current/next/health → rotation/times/locks → generation metadata → deviations/position.

## 7. Components
Page Header, definition list, chips, route timeline, port-call table, Time Pairs, layer legend, lock/omitted variants, deviation panel, static position, drawer, Export.

## 8. Data and sample content
Use VOY-2026-0148, AEX-071W, MV Meridian Star/IMO 9876543, AEX, In-Progress; five-call sequence. Show Sohar actual +11 h, downstream projected, current in transit to Suez, local+UTC pairs.

## 9. Primary actions
`Create recovery scenario` or `Create scenario` for Simulation role.

## 10. Secondary actions
Capture report (Editor), Export schedule, View in Monitor, open Service/Vessel.

## 11. Filters and search
Port-call filter All/Exceptions/Open-Future/Locked; find port.

## 12. Validation
No schedule fields editable. Do not design lifecycle transitions without guards.

## 13. Permissions
All view; Simulation scenario action; Editor report action; unlock only inside SCR-008 Admin variant.

## 14. Statuses
Planned/In-Progress/Completed; actual/projected; locked/open/omitted; no actual/no position; ad-hoc.

## 15. Empty state
No actuals/no deviations/no position as informative sections; missing rotation is an error.

## 16. Loading state
Independent identity/rotation/position skeletons.

## 17. Error state
Rotation Retry preserving identity; map error preserving text; not-found return to list.

## 18. Success feedback
Report or Apply success banners with exact object/outcome.

## 19. Responsive behavior
Tablet vertical route/expandable calls; narrow identity/current-next/deviation first and full-screen milestone sheet.

## 20. Accessibility
Ordered list/table, text lock/omitted, local/UTC labels, timeline alternative, focus-returning drawer.

## 21. Prototype interactions
Sohar call→drawer; recovery→SCR-008; Capture report→SCR-009; Monitor→SCR-002.

## 22. Linked screens
SCR-002, SCR-004, SCR-006, SCR-008, SCR-009.

## 23. Visual constraints
Operational detail hierarchy, no hero card or decorative map.

## 24. Prohibited behavior
No direct edit, Publish, approval, Confirmed lifecycle, cost, or live AIS.

## 25. Source traceability
FR-VOY-2/5, FR-SCH-1/5/6, FR-MON-1/5/6; US-VOY-5, US-SCH-*.

## 26. Assumptions
Activity visibility, lifecycle guards, and map freshness/provider are GAP-007/037/038.
