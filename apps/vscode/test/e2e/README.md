# VS Code Extension-Host Verification

`npm run test:extension-host -w gaep-vscode` packages the exact VSIX and launches isolated VS Code hosts with temporary workspaces, user-data directories, and extension directories.

The deterministic phases verify:

1. activation, every contributed Command Palette command, and the four GAEP native views;
2. Product Studio opening in a single-root workspace without implicit Product-state mutation;
3. the `onWebviewPanel` activation contribution required for Product Studio restoration;
4. a clean two-root workspace that opens Product Studio without silently initializing or mutating either root.
5. a synthetic `gaep.gaep-vscode@0.0.9` fixture install, exact `0.1.0` upgrade, same-version reinstall, forced fixture rollback, uninstall/absence, final exact `0.1.0` reinstall, activation, command/view registration, Product Studio opening, and absence of implicit Product-state mutation.

The installed-package phase loads only a minimal test harness from the source checkout; GAEP itself is resolved from the isolated installed VSIX. The harness removes its `mkdtemp` root after success or failure. Set `GAEP_VSCODE_EXECUTABLE` and `GAEP_VSCODE_CLI_ENTRY` together when the normal platform location is unavailable. Without a local installation, the runner downloads the extension's VS Code 1.103.0 baseline for development-host phases and explicitly reports the installed-package phase as unverified.

The package lifecycle operates only in the temporary `--user-data-dir` and `--extensions-dir`. Version `0.0.9` is generated during the test as a minimal transparent package-manager fixture; it is not a historic GAEP build, supported package, release artifact, or production rollback payload. The harness proves host-level version replacement and final current-package activation, but not data/schema migration compatibility, signing, publication, or supported-OS acceptance.

## Explicit limitations

- `@vscode/test-electron` unconditionally adds `--disable-workspace-trust`, so this harness cannot produce a genuine untrusted Extension Development Host. Unit safety tests cover the stop-line logic, but an installed-profile untrusted-workspace interaction remains a separate verification item.
- The Electron extension-test runner terminates the workbench when its test extension completes, before normal editor-state persistence. It therefore cannot prove cross-process webview restoration; that behavior requires an installed-profile restart check.
- The host API does not expose webview DOM, computed layout, or rendered color contrast. `studio-accessibility.test.ts` runs axe-core over every Product Studio route and inspects the actual CSP and responsive CSS rules, but it makes no screenshot, pixel-fidelity, or native-theme contrast claim.
- The multi-root phase verifies exact root discovery and absence of implicit `.gaep` mutation. It does not automate the native Quick Pick used to choose a root because the stable VS Code extension API does not expose native workbench widget automation.
