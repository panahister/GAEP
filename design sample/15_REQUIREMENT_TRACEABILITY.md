# Requirement Traceability

## Status legend

| Status | Meaning |
|---|---|
| Confirmed | Directly stated in current requirement/story evidence |
| Inferred | UX organization necessary to express confirmed behavior |
| Assumed | Provisional business-affecting or context decision requiring confirmation |
| Missing | Required detail is absent from sources |
| Contradictory | Sources compete; chosen treatment is documented |
| Not Applicable | Candidate/component intentionally excluded |

## Source-to-persona and workflow traceability

| Source area | Personas | Flows | Screens | Status |
|---|---|---|---|---|
| FR-AUTH | P1–P4, primarily P4 governance | F-07, sign-in entry | SCR-001, SCR-016, shell | Confirmed |
| FR-SVC | P1, P2, P4 | F-01 | SCR-003, SCR-004 | Confirmed |
| FR-LS-CS/SEG/CT | P2, P3 shared schema | F-01, F-02 | SCR-005, SCR-008 | Confirmed |
| FR-CYC | P2 | F-01 | SCR-004, SCR-006/007 output | Confirmed |
| FR-VOY | P1, P2 | F-01, F-08 | SCR-006, SCR-007 | Confirmed |
| FR-SCH | P2/P3/P4 | F-02, F-04 | SCR-007, SCR-008, SCR-009 | Confirmed |
| FR-SIM | P3/P4 | F-02, F-03 | SCR-008 | Confirmed |
| FR-RPT | P2/P1/P4 thresholds | F-02, F-04 | SCR-009, SCR-002, SCR-014 | Confirmed; exact report fields Missing |
| FR-MON | P1 | F-02, F-08 | SCR-002 | Confirmed |
| FR-FDR | P1/P2 | F-05 | SCR-010, SCR-011, SCR-006, SCR-002 | Confirmed; link UX Assumed |
| FR-MDM | P1/P2/P4 | F-01, F-05, F-07 | SCR-012, SCR-015 | Confirmed |
| FR-DIST | P2/P4 | F-01, F-02, F-06 | SCR-013, SCR-005, SCR-008 | Confirmed |
| FR-EXP | P1 | F-08 | SCR-003, SCR-006, SCR-007, SCR-012 | Confirmed |
| NFR-UX/NFR-DATA | All | All | All screens | Confirmed for English, local/UTC, audit data; accessibility Contradictory |

## Detailed screen traceability

| Screen | Requirements and stories | Components/interactions | States and validations | Prompt |
|---|---|---|---|---|
| SCR-001 Sign In | FR-AUTH-1/5/6; US-AUTH-1/5/6 | Login form, reset link, session-expired return | Invalid credentials, throttling/lockout, expired session | `figma-prompts/SCR-001_SIGN_IN_PROMPT.md` |
| SCR-002 Schedule Monitor | FR-MON-1…6; US-MON-1…6; FR-FDR-2 | Gantt, filters, port/deviation drawer, feeder toggle, static pin | No actual, early/late/at-risk, projected, no report, loading/error | `figma-prompts/SCR-002_SCHEDULE_MONITOR_PROMPT.md` |
| SCR-003 Services List | FR-SVC-1/3/4/5/12; US-SVC-2/3/5/6 | Search/filter/table/create/export/deactivate | Draft/Active/Inactive, deactivated, empty/loading/error, max page 100 | `figma-prompts/SCR-003_SERVICES_LIST_PROMPT.md` |
| SCR-004 Service Workspace | FR-SVC-2/6…12; FR-CYC-1…11; US-SVC-1/4/7; US-CYC-* | Header edit, tabs, CPD cards, vessel rules, generation/ad-hoc dialogs | Locked fields after voyage; validity; CPD lifecycle/formula/overlap; generation outcomes | `figma-prompts/SCR-004_SERVICE_WORKSPACE_PROMPT.md` |
| SCR-005 Line Study Editor | FR-LS-*; US-LS-1…12 | Editable sequence, port selector, milestone editor, totals, segmentation | Missing distance, type/location mismatch, chronology, dirty/saving, omitted numbering | `figma-prompts/SCR-005_LINE_STUDY_EDITOR_PROMPT.md` |
| SCR-006 Voyage List | FR-VOY-1/2/6/7; US-VOY-1/2; FR-EXP | 14-field table, filters, columns, pagination, export | Planned/In-Progress/Completed; owned/partner/feeder; N/A fields; duplicate CVN | `figma-prompts/SCR-006_VOYAGE_LIST_PROMPT.md` |
| SCR-007 Voyage Detail | FR-VOY-2/5; FR-SCH-1/5/6; US-VOY-5; US-SCH-1/4 | Summary, rotation, local/UTC, deviation/position, create scenario, export | Locked calls, no actuals, deviation, lifecycle, activity assumption | `figma-prompts/SCR-007_VOYAGE_DETAIL_PROMPT.md` |
| SCR-008 Simulation Cockpit | FR-SIM-1…13/15; FR-SCH-1…8; US-SIM-* | Scenario rail, timeline/grid, inspector, phase/add/omit/reorder/cut-off, compare/apply | Draft/Applied/Discarded, edit lock, locked calls, missing distance, recalculation, apply failure | `figma-prompts/SCR-008_SIMULATION_COCKPIT_PROMPT.md` |
| SCR-009 Report Capture | FR-RPT-1…6; US-RPT-1…7 | Type/source stepper, strict/lenient, upload/manual, preview/result | Strict failure, partial import, unmatched rows, duplicate behavior Missing | `figma-prompts/SCR-009_REPORT_CAPTURE_PROMPT.md` |
| SCR-010 Feeder Schedules | FR-FDR-1…4; US-FDR-2/4/5 | Search/filter/table/create/open | Empty/loading/error, linked/unlinked, updated | `figma-prompts/SCR-010_FEEDER_SCHEDULES_PROMPT.md` |
| SCR-011 Feeder Voyage Form | FR-FDR-1a/3; US-FDR-1…3 | Minimal header, port-call table, operator selector | Required fields, chronology, link behavior Assumed | `figma-prompts/SCR-011_FEEDER_VOYAGE_FORM_PROMPT.md` |
| SCR-012 Reference Data | FR-MDM-1…6; US-MDM-1…7 | Tabs, list/detail, create/edit/deactivate/delete/export | Unique keys, referenced delete blocker, deactivated, vessel name history | `figma-prompts/SCR-012_REFERENCE_DATA_PROMPT.md` |
| SCR-013 Port Distances | FR-DIST-1…5d; US-DIST-1…5 | Editable table, API fetch, proposal drawer, approve/reject, fallback | One pair, units/type, Proposed/Approved, API timeout | `figma-prompts/SCR-013_PORT_DISTANCES_PROMPT.md` |
| SCR-014 Thresholds | FR-RPT-4; US-RPT-5 | Default threshold, per-location overrides | Inherited default, separate early/delay, units Missing | `figma-prompts/SCR-014_DEVIATION_THRESHOLDS_PROMPT.md` |
| SCR-015 Bulk Import | FR-MDM-5; US-MDM-5/6 | Upload/preview/validate/commit stepper | Format Missing, row errors, completed/partial behavior Assumed | `figma-prompts/SCR-015_BULK_IMPORT_PROMPT.md` |
| SCR-016 Users & Roles | FR-AUTH-2…6; US-AUTH-2…6 | User table, create/edit roles, deactivate, reset | Active/deactivated, union, password policy, lockout/session | `figma-prompts/SCR-016_USERS_AND_ROLES_PROMPT.md` |
| SCR-017 State Showcase | Current brief; cross-screen acceptance criteria | Component state matrices | Empty/loading/error/success/locked/partial/no permission | `figma-prompts/SCR-017_STATE_SHOWCASE_PROMPT.md` |

## Requirement-to-interaction and validation traceability

| Requirement/rule | Interaction representation | Validation/state | Status |
|---|---|---|---|
| Service Code immutable | Create field then read-only identity in workspace | Cannot enter edit mode after creation | Confirmed |
| Service status derived | Read-only chip and explanation | Draft/Active/Inactive computed; activation flag separate | Confirmed + Inferred display |
| Draft-only deactivate | Admin action shown only for Draft | Hidden/disabled with reason for Active/Inactive | Confirmed |
| Position vs Sequence | Two table columns and helper | Omit/unomit preserves Position and renumbers Sequence | Confirmed |
| Call Type ↔ Location Type | Filter Port selector based on Call Type | Reject mismatch with explicit message | Confirmed |
| Distance ÷ speed | Read-only Transit Time | Speed >0; approved distance required | Confirmed |
| Milestone schema | Type-specific drawer | Only milestone timestamps editable; durations calculated | Confirmed |
| CPD validity non-overlap | Inline CPD date range | Block save and name conflicting CPD | Confirmed; message format Inferred |
| Duration = vessels × frequency | Live equation helper | Integer values; block save if unequal | Confirmed |
| One active service per vessel | Availability in Vessel selector | Block selection/phase-in and identify conflict | Confirmed |
| Direct schedule edit prohibited | No edit control on Voyage Detail | Create Scenario is only route | Confirmed |
| Pessimistic lock | Edit-lock banner | Block second editor; release timing Missing | Confirmed + Missing detail |
| Actual departure lock | Actualize confirmation | Lock current+previous; next open | Confirmed |
| Scenario terminal after Apply | Applied read-only state | No reuse/edit/reapply | Confirmed |
| Report strict/lenient | Required mode choice before upload | Strict all-or-none; lenient partial summary | Confirmed |
| Projection non-committed | Patterned layer and label | Never writes estimates until Apply | Confirmed |
| Port Distance proposal | Proposal drawer and Admin action | Proposed cannot be used; Approved can | Confirmed |
| Referenced master data deletion | Delete check/result | Block and offer Deactivate | Confirmed |
| Local + UTC | Time-pair component everywhere | Consistent ordering and labels | Confirmed |

## Prototype flow traceability

| Prototype moment | Flow | Screens | Evidence status |
|---|---|---|---|
| Monitor delayed voyage | F-02 | SCR-002 | Confirmed |
| Open projected impact | F-02 | SCR-002/007 | Confirmed |
| Create and change draft | F-02 | SCR-008 | Confirmed |
| Compare drafts | F-03 | SCR-008 | Confirmed |
| Apply and refresh | F-02 | SCR-008 → SCR-002 | Confirmed |
| Inspect service foundation | F-01 | SCR-003/004/005 | Confirmed |
| Resolve missing distance | F-06 | SCR-013 | Confirmed |
| Common ERP shell | Presentation brief | All | Assumed relative to source; governing current design context |

## Not applicable / deferred traceability

| Candidate | Evidence | Status |
|---|---|---|
| Schedule publication UI/status | Explicitly deferred | Not Applicable |
| Approval workflow for scenario/schedule | No evidence | Not Applicable |
| Cost/capacity/cargo/routing dashboards | Explicitly deferred or missing | Not Applicable |
| Live AIS map | Deferred | Not Applicable |
| Separate module dashboard metrics | No metric definitions | Not Applicable |
| Audit history UI | Audit data only; no UI requirement | Missing / Optional |

