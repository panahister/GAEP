# SCR-012 — Reference Data Workspace

## Business purpose

Maintain the Locations, Vessels, and Organisations required by Service & Schedule and enforce unique identifiers, active MVP type sets, name history, and safe deletion/deactivation.

## Source references

- [Requirements FR-MDM-1…6](../../Requirement/requirements.md)
- [User Stories US-MDM-1…7](../../User%20story/stories.md)

## Primary personas

Editor maintains; Viewer reads/exports; Administrator deletes/deactivates and imports.

## Entry points

- Sidebar `Reference Data` → Locations/Vessels/Organisations.
- Context links from Service/Line Study/Simulation/Feeder.

## Exit points

- Port Distances → SCR-013.
- Bulk Import → SCR-015 (Admin).
- Return to invoking selector with selected record (prototype link).

## Layout

One workspace with top tabs `Locations | Vessels | Organisations`. Each tab uses list + 480–560 px detail/edit drawer. Page actions adapt: Create location/vessel/organisation, Export, Admin Bulk import.

## Information hierarchy

1. Unique key and active/deactivated state.
2. Operational selection label/type.
3. Entity-specific details and references.
4. Destructive/deactivation consequence.

## Components

Tabs, Data Table, Search/Filter, detail/form drawer, status chip, history subtable, delete/deactivate dialog, referential blocker banner, Export/Bulk Import actions.

## Data fields

| Tab | Fields | Notes |
|---|---|---|
| Locations | UN/LOCODE, Name, Country, Coordinates, Time Zone, Location Type, Terminal/Berth references, attributes, Active | Only Terminal/Port/Canal Passage selectable |
| Vessels | IMO, Name, Operator Type, Capacity TEU, Service Speed, Call Sign, Flag, Dimensions, Name History validity, Active | IMO unique; name history nested |
| Organisations | Organisation code (gap), Name, Type, Active | Types: Partner Operator, Feeder Operator, Port Agent |

## Actions

- **Primary:** Create entity / Save changes.
- **Secondary:** Open, edit, export, add vessel name history.
- **Privileged:** Delete unreferenced; Deactivate referenced; Bulk import.

## Permissions

Viewer read/export. Editor create/update but not delete/deactivate if source reserves delete operations for Admin; Administrator delete/deactivate/import.

## Filters

Entity-specific Type, Country, Operator Type, Active/Deactivated. Locations only offer active MVP types.

## Sorting

Default key ascending; support Name, Type, Country/operator.

## Search

UN/LOCODE/name/country; IMO/vessel name/call sign; organization name/code.

## Validation

UN/LOCODE unique/mandatory. IMO unique/mandatory. Location Type limited active set. Vessel name-history validity must not overlap (reasonable but not explicit—flag). Referenced hard delete blocked and Deactivate offered.

## States

Active/deactivated, create/edit/read-only, referenced delete blocker, duplicate key, vessel name history, no results.

## Empty state

Entity-specific first-use text and Create action for Editor/Admin. Filtered state offers Clear filters.

## Loading state

Tab/table skeleton; drawer loads independently.

## Error state

Duplicate identifier field error; reference blocker names count/type where available; save retains fields; export/import failures scoped.

## Success feedback

`Location AEJEA created.` `Vessel IMO 9876543 updated.` `Organisation BlueWave Feeders deactivated.`

## Responsive behavior

Laptop list/drawer. Tablet drawer full height and reduced columns. Narrow cards/read-first; complex Vessel history editing requests larger screen.

## Accessibility

Tabs/row actions keyboard-operable; identifiers announced with labels; coordinates fields clear; history table caption; blocked delete focus moves to explanation and Deactivate action.

## Prototype interactions

- Open Vessel → name-history drawer.
- Admin delete referenced Port → blocker → Deactivate success.
- Port Distances tab link → SCR-013.
- Bulk import → SCR-015.

## Assumptions

- Organisation code missing (GAP-020).
- Vessel name-history overlap behavior not specified.
- Deactivated default visibility is assumed.

## Open questions

- Define Organisation key and required fields.
- Can Editors deactivate, or is every deactivate considered Admin-only delete operation?
- What is the vessel-name-history overlap rule?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-MDM-1…4 | Three tabs and fields/types | Confirmed except Org code Missing |
| FR-MDM-5 | Bulk Import entry | Confirmed |
| FR-MDM-6 | Referenced delete blocker/deactivate | Confirmed |

## Acceptance checklist

- [ ] Only three MVP Location Types are selectable.
- [ ] UN/LOCODE and IMO uniqueness is explicit.
- [ ] Referenced deletion never silently succeeds.
- [ ] No unrelated enterprise master-data capability is added.

