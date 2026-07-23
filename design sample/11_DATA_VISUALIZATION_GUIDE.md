# Data Visualization Guide

## Principle

Visualization is applicable only where it improves schedule comparison, exception detection, or sequence comprehension. The module does not need decorative analytics. A table or textual summary is the default when it answers the question more precisely.

## Visualization catalogue

### 1. Schedule Monitor Gantt

- **Question:** Which voyages and calls are on time, early, late, or at risk, and how does execution differ from baseline over the selected range?
- **Source data:** Voyage/Port Call baseline, executable/actual, projected layer, deviations, status, service, vessel, type.
- **Encoding:** Rows by voyage or vessel; horizontal time; baseline dashed outline; actual/executable solid; projected patterned tint; signed variance badge; Now marker.
- **Interaction:** Filter, zoom, horizontal scroll, hover/focus detail, click to drawer/voyage, feeder-alongside toggle.
- **Empty:** `No voyages are scheduled in this range.` Offer change range/clear filters.
- **Error:** Preserve filter controls and show `Schedule timeline could not be loaded` with Retry and optional table view.
- **Accessibility alternative:** Fully equivalent sortable table with port, baseline ETA/ETD, actual/projected, signed variance, and state.

### 2. Single-voyage rotation timeline

- **Question:** What is the voyage sequence, current progress, and plan-versus-actual state call by call?
- **Source data:** Voyage Detail port rotation and call status.
- **Encoding:** Ordered vertical or horizontal sequence with call markers; completed/locked, current, future, omitted; milestone summary.
- **Interaction:** Select call to open detail; toggle Baseline/Actual/Projected when available.
- **Empty:** Not meaningful for a valid owned/partner voyage; if data is corrupt, use an error state, not empty art.
- **Error:** `Port rotation is unavailable for this voyage.` Include identifier and Retry.
- **Accessibility alternative:** Ordered table/list is primary alongside the visualization.

### 3. Scenario diff visualization

- **Question:** What changes in each DRAFT scenario compared with live baseline and other drafts?
- **Source data:** Scenario snapshots and computed change summary.
- **Encoding:** Side-by-side factual diff: changed ports, before/after times, total time shift, add/omit/reposition markers. No score or “recommended” scenario unless a future rule defines it.
- **Interaction:** Select 2–3 scenarios; expand a port; choose a scenario to edit/apply.
- **Empty:** `Create at least two draft scenarios to compare.`
- **Error:** Keep scenario list; indicate which diff failed.
- **Accessibility alternative:** Structured change table with each scenario as a column and explicit `No change` cells.

### 4. Port sequence / segmentation view

- **Question:** What is the ordered rotation, where do Bound changes create segments, and which calls are omitted?
- **Source data:** Line Study Call Sequence, Position, Sequence Number, Bound, derived Port Segments.
- **Encoding:** Table-first; optional narrow route strip with segment brackets/labels. Omitted calls remain in stable Position.
- **Interaction:** Select row, reorder via controls, switch to Segmentation tab.
- **Empty:** First-use instruction to add a call.
- **Error:** Show invalid rows and preserve valid ones.
- **Accessibility alternative:** The editable table is authoritative; segment brackets have text equivalents.

### 5. Static last-known vessel position

- **Question:** Where was the vessel last reported, and when?
- **Source data:** Latest noon/arrival/departure report textual state and coordinates.
- **Encoding:** Small neutral map with one pin; prominent text `In transit to Jeddah` and `Last report 19 Jul 2026 08:00 UTC`; badge `Static — not live AIS`.
- **Interaction:** None beyond optional focus/expand. Do not animate or trail a route.
- **Empty:** `No reported position is available.` Show latest known port if present.
- **Error:** Text remains; map surface says `Map unavailable`.
- **Accessibility alternative:** Text and coordinates are the source of truth.

### 6. Operational exception summary

- **Question:** Within the current filtered Monitor range, how many voyages/calls need attention by type?
- **Source data:** Current filtered deviation/read-model records.
- **Encoding:** At most four compact summary tiles: Late, Early, Omissions, Unplanned calls. Show counts only; clicking filters the Monitor.
- **Interaction:** Click/focus applies the corresponding filter.
- **Empty:** Zero values remain visible only if they help confirm health; otherwise use a compact `No active deviations in this range` message.
- **Error:** Hide counts and show one summary-load error; do not display stale numbers without timestamp.
- **Accessibility alternative:** Counts and filter action are text.

### 7. Line Study aggregate summary

- **Question:** What are the current rotation duration, sea time, total distance, and average speed?
- **Source data:** Auto-calculated Call Sequence aggregates.
- **Encoding:** Four restrained metric cells in one bordered summary band, not oversized cards.
- **Interaction:** None; values recompute as rows change.
- **Empty:** `Calculated after the first complete leg.`
- **Error:** Mark affected metric unavailable and link to invalid leg rows.
- **Accessibility alternative:** Text values with units.

## Status distribution and trend charts

Do not add status donuts, utilization charts, on-time trend lines, or voyage performance charts. The source does not define metric logic, aggregation period, decision owner, or data quality. Revisit after business metrics and thresholds are approved.

## Calendar recommendation

Do not create a month calendar merely because schedules contain dates. The supported comparison requires continuous duration, overlap, and variance, which the Gantt handles better. A calendar may be reconsidered only if users identify a day-based planning question not served by the timeline.

## Map recommendation

Use only the static last-known pin described above. Do not show real-time motion, AIS trails, weather overlays, nautical routing, or automatic position refresh claims.

## Visual accessibility rules

- Every legend uses text and a line/fill sample.
- Patterns distinguish projected and baseline when color is unavailable.
- Variances include signed time text (`+11 h`, `−2 h`).
- Charts retain readable text at 200% zoom.
- Provide tabular alternatives next to or directly reachable from every nontrivial visualization.

