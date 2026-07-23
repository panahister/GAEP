# ERP Platform Shell

## Context and boundary

The current design brief requires Service & Schedule to appear as one module in a broader maritime ERP. This shell is therefore a presentation and platform architecture decision. The source product's confirmed authentication, user administration, master-data ownership, and module workflows remain intact. Other business modules are placeholders and must not expose deep screens.

## Shell layout

At 1440 px, use a 248 px left sidebar, a 64 px top bar, and a fluid content workspace with a maximum readable width only for form pages; data workspaces use the available width. A 4 px provisional environment rail or compact `DEMO` badge may appear in the top bar during customer presentation.

The content area follows this stable vertical order:

1. Breadcrumb row.
2. Page header with title, status/context, and page-level actions.
3. Optional alert/banner.
4. Optional tabs or filter bar.
5. Primary working surface.

## Product identity

Use a provisional abstract maritime mark and the name **Maritime ERP** in the shell. Label the active workspace **Service & Schedule**. Both are presentation placeholders pending customer branding. Do not use source-process names or copy an existing shipping-line identity.

## Primary navigation

### Global platform capabilities

- Home: non-clickable or returns to the Service & Schedule landing experience in the prototype.
- Global Search: searches Service Code, Voyage Number, CVN, vessel/IMO, port/UN/LOCODE; behavior is a prototype assumption and must be annotated.
- Notifications: operational and administrative notification center; show realistic samples without inventing acknowledgement workflows.
- Help: opens a lightweight help menu; no detailed knowledge base is designed.
- Profile: account, roles, session, password reset, sign out.
- Organization switcher: show one organization, `Oceanic Liner Operations`, and a disabled chevron or single-item menu. Multi-tenancy is not claimed.

### Active module group: Service & Schedule

- Schedule Monitor
- Services
- Voyages
- Reports
- Feeder Schedules
- Reference Data
  - Locations
  - Vessels
  - Organisations
  - Port Distances
- Administration (role-gated)
  - Deviation Thresholds
  - Bulk Import
  - Users & Roles

Reference Data and Administration support Service & Schedule; they are not invitations to design an unrelated enterprise master-data module.

### Future ERP placeholders

Show a separated `Future modules` group with restrained disabled entries, for example:

- Bookings & Commercial — Coming later
- Cargo Operations — Coming later
- Port Operations — Coming later
- Finance & Costing — Coming later
- Agency — Coming later
- Routing — Coming later

Do not show badges, KPI counts, child navigation, hover previews, or clickable deep routes for these modules. The label is platform vision, not confirmed delivery.

## Sidebar behavior

- Active item uses a left accent bar, tinted background, icon, and text—not color alone.
- Groups expand/collapse; remember state within the prototype.
- Disabled items have 60–70% text contrast and a `Coming later` tooltip/flyout.
- At 1280 px, sidebar may collapse to 72 px icons with tooltips.
- On tablet, it becomes an overlay drawer triggered from the top bar.
- On narrow viewports, use a full-height navigation sheet and return focus to the menu trigger on close.

## Top bar and command area

Left to right:

- Mobile/collapsed navigation trigger when required.
- Contextual global search with shortcut hint `/`.
- Organization context.
- Environment badge (`DEMO`, provisional).
- Notifications with unread count.
- Help.
- User avatar/name and combined role summary.

Global Create is not used because creation is context-sensitive. Page headers own Create service, Capture report, Create feeder voyage, and similar actions.

## Breadcrumbs

Use semantic paths such as:

- Service & Schedule / Services / AEX / Line Study LS-02
- Service & Schedule / Voyages / VOY-2026-0148 / Simulation
- Service & Schedule / Reference Data / Port Distances

On narrow screens, collapse middle nodes but preserve the current page and one parent.

## Search

Global search is a command overlay with categorized results: Services, Voyages, Vessels, Locations. Each result includes its unique identifier and relevant secondary identifier. Searching `CVN-AE-071` may yield multiple voyages because CVN is not unique. Provide keyboard navigation, recent searches, loading, no-results, and service-unavailable states.

Module lists retain their own search and filters. Global search does not replace list filters.

## Notifications

Use a 360–400 px right drawer. Source-supported notification examples may include detected deviation, report import partial success, distance awaiting approval, edit lock released, or scenario applied. Do not create notification read/acknowledgement business states; local read styling is a shell convention only.

## Account and organization controls

The profile menu shows user name, username, roles, session expiry information, Reset password, and Sign out. Do not expose access-token controls. Organization control shows a single current company by default; do not imply multi-tenant data switching is implemented.

## Page headers and contextual actions

Page header anatomy:

- Eyebrow/breadcrumb context.
- H1 title plus identifiers.
- Status chips or read-only state summary.
- Optional `Last updated` and lock owner.
- Primary action on the far right.
- Secondary actions in a kebab menu only if they are truly secondary.

Keep dangerous actions separated from primary action groups.

## Drawers and modals

- Right detail drawer: 480–640 px for port call, deviation, row detail, and activity.
- Form drawer: up to 560 px for short entity creation; use full page for Line Study and Simulation.
- Confirmation dialog: 440–520 px, with consequence statement and explicit object identifier.
- Generation dialog: 640–720 px to choose mode and preview output count.
- Scenario apply dialog: shows affected voyage, number of changed calls, locked-call exceptions, and other drafts retained.

Drawers preserve the underlying list/filter context. Modals trap focus, close on explicit Cancel or safe Escape, and never dismiss while a write is pending.

## Feedback and notification behavior

- Inline validation for field errors.
- Page banner for cross-record blockers, such as missing approved distance or edit lock.
- Toast for completed non-critical writes, including record identifier.
- Persistent progress banner for uploads/generation longer than one second.
- Problem states include a correlation/reference ID when available, but it is secondary to plain-language recovery.

## Loading behavior

Use skeletons that match the final layout for initial loads. Use localized progress for table refresh, calculation, generation, or apply. Never blank the whole page during a filter change. For the Simulation Cockpit, lock affected controls during recompute and keep the previous stable values visible with a subtle progress strip.

## Permission behavior

- Viewer sees no edit affordances.
- Editor sees create/update actions but no admin-only delete, approve, unlock, user management, or threshold/import controls.
- Simulation Analyst sees scenario actions but not service/master-data editing unless holding Editor.
- Administrator sees all supported actions.
- Where a restricted action is essential to comprehension (for example a locked call), show the state and explain which role can unlock it; otherwise omit the unauthorized control.

## Responsive shell

| Viewport | Shell treatment |
|---|---|
| ≥1440 px | Full sidebar, full top bar, dense workspace |
| 1280–1439 px | Collapsible sidebar, compact header, filters may collapse |
| 768–1279 px | Overlay navigation; page actions may move to bottom action area or overflow; drawers become near-full width |
| <768 px | Full-screen navigation and detail sheets; tables use cards/limited columns; complex editors are view-first |

## Accessibility

- Include a skip link to main content.
- Sidebar and menus use correct navigation semantics and keyboard arrow behavior.
- Active navigation uses `aria-current` and non-color styling.
- Icon-only controls have labels and tooltips.
- Focus order follows top bar → breadcrumbs → page header → filters → content.
- Live regions announce result counts, completed writes, and calculation completion without excessive chatter.

