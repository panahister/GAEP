# P3B-21 VS Code Product Studio Manual Accessibility Checklist

**Status:** Pending human execution and sign-off

**Scope:** GAEP Product Studio and the four GAEP native VS Code views

**Authority boundary:** This checklist is an unsigned template. Its existence and automated test results do not establish manual accessibility acceptance, Product Owner acceptance, security approval, release readiness, publication authority or deployment authority.

## Test setup

- [ ] Record reviewer name or accountable role: ____________________
- [ ] Record date and time: ____________________
- [ ] Record operating system, VS Code version and GAEP VSIX SHA-256: ____________________
- [ ] Use an isolated VS Code profile and a non-sensitive local fixture workspace.
- [ ] Confirm the normal VS Code profile and external systems are not used.

## Keyboard and focus

- [ ] Navigate all 12 Product Studio routes using only the keyboard in wide and narrow layouts.
- [ ] Confirm visible focus remains clear on navigation, fields, actions, table filters, sort buttons, exports and pagination controls.
- [ ] Confirm route changes move focus to the new page heading and do not create a keyboard trap.
- [ ] Edit a record field, press Escape, and confirm the draft resets only after the discard confirmation and focus returns to the page heading.
- [ ] Confirm disabled controls are skipped by sequential focus and expose the stated unavailable reason.

## Screen reader and announcements

- [ ] With VoiceOver or another platform screen reader, confirm the Product Studio title, navigation landmark, current route, page heading, main landmark and inspector order.
- [ ] Confirm all four native GAEP views have understandable names and focus commands.
- [ ] Confirm form labels, required state, validation messages, tables, sortable column state and row actions are announced accurately.
- [ ] Confirm polite announcements for navigation, pagination, sort, filter and export, and assertive announcements for rejected or invalid operations.
- [ ] Confirm empty, loading, invalid/error, offline and interrupted states are distinguishable without relying on color alone.

## Reflow, theme and motion

- [ ] At 200% and 400% zoom, confirm content reflows without lost controls or overlapping text.
- [ ] In a high-contrast or forced-colors theme, confirm borders, current selection and focus indicators remain visible.
- [ ] With reduced motion enabled, confirm Product Studio introduces no essential animation or unexpected scrolling.
- [ ] Check representative light and dark VS Code themes for readable text and control contrast.

## Tables and visible-metadata export

- [ ] Sort and filter representative Delivery tables using the keyboard and confirm the announced row counts and sort direction.
- [ ] Copy visible rows as CSV and confirm only visible bounded metadata is copied, with spreadsheet-formula prefixes neutralized.
- [ ] Confirm all 44 declared Delivery tables appear once and in the documented order when present, and unavailable optional tables are omitted.

## Human result

- [ ] Pass
- [ ] Fail
- [ ] Not performed

Findings or limitations:

______________________________________________________________________

______________________________________________________________________

Reviewer signature or attributable decision record: ____________________
