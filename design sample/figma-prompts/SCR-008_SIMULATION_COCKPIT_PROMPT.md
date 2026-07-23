# SCR-008 Simulation Cockpit — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-008 — Simulation Cockpit`, the core exclusive schedule-change workspace.

## 2. Business purpose
Safely model, compare, and apply Draft schedule changes without touching the executable voyage before Apply.

## 3. User and role
Default Simulation Analyst; build Administrator unlock variant and no-lock/read-only variant.

## 4. Context inside the ERP shell
Reuse shell; breadcrumb `Voyages / VOY-2026-0148 / Simulation`. Keep a persistent `Draft scenario — executable schedule is unchanged until Apply` banner.

## 5. Layout structure
At 1440: 260 px Scenario Rail, flexible central table/timeline, 360 px Inspector/Change Summary; top bar with voyage identity/edit lock/actions. Comparison is alternate central state.

## 6. Information hierarchy
Scenario/live separation → voyage/edit lock → changed rotation/timing → recalculation/blockers → comparison/change summary → Apply.

## 7. Components
Scenario Rail, route sequence, schedule timeline, shared Milestone Editor, Change Summary, comparison diff, Add/Omit/Unomit/Reposition, phase dialog, chaining, cut-off editor, actuals/Actualize, lock/unlock, confirmations.

## 8. Data and sample content
Use S-01 Baseline copy, S-02 Speed recovery, S-03 Aqaba omission. Show Jebel Ali/Sohar locked, Suez/Jeddah/Aqaba open. In S-03 omit Aqaba: Position remains 5, no active Sequence Number; Jeddah becomes final active call; show changed times and summary.

## 9. Primary actions
`Apply scenario`.

## 10. Secondary actions
Create/Compare/Discard, Back to baseline, port operations, distance/speed/milestones/CVN, Phase In/Out, chaining, cut-offs, actualize.

## 11. Filters and search
All/Changed/Exceptions/Open-Future/Locked; find port; compare selector 2–3 Drafts.

## 12. Validation
Draft only; edit lock; admin unlock; available vessel; From/To current locations; approved distance; type/location and chronology; actual fields before actualize; preserve Position/renumber Sequence; Apply blocks unresolved errors.

## 13. Permissions
Simulation can model/apply but not unlock. Admin unlocks. Editor alone cannot access schedule editing.

## 14. Statuses
Draft clean/changed/recalculating/blocked, Applied/Discarded terminal, lock unavailable, locked/unlocked call, stale baseline, apply pending/failure/success.

## 15. Empty state
No Draft with Create action; Compare requires two Drafts.

## 16. Loading state
Lock acquisition and scenario skeleton; recalculation keeps stable values visible with progress.

## 17. Error state
Name lock owner; no Take over; missing pair link; Apply failure says live unchanged and preserves Draft.

## 18. Success feedback
Applied terminal frame and message `Scenario S-03 applied to VOY-2026-0148. 5 future calls updated.` with Detail/Monitor links.

## 19. Responsive behavior
Laptop Inspector drawer; tablet one scenario/stacked diff/full-height call edit; narrow view-only and larger-screen boundary.

## 20. Accessibility
Banner first, keyboard scenario list/reorder, non-color changes, table diff alternative, clear focus after Apply, polite recompute announcement.

## 21. Prototype interactions
Omit Aqaba→recalculate; Compare S-02/S-03; Apply confirmation→Applied→SCR-002 refreshed; Admin unlock variant.

## 22. Linked screens
SCR-002, SCR-007, SCR-013.

## 23. Visual constraints
Dense control surface; changed values subtly marked; high-risk action isolated.

## 24. Prohibited behavior
No direct live edits before Apply, auto-recommendation, hidden omitted row, reuse of Applied scenario, auto-discard of other Drafts, auto-recovery, or cost/cargo impact.

## 25. Source traceability
FR-SIM-1…13/15, FR-SCH-1…8, FR-LS-CT; US-SIM-*.

## 26. Assumptions
Annotate GAP-013–019 and GAP-033–036 for naming, comparison, lock, unlock, distances, chronology, cut-offs, chaining, phase inheritance.
