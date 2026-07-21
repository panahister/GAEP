# GAEP IDE Extension UI Specification

Status: code-native implementation baseline

## Product character

GAEP is a quiet, work-focused product-design and governed execution surface embedded in the IDE. It uses the host IDE theme, typography, focus behavior, keyboard navigation, icons, and accessibility semantics. It is not a marketing page and does not imitate a chat application.

## Information architecture

The primary activity/tool-window container exposes three stable regions:

1. Product: Product identity, lifecycle, profile, direction, Initiatives, Changes, and Work Items.
2. Agent: detected runtime, runtime version, model, material settings, session state, checkpoint, and switch/handoff command.
3. Governance: charter status, tool permissions, expected effects, blockers, decisions, evidence, audit integrity, and trace coverage.

The IDE status bar shows the compact current context:

`GAEP | Product | Agent | Model | Initiative state | Blocker count`

## First-run flow

1. The Product view shows one native action: `Initialize Product`.
2. GAEP asks product-direction questions through native IDE input and selection controls.
3. The Agent view detects installed adapters and shows runtime versions and limitations.
4. The user selects an agent, model identifier, and only settings declared by that adapter.
5. GAEP creates `.gaep` and refreshes the native trees.

No agent process starts during onboarding.

## Run preparation

1. Select a bounded Initiative.
2. State the run objective.
3. Review tool permissions, expected effects, forbidden actions, stop conditions, and required evidence.
4. Confirm the Execution Charter in a modal host confirmation.
5. Confirm agent-process launch separately.
6. Open a native terminal/output surface that streams provider events.

High-impact permissions default to denied. Technical agent permission is never displayed as GAEP approval or authorization.

## Agent and model switching

The `Change Agent or Model` action is available only when no agent process is running. A material change requires:

- switch reason;
- completed-work summary;
- unresolved-matter summary;
- workspace baseline capture;
- capability-difference review;
- handoff acceptance;
- a new charter when the prior authorization bindings are no longer current.

The previous agent and model remain visible in session history.

## Visual system

The extension inherits host tokens. Where a host requires explicit tokens, use:

- background: host editor/sidebar background;
- surface: host panel background;
- primary text: host foreground;
- secondary text: host description foreground;
- border: host panel border;
- action: host focus/selection color;
- success: host testing passed color;
- warning: host warning foreground;
- blocked/error: host error foreground;
- radius: 4px for inputs and buttons, 6px maximum for repeated framed items;
- spacing: 4, 8, 12, 16, and 24px;
- iconography: host-native icons first, one consistent outline family otherwise.

Do not introduce gradients, decorative imagery, oversized headings, floating cards, chat bubbles, dark-mode overrides, or custom font downloads.

## Responsive host behavior

- Narrow sidebars keep one-line identity rows and move descriptions to tooltips.
- Tool windows below 360px show Product, Agent, and Governance as separate host tabs.
- Long IDs are copyable and middle-truncated visually.
- Forms use a single column below 560px and a label/control grid above it.
- The main workflow remains keyboard-completable.

## Accessibility

- All commands are available through the host command/action palette.
- Trees, dialogs, controls, terminals, and notifications use host accessibility APIs.
- Selection is never communicated by color alone.
- Error messages identify the failed field or transition and preserve focus.
- Motion is limited to native progress indicators and respects host reduced-motion behavior.

## Fidelity checklist

- Product, Agent, and Governance remain separate top-level regions.
- Agent and model identities are simultaneously visible.
- Runtime limitations are inspectable before selection.
- High-impact effects remain denied in the default charter.
- Agent launch requires a confirmed charter.
- Switching creates a handoff and never silently substitutes an adapter or model.
- Product remains active when a bounded Initiative completes.
- Interrupted and unknown runs are not presented as successful.
