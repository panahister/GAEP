# Figma Make Context Coverage Checklist

## Purpose

Use this checklist before the first generation and whenever a top-level design source changes. It verifies that every Make-relevant concern has a real persistent or action-prompt carrier. This file is a human QA artifact and must not be pasted into Figma Make.

## Persistent bundle load gate

- [ ] Main Figma Make `guidelines/Guidelines.md` contains the complete `00_FIGMA_MAKE_MASTER_PROMPT.md`.
- [ ] `00_PRODUCT_SCOPE_AND_MANIFEST.md` exists in Make guidelines and is readable.
- [ ] `01_DESIGN_SYSTEM.md` exists in Make guidelines and is readable.
- [ ] `02_COMPONENTS_AND_VISUALIZATION.md` exists in Make guidelines and is readable.
- [ ] `03_ROLES_AND_PERMISSIONS.md` exists in Make guidelines and is readable.
- [ ] `04_CONTENT_AND_UX_WRITING.md` exists in Make guidelines and is readable.
- [ ] `05_RESPONSIVE_AND_ACCESSIBILITY.md` exists in Make guidelines and is readable.
- [ ] `06_PLATFORM_IA_AND_FLOW_RULES.md` exists in Make guidelines and is readable.
- [ ] Make can list all eight files and summarize their purpose without changing code/UI.
- [ ] No persistent guideline was copied into the application-code root by mistake.

## Source-to-carrier audit

| Root source | Required concerns | Carrier to inspect | Approval check |
|---|---|---|---|
| `01_SOURCE_ANALYSIS.md` | Final scope/out-of-scope, terminology, roles, workflows, NFR implications, conflict resolution | `00_PRODUCT_SCOPE_AND_MANIFEST.md`, Master, affected screens | [ ] |
| `02_PRODUCT_DESIGN_BRIEF.md` | Purpose, audience implications, scope, users, workflows, entities, value, challenges, usability, quality, success | `00_PRODUCT_SCOPE_AND_MANIFEST.md` | [ ] |
| `03_DESIGN_MANIFEST.md` | Personality, principles, density, interaction, component/enterprise rules, accessibility/responsive stance, decision priority | `00_PRODUCT_SCOPE_AND_MANIFEST.md`, `01_DESIGN_SYSTEM.md`, `05_RESPONSIVE_AND_ACCESSIBILITY.md` | [ ] |
| `04_ERP_PLATFORM_SHELL.md` | Layout, identity, navigation, sidebar/top bar, search, notifications, profile, headers, overlays, feedback/loading, permission, responsive/accessibility | `06_PLATFORM_IA_AND_FLOW_RULES.md`, Platform Shell Prompt | [ ] |
| `05_INFORMATION_ARCHITECTURE.md` | Navigation hierarchy, entity hierarchy, parent/child behavior, paths, cross-links, filters, exclusions | `06_PLATFORM_IA_AND_FLOW_RULES.md`, Routing Prompt | [ ] |
| `06_PERSONAS_AND_ACCESS.md` | Four roles/codes, union, Admin superset, business combinations, capability matrix, denied-state treatment, unresolved access | `03_ROLES_AND_PERMISSIONS.md`, screen prompts/specifications | [ ] |
| `07_USER_FLOWS.md` | F-01–F-08 entry, steps, decisions, exceptions, success/failure, screens and returns | `06_PLATFORM_IA_AND_FLOW_RULES.md`, Routing Prompt, Final Integration Prompt | [ ] |
| `08_SCREEN_INVENTORY.md` | SCR-001–017 registry, purpose, class, route, customer/internal distinction, exclusions | Routing Prompt, screen prompts, Final Integration Prompt | [ ] |
| `09_DESIGN_SYSTEM.md` | Exact color/timeline tokens, typography, spacing, grid, breakpoints, border/radius/elevation, iconography, density, states, focus, changed state, naming, motion | `01_DESIGN_SYSTEM.md` | [ ] |
| `10_COMPONENT_LIBRARY.md` | Shell, table, filter, forms, status/feedback, domain component anatomy/variants/states/behavior/accessibility/responsive, deferred components | `02_COMPONENTS_AND_VISUALIZATION.md`, screen prompts/specifications | [ ] |
| `11_DATA_VISUALIZATION_GUIDE.md` | Seven visualizations, questions, encoding, interaction, empty/error, alternatives, prohibited charts/calendar/map | `02_COMPONENTS_AND_VISUALIZATION.md`, relevant screen prompts | [ ] |
| `12_CONTENT_AND_UX_WRITING.md` | Voice, terminology, formats, actions, helper, validation, confirmations, success, empty/error/partial, tooltips, demo content | `04_CONTENT_AND_UX_WRITING.md`, screen prompts | [ ] |
| `13_RESPONSIVE_AND_ACCESSIBILITY.md` | Viewports, per-width behavior, reduced columns, navigation/overlays, keyboard/focus/contrast, forms/tables/visual alternatives, announcements, review criteria | `05_RESPONSIVE_AND_ACCESSIBILITY.md`, screen prompts, Final Integration Prompt | [ ] |
| `14_PROTOTYPE_AND_PRESENTATION_PLAN.md` | Starting state, primary/secondary flow, data, transitions, fallback, closing state | `06_PLATFORM_IA_AND_FLOW_RULES.md`, Routing Prompt, Final Integration Prompt | [ ] |
| `15_REQUIREMENT_TRACEABILITY.md` | Requirement coverage and approval evidence | Human review only; screen specs and prompts carry requirement IDs | [ ] |
| `16_UX_GAPS_AND_ASSUMPTIONS.md` | Open decisions remain visible; resolved decisions propagate to affected carrier; no assumption becomes confirmed silently | Screen assumptions + targeted carrier update after approval | [ ] |

## Design System spot checks

- [ ] `#102A43`, `#087E8B`, all seven semantic pairs, and timeline patterns are present.
- [ ] Typography includes all nine named styles and tabular numerals.
- [ ] Spacing scale, 12/8/4-column grids, all five breakpoint bands, and Light-only mode are present.
- [ ] Table/input/button/chip density and `2px` focus ring are present.
- [ ] Changed-data marker and reduced-motion-safe behavior are present.

## Component and visualization spot checks

- [ ] Shared components are generated once and reused; later screens do not restyle them.
- [ ] Data Table, Editable Table, Filter, Column Customizer, Pagination, Export, Fields, Time Pair, Status, Banner, Dialog, Loading, Empty, and Error contracts are present.
- [ ] Route Sequence, Milestone Editor, Gantt, Scenario Rail, Change Summary, Static Position, and provisional Activity contracts are present.
- [ ] Gantt, voyage rotation, scenario diff, segmentation, static position, exception summary, and Line Study aggregate have non-visual alternatives.
- [ ] Calendar, vanity charts, live AIS, comments, and unsupported approval components remain excluded.

## Roles and content spot checks

- [ ] Role codes and union/Admin-superset behavior are exact.
- [ ] Editor does not gain Simulation; Simulation does not gain Editor; Admin unlock/approval remains privileged.
- [ ] Voyage Number and CVN are consistently disambiguated.
- [ ] `Baseline`, `Actual / executable`, and `Projected — not committed` are exact.
- [ ] Dates, local/UTC, units, button labels, validation, confirmations, and success/error messages follow the content guideline.

## Responsive and accessibility spot checks

- [ ] 1440 and 1280 support complete workflows.
- [ ] Tablet transformation and narrow larger-screen boundaries are implemented honestly.
- [ ] Required reduced columns exist for Services, Voyages, Port Distances, and Feeder.
- [ ] Keyboard, focus restoration, contrast, non-color cues, form/table semantics, and live regions are implemented.
- [ ] Monitor and scenario visuals have equivalent table/diff representations.
- [ ] 200% zoom and reduced motion preserve actions and meaning.

## Execution order gate

- [ ] Persistent guideline bundle loaded and acknowledged.
- [ ] Platform Shell Prompt completed and corrected.
- [ ] User Flow and Routing Prompt completed and route placeholders verified.
- [ ] Each required `SCR-###` prompt is executed separately with its matching specification attached.
- [ ] Local corrections remain targeted and do not override persistent rules.
- [ ] Final Flow Integration Prompt completes with no unreported dead link or placeholder.
- [ ] Product, Figma-output, client-presentation, traceability, and this context-coverage review are complete.

## Change-control rule

When any root source changes:

1. Identify every affected persistent guideline, action prompt, screen prompt, and specification.
2. Update all affected carriers before more generation.
3. Re-run the relevant sections of this checklist.
4. Ask Make to summarize the changed guideline before applying a targeted correction.
5. Record unresolved product decisions as assumptions; do not silently encode them.
