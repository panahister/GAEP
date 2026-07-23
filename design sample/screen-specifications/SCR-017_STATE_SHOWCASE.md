# SCR-017 — State Showcase

## Business purpose

Provide a designer/reviewer reference frame proving that high-fidelity components cover operational empty, loading, error, locked, permission, partial-success, and success conditions consistently. It is not a customer-facing business page.

## Source references

- [Requirements and NFRs](../../Requirement/requirements.md)
- [User-story acceptance criteria](../../User%20story/stories.md)
- Current design-package brief.

## Primary personas

Designers, product owners, reviewers. Component examples reflect all product roles.

## Entry points

- Figma review page only; not application navigation.

## Exit points

- Links to matching component/screen frames.

## Layout

1440 px review board with sections: Lists, Forms, Timeline, Simulation, Upload/Import, Permissions, Feedback. Use component instances and annotations, not fake application navigation.

## Information hierarchy

1. State name and when it applies.
2. Component example.
3. Content/action/accessibility annotation.
4. Linked screen usage.

## Components

Empty states, skeletons, inline/page errors, banner/toast, locked/omitted table rows, no-permission state, report Strict/Lenient results, API fallback, edit-lock banner, apply confirmation/success/failure, timeline layers.

## Data fields

Demonstration data only: AEX, VOY-2026-0148, AEJEA/OMSOH, S-03. Reuse source-consistent samples.

## Actions

Prototype links to primary variants; no business write.

## Permissions

Show Viewer, Editor, Simulation, and Administrator differences with labels. Do not invent roles.

## Filters

Optional Figma-only state category nav; not product filter.

## Sorting

Order by state lifecycle: loading → empty/default → dirty/changed → success/error → permission/locked.

## Search

Not applicable.

## Validation

Every error message must say cause/recovery; every disabled/locked state has explanation; every success names object/action.

## States

Minimum set: first-use empty, no-results, loading, partial load, full error, inline validation, save pending, save success, API unavailable/manual fallback, Strict rejection, Lenient partial, edit lock, port locked, omitted row, insufficient permission, scenario Draft/Applied/Discarded, apply failure/live unchanged.

## Empty state

Show two variants: first use with role-valid action, and filter mismatch with Clear filters.

## Loading state

Show table skeleton, timeline skeleton, localized row recompute, file progress.

## Error state

Show correlation reference as secondary; recovery action; preserved context.

## Success feedback

Show inline refresh, toast, banner, and terminal applied state; specify which pattern belongs to which action.

## Responsive behavior

Provide desktop instances and selected tablet/narrow component variants; the review board itself need not be responsive.

## Accessibility

Annotate focus destination, live-region behavior, non-color cues, accessible label, and keyboard operation for each custom state.

## Prototype interactions

- Click state cards to linked screen variant.
- Toggle role comparison for locked/permission examples.

## Assumptions

- This is a Figma review artifact, not a production route.

## Open questions

- Which additional customer-specific resilience states require demonstration?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-RPT-6 | Strict/Lenient state pair | Confirmed |
| FR-DIST-4 | API fallback | Confirmed |
| FR-SCH-7 / FR-SIM-13 | Edit/port lock variants | Confirmed |
| Current brief | Comprehensive empty/loading/error/success coverage | Confirmed deliverable |

## Acceptance checklist

- [ ] Every inventory screen links to relevant state variants.
- [ ] All state text follows the content guide.
- [ ] No review-only control enters application navigation.

