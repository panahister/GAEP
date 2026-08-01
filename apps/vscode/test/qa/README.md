# Local multi-dimensional QA scorecard

P3B-24 composes exact repository-local evidence for functional, unit/integration, E2E, security, accessibility, renderer-bound visual fixtures, performance, reliability, trace/coverage and unresolved gaps. Missing, failed, stale, successful and not-assessed evidence remain distinct.

Run `npm run test:vscode:qa-scorecard` for focused verification. Generate a receipt only from a committed checkpoint with `npm run test:vscode:qa-scorecard-report -- --checkpoint <full-sha> --observed-at <iso-date-time> --output <new-json-path>`.

The scorecard is read-only and local. It does not establish Product truth, human validation, security approval, Product Owner acceptance, release, publication, deployment, live-provider, Figma or other-host authority.
