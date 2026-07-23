# Designer Hands-On — Using This Package in Figma Make

## The short answer

Do **not** paste every Markdown file into Figma Make.

Use the package in five execution stages:

1. Load the complete persistent guideline bundle: use [figma-prompts/00_FIGMA_MAKE_MASTER_PROMPT.md](figma-prompts/00_FIGMA_MAKE_MASTER_PROMPT.md) as Figma Make's main `Guidelines.md`, then copy every file from [figma-prompts/guidelines/](figma-prompts/guidelines/) into the Make `guidelines/` folder.
2. Paste [figma-prompts/01_PLATFORM_SHELL_PROMPT.md](figma-prompts/01_PLATFORM_SHELL_PROMPT.md) into chat once.
3. Paste [figma-prompts/02_USER_FLOW_AND_ROUTING_PROMPT.md](figma-prompts/02_USER_FLOW_AND_ROUTING_PROMPT.md) into chat once so Make understands routes, cross-screen journeys, state transfer, permission branches, and return paths.
4. Paste one `SCR-###` prompt at a time and attach only its matching file from `screen-specifications/`.
5. After all required screens exist, paste [figma-prompts/99_FINAL_FLOW_INTEGRATION_PROMPT.md](figma-prompts/99_FINAL_FLOW_INTEGRATION_PROMPT.md) to connect and verify the functional prototype.

The top-level documents remain the detailed source of truth. Their confirmed, actionable content is compiled into named persistent guideline files plus the Shell, Routing, screen, and final-integration prompts. The operator does not paste the source documents again, but must load the complete guideline bundle; the Master file alone is not sufficient.

This follows Figma's current model: the first prompt should define a clear scope, persistent rules can live in `Guidelines.md`, and `.md` files can be attached as focused reference material. Figma also warns that more context is not always better because it can confuse the model.

## What Figma Make will produce

Figma Make creates a code-based functional prototype, web app, or interactive UI. It does not directly create the final native Figma component library described in this package.

Use Figma Make to establish the working experience, responsive behavior, states, and interactions. When the result is stable, a paid-plan user can copy the preview as design layers into Figma Design. Those copied layers do not remain synchronized with the Make file. Build the approved native variables, styles, components, and variants in Figma Design using [09_DESIGN_SYSTEM.md](09_DESIGN_SYSTEM.md) and [10_COMPONENT_LIBRARY.md](10_COMPONENT_LIBRARY.md).

## Exact workflow for the designer

### Step 1 — Review decisions before generating

Read these files outside Figma Make:

- [00_READ_ME_FIRST.md](00_READ_ME_FIRST.md)
- [02_PRODUCT_DESIGN_BRIEF.md](02_PRODUCT_DESIGN_BRIEF.md)
- [03_DESIGN_MANIFEST.md](03_DESIGN_MANIFEST.md)
- [16_UX_GAPS_AND_ASSUMPTIONS.md](16_UX_GAPS_AND_ASSUMPTIONS.md)

Resolve any business-critical gap that would materially change the first flow. Do not let Make silently turn an unresolved assumption into a product requirement.

### Step 2 — Create the Make file and optional style context

Create one Figma Make file for the Service & Schedule prototype.

If an approved Figma Design library already exists and the plan supports the feature, select that library as style context **before** starting generation. If no approved library exists, skip this step and use the visual rules in the master prompt. Do not select an experimental or unrelated library merely to fill the slot.

### Step 3 — Set the persistent guidelines

In Figma Make:

1. Open **Code**.
2. In the file explorer, open `guidelines/Guidelines.md`.
3. Paste the complete content of [figma-prompts/00_FIGMA_MAKE_MASTER_PROMPT.md](figma-prompts/00_FIGMA_MAKE_MASTER_PROMPT.md) below any required system text.
4. In the same Figma Make `guidelines/` folder, create these files and paste the complete matching local content into each one:

   | Figma Make guideline file | Local source to copy |
   |---|---|
   | `00_PRODUCT_SCOPE_AND_MANIFEST.md` | [figma-prompts/guidelines/00_PRODUCT_SCOPE_AND_MANIFEST.md](figma-prompts/guidelines/00_PRODUCT_SCOPE_AND_MANIFEST.md) |
   | `01_DESIGN_SYSTEM.md` | [figma-prompts/guidelines/01_DESIGN_SYSTEM.md](figma-prompts/guidelines/01_DESIGN_SYSTEM.md) |
   | `02_COMPONENTS_AND_VISUALIZATION.md` | [figma-prompts/guidelines/02_COMPONENTS_AND_VISUALIZATION.md](figma-prompts/guidelines/02_COMPONENTS_AND_VISUALIZATION.md) |
   | `03_ROLES_AND_PERMISSIONS.md` | [figma-prompts/guidelines/03_ROLES_AND_PERMISSIONS.md](figma-prompts/guidelines/03_ROLES_AND_PERMISSIONS.md) |
   | `04_CONTENT_AND_UX_WRITING.md` | [figma-prompts/guidelines/04_CONTENT_AND_UX_WRITING.md](figma-prompts/guidelines/04_CONTENT_AND_UX_WRITING.md) |
   | `05_RESPONSIVE_AND_ACCESSIBILITY.md` | [figma-prompts/guidelines/05_RESPONSIVE_AND_ACCESSIBILITY.md](figma-prompts/guidelines/05_RESPONSIVE_AND_ACCESSIBILITY.md) |
   | `06_PLATFORM_IA_AND_FLOW_RULES.md` | [figma-prompts/guidelines/06_PLATFORM_IA_AND_FLOW_RULES.md](figma-prompts/guidelines/06_PLATFORM_IA_AND_FLOW_RULES.md) |

5. Save all eight guideline files before sending the Shell Prompt.

If the Make file does not allow additional guideline files, append the seven files to `Guidelines.md` after the Master content in numeric order. Do not omit a file and do not place these documents in the application-code root.

Do this once per Make file. Do not paste the master prompt again before every screen.

The Master Prompt supplies immutable cross-product rules and an index to the bundle. The seven persistent files supply the detailed scope/manifest, exact design tokens, component/visualization behavior, role matrix, content rules, responsive/accessibility rules, and platform/IA/flow contract. Together—not the Master alone—they replace direct pasting of the top-level source documents.

Before continuing, ask Make:

> Without changing code or UI, list the eight persistent guideline files you can read and summarize each in one sentence. If any file is unavailable, stop and name it.

Continue only when all eight are acknowledged.

### Step 4 — Generate the common shell

Paste the complete content of [figma-prompts/01_PLATFORM_SHELL_PROMPT.md](figma-prompts/01_PLATFORM_SHELL_PROMPT.md) into the Figma Make chat and send it.

Review the generated shell before continuing:

- The Service & Schedule navigation is active.
- Future ERP modules are disabled and labeled `Coming later`.
- The `DEMO` environment is visible.
- Desktop, laptop, tablet, and narrow navigation behavior is coherent.
- The shell is implemented as reusable application structure rather than duplicated page markup.

Correct shell problems now. Every later screen depends on this foundation.

### Step 5 — Establish User Flow and routing

Paste the complete content of [figma-prompts/02_USER_FLOW_AND_ROUTING_PROMPT.md](figma-prompts/02_USER_FLOW_AND_ROUTING_PROMPT.md) into chat after the shell is stable.

This step transfers the Make-relevant content of [05_INFORMATION_ARCHITECTURE.md](05_INFORMATION_ARCHITECTURE.md), [06_PERSONAS_AND_ACCESS.md](06_PERSONAS_AND_ACCESS.md), [07_USER_FLOWS.md](07_USER_FLOWS.md), [08_SCREEN_INVENTORY.md](08_SCREEN_INVENTORY.md), and the routing portion of [14_PROTOTYPE_AND_PRESENTATION_PLAN.md](14_PROTOTYPE_AND_PRESENTATION_PLAN.md). It establishes routes and interaction contracts without asking Make to design every detailed screen at once.

Review that:

- Schedule Monitor is the default authenticated route and Sign In is an optional entry.
- Every supported screen has a stable destination.
- Primary and supporting flows have explicit starts, decisions, success paths, failure paths, and returns.
- State, filters, identity, permissions, locks, and dirty-form protection are preserved across navigation.
- Future ERP modules and `SCR-017` are excluded from customer navigation.

### Step 6 — Generate one screen at a time

For each screen:

1. Choose one file from `figma-prompts/SCR-###_*_PROMPT.md`.
2. Add its matching `screen-specifications/SCR-###_*.md` file as an attachment.
3. Paste the complete screen-prompt content into chat.
4. Add this one-line instruction above it:

   > Build only this screen and its required states. Preserve the existing shell and design system. Treat the attached specification as acceptance reference, not as permission to expand scope.

5. Send the prompt and wait for the screen to finish.
6. Compare the result with the attached specification and [review/02_FIGMA_OUTPUT_REVIEW_CHECKLIST.md](review/02_FIGMA_OUTPUT_REVIEW_CHECKLIST.md).
7. Fix material issues before moving to the next screen.

The prompt and specification use the same screen number. For example:

| Chat input | Attachment |
|---|---|
| `figma-prompts/SCR-002_SCHEDULE_MONITOR_PROMPT.md` | `screen-specifications/SCR-002_SCHEDULE_MONITOR.md` |
| `figma-prompts/SCR-004_SERVICE_WORKSPACE_PROMPT.md` | `screen-specifications/SCR-004_SERVICE_WORKSPACE.md` |
| `figma-prompts/SCR-008_SIMULATION_COCKPIT_PROMPT.md` | `screen-specifications/SCR-008_SIMULATION_COCKPIT.md` |

Use the same pairing rule for `SCR-001` through `SCR-017`.

### Step 7 — Make focused corrections

For a small visual change, use Figma Make's point-and-edit capability when practical. For a behavioral or cross-state correction, use a short, targeted chat prompt:

> Keep the existing shell and all unrelated screens unchanged. On `[screen name]`, correct only `[component or behavior]`. Apply `[specific section]` of the attached screen specification. Preserve the existing tokens, data, responsive behavior, and confirmed business rules.

Do not resend the master prompt, shell prompt, or several unrelated documents for a local correction.

### Step 8 — Integrate and test the customer story

After all required screens exist, paste the complete content of [figma-prompts/99_FINAL_FLOW_INTEGRATION_PROMPT.md](figma-prompts/99_FINAL_FLOW_INTEGRATION_PROMPT.md) into chat. This is the Make-ready execution of [14_PROTOTYPE_AND_PRESENTATION_PLAN.md](14_PROTOTYPE_AND_PRESENTATION_PLAN.md): it checks the connected customer story, route integrity, state transfer, error recovery, permissions, accessibility, and dead ends without redesigning approved screens.

Run these human review gates:

- [review/01_PRODUCT_DESIGN_REVIEW_CHECKLIST.md](review/01_PRODUCT_DESIGN_REVIEW_CHECKLIST.md)
- [review/02_FIGMA_OUTPUT_REVIEW_CHECKLIST.md](review/02_FIGMA_OUTPUT_REVIEW_CHECKLIST.md)
- [review/03_CLIENT_PRESENTATION_CHECKLIST.md](review/03_CLIENT_PRESENTATION_CHECKLIST.md)
- [review/04_FIGMA_MAKE_CONTEXT_COVERAGE_CHECKLIST.md](review/04_FIGMA_MAKE_CONTEXT_COVERAGE_CHECKLIST.md)
- [15_REQUIREMENT_TRACEABILITY.md](15_REQUIREMENT_TRACEABILITY.md)

These are QA inputs for the designer and product owner. Do not paste them into Make.

### Step 9 — Move approved work to Figma Design when needed

When the interactive prototype is stable:

1. Copy the relevant Make preview as design layers into Figma Design.
2. Organize the native Figma file using the information architecture and screen inventory.
3. Rebuild approved tokens and repeated UI as native variables, styles, components, and variants.
4. Recheck accessibility, responsive layouts, content, and traceability.

Remember that later changes in Figma Design do not update the Figma Make file automatically.

## Which Markdown files go into Figma Make?

| File or folder | Use in Make | Designer action |
|---|---|---|
| `figma-prompts/00_FIGMA_MAKE_MASTER_PROMPT.md` | **Yes—once** | Put its full content in the main `Guidelines.md`. |
| `figma-prompts/guidelines/*.md` | **Yes—all seven, once** | Create matching persistent files in Make's `guidelines/` folder, or append them to the main file in numeric order. |
| `figma-prompts/01_PLATFORM_SHELL_PROMPT.md` | **Yes—once** | Paste its full content into chat after the guidelines are ready. |
| `figma-prompts/02_USER_FLOW_AND_ROUTING_PROMPT.md` | **Yes—once** | Paste after the shell to establish routes and cross-screen flows. |
| `figma-prompts/SCR-###_*_PROMPT.md` | **Yes—one at a time** | Paste the complete matching screen prompt into chat. |
| `figma-prompts/99_FINAL_FLOW_INTEGRATION_PROMPT.md` | **Yes—once at the end** | Paste after required screens exist to connect and verify the prototype. |
| `screen-specifications/SCR-###_*.md` | **Yes—one matching attachment** | Attach only the specification for the screen being generated or corrected. |
| `screen-specifications/SCREEN_TEMPLATE.md` | No | Designer reference for consistency; it is not a product screen. |
| Top-level `00–14` documents | **No direct paste** | Their Make-relevant content is compiled into the persistent guideline bundle and action prompts; retain them as detailed source and human review material. |
| `15_REQUIREMENT_TRACEABILITY.md` | No | Use for product-owner and QA validation. |
| `16_UX_GAPS_AND_ASSUMPTIONS.md` | **Never wholesale** | Resolve decisions outside Make. Mention one approved assumption only when it is required for the current screen. |
| `17_DESIGNER_HANDS_ON_FIGMA_MAKE.md` | No | Operator instructions; do not use it as product context. |
| `review/*.md` | No | Complete manually after generation. |

## Source-to-Make coverage map

`Make must understand it` does not mean `paste the original document`. It means the relevant, confirmed, actionable instructions from that source must have a named Make-ready carrier. Use this map to verify that nothing essential has disappeared between the design package and Figma Make.

| Detailed source in `design/` | What Make must understand | Make-ready carrier | What stays human-only |
|---|---|---|---|
| `01_SOURCE_ANALYSIS.md` | Confirmed scope, exclusions, terminology, and resolved conflicts | `guidelines/00_PRODUCT_SCOPE_AND_MANIFEST.md` + affected screen prompts | Evidence review, source history, document comparison |
| `02_PRODUCT_DESIGN_BRIEF.md` | Product purpose, audience implications, scope, outcomes, usability and success criteria | `guidelines/00_PRODUCT_SCOPE_AND_MANIFEST.md` | Stakeholder planning detail |
| `03_DESIGN_MANIFEST.md` | Product personality, density, hierarchy, interaction principles, constraints, decision priority | `guidelines/00_PRODUCT_SCOPE_AND_MANIFEST.md` | Design-critique rationale |
| `04_ERP_PLATFORM_SHELL.md` | Common shell, navigation, search, overlays, feedback/loading, responsive shell, future-module restrictions | `guidelines/06_PLATFORM_IA_AND_FLOW_RULES.md` + Platform Shell Prompt | Extended shell rationale |
| `05_INFORMATION_ARCHITECTURE.md` | Entity hierarchy, parent/child behavior, navigation, cross-links, filters, deliberate exclusions | `guidelines/06_PLATFORM_IA_AND_FLOW_RULES.md` + Routing Prompt | IA workshop explanation |
| `06_PERSONAS_AND_ACCESS.md` | Four roles, union/Admin superset, full capability matrix, permission-sensitive states | `guidelines/03_ROLES_AND_PERMISSIONS.md` + relevant screen prompts | Persona research narrative |
| `07_USER_FLOWS.md` | F-01 through F-08 starts, decisions, transitions, exceptions, success/failure, returns | `guidelines/06_PLATFORM_IA_AND_FLOW_RULES.md` + Routing Prompt + Final Integration Prompt | Mermaid diagrams |
| `08_SCREEN_INVENTORY.md` | Supported screen registry, route targets, customer/internal distinction | `guidelines/06_PLATFORM_IA_AND_FLOW_RULES.md` + Routing Prompt + screen prompts | Production tracking metadata |
| `09_DESIGN_SYSTEM.md` | Exact colors, typography, spacing, grid, breakpoints, density, states, focus, tokens, motion | `guidelines/01_DESIGN_SYSTEM.md` | Native Figma implementation after Make |
| `10_COMPONENT_LIBRARY.md` | Shared anatomy, variants, states, behavior, accessibility, responsive use | `guidelines/02_COMPONENTS_AND_VISUALIZATION.md` + screen prompts/specifications | Native Figma component authoring after Make |
| `11_DATA_VISUALIZATION_GUIDE.md` | Catalogue, encoding, interaction, alternatives, and prohibited charts/maps | `guidelines/02_COMPONENTS_AND_VISUALIZATION.md` + relevant screen prompts | Manual visual QA |
| `12_CONTENT_AND_UX_WRITING.md` | Voice, terminology, formats, labels, helper text, validation, confirmations, success/error/empty copy | `guidelines/04_CONTENT_AND_UX_WRITING.md` + screen prompts | Editorial approval |
| `13_RESPONSIVE_AND_ACCESSIBILITY.md` | Viewports, transformations, reduced columns, keyboard/focus, contrast, forms/tables, alternatives, live regions | `guidelines/05_RESPONSIVE_AND_ACCESSIBILITY.md` + screen prompts + Final Integration Prompt | Manual assistive-technology review |
| `14_PROTOTYPE_AND_PRESENTATION_PLAN.md` | Start, main/secondary paths, transitions, fallback, closing state | `guidelines/06_PLATFORM_IA_AND_FLOW_RULES.md` + Routing + Final Integration Prompt | Presenter duration and speaking narrative |
| `15_REQUIREMENT_TRACEABILITY.md` | No creative context required | None; validate output outside Make | Requirement audit and approval evidence |
| `16_UX_GAPS_AND_ASSUMPTIONS.md` | Only individually resolved decisions required by the current screen | Targeted correction prompt after approval | Open questions and unresolved alternatives |
| `17_DESIGNER_HANDS_ON_FIGMA_MAKE.md` | Nothing; it describes the operating process | None | Operator instructions |

If a root document changes, update its named persistent guideline and affected action/screen prompt before generating more screens. The root document remains authoritative; the carrier is its controlled operational translation. Do not mark coverage complete when only a summary claim exists.

## When another Markdown file may be attached

Attach or quote part of another file only when all three conditions are true:

1. The current Make output has a specific problem.
2. The master prompt and matching screen specification do not contain enough detail to correct it.
3. You can identify one relevant section instead of sending the entire document.

Examples:

- Attach the relevant portion of [09_DESIGN_SYSTEM.md](09_DESIGN_SYSTEM.md) when typography or status colors remain inconsistent.
- Quote a small section from [12_CONTENT_AND_UX_WRITING.md](12_CONTENT_AND_UX_WRITING.md) when labels, confirmations, or errors are incorrect.
- Quote one approved decision from [16_UX_GAPS_AND_ASSUMPTIONS.md](16_UX_GAPS_AND_ASSUMPTIONS.md) after the product owner has resolved it.

Always state how Make should use the attachment: exact requirement, acceptance reference, real content, or visual inspiration.

## Do not do this

- Do not paste or attach the entire `design/` folder.
- Do not send several screen prompts in one generation request.
- Do not repeatedly resend persistent rules already stored in `Guidelines.md`.
- Do not attach traceability tables or review checklists as creative prompts.
- Do not let a sample value, placeholder module, or unresolved assumption become a confirmed feature.
- Do not expect copied Make layers to become a synchronized, production-ready Figma design system automatically.

## Current official Figma references

This operating method was checked against Figma's current guidance on 20 July 2026:

- [Create and edit a functional prototype or web app](https://help.figma.com/hc/en-us/articles/31304485164695-Create-and-edit-a-functional-prototype-or-web-app)
- [Add guidelines to Figma Make](https://help.figma.com/hc/en-us/articles/33665861260823-Add-guidelines-to-Figma-Make)
- [Attach files to a prompt](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-files-to-a-prompt)
- [Bring style context from a Figma Design library into Figma Make](https://help.figma.com/hc/en-us/articles/33024539096471)
- [Best practices for optimizing AI credits in Figma Make](https://help.figma.com/hc/en-us/articles/40097793879191)
- [Figma Make FAQs](https://help.figma.com/hc/en-us/articles/31722591905559-Figma-Make-FAQs)
