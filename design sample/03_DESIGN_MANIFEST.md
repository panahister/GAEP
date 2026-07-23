# Design Manifest

## Product personality

Operational, calm, precise, maritime, international, stable, premium, and trustworthy. The interface should feel like a serious control surface used every day, not a marketing product or consumer dashboard.

## Governing principles

1. **Information earns space.** Every visible metric, chart, column, and card must answer an operational question or support an action.
2. **State is never ambiguous.** Live, baseline, projected, draft, applied, locked, omitted, deactivated, and validation states must be named and visually differentiated.
3. **Exceptions rise; normal data recedes.** Delays, missing distances, invalid chronology, edit locks, and incomplete reports receive prominence without coloring the entire interface as urgent.
4. **The shell stays stable.** Module screens never recompose primary navigation, top bar, breadcrumbs, or page-header patterns.
5. **Progressive disclosure beats horizontal sprawl.** Keep essential columns visible; move milestone depth, audit detail, and secondary metadata into expandable rows, tabs, or drawers.
6. **Power is controlled.** Apply, actualize, unlock, approve, deactivate, discard, and delete show scope and consequence before execution.
7. **Source truth beats visual convention.** Do not add approval, publication, confirmation, cost, or automation states because they are common elsewhere.
8. **Accessibility is part of fidelity.** Visible focus, keyboard order, contrast, labels, error associations, and non-color cues are required in design.

## Information-density rules

- Use a compact enterprise density: 36–40 px table rows, 32–36 px controls, and restrained 8/12/16 px spacing.
- Prefer one strong page header, one compact status/summary row, then the working surface.
- Use sticky headers and pinned identifiers for wide tables.
- Default to 6–9 visible columns; allow column customization for the 14-field voyage list.
- Put local time first and UTC as a consistent secondary line or adjacent subcolumn; never alternate patterns by screen.
- Use drawers for a single row's detail and full pages for multi-entity editing.

## Interaction rules

- Primary actions use direct verbs: Create service, Generate voyages, Create scenario, Apply scenario, Capture report.
- Preserve user context after modal/drawer actions; return focus to the trigger.
- Recalculation feedback is immediate: inline changed-value highlighting plus a compact “Schedule recalculated” status.
- Destructive or live-data actions require consequence-specific confirmation; routine saves do not.
- Disable an action only when the reason is visible or discoverable next to it.
- Read-only users see stable detail, not empty form controls. Privileged controls may be absent; consequential restrictions may show an explanatory label.
- Never use drag alone for port order. Provide Move up/down or position controls and keyboard equivalents.

## Component rules

- Components are token-driven, reusable, and named by function rather than screen.
- Status chips always include text; icons are supplementary.
- Tables share selection, sorting, filtering, density, pagination, loading, empty, and error behavior.
- Forms share labels, helper text, required indicators, validation placement, and save states.
- Baseline, actual/executable, and projected timeline layers share a legend component across Monitor and Voyage Detail.
- Omitted rows retain their position, remain visible, and have an explicit “Omitted” tag and Unomit action when permitted.

## Enterprise UX rules

- Do not hide identifiers needed for support or cross-team communication: Service Code, Voyage Number, CVN, IMO, UN/LOCODE, CPD ID, Rule ID.
- Do not use CVN as a unique key in search results or headings; pair it with Voyage Number.
- Show audit-relevant success messages with resource and action, not generic “Success”.
- Use page-level banners for cross-record blockers and field-level messages for local errors.
- Use optimistic-looking interaction only after the server acknowledges sensitive writes.
- Preserve filters in URL/state when navigating list → detail → back.

## Visual constraints

Avoid excessive gradients, glass effects, neumorphism, large decorative cards, playful illustration, oversized radii, floating pill navigation, dense shadow stacks, saturated full-page color, vanity charts, and motion without operational meaning.

Use restrained maritime cues through deep navy, cool slate, sea-teal accents, precise line work, and chart semantics. Do not imitate an existing vendor or imply approved branding.

## Accessibility

- Target WCAG 2.1 AA for the prototype design.
- Minimum 4.5:1 contrast for normal text and 3:1 for large text and interface boundaries.
- Every interactive element has a visible focus state and accessible name.
- Validation connects message, field, and recovery instruction.
- Timeline and map information has a table/text alternative.
- Locked, omitted, early, late, and projected states use text/pattern/icon in addition to color.
- Minimum pointer target is 40 × 40 px where layout permits; compact controls retain at least 32 px with adequate spacing.

## Responsiveness

- Large desktop (1440–1920): complete dense workflows.
- Standard laptop (1280–1439): complete workflows with fewer default table columns and collapsible filter rail.
- Tablet (768–1279): monitor and read tasks remain strong; dense editing uses stacked panels, drawers, and explicit horizontal table scroll.
- Narrow (<768): read-only summaries and urgent review are supported. Scenario comparison, call-sequence bulk editing, and complex CPD editing show an honest “Use a larger screen to edit” boundary while preserving viewing.

## Decision priority

When requirements compete, decide in this order:

1. Confirmed business rules and safety.
2. User comprehension and error prevention.
3. Traceability and permission integrity.
4. Operational scan speed.
5. Accessibility and responsive continuity.
6. Consistency and reuse.
7. Presentation polish.
8. Decorative novelty.

