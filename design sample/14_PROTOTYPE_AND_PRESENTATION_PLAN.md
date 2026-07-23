# Prototype and Client Presentation Plan

## Presentation narrative

Tell one connected story: the ERP provides stable enterprise context; Service & Schedule gives an operations team immediate visibility; a real deviation is recognized; a planner models recovery without touching the live schedule; the chosen scenario is applied with traceability; the monitor reflects the updated plan. A shorter planning segment then shows how services, line studies, cycle plans, and voyages form the operational foundation.

## Recommended starting screen

Start on **SCR-002 Schedule Monitor** already authenticated as `Olivia Reed — Operations & Line Management` with Viewer + Editor + Simulation roles. The shell should be fully visible. If the customer expects authentication evidence, begin with SCR-001 for 20–30 seconds, then land on the Monitor.

## Primary clickable flow — deviation to controlled recovery

1. **Schedule Monitor:** establish the common shell, active Service & Schedule module, filtered date range, timeline layers, and fictional Arabian Express service.
2. Click the `+11 h Late` badge on voyage `VOY-2026-0148 / AEX-071W` at Sohar.
3. **Deviation drawer:** show retained baseline, actual departure, downstream projected layer, and `Recover in Simulation`.
4. **Voyage Detail:** optional 30-second inspection of identity, lifecycle, port rotation, local/UTC time, current call, and static last-known location. Select `Create recovery scenario`.
5. **Simulation Cockpit:** emphasize Draft banner and live/baseline separation. Show Scenario S-03, locked historical calls, open future calls, and current change summary.
6. Omit Aqaba or reposition a future call using a prewired interaction; show Position preserved, Sequence Number recomputed, downstream times recalculated, and `Changed` markers.
7. Open Compare and briefly compare S-02 vs S-03 factually; return to S-03.
8. Click Apply; show consequence-specific confirmation naming 5 affected future calls and other drafts retained.
9. Show success state: S-03 becomes Applied and terminal; link `View updated schedule`.
10. Return to **Schedule Monitor:** actual/executable layer is updated, projected layer resolves against the new plan, and the shell remains unchanged.

## Secondary clickable flow — service planning credibility

1. Open **Services List** and select `AEX — Arabian Express`.
2. In **Service Workspace**, point out derived Active status, immutable Service Code, Line Studies, inline Cycle Plan Definitions, vessel rules, and generated voyages.
3. Open `LS-02 Westbound Summer Rotation` in **Line Study Editor**.
4. Show Call Sequence, stable Position vs active Sequence Number, Call Type, distance/speed/transit, local/UTC milestones, aggregate band, and derived Segmentation.
5. Return to Service Workspace; open CPD 1 and show Final/Locked behavior. Open the Generation dialog but do not execute a new write in the main demo.
6. Optional: click a missing-distance sample to show the contextual **Port Distance** resolution pattern.

## Key moments and customer value

| Moment | Value demonstrated |
|---|---|
| Stable shell and placeholder modules | Credible broader ERP platform without over-claiming |
| Monitor layered timeline | Fast plan-versus-execution visibility |
| Direct variance badge | Exception recognition without hover dependence |
| Projected downstream layer | Immediate understanding of likely impact without silently changing estimates |
| Draft Simulation banner | Safe separation between modelling and live schedule |
| Omitted call remains visible | Traceability and recoverability |
| Recalculation/change summary | Decision support before Apply |
| Apply confirmation and terminal state | Controlled, auditable live update |
| Service workspace hierarchy | Reusable planning foundation and platform continuity |
| Port Distance contextual resolution | Practical recovery from an operational data dependency |

## Realistic demonstration data

- Organization: `Oceanic Liner Operations` (fictional).
- User: `Olivia Reed`, combined Viewer + Editor + Simulation.
- Service: `AEX — Arabian Express`, Mainliner, Arabian Gulf–Red Sea, Active.
- Voyage: `VOY-2026-0148`, CVN `AEX-071W`, vessel `MV Meridian Star`, IMO `9876543`, In-Progress.
- Rotation: Jebel Ali (`AEJEA`) → Sohar (`OMSOH`) → Suez Canal (`EGSUZ`) → Jeddah (`SAJED`) → Aqaba (`JOAQJ`).
- Deviation: Actual departure from Sohar 11 hours late; projected Jeddah arrival +9 h and Aqaba +8 h before recovery.
- Scenario S-02: speed adjustment; Scenario S-03: omit Aqaba and adjust Jeddah milestones. These are demonstration options, not asserted operational recommendations.
- Port Distance sample: `OMSOH → EGSUZ`, 2,120 NM, ECA 140 NM, Navigable, API/Proposed then Approved.

Check that every displayed date is internally chronological and that local/UTC differences are consistent with the stated time-zone labels. Exact time-zone rules are not part of this package; values are fictional demonstration data.

## Transitions and prototype links

- Use instant or 150 ms dissolve for normal page navigation.
- Use Smart Animate only for drawer opening, scenario change markers, and timeline layer update; respect reduced-motion variant.
- Preserve filters and scroll position when returning to Monitor or lists.
- Every drawer has Close, every detail has a parent breadcrumb, and every success state has a next action.

## Expected duration

- 1 minute: platform shell and Monitor orientation.
- 5–6 minutes: deviation inspection, Simulation, comparison, Apply, Monitor refresh.
- 3–4 minutes: Service Workspace and Line Study foundation.
- 1 minute: broader-platform placeholders, governance, and close.

Recommended total: **10–12 minutes**, with 5 minutes reserved for questions.

## Screens not to open during the main demo

- SCR-015 Bulk Import and SCR-016 Users & Roles: credible but distract from operational value.
- SCR-014 Deviation Thresholds: use only for a governance question.
- SCR-017 State Showcase: design-review artifact, not customer narrative.
- Empty/error variants unless the customer asks about resilience.
- Future ERP placeholder modules: no click should lead to a functional page.
- Any audit/activity section until the product owner confirms an audit UI is in scope.

## Fallback flow

If Simulation prototype interactions fail, use prebuilt linked frames:

1. Monitor deviation state.
2. Simulation S-03 changed state.
3. Apply confirmation.
4. Applied success state.
5. Refreshed Monitor.

If timeline interaction is difficult to present remotely, switch to Monitor Table View and follow the same deviation drawer path. If the audience is commercially focused, use the service-planning flow first and the prebuilt recovery frames second.

## Closing state

Close on the refreshed Schedule Monitor with:

- `VOY-2026-0148` visible.
- S-03 applied timestamp in a small success/activity indication.
- Updated executable blocks and no ambiguous projected state.
- Broader ERP placeholder navigation still visible.
- A concise verbal summary: one operational source, controlled schedule change, immediate exception visibility, and room for future platform modules.

