# Design Prompt Package — Service & Schedule

## Purpose

This package translates the workspace's business, requirements, user-story, role, and application-design evidence into an English, left-to-right product-design specification for a high-fidelity, clickable customer prototype. It is intended for a product designer working in Figma and for an operator using Figma Make. It does not define implementation code.

The design context required by the current brief is a common maritime ERP platform shell. Only **Service & Schedule** is designed in functional depth. The source documents describe the capability as a standalone product; this package preserves its confirmed functional rules while presenting it as a module inside the requested common shell. Future ERP modules are navigation placeholders only.

## Intended audience

- Product and UX designers creating the Figma file and prototype.
- Product owners validating scope, assumptions, and traceability.
- Maritime operations, line-management, trade, and administration stakeholders reviewing the customer story.
- Figma Make operators generating initial frames and variants.
- Engineering teams using an approved design as later implementation input.

## Authority model

Use the sources in this order when resolving product behavior:

1. The current design-package brief governs deliverables, platform-shell context, language, visual quality, accessibility, and responsive guidance.
2. [Requirements v1.3](../Requirement/requirements.md) governs confirmed MVP behavior and supersedes older vision statements.
3. [User stories](../User%20story/stories.md) and [personas](../User%20story/personas.md) govern interaction acceptance and role intent.
4. [Application design](../Application%20Design/application-design.md) and its companion files govern established module boundaries and UI feature slices where they do not conflict with requirements.
5. [Technical environment](../Vision%20Documents/Technical-Environment-Standalone-Final.md) supplies implementation-aware UX constraints.
6. [Vision v1.2](../Vision%20Documents/Vision-Services-Schedules-Standalone-Final.md) supplies business context and future direction; its older or full-vision statements are not automatically MVP requirements.
7. [Business Role Mapping.xlsx](../Business%20Role%20Mapping.xlsx) corroborates representative job-role-to-security-role mapping.

Never turn a sample value, future module label, presentation theme, or provisional shell choice into a confirmed business rule. All material uncertainties are centralized in [16_UX_GAPS_AND_ASSUMPTIONS.md](16_UX_GAPS_AND_ASSUMPTIONS.md).

## Recommended reading order

1. If using Figma Make, begin with [17_DESIGNER_HANDS_ON_FIGMA_MAKE.md](17_DESIGNER_HANDS_ON_FIGMA_MAKE.md) to understand exactly what to paste, attach, and keep outside the chat.
2. Read [01_SOURCE_ANALYSIS.md](01_SOURCE_ANALYSIS.md) and [16_UX_GAPS_AND_ASSUMPTIONS.md](16_UX_GAPS_AND_ASSUMPTIONS.md) to understand evidence and uncertainty.
3. Read [02_PRODUCT_DESIGN_BRIEF.md](02_PRODUCT_DESIGN_BRIEF.md) and [03_DESIGN_MANIFEST.md](03_DESIGN_MANIFEST.md) for scope and design rules.
4. Read [04_ERP_PLATFORM_SHELL.md](04_ERP_PLATFORM_SHELL.md), [05_INFORMATION_ARCHITECTURE.md](05_INFORMATION_ARCHITECTURE.md), and [06_PERSONAS_AND_ACCESS.md](06_PERSONAS_AND_ACCESS.md).
5. Use [07_USER_FLOWS.md](07_USER_FLOWS.md) and [08_SCREEN_INVENTORY.md](08_SCREEN_INVENTORY.md) to plan pages and prototype links.
6. Build shared foundations from [09_DESIGN_SYSTEM.md](09_DESIGN_SYSTEM.md), [10_COMPONENT_LIBRARY.md](10_COMPONENT_LIBRARY.md), [11_DATA_VISUALIZATION_GUIDE.md](11_DATA_VISUALIZATION_GUIDE.md), and [12_CONTENT_AND_UX_WRITING.md](12_CONTENT_AND_UX_WRITING.md).
7. Build frames from `screen-specifications/`, starting with `SCREEN_TEMPLATE.md` as a consistency reference.
8. Set the Figma Make guidelines once, run the shell prompt, then establish User Flow and routing before generating one screen at a time.
9. After the required screens exist, run the final flow-integration prompt based on [14_PROTOTYPE_AND_PRESENTATION_PLAN.md](14_PROTOTYPE_AND_PRESENTATION_PLAN.md).
10. Validate the result using `review/` and [15_REQUIREMENT_TRACEABILITY.md](15_REQUIREMENT_TRACEABILITY.md).

## How to use the Figma Make prompts

1. Put `figma-prompts/00_FIGMA_MAKE_MASTER_PROMPT.md` into the main Make `guidelines/Guidelines.md`, then create/copy all seven files from `figma-prompts/guidelines/` into the same persistent guidelines folder. The Master alone is not sufficient.
2. Ask Make to list and summarize the eight loaded guideline files without changing UI; stop if any file is missing.
3. Paste `figma-prompts/01_PLATFORM_SHELL_PROMPT.md` into chat once to create the reusable shell and responsive behavior.
4. Paste `figma-prompts/02_USER_FLOW_AND_ROUTING_PROMPT.md` once to establish the screen registry, cross-screen journeys, state transfer, permissions, and return paths.
5. Paste one `SCR-###` prompt at a time and attach only its matching file from `screen-specifications/`. Do not ask one generation step to create several unrelated screens.
6. Reuse the generated shell, routes, theme tokens, components, table density, content rules, permissions, and semantic statuses; do not allow later prompts to restyle or reinterpret them.
7. Treat each prompt's **Assumptions** section as a visible design note, not product truth.
8. Keep alternative states as variants or separate application states. Do not replace the primary presentation view with an error or empty state.
9. After generation, compare the view against its matching screen specification and the review checklists. Figma Make output is a draft, not an approval.
10. Paste `figma-prompts/99_FINAL_FLOW_INTEGRATION_PROMPT.md` after the required screens exist to connect and verify the functional customer journey.
11. Follow [17_DESIGNER_HANDS_ON_FIGMA_MAKE.md](17_DESIGNER_HANDS_ON_FIGMA_MAKE.md) for the complete workflow and source-to-Make coverage map.

## Package map

| Area | Purpose |
|---|---|
| `00–03` | Package usage, evidence, design brief, governing manifesto |
| `04–08` | Shell, information architecture, roles, flows, screen inventory |
| `09–13` | Tokens, components, visualization, content, responsive/accessibility rules |
| `14–17` | Prototype story, traceability, unresolved UX decisions, and the Figma Make operator guide |
| `screen-specifications/` | Authoritative per-screen behavior and content |
| `figma-prompts/guidelines/` | Seven persistent Make-ready guideline files for scope/manifest, design system, components/visualization, roles, content, responsive/accessibility, and platform/IA/flows |
| `figma-prompts/` | Master guideline index plus shell, routing, per-screen, and final-integration action prompts |
| `review/` | Product, Figma-output, and presentation quality gates |

## Confirmed, inferred, and provisional content

- **Confirmed** means directly supported by requirements or acceptance criteria.
- **Inferred** means a design organization consistent with confirmed rules but not stated as a business rule, such as using a drawer for port-call detail.
- **Assumed** means a temporary decision needed to make a coherent prototype and requiring business confirmation.
- **Placeholder** means broader-platform context only and must not imply a delivered capability.
- **Deferred** means explicitly excluded from MVP or not sufficiently defined for prototyping.

The screen inventory and traceability tables use these labels. When in doubt, preserve the distinction in the Figma annotations.
