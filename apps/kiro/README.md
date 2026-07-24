# GAEP for Kiro

GAEP for Kiro is a local Code OSS/Open VSX-compatible extension boundary for the GAEP engine host. It exposes a static Product Studio panel, path-free Codex/Claude readiness and guarded-selection commands, and protocol-v2 import, list, and exact-read commands for portable-design snapshot metadata.

The readiness command is observation-only. The selection command can record one verified adapter, model, and set of non-sensitive portable settings after explicit confirmation. It fails closed for active Runs, capability drift, legacy or invalid selection state, and post-Run changes that require a versioned handoff. Selection does not start a provider, create or resume a Run, approve tools or effects, or grant execution authority. Executable paths, provider credentials, raw engine output, and sensitive settings are never rendered or stored in the portable record.

The extension starts only the configured local `gaep-engine` executable and sends no requests to external services. Import accepts one existing local folder. Files, archives, `.fig` ingestion, OAuth, network fetches, live design-tool accounts, and provider credentials are outside this extension.

Every imported snapshot remains `pending-human-review`. An upstream `approved` source-review value is preserved only as a claim; it is not GAEP approval, a Design Baseline, implementation readiness, or release readiness.

`npm run verify` typechecks, unit-tests, and packages `dist/gaep-kiro.vsix`. `npm run test:extension-host` rebuilds that VSIX, installs a transparent synthetic `0.0.9` package-manager fixture, proves upgrade to exact `0.1.0`, same-version reinstall, forced fixture rollback, uninstall/absence and final `0.1.0` reinstall in an isolated compatible-host profile, then activates the current package through a separate test harness. The lifecycle never touches a normal profile. The fixture is not a historic GAEP build, supported package, release artifact, or production rollback payload; the harness proves host-level version replacement, not data/schema migration compatibility. Native Kiro runtime behavior remains unverified when no Kiro binary is installed.
