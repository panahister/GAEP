# GAEP for Visual Studio

The Visual Studio host will use Microsoft's out-of-process `VisualStudio.Extensibility` model and communicate with the same `gaep-engine` stdio protocol used by Rider. `Gaep.HostClient` is the buildable, IDE-independent C# protocol client.

The VSIX shell and Remote UI tool window require a Windows machine with the Visual Studio extension-development workload. They cannot be compiled or integration-tested on this macOS workspace. The host client is intentionally separated so protocol behavior is testable on every .NET-supported platform.

The development client resolves `GAEP_ENGINE_EXECUTABLE` to a canonical absolute file, captures its SHA-256 before first launch, revalidates it before every restart and immediately after process start, serializes requests, drains stderr, and bounds response frames. `GAEP_ENGINE_SHA256` can provide the expected 64-character digest (with an optional `sha256:` prefix) and makes a mismatch fail closed. Capturing a locally selected digest detects replacement; it is not a publisher-authenticity claim.

Release packaging will bundle signed Windows engine binaries and supply their approved digest. It will not invoke a mutable executable found later on `PATH` without identity binding and digest verification.
