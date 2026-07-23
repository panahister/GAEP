# Source Analysis

## Inspection summary

All repository files outside `/design` were inspected recursively. The workspace contains ten Markdown documents and one Excel workbook. No source code, PDFs, images, or additional hidden business artifacts were present in the inspected file inventory.

| Source | Category | Currency and authority | Design use |
|---|---|---|---|
| [README.md](../README.md) | Repository guide | Generic, version 1.0, July 2026; references simplified document names that do not exactly match the workspace | Reading-order context only |
| [Vision-Services-Schedules-Standalone-Final.md](../Vision%20Documents/Vision-Services-Schedules-Standalone-Final.md) | Product vision | v1.2, June 2025; broad full vision plus MVP; several details superseded by requirements | Business context, problems, audience, future direction |
| [Technical-Environment-Standalone-Final.md](../Vision%20Documents/Technical-Environment-Standalone-Final.md) | Technical constraints | v1.0, July 2026; authoritative for implementation awareness but contains open questions later resolved | Desktop SPA, MUI direction, security, timing, audit, performance |
| [requirements.md](../Requirement/requirements.md) | Functional and non-functional requirements | v1.3, 2026-07-08; most current and detailed business source | Primary functional authority |
| [personas.md](../User%20story/personas.md) | Personas and role intent | v1.0, 2026-07-08; derived from current roles | Primary persona source |
| [stories.md](../User%20story/stories.md) | User stories and acceptance criteria | v1.0, 2026-07-08; 96 stories and explicit traceability | Primary interaction and acceptance source |
| [Business Role Mapping.xlsx](../Business%20Role%20Mapping.xlsx) | Business-role mapping | One populated sheet and two blank sheets; no visible version metadata | Corroborates representative role combinations |
| [application-design.md](../Application%20Design/application-design.md) | Consolidated application design | 2026-07-08 | Feature slices, ownership, module relationships |
| [components.md](../Application%20Design/components.md) | Component/module design | 2026-07-08 | Entities, read models, module-level UI implications |
| [component-methods.md](../Application%20Design/component-methods.md) | Use-case interface design | 2026-07-08 | Supported actions and query boundaries |
| [component-dependency.md](../Application%20Design/component-dependency.md) | Dependency design | 2026-07-08 | Cross-screen data dependencies and update effects |
| [services.md](../Application%20Design/services.md) | Orchestration design | 2026-07-08 | Recalculation, report ingestion, monitor projection, apply behavior |

## Authority and duplication assessment

The requirements document is the strongest functional authority because it records later user review decisions, fixed value domains, retired IDs, deferrals, and resolved open questions. The user stories duplicate most functional requirements but add concrete acceptance behavior. The application-design files deliberately repeat the same scope as technical decomposition; they are supporting, not competing, sources.

The vision is partially outdated. Its full-vision features are strategic context rather than prototype scope. The technical document also repeats several earlier open questions and an earlier deployment target; where a current requirement resolves one, the requirement wins. The workbook is not a complete permission matrix; it only maps five business-role groups to four security roles. Its two blank sheets have no design content.

## Confirmed functional scope

The confirmed depth of Service & Schedule includes:

- Authentication, session behavior, four composable roles, and user administration.
- Service creation and maintenance with immutable Service Code, derived Draft/Active/Inactive status, validity rules, and Draft-only deactivate/reactivate.
- Multiple line studies per service on dedicated pages.
- Call sequence authoring with Port, Bound ID, Call Type, distance, ECA distance, time zone, speed, stable Position, active Sequence Number, derived transit time, and voyage aggregates.
- System-derived port segmentation on Bound changes.
- Shared Commercial, Operational, and Technical milestone schemas with editable timestamps and calculated durations.
- Inline Cycle Plan Definition and vessel rules within the service workspace, including lifecycle and overlap/frequency validations.
- Batch, single-next, and cycle-wise voyage generation, plus ad-hoc voyages and manual CVN capture.
- Unified voyage list for owned, partner, and 3rd-party feeder voyages; voyage detail and strict Planned → In-Progress → Completed lifecycle.
- Executable schedule changes exclusively through the Simulation Cockpit.
- Multiple draft scenarios, comparison, phase-in/out, chaining, CVN edit, port add/omit/unomit/reposition, milestone/distance/speed adjustment, cut-offs, recomputation, apply/discard, and admin unlock.
- Manual form and file capture of arrival, departure, and noon reports; actual recording and deviation detection.
- A read-only Schedule Monitor with baseline, actual/executable, and projected layers; variance badges; filters; zoom; Now marker; textual position and static last-known pin.
- Lightweight 3rd-party feeder schedule create/update with free-text vessel name, operator master reference, CVN, and per-port arrival/departure.
- Owned master data: Locations, Vessels, Organisations, Port Distances; bulk import; safe delete/deactivate behavior.
- Port-distance manual editing, external fetch, PROPOSED → APPROVED workflow, same-screen manual fallback, and approved-distance dependency.
- Synchronous Excel/CSV/PDF export and audit of all state-changing operations.

## Confirmed out of scope

Do not design functional screens for cost, accrual, slot cost, bunker consumption/valuation, cargo operations, bayplan reconciliation, port operations, agency cockpit, routing engine, AI route optimisation, live AIS tracking, automated report receipt, external schedule publication, automated recovery, feeder agreements/freight terms/cost/reconciliation, LTS automation, capacity modelling, Line Setting, or extra location types beyond Terminal, Port, and Canal Passage.

These may appear only as future module placeholders in the platform navigation where useful. They must not have realistic workflows, KPI claims, or clickable deep links.

## Domain terminology

| Term | Source-backed meaning for UX |
|---|---|
| Service | Parent operational definition containing line studies, inline cycle plans, and voyage management |
| Line Study | Service-linked rotation template and feasibility definition; separate data-heavy page |
| Call Sequence | Ordered calls with Position and active Sequence Number |
| Port Segmentation | Read-only segments derived when Bound ID changes |
| Bound ID | NB, SB, EB, or WB |
| Call Type | Commercial, Operational, or Technical; controls location type and milestone schema |
| CPD | Cycle Plan Definition; use the expanded name on first use in UI |
| Vessel Rule | Time-phased vessel assignment at a Cycle Position ID |
| CVN | Commercial Voyage Number; free-form and not unique |
| Voyage Number | System-generated unique reference; distinct from CVN |
| Executable voyage | The live voyage schedule changed only when a scenario is applied |
| Baseline | Planned comparison layer retained for schedule analysis |
| Scenario | DRAFT, APPLIED, or DISCARDED simulation snapshot |
| Actualize | Commit populated actual fields for a port call; departure actualization locks current and previous calls |
| Omitted port | Visible, muted, non-editable call that preserves Position and can be unomitted |
| Projected schedule | Read-only downstream propagation of a detected delta; not stored estimates |
| Feeder voyage | Separate lightweight 3rd-party entity linked to a main voyage |
| ECA Distance | Portion of route within an Emission Control Area; not a distance type |
| Distance Type | Great Circle, Rhumb Line, Navigable, or Seasonal |

## Personas and role evidence

Four role personas are explicit: Schedule Viewer (`SCHEDULE_READ`), Schedule Editor (`SCHEDULE_EDIT`), Simulation Analyst (`SIMULATION_RUN`), and Schedule Administrator (`SCHEDULE_ADMIN`). Users may combine roles; Administrator includes lower permissions.

The workbook maps High-Level Managers to Viewer; Trade & Marketing to Viewer + Editor; Operations and Line Management to Viewer + Editor + Simulation; and IT/Admin to Administrator. Finance and Customer Service appear in the vision as stakeholders but not the workbook; current personas represent them as Viewer examples rather than distinct permission roles.

## Confirmed workflows

- Define service → create line study → author call sequence → define CPD and vessel rules → generate voyages.
- Open voyage → create one or more draft scenarios → model changes → compare → apply one scenario → inspect updated executable schedule.
- Capture report → retain estimates and write actuals → detect deviation → show projected downstream layer → initiate user-led recovery scenario → apply future estimate changes.
- Create/update a feeder voyage → show it in unified list → optionally show alongside linked main voyage in the monitor.
- Fetch or manually enter a port distance → approve proposed API value → use approved value in calculations.
- Administer users, roles, thresholds, privileged unlock, and data deletion/deactivation.

## Non-functional design implications

- English-only, desktop-primary, moderately dense enterprise UI.
- Expected scale is at most 50 services and 2,000 voyages per year, with pagination capped at 100 rows.
- Read interactions should feel sub-500 ms; write/simulation feedback should resolve within about two seconds or show progress.
- All visible operational times require local port time and UTC together.
- Pessimistic edit locking requires a clear lock owner/message and no ambiguous concurrent-edit affordance.
- All state changes must expose success/failure feedback suitable for audit correlation.

## Contradictions and provisional resolution

| Conflict | Competing evidence | Package treatment |
|---|---|---|
| Standalone product vs ERP module | All source documents say standalone; current brief says module in a broader ERP | Current brief governs presentation. Use a common ERP shell; keep functional scope unchanged. Mark future modules as placeholders. |
| Accessibility | Requirements say WCAG conformance is not an MVP requirement; technical document mandates WCAG 2.1 AA and axe checks; current brief requires AA where practical | Design to WCAG 2.1 AA. This is a design-quality requirement, not a claim that MVP compliance was previously confirmed. |
| Responsive scope | Requirements say modern desktop browsers only; current brief requests tablet and narrow behavior | Desktop is fully functional. Tablet/narrow guidance preserves access and presentation but limits dense editing; mark as a design assumption. |
| Capacity modelling | Vision/MVP journey mentions it; current requirements explicitly defer it | Exclude capacity modelling from all functional screens. Vessel master capacity remains a master-data field. |
| Voyage lifecycle | Vision Definition of Done includes Confirmed; current requirements explicitly remove it | Use Planned → In-Progress → Completed only. |
| Schedule locking | Vision/technical open question; current requirements define current+previous lock after actual departure, next remains open | Use current requirement. |
| Feeder schedule structure | Earlier source leaves main-rotation vs separate entity open; current requirements define separate linked entity | Use separate linked entity with optional alongside display. |
| Static map | Vision calls live plot deferred; current requirements explicitly allow a basic static last-known pin | Include a small static location panel, never imply live AIS. |

## Incomplete design areas

Material gaps include missing report column/field definitions; undefined actualization field sets; incomplete voyage transition guards; no defined audit-log UI; undefined scenario naming/ownership and edit-lock timeout; unclear feeder-link cardinality and linking interaction; no defined organization code field despite references to business partner code; no deviation acknowledgement/resolution lifecycle; unspecified map provider; no approved brand identity; and no separate dashboard metrics. These are detailed in [16_UX_GAPS_AND_ASSUMPTIONS.md](16_UX_GAPS_AND_ASSUMPTIONS.md).

## Design-relevant decisions already made

- A service is the parent workspace; Line Study is separate; CPD and Voyage Management are inline.
- The Simulation Cockpit is the only schedule-edit route.
- Schedule Monitor is a read model and the best evidence-backed module landing experience; a decorative KPI dashboard is not warranted.
- Baseline is outline/dashed; executable/actual is solid; projected is visibly distinct and non-committed.
- Omitted ports remain visible and recoverable.
- Local and UTC time must be paired throughout.
- Feeder rows share the voyage list but use blanks or “Not applicable” for non-applicable owned/partner fields.
- Authorization is role-aware and multiple roles combine.

