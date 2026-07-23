# SCR-010 Feeder Schedules — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-010 — Feeder Schedules`, a supporting lightweight voyage list.

## 2. Business purpose
Find, inspect, create, and update third-party feeder voyages without mainliner complexity.

## 3. User and role
Viewer read-only; Editor/Admin create/update.

## 4. Context inside the ERP shell
Reuse shell with Feeder Schedules active.

## 5. Layout structure
Page header/Create; search/filter bar; compact data table; pagination; contextual link/alongside actions.

## 6. Information hierarchy
Feeder CVN/free-text Vessel → Operator → first/last port and times → call count/main link.

## 7. Components
Data Table, filters, search, type/link indicators, Pagination, empty/loading/error.

## 8. Data and sample content
Show `FDR-2026-0042`, CVN `BWF-221`, vessel `BlueWave Horizon` free text, operator `BlueWave Feeders`, Fujairah→Jebel Ali, 3 calls, linked to VOY-2026-0148 as provisional sample.

## 9. Primary actions
`Create feeder voyage` and open row.

## 10. Secondary actions
Edit for Editor, view main voyage, view alongside, filter/export.

## 11. Filters and search
Operator, dates, port, linked/unlinked; search CVN, Vessel Name, Operator, Port.

## 12. Validation
Only filter/date validity here.

## 13. Permissions
Viewer no Create/Edit. Editor/Admin enabled.

## 14. Statuses
Upcoming/past and linked/unlinked only; no fabricated feeder lifecycle.

## 15. Empty state
First-use role-aware and no-results variants.

## 16. Loading state
Stable table skeleton.

## 17. Error state
Retry list and localized link failure.

## 18. Success feedback
Highlight created/updated feeder and offer View alongside.

## 19. Responsive behavior
Tablet expandable rows; narrow cards.

## 20. Accessibility
Clarify free-text Vessel, text link state, row labels include ID/CVN.

## 21. Prototype interactions
Create/open→SCR-011; View alongside→SCR-002; main voyage→SCR-007.

## 22. Linked screens
SCR-002, SCR-006, SCR-007, SCR-011.

## 23. Visual constraints
Compact list; no service/cycle complexity.

## 24. Prohibited behavior
No line study, CPD, milestone, distance/speed, freight, agreement, cost, reconciliation, or feeder lifecycle.

## 25. Source traceability
FR-FDR-1…4; US-FDR-1…5.

## 26. Assumptions
Link identifier/cardinality/filter are GAP-022; lifecycle absence is GAP-024.
