# VS Code local performance and reliability gate

P3B-23 combines bounded Product Studio measurements with existing deterministic engine/staging reliability tests and the isolated extension-host lifecycle.

Run the complete scoped report from the repository root:

```sh
npm run test:vscode:performance
```

The gate measures a 1,000-row Product Studio table for render, sort, visible-metadata-only CSV export, filter, heap delta, and output bytes. It also verifies the strict 10,000-row protocol ceiling; 4-way parallel-readonly execution; 32/64-record bounded reads; cancellation, timeout, partial-failure and crash-window behavior; stale projection rejection; package file/byte limits; and activation plus total phase timings in four isolated host phases.

Budgets are generous local regression stop-lines, not production service-level objectives or capacity claims. Timings and memory are machine-local. The harness does not establish sustained production load, normal-profile behavior, all supported platforms, physical power-loss behavior, hostile same-UID resistance, live-provider reliability, or human/Product Owner acceptance.
