# Founder Edition Readiness

Status: development baseline, 2026-07-21

## Usable scope

The VS Code Founder Edition supports the first complete local workflow:

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

## Verification evidence

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

The VS Code development package is suitable for local dogfooding. Rider and Visual Studio are architecture and host foundations, not feature-parity releases. None of these facts implies production readiness or formal specification approval.
