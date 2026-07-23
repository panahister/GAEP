# Platform Shell Prompt

Using the complete persistent guideline bundle—especially `01_DESIGN_SYSTEM.md`, `02_COMPONENTS_AND_VISUALIZATION.md`, `03_ROLES_AND_PERMISSIONS.md`, `05_RESPONSIVE_AND_ACCESSIBILITY.md`, and `06_PLATFORM_IA_AND_FLOW_RULES.md`—create one reusable common maritime ERP shell and its desktop, collapsed-laptop, tablet-overlay, and narrow variants.

Build a 248 px expanded left sidebar, 64 px top bar, breadcrumb slot, page-header slot, alert slot, and fluid content workspace. Use the provisional product name `Maritime ERP`, an original abstract maritime mark, and active workspace `Service & Schedule`. Add a small `DEMO` environment badge.

Create these active Service & Schedule navigation items:

- Schedule Monitor
- Services
- Voyages
- Reports
- Feeder Schedules
- Reference Data: Locations, Vessels, Organisations, Port Distances
- Administration: Deviation Thresholds, Bulk Import, Users & Roles

Create a visually separated `Future modules` group with disabled placeholder items only:

- Bookings & Commercial — Coming later
- Cargo Operations — Coming later
- Port Operations — Coming later
- Finance & Costing — Coming later
- Agency — Coming later
- Routing — Coming later

Do not create child pages, counts, hover previews, clickable prototype targets, or realistic data for future modules.

In the top bar include global search with `/` shortcut hint, organization context `Oceanic Liner Operations`, DEMO badge, notifications, help, and user profile. Use a single-organization menu and do not imply multi-tenancy. The profile menu shows name, username, friendly role badges with technical codes secondary, session information, Reset password, and Sign out.

Create a global search overlay grouped into Services, Voyages, Vessels, and Locations. Use identifiers and secondary information so duplicate CVNs are safe. Treat this behavior as an annotated assumption.

Create a 380 px notification drawer with demonstration alerts grounded in supported events: delayed voyage, report partial import, port distance awaiting approval, scenario applied. Do not create acknowledgement, subscription, or workflow states.

Use stable page header variants for List, Detail, Editor, Read-only, and Locked. Provide 480–640 px right drawers and 440–720 px dialogs. Include specific shell-level loading, full-page error, session-expired, no-permission, and service-unavailable variants.

Make sidebar active state use accent bar, tint, icon, and text. Disabled placeholder items remain readable and show `Coming later`. Provide skip link, visible focus, keyboard navigation annotations, `aria-current` annotation, icon labels, and focus return after overlay close.

On laptop, collapse sidebar to 72 px icons with tooltips. On tablet, use an overlay drawer. On narrow view, use a full-height navigation sheet and preserve active page context in the top bar.

Reuse this shell instance without visual changes on every screen-specific frame.
