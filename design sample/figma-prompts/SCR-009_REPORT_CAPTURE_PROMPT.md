# SCR-009 Report Capture — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-009 — Report Capture`, a core execution-input workflow.

## 2. Business purpose
Capture Arrival, Departure, or Noon reports via file/manual input, retain estimates, write actuals, and report detected deviations.

## 3. User and role
Schedule Editor/Admin only.

## 4. Context inside the ERP shell
Reuse shell with Reports active; allow preselected Voyage context from SCR-007.

## 5. Layout structure
800–960 px four-step workflow: Report type → Source → Review → Result. Use Upload/Manual tabs and Strict/Lenient file mode.

## 6. Information hierarchy
Type/target → source/mode → parsed/manual validation → imported/skipped/deviation result.

## 7. Components
Stepper, type cards, source tabs, Voyage/Port selectors, drop zone, radio descriptions, provisional manual groups, preview table, progress, error/result summary.

## 8. Data and sample content
Use Departure report for VOY-2026-0148 at Sohar. Demo file `departure-report-2026-07-19.xlsx`: 45 rows, 42 valid, 3 invalid. Clearly annotate all detailed field examples as provisional pending templates.

## 9. Primary actions
Continue and Submit report.

## 10. Secondary actions
Back, change file, Cancel, review/download errors, open voyage/deviation.

## 11. Filters and search
Preview All/Valid/Invalid; search voyage/call/row.

## 12. Validation
Require type/source/mode; file type/size; target matching. Strict imports zero if any invalid. Lenient imports valid and skips invalid. Never overwrite estimates.

## 13. Permissions
Editor/Admin capture; Viewer has no form access.

## 14. Statuses
Parsing, valid, mixed, Strict rejected, Lenient partial, submitting, success no deviation, success with deviation, total failure.

## 15. Empty state
Upload instruction before preview.

## 16. Loading state
File parsing/submission progress while preserving filename/preview.

## 17. Error state
Detailed row errors; strict says nothing imported; parser failure says no actuals recorded; do not offer overwrite duplicate.

## 18. Success feedback
`42 rows imported. Departure actuals were recorded and 1 delay was detected.` with links.

## 19. Responsive behavior
Tablet preview cards; narrow allows simple manual capture but asks for larger screen for wide file review.

## 20. Accessibility
Step announcement, file-input alternative, descriptive radios, table/error links, result focus.

## 21. Prototype interactions
Departure→Upload→Lenient→mixed preview→partial success→SCR-007/002; Strict rejection variant.

## 22. Linked screens
SCR-002, SCR-007.

## 23. Visual constraints
Focused workflow, no decorative upload illustration.

## 24. Prohibited behavior
No automatic API receipt, auto-recovery, scenario creation, invented final report field schema, or silent estimate overwrite.

## 25. Source traceability
FR-RPT-1…6; US-RPT-1…7.

## 26. Assumptions
Detailed fields, duplicate/correction behavior, and matching rules are GAP-008–010.
