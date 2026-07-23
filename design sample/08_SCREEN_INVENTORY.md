# Screen Inventory

## Classification rules

- **Core Prototype:** necessary to demonstrate the primary planning or operational value proposition.
- **Supporting Prototype:** required for credibility, source coverage, administration, or alternate journey, but not central to the default customer path.
- **Optional:** valuable only after an unresolved decision.
- **Placeholder:** shell context without functional depth.
- **Not Required:** unsupported, redundant, or explicitly replaced by another interaction.

## Authoritative inventory

| ID | Screen | Purpose | Primary persona | Source requirements | Main entities/actions | Major components/states | Class | Prompt | Presentation path |
|---|---|---|---|---|---|---|---|---|:---:|
| SCR-001 | Sign In | Authenticate and establish secure session | All | FR-AUTH-1/5/6 | User; sign in, reset password | Login card, error, lockout, expired session | Supporting Prototype | `SCR-001_SIGN_IN_PROMPT.md` | Yes |
| SCR-002 | Schedule Monitor | Read-only operational landing with plan vs execution | Viewer | FR-MON-1…6, FR-FDR-2 | Voyage, Port Call, Deviation; filter, inspect, recover entry, feeder toggle | Gantt, variance badge, static pin, baseline/actual/projected, empty/error | Core Prototype | `SCR-002_SCHEDULE_MONITOR_PROMPT.md` | Yes |
| SCR-003 | Services List | Find, filter, create, and open services | Editor/Viewer | FR-SVC-1…5/12 | Service; create, view, export | Table, derived status, activation state, filters | Core Prototype | `SCR-003_SERVICES_LIST_PROMPT.md` | Yes |
| SCR-004 | Service Workspace | Maintain service plus inline CPD, vessel rules, voyage management | Editor | FR-SVC-6…12, FR-CYC-1…11 | Service, CPD, Vessel Rule, Voyage; edit, deactivate, generate, ad-hoc | Header form, tabs/sections, editable tables, lifecycle, blockers | Core Prototype | `SCR-004_SERVICE_WORKSPACE_PROMPT.md` | Yes |
| SCR-005 | Line Study Editor | Author call sequence, milestones, totals, and derived segmentation | Editor | FR-LS-1…5, FR-LS-CS, FR-LS-SEG, FR-LS-CT | Line Study, Call Sequence, Port Segment; add/reorder, edit, fetch distance | Dense editable grid, milestone drawer, totals, validation, unsaved state | Core Prototype | `SCR-005_LINE_STUDY_EDITOR_PROMPT.md` | Yes |
| SCR-006 | Voyage List | Unified list of owned, partner, and feeder voyages | Viewer | FR-VOY-1/2/6/7, FR-EXP | Voyage; filter, inspect, export | 14-field customizable table, type filter, pagination | Core Prototype | `SCR-006_VOYAGE_LIST_PROMPT.md` | Yes |
| SCR-007 | Voyage Detail | Inspect identity, lifecycle, rotation, plan/actual, deviations, activity | Viewer | FR-VOY-2/5, FR-SCH, FR-MON | Voyage, Port Call; transition if authorized, create scenario, export | Summary, rotation table/timeline, detail drawer, local/UTC | Core Prototype | `SCR-007_VOYAGE_DETAIL_PROMPT.md` | Yes |
| SCR-008 | Simulation Cockpit | Model, compare, and apply the only allowed schedule changes | Simulation Analyst/Admin | FR-SIM-1…13/15, FR-SCH-1…8 | Scenario, Voyage, Port Call; all modelling/apply/unlock actions | Scenario tabs, grid/timeline, inspector, change summary, compare state | Core Prototype | `SCR-008_SIMULATION_COCKPIT_PROMPT.md` | Yes |
| SCR-009 | Report Capture | Capture arrival/departure/noon reports via file or manual form | Editor | FR-RPT-1…6 | Report, Actuals, Deviation; upload/enter, strict/lenient, submit | Stepper, file preview, result summary, field-schema pending note | Core Prototype | `SCR-009_REPORT_CAPTURE_PROMPT.md` | Optional branch |
| SCR-010 | Feeder Schedules | Find and manage lightweight third-party feeder voyages | Editor/Viewer | FR-FDR-1…4 | Feeder Voyage; create, view, update | Table, main-voyage link, operator filter, empty state | Supporting Prototype | `SCR-010_FEEDER_SCHEDULES_PROMPT.md` | Fallback |
| SCR-011 | Feeder Voyage Form | Create/update minimal feeder rotation | Editor | FR-FDR-1a/3 | Feeder Voyage, Feeder Port Call; add/reorder, save | Header form, editable port-call table, chronology validation | Supporting Prototype | `SCR-011_FEEDER_VOYAGE_FORM_PROMPT.md` | Fallback |
| SCR-012 | Reference Data Workspace | Maintain Locations, Vessels, Organisations | Editor/Admin | FR-MDM-1…6 | Location, Vessel, Organisation; CRUD/deactivate/export | Tabs, list-detail drawers, history, referential blockers | Supporting Prototype | `SCR-012_REFERENCE_DATA_PROMPT.md` | No |
| SCR-013 | Port Distance Table | Maintain, fetch, approve, and resolve required distances | Editor/Admin | FR-DIST-1…5d | Port Distance; manual entry, fetch, approve/reject | Editable table, source/status, API failure fallback | Core Prototype | `SCR-013_PORT_DISTANCES_PROMPT.md` | Yes, contextual |
| SCR-014 | Deviation Thresholds | Configure default and per-location early/delay thresholds | Admin | FR-RPT-4 | Threshold; create/update | Default card, editable table, inherited values | Supporting Prototype | `SCR-014_DEVIATION_THRESHOLDS_PROMPT.md` | No |
| SCR-015 | Bulk Import | Import ongoing master-data updates | Admin | FR-MDM-5 | Import Job; upload, map/validate, commit | Stepper, preview, row errors, summary | Supporting Prototype | `SCR-015_BULK_IMPORT_PROMPT.md` | No |
| SCR-016 | Users & Roles | Provision, assign roles, deactivate accounts | Admin | FR-AUTH-2…6 | User, Role; create, assign, deactivate, reset | User table, role matrix drawer, session/account state | Supporting Prototype | `SCR-016_USERS_AND_ROLES_PROMPT.md` | No |
| SCR-017 | State Showcase | Review cross-screen empty, loading, error, locked, partial-success patterns | Designer/reviewer | NFR-UX, source acceptance states, current brief | Components only | State matrix and component variants | Supporting Prototype | `SCR-017_STATE_SHOWCASE_PROMPT.md` | No |

## Candidate assessment

| Candidate from brief | Decision | Rationale |
|---|---|---|
| Common ERP shell | Required; specified separately | Governing presentation context |
| Module dashboard | Not Required | No confirmed decision-grade KPIs. Schedule Monitor is the evidence-backed landing screen. |
| Service list/details | Required | SCR-003 and SCR-004 |
| Schedule list | Not Required as a separate page | Unified Voyage List is the supported schedule index. |
| Schedule calendar/timeline | Required | SCR-002 Gantt/timeline; no calendar view is added without an operational question. |
| Schedule details | Required | SCR-007 |
| Create/edit schedule | Not Required as direct editor | Explicitly prohibited; SCR-008 Simulation Cockpit is the exclusive path. |
| Voyage/port-call sequence | Required | SCR-005 for template authoring; SCR-007/008 for executable/scenario views. |
| Conflict/exception handling | Embedded, no separate screen | Deviation drawer + projected layer + recovery entry in SCR-002/007/008. No deviation lifecycle supports a worklist. |
| Advanced search and filters | Embedded, no separate screen | Filter panels in SCR-002/003/006/010/013. |
| Version or audit history | Optional / Deferred | Audit data is confirmed, but no UI, permissions, or retention interaction is specified. Include a compact Activity section only as an assumption in detail screens. |
| Empty/loading/error showcase | Required supporting screen | SCR-017 plus per-screen variants. |
| Clickable customer-demo flow | Required plan, not a screen | Defined in `14_PROTOTYPE_AND_PRESENTATION_PLAN.md`. |

## Prototype totals

- Core Prototype screens: **9**.
- Supporting Prototype screens: **8**.
- Screen specifications required: **17**, plus the template.
- Persistent Figma Make context: **1** Master `Guidelines.md` plus **7** detailed guideline files.
- Screen-specific Figma Make prompts required: **17**.
- Cross-screen action prompts required: Platform Shell, User Flow and Routing, and Final Flow Integration.
