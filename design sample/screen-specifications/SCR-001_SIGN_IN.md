# SCR-001 — Sign In

## Business purpose

Authenticate an internal user, establish a protected session, and route them to the Service & Schedule landing page without implying external identity providers or self-registration.

## Source references

- [Requirements FR-AUTH-1, 4–6](../../Requirement/requirements.md)
- [User Stories US-AUTH-1, 5, 6](../../User%20story/stories.md)

## Primary personas

All four personas. Access after sign-in depends on assigned role union.

## Entry points

- Application launch.
- Redirect after session idle timeout or absolute expiry.
- Return after password reset.

## Exit points

- Success → SCR-002 Schedule Monitor or preserved deep link.
- `Reset password` → lightweight reset flow/frame.

## Layout

Use a restrained split layout at 1440 px: a 40% provisional navy identity panel with abstract route-line motif and product/module name; a 60% neutral surface with a 400 px sign-in form. Keep the shell hidden until authentication. Include `DEMO` environment label only for presentation.

## Information hierarchy

1. Maritime ERP / Service & Schedule identity.
2. `Sign in` heading and brief internal-use instruction.
3. Username, password, primary action.
4. Reset, security/session note, support reference.

## Components

Product mark, text fields, password reveal button, primary button, inline alert, reset link, environment badge, loading button.

## Data fields

| Group | Fields | Notes |
|---|---|---|
| Credentials | Username, Password | No email-only assumption; no Remember me because session rules are fixed |

## Actions

- **Primary:** Sign in.
- **Secondary:** Reset password; show/hide password.
- **Not present:** Register, social login, external identity provider.

## Permissions

No role-specific controls before authentication. After success, route protection and navigation reflect roles.

## Filters

Not applicable.

## Sorting

Not applicable.

## Search

Not applicable.

## Validation

Required username/password. Do not reveal whether a username exists. Password policy belongs to reset/create flows, not login. Repeated invalid attempts lead to a generic lockout/throttle state.

## States

Default, field validation, invalid credentials, throttled, locked account, deactivated account, signing in, session expired, service unavailable.

## Empty state

Not applicable.

## Loading state

Button label `Signing in…`, inputs disabled, no full-page blanking.

## Error state

Inline alert: `We could not sign you in with those credentials.` Lockout: `Sign-in is temporarily unavailable after repeated attempts. Try again later or contact an administrator.` Server error includes Retry and a reference ID.

## Success feedback

No toast delay; navigate immediately. After expired session, preserve intended destination and announce successful reauthentication.

## Responsive behavior

Hide decorative identity panel below 768 px; retain compact product identity above the form. Form remains one column and fills safe width with 16 px margins.

## Accessibility

Autofocus Username only on first load; visible labels; password reveal has stateful accessible name; Enter submits; errors associate with fields/alert; focus moves to alert on failure without clearing Username.

## Prototype interactions

- `Sign in` → SCR-002 loaded state.
- Wrong credentials variant → inline error.
- Session expired variant → message then successful return.
- `Reset password` → reset frame then success return.

## Assumptions

- Self-service reset verification mechanism is unresolved (GAP-043). Do not depict email/SMS delivery as confirmed.
- Product name and theme are provisional (GAP-002).

## Open questions

- How is identity verified for self-service reset?
- Is a customer-specific legal/security notice required?

## Traceability

| Requirement/story | Screen element | Status |
|---|---|---|
| FR-AUTH-1 / US-AUTH-1 | Username/password secure session form | Confirmed |
| FR-AUTH-5 | Lockout/throttle state | Confirmed |
| FR-AUTH-6 | Session-expired return | Confirmed |
| FR-AUTH-4 / US-AUTH-5 | Reset entry | Confirmed; mechanism Missing |

## Acceptance checklist

- [ ] No unsupported registration or external IdP appears.
- [ ] Default, invalid, lockout, loading, and expired-session states exist.
- [ ] All controls have visible labels and focus states.
- [ ] Successful sign-in reaches SCR-002.

