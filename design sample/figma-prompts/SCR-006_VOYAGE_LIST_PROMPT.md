# SCR-006 Voyage List — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-006 — Voyage List`, the unified owned/partner/feeder index.

## 2. Business purpose
Find and export all voyage types while keeping feeder non-applicable fields honest.

## 3. User and role
Default Viewer; Editor/Admin have contextual feeder-management links.

## 4. Context inside the ERP shell
Reuse shell with Voyages active.

## 5. Layout structure
Page header/result count/export; search/common filters; Advanced Filters drawer; customizable table with pinned identity; pagination.

## 6. Information hierarchy
Voyage Number/CVN → Type/Service/Vessel/Operator → Start/End/ports → Cycle/CPD/Rule/Lifecycle.

## 7. Components
Data Table, type/lifecycle chips, search/filter chips, Column Customizer, density, Pagination, Export Menu, expandable row/time pair.

## 8. Data and sample content
Feature VOY-2026-0148/AEX-071W. Add Owned, Partner, and Feeder rows. Include a duplicate CVN on a different Voyage Number/date. In customizer show all 14 source columns. For feeder, show em dash + `Not applicable` accessible text for Line ID, Cycle, Cycle Plan, Rule ID, Lifecycle.

## 9. Primary actions
Open selected voyage.

## 10. Secondary actions
Filter/search/customize/export; Editor feeder edit link.

## 11. Filters and search
Voyage Type, Service, Vessel, Lifecycle, dates, Cycle, Port; search Voyage Number, CVN, vessel/IMO, service, port.

## 12. Validation
Valid filter range; no-row export disabled with explanation.

## 13. Permissions
All view/export; feeder edit requires Editor; no schedule edit action.

## 14. Statuses
Owned/Partner/Feeder and Planned/In-Progress/Completed for applicable voyages.

## 15. Empty state
First use and no-results variants; role-valid actions only.

## 16. Loading state
Fixed table header/width skeleton and localized filter progress.

## 17. Error state
Table Retry and export failure without clearing list.

## 18. Success feedback
Generation banner/highlight and synchronous export progress/completion.

## 19. Responsive behavior
Laptop reduced columns; tablet expandable rows; narrow voyage cards.

## 20. Accessibility
Table caption/sort, row link includes both identifiers, N/A announced, keyboard column controls.

## 21. Prototype interactions
Search duplicate CVN; open VOY-2026-0148→SCR-007; filter Feeder→edit SCR-011; customize columns.

## 22. Linked screens
SCR-004, SCR-007, SCR-011.

## 23. Visual constraints
Use compact table and pinned identifier; avoid cards on desktop.

## 24. Prohibited behavior
No unique-CVN assumption, direct schedule editing, cost fields, or fabricated feeder lifecycle.

## 25. Source traceability
FR-VOY-1/2/6/7, FR-EXP; US-VOY-1/2, US-FDR-5.

## 26. Assumptions
Default order/columns and export scope are annotated GAP-041.
