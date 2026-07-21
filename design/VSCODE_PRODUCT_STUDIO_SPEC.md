# GAEP Product Studio for VS Code

Status: approved code-native design specification

Image-generation status: explicitly opted out by the Product owner. This document is the visual and interaction source of truth for the Founder Edition.

## Design intent

GAEP should feel like a careful engineering instrument already native to VS Code: quiet, legible, inspectable, and difficult to misuse. It is a Product-design and governed-execution workspace, not a chat client, marketing dashboard, or collection of decorative cards.

The extension inherits the active VS Code color theme, typography, zoom, iconography, focus treatment, reduced-motion setting, and accessibility APIs. It must remain equally usable in light, dark, high-contrast, narrow-sidebar, and keyboard-only environments.

## Navigation model

The GAEP Activity Bar container exposes four views:

1. **Product** — Product identity, design readiness, active Initiative, delivery records, and primary next action.
2. **Agent** — detected runtimes, selected agent/model/settings, runtime trust, capability limits, and switch history.
3. **Governance** — policy posture, blockers, decisions, risks, trace gaps, evidence, audit integrity, and workspace health.
4. **Runs** — prepared/running/unknown/terminal runs, normalized events, evidence state, handoffs, recovery, and cancellation.

Selecting `Open Product Studio` opens one editor-area webview panel. The panel does not replace the native trees; it provides the wider workspace required for connected product-design forms and trace views.

## Product Studio layout

At widths of 720px and above:

- a 208px internal navigation rail;
- one flexible content column, maximum readable width 1040px;
- an optional 280px inspector only when a selected record needs relationship or provenance detail;
- a thin footer line for save state, source revision, and validation summary.

Below 720px, the rail becomes a native-styled select at the top and the inspector follows the content. Below 480px, all label/control grids become single-column. No primary action may require horizontal scrolling.

The navigation order is:

- Overview
- Direction
- Users & Jobs
- Outcomes
- Scope
- Delivery
- Architecture
- Risks & Decisions
- Trace
- Agents & Tools
- Runs & Evidence
- Readiness

The navigation shows completion state with both icon and text. Counts never rely on color alone.

## Visual system

Use only VS Code CSS variables and the following geometry:

- spacing: 4, 8, 12, 16, 24, 32px;
- control height: 28px compact, 32px default;
- border radius: 3px controls, 5px grouped sections;
- border: 1px `--vscode-panel-border` or `--vscode-widget-border`;
- focus: VS Code focus border with a 1px outline and 1px offset;
- content measure: 72 characters for long prose;
- animation: none except native progress affordances; respect reduced motion;
- icons: ThemeIcon/Codicon semantics only; no emoji or custom decorative symbols.

Typography uses `--vscode-font-family` and `--vscode-editor-font-family` for identifiers or code. Default body size is the VS Code font size. Page title is 20px/1.3 at weight 600; section title is 15px/1.4 at weight 600; labels and controls are never below 12px.

No gradients, glow, custom font, hero, badge strip, metric tiles, bento grid, chat bubbles, fake charts, oversized empty state, or background illustration is permitted.

## Stable chrome copy

Allowed persistent Product Studio chrome:

- `GAEP Product Studio`
- `Open record`
- `Save draft`
- `Validate section`
- `Create revision`
- `Add relationship`
- `Show source`
- `Resume design`
- `Prepare next step`
- `Export Product`
- `Workspace health`

Provider output, Product content, and record titles are dynamic and are not part of this fixed-copy inventory. New persistent explanatory copy requires an update to this specification.

## Overview

The first viewport contains, in order:

1. Product name, lifecycle, current revision, and a compact readiness statement.
2. One primary next action derived from state, such as `Resume product direction`, `Resolve 3 design gaps`, or `Create first Initiative`.
3. A plain progress list for the twelve design sections; each row has state, gap count, and `Open` action.
4. Current Initiative and latest run in two unframed definition lists.
5. Blocking items, if present, as a native warning list with exact source links.

The first viewport must not show invented metrics or duplicate the entire navigation.

## Design section pattern

Direction, Users & Jobs, Outcomes, Scope, Architecture, and related design pages use one shared pattern:

- page title and one-sentence purpose;
- source/revision line;
- a vertical sequence of labeled fields;
- each field includes a concise question, optional example behind `Show example`, validation state, and provenance;
- repeatable items use a table or list with `Add`, `Edit`, `Move`, and `Remove` commands;
- a `Known gaps and conflicts` section appears only when populated;
- footer actions are `Save draft`, `Validate section`, and `Create revision` when material content changed.

Autosave may preserve a local draft, but it must not silently create a governed revision. The UI explicitly distinguishes `Draft saved locally` from `Revision created`.

## Delivery

Delivery is table-first, not card-first.

- Initiative table columns: title, target Product, state, outcome, updated.
- Change table columns: title, Initiative, baseline/genesis, state, effect envelope, updated.
- Work Item table columns: title, Change, state, dependencies, owner/agent, evidence.

Row activation opens a detail editor. State transitions are commands with a reason field and an explicit preview of allowed next states. Invalid transitions are disabled with an explanation.

## Risks and decisions

Risks use cause-condition-consequence, treatment, evidence, uncertainty, owner, review trigger, and residual-risk fields. Decisions use question, options, recommendation, selected outcome, rationale, dissent/uncertainty, affected records, and state.

Recommendations and decisions are visually separated by headings and state labels. An AI recommendation can never appear as an accepted human decision without the corresponding attributable record.

## Trace

Trace defaults to an accessible relationship table with columns: source, relationship, target, state, provenance, and freshness. A compact graph view may supplement it, but every graph operation must have a table and keyboard equivalent.

Impact analysis starts from one selected record and shows:

- upstream intent;
- downstream work and implementation units;
- validating evidence;
- decisions and risks;
- stale or unresolved links;
- records invalidated by a proposed revision.

No line implies that absence of a link proves absence of impact.

## Agents and tools

Detected adapters are shown as rows with agent, executable fingerprint, runtime version, observation time, interface maturity, and status. Absolute paths are visible only in a machine-local inspector and are never rendered as portable Product content.

Selection requires explicit agent, model, model truth class, adapter-declared settings, and a capability-limitations review. Unsafe or unsupported settings are absent or disabled, not merely discouraged. A provider alias is labeled `alias`.

The selected agent and model are simultaneously visible in both the Agent tree and status bar. Switching opens a handoff workflow; it never immediately overwrites the current selection.

## Run preparation and execution

Run preparation is a stepper with these exact stages:

1. Initiative and objective
2. Context pack
3. Tools and effects
4. Policy evaluation
5. Evidence and stop conditions
6. Provider control mapping
7. Charter review
8. Launch confirmation

Every stage is revisitable before confirmation. The review page separates:

- GAEP policy result;
- local Founder confirmation;
- provider-native sandbox/permission controls;
- unavailable enforcement or evidence semantics;
- external authorization not present.

The launch action is `Start governed run`. Cancellation is `Cancel prepared run`. Destructive vocabulary such as `Authorize all` or `Trust agent` is prohibited.

During execution, a VS Code output/terminal surface streams normalized events. The Runs view remains the authoritative status surface. Exit code zero is shown as `Provider exited successfully; outcome verification pending` until evidence/postconditions are evaluated.

## Empty, loading, error, and recovery states

Every page implements:

- **uninitialized**: one clear initialization or root-selection action;
- **loading**: native progress, no fake content;
- **empty**: explain what record belongs here and one creation action;
- **invalid**: exact file/field issue, read-only inspection, safe repair/export actions;
- **blocked**: blocking rule or dependency and the record that owns it;
- **interrupted**: last verified state, known/unknown effects, recovery choices;
- **offline/provider absent**: Product design remains fully usable; execution actions explain the missing runtime.

Errors preserve entered form data and return focus to the failed field. Raw provider errors are redacted and available in diagnostics only when safe.

## Keyboard and accessibility contract

- All Activity Bar and Studio sections are reachable through commands.
- Tab order follows visible reading order; no positive `tabindex`.
- `Escape` closes the current modal or abandons an uncommitted transient edit after confirmation when data would be lost.
- Tables support arrow navigation only when implemented with the appropriate grid semantics; otherwise use standard tab navigation.
- Dynamic validation and run state use polite live regions; destructive or safety stop-lines use assertive alerts sparingly.
- Every icon-only action has an accessible name and tooltip.
- Record IDs and digests are copyable and use accessible full text even when visually truncated.
- High-contrast mode retains borders, focus, current selection, warning, and error distinctions.

## Component ownership

- `StudioProvider`: lifecycle, CSP, message protocol, restore/serialization.
- `StudioShell`: navigation, route state, workspace context, global diagnostics.
- `RecordForm`: schema-backed fields, draft state, validation, revision preview.
- `RecordTable`: sorting, selection, commands, empty/error states.
- `ReadinessPanel`: section status, gaps, conflicts, next action.
- `TraceExplorer`: relationship table, impact query, optional graph projection.
- `AgentCenter`: probing, binding, settings, limitations, switch entry.
- `RunComposer`: eight-stage preparation workflow.
- `RunInspector`: normalized events, evidence, effects, recovery, handoff.
- `HostBridge`: typed, nonce-bound messages; no arbitrary command or path execution.

Business and governance logic must not live in these components. They call the engine through typed host operations.

## Visual verification ledger

Before final handoff, capture and inspect at least these states in the actual Extension Development Host or installed VSIX:

1. fresh trusted workspace;
2. partially completed Product design;
3. complete design with one active Initiative;
4. detected Codex and Claude agents with limitations;
5. charter review with denied high-impact effects;
6. running or fake-agent event stream;
7. interrupted/unknown run recovery;
8. narrow 360px-equivalent view;
9. light, dark, and high-contrast themes;
10. keyboard-only traversal and focus visibility.

The fidelity review compares those captures to this document for information order, copy, density, container model, typography, theme-token use, focus, selection, empty/error states, and interaction completeness. Fixable mismatches block final completion.
