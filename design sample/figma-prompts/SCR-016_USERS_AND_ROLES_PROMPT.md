# SCR-016 Users & Roles — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-016 — Users & Roles`, a supporting governance screen.

## 2. Business purpose
Create internal users, assign one or more confirmed roles, and deactivate accounts.

## 3. User and role
Schedule Administrator only.

## 4. Context inside the ERP shell
Reuse shell with Administration / Users & Roles active.

## 5. Layout structure
Page header/Create user; search/filter; user table; 520 px create/edit drawer; role cards and effective-permission summary; deactivate dialog.

## 6. Information hierarchy
Username/name/status → roles/effective union → optional session facts → actions.

## 7. Components
Data Table, account chips, role check cards, effective-capability summary, account/password fields, confirmation, errors/success.

## 8. Data and sample content
Create `Olivia Reed / olivia.reed` with Schedule Viewer, Schedule Editor, Simulation Analyst. Show technical codes secondary. Include `Samir Khan` deactivated and `IT Administrator` with Schedule Administrator.

## 9. Primary actions
Create user / Save roles.

## 10. Secondary actions
Open/edit, Reset password if approved, Deactivate; do not add departments/scopes.

## 11. Filters and search
Active/Deactivated, Role; search username/display name.

## 12. Validation
Required unique username; password min 8/basic complexity; role union/Admin superset. Mark at-least-one-role and last-admin rules unresolved.

## 13. Permissions
Administrator only.

## 14. Statuses
Active, deactivated, locked out, multi-role, Admin superset, saving/error.

## 15. Empty state
No users match filters; no bootstrap flow.

## 16. Loading state
Table/drawer skeleton and localized save.

## 17. Error state
Duplicate username/password policy/save/deactivation errors; do not invent last-admin conflict.

## 18. Success feedback
`User olivia.reed created with 3 roles.` and account-deactivated message.

## 19. Responsive behavior
Tablet cards/full-screen drawer; narrow read-only and larger-screen role-edit boundary.

## 20. Accessibility
Role cards as described checkboxes, text union summary, password requirements, named confirmation.

## 21. Prototype interactions
Create Olivia; select Admin and show included capabilities; deactivate Samir.

## 22. Linked screens
Profile/reset flow and shell role variants.

## 23. Visual constraints
Simple internal admin UI, no identity-provider branding.

## 24. Prohibited behavior
No self-registration, external IdP, department/data scope, approval hierarchy, or unsupported session controls.

## 25. Source traceability
FR-AUTH-2…6; US-AUTH-2…6.

## 26. Assumptions
Display name, at-least-one-role, last-admin, session revocation, reactivation, and reset are GAP-043/044.
