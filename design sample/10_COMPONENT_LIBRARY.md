# Component Library

## Library strategy

Build components as Figma variants using the tokens in `09_DESIGN_SYSTEM.md`. Reuse the same shell, table, form, status, feedback, and time-pair components on every screen. Domain components should be composed from foundations rather than drawn as screen-specific groups.

## Shell and navigation components

| Component | Purpose and anatomy | Variants/states | Behavior, accessibility, responsive use | Example |
|---|---|---|---|---|
| ERP Sidebar | Product identity, navigation groups, item icon/label, placeholder suffix | Expanded/collapsed/overlay; default/hover/active/disabled | Keyboard navigation, `aria-current`; tooltips when collapsed; overlay below 1280 | Service & Schedule active; Finance & Costing disabled |
| Top Bar | Search, organization, environment, notifications, help, profile | Full/compact; menu open; notification count | Logical tab order; icon labels; reduces to essentials on tablet | `Oceanic Liner Operations`, `DEMO` |
| Breadcrumb | Parent path and current location | Full/collapsed; overflow menu | Semantic navigation; current item not a link | Services / AEX / LS-02 |
| Page Header | Title, identifiers, status, metadata, primary/secondary actions | List/detail/editor/read-only/locked | Actions wrap into overflow at smaller widths; H1 remains first | Voyage `VOY-2026-0148` + CVN |
| Tabs | Switch related sections without changing parent entity | Default/active/disabled/count/error-dot | Arrow-key navigation; responsive horizontal scroll | Overview, Line Studies, Cycle Plans, Voyages |

## Data display and table components

| Component | Purpose and anatomy | Variants/states | Behavior, accessibility, responsive use | Example |
|---|---|---|---|---|
| KPI/Summary Tile | Compact decision-supporting value, label, context | Neutral/info/warning/danger; loading | Use only for source-backed counts/totals; never decorative | `4 calls delayed` from current filtered Monitor |
| Data Table | Header, rows, sort, selection, pagination, column controls | Read-only/editable/selectable; loading/empty/error/partial | Sticky header; keyboard cell/row navigation; horizontal scroll; pin IDs | Services, Voyages, Distances |
| Editable Table | Row edit, validation, add/reorder controls | View/edit/dirty/saving/error/locked/omitted | Never drag-only; inline errors plus row summary; preserve Position | Call Sequence, Vessel Rules |
| Expandable Row | Summary row plus subordinate detail | Closed/open/loading/error | Button with expanded state; on narrow screen becomes card detail | Voyage port calls, vessel history |
| Column Customizer | Toggle/order visible columns, reset | Open/dirty/saved | Keep mandatory identifiers pinned; keyboard reorder controls | 14-field Voyage List |
| Pagination | Page, row count, page size up to 100 | Default/loading/disabled | Announce page/result count; preserve filters | Voyage list page 2 of 8 |
| Export Menu | Format options and scope summary | Closed/open/loading/error/success | State selected format/scope; synchronous download feedback | Excel, CSV, PDF |

## Filtering and search

| Component | Purpose/anatomy | Variants/states | Behavior/accessibility/responsive | Example |
|---|---|---|---|---|
| Module Search | Search field, clear, result count | Idle/typing/loading/no result/error | Debounced; label not placeholder-only | Search Voyage Number, CVN, vessel |
| Filter Bar | Common filters and saved clear action | Expanded/compact; active-count | Visible chips summarize applied filters | Service, vessel, voyage type, range |
| Advanced Filter Panel | Less common criteria, Apply/Reset | Side panel/popover; dirty/error | On laptop/tablet use drawer; announce result changes | Cycle, port, lifecycle, start/end |
| Filter Chip | Applied criterion with remove | Default/focus/disabled | Remove has accessible label | `Voyage type: Partner` |
| Global Search Overlay | Categorized recent/results list | Idle/loading/results/no-result/error | Keyboard command menu, duplicate CVN disambiguation | Service AEX, Voyage VOY-2026-0148 |

## Forms and selectors

| Component | Purpose/anatomy | Variants/states | Behavior/accessibility/responsive | Example |
|---|---|---|---|---|
| Text/Number Field | Label, input, helper/error, optional suffix | Default/focus/filled/disabled/read-only/error/loading | Error is associated and recovery-specific; unit suffix non-editable where fixed | Speed `17.5 kn`, Distance `625 NM` |
| Date & Time Pair | Local date/time, port zone, UTC secondary | Edit/read-only/error/locked | Local is primary; UTC updates; chronology errors show exact dependency | `14 Jul 2026 08:00 GST` / `04:00 UTC` |
| Date Range | Valid From/To with paired validation | Default/error/disabled | Enforce To ≥ From; avoid ambiguous numeric dates | Service validity |
| Port Selector | Port/Canal search by name + UN/LOCODE/type | Single/multi/loading/no-result/error | Filter allowed Location Type by Call Type; show reason for exclusion | Jebel Ali `AEJEA` — Port |
| Vessel Selector | Name + IMO + operator and availability | Default/loading/unavailable/error | Never identify by name alone; unavailable result explains current service | `MV Meridian Star · IMO 9876543` |
| Organisation Selector | Name + code/type | Partner/feeder/agent | Source lacks exact code field; annotate assumption | `BlueWave Feeders · Feeder operator` |
| Call Type Selector | Commercial/Operational/Technical | Default/error/read-only | Changes milestone schema; confirm if populated fields would be lost | Commercial |
| Bound Selector | NB/SB/EB/WB with expanded label | Default/read-only/error | Do not show abbreviations without tooltip/secondary label | EB — East Bound |
| With Frequency Control | Checkbox plus dependent fields | Checked/unchecked/error/locked | Disables Frequency/Vessels when off; explains formula when on | 5 vessels × 7 days = 35 days |

## Status and feedback components

| Component | Purpose/anatomy | Variants/states | Behavior/accessibility/responsive | Example |
|---|---|---|---|---|
| Status Chip | Text, optional icon, semantic border/fill | Service, Voyage, CPD, Scenario, Distance, Health | Text always present; do not reuse colors inconsistently | `Draft`, `In-Progress`, `Proposed`, `Late +11h` |
| Banner | Page-level blocker/info with action | Info/warning/error/success/lock | Focusable action; persists until resolved/dismissed safely | `This voyage is being edited by Maya Chen.` |
| Toast | Completed low-risk outcome | Success/error/info | Announces politely; includes object ID; no sole record of failure | `Scenario S-03 applied to VOY-2026-0148.` |
| Inline Validation | Field/row message and icon | Error/warning | Explains why and how to fix; summary links to first invalid field | `End of Operations must be after Start of Operations.` |
| Confirmation Dialog | Consequence, affected object, primary/cancel | Apply/actualize/unlock/deactivate/delete/discard/approve | Initial focus on safe choice for destructive actions; no vague “Are you sure?” | Apply 5 call changes |
| Progress / Skeleton | Layout-preserving load or determinate job | Skeleton/spinner/progress bar | Announce long-running progress without focus theft | Voyage generation, report import |
| Empty State | Title, explanation, next valid action | First-use/no-results/no-permission | No playful art; distinguish no data from filter mismatch | `No voyages match these filters.` |
| Error State | Plain-language cause, recovery, reference | Inline/page/partial/service unavailable | Preserve valid data; retry scoped action | Port Distance API unavailable |

## Domain-specific components

### Route / Port Sequence

- **Purpose:** Express ordered calls and their active/omitted state.
- **Anatomy:** Position, Sequence Number, location/UN/LOCODE, call type, bound, leg distance/speed/transit, local/UTC milestone summary, state/actions.
- **Variants:** Line Study editable; Voyage read-only; Simulation editable; feeder minimal.
- **States:** active, selected, changed, locked, omitted, invalid, newly added.
- **Behavior:** Position remains stable; Sequence Number skips omitted calls. Reordering supports buttons/position entry and optional drag handle. Changes recalculate downstream values.
- **Accessibility:** Ordered-list/table semantics, explicit `Position 4, active sequence 3`, keyboard reorder.
- **Responsive:** At tablet, core columns stay in row and details expand; narrow view becomes stacked call cards.

### Milestone Editor

- **Purpose:** Show only fields valid for the selected Call Type.
- **Anatomy:** Call identity, local/UTC timestamp pairs, calculated-duration chain, validation summary.
- **Variants:** Commercial, Operational, Technical; planned/actual/scenario; read-only/locked.
- **States:** complete, incomplete, chronology error, recalculated, dirty.
- **Behavior:** Editing a timestamp recomputes adjacent durations. Calculated values are visibly read-only.
- **Accessibility:** Group with heading; describe formula in accessible helper text; errors link to exact pair.
- **Responsive:** Right drawer desktop; full-screen sheet tablet/narrow.

### Schedule Timeline / Gantt

- **Purpose:** Compare baseline, executable/actual, and projected port-call timing.
- **Anatomy:** Row headers, time axis, Now marker, layer blocks, variance badges, legend, zoom controls.
- **Variants:** Monitor multi-voyage; Voyage single-voyage; Simulation scenario overlay.
- **States:** no actual, on time, early, late, at risk, projected, selected, loading/error.
- **Behavior:** Hover/focus opens concise details; click opens drawer; zoom changes time scale; filter updates rows.
- **Accessibility:** Companion table and text summary; blocks keyboard-focusable; signed variance included in label.
- **Responsive:** Horizontal scroll with sticky row headers; tablet defaults to fewer rows; narrow offers summary list first.

### Scenario Rail and Comparison

- **Purpose:** Manage multiple drafts and clarify live separation.
- **Anatomy:** scenario name/ID, status, author/time, changed-call count, selection, create/compare/discard.
- **Variants:** DRAFT, APPLIED terminal, DISCARDED terminal; comparison 2–3 scenarios.
- **States:** selected, stale baseline, locked, loading.
- **Behavior:** Applying one does not silently discard other drafts. Comparison is factual; no invented recommendation score.
- **Accessibility:** Tabs/listbox semantics as appropriate; statuses in text.
- **Responsive:** Rail collapses to top selector; comparison becomes stacked diff on tablet and unavailable for editing on narrow.

### Change Summary

- **Purpose:** Explain scenario effects before Apply.
- **Anatomy:** categorized counts, before/after values, affected port links, warnings, apply readiness.
- **Variants:** compact drawer, full comparison, confirmation summary.
- **States:** no change, valid changes, blockers, warnings.
- **Accessibility:** Structured list with signed time differences and non-color markers.

### Static Vessel Position

- **Purpose:** Show last-known report location without implying live tracking.
- **Anatomy:** textual state, coordinates, observed-at time, small map/pin, `Not live` label.
- **States:** coordinate available, text-only, no report, map error.
- **Accessibility:** Text is authoritative; map is supplementary.
- **Responsive:** Collapses to text card before map.

### Audit / Activity Timeline

- **Applicability:** Audit data is confirmed; a visible UI is not. Use only as a provisional detail-section pattern pending product confirmation.
- **Anatomy:** timestamp UTC, actor, action, resource, outcome, correlation ID.
- **States:** loaded/empty/error.
- **Behavior:** Read-only; no comments or approval added.
- **Accessibility:** Semantic list; timestamps unambiguous.

## Components assessed as not applicable or deferred

- **Calendar month view:** not justified; Gantt answers the supported operational comparison question.
- **Workflow stepper for schedule approval/publication:** no such workflow exists.
- **Comments:** no comments capability is sourced. Do not include.
- **Rich charts/pie charts:** no confirmed decision-grade metrics.
- **Live nautical map:** AIS is deferred; static last-known pin only.
- **Complex approval component:** only Port Distance PROPOSED → APPROVED/Rejected is supported.

