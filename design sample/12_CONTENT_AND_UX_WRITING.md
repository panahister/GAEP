# Content and UX Writing

## Voice and tone

Use concise, calm, operational English. Prefer direct verbs and precise nouns. The system should sound accountable, not conversational or promotional. Avoid idioms, jokes, exclamation marks, and unexplained abbreviations.

## Terminology rules

- Use **Service & Schedule** for the module name.
- Use **Service** for the parent definition; never substitute `route` when the source means Service.
- Expand **Cycle Plan Definition (CPD)** on first use per screen; use CPD thereafter.
- Use **Voyage Number** for the unique system reference and **CVN** for Commercial Voyage Number. Display both where ambiguity matters.
- Use **Port Call** for a call in the executable voyage and **Call Sequence Entry** in Line Study authoring.
- Use **Baseline**, **Actual / executable**, and **Projected — not committed** exactly in legends.
- Use **Scenario** with status DRAFT, APPLIED, or DISCARDED. In normal sentence case, write Draft scenario.
- Use **Position** and **Sequence Number** as separate labels. Helper: `Position includes omitted calls. Sequence Number counts active calls only.`
- Use **Omit / Unomit**, not Delete/Restore, for port calls.
- Use **Deactivate / Reactivate** for service or referenced master data soft deletion.
- Use **Actualize port call** only with helper text: `Commit populated actual fields and lock this and previous calls after departure.`
- Use units: `NM`, `kn`, `h`, `TEU`. Expand in tooltips where appropriate.

## Capitalization and formats

- Page titles and navigation: Title Case (`Schedule Monitor`, `Port Distances`).
- Buttons, labels, table headers, messages: sentence case (`Create service`, `Valid from`).
- Status values follow source capitalization: Draft, Active, Inactive; Planned, In-Progress, Completed; New, Saved, Final, Locked; Proposed, Approved; Draft, Applied, Discarded.
- Dates use unambiguous international format: `19 Jul 2026`.
- Local time: `19 Jul 2026, 14:00 GST`; UTC: `19 Jul 2026, 10:00 UTC`.
- Durations: `2 d 07 h 30 min` in detail; `+11 h` in badges.
- Decimal distance/speed uses one decimal only when needed: `625 NM`, `17.5 kn`.

## Button labels

| Context | Preferred | Avoid |
|---|---|---|
| New record | Create service, Create scenario, Create feeder voyage | Add new, Submit |
| Save draft/config | Save changes, Save line study | OK, Done |
| Live update | Apply scenario | Publish, Commit changes |
| Reset scenario | Back to baseline | Reset all |
| Generate | Generate voyages | Run |
| Report | Capture report, Upload file, Enter manually | Process data |
| Port call | Add port call, Omit call, Unomit call, Move up | Remove port |
| Privileged | Unlock port call, Approve distance, Deactivate service | Override, Force |
| Exit | Cancel, Close | Never mind |

## Form labels and helper text

- `Service code` — `Set once. It cannot be changed after creation.`
- `CVN` — `Commercial Voyage Number. Free-form and not required to be unique.`
- `With frequency` — `Use a fixed number of days between sailings.`
- `Frequency` — `Days between sailings.`
- `Number of deployed vessels` — `Required when With frequency is selected.`
- `Preferred line study` — `Default rotation used by new vessel rules and generated voyages.`
- `Vessel name` on feeder form — `Entered as provided by the feeder operator; not matched to Vessel reference data.`
- `Import handling` — Strict: `Reject the entire file if any row is invalid.` Lenient: `Import valid rows and report skipped rows.`

## Validation messages

Messages identify the rule and recovery.

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

Do not use `Invalid input`, `Something went wrong`, or field names without recovery guidance.

## Confirmations

### Apply scenario

**Title:** `Apply scenario S-03 to VOY-2026-0148?`

**Body:** `This will replace the executable schedule for 5 future port calls. Scenario S-03 will become Applied and cannot be edited or applied again. Two other Draft scenarios will remain available.`

**Actions:** `Cancel` / `Apply scenario`

### Actualize departure

**Title:** `Actualize departure from Jebel Ali?`

**Body:** `This commits the entered actuals and locks this and all previous port calls. The next port call remains open for update.`

### Deactivate service

**Title:** `Deactivate service AEX?`

**Body:** `Only Draft services without generated voyages can be deactivated. This service will remain in audit history and can be reactivated.`

### Unlock port call

**Title:** `Unlock Jebel Ali for correction?`

**Body:** `This privileged action allows a locked historical call to be changed in this scenario and will be audited.`

Do not require a reason field unless the business confirms it.

## Success messages

- `Service AEX created as Draft.`
- `Line Study LS-02 saved. Transit times and 3 segments recalculated.`
- `12 voyages generated for CPD 1.`
- `Scenario S-03 applied to VOY-2026-0148.`
- `Departure actuals recorded. A delay of 11 h was detected.`
- `Distance AEJEA → SAJED approved and available for calculation.`
- `18 rows imported; 2 rows skipped. Review skipped rows.`

## Empty states

- Services first use: `No services have been created. Create a service to define line studies, cycle plans, and voyages.`
- Filter mismatch: `No services match these filters. Clear filters or change your search.`
- Scenarios: `No Draft scenarios. Create a scenario to model schedule changes without affecting the executable voyage.`
- Actuals: `No actual times have been recorded for this voyage.`
- Projected layer: `No active deviation. A projected layer appears after a deviation is detected.`
- Feeder: `No feeder voyages are linked to this main voyage.`
- Last position: `No reported position is available.`

## Error and partial-success messages

- `Port Distance service did not respond. Enter the distance manually in this panel or try again.`
- `VOY-2026-0148 is locked for editing by Maya Chen. Try again after the edit session is released.`
- `Scenario S-03 could not be applied. The executable schedule was not changed. Review the highlighted blockers and try again. Reference: 7C1A-92D4.`
- Strict upload: `No rows were imported because 3 rows are invalid.`
- Lenient upload: `42 rows imported; 3 rows skipped. Download or review the error list.`
- `The map is unavailable. Last reported position: 23.41 N, 58.12 E at 19 Jul 2026, 08:00 UTC.`

## Tooltips

- CVN: `A commercial identifier. Duplicate CVNs are permitted; use Voyage Number as the unique reference.`
- Projected: `A read-only downstream estimate based on the current deviation. It does not change the executable schedule.`
- Locked: `Locked after actual departure. A Schedule Administrator can unlock this call in a scenario.`
- ECA Distance: `The portion of this route inside an Emission Control Area.`
- Position: `Stable order including omitted calls.`
- Sequence Number: `Contiguous order of active calls only.`

## Customer-presentation sample content

Use a fictional company and vessels. Recommended service: `AEX — Arabian Express`, trade lane `Arabian Gulf–Red Sea`, operator brand `Oceanic Liner`, Mainliner, valid `01 Jan–31 Dec 2026`. Use voyage `VOY-2026-0148`, CVN `AEX-071W`, vessel `MV Meridian Star`, IMO `9876543`, partner/owned type as appropriate.

Suggested calls:

1. Jebel Ali, UAE (`AEJEA`) — Commercial, WB.
2. Sohar, Oman (`OMSOH`) — Commercial, WB.
3. Suez Canal (`EGSUZ`) — Operational, WB.
4. Jeddah, Saudi Arabia (`SAJED`) — Commercial, WB.
5. Aqaba, Jordan (`JOAQJ`) — Commercial, WB.

Use internally consistent fictional dates around 14–28 Jul 2026. Show a departure delay of `+11 h` at Sohar with projected downstream impact, then a recovery scenario that omits Aqaba or adjusts future speed. Mark all content as demonstration data; avoid implying it is current operational information.

