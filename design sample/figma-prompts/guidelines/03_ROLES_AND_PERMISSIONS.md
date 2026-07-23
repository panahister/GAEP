# Roles and Permissions Guidelines

## Access model

Use exactly four composable security roles. A user may hold multiple roles and receives the union of permissions. `SCHEDULE_ADMIN` includes all lower permissions. Do not invent departments, geographic scopes, per-field permissions, approval chains, or separation-of-duties rules.

Display friendly role names first and technical codes as secondary text.

## Schedule Viewer — `SCHEDULE_READ`

The Viewer can:

- View Schedule Monitor, Services, Voyages, Voyage Detail, Feeder Schedules, and reference data.
- Search, filter, open detail/drawers, toggle supported views, and export.
- Inspect baseline, actual/executable, projected, deviation, current/next port, last-known position, and status.

The Viewer cannot create, edit, capture reports, maintain feeder/reference data, run/apply Simulation, approve distances, unlock calls, delete/deactivate privileged records, configure thresholds/import, or administer users.

Viewer pages must feel intentionally read-only. Do not render disabled form fields as the primary experience. Hide ordinary unauthorized Create/Edit actions; where a restriction matters, show readable context and an explanation.

## Schedule Editor — `SCHEDULE_EDIT`

The Editor can:

- Create/update Services and Line Studies.
- Maintain CPDs, Vessel Rules, supported voyage creation/generation, feeder schedules, and reference data.
- Capture reports and actual inputs where specified.
- Manually maintain or fetch Port Distances.
- Export.

The Editor cannot run/apply schedule scenarios unless also assigned Simulation Analyst. The Editor cannot approve/reject fetched distance proposals, unlock locked calls, manage users, configure thresholds, bulk import, or perform Admin-only delete/deactivate actions.

If Editor permission is insufficient, explain the needed role: `You can maintain this voyage, but you need Simulation Analyst access to change its schedule.`

## Simulation Analyst — `SIMULATION_RUN`

The Simulation Analyst can:

- Create, compare, modify, discard, and apply Draft scenarios.
- Add, omit, unomit, and reposition future calls within confirmed rules.
- Adjust supported milestones, distance, speed, CVN, phase/chaining/cut-off behavior where specified.
- Initiate recovery from Schedule Monitor or Voyage Detail.

Simulation permission alone does not grant Service, Line Study, report, feeder, or reference-data editing. It cannot unlock locked historical calls without Administrator permission.

Keep `Draft scenario — executable schedule is unchanged until Apply` visible. Applied and Discarded scenarios are read-only terminal states.

## Schedule Administrator — `SCHEDULE_ADMIN`

Administrator includes all Viewer, Editor, and Simulation capabilities plus:

- Create/deactivate users and assign roles.
- Approve/reject external Port Distance proposals; self-approval is allowed.
- Unlock locked calls inside Simulation.
- Delete/deactivate records where confirmed and handle referential blockers.
- Configure deviation thresholds.
- Run supported bulk import.

Privileged actions must look consequential, name the resource/effect, and show an audited outcome. Do not add a mandatory reason unless confirmed.

## Capability matrix

| Capability | Viewer | Editor | Simulation | Administrator |
|---|:---:|:---:|:---:|:---:|
| View module data and Monitor | Yes | With Viewer in combined assignment | With Viewer in combined assignment | Yes |
| Export | Yes | With Viewer | With Viewer | Yes |
| Create/update Services, Line Studies, CPDs, voyage definitions | No | Yes | No | Yes |
| Maintain feeder/reference data | No | Yes | No | Yes |
| Capture reports | No | Yes | No | Yes |
| Run/compare/apply scenarios | No | No | Yes | Yes |
| Unlock locked call | No | No | No | Yes |
| Approve/reject fetched distance | No | No | No | Yes |
| Privileged delete/deactivate | No | No | No | Yes |
| Thresholds, bulk import, users | No | No | No | Yes |

Where implementation enforces literal role composition, operational users need Viewer together with Editor/Simulation to view normal pages. Do not silently infer read access beyond the assigned union.

## Demo role combinations

- High-Level Manager: Viewer.
- Trade & Marketing: Viewer + Editor.
- Operations and Line Management: Viewer + Editor + Simulation.
- IT/Admin: Administrator.
- Customer Service and Finance observer: Viewer representation only; no finance or customer-service workflows are added.

Default demo user: `Olivia Reed / olivia.reed`, Operations & Line Management, Viewer + Editor + Simulation. Use a separate Administrator identity for privileged variants.

## Permission-sensitive UI behavior

- Hide routine unauthorized actions to reduce clutter.
- Preserve evidence of consequential restrictions. Example: `Locked after actual departure. A Schedule Administrator can unlock this call in a scenario.`
- A Viewer gets no Create action in first-use empty states.
- Editor-only report/maintenance actions and Simulation-only recovery actions appear independently based on role union.
- Unlock appears only inside Simulation and only for Administrator.
- Port Distance Editor may fetch/manual-enter but not approve/reject fetched proposals.
- Administration routes are unavailable to non-Admin users; use a coherent no-permission page if reached directly.
- Disabled actions that block task completion include a visible or discoverable reason.
- Permission failure retains readable record context and offers a valid next step; it never clears work.
- Profile and Users & Roles show effective permissions and role union without inventing scopes.

## Unresolved permission details

Do not invent answers for:

- Exact permission to manually actualize or transition voyage lifecycle where source is incomplete.
- Whether Activity/Audit UI is Viewer-visible or Admin-only.
- Whether manual Port Distance entries need approval.
- Whether every Deactivate operation is Admin-only.
- Last-active-Administrator protection.
- Immediate session effect of role changes or deactivation.

Annotate these only on affected screens and keep the safer, non-committal prototype treatment.
