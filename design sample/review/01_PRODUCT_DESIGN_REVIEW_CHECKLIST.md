# Product Design Review Checklist

## Business alignment and scope

- [ ] Service & Schedule is the only module designed in functional depth.
- [ ] Future ERP modules are clearly disabled/placeholders and have no invented screens.
- [ ] No cost, bunker, cargo, port-operations, agency, routing, AIS, publication, or automated-recovery behavior appears as MVP functionality.
- [ ] Capacity modelling is absent from Line Study.
- [ ] The platform-shell-versus-standalone conflict is recorded and approved.

## Personas and permissions

- [ ] All actions map to Viewer, Editor, Simulation Analyst, or Administrator.
- [ ] Role union and Administrator superset are represented consistently.
- [ ] Only Administrator can unlock, approve/reject distance, delete/deactivate privileged records, import, configure thresholds, and manage users.
- [ ] Read-only views do not look like broken disabled forms.
- [ ] Combined-role requirements are explained where relevant.

## Flows and information architecture

- [ ] Service → Line Study → CPD/Vessel Rules → Voyage generation is coherent.
- [ ] Monitor → Deviation → Simulation → Apply → Monitor is coherent and linked.
- [ ] All schedule edits route through Simulation; Voyage Detail has no direct schedule editor.
- [ ] Missing distance has a same-context resolution path.
- [ ] Feeder schedule stays a separate lightweight entity.

## Terminology and entity integrity

- [ ] Voyage Number and CVN are never conflated.
- [ ] CPD is expanded on first use.
- [ ] Position and Sequence Number are separately labeled and explained.
- [ ] ECA Distance is not shown as a Distance Type.
- [ ] Call Type, Location Type, Bound ID, lifecycle, and scenario values match the source domains.
- [ ] Local time and UTC are consistently paired.

## States and validations

- [ ] Service status is derived; deactivate/reactivate is separate and Draft-only.
- [ ] Voyage lifecycle is Planned → In-Progress → Completed with no Confirmed state.
- [ ] CPD lifecycle and frequency/overlap rules are visible.
- [ ] Omitted calls remain visible, muted, non-editable, and unomittable where permitted.
- [ ] Applied scenarios are terminal and other drafts remain.
- [ ] Actual departure locks current and previous calls; next stays open.
- [ ] Strict vs lenient report outcomes are explicit.
- [ ] Reference-data deletion blockers offer Deactivate.

## Enterprise usability

- [ ] Tables expose only decision-relevant default columns and support customization where needed.
- [ ] No decorative dashboard/chart lacks a source-backed question.
- [ ] Destructive/live actions state their consequences.
- [ ] Error messages explain recovery and preserve valid context.
- [ ] Empty, loading, error, locked, permission, partial-success, and success states exist.

## Source traceability and assumptions

- [ ] Every core/supporting screen has requirement links and a Figma prompt.
- [ ] Every business-affecting assumption appears in `16_UX_GAPS_AND_ASSUMPTIONS.md`.
- [ ] Conflicts use the documented resolution, never a silent hybrid.
- [ ] Report fields, audit UI, feeder linking, edit locks, and distance approval are visibly provisional where unresolved.

