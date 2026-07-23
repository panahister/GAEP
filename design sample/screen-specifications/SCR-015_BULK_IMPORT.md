# SCR-015 — Bulk Import

## Business purpose

Provide a governed UI entry for ongoing bulk updates to Locations, Vessels, Organisations, or Port Distances without pretending the missing file templates and update semantics are confirmed.

## Source references

- [Requirements FR-MDM-5](../../Requirement/requirements.md)
- [User Story US-MDM-6](../../User%20story/stories.md)

## Primary personas

Schedule Administrator only.

## Entry points

- Administration → Bulk Import.
- Reference Data `Bulk import`.

## Exit points

- Result → relevant SCR-012 tab or SCR-013.
- Cancel → origin.

## Layout

Focused stepper: `1 Entity type`, `2 Upload`, `3 Validate`, `4 Import`, `5 Result`. Use a 960 px content column with preview table at validation. Provide template-download slot only if templates are supplied; otherwise label `Template pending` in design notes, not customer UI.

## Information hierarchy

1. Entity type and file identity.
2. Validation outcomes and update keys.
3. Import consequence/count.
4. Completed/skipped/failed rows.

## Components

Stepper, entity cards, file drop zone, validation preview, error summary, progress, confirmation, result summary, links.

## Data fields

Entity Type, File, Row count, Valid/Invalid, proposed Creates/Updates/Deactivations only if mapping rules confirm them. Do not show custom column mapping as supported.

## Actions

- **Primary:** Validate file; Import valid data.
- **Secondary:** Change file, Back, Cancel, review/download error list, open imported data.

## Permissions

Administrator only. Deployment CLI import is not part of UI.

## Filters

Preview `All | Valid | Invalid`; optional action type only after rules confirmed.

## Sorting

Preserve source row; allow error severity/identifier.

## Search

Find preview row by source row or entity key.

## Validation

File type/size and entity-type match; unique keys; row validation based on entity. Strictness, partial import, upsert, rollback, and deactivation semantics are missing and must remain annotated.

## States

No file, validating, valid, mixed, invalid, importing, complete, partial, failed. Partial is a provisional design state, not confirmed behavior.

## Empty state

`Choose an entity type and upload its approved import template.`

## Loading state

Determinate progress when row counts exist. Do not allow close during commit without clear consequence.

## Error state

Validation error rows; import failure states whether no rows or some rows were committed only when transaction behavior is known. Prototype should use a safe `No data was changed` total-failure variant.

## Success feedback

`148 Locations imported.` Link to Locations. Do not invent a rollback button.

## Responsive behavior

Desktop/laptop primary. Tablet supports steps but preview becomes cards. Narrow can monitor result but should not perform bulk review/import.

## Accessibility

File input alternative, step announcement, table captions, error links, progress status, result focus.

## Prototype interactions

- Select Locations → upload → validation with 148 valid/2 invalid → total-failure or provisional partial variant → result.

## Assumptions

- Import templates, mapping, keys beyond confirmed identifiers, strictness, rollback, and partial success are unresolved (GAP-042).

## Open questions

- Provide templates and transactional/partial behavior.
- Does import create only, upsert, or deactivate missing records?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-MDM-5/US-MDM-6 | Admin UI upload/import/result | Confirmed |
| File layout/update semantics | Preview/commit logic | Missing |

## Acceptance checklist

- [ ] Missing template details are not presented as confirmed.
- [ ] No rollback or mapping capability is invented.
- [ ] Admin permission is explicit.

