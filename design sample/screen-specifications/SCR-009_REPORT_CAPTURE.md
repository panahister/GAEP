# SCR-009 — Report Capture

## Business purpose

Capture arrival, departure, or noon reports through file upload or manual entry, preserve estimates, record actuals directly on the executable voyage, and present deviation/row outcomes without inventing pending report schemas.

## Source references

- [Requirements FR-RPT-1…6](../../Requirement/requirements.md)
- [User Stories US-RPT-1…7](../../User%20story/stories.md)

## Primary personas

Schedule Editor; Administrator inherits. Viewer sees resulting actuals/deviations elsewhere.

## Entry points

- Sidebar `Reports` → Capture report.
- Voyage Detail preselected.
- Optional page action from Monitor.

## Exit points

- Result → affected SCR-007 or SCR-002 deviation.
- Cancel → origin/list.

## Layout

Focused 800–960 px workspace in shell. Four-step indicator: `1 Report type`, `2 Source`, `3 Review`, `4 Result`. Report Type cards (Arrival/Departure/Noon), Source tabs (Upload file/Enter manually), Strict/Lenient radio group for file, validation preview table, then outcome summary.

## Information hierarchy

1. Report type and target voyage/port call.
2. Capture source and handling mode.
3. Parsed/manual fields and validation.
4. Imported/skipped/errors and detected deviations.

## Components

Stepper, segmented cards/tabs, Voyage/Port selectors, file drop zone, strict/lenient control, provisional manual field groups, preview table, error summary, progress, result banner, links.

## Data fields

| Group | Fields | Notes |
|---|---|---|
| Context | Report Type, Voyage Number/CVN, Port Call where applicable | Exact matching rules pending |
| File | `.xlsx`, CSV; filename, size, handling mode | Source says both CSV/Excel, exact layouts later |
| Arrival/Departure | Sample actual timestamp and port-call identity only | All detailed fields explicitly provisional |
| Noon | Sample report timestamp, textual status/coordinates | Exact fields provisional |
| Result | Imported count, skipped count, errors, deviation type/magnitude | Estimates retained |

## Actions

- **Primary:** Continue, Submit report.
- **Secondary:** Upload different file, Back, Cancel, download/review error list, open voyage/deviation.

## Permissions

Editor/Admin only for capture. Viewer cannot open the form. No Simulation role unless combined with Editor.

## Filters

Preview filter `All | Valid | Invalid`; result filter by row outcome.

## Sorting

Preview preserves file row order; errors can sort by row number/severity.

## Search

Find preview row by Voyage Number/port; manual context selector searches voyages and calls.

## Validation

Report type required; source required; Strict/Lenient required for file. File type/size validation; target must match. Strict: any invalid row imports nothing. Lenient: valid rows import and invalid rows skip. Actuals do not overwrite retained estimates. Exact field rules and duplicate correction are missing.

## States

Type selection, file/manual, parsing, valid preview, invalid Strict, mixed Lenient, submitting, success no deviation, success with deviation, partial success, total failure.

## Empty state

Preview before file: `Upload a report to review rows before import.` Results do not use empty-state art.

## Loading state

Parsing progress with filename and row count when available; submission progress keeps preview visible.

## Error state

Strict rejection: no imported count; detailed rows. Lenient partial: success-warning summary. Parser/service failure states no actuals recorded. Duplicate warning does not offer overwrite until rule confirmed.

## Success feedback

`42 rows imported. Departure actuals were recorded and 1 delay was detected.` Provide `Open VOY-2026-0148` and `View deviation`.

## Responsive behavior

Laptop/desktop full workflow. Tablet preview uses row cards. Narrow permits type/source selection and manual simple fields, but wide file preview requests larger screen.

## Accessibility

Stepper announces current step; drop zone has file input alternative; radio descriptions explain consequences; preview has table captions and error links; progress announced; result heading receives focus.

## Prototype interactions

- Choose Departure → Upload → Lenient.
- Upload demo file → 42 valid/3 invalid preview.
- Submit → partial success + +11 h deviation link to SCR-007/SCR-002.
- Strict variant → full rejection.

## Assumptions

- All detailed sample fields, duplicate behavior, and reset/correction rules remain provisional (GAP-008–010).

## Open questions

- Provide all three report templates and matching rules.
- How are duplicate/correction files resolved?
- Which actual fields lock a departure call?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-RPT-1/1a | Three types, file + form | Confirmed |
| FR-RPT-2 | Extensible layout; fields pending | Confirmed Missing dependency |
| FR-RPT-3 | Estimate retained, actual recorded, deviation | Confirmed |
| FR-RPT-6 | Strict/Lenient | Confirmed |

## Acceptance checklist

- [ ] The screen visibly labels detailed report fields provisional.
- [ ] Strict and Lenient outcomes differ correctly.
- [ ] No scenario is created by report ingestion.
- [ ] Result deep-links to affected voyage/deviation.

