# SCR-012 Reference Data Workspace — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-012 — Reference Data Workspace`, a supporting module-required master-data surface.

## 2. Business purpose
Maintain Locations, Vessels, and Organisations used by Service & Schedule with unique keys and safe deactivation.

## 3. User and role
Viewer reads/exports; Editor creates/updates; Admin delete/deactivate/import.

## 4. Context inside the ERP shell
Reuse shell with Reference Data expanded and the active child selected.

## 5. Layout structure
Tabs `Locations | Vessels | Organisations`; list table plus 520 px detail/edit drawer; adaptive page actions.

## 6. Information hierarchy
Unique key/active state → label/type → detailed attributes/history → safe destructive actions.

## 7. Components
Tabs, Data Table, filters/search, form drawer, status chips, Vessel Name History subtable, referential blocker, Export/Bulk Import actions.

## 8. Data and sample content
Locations AEJEA Port, OMSOH Port, EGSUZ Canal Passage; Vessel MV Meridian Star/IMO 9876543 with prior name; Organisations BlueWave Feeders, Oceanic Partner Lines, Jeddah Port Agency.

## 9. Primary actions
Create entity / Save changes.

## 10. Secondary actions
Open/edit/export/add vessel name; Admin Delete/Deactivate/Bulk import.

## 11. Filters and search
Type/Country/Operator/Active; search keys/names/call sign.

## 12. Validation
Unique mandatory UN/LOCODE and IMO; only Terminal/Port/Canal Passage selectable; referenced delete blocked and Deactivate offered; Organisation code marked provisional.

## 13. Permissions
Respect Viewer/Editor/Admin matrix; no unrelated scopes.

## 14. Statuses
Active/deactivated, create/edit/read-only, duplicate key, referenced blocker.

## 15. Empty state
Entity-specific first-use and filtered-no-results variants.

## 16. Loading state
Tab/table and independent drawer skeleton.

## 17. Error state
Duplicate identifier and referential blocker with preserved data.

## 18. Success feedback
Specific entity/key save/deactivate messages.

## 19. Responsive behavior
Tablet full-height drawer/reduced columns; narrow cards/read-first and larger-screen boundary for name-history editing.

## 20. Accessibility
Keyboard tabs/actions, key labels, history caption, focus on blocker/recovery.

## 21. Prototype interactions
Open Vessel history; delete referenced Location→Deactivate; Bulk import→SCR-015; Port Distances→SCR-013.

## 22. Linked screens
SCR-013, SCR-015 and contextual return to SCR-005/008/011.

## 23. Visual constraints
Do not imply a broad unrelated enterprise MDM module; keep scope to these entities.

## 24. Prohibited behavior
No extra active Location Types, cargo/customer/vendor masters, or invented Organisation fields beyond annotated code.

## 25. Source traceability
FR-MDM-1…6; US-MDM-1…7.

## 26. Assumptions
Organisation code, name-history overlap, and deactivation visibility/permission are GAP-020/026.
