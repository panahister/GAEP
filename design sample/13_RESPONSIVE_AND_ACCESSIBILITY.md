# Responsive and Accessibility

## Design stance

Desktop is the source-confirmed operational target. The current brief additionally requires tablet and narrow behavior. Therefore the prototype provides full functionality at desktop/laptop, strong monitoring and review on tablet, and safe read-first continuity on narrow screens. It does not pretend that complex multi-scenario or wide-grid editing is efficient on a phone.

## Viewport hierarchy

| Priority | Width | Primary use |
|---|---:|---|
| 1 | 1440 × 1024 and larger | Customer presentation and full operations |
| 2 | 1280 × 800 | Standard laptop, full operations |
| 3 | 768–1024 | Tablet, monitor/detail and constrained editing |
| 4 | 375–767 | Narrow, urgent review and simple actions |

## Desktop behavior

- Full or collapsible sidebar; persistent filters where valuable.
- Sticky table headers, pinned identifier columns, multi-column forms.
- Monitor displays 8–12 voyage rows with timeline.
- Simulation shows scenario rail, schedule workspace, and inspector/change summary simultaneously at ≥1440.
- Drawers retain underlying context.

## Laptop behavior

- Sidebar may start collapsed.
- Advanced filters move to a drawer; only most-used filters remain inline.
- Voyage List defaults to a smaller visible column set; column customizer exposes all fields.
- Simulation inspector collapses into a right drawer and the scenario rail narrows.
- Keep primary and high-risk actions visible; move export/secondary actions to overflow.

## Tablet behavior

- Navigation becomes overlay.
- Page header stacks title/status above actions.
- Tables show 3–5 essential columns and provide expandable row detail; horizontal scroll remains available for users who need it.
- Monitor uses sticky voyage labels and horizontal time scroll; default time range is shorter.
- Line Study shows call summary rows and opens each row in a full-height editor sheet.
- Service Workspace stacks CPD cards and vessel-rule tables.
- Simulation allows reviewing and editing one scenario at a time; comparison becomes a stacked diff rather than simultaneous columns.
- Dialogs become near-full-width; drawers become 80–100% width.

## Narrow behavior

- Prioritize Global Search, Schedule Monitor summary, Voyage Detail, deviation detail, and notifications.
- Replace list tables with cards containing identifiers, status, current/next port, and time variance.
- Port-call rotations become vertical ordered lists.
- Show local time with UTC below it.
- Permit simple actions such as filter, export request, report review, and opening detail.
- For Line Study bulk editing, CPD vessel-rule editing, scenario comparison, and multi-row report preview, show the existing data plus: `Use a tablet or desktop to edit this workspace safely.` Do not hide the record.

## Responsive table rules

1. Pin the primary identifier and row action on desktop.
2. Define a required mobile summary for every table; do not shrink all 14 voyage columns.
3. Preserve sorting/filtering through a toolbar or bottom sheet.
4. Use horizontal scroll only with visible affordance and sticky first column.
5. Expandable rows must be keyboard operable and announce expanded state.
6. Editable tables become row forms below 1024 when in-cell editing would be unsafe.

### Required reduced column sets

- Services: Service Code/Name, Type, Status, Validity.
- Voyages: Voyage Number + CVN, Vessel, Type, Start, Lifecycle/health.
- Port Distances: From/To, Distance, Source/Status.
- Feeder: CVN/Vessel, Operator, first–last port, dates.

## Navigation collapse

- At <1280, collapse the sidebar to icons or overlay based on available width.
- At <1024, use overlay only.
- Preserve active module/page in the top bar and page breadcrumb.
- On close, return focus to the menu button.

## Dialogs and drawers

- Desktop drawers: 480–640 px; modals 440–720 px.
- Tablet: drawers at least 80% width; editors may become full-screen sheets.
- Narrow: full-screen sheet with persistent title, Close, and safe action area.
- Avoid nested modal-on-modal. Close the first overlay or navigate within one overlay.

## Keyboard navigation

- Logical focus order matches visual order.
- Skip link to main content.
- Sidebar/menu: arrow keys and Escape.
- Tables: Tab enters toolbar/interactive row controls; arrow-key cell navigation only when the table implementation supports it consistently.
- Reordering: Move up/down buttons and keyboard shortcuts; drag is optional.
- Timeline blocks are focusable in chronological order with accessible labels.
- Dialogs trap focus and restore it on close.
- Applying a scenario moves focus to success heading or error summary.

## Focus visibility

Use the design-system focus ring on every control, table row action, timeline block, chip remove button, map expand action, and custom drag/reorder handle. Selected rows need a persistent style distinct from focus.

## Contrast and non-color communication

- Verify text and control contrast to AA targets.
- Use icon/label/pattern along with color for late, early, locked, omitted, projected, proposed, approved, and error states.
- Baseline dashed outline and Projected pattern remain differentiable in grayscale.
- Disabled placeholder modules retain readable labels while clearly inactive.

## Form accessibility

- Visible label for every input; placeholder is never the label.
- Required state is conveyed in text/symbol and programmatically.
- Helper/error text is associated with its input.
- Error summary at the top links to invalid fields for long forms.
- Date/time controls support typing and keyboard selection; do not require a visual picker.
- Unit is in label/suffix and read by assistive technology.
- Read-only calculated fields are exposed as values, not misleading disabled inputs.

## Table accessibility

- Real header associations and captions/accessible names.
- Sort state announced.
- Selection state programmatic.
- Editable cells have labels including row identity.
- Omitted row accessible label includes Position and omission state.
- For local/UTC time, both values are included in the accessible name in a consistent order.

## Chart, timeline, and map alternatives

- Monitor includes a `Table view` or companion schedule table.
- Scenario comparison has a structured diff table.
- Route strip always accompanies an ordered list/table.
- Static map always has textual status, coordinates, and observed time.
- Never encode an operational fact only in a tooltip.

## Announcements and live regions

Use polite announcements for filter result counts, recalculation completion, upload progress completion, and successful save/apply. Use assertive announcements only for task-blocking errors. Avoid announcing every cell recomputation.

## Accessibility review criteria

- All primary flows are keyboard-completable at desktop.
- Focus is never lost after drawers, dialogs, filter updates, or row deletion/deactivation.
- 200% zoom does not hide actions or overlap content at 1280 CSS px.
- Text alternatives fully explain Monitor and scenario visuals.
- Every status remains understandable in grayscale.
- Field errors identify cause and remedy.
- Screen-reader labels disambiguate Voyage Number from CVN and local time from UTC.
- Reduced motion leaves all change/recalculation meaning intact.

