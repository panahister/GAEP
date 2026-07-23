# SCR-014 Deviation Thresholds — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-014 — Deviation Thresholds`, a supporting Administrator screen.

## 2. Business purpose
Configure default and per-location separate early/delay tolerances.

## 3. User and role
Schedule Administrator only.

## 4. Context inside the ERP shell
Reuse shell with Administration / Deviation Thresholds active.

## 5. Layout structure
Page header; Default Thresholds card; rule explanation; editable per-location override table/drawer.

## 6. Information hierarchy
Defaults → overrides/inherited values → save state.

## 7. Components
Number/unit fields, Location Selector, editable table, Override/Default badge, save bar.

## 8. Data and sample content
Use provisional hours: Default Early 2 h, Delay 4 h; Jeddah override Early 1 h, Delay 3 h; Sohar Delay 2 h.

## 9. Primary actions
Save changes.

## 10. Secondary actions
Add/edit/remove override, Cancel.

## 11. Filters and search
Location, Override/Inherited; search Name/UN/LOCODE.

## 12. Validation
Both defaults required; provisional non-negative numeric hours; blank override means inherit, not zero.

## 13. Permissions
Administrator only; do not expose edit to Editor.

## 14. Statuses
Override, inherited, dirty/saving/saved/error.

## 15. Empty state
No overrides; all use default.

## 16. Loading state
Default/table skeleton.

## 17. Error state
Field errors and save failure preserving edits.

## 18. Success feedback
`Deviation thresholds saved for 4 locations.`

## 19. Responsive behavior
Tablet cards/full-height edit; narrow simple edits only.

## 20. Accessibility
Unit in labels, inherit text, linked error summary, clear focus.

## 21. Prototype interactions
Edit Jeddah→save; remove override→inherit.

## 22. Linked screens
Optional return to SCR-002 deviation context.

## 23. Visual constraints
No charts; calm governance form.

## 24. Prohibited behavior
No deviation acknowledgement/resolution workflow or combined early/delay value.

## 25. Source traceability
FR-RPT-4; US-RPT-5.

## 26. Assumptions
Hours, precision/range, and read visibility are GAP-012.
