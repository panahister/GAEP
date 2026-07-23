# Historical Founder Edition Development Checkpoint

Status: historical development evidence, 2026-07-21; not a current readiness determination

This document records a narrow checkpoint that pre-dates the current delivery tracker and continuous implementation control. It is retained as historical evidence only. Current status is governed by [GAEP Feature Delivery Tracker](../docs/06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md) and [GAEP Continuous Implementation Control](../docs/06_Roadmap/055_GAEP_CONTINUOUS_IMPLEMENTATION_CONTROL.md).

In this checkpoint, “complete local workflow” meant only the direct observe-only sequence enumerated below. It did not mean that governed managed execution, staged review/apply, restart recovery, multi-host parity, or the Founder completion contract was complete.

## Usable scope

At this checkpoint, the VS Code development extension supported this bounded direct local workflow:

1. define a long-lived Product;
2. create a bounded Initiative without coupling its lifecycle to the Product;
3. detect installed Codex CLI and Claude Code runtimes;
4. select an explicit model and adapter-declared settings;
5. confirm a bounded Execution Charter;
6. separately confirm process launch;
7. stream the agent through a native terminal;
8. persist run state and provider session identity;
9. verify the local audit hash chain;
10. switch agent or model through an explicit handoff when no process is running.

## Verification evidence recorded at the checkpoint

- TypeScript project-reference type checking passes.
- Contract, adapter, engine, audit-tampering, handoff, and host tests pass.
- The full workspace builds.
- The VSIX packages and installs into an isolated VS Code extension directory.
- Live probes detect the installed Codex and Claude Code runtimes without reading credentials.
- The .NET Visual Studio host client builds on macOS with zero warnings.
- Candidate structural validation passes with zero warnings.
- `npm audit` reports zero known vulnerabilities.
- `git diff --check` passes.

## Explicitly incomplete release evidence

These are not represented as completed:

- native VS Code end-to-end interaction in a clean visual test process;
- Rider plugin compilation/package verification after its Rider SDK dependency is fully resolved;
- a Windows-built and Windows-tested Visual Studio VSIX shell;
- cross-host conformance, accessibility, crash-recovery, signing, update, marketplace, telemetry/privacy, and production-security assessments;
- formal candidate approval, accountable authority assignments, immutable revision-set designation, or production Authorization Grants.

At this historical checkpoint, the VS Code development package was considered suitable for bounded local dogfooding. Rider and Visual Studio were architecture and host foundations, not feature-parity releases. These observations are not current acceptance evidence and do not imply production readiness or formal specification approval.
