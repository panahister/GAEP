# SCR-002 Schedule Monitor — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-002 — Schedule Monitor`, the primary module landing and core customer-demo screen.

## 2. Business purpose
Show read-only plan-versus-execution visibility, deviations, projected downstream impact, and entry to manual recovery.

## 3. User and role
Default user `Olivia Reed` has Viewer + Editor + Simulation roles. Provide Viewer-only action variant.

## 4. Context inside the ERP shell
Reuse the shell with Schedule Monitor active and future modules disabled.

## 5. Layout structure
Page header; four compact exception summary cells; filter bar; `Timeline | Table` toggle; full-width Gantt; right detail drawer; last-known position panel.

## 6. Information hierarchy
Filters/exceptions → voyage identity/current state → baseline/actual/projected blocks → visible variance → position/detail.

## 7. Components
Use Schedule Gantt, dashed baseline, solid executable/actual, patterned projected layer, Now marker, signed variance badges, legend, filters, feeder-alongside toggle, deviation drawer, static position, equivalent table.

## 8. Data and sample content
Show AEX and 5–7 other fictional voyages. Feature `VOY-2026-0148 / AEX-071W / MV Meridian Star`, In-Progress. At Sohar show `+11 h Late`; projected Jeddah `+9 h`, Aqaba `+8 h`. Show `In transit to Suez Canal`, coordinates and last report time, plus `Static — not live AIS`.

## 9. Primary actions
Click deviation; `Recover in Simulation` for Simulation role.

## 10. Secondary actions
Filter, zoom, switch Table, open Voyage Detail, toggle feeder alongside, Capture report, export.

## 11. Filters and search
Time range, Service, Vessel, Voyage Type, Lifecycle/health; search Voyage Number, CVN, vessel/IMO, service. Preserve filter chips.

## 12. Validation
Validate date range. Do not allow timeline edits.

## 13. Permissions
All view. Recovery requires Simulation; Capture report requires Editor. Viewer-only variant omits those actions.

## 14. Statuses
On time, Early, Late, At risk, omission, unplanned call, baseline-only, projected active, no reported position.

## 15. Empty state
Create date-range and filtered-no-results variants with Adjust/Clear actions.

## 16. Loading state
Keep filters visible; use row/timeline skeleton and localized progress on filter.

## 17. Error state
Timeline error retains filters and offers Retry/Table. Map error retains authoritative text/coordinates.

## 18. Success feedback
Post-Apply banner: `Scenario S-03 applied. The executable schedule has been refreshed.` Briefly highlight changed future blocks.

## 19. Responsive behavior
Laptop collapses advanced filters; tablet sticky labels/horizontal timeline; narrow defaults to accessible cards/table with optional scrollable timeline.

## 20. Accessibility
Use pattern/text/non-color cues, focusable blocks, full accessible labels, visible variance, table equivalent, and text-first map.

## 21. Prototype interactions
Wire +11 h badge → drawer; Recover → SCR-008; row → SCR-007; feeder toggle; Timeline/Table; refreshed return state.

## 22. Linked screens
SCR-007 Voyage Detail, SCR-008 Simulation, SCR-009 Report Capture.

## 23. Visual constraints
Dense, restrained, wide operational workspace. Exception cells are compact, not marketing KPI cards.

## 24. Prohibited behavior
No direct drag/edit, live AIS animation, decorative map, unsupported dashboard metrics, or auto-recovery claim.

## 25. Source traceability
FR-MON-1…6, FR-FDR-2; US-MON-1…6, US-FDR-4.

## 26. Assumptions
Monitor-as-landing, exception sorting, static map provider, and notifications are annotated GAP-037/039/045.
