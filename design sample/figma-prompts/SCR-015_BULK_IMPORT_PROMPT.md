# SCR-015 Bulk Import — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-015 — Bulk Import`, a supporting Administrator workflow.

## 2. Business purpose
Upload, validate, and import ongoing updates to module reference data without claiming undefined templates or mapping behavior.

## 3. User and role
Schedule Administrator only.

## 4. Context inside the ERP shell
Reuse shell with Administration / Bulk Import active.

## 5. Layout structure
960 px five-step flow: Entity type → Upload → Validate → Import → Result. Use preview table in Validate.

## 6. Information hierarchy
Entity/file → validation → consequence/count → result/errors.

## 7. Components
Stepper, entity cards, file drop/input, preview table, error summary, progress, confirmation, result links.

## 8. Data and sample content
Locations import demo: `locations-update-jul-2026.xlsx`, 150 rows, 148 valid, 2 invalid. Mark file template and row mapping as provisional annotations outside customer UI.

## 9. Primary actions
Validate file; Import valid data only after rules are confirmed.

## 10. Secondary actions
Change file, Back, Cancel, review/download error list, open imported data.

## 11. Filters and search
Preview All/Valid/Invalid; search row/key.

## 12. Validation
File type/entity match, unique key, entity-specific rules. Do not invent upsert/deactivate/rollback or partial-commit rules.

## 13. Permissions
Administrator only; deployment CLI import is not UI.

## 14. Statuses
No file, validating, valid/mixed/invalid, importing, complete, provisional partial, failed.

## 15. Empty state
Choose entity and approved template.

## 16. Loading state
Determinate progress; prevent ambiguous close during commit.

## 17. Error state
Use a safe total-failure variant `No data was changed`; do not claim partial commit without confirmation.

## 18. Success feedback
`148 Locations imported.` with link to SCR-012.

## 19. Responsive behavior
Desktop/laptop primary; tablet preview cards; narrow result monitoring only.

## 20. Accessibility
File input alternative, step announcements, error links, progress status, result focus.

## 21. Prototype interactions
Select Locations→upload→mixed validation→safe failure or annotated provisional partial→result.

## 22. Linked screens
SCR-012 Reference Data, SCR-013 Port Distances.

## 23. Visual constraints
Focused enterprise wizard, no playful upload art.

## 24. Prohibited behavior
No invented custom mapping, rollback, missing-record deactivation, or confirmed partial success.

## 25. Source traceability
FR-MDM-5; US-MDM-6.

## 26. Assumptions
Templates, mapping, keys, strictness, transaction, and rollback are GAP-042.
