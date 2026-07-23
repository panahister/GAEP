# Platform, Information Architecture, and Flow Guidelines

## Common platform shell

Authenticated screens use one stable shell:

- At 1440: `248px` left sidebar, `64px` top bar, fluid content workspace.
- Content order: Breadcrumb → Page Header → optional Banner → optional Tabs/Filter → primary working surface.
- Product: provisional `Maritime ERP`; active workspace: `Service & Schedule`; environment: `DEMO`.
- Top bar: global search with `/` hint, single organization `Oceanic Liner Operations`, DEMO, notifications, help, and profile.
- No global Create action. Creation belongs to page context.

Active Service & Schedule navigation:

- Schedule Monitor
- Services
- Voyages
- Reports
- Feeder Schedules
- Reference Data: Locations, Vessels, Organisations, Port Distances
- Administration: Deviation Thresholds, Bulk Import, Users & Roles

Future modules are a separated disabled group: Bookings & Commercial, Cargo Operations, Port Operations, Finance & Costing, Agency, Routing—each labeled `Coming later`, with no child route or interaction.

Global Search groups Services, Voyages, Vessels, and Locations. Show unique identifiers and secondary identity; CVN alone never disambiguates a voyage. Include keyboard behavior, recent/loading/no-results/service-unavailable states.

Notifications may show deviation detected, report partial import, distance awaiting approval, edit lock released, or scenario applied. Do not invent acknowledgement, subscription, assignment, or resolution lifecycles.

Profile includes name, username, friendly role badges with codes secondary, session information, Reset password, and Sign out. Organization control is single-item and must not imply multi-tenancy.

## Page and overlay behavior

- Page Header variants: List, Detail, Editor, Read-only, Locked.
- Dangerous actions are separated from primary actions.
- Detail drawer: `480–640px`; short form drawer up to `560px`; confirmation `440–520px`; generation `640–720px`.
- Overlay preserves underlying list/filter context, traps focus, and returns focus to trigger.
- Cancel never commits. Dirty navigation confirms before discard. A pending write cannot be silently dismissed.
- Use inline validation for field errors, page banner for cross-record blocker, toast for acknowledged low-risk success, and persistent progress for work longer than one second.
- Initial loading uses layout-matching skeleton; table refresh and recalculation remain localized.

## Entity and page hierarchy

- Service is the parent workspace.
- A Service has multiple Line Studies, inline CPDs, Vessel Rules nested within CPD, and generated Voyages.
- Line Study is a dedicated full page and always retains Service context.
- CPD references a preferred Line Study and is edited inline in Service Workspace.
- Vessel Rule replacement creates time-phased rows; history is not overwritten.
- Voyage opens from list, Service Workspace, Monitor, search, notification, or report result.
- Port Call opens a detail drawer; schedule-change action routes to Simulation.
- Scenario belongs to one Voyage and retains Draft/live separation until Apply.
- Port Distance blocker keeps From/To and originating task so the user can return after resolution.

## Stable route registry

- `SCR-001` Sign In: optional unauthenticated entry.
- `SCR-002` Schedule Monitor: default authenticated landing.
- `SCR-003` Services List.
- `SCR-004` Service Workspace.
- `SCR-005` Line Study Editor.
- `SCR-006` Voyage List.
- `SCR-007` Voyage Detail.
- `SCR-008` Simulation Cockpit.
- `SCR-009` Report Capture.
- `SCR-010` Feeder Schedules.
- `SCR-011` Feeder Voyage Form.
- `SCR-012` Reference Data.
- `SCR-013` Port Distances.
- `SCR-014` Deviation Thresholds.
- `SCR-015` Bulk Import.
- `SCR-016` Users & Roles.
- `SCR-017` State Showcase: internal review only, excluded from customer navigation.

## Primary flow contracts

### F-01 — Launch service and voyages

Services List → Create Service → Service Workspace → Create/Open Line Study → Call Sequence/milestones → resolve missing distance if required → Service Workspace → CPD/Vessel Rules → Generate Voyages → Voyage List/Detail. Preserve Service identity and unsaved context; missing distance returns to the exact blocked task.

### F-02 — Deviation to controlled recovery

Schedule Monitor → deviation detail → Voyage Detail or Recover in Simulation → Draft Simulation → edit future calls → recomputation/change summary → optional Compare → consequence confirmation → Apply → terminal Applied success → refreshed Schedule Monitor. Live schedule never changes before successful Apply; failed Apply preserves Draft and live data.

### F-03 — Compare scenarios

Simulation → select two or three Drafts → factual rotation/time/change comparison → return to chosen Draft → optionally Apply. No recommendation score.

### F-04 — Capture report

Reports or Voyage Detail → choose Arrival/Departure/Noon → File/Manual → Strict/Lenient for file → validate → submit → imported/skipped/errors → affected Voyage/Deviation. Strict imports none on invalid row; Lenient enumerates skipped rows; estimates remain retained.

### F-05 — Feeder voyage

Feeder Schedules → Create/Edit Feeder Voyage → operator, free-text vessel, CVN, port arrival/departure → Save → Feeder list → optional unified Voyage List/Monitor alongside. Main-voyage link remains provisional.

### F-06 — Missing Port Distance

Line Study/generation/Simulation blocker → exact Port Distance pair → manual value or external fetch → if proposal, Administrator Approve/Reject → return to originating task → recalculate. Preserve current approved value while a replacement proposal is unresolved where shown provisionally.

### F-07 — Governance

Administration or privileged contextual action → consequence review → validation → confirmation → state change with affected object/user and audited outcome.

### F-08 — Find/export Voyage

Global Search, Voyage List, or Monitor → identify by Voyage Number with CVN secondary → Voyage Detail → export → synchronous success/failure.

## Cross-screen links and state

- Service Code → Service Workspace.
- Voyage Number → Voyage Detail.
- Vessel Name → read-only Vessel detail/drawer.
- UN/LOCODE → Location detail/drawer.
- Missing distance → exact From/To pair.
- Report result → affected Voyage/Deviation.
- Apply success → updated Voyage Detail and Schedule Monitor.
- Preserve Monitor/list filters and relevant scroll/tab state on return.
- Preserve Service, Voyage, Scenario, and Port Distance identities through every transition.
- Close returns focus to launcher; dirty Back/Close asks before discard.
- Every state has a clear exit, retry, or next valid action; no dead end.

## Search and filter architecture

- Global: Service Code/Name, Voyage Number, CVN, Vessel/IMO, Location/UN/LOCODE.
- Services: code/name, trade lane, type, derived status, validity, active/deactivated.
- Voyages: voyage type, Service/Line, vessel, CVN, lifecycle, start/end, cycle, port.
- Monitor: service, vessel, type, lifecycle/health, time range; preserve state.
- Port Distances: From/To, source, approval status, distance type.
- Advanced filters are panels/drawers within lists, not standalone pages.

## Deliberate IA exclusions

Do not create separate Schedule List, direct Schedule Editor, Deviation Worklist, Audit History page, KPI Dashboard, or deep pages for future modules. The unified Voyage List, Simulation Cockpit, Monitor/Detail deviations, and optional provisional Activity pattern are the controlled alternatives.

## Customer demonstration route

Default authenticated start: Schedule Monitor with `Olivia Reed` and AEX delay. Primary story is deviation → Simulation S-03 → Compare → Apply → refreshed Monitor. Secondary story is Services → AEX Workspace → LS-02 → CPD/Generation → existing Voyage. Keep internal/admin screens and SCR-017 out of the main demo unless asked.

Normal page transitions are instant or about `150ms`; drawers/panels use restrained design-system motion. Preserve a prebuilt fallback path: Monitor deviation → S-03 changed → Apply confirmation → Applied success → refreshed Monitor.
