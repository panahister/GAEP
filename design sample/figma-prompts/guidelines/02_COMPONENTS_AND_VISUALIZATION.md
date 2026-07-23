# Component and Visualization Guidelines

## Reuse contract

Build shared application components rather than screen-local imitations. All components use the Design System Guidelines and share state, accessibility, responsive, loading, empty, error, and permission behavior. Name components by function, not by screen.

## Shell and navigation components

- **ERP Sidebar:** product identity, navigation groups, icon/label items, disabled placeholder suffix. Variants: expanded, collapsed, overlay; item states default, hover, active, disabled. Use keyboard navigation, `aria-current`, tooltips when collapsed, and focus return from overlay.
- **Top Bar:** global search, organization, DEMO environment, notifications, help, profile. Variants full/compact and menus open. Maintain logical tab order and accessible icon labels.
- **Breadcrumb:** full/collapsed/overflow; semantic parent navigation; current item is not a link.
- **Page Header:** List, Detail, Editor, Read-only, Locked variants; title, identifiers, status, metadata, primary/secondary actions. Keep H1 first and move secondary actions to overflow before hiding primary or high-risk actions.
- **Tabs:** default, active, disabled, count, error-dot. Use correct tab semantics, arrow keys, and horizontal scroll on small widths.

## Data, table, filter, and export components

- **Data Table:** read-only, editable, selectable; sticky header, pinned identifiers, sorting, pagination, loading, empty, partial, and error states. Support keyboard row/cell actions without trapping focus.
- **Editable Table:** view, edit, dirty, saving, error, locked, omitted. Reordering is never drag-only. Keep valid data and show inline row errors plus an error summary.
- **Expandable Row:** closed/open/loading/error; announce expanded state; becomes a detail card/sheet on narrow layouts.
- **Column Customizer:** toggle and keyboard-reorder optional columns; mandatory unique identifiers remain pinned; include Reset.
- **Pagination:** announce page/result count; preserve filters; page size never exceeds 100.
- **Export Menu:** Excel/CSV/PDF where supported; state current scope/filters; provide synchronous progress, success, and failure without clearing the page.
- **Module Search:** labeled, clearable, loading/no-result/error; do not use placeholder as the only label.
- **Filter Bar/Chip/Advanced Filter:** visible chips summarize criteria; Reset/Clear is available; advanced filters become drawer/sheet at reduced widths; announce result count changes.
- **Global Search Overlay:** grouped Services, Voyages, Vessels, Locations; recent/loading/results/no-results/error; keyboard command behavior; duplicate CVNs disambiguated with Voyage Number and date.

Use a compact KPI/Summary Tile only when a source-backed current-filter count or total answers a real question. Never create decorative KPI cards.

## Forms and selectors

- All fields use visible label, helper/error, required state, read-only value, unit suffix, focus, disabled, loading, and saving behavior as applicable.
- **Local + UTC Time Pair:** local port date/time and zone first, UTC secondary; edit/read-only/error/locked variants; chronology error identifies the dependent pair.
- **Date Range:** enforce To ≥ From and use unambiguous text dates.
- **Port Selector:** name + UN/LOCODE + Location Type; filter valid Location Type from Call Type and explain excluded options.
- **Vessel Selector:** Vessel Name + IMO + operator + availability; never identify by name alone; unavailable result names the conflicting service/period.
- **Organisation Selector:** name plus code/type; mark Organisation Code provisional until confirmed.
- **Call Type Selector:** Commercial, Operational, Technical only; changing populated type warns about milestone impact.
- **Bound Selector:** NB/SB/EB/WB plus expanded label/tooltip.
- **With Frequency:** checkbox and dependent Frequency/Vessels fields; unchecked disables dependent fields with formula explanation.

## Status and feedback components

- **Status Chip:** text always present; optional icon; semantic colors consistent across Service, Voyage, CPD, Scenario, Distance, and operational health.
- **Banner:** page-level info/warning/error/success/lock with focused recovery action; persistent until safely resolved/dismissed.
- **Toast:** low-risk completion only; include object identifier; never the sole evidence of failure.
- **Inline Validation:** state the rule and recovery; summaries link to invalid fields/rows.
- **Confirmation Dialog:** Apply, Actualize, Unlock, Deactivate, Delete, Discard, Approve variants; no vague `Are you sure?`; destructive initial focus defaults to safe choice.
- **Progress/Skeleton:** layout-matching skeleton for initial load and localized progress for refresh/recompute/import/generation/apply.
- **Empty State:** distinguish first use, no results, no permission, and no applicable data; no playful illustration.
- **Error State:** plain-language cause, scoped recovery, preserved valid data, optional secondary reference/correlation ID.

## Domain components

### Route / Port Sequence

Show Position, active Sequence Number, location/UN/LOCODE, Call Type, Bound, leg distance/speed/transit, local/UTC milestone summary, state, and actions. Variants: Line Study editable, Voyage read-only, Simulation editable, feeder minimal. States include active, selected, changed, locked, omitted, invalid, and new. Position remains stable; Sequence skips omitted calls. Provide explicit row identity such as `Position 4, active sequence 3` and keyboard reorder.

### Milestone Editor

Show only fields valid for Commercial, Operational, or Technical Call Type. Include local/UTC pairs, calculated-duration chain, and validation summary. Variants planned/actual/scenario and edit/read-only/locked. Timestamp change recomputes adjacent duration; calculated values are outputs, not disabled fake inputs. Desktop uses drawer; tablet/narrow uses full-height sheet.

### Schedule Timeline / Gantt

Use multi-voyage Monitor, single-voyage Detail, and scenario overlay variants. Include row headers, time axis, Now marker, baseline/executable/projected layers, variance badges, legend, zoom, focus/hover detail, and click-to-detail. Provide a fully equivalent table. Narrow layouts default to summary/table rather than an unreadable compressed chart.

### Scenario Rail and Comparison

Show scenario ID/name, Draft/Applied/Discarded status, actor/time, changed-call count, selection, create, compare, and discard. Applied/Discarded are terminal. Compare two or three Drafts factually; no score or automatic recommendation. Applying one never silently discards the others.

### Change Summary

Show categorized counts, before/after values, affected port links, warnings/blockers, and apply readiness. Variants compact drawer, comparison, and confirmation. Use a structured list/table and signed time differences.

### Static Vessel Position

Text is authoritative: status, coordinates, observed-at UTC, `Static — not live AIS`. A small map/pin is supplementary. States: coordinates, text-only, no report, map error. Never animate a trail or imply live tracking.

### Audit / Activity

Audit data is confirmed but UI scope is provisional. If shown, keep it read-only with timestamp UTC, actor, action, resource, outcome, and correlation ID. Add no comments or approval workflow. Exclude from the main customer path until visibility and permissions are confirmed.

## Visualization catalogue

- **Schedule Monitor Gantt:** rows by voyage/vessel, horizontal time, baseline dashed, actual/executable solid, projected patterned, signed variance, Now marker, filters, zoom, feeder toggle, drawer, equivalent table.
- **Single-voyage rotation:** ordered call sequence with completed/locked/current/future/omitted and time layers; ordered table/list is authoritative.
- **Scenario diff:** changed calls, before/after times, total shifts, add/omit/reposition markers; two or three Drafts; structured diff table with explicit `No change`.
- **Port sequence/segmentation:** table-first with optional route strip and segment brackets; omitted calls retain Position; segment text equivalent.
- **Static last-known position:** one neutral pin, timestamp, coordinates, `Not live`; text survives map error.
- **Operational exception summary:** at most four compact current-filter counts—Late, Early, Omissions, Unplanned calls—and each filters the Monitor. Never display stale counts without timestamp.
- **Line Study aggregate:** one restrained band for rotation duration, sea time, total distance, and average speed; no oversized cards.

Every legend includes text and a visual sample. Variance includes signed time. Charts remain readable at 200% zoom and have adjacent/reachable text or table alternatives.

## Explicitly prohibited/deferred components

Do not create month calendar, schedule approval/publication stepper, comments, pie/donut/vanity charts, unsupported trend metrics, live nautical map/AIS trail, generic complex approval system, or automatic scenario recommendation. Only Port Distance Proposed → Approved/Rejected is a supported approval pattern.
