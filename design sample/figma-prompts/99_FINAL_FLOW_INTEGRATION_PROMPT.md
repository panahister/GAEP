# Final Flow Integration and Verification Prompt

All required Service & Schedule screens have now been generated. Re-read the complete persistent guideline bundle, then integrate and verify the screens as one coherent functional prototype. Preserve the approved shell, visual system, content, routes, screen layouts, and business rules. Fix routing, interaction, state-transfer, and accessibility problems only; do not redesign unrelated UI.

## Primary customer demonstration flow

Use Schedule Monitor (`SCR-002`) as the authenticated starting point for `Olivia Reed — Operations & Line Management` with Viewer + Editor + Simulation roles.

Verify this complete path with the existing fictional demo data:

1. Schedule Monitor shows `VOY-2026-0148 / AEX-071W` and the `+11 h Late` Sohar deviation.
2. Selecting the deviation opens its detail with retained baseline, actual departure, downstream projection, and `Recover in Simulation`.
3. The user can inspect Voyage Detail and create or open Draft scenario `S-03`.
4. Simulation shows locked historical calls and editable future calls.
5. The prepared interaction omits Aqaba or adjusts future milestones, preserves Position, recomputes Sequence Number and downstream times, and updates the change summary.
6. Compare shows factual differences between `S-02` and `S-03`, then returns to `S-03`.
7. Apply opens a consequence-specific confirmation naming the affected future calls.
8. Successful Apply makes `S-03` terminal Applied, keeps other drafts as defined, and provides `View updated schedule`.
9. Returning to Schedule Monitor shows the updated executable layer and a resolved, unambiguous projected state.

At no point may a Draft edit silently modify the live executable schedule.

## Secondary planning flow

Verify this connected path:

Services List → `AEX — Arabian Express` → Service Workspace → `LS-02 Westbound Summer Rotation` → Line Study Editor → return to Service Workspace → inspect Final/Locked CPD → open generation dialog without executing the main-demo write → inspect an existing generated voyage.

If the missing-distance demonstration is enabled, it must open the exact Port Distance pair and return to the originating task with context preserved.

## Supporting flow checks

Verify that these routes and returns work without dead ends:

- Report Capture → partial/strict result → affected Voyage Detail or Schedule Monitor.
- Feeder Schedules → Feeder Voyage Form → Save → list and optional unified Voyage List.
- Global Search → selected Service, Voyage, Vessel, or Location destination.
- Voyage List → Voyage Detail → supported export feedback.
- Administration navigation and permission-limited states.
- Sign out → Sign In → successful return to Schedule Monitor.

## State and resilience checks

- Preserve list/monitor filters and relevant scroll position on return.
- Preserve Service, Voyage, Scenario, and Port Distance identity across linked steps.
- Warn before abandoning dirty forms or editors.
- Validation keeps entered data and moves focus to the first error.
- Loading, empty, error, partial-success, no-permission, lock, service-unavailable, and session-expired states have a clear exit or retry.
- Dialog and drawer Close returns focus to the launching control.
- Keyboard navigation reaches every interactive control in logical order.
- Status meaning never depends on color alone.
- Reduced-motion behavior avoids non-essential animation.

## Route integrity checks

- Remove or correct broken links, duplicate route destinations, and unreachable generated pages.
- Keep `SCR-017 State Showcase` accessible only as an internal design-review route.
- Keep future ERP modules disabled with no functional route.
- Do not route to screens outside the confirmed inventory.
- Do not change the common shell between screens.

Finish by reporting:

1. The verified starting route.
2. The primary and secondary paths tested.
3. Any remaining dead link, placeholder, or non-functional interaction.
4. Any assumption still requiring product-owner confirmation.

Do not report a flow as complete if a required action only changes appearance without producing the specified application state.
