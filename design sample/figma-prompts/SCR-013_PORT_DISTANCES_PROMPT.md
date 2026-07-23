# SCR-013 Port Distances — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-013 — Port Distance Table`, a core dependency-resolution screen.

## 2. Business purpose
Maintain one authoritative record per port pair, fetch/approve external proposals, and provide manual fallback to unblock calculations.

## 3. User and role
Viewer reads; Editor manually maintains/fetches; Administrator approves/rejects.

## 4. Context inside the ERP shell
Reuse shell with Reference Data / Port Distances active. Include contextual `Required for OMSOH → EGSUZ` banner variant.

## 5. Layout structure
Page header/Add; search/filter bar; editable table; 520 px proposal/current comparison drawer; contextual return banner.

## 6. Information hierarchy
Pair/usable status → Distance/ECA/Unit/Type → Source/proposal comparison → actions.

## 7. Components
Editable Table, Port Selectors, numeric/unit fields, Distance Type, Source/Status chips, Fetch, Proposal drawer, Approve/Reject confirmation, API fallback banner.

## 8. Data and sample content
Show OMSOH→EGSUZ 2,120 NM, ECA 140 NM, Navigable, API, Proposed; compare with current/manual if needed. Include Approved and Manual examples.

## 9. Primary actions
Add/Save manual distance.

## 10. Secondary actions
Fetch, edit, Retry; Admin Approve/Reject.

## 11. Filters and search
From/To, Source, Status, Distance Type; search location name/UN/LOCODE.

## 12. Validation
Required different From/To; one ordered pair; Distance >0; ECA non-negative/provisionally ≤ Distance; NM; fixed type domain; Proposed unusable until Approved.

## 13. Permissions
Editor cannot approve; Admin may self-approve; Viewer read-only.

## 14. Statuses
Manual, API Proposed, Approved, Rejected/history, timeout, existing Approved + pending proposal provisional.

## 15. Empty state
No pair/no results with Add/Fetch appropriate to role.

## 16. Loading state
Table skeleton and row-level Fetch/Approve progress.

## 17. Error state
API unavailable with same-screen manual entry; duplicate directs to existing; save/approve keeps values.

## 18. Success feedback
`Distance OMSOH → EGSUZ approved and available for calculation.` plus Return to Line Study/Simulation.

## 19. Responsive behavior
Tablet reduced table/expanded detail; narrow supports single contextual pair resolution, not bulk editing.

## 20. Accessibility
Directional pair names/codes, text statuses, comparison table, announced units and focus recovery.

## 21. Prototype interactions
Fetch→Proposed; Admin Approve→Return; API timeout→Manual fallback.

## 22. Linked screens
SCR-004, SCR-005, SCR-008, SCR-012.

## 23. Visual constraints
Precise table/drawer; distinguish current approved from proposal.

## 24. Prohibited behavior
Do not show deferred capacity/validity fields, treat ECA as type, create duplicate pair, or use unapproved proposal.

## 25. Source traceability
FR-DIST-1…5d, FR-SCH-8; US-DIST-1…5.

## 26. Assumptions
Manual approval, proposal coexistence, API provider, ordered/symmetric pair, and numeric bounds are GAP-017–019.
