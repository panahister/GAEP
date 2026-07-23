# Personas and Access

## Access model

The confirmed model has four roles. A user may hold multiple roles and receives the union of permissions. `SCHEDULE_ADMIN` includes all lower permissions. The design must not invent per-field permission variants beyond these rules.

The source personas are security-role personas rather than four mutually exclusive job titles. Demonstration accounts should combine roles to reflect real jobs.

## P1 — Schedule Viewer (`SCHEDULE_READ`)

**Representative roles:** High-Level Manager, Customer Service, Finance observer, Trade & Marketing observer.

- **Responsibilities:** Monitor services and voyages, answer status/ETA questions, inspect planned vs actual, export data.
- **Goals:** Find a voyage fast; identify next port and schedule health; understand exceptions without changing records.
- **Key tasks:** Use Monitor; search/filter voyages; open details; view feeder schedules and reference data; export.
- **Information needs:** Voyage Number + CVN, service, vessel, current/next port, planned/actual/projected times, deviation magnitude, last-known position, lifecycle.
- **Expected frequency:** Daily for operational viewers; weekly/on-demand for management observers.
- **Primary screens:** Schedule Monitor, Voyage List, Voyage Detail, Services List/Workspace read-only.
- **Available actions:** View, filter, search, open detail, toggle feeder-alongside, export.
- **Restrictions:** No create, edit, simulation, report upload, distance approval, delete, unlock, or user administration.
- **UX concerns:** Read-only must feel purposeful, not like a disabled form. Avoid exposing controls that will always fail.

## P2 — Schedule Editor (`SCHEDULE_EDIT`)

**Representative roles:** Operations Officer, Trade & Marketing service setup, master-data maintainer.

- **Responsibilities:** Maintain operational definitions and actual inputs.
- **Goals:** Move from service setup to generated voyages without spreadsheets; keep reference data and reports current.
- **Key tasks:** Create/update services and line studies; author call sequence; maintain CPDs and vessel rules; generate voyages; capture reports; maintain feeder schedules and reference data; fetch/manual-enter distances.
- **Information needs:** Field editability, validation dependencies, approved distances, CPD lifecycle, vessel availability, report-row outcomes.
- **Expected frequency:** Daily, high frequency.
- **Primary screens:** Services, Service Workspace, Line Study, Voyages, Report Capture, Feeder Form, Reference Data, Port Distances.
- **Available actions:** Supported create/update operations, report capture, exports. Schedule editing itself requires `SIMULATION_RUN`.
- **Restrictions:** Cannot delete, approve proposed distances, unlock locked calls, manage users, configure thresholds, or run/apply scenarios unless also assigned Simulation Analyst.
- **UX concerns:** Combined-role boundaries must be explicit. Blockers must include a clear resolution path.

## P3 — Simulation Analyst (`SIMULATION_RUN`)

**Representative roles:** Line Manager, Operations Planner, feasibility analyst.

- **Responsibilities:** Safely model and apply schedule decisions.
- **Goals:** Compare alternatives, understand downstream change, and update the executable schedule with traceability.
- **Key tasks:** Create/compare/discard scenarios; phase vessels; chain voyages; edit CVN; add/omit/unomit/reposition calls; adjust milestones/distance/speed; configure cut-offs; apply; initiate recovery from deviation.
- **Information needs:** Baseline/live reference, changed fields, recalculated schedule, locked calls, conflicts, scenario owner/time, change summary, apply consequence.
- **Expected frequency:** Event-driven, several times weekly or during disruption.
- **Primary screens:** Voyage Detail, Simulation Cockpit, Schedule Monitor.
- **Available actions:** Run and apply scenarios, actuals maintenance/actualization where supported.
- **Restrictions:** Cannot unlock locked calls without Administrator; does not gain service/master-data editing unless also Editor.
- **UX concerns:** Prevent confusion between DRAFT and live. Maintain an always-visible scenario state and stable comparison legend.

## P4 — Schedule Administrator (`SCHEDULE_ADMIN`)

**Representative roles:** IT/System Administrator, Operations Lead, Data Governance Owner.

- **Responsibilities:** Govern users, reference-data integrity, privileged corrections, thresholds, import, and deletion.
- **Goals:** Keep access and sensitive changes controlled and auditable.
- **Key tasks:** Create/deactivate users; assign roles; approve/reject fetched distances; unlock locked calls; deactivate/delete where permitted; configure thresholds; bulk import.
- **Information needs:** Who performed an action, affected record, validation/referential blockers, proposal source, privilege consequence.
- **Expected frequency:** Weekly and event-driven; daily for operational lead variants.
- **Primary screens:** Users & Roles, Port Distances, Deviation Thresholds, Bulk Import, Simulation privileged state.
- **Available actions:** All supported actions from all roles.
- **Restrictions:** No source-supported second-person approval or separation-of-duties rule. Self-approval of fetched distance is explicitly allowed.
- **UX concerns:** Privileged actions must not look routine; confirmations must name the resource and effect.

## Business-role mapping

| Business role | Confirmed role combination | Source |
|---|---|---|
| High-Level Managers | Viewer | Workbook |
| Trade & Marketing Team | Viewer + Editor | Workbook |
| Operations Team | Viewer + Editor + Simulation | Workbook |
| Line Management Team | Viewer + Editor + Simulation | Workbook |
| IT / Admin | Administrator | Workbook; Administrator includes lower rights per requirements |
| Customer Service Team | Viewer representation | Vision/personas; not in workbook |
| Finance Team | Viewer representation | Vision/personas; no finance functions in scope |

## Capability matrix

| Capability | Viewer | Editor | Simulation Analyst | Administrator |
|---|:---:|:---:|:---:|:---:|
| View module data and Monitor | Yes | Yes* | Yes* | Yes |
| Export | Yes | Yes* | Yes* | Yes |
| Create/update services, line studies, CPDs, voyages | No | Yes | No | Yes |
| Maintain feeder and reference data | No | Yes | No | Yes |
| Capture reports | No | Yes | No | Yes |
| Run/apply scenarios | No | No | Yes | Yes |
| Unlock locked port call | No | No | No | Yes |
| Approve/reject proposed distance | No | No | No | Yes |
| Delete/deactivate privileged records | No | No | No | Yes |
| Configure thresholds/import/users | No | No | No | Yes |

`*` Users need the Viewer role as part of their combined assignment if the implementation enforces roles literally. The source business mapping gives operational Editor/Simulation users Viewer as well.

## Permission-sensitive design behavior

- Hide ordinary unauthorized creation actions to reduce clutter.
- Show protected state explanations where they matter: a locked call tells non-admin users “Locked after actual departure. A Schedule Administrator can unlock for correction.”
- Display roles in the profile menu and Users table using friendly names, with technical codes in secondary text.
- When a combined role is required, explain it plainly: “You can maintain this voyage, but you need Simulation Analyst access to change its schedule.”
- Never imply that an Editor can approve a proposed API distance; manual entries are usable according to the approved-distance rule only once their status behavior is confirmed.

## Confirmed vs inferred access

**Confirmed:** four roles, role union, Administrator superset, major capability assignments, admin-only unlock/delete/users/approval/import/thresholds, and Viewer read/export.

**Inferred for prototype:** role-aware hiding, friendly names, combined-role explanation, and displaying role badges in profile. These are usability treatments, not new authorization logic.

**Unresolved:** whether manual port-distance entries require an explicit APPROVED status, exact access to manual actualization, who may transition voyage lifecycle, and whether audit history is visible to all or only administrators.

