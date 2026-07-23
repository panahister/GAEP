# Product Design Brief

## Module purpose

Service & Schedule is the operational planning and schedule-control module of a broader maritime ERP presentation. It provides a single working context for defining liner services, modelling rotations, generating voyages, tracking execution, recording actuals, detecting deviations, and safely applying schedule recovery decisions.

## Business context

The source problem is fragmented schedule maintenance across spreadsheets and disconnected tools. Operational teams cannot reliably compare plan with execution, propagate changes, or understand downstream effects. Line management performs feasibility work manually, and schedule deviations become reactive. The module's core value is controlled, traceable schedule intelligence rather than a collection of forms.

## Prototype objective

Produce a high-fidelity, clickable prototype that an international customer can perceive as a near-production enterprise product. It must demonstrate both planned-service creation and live-operational recovery without claiming deferred automation or unrelated ERP features.

## Presentation audience

- Executive and senior customer stakeholders assessing platform credibility.
- Line management and operations teams assessing feasibility and recovery workflows.
- Trade and marketing users assessing service definition.
- IT, administration, and data-governance stakeholders assessing control, permissions, and auditability.
- Customer service and finance observers assessing schedule visibility; no finance workflow is shown.

## Design scope

In depth: ERP shell integration; login and role-aware access; Schedule Monitor; services; service workspace; line studies; call sequence and milestones; cycle plans and vessel rules; voyage generation; unified voyage list and detail; Simulation Cockpit; report capture; deviations and recovery entry; feeder voyages; operational master data; port-distance approval; thresholds; user administration; imports; exports; major states and feedback.

The common shell includes credible global navigation, organization context, search, notifications, help, profile, breadcrumbs, and placeholders for future ERP modules. Only Service & Schedule and its required operational reference/admin surfaces are functional.

## Out of scope

- Cost, revenue, accrual, bunker, tariffs, contracts, invoicing, or finance calculations.
- Cargo, booking, bayplan, port-operations, agency, routing, capacity-optimisation, or regulatory workflows.
- AI route optimisation, live AIS, automated external reports, or external schedule publication.
- A separate free-standing schedule editor; executable schedules change only through simulation.
- A decorative dashboard with unsupported metrics.
- Detailed mobile editing of data-dense call sequences or scenario comparisons.

## Primary users

1. **Schedule Viewer:** read-only operational visibility and export.
2. **Schedule Editor:** service, line-study, cycle-plan, voyage, report, feeder, master-data, and distance maintenance.
3. **Simulation Analyst:** scenario creation, comparison, recovery, and apply.
4. **Schedule Administrator:** all lower permissions plus users, deletion, approvals, privileged unlock, threshold configuration, and bulk import.

Operational and Line Management demonstration accounts should combine Viewer + Editor + Simulation. Admin demonstrations should use the Administrator role.

## Primary workflows

- Launch a service and generate its first voyages.
- Find and inspect a voyage from a unified operational list.
- Detect a delayed call in the monitor, inspect planned vs actual, and see projected impact.
- Open a recovery scenario, omit or reposition a future port, adjust speed/milestones, review recomputation, and apply.
- Capture a report in strict or lenient mode and review ingestion feedback.
- Maintain/approve a missing port-pair distance and return to the blocked workflow.
- Create a lightweight feeder voyage and optionally display it alongside a main voyage.

## Key operational entities

Service, Line Study, Call Sequence Entry, Port Segment, Cycle Plan Definition, Vessel Rule, Voyage, Port Call, Simulation Scenario, Report, Deviation, Feeder Voyage, Location, Vessel, Organisation, Port Distance, User, Role, and Audit Event.

## Value proposition

- One controlled path for schedule change, with explicit draft-versus-live separation.
- Immediate plan-versus-execution visibility and exception recognition.
- Reusable service/rotation definitions that produce voyages consistently.
- Role-aware governance for sensitive operations.
- Traceable decisions and applied changes.
- Operational continuity inside an extensible maritime ERP shell.

## Design challenges

- Show dense call and milestone data without forcing an unscannable wide table.
- Keep baseline, actual, and projected times conceptually distinct.
- Make simulation powerful without turning it into an opaque spreadsheet.
- Expose two numbering systems—Position and Sequence Number—without confusion.
- Represent service status separately from deactivate/reactivate state.
- Present local and UTC times without doubling visual noise.
- Preserve role restrictions without making read-only users feel they are in a broken UI.
- Respect source deferrals despite an ambitious full vision.

## Usability goals

- A Viewer identifies a delayed voyage and next affected port within 30 seconds.
- An Editor can understand why a voyage generation or schedule operation is blocked and how to resolve it.
- A Simulation Analyst can distinguish live, draft, applied, and projected data at all times.
- A customer can follow the main demo without domain explanation at every click.
- No critical action is represented only by color, icon, or hover.

## Quality attributes

Clarity, precision, traceability, restraint, high information density, predictable state, accessible interaction, quick scanability, resilient feedback, responsive continuity, and implementability.

## Prototype success criteria

- The broader ERP shell is credible but does not over-promise future modules.
- The default module view answers an operational question; it is the Schedule Monitor, not an invented KPI dashboard.
- The primary deviation-to-recovery demo has no dead end.
- The service-to-voyage planning path is fully clickable at key steps.
- Every core screen uses realistic English maritime content and consistent local/UTC times.
- Role restrictions are visible and source-aligned.
- Apply, actualize, delete/deactivate, approve, and unlock actions have confirmations and outcomes.
- Empty, loading, error, locked, partial-success, and success states are represented.
- Desktop presentation is polished at 1440 px and remains coherent at 1280 px.
- Tablet and narrow designs provide safe viewing and limited task completion without pretending dense editing is ideal.

