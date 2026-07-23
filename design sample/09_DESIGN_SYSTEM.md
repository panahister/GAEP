# Design System

## Provisional visual identity

No approved brand identity exists in the sources. Use a provisional maritime-enterprise theme named **Northstar** for presentation only. It should feel calm, precise, international, and operational. The Figma file must label brand variables as `provisional` and keep semantic colors independent so customer branding can change without rebuilding status logic.

## Color system

### Provisional brand palette

| Token | Proposed value | Use |
|---|---:|---|
| `brand.navy.900` | `#102A43` | Sidebar, high-emphasis headings |
| `brand.navy.800` | `#163A5F` | Selected navigation, primary hover |
| `brand.ocean.600` | `#087E8B` | Primary action and focus-compatible accent |
| `brand.ocean.700` | `#066773` | Primary action hover |
| `brand.sky.100` | `#E8F3F6` | Selected rows, informational tint |
| `neutral.950` | `#111827` | Primary text |
| `neutral.700` | `#374151` | Secondary text |
| `neutral.500` | `#6B7280` | Muted metadata |
| `neutral.300` | `#D1D5DB` | Strong borders |
| `neutral.200` | `#E5E7EB` | Standard borders |
| `neutral.100` | `#F3F4F6` | Subtle surfaces |
| `neutral.50` | `#F8FAFC` | Canvas |
| `white` | `#FFFFFF` | Primary surface |

Validate final contrast in Figma; values are proposed, not approved branding.

### Semantic palette

| Semantic token | Proposed foreground / background | Meaning |
|---|---|---|
| `success` | `#166534` / `#DCFCE7` | Applied, approved, import completed, on time |
| `warning` | `#92400E` / `#FEF3C7` | At risk, proposed, incomplete, attention |
| `danger` | `#B42318` / `#FEE4E2` | Late, blocked, failed, destructive |
| `info` | `#175CD3` / `#EFF8FF` | Projected, informational, system-derived |
| `early` | `#5B21B6` / `#F3E8FF` | Early arrival, distinct from success |
| `locked` | `#475467` / `#EAECF0` | Locked/non-editable history |
| `omitted` | `#52525B` / `#F4F4F5` | Omitted call with strike/pattern cue |

Semantic meaning must not depend on brand colors. Do not use green for Active if it conflicts with “on time”; service Active may use neutral-info styling.

## Timeline layer tokens

- `timeline.baseline`: transparent/white fill, navy-gray dashed 1.5 px outline, label `Baseline`.
- `timeline.executable`: solid brand navy/teal; status variant adds edge or badge, label `Actual / executable`.
- `timeline.projected`: blue-lavender 30% tint with diagonal pattern or dotted top edge, label `Projected — not committed`.
- `timeline.now`: 2 px red-coral line with text `Now`.
- `timeline.variance`: compact signed-hour badge with semantic early/late color and text.

## Typography

Use **Inter** as the provisional UI font, with system sans-serif fallback. It is neutral, legible, and internationally familiar. If customer policy restricts external fonts, use `Arial`/system sans without changing scale.

| Style token | Size / line | Weight | Use |
|---|---:|---:|---|
| `display.sm` | 28 / 36 | 600 | Module landing title only |
| `heading.lg` | 24 / 32 | 600 | Page H1 |
| `heading.md` | 20 / 28 | 600 | Section title |
| `heading.sm` | 16 / 24 | 600 | Card/drawer heading |
| `body.md` | 14 / 20 | 400 | Default body and table |
| `body.sm` | 13 / 18 | 400 | Dense secondary content |
| `label.md` | 14 / 20 | 500 | Form/control label |
| `label.sm` | 12 / 16 | 600 | Table header, chip, eyebrow |
| `mono.sm` | 12 / 18 | 500 | Identifiers/timestamps where alignment helps |

Do not use all caps for long labels. Use tabular numerals for times, durations, and distance columns.

## Spacing

Base unit: 4 px. Core scale: `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. Use 8 px within components, 16–24 px between groups, and 24–32 px between page sections. Compact table cells use 8–12 px horizontal padding.

## Layout grid

- 1440 desktop: 12-column fluid content grid, 24 px gutters, 24–32 px page margins after sidebar.
- 1280 laptop: 12 columns, 20 px gutters, 20–24 px margins.
- Tablet: 8 columns, 16 px gutters/margins.
- Narrow: 4 columns, 12–16 px gutters/margins.
- Forms use a 720–960 px readable column; data workspaces use full width.
- Simulation uses a three-region layout: scenario/navigation rail 240–280 px, main schedule flexible, inspector/change summary 320–380 px. At laptop width, inspector becomes a drawer.

## Breakpoints

| Token | Range | Intent |
|---|---:|---|
| `bp.xl` | ≥1600 | Wide operations room / presentation |
| `bp.lg` | 1440–1599 | Primary design target |
| `bp.md` | 1280–1439 | Standard laptop |
| `bp.sm` | 768–1279 | Tablet / reduced-workspace |
| `bp.xs` | <768 | Narrow read-first |

## Borders, radius, elevation

- Standard border: 1 px `neutral.200`; emphasized boundary: `neutral.300`.
- Radius: 4 px for dense inputs/table controls, 6 px standard, 8 px dialogs/cards. Avoid large rounded cards.
- Elevation: canvas 0; sticky header 1; dropdown/drawer 2; dialog 3. Use subtle shadows with borders, not floating-card stacks.

## Iconography

Use a single outlined icon family at 16/20/24 px. Prefer domain-neutral symbols plus text. Recommended mappings: route/connected-nodes for Services, calendar-clock for Schedule Monitor, ship for Voyages, flask/branch for Simulation, file-upload for Reports, database for Reference Data, ruler/route for Port Distances, users for Administration. Do not use national flags as country identifiers.

## Density

Default `Comfortable compact`:

- Table row 40 px; expandable detail row variable.
- Input 36 px; primary button 36–40 px.
- Page header 72–88 px excluding breadcrumbs.
- Chips 24 px.
- Dense milestone tables may use 36 px rows but must retain readable focus and targets.

Offer a table density control only on data-heavy list screens; do not expose app-wide density in the prototype.

## Interaction states

Every interactive component needs Default, Hover, Focus, Active/Pressed, Disabled, Loading, Error, and Success where applicable. Selected is distinct from hover. Disabled components keep legible labels and provide a reason when it affects task completion.

### Focus

Use a 2 px `brand.ocean.600` ring with 2 px offset against light surfaces; within dark sidebar use a high-contrast white/ocean composite ring. Never remove the browser focus indicator without an equivalent.

### Changed-data state

Scenario-modified cells use a subtle blue left inset and `Changed` screen-reader text/indicator. Newly recalculated downstream values use a temporary 2-second tint in prototype animation, then retain a small change marker until saved/applied.

## Token naming

Use Figma variables with semantic layers:

- Primitives: `color/neutral/200`, `space/16`, `radius/6`.
- Semantic: `surface/default`, `text/primary`, `status/danger/bg`, `timeline/projected/fill`.
- Component: `table/header/bg`, `button/primary/bg/default` only when a semantic token cannot express the role.

Modes: `Light` is required. `Dark` should not be generated for this prototype because data-dense timeline/status behavior has not been validated and customer presentation consistency matters more. Architect tokens so a future dark mode remains possible.

## Motion

Use 120–200 ms ease-out for menus/drawers, 200–250 ms for panel transitions, and a restrained change highlight after recomputation. No decorative background motion. Respect reduced-motion preferences; scenario recalculation must also be understandable without animation.

