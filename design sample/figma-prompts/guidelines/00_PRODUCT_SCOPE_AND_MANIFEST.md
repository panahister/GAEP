# Product Scope and Design Manifest Guidelines

## Authority and purpose

Treat Service & Schedule as the operational planning and schedule-control module inside the provisional `Maritime ERP` presentation shell. It defines liner services, line studies and rotations, cycle plans and vessel rules, voyages and port calls, actuals and deviations, schedule monitoring, recovery simulation, feeder voyages, and supporting reference/administration data.

The prototype must feel like a near-production international enterprise product. Its central value is controlled, traceable schedule intelligence: users compare plan with execution, understand downstream effects, model recovery without changing live data, and apply an explicit decision safely.

When instructions compete, use this priority:

1. Confirmed business rules and operational safety.
2. User comprehension and error prevention.
3. Traceability and permission integrity.
4. Operational scan speed.
5. Accessibility and responsive continuity.
6. Consistency and component reuse.
7. Presentation polish.
8. Decorative novelty.

Never convert sample data, a provisional design treatment, or an unresolved assumption into confirmed product behavior.

## Product personality

The application is operational, calm, precise, maritime, international, stable, premium, and trustworthy. It is a serious control surface used repeatedly by operational teams—not a marketing website, consumer dashboard, or decorative analytics product.

Use concise English, strong information hierarchy, compact enterprise density, restrained maritime cues, predictable state, and visible consequences. Every visible metric, chart, column, card, and control must answer an operational question or support a valid action.

## Functional scope

Create functional depth only for:

- Authentication, secure session states, four composable roles, and user administration.
- Service create/maintain with immutable Service Code, derived Draft/Active/Inactive status, validity, and separate deactivate/reactivate availability.
- Multiple dedicated Line Studies per Service.
- Call Sequence authoring with stable Position, active Sequence Number, Port/Canal location, Bound, Call Type, distance, ECA distance, time zone, speed, transit, milestones, aggregates, and derived segmentation.
- Inline Cycle Plan Definitions and Vessel Rules within Service Workspace.
- Batch, single-next, cycle-wise, and ad-hoc voyage generation with manual CVN capture where required.
- Unified owned, partner, and feeder Voyage List plus Voyage Detail.
- Voyage lifecycle Planned → In-Progress → Completed only.
- Schedule Monitor with baseline, actual/executable, projected, deviation, filter, zoom, feeder-alongside, and static last-known position behavior.
- Simulation Cockpit as the exclusive schedule-change route, including multiple Draft scenarios, compare, add/omit/unomit/reposition, milestone/distance/speed edits, vessel phase/chaining/cut-off controls where specified, recomputation, Apply/Discard, and Administrator unlock.
- Arrival, departure, and noon report capture by manual/file input with Strict/Lenient behavior.
- Separate lightweight feeder voyage creation/update.
- Locations, Vessels, Organisations, Port Distances, thresholds, bulk import, and Users & Roles.
- Synchronous Excel/CSV/PDF export where specified.
- Explicit loading, empty, validation, error, partial-success, success, permission, lock, omitted, and unavailable states.

## Explicit exclusions

Do not create functional UI, data, KPIs, routes, or plausible workflows for:

- Cost, revenue, accrual, slot cost, bunker, tariffs, contracts, invoice, or finance calculations.
- Cargo, booking, bayplan, capacity modelling, Line Setting, port operations, agency, routing, regulatory, or nautical-routing workflows.
- AI route optimization, automated recovery, live AIS, route trails, weather overlays, automated report receipt, or external schedule publication.
- Schedule approval/publication workflows or a Confirmed voyage state.
- Direct executable-schedule editing outside Simulation.
- A standalone Deviation worklist, Audit History page, KPI dashboard, or month calendar without confirmed business rules.
- Feeder agreements, freight terms, cost, reconciliation, or owned-voyage lifecycle applied to feeder records.
- Detailed phone editing for call-sequence, CPD/vessel-rule, multi-scenario comparison, or wide import-preview workspaces.

Future ERP modules appear only as disabled `Coming later` navigation placeholders. They have no child routes, counts, hover previews, realistic business data, or interactions.

## Information and state principles

- State is never ambiguous. Name and visually differentiate Live, Baseline, Projected, Draft, Applied, Discarded, Locked, Omitted, Deactivated, Loading, Validation, Error, and Partial success.
- Exceptions rise; normal data recedes. Emphasize delay, missing distance, invalid chronology, edit lock, and incomplete import without making the whole UI look critical.
- Keep the common shell stable across all authenticated screens.
- Use progressive disclosure instead of uncontrolled horizontal sprawl: essential columns remain visible; secondary milestones, audit detail, and metadata move to expandable rows, tabs, drawers, or inspectors.
- Keep identifiers visible: Service Code, Voyage Number, CVN, IMO, UN/LOCODE, CPD ID, Cycle Position ID, and Rule ID where relevant.
- Voyage Number is the unique route/link key. CVN is always secondary and may be duplicated.
- Display local port time first and UTC in one consistent secondary pattern.
- Read-only users see purposeful readable information rather than disabled edit forms.
- Apply, Actualize, Unlock, Approve, Deactivate, Delete, and Discard always name the object, scope, and consequence before execution.
- Sensitive writes show success only after acknowledgement; no optimistic live-state fiction.
- Preserve filters, record identity, current tab, scroll position where relevant, and the launching context across overlays and back navigation.
- Never rely on drag alone for ordering; provide Move up/down or position controls and keyboard equivalents.

## Information density

- Prefer one clear page header, one compact status/summary band, then the working surface.
- Default to 6–9 useful visible columns; the Voyage List may expose all 14 through column customization.
- Use sticky headers and pinned identifiers for wide data tables.
- Use drawers for single-row/detail inspection and dedicated pages for multi-entity editing.
- Avoid multiple oversized cards, empty dashboard space, and decorative metric tiles.

## Prototype outcomes

The generated experience is successful only when:

- Schedule Monitor—not an invented KPI dashboard—is the default authenticated operational view.
- A Viewer can identify a delayed voyage, current/next port, and projected impact quickly.
- The deviation-to-recovery flow contains no dead end and never changes the executable schedule before Apply.
- The service-to-line-study-to-cycle-plan-to-voyage path is coherent and clickable.
- Business roles and sensitive actions match the confirmed permission model.
- All maritime example data is fictional, internally consistent, and visibly marked `DEMO`.
- 1440 px and 1280 px are fully credible; tablet/narrow behavior is honest about dense-editing limits.

## Visual prohibitions

Do not use excessive gradients, glassmorphism, neumorphism, decorative illustration, oversized radius, floating pill navigation, dense shadow stacks, saturated full-page color, vanity charts, playful motion, or visual imitation of an existing maritime vendor.
