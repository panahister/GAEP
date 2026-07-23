# Content and UX Writing Guidelines

## Voice and tone

Use concise, calm, operational English. Prefer direct verbs and precise maritime nouns. Sound accountable, not conversational or promotional. Avoid idioms, jokes, exclamation marks, vague success, unexplained abbreviations, and generic errors.

## Required terminology

- Module: `Service & Schedule`.
- Parent operational definition: `Service`; do not substitute `Route`.
- First use: `Cycle Plan Definition (CPD)`; later: `CPD`.
- Unique reference: `Voyage Number`; secondary commercial identifier: `CVN` / `Commercial Voyage Number`.
- Line Study authoring record: `Call Sequence Entry`; executable record: `Port Call`.
- Legend labels exactly: `Baseline`, `Actual / executable`, `Projected — not committed`.
- Scenario statuses: Draft, Applied, Discarded in normal prose; DRAFT, APPLIED, DISCARDED where status tokens use uppercase.
- Use separate labels `Position` and `Sequence Number`. Helper: `Position includes omitted calls. Sequence Number counts active calls only.`
- Use `Omit call` / `Unomit call`, never Delete/Restore for port calls.
- Use `Deactivate` / `Reactivate` for soft-deactivated Service or referenced master data.
- Use `Actualize port call` only with helper: `Commit populated actual fields and lock this and previous calls after departure.`
- Units: `NM`, `kn`, `h`, `TEU`; expand unfamiliar units in tooltip where needed.

## Capitalization and formats

- Page titles and navigation: Title Case.
- Buttons, labels, headers, and messages: sentence case.
- Supported Service statuses: Draft, Active, Inactive.
- Supported Voyage lifecycle: Planned, In-Progress, Completed—never Confirmed.
- CPD lifecycle: New, Saved, Final, Locked.
- Port Distance proposal statuses: Proposed, Approved, and Rejected where applicable.
- Dates: `19 Jul 2026`; never ambiguous numeric-only date.
- Local time: `19 Jul 2026, 14:00 GST`.
- UTC: `19 Jul 2026, 10:00 UTC`.
- Detail duration: `2 d 07 h 30 min`; compact variance: `+11 h` or `−2 h`.
- Distance/speed: `625 NM`, `17.5 kn`; use one decimal only when needed.

## Preferred action labels

| Context | Use | Avoid |
|---|---|---|
| New record | `Create service`, `Create scenario`, `Create feeder voyage` | Add new, Submit |
| Save | `Save changes`, `Save line study` | OK, Done |
| Live update | `Apply scenario` | Publish, Commit changes |
| Scenario reset | `Back to baseline` | Reset all |
| Voyage generation | `Generate voyages` | Run |
| Report | `Capture report`, `Upload file`, `Enter manually` | Process data |
| Port call | `Add port call`, `Omit call`, `Unomit call`, `Move up` | Remove port |
| Privileged | `Unlock port call`, `Approve distance`, `Deactivate service` | Override, Force |
| Exit | `Cancel`, `Close` | Never mind |

## Required helper text

- Service code: `Set once. It cannot be changed after creation.`
- CVN: `Commercial Voyage Number. Free-form and not required to be unique.`
- With frequency: `Use a fixed number of days between sailings.`
- Frequency: `Days between sailings.`
- Number of deployed vessels: `Required when With frequency is selected.`
- Preferred line study: `Default rotation used by new vessel rules and generated voyages.`
- Feeder vessel name: `Entered as provided by the feeder operator; not matched to Vessel reference data.`
- Strict import: `Reject the entire file if any row is invalid.`
- Lenient import: `Import valid rows and report skipped rows.`

## Validation writing

Every message states the rule and a recovery. Use exact or equivalent content:

- `Enter a service code.`
- `Valid to must be on or after Valid from.`
- `Operational calls require a location of type Canal Passage.`
- `Commercial calls require a location of type Port.`
- `Speed must be greater than 0 kn to calculate transit time.`
- `No approved distance exists from AEJEA to SAJED. Enter a distance or fetch one for approval.`
- `This validity period overlaps CPD 2 (01 Jul–31 Dec 2026). Choose a non-overlapping period.`
- `Total voyage duration must equal deployed vessels × frequency: 35 days ≠ 4 × 7 days.`
- `MV Meridian Star is assigned to service AEX during this period.`
- `End of Operations must be after Start of Operations.`
- `Enter the required actual fields before actualizing this port call.`
- `This port pair already has a record. Edit the existing record instead.`

Never use `Invalid input`, `Something went wrong`, or a field name without recovery guidance.

## Consequence-specific confirmations

### Apply scenario

- Title: `Apply scenario S-03 to VOY-2026-0148?`
- Body: `This will replace the executable schedule for 5 future port calls. Scenario S-03 will become Applied and cannot be edited or applied again. Two other Draft scenarios will remain available.`
- Actions: `Cancel` / `Apply scenario`.

### Actualize departure

- Title: `Actualize departure from Jebel Ali?`
- Body: `This commits the entered actuals and locks this and all previous port calls. The next port call remains open for update.`

### Deactivate service

- Title: `Deactivate service AEX?`
- Body: `Only Draft services without generated voyages can be deactivated. This service will remain in audit history and can be reactivated.`

### Unlock port call

- Title: `Unlock Jebel Ali for correction?`
- Body: `This privileged action allows a locked historical call to be changed in this scenario and will be audited.`

Do not require an unlock reason unless confirmed.

## Success messages

Use resource-specific outcomes:

- `Service AEX created as Draft.`
- `Line Study LS-02 saved. Transit times and 3 segments recalculated.`
- `12 voyages generated for CPD 1.`
- `Scenario S-03 applied to VOY-2026-0148.`
- `Departure actuals recorded. A delay of 11 h was detected.`
- `Distance AEJEA → SAJED approved and available for calculation.`
- `18 rows imported; 2 rows skipped. Review skipped rows.`

## Empty, error, and partial-success messages

Use states that distinguish first use, filters, no actuals, no projection, and failure:

- `No services have been created. Create a service to define line studies, cycle plans, and voyages.`
- `No services match these filters. Clear filters or change your search.`
- `No Draft scenarios. Create a scenario to model schedule changes without affecting the executable voyage.`
- `No actual times have been recorded for this voyage.`
- `No active deviation. A projected layer appears after a deviation is detected.`
- `No feeder voyages are linked to this main voyage.`
- `No reported position is available.`
- `Port Distance service did not respond. Enter the distance manually in this panel or try again.`
- `VOY-2026-0148 is locked for editing by Maya Chen. Try again after the edit session is released.`
- `Scenario S-03 could not be applied. The executable schedule was not changed. Review the highlighted blockers and try again. Reference: 7C1A-92D4.`
- Strict: `No rows were imported because 3 rows are invalid.`
- Lenient: `42 rows imported; 3 rows skipped. Download or review the error list.`
- Map: `The map is unavailable. Last reported position: 23.41 N, 58.12 E at 19 Jul 2026, 08:00 UTC.`

## Tooltips

- CVN: `A commercial identifier. Duplicate CVNs are permitted; use Voyage Number as the unique reference.`
- Projected: `A read-only downstream estimate based on the current deviation. It does not change the executable schedule.`
- Locked: `Locked after actual departure. A Schedule Administrator can unlock this call in a scenario.`
- ECA Distance: `The portion of this route inside an Emission Control Area.`
- Position: `Stable order including omitted calls.`
- Sequence Number: `Contiguous order of active calls only.`

## Demo content

Use only fictional demo content: `AEX — Arabian Express`, `Oceanic Liner Operations`, `VOY-2026-0148`, CVN `AEX-071W`, `MV Meridian Star`, IMO `9876543`, and calls AEJEA → OMSOH → EGSUZ → SAJED → JOAQJ around 14–28 Jul 2026. Show Sohar departure `+11 h` and downstream projection. Always display `DEMO`; never imply current real operations.
