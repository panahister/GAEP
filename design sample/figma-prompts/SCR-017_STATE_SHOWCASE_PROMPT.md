# SCR-017 State Showcase — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-017 — State Showcase`, a Figma review board, not an application route.

## 2. Business purpose
Prove consistent empty, loading, error, success, permission, locked, omitted, and partial-success variants across the design system.

## 3. User and role
Design/product reviewers; examples represent all four roles.

## 4. Context inside the ERP shell
Do not place this board in app navigation. Use shell/component instances only as small contextual examples.

## 5. Layout structure
1440 px review board sections: Lists, Forms, Timeline, Simulation, Upload/Import, Permissions, Feedback. Each card contains state name, component instance, content, usage, accessibility annotation.

## 6. Information hierarchy
State name/trigger → visual instance → recovery/action → linked usage/annotation.

## 7. Components
First-use/no-results, skeletons, inline/page errors, banners/toasts, edit lock, locked/omitted row, no permission, Strict/Lenient, API fallback, Draft/Applied/Discarded, Apply confirmation/failure/success, timeline layers.

## 8. Data and sample content
Reuse AEX, VOY-2026-0148, S-03, AEJEA/OMSOH consistently.

## 9. Primary actions
Review-only links to matching state frames.

## 10. Secondary actions
Optional Figma-only category navigation.

## 11. Filters and search
None in product; optional review navigation only.

## 12. Validation
Every error names cause/recovery; every disabled/locked state explains why; every success names object/action.

## 13. Permissions
Show Viewer/Editor/Simulation/Admin variants using only confirmed role differences.

## 14. Statuses
Cover all required state variants and semantic tokens.

## 15. Empty state
Show first-use with role-valid action and no-results with Clear filters.

## 16. Loading state
Table/timeline skeleton, localized recalculation, file progress.

## 17. Error state
Inline/page/partial/API/edit-lock/Apply failure with preserved context and secondary reference ID.

## 18. Success feedback
Toast, inline row refresh, persistent banner, and Applied terminal examples.

## 19. Responsive behavior
Include selected tablet/narrow component variants; the board itself remains desktop.

## 20. Accessibility
Annotate focus destination, live region, keyboard behavior, accessible label, and non-color cue for every custom state.

## 21. Prototype interactions
Link each state to its matching primary screen frame/variant.

## 22. Linked screens
All SCR-001…016 as applicable.

## 23. Visual constraints
Use real component instances, not one-off mockups; keep annotation typography separate.

## 24. Prohibited behavior
Do not add State Showcase to the ERP sidebar or customer main demo.

## 25. Source traceability
FR-RPT-6, FR-DIST-4, FR-SCH-7, FR-SIM-13, current design brief.

## 26. Assumptions
This is a review artifact only; annotate no production route.
