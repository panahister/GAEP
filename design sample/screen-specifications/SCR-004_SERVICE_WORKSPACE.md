# SCR-004 — Service Workspace

## Business purpose

Act as the parent working context for one Service: maintain allowed service fields, open multiple dedicated Line Studies, manage Cycle Plan Definitions and Vessel Rules inline, generate standard/ad-hoc voyages, and inspect linked voyages.

## Source references

- [Requirements FR-SVC-2, 6–12; FR-CYC-1…11](../../Requirement/requirements.md)
- [User Stories US-SVC-1/4/7; US-CYC-1…11](../../User%20story/stories.md)

## Primary personas

Editor for maintenance; Viewer read-only; Administrator for deactivate/reactivate and all lower actions.

## Entry points

- Services row/global search.
- Create service from SCR-003.
- Return from SCR-005.

## Exit points

- Line Study row → SCR-005.
- Voyage row/generated result → SCR-007.
- `View all voyages` → SCR-006 with Service filter.

## Layout

Persistent service page header with `AEX — Arabian Express`, derived status, availability, identifiers, Edit/Save. Tabs: Overview, Line Studies, Cycle Plans, Voyages. Cycle Plans and Voyages are inline on their tabs, not separate pages. Create state uses an Overview form first; after save, tabs unlock.

## Information hierarchy

1. Service identity, status, editability, validity.
2. Line Studies as reusable rotation definitions.
3. CPD lifecycle and vessel rules.
4. Voyage generation/actions and linked results.

## Components

Page Header, Tabs, read/edit form, Line Study table, CPD accordion/cards, Vessel Rules editable table, lifecycle chips, formula panel, generation/ad-hoc dialogs, blocker banner, Voyage mini-table, confirmation/toast.

## Data fields

| Group | Fields | Notes |
|---|---|---|
| Service | Company Code, Service Code, Name, Trade Lane, Operator Brand, Service Type, Valid From/To, derived Status | All mandatory at create; Code immutable; Status read-only |
| CPD | CPD ID, Validity, With Frequency, Frequency, Number of Deployed Vessels, Preferred Line Study, Lifecycle | CPD ID/lifecycle system-managed |
| Vessel Rule | Rule Number, Cycle Position ID, Line Study, Start Date, Valid From/To, Slot Provider, Vessel/IMO, Vessel Operator, Rotation Duration, Day of Week | Rule/derived fields read-only as specified |
| Voyage summary | Voyage Number, CVN, Vessel, Start/End, Cycle, Lifecycle | Feeder not generated here |

## Actions

- **Primary by tab:** Save service; Create Line Study; Add CPD/Add Vessel Rule; Generate voyages.
- **Secondary:** Edit allowed fields, Create ad-hoc voyage, replace vessel at position, view voyages/export.
- **Privileged:** Deactivate/Reactivate service.

## Permissions

Viewer sees read-only sections. Editor edits/creates/generates. Administrator adds privileged actions. After first voyage, all service fields except Valid From/To remain read-only for Editor/Admin.

## Filters

Line Studies by name/operator; CPDs by lifecycle/validity; linked Voyages by lifecycle/date. Keep compact.

## Sorting

Line Studies by updated/name; CPD ID ascending; vessel rules by Cycle Position then Valid From; voyages by Start descending.

## Search

Within Line Studies and Voyages only; no page-wide duplicate search.

## Validation

Service mandatory fields and Valid To ≥ Valid From. CPD no validity overlap. With Frequency requires integer `Total Voyage Duration = Deployed Vessels × Frequency`; unchecked disables both dependent fields. Rule count equals deployed vessels for frequency CPD; rule/voyage overlap blocks Final; vessel one active service; line study must belong to service. Locked CPD is entirely read-only.

## States

Create, Draft service, Active/Inactive, deactivated, service fields unlocked/locked, CPD New/Saved/Final/Locked, dirty/saving, generation preview/progress/success/error.

## Empty state

Each tab has task-specific empty text: no Line Studies → Create; no CPDs → Add CPD; no Voyages → generate or create ad-hoc after a Line Study exists.

## Loading state

Header and active tab skeleton; preserve inactive tab labels. Generation uses determinate/indeterminate modal progress.

## Error state

Page banner for service/version conflict; row/field errors for CPD/rules; missing distance links to SCR-013. Never discard valid inline edits after an error.

## Success feedback

Specific messages: service saved; CPD advanced to Final; vessel rule added; 12 voyages generated with `View voyages`. On first future voyage, derived Active status visibly refreshes.

## Responsive behavior

Laptop retains tabs but collapses CPD formula/help. Tablet stacks service fields and CPD cards; vessel rules expand into row forms. Narrow is view-first; complex CPD/rule editing requests a larger screen.

## Accessibility

Tabs keyboard-operable; calculated/read-only values not disguised as disabled inputs; formula error linked to inputs; accordion state announced; generation preview is a real table with captions.

## Prototype interactions

- Overview Edit → locked/unlocked field variants.
- Line Studies row LS-02 → SCR-005.
- CPD 1 expand → vessel rules and lifecycle.
- Generate voyages → mode dialog → preview → success → SCR-007.
- Missing distance banner → SCR-013 contextual pair.

## Assumptions

- Explicit per-section Save/no autosave for CPD (GAP-027).
- Generation preview and per-voyage CVN entry are safety inferences (GAP-028/029).
- Owned operator organization handling and ad-hoc override fields are unresolved (GAP-021/030).

## Open questions

- Is Service Workspace saved per section or transactionally as one page?
- How are CVNs entered for batch/cycle generation?
- Can Line Studies be deleted/deactivated after use?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-SVC-6/7/8 | Parent workspace, separate Line Study, inline CPD/Voyages | Confirmed |
| FR-SVC-9/10 | Immutable Code and edit lock after voyage | Confirmed |
| FR-CYC-1…8 | CPD/Vessel Rule forms/lifecycle | Confirmed |
| FR-CYC-9…11 | Generation/ad-hoc/CVN dialogs | Confirmed; batch CVN UX Missing |

## Acceptance checklist

- [ ] Line Study opens separately; CPD/Voyage remain inline.
- [ ] Service and CPD locking rules are visible.
- [ ] Generation modes and blockers are represented.
- [ ] No cost, capacity modelling, or CVN automation appears.

