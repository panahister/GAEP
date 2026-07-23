# SCR-011 Feeder Voyage Form — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-011 — Feeder Voyage Form`, a supporting minimal create/update screen.

## 2. Business purpose
Capture a third-party feeder voyage with operator, free-text Vessel Name, CVN, and multiple arrival/departure calls only.

## 3. User and role
Editor/Admin edit; Viewer read-only variant.

## 4. Context inside the ERP shell
Reuse shell; breadcrumb `Feeder Schedules / Create` or feeder ID.

## 5. Layout structure
Header form, provisional Main Voyage link section, editable port-call table, dirty action bar. Do not add tabs.

## 6. Information hierarchy
CVN/Vessel/Operator → ordered calls/times → derived first/last and link.

## 7. Components
Text Fields, Organisation Selector, provisional main-voyage selector, minimal Route Sequence, Port Selector, Time Pair, reorder buttons, validation summary.

## 8. Data and sample content
Use BWF-221, BlueWave Horizon, BlueWave Feeders, calls Fujairah `AEFJR`, Jebel Ali `AEJEA`, Sohar `OMSOH`; show arrival/departure only.

## 9. Primary actions
Create feeder voyage / Save changes.

## 10. Secondary actions
Add/reorder/remove call, Cancel, View main voyage.

## 11. Filters and search
Port and Operator selectors only.

## 12. Validation
Require header and meaningful multi-call rotation provisionally; arrival ≤ departure; chronological sequence; never validate Vessel Name against master data.

## 13. Permissions
Viewer reads; Editor/Admin edit.

## 14. Statuses
Create/edit/read-only, dirty/saving/saved, linked/unlinked, invalid row.

## 15. Empty state
New form with clear Add port call instruction.

## 16. Loading state
Header/call-row skeleton; localized save.

## 17. Error state
Row/field errors; preserve inputs; link error does not clear schedule.

## 18. Success feedback
`Feeder voyage FDR-2026-0042 created.` with list/monitor links.

## 19. Responsive behavior
Tablet call cards/full-height row edit; narrow view-first or one call at a time.

## 20. Accessibility
Explain free-text nature, explicit row order/reorder buttons, port-specific time labels.

## 21. Prototype interactions
Add/reorder call; save→SCR-010; View alongside→SCR-002.

## 22. Linked screens
SCR-002, SCR-006, SCR-007, SCR-010.

## 23. Visual constraints
Minimal form; no dense mainliner milestones.

## 24. Prohibited behavior
No Vessel master autocomplete, Line Study, CPD, Call Type, distance/speed, cost, agreement, or Simulation requirement.

## 25. Source traceability
FR-FDR-1a/2/3/4; US-FDR-1…4.

## 26. Assumptions
Main link, minimum calls, chronology, and dual-time treatment are GAP-022/023.
