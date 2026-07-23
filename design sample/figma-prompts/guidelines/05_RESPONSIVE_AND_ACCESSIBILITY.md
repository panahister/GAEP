# Responsive and Accessibility Guidelines

## Design stance

Desktop/laptop provides complete operations. Tablet preserves strong monitoring, detail, and constrained editing. Narrow layouts preserve safe read-first continuity and simple actions; they do not pretend complex grid or scenario work is efficient on a phone.

Target WCAG 2.1 AA in the prototype design. Do not claim legal/product conformance, but implement the interaction and visual quality required for review.

## Viewport hierarchy

| Priority | Width | Required behavior |
|---|---:|---|
| 1 | `1440×1024` and larger | Customer presentation and full operations |
| 2 | `1280×800` | Full laptop operations |
| 3 | `768–1024` | Tablet monitoring/detail and constrained editing |
| 4 | `375–767` | Narrow urgent review and simple actions |

## Desktop and laptop

- Desktop uses full/collapsible sidebar, sticky table headers, pinned identifiers, multi-column forms, and persistent filters where valuable.
- Monitor displays approximately 8–12 voyage rows with timeline at full desktop.
- Simulation at ≥1440 shows Scenario Rail, schedule workspace, and Inspector/Change Summary together.
- At laptop, sidebar may start collapsed, advanced filters become a drawer, list default columns reduce, Simulation Inspector becomes a drawer, and Scenario Rail narrows.
- Keep primary and high-risk actions visible; move Export/secondary actions to overflow first.

## Tablet

- Navigation becomes overlay; header stacks title/status above actions.
- Tables show 3–5 essential columns plus expandable detail; horizontal scroll remains available with an obvious affordance.
- Monitor uses sticky labels, horizontal time scroll, and a shorter default range.
- Line Study uses summary rows and a full-height row editor.
- Service Workspace stacks CPD cards and Vessel Rule forms/tables.
- Simulation works on one scenario at a time; compare becomes stacked diff; call editing uses full-height sheet.
- Dialogs become near-full-width; drawers use 80–100% width.

## Narrow

- Prioritize Global Search, Schedule Monitor summary, Voyage Detail, deviation detail, and notifications.
- Replace list tables with cards showing identifiers, status, current/next port, and variance.
- Port-call rotation becomes a vertical ordered list; local time appears above UTC.
- Allow simple filter, export request, report review, and detail opening.
- For Line Study bulk edit, CPD/Vessel Rule edit, scenario comparison, and wide report preview, show current data plus `Use a tablet or desktop to edit this workspace safely.` Do not hide the record.

## Required reduced table columns

- Services: Service Code/Name, Type, Status, Validity.
- Voyages: Voyage Number + CVN, Vessel, Type, Start, Lifecycle/health.
- Port Distances: From/To, Distance, Source/Status.
- Feeder: CVN/Vessel, Operator, first–last port, dates.

Pin the primary identifier and row action on desktop. Define a mobile summary for every table; never shrink all columns until unreadable. Preserve sorting/filtering through toolbar or sheet. Horizontal scroll requires a visible affordance and sticky first column. Editable tables become row forms below 1024 when in-cell edit is unsafe.

## Navigation, drawers, and dialogs

- Below 1280, collapse sidebar to icons or overlay based on width; below 1024 use overlay only.
- Preserve active module/page in top bar and breadcrumb; closing navigation returns focus to menu trigger.
- Desktop drawer: `480–640px`; modal: `440–720px`.
- Tablet drawer: at least 80% width; editor may become full-screen sheet.
- Narrow: full-screen sheet with persistent title, Close, and safe action area.
- Avoid nested modal-on-modal.
- Dialogs trap focus and return focus on close. A write-pending dialog cannot be dismissed accidentally.

## Keyboard and focus

- Logical focus order matches visual/reading order.
- Provide a skip link to main content.
- Sidebar/menu supports keyboard navigation and Escape.
- Tabs support arrow keys; expanded rows announce state.
- Reordering uses Move up/down and keyboard alternatives; drag is optional.
- Timeline blocks are focusable in chronological order with complete accessible labels.
- Applying a scenario moves focus to success heading or error summary.
- Use the design-system focus ring on controls, row actions, timeline blocks, chip remove buttons, map actions, and reorder handles.
- Selected state remains distinct from focus and hover.

## Contrast and non-color meaning

- Normal text contrast target: at least `4.5:1`; large text and interface boundaries: at least `3:1`.
- Late, Early, Locked, Omitted, Projected, Proposed, Approved, and Error use text plus pattern/icon/line treatment, not color alone.
- Baseline dashed and Projected pattern remain different in grayscale.
- Disabled future modules remain readable but clearly inactive.
- Pointer target is normally at least `40×40px`; compact dense controls may be `32px` only with adequate spacing.

## Form accessibility

- Every input has a visible programmatically associated label; placeholder is never the label.
- Required state is conveyed in text/symbol and semantics.
- Helper/error text is associated with the field.
- Long forms have an error summary linking to invalid fields.
- Date/time input supports typing and keyboard selection.
- Units are readable in label/suffix and assistive name.
- Calculated read-only values are exposed as values, not misleading disabled inputs.
- Preserve entered valid data after validation or service failure.

## Table accessibility

- Use real header associations, captions/accessible names, announced sort and selection state.
- Editable cells include row identity in their accessible name.
- Omitted row label includes stable Position and omission state.
- Local and UTC appear in a consistent accessible order.
- Column customizer and reorder controls are keyboard-operable.

## Visualization alternatives

- Monitor provides equivalent Table view.
- Scenario comparison provides structured diff table.
- Route strip always accompanies an ordered list/table.
- Static map always has status, coordinates, and observed time in text.
- Never encode operational meaning only in tooltip, hover, map, animation, or color.

## Announcements and live regions

Use polite announcements for filter-result counts, recalculation completion, upload completion, save, and Apply success. Use assertive announcement only for task-blocking errors. Do not announce every cell recomputation.

## Review criteria

- All primary desktop flows are keyboard-completable.
- Focus is never lost after drawer/dialog/filter/update/deactivation.
- At 200% zoom on 1280 CSS px, content does not overlap or hide required actions.
- Monitor and scenario visuals have full text/table alternatives.
- All statuses remain understandable in grayscale.
- Every error states cause and recovery.
- Screen-reader labels distinguish Voyage Number from CVN and local time from UTC.
- Reduced motion preserves every recalculation and state-change meaning.
