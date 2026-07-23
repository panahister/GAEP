# User Flow and Routing Prompt

Using the complete persistent guideline bundle—especially `03_ROLES_AND_PERMISSIONS.md` and `06_PLATFORM_IA_AND_FLOW_RULES.md`—and the existing Platform Shell, establish the application route map and interaction contract for the Service & Schedule prototype. Do not redesign the shell and do not attempt to generate all detailed screens in this step.

Create stable application routes for these supported screens:

| Screen | Route purpose |
|---|---|
| SCR-001 Sign In | Optional unauthenticated entry |
| SCR-002 Schedule Monitor | Default authenticated landing page |
| SCR-003 Services List | Find, filter, create, and open services |
| SCR-004 Service Workspace | Service detail, line studies, CPDs, vessel rules, and generated voyages |
| SCR-005 Line Study Editor | Dedicated line-study authoring |
| SCR-006 Voyage List | Unified mainliner and feeder voyage list |
| SCR-007 Voyage Detail | Voyage identity, lifecycle, calls, actuals, and deviation context |
| SCR-008 Simulation Cockpit | Draft recovery scenarios, comparison, and Apply |
| SCR-009 Report Capture | Arrival, departure, and noon-report capture |
| SCR-010 Feeder Schedules | Feeder voyage list |
| SCR-011 Feeder Voyage Form | Create or edit a feeder voyage |
| SCR-012 Reference Data | Locations, vessels, and organisations entry point |
| SCR-013 Port Distances | Ordered-pair distance management and approval |
| SCR-014 Deviation Thresholds | Administrator configuration |
| SCR-015 Bulk Import | Supported bulk-import workflow |
| SCR-016 Users & Roles | User and role administration |
| SCR-017 State Showcase | Internal design-review route only; exclude from customer navigation |

If a detailed screen has not yet been generated, use a minimal route placeholder carrying only the screen ID, title, breadcrumb, and `Screen not generated yet` status. Each later `SCR-###` prompt must replace its matching placeholder without changing the route contract or shared shell.

Implement these end-to-end flow contracts:

## F-01 — Launch a service and generate voyages

Services List → Create service → Service Workspace → create/open Line Study → author Call Sequence and milestones → resolve missing Port Distance when required → return to Service Workspace → create CPD and vessel rules → generate voyages → inspect generated voyage in Voyage List or Voyage Detail.

Preserve the Service ID, entered data, and return location across the flow. Missing distance opens the exact ordered pair and returns to the blocked task after resolution.

## F-02 — Detect and recover from a deviation

Schedule Monitor → select deviation badge → deviation detail → Voyage Detail or direct `Recover in Simulation` → Draft Simulation → edit open/future calls → review recalculation and change summary → optionally Compare → confirm Apply → Applied success → refreshed Schedule Monitor.

The live executable schedule must not change before Apply succeeds. Applied and Discarded scenarios are terminal. Preserve the Draft when validation or Apply fails.

## F-03 — Compare scenarios

Simulation Cockpit → Compare → select two or three Draft scenarios → show factual differences only → return to chosen Draft → optionally Apply. Do not generate an automatic recommendation or ranking formula.

## F-04 — Capture a report

Reports or Voyage Detail → Capture report → choose report type and File/Manual mode → validate → submit → review imported/skipped/errors → open affected Voyage Detail or Schedule Monitor deviation.

Strict failure imports nothing. Lenient partial success enumerates skipped rows. Do not overwrite retained estimates with report actuals.

## F-05 — Create a feeder voyage

Feeder Schedules → Create feeder voyage → enter operator, free-text vessel name, CVN, and port calls → Save → return to Feeder Schedules → optionally inspect it in unified Voyage List or alongside Monitor.

Treat the main-voyage link behavior as provisional until confirmed.

## F-06 — Resolve a missing port distance

Contextual blocker or Port Distances → open exact From/To pair → fetch API proposal or enter manually → if API proposal, approve/reject with Administrator permission → return to originating Line Study, generation, or Simulation task → recalculate.

Preserve the originating task and provide a manual fallback when the API is unavailable.

## F-07 — Govern access and privileged actions

Administration or contextual privileged action → review consequence → validate → confirm → show affected object/user and audited outcome. Apply role, lock, approval, deactivation, and delete restrictions from Guidelines and screen specifications.

## F-08 — Find and export a voyage

Global Search, Voyage List, or Schedule Monitor → identify by Voyage Number with CVN secondary → Voyage Detail → export supported representation → show download success or recoverable failure.

## Navigation and state rules

- Successful sign in lands on SCR-002. Sign out returns to SCR-001.
- Sidebar destinations use the route map above; future modules remain disabled.
- Breadcrumbs return to the correct parent without losing the working identity.
- Close returns focus to the launching control. Cancel never commits changes.
- Back or Close from a dirty editor asks for confirmation before discarding work.
- Preserve filters and scroll position when returning to Monitor, Services List, Voyage List, and Feeder Schedules.
- Use consequence-specific confirmations for Apply, Actualize, Unlock, Approve, Deactivate, Delete, and Discard.
- Permission-denied and lock-denied states explain the restriction and retain readable context.
- Ensure every primary action has a success path, validation path, recoverable failure path, and clear next action.

Do not add business functionality while establishing routes. The screen-specific prompts and matching specifications remain authoritative for page content.
