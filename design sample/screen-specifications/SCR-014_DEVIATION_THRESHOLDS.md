# SCR-014 — Deviation Thresholds

## Business purpose

Allow a Schedule Administrator to maintain separate early-arrival and delay thresholds per location, with a default fallback, so detected deviations reflect local operational tolerance.

## Source references

- [Requirements FR-RPT-4](../../Requirement/requirements.md)
- [User Story US-RPT-5](../../User%20story/stories.md)

## Primary personas

Schedule Administrator. Other roles may have no access; read-only visibility is not confirmed.

## Entry points

- Sidebar Administration → Deviation Thresholds.
- Optional link from a deviation rule explanation.

## Exit points

- Save remains on page.
- Return to Monitor/deviation origin if deep-linked.

## Layout

Page header; compact `Default thresholds` card; explanatory rule text; per-location editable table with Add location override; optional right drawer for editing. Avoid charts.

## Information hierarchy

1. Default early and delay thresholds.
2. Per-location overrides and inherited-default state.
3. Last updated/actor if audit UI is approved.

## Components

Number + unit fields, Location Selector, editable table, inherited/default badge, save bar, confirmation only if changing default impacts many locations (impact count may be unavailable).

## Data fields

Location UN/LOCODE/Name, Early Threshold, Delay Threshold, Effective Source (`Override` or `Default`). Unit is provisionally hours.

## Actions

- **Primary:** Save changes.
- **Secondary:** Add location override, edit, remove override to inherit default, cancel.

## Permissions

Administrator only per source story. Do not expose to Editor by default.

## Filters

Location, Override/Inherited, changed only.

## Sorting

Location Name/UN/LOCODE, override status.

## Search

Location Name and UN/LOCODE.

## Validation

Both default values required. Provisional non-negative numeric values and fixed unit. Per-location blank means inherit default rather than zero. Exact allowed range/precision is missing.

## States

Default, override, inherited, dirty/saving/error, no overrides.

## Empty state

`No location-specific overrides. All locations use the default thresholds.` Offer Add override.

## Loading state

Default card and table skeleton; preserve header.

## Error state

Field error for invalid values; save failure preserves edits and states old rules remain active.

## Success feedback

`Deviation thresholds saved for 4 locations.`

## Responsive behavior

Tablet uses override cards/drawer. Narrow supports simple default/one override edits but bulk changes prefer larger screen.

## Accessibility

Units included in labels; override/inherit in text; error summary; removing override confirmation explains fallback to default.

## Prototype interactions

- Edit Jeddah delay threshold → dirty → save success.
- Remove override → inherited state.

## Assumptions

- Unit hours, non-negative range, and admin-only visibility are provisional where not explicit (GAP-012).

## Open questions

- What unit, precision, minimum, and maximum apply?
- Is read-only threshold access needed for other roles?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-RPT-4 | Default + per-location separate early/delay | Confirmed |
| US-RPT-5 | Override/inherited behavior | Confirmed concept |
| Threshold units | Numeric field suffix | Missing / Assumed |

## Acceptance checklist

- [ ] Early and delay values remain separate.
- [ ] Default inheritance is explicit.
- [ ] No deviation acknowledgement workflow is added.

