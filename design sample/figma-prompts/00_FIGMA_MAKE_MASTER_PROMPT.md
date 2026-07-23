# Figma Make Master Prompt

Use this file as the main `guidelines/Guidelines.md` in Figma Make. The following sibling guideline files are also mandatory persistent context and must be loaded before any generation:

- `00_PRODUCT_SCOPE_AND_MANIFEST.md`
- `01_DESIGN_SYSTEM.md`
- `02_COMPONENTS_AND_VISUALIZATION.md`
- `03_ROLES_AND_PERMISSIONS.md`
- `04_CONTENT_AND_UX_WRITING.md`
- `05_RESPONSIVE_AND_ACCESSIBILITY.md`
- `06_PLATFORM_IA_AND_FLOW_RULES.md`

Treat the complete guideline bundle as one governing contract. A screen prompt may add local detail but may not override these persistent rules. If the Figma Make file supports only one guideline file, append the seven files below this Master content in the listed order before generating anything.

Design a high-fidelity, clickable, English, left-to-right enterprise interface for a maritime ERP. The only module designed in functional depth is **Service & Schedule**. Present it inside one reusable common ERP shell. Show future modules only as disabled `Coming later` navigation placeholders; do not create their screens, workflows, data, KPIs, or interactions.

Treat the product as an operational, data-intensive system for maritime services, line studies, cycle plans, vessel rules, voyages, port calls, actuals, deviations, schedule monitoring, simulation scenarios, feeder voyages, and the reference/admin data required by this module. Never add cost, bunker, cargo, booking, port-operations, agency, routing, live AIS, publication, or automated recovery functions.

Use the exact tokens, scale, grid, breakpoints, states, focus, density, and motion defined in `01_DESIGN_SYSTEM.md`. Create centralized CSS theme tokens or the equivalent before screens. After the approved preview is copied into Figma Design, translate them into native Figma variables and styles. The following summary does not replace the detailed guideline:

- Deep navy/slate structure, sea-teal primary accent, cool neutral surfaces.
- Semantic success, warning, danger, info, early, locked, and omitted colors independent from brand color.
- Inter or a neutral system sans-serif, 14 px default body, compact enterprise density.
- 4 px base spacing, 6 px standard radius, subtle borders, minimal elevation.
- No excessive gradients, glassmorphism, neumorphism, decorative illustrations, large floating cards, saturated dashboards, or playful motion.

Create reusable components and variants according to `02_COMPONENTS_AND_VISUALIZATION.md` for the sidebar, top bar, breadcrumbs, page headers, tabs, tables, editable tables, filters, advanced-filter drawer, form fields, port/vessel/organization selectors, local-plus-UTC time pair, status chips, banners, toasts, empty/loading/error states, dialogs, drawers, pagination, column customization, export menu, route/port sequence, milestone editor, Schedule Gantt, scenario rail, change summary, static last-known position, and audit/activity pattern marked provisional.

Apply the role union and exact capability matrix in `03_ROLES_AND_PERMISSIONS.md`, the terminology/formats/messages in `04_CONTENT_AND_UX_WRITING.md`, the viewport/accessibility requirements in `05_RESPONSIVE_AND_ACCESSIBILITY.md`, and the shell/entity/route/flow contract in `06_PLATFORM_IA_AND_FLOW_RULES.md` on every applicable screen.

Apply these immutable product rules:

- Service status is system-derived Draft, Active, or Inactive; do not create a status editor.
- Service Code is immutable. After the first voyage, only Service validity fields remain editable.
- Service may have multiple Line Studies; Line Study is a dedicated page. Cycle Plan Definition and Voyage Management are inline in Service Workspace.
- Call Types are Commercial, Operational, and Technical. Commercial/Technical use Port locations; Operational uses Canal Passage.
- Position includes omitted calls and remains stable. Sequence Number counts active calls only and renumbers.
- All displayed operational times show local port time and UTC in a consistent pattern.
- Voyage Number is unique; CVN is free-form and may be duplicated. Never identify a voyage by CVN alone.
- Voyage lifecycle is Planned → In-Progress → Completed; never add Confirmed.
- Executable schedules have no direct edit page. Every schedule change goes through a Draft Simulation scenario and Apply.
- Draft, Applied, and Discarded are scenario states. Applied and Discarded are terminal.
- Omitted calls remain visible, muted, non-editable, and can be unomitted when permitted.
- Actual departure locks the current and previous calls; the next call remains open. Only a Schedule Administrator can unlock in Simulation.
- Baseline is dashed/outline, actual/executable is solid, projected is patterned/tinted and labeled `Projected — not committed`.
- Feeder voyages use a minimal separate form with free-text Vessel Name, CVN, Operator, and per-call Arrival/Departure only.
- Port Distance has one record per ordered pair, supports manual or API source, and an API proposal must be Approved before calculation.

Use this persistent application-flow context:

- The recommended authenticated starting point is Schedule Monitor (`SCR-002`). Sign in (`SCR-001`) is an optional entry step that returns the user to Schedule Monitor after success.
- Preserve one common shell and stable routes. Sidebar, breadcrumbs, global search, contextual links, and success actions must lead to existing supported screens rather than dead ends.
- Primary customer flow: Schedule Monitor deviation → deviation detail → Voyage Detail → create/open Draft Simulation → edit future calls → compare scenarios → confirm Apply → Applied success → refreshed Schedule Monitor.
- Secondary planning flow: Services List → Service Workspace → Line Study Editor → return to Service Workspace → inspect Cycle Plan Definition and generated voyages → Voyage Detail.
- Supporting flows cover report capture to deviation review, feeder voyage creation, missing port-distance resolution, administration, and viewer search/export.
- Preserve filters, selected organization, user role, voyage/service identity, and relevant scroll or tab context when navigating back. Warn before abandoning unsaved edits.
- Enforce permission and lock branches. If an action is unavailable, explain why and provide a supported next step; do not silently hide all evidence of the capability.
- Every modal, drawer, editor, error, empty state, and success state must have a clear exit or next action. Do not create unreachable pages or dead-end interactions.
- Do not make future ERP placeholder modules navigable. Do not invent routes or workflows for excluded capabilities.

Use fictional, internally consistent customer-demo data. Default service: `AEX — Arabian Express`; voyage `VOY-2026-0148`; CVN `AEX-071W`; vessel `MV Meridian Star`; IMO `9876543`; ports Jebel Ali `AEJEA`, Sohar `OMSOH`, Suez Canal `EGSUZ`, Jeddah `SAJED`, and Aqaba `JOAQJ`; demonstration period 14–28 Jul 2026; an 11-hour delay at Sohar. Mark the environment `DEMO` and never imply data is live or real.

Target 1440 px desktop first and provide 1280 px laptop fidelity. Define tablet and narrow variants: preserve monitor/detail, reduce table columns, use expandable rows/full-height sheets, and state honestly when complex editing requires a larger screen. Do not compress wide data until it becomes unreadable.

Design toward WCAG 2.1 AA: sufficient contrast, visible focus, keyboard order, non-color status cues, accessible labels/errors, table alternatives for timelines, text alternatives for the static map, and reduced-motion behavior.

Create complete primary frames plus component/state variants for empty, loading, error, success, read-only, permission-limited, locked, omitted, partial-success, and service-unavailable conditions. Use exact consequence-specific confirmations for Apply, Actualize, Unlock, Approve, Deactivate, Delete, and Discard. Preserve context after errors and overlays.

Keep all business-affecting assumptions visible as design annotations. Do not convert sample data, provisional brand choices, responsive treatments, global search, notifications, audit UI, feeder-link behavior, report-field samples, scenario naming, or edit-lock mechanics into confirmed requirements.
