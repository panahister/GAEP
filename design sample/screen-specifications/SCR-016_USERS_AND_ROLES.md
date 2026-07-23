# SCR-016 — Users & Roles

## Business purpose

Provision internal users, assign one or more of the four confirmed roles, deactivate accounts, and expose session/password policy without inventing an external identity system.

## Source references

- [Requirements FR-AUTH-2…6](../../Requirement/requirements.md)
- [User Stories US-AUTH-2…6](../../User%20story/stories.md)

## Primary personas

Schedule Administrator only.

## Entry points

- Administration → Users & Roles.

## Exit points

- Remain after save/deactivate.
- Profile/password reset is a separate personal flow.

## Layout

Page header with `Create user`; search/filter bar; user table; 520 px create/edit drawer with account fields, four role cards/checks, and effective-permission summary. Deactivate confirmation is separate.

## Information hierarchy

1. Username/display name and account active state.
2. Assigned roles and effective union.
3. Last sign-in/lockout/session facts only if source/backend supplies them.
4. Admin actions.

## Components

Data Table, account status chip, role chips/cards, effective-capability summary, create/edit drawer, password field/policy meter, deactivate confirmation, reset action, loading/error/success.

## Data fields

Username, Display Name (provisional), initial Password or reset flow, Roles, Active/Deactivated. Roles: Schedule Viewer, Schedule Editor, Simulation Analyst, Schedule Administrator with technical codes secondary. Do not add department/location scope.

## Actions

- **Primary:** Create user / Save roles.
- **Secondary:** Open/edit, Reset password (admin capability is mentioned in application design but requirement emphasizes self-service plus admin provisioning), reactivate if supported.
- **Privileged:** Deactivate account.

## Permissions

Administrator only. Administrator role selection implies all lower permissions; UI may show included capabilities without automatically checking all boxes if backend stores only Admin.

## Filters

Active/Deactivated, Role, locked out if available.

## Sorting

Username/display name, status, last sign-in if available.

## Search

Username and display name.

## Validation

Username required/unique (format missing). Initial/reset password minimum 8 and basic complexity. At least one role is a reasonable provisional requirement. Last active Admin protection, session termination on changes, reset verification, and reactivation rules are missing.

## States

Active, deactivated, locked out, multi-role, Administrator superset, create/edit/saving/error.

## Empty state

`No users match these filters.` First-use admin bootstrap is outside screen scope.

## Loading state

Table/drawer skeleton; role save localized.

## Error state

Duplicate username; policy failure; role-save failure preserves changes; deactivation conflict should not claim last-admin protection unless confirmed.

## Success feedback

`User olivia.reed created with 3 roles.` `Account samir.khan deactivated.`

## Responsive behavior

Laptop table/drawer. Tablet user cards/full-screen drawer. Narrow view/read only; role matrix editing prefers larger screen.

## Accessibility

Role cards are checkboxes with descriptions; effective union presented as text; password requirements announced; deactivation dialog names user; status not color-only.

## Prototype interactions

- Create Olivia Reed with Viewer + Editor + Simulation → success.
- Select Administrator → included-capabilities summary.
- Deactivate account → confirmation/success.

## Assumptions

- Display name, at-least-one-role, last-admin, session termination, reactivation, and reset mechanism are unresolved (GAP-043/044).

## Open questions

- Must one active Administrator remain?
- Do role changes/deactivation revoke current sessions immediately?
- Can admins reset passwords directly, and how is self-service verified?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-AUTH-2/3 | Four roles, union, Admin superset | Confirmed |
| FR-AUTH-4 | UI create/assign/deactivate | Confirmed |
| FR-AUTH-5/6 | Password/session policy display | Confirmed |
| Last-admin/session revocation | Validation | Missing |

## Acceptance checklist

- [ ] No departments/scopes or external IdP are added.
- [ ] Technical role codes and friendly names align.
- [ ] Admin superset is clear.

