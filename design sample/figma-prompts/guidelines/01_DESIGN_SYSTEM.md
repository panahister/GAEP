# Design System Guidelines

## Provisional identity

Use the provisional presentation theme **Northstar**. It is calm, precise, international, operational, and clearly marked provisional. Keep brand values independent from semantic/status values so customer branding can change without rebuilding application meaning.

Implement the following as centralized CSS custom properties or equivalent application theme tokens. Do not scatter raw values through screen code.

## Brand and neutral color tokens

| Token | Value | Required use |
|---|---:|---|
| `--brand-navy-900` | `#102A43` | Sidebar and high-emphasis headings |
| `--brand-navy-800` | `#163A5F` | Selected navigation and primary hover |
| `--brand-ocean-600` | `#087E8B` | Primary action and focus accent |
| `--brand-ocean-700` | `#066773` | Primary action hover |
| `--brand-sky-100` | `#E8F3F6` | Selected rows and informational tint |
| `--neutral-950` | `#111827` | Primary text |
| `--neutral-700` | `#374151` | Secondary text |
| `--neutral-500` | `#6B7280` | Muted metadata |
| `--neutral-300` | `#D1D5DB` | Emphasized borders |
| `--neutral-200` | `#E5E7EB` | Standard borders |
| `--neutral-100` | `#F3F4F6` | Subtle surfaces |
| `--neutral-50` | `#F8FAFC` | Application canvas |
| `--white` | `#FFFFFF` | Primary surface |

Validate contrast in the generated result. These values are provisional brand/design values, not customer-approved identity.

## Semantic tokens

| Token | Foreground | Background | Meaning |
|---|---:|---:|---|
| `--status-success-fg/bg` | `#166534` | `#DCFCE7` | Applied, Approved, completed import, on time |
| `--status-warning-fg/bg` | `#92400E` | `#FEF3C7` | At risk, Proposed, incomplete, attention |
| `--status-danger-fg/bg` | `#B42318` | `#FEE4E2` | Late, blocked, failed, destructive |
| `--status-info-fg/bg` | `#175CD3` | `#EFF8FF` | Projected, informational, system-derived |
| `--status-early-fg/bg` | `#5B21B6` | `#F3E8FF` | Early timing, distinct from success |
| `--status-locked-fg/bg` | `#475467` | `#EAECF0` | Locked/non-editable history |
| `--status-omitted-fg/bg` | `#52525B` | `#F4F4F5` | Omitted call with text/pattern cue |

Semantic meaning never depends on brand color. Do not use green for Service Active when it could be confused with On time; use a neutral/info treatment for derived service status.

## Timeline tokens

- `timeline.baseline`: transparent/white fill, navy-gray dashed `1.5px` outline, visible label `Baseline`.
- `timeline.executable`: solid navy/teal with status edge/badge as needed, visible label `Actual / executable`.
- `timeline.projected`: blue-lavender 30% tint plus diagonal pattern or dotted top edge, visible label `Projected — not committed`.
- `timeline.now`: `2px` red-coral line plus text `Now`.
- `timeline.variance`: compact signed-hour badge such as `+11 h` or `−2 h`, using early/late semantic tokens and text.

Baseline, executable, and projected must remain distinguishable in grayscale and without hover.

## Typography

Use Inter with system sans-serif fallback. If external fonts are unavailable, use Arial/system sans without changing the scale.

| Token | Size / line-height | Weight | Use |
|---|---:|---:|---|
| `display-sm` | `28px / 36px` | 600 | Module landing title only |
| `heading-lg` | `24px / 32px` | 600 | Page H1 |
| `heading-md` | `20px / 28px` | 600 | Section title |
| `heading-sm` | `16px / 24px` | 600 | Card/drawer heading |
| `body-md` | `14px / 20px` | 400 | Default body and table |
| `body-sm` | `13px / 18px` | 400 | Dense secondary content |
| `label-md` | `14px / 20px` | 500 | Form/control label |
| `label-sm` | `12px / 16px` | 600 | Table header, chip, eyebrow |
| `mono-sm` | `12px / 18px` | 500 | Identifiers/timestamps when alignment helps |

Do not use all caps for long labels. Use tabular numerals for operational times, durations, distances, and speed.

## Spacing and layout

- Base unit: `4px`.
- Allowed core scale: `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- Within components: usually `8px`.
- Between related groups: `16–24px`.
- Between page sections: `24–32px`.
- Compact table cell horizontal padding: `8–12px`.

Grid requirements:

- 1440 desktop: 12-column fluid content grid, `24px` gutters, `24–32px` page margins after sidebar.
- 1280 laptop: 12 columns, `20px` gutters, `20–24px` margins.
- Tablet: 8 columns, `16px` gutters/margins.
- Narrow: 4 columns, `12–16px` gutters/margins.
- Form pages use a readable `720–960px` column; data workspaces use available width.
- Simulation at 1440 uses Scenario Rail `240–280px`, flexible schedule, and Inspector/Change Summary `320–380px`; at laptop, Inspector becomes a drawer.

## Breakpoints

| Token | Range | Intent |
|---|---:|---|
| `bp-xl` | `≥1600px` | Wide operations/presentation |
| `bp-lg` | `1440–1599px` | Primary target |
| `bp-md` | `1280–1439px` | Standard laptop |
| `bp-sm` | `768–1279px` | Tablet/reduced workspace |
| `bp-xs` | `<768px` | Narrow read-first |

## Borders, radius, and elevation

- Standard border: `1px solid var(--neutral-200)`; emphasized boundary uses `--neutral-300`.
- Radius: `4px` for dense inputs/table controls, `6px` standard, `8px` dialogs/cards.
- Avoid large rounded cards.
- Elevation levels: canvas 0, sticky header 1, dropdown/drawer 2, dialog 3.
- Use subtle shadows with borders; never create floating-card stacks.

## Iconography

Use one outlined icon family at `16/20/24px`. Icons supplement text and never replace critical labels. Suggested mappings: connected route for Services, calendar-clock for Schedule Monitor, ship for Voyages, branch/flask for Simulation, file-upload for Reports, database for Reference Data, ruler/route for Port Distances, users for Administration. Never use national flags as country identifiers.

## Density

- Default mode: `Comfortable compact`.
- Standard table row: `40px`; dense milestone row: `36px` only when focus and targets remain clear.
- Input: `36px`; primary button: `36–40px`.
- Page header: `72–88px` excluding breadcrumbs.
- Chip: `24px`.
- Offer density control only on data-heavy list screens, not as an app-wide prototype preference.

## Interaction states

Every applicable interactive component has Default, Hover, Focus, Active/Pressed, Disabled, Loading, Error, and Success. Selected is visually distinct from Hover and Focus. Disabled labels remain readable; when disabling blocks task completion, show the reason.

Use a `2px` `--brand-ocean-600` focus ring with `2px` offset on light surfaces. In the dark sidebar, use a high-contrast white/ocean composite ring. Never suppress browser focus without an equivalent.

Scenario-modified cells use a subtle blue left inset plus visible `Changed` text/marker. Recalculated downstream values may use a temporary two-second tint, then retain a small change marker until saved/applied. Meaning must remain without animation.

## Token architecture

Use layered semantic tokens:

- Primitive: `color-neutral-200`, `space-16`, `radius-6`.
- Semantic: `surface-default`, `text-primary`, `status-danger-bg`, `timeline-projected-fill`.
- Component token only when semantic meaning is insufficient: `table-header-bg`, `button-primary-bg-default`.

Light mode is required. Do not generate Dark mode for this prototype. Keep the theme architecture extensible without presenting an unvalidated dark timeline/status system.

## Motion

- Menus and drawers: `120–200ms ease-out`.
- Panel transitions: `200–250ms`.
- Recalculation change highlight: restrained and temporary.
- Normal page navigation: instant or approximately `150ms` dissolve/fade.
- No decorative background motion.
- Respect reduced-motion preferences; every change remains understandable without animation.
