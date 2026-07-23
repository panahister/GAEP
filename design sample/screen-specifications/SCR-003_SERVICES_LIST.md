# SCR-003 — Services List

## Business purpose

Find, compare, create, and open shipping services while accurately representing derived status, validity, type, and deactivation without exposing unsupported metrics.

## Source references

- [Requirements FR-SVC-1…5, 12](../../Requirement/requirements.md)
- [User Stories US-SVC-1…6](../../User%20story/stories.md)

## Primary personas

Viewer for inspection; Editor for create/update; Administrator for deactivate/reactivate.

## Entry points

- Sidebar `Services`.
- Global search result.
- Breadcrumb return from Service Workspace/Line Study.

## Exit points

- Service row → SCR-004.
- `Create service` → SCR-004 create state.
- Admin deactivate/reactivate confirmation → remain on list.

## Layout

Page header with result count and `Create service`; compact search/filter bar; full-width table; pagination; export menu. Use a right filter panel for advanced validity/deactivated filters.

## Information hierarchy

1. Service Code + Name.
2. Derived status and separate active/deactivated availability.
3. Type, trade lane, operator brand.
4. Validity, company code, linked counts as source-derived values only.

## Components

Data Table, Status Chips, Module Search, Filter Bar, Column Customizer, Pagination, Export Menu, confirmation dialog, empty/error/loading states.

## Data fields

| Column | Notes |
|---|---|
| Service Code | Immutable unique identity; pinned |
| Name | Primary descriptive label |
| Type | Mainliner / Feeder only |
| Trade Lane | Text/reference from service |
| Operator Brand | Source field |
| Status | Derived Draft / Active / Inactive |
| Availability | `Deactivated` only when applicable; separate from status |
| Valid From / Valid To | Unambiguous dates |
| Company Code | Optional default visible column |

## Actions

- **Primary:** Create service (Editor/Admin).
- **Secondary:** Open, filter, customize columns, export.
- **Privileged:** Deactivate Draft service; Reactivate deactivated service.

## Permissions

Viewer sees table/export only. Editor can create and edit through Workspace. Administrator sees Deactivate only for Draft with no voyages and Reactivate for deactivated services. Active/Inactive services show no Deactivate action.

## Filters

Status, Type, Trade Lane, validity overlap, availability; `Include deactivated` provisional control. Applied chips.

## Sorting

Default Service Code ascending. Support Name, Status, Type, Valid From/To.

## Search

Service Code and Name, optionally Trade Lane/Brand. Exact code matches first.

## Validation

List has no form validation. Deactivate dialog validates the service remains Draft at execution and reports if conditions changed.

## States

Draft, Active, Inactive, Draft + Deactivated; row hover/selected; Viewer/Editor/Admin actions.

## Empty state

First use for Editor/Admin: `No services have been created.` + Create service. Viewer: `No services are available.` Filtered: Clear filters.

## Loading state

Table skeleton with fixed headers and result placeholder. Preserve search/filter values.

## Error state

Inline table error with Retry; export error toast; deactivate conflict message names current status.

## Success feedback

`Service AEX created as Draft.` `Service AEX deactivated.` `Service AEX reactivated.` Keep affected row visible/highlighted.

## Responsive behavior

Laptop defaults to Code/Name, Type, Status, Validity. Tablet adds expandable detail. Narrow uses cards with code/name, status, type, validity and overflow actions.

## Accessibility

Table caption, sortable headers, clear chip labels, status text, row link names include code and name, dialog returns focus to action trigger.

## Prototype interactions

- Select AEX → SCR-004 Overview.
- Create service → SCR-004 create state.
- Filter Active → reduced results.
- Admin Deactivate Draft → confirmation and success variant.

## Assumptions

- Availability separate from derived status and `Include deactivated` filter (GAP-025/026).
- Linked counts are omitted unless directly available; no invented KPIs.

## Open questions

- Should deactivated services be hidden by default?
- Is Service Code uniqueness case-sensitive?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-SVC-1/US-SVC-3 | View/list/create entry | Confirmed |
| FR-SVC-3 | Derived status chip | Confirmed |
| FR-SVC-4 | Mainliner/Feeder types | Confirmed |
| FR-SVC-12 | Draft-only deactivate/reactivate | Confirmed |
| NFR-SCALE-2 | Pagination cap 100 | Confirmed |

## Acceptance checklist

- [ ] No manual status editor exists.
- [ ] Deactivate is unavailable for Active/Inactive.
- [ ] Service Code is the pinned identifier.
- [ ] Create/open paths reach SCR-004.

