# SCR-001 Sign In — Figma Make Prompt

Apply the complete persistent guideline bundle. This prompt adds screen-local requirements and does not replace global scope, design-system, component, role, content, responsive, accessibility, or platform rules.

## 1. Screen identity
Create `SCR-001 — Sign In`, a supporting authentication screen for the maritime ERP.

## 2. Business purpose
Authenticate internal users and establish a protected session without external identity providers or self-registration.

## 3. User and role
Serve all four roles before authentication; show no role-specific pre-login behavior.

## 4. Context inside the ERP shell
Do not show the authenticated shell. Show provisional product identity `Maritime ERP`, module `Service & Schedule`, and DEMO label.

## 5. Layout structure
At 1440 px use a 40% deep-navy identity panel and a 60% neutral sign-in area with a 400 px form. Use a restrained abstract route-line motif, not a photo or illustration.

## 6. Information hierarchy
Product identity → Sign in heading/instruction → credentials → primary action → reset/security note.

## 7. Components
Use labeled username/password fields, password reveal, Sign in button, Reset password link, inline alert, loading-button variant, environment badge.

## 8. Data and sample content
Username `olivia.reed`; mask password. Add `Internal operational system. Authorized access only.`

## 9. Primary actions
`Sign in` navigates to SCR-002.

## 10. Secondary actions
`Reset password` opens a simple reset frame; show/hide password.

## 11. Filters and search
None.

## 12. Validation
Require both fields. Use generic invalid-credential text. Show throttling/lockout after repeated failures.

## 13. Permissions
No permission disclosure before success.

## 14. Statuses
Default, invalid credentials, temporarily locked, deactivated account, session expired, signing in.

## 15. Empty state
Not applicable.

## 16. Loading state
Change button to `Signing in…`, disable inputs, keep layout stable.

## 17. Error state
Show `We could not sign you in with those credentials.` and a separate service-unavailable state with Retry/reference.

## 18. Success feedback
Navigate immediately; after expired session, restore the intended destination.

## 19. Responsive behavior
Below 768 px hide the identity panel and place compact identity above the one-column form.

## 20. Accessibility
Visible labels/focus, Enter submits, password reveal announces state, errors associate with inputs and receive focus.

## 21. Prototype interactions
Wire success, invalid, lockout, reset, and session-expired variants.

## 22. Linked screens
Success → SCR-002 Schedule Monitor.

## 23. Visual constraints
Use restrained brand tokens and compact enterprise typography.

## 24. Prohibited behavior
Do not add Register, Remember me, social login, external identity logos, or consumer illustration.

## 25. Source traceability
FR-AUTH-1, FR-AUTH-5, FR-AUTH-6; US-AUTH-1/5/6.

## 26. Assumptions
Reset verification and product branding are provisional; annotate GAP-002 and GAP-043.
