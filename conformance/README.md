# GAEP IDE conformance

`phase-0-ide-contract.json` is the machine-readable Phase 0 contract for VS Code, Kiro, Rider, and Visual Studio. It records 15 required capability areas, exact source probes for implemented claims, conservative reasons for partial or missing claims, package identities, and the strongest bounded runtime evidence available for each host.

Run `npm run test:ide-conformance` to execute the current matrix plus hostile source-drift and stale-package-evidence regressions. Run `npm run verify:ide-conformance` to print the complete current report. These local commands require the three locally producible IDE packages and their matching dated package report to exist.

A verifier `pass` means the contract, current source, package bytes/digests, and referenced evidence agree. It does **not** mean the phase or any host is accepted. `phaseGate` remains `incomplete` until every required capability, native installation/runtime matrix, packaged-engine workflow, and Product Owner acceptance requirement is complete. Unavailable native checks must remain explicit gaps rather than inferred passes.
