# GAEP for Visual Studio

The Visual Studio host will use Microsoft's out-of-process `VisualStudio.Extensibility` model and communicate with the same `gaep-engine` stdio protocol used by Rider. `Gaep.HostClient` is the buildable, IDE-independent C# protocol client.

The VSIX shell and Remote UI tool window require a Windows machine with the Visual Studio extension-development workload. They cannot be compiled or integration-tested on this macOS workspace. The host client is intentionally separated so protocol behavior is testable on every .NET-supported platform.

Release packaging will bundle signed Windows engine binaries. It will not invoke a mutable executable found later on `PATH` without digest verification.

## GAEP-P0-CS02 (provider/model read-only slice, 0.2.0)

Installable 0.2.0 artifact with a native GAEP surface, provider detection (Codex/Claude Code),
server-derived model truth, provider/model selection and switching, and one bounded read-only
analysis over the shared Engine Host protocol (v3). The bundled Engine Host runtime is digest-
verified before launch and never resolved from `PATH`. See
[`docs/06_Roadmap/CS02_INSTALL_AND_RELEASE_GUIDE.md`](../../docs/06_Roadmap/CS02_INSTALL_AND_RELEASE_GUIDE.md)
for install, provider prerequisites, model truth, uninitialized-Product behavior, execution
limitations, test commands, upgrade, uninstall, and rollback.
