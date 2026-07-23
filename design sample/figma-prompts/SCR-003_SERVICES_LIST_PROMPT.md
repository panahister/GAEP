# SCR-003 Services List — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-003 — Services List`, a core planning index.

## 2. Business purpose
Find, compare, create, and open services with accurate derived status and availability.

## 3. User and role
Default Editor + Viewer; create an Administrator action variant and Viewer-only variant.

## 4. Context inside the ERP shell
Reuse shell with Services active.

## 5. Layout structure
Page header/result count/Create service; search/filter bar; customizable data table; pagination; export menu.

## 6. Information hierarchy
Service Code/Name → derived status/availability → type/trade lane/brand → validity/company.

## 7. Components
Use Data Table, search, filters/chips, Status Chips, Column Customizer, Pagination, Export, Deactivate/Reactivate confirmation.

## 8. Data and sample content
Include `AEX — Arabian Express`, Mainliner, Arabian Gulf–Red Sea, Oceanic Liner, Active, 01 Jan–31 Dec 2026. Include Draft and Inactive examples and one Draft + Deactivated example.

## 9. Primary actions
`Create service` routes to SCR-004 create state; row opens SCR-004.

## 10. Secondary actions
Filter, customize columns, export; Administrator Deactivate/Reactivate.

## 11. Filters and search
Search Code/Name; filter Status, Type, Trade Lane, validity, Include deactivated.

## 12. Validation
On Deactivate recheck Draft/no voyages; show conflict if state changed.

## 13. Permissions
Viewer no Create. Editor Create/Edit. Admin Deactivate only Draft and Reactivate deactivated. Never show Deactivate for Active/Inactive.

## 14. Statuses
Draft/Active/Inactive plus separate Deactivated flag.

## 15. Empty state
First use with role-valid Create and no-results with Clear filters.

## 16. Loading state
Stable header/table skeleton; preserve filters.

## 17. Error state
Inline table Retry and export/deactivate errors.

## 18. Success feedback
Specific AEX created/deactivated/reactivated messages and row highlight.

## 19. Responsive behavior
Laptop reduce columns; tablet expandable rows; narrow cards with Code/Name/Type/Status/Validity.

## 20. Accessibility
Sortable headers, table caption, code+name row labels, text statuses, focus return after dialog.

## 21. Prototype interactions
Wire AEX row, Create, Active filter, Admin Draft deactivate.

## 22. Linked screens
SCR-004 Service Workspace.

## 23. Visual constraints
Use a compact enterprise table, not service cards.

## 24. Prohibited behavior
No editable status, Hub & Spoke/Butterfly/Pendulum types, deep future-module links, or capacity/cost columns.

## 25. Source traceability
FR-SVC-1…5/12; US-SVC-1…6.

## 26. Assumptions
Separate availability and `Include deactivated` are GAP-025/026 provisional treatments.
