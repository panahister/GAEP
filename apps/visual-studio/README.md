# GAEP for Visual Studio

The Visual Studio host uses Microsoft's out-of-process `VisualStudio.Extensibility` model and communicates with the same `gaep-engine` stdio protocol used by Rider. `Gaep.VisualStudio` contributes a native Tools-menu command and Remote UI Product Studio tool window; `Gaep.HostClient` is the IDE-independent bounded protocol client packaged beside it.

`npm run test:visual-studio:host` compiles the native shell and generated contribution manifest, verifies that both extension services are out of process and that the shared host client is present, then runs the 35 dependency-free protocol checks. On Windows, the same build also creates and verifies `Gaep.VisualStudio.vsix`. On other systems, final container creation and installation remain explicitly unverified because Microsoft's `VsixUtil.exe` requires Windows.

The development client resolves `GAEP_ENGINE_EXECUTABLE` to a canonical absolute file, captures its SHA-256 before first launch, revalidates it before every restart and immediately after process start, serializes requests, drains stderr, and bounds response frames. `GAEP_ENGINE_SHA256` can provide the expected 64-character digest (with an optional `sha256:` prefix) and makes a mismatch fail closed. Capturing a locally selected digest detects replacement; it is not a publisher-authenticity claim.

The current Remote UI is an installable static shell; complete Product workflows are not yet wired to the host client. Release packaging will bundle signed Windows engine binaries and supply their approved digest. It will not invoke a mutable executable found later on `PATH` without identity binding and digest verification.
