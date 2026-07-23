# SCR-004 Service Workspace — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-004 — Service Workspace`, core parent page for one Service.

## 2. Business purpose
Maintain service fields, open multiple dedicated Line Studies, manage CPDs/Vessel Rules inline, and generate standard/ad-hoc voyages.

## 3. User and role
Default Editor + Viewer; provide Viewer-only and Administrator variants.

## 4. Context inside the ERP shell
Reuse shell; breadcrumb `Service & Schedule / Services / AEX`.

## 5. Layout structure
Persistent service header; tabs `Overview | Line Studies | Cycle Plans | Voyages`. Keep CPD and Voyage Management inline. Build Create, Active/locked, and Draft variants.

## 6. Information hierarchy
Identity/status/editability → Line Studies → CPD/vessel rules/lifecycle → generation and linked voyages.

## 7. Components
Page Header, Tabs, read/edit form, Line Study table, CPD accordion, Vessel Rules editable table, lifecycle/formula panels, Generate/Ad-hoc dialogs, blocker banner, Voyage mini-table.

## 8. Data and sample content
Use AEX fields from Master Prompt. Show `LS-02 Westbound Summer Rotation`; CPD 1 With Frequency, 35-day duration, 5 vessels, 7-day frequency, Locked; vessel rule with MV Meridian Star; linked VOY-2026-0148.

## 9. Primary actions
Save service; Create Line Study; Add CPD/Vessel Rule; Generate voyages.

## 10. Secondary actions
Edit allowed fields, Create ad-hoc voyage, replace vessel at cycle position, export/view voyages; Admin Deactivate/Reactivate.

## 11. Filters and search
Compact search/filter within Line Studies, CPDs, and Voyages only.

## 12. Validation
Mandatory service fields; Valid To ≥ From; Code immutable; after voyage only validity editable; CPD overlap, integer formula, rule count, vessel overlap/availability; missing distance blocker.

## 13. Permissions
Viewer read-only; Editor create/edit/generate; Admin privileged availability actions. Simulation role alone does not edit service.

## 14. Statuses
Service Draft/Active/Inactive; separate Deactivated; CPD New/Saved/Final/Locked; save/generation states.

## 15. Empty state
Distinct no Line Study/no CPD/no Voyage states with next valid action.

## 16. Loading state
Header and active-tab skeleton; generation progress dialog.

## 17. Error state
Preserve inline edits; link missing pair to SCR-013; name overlap/formula errors.

## 18. Success feedback
Specific save/finalize/generation messages; update derived Active status after first future voyage.

## 19. Responsive behavior
Laptop retains tabs; tablet stacks CPD cards and row forms; narrow is view-first for complex rules.

## 20. Accessibility
Keyboard tabs/accordions, readable calculated values, linked error summary, accessible preview table.

## 21. Prototype interactions
Wire LS-02 → SCR-005; CPD expand; Generate dialog/preview/success → SCR-007; missing distance → SCR-013.

## 22. Linked screens
SCR-003, SCR-005, SCR-006, SCR-007, SCR-013.

## 23. Visual constraints
One parent workspace; do not turn each tab into an unrelated dashboard.

## 24. Prohibited behavior
No separate CPD page, capacity/cost/bunker, auto-generated CVN, editable derived statuses, or unsupported Line Study deletion.

## 25. Source traceability
FR-SVC-2/6…12, FR-CYC-1…11; US-SVC-1/4/7, US-CYC-*.

## 26. Assumptions
Per-section Save, generation preview/CVN entry, Owned organization, and ad-hoc overrides are GAP-021/027–030.
