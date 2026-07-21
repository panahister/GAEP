# GAEP for Visual Studio

The Visual Studio host will use Microsoft's out-of-process `VisualStudio.Extensibility` model and communicate with the same `gaep-engine` stdio protocol used by Rider. `Gaep.HostClient` is the buildable, IDE-independent C# protocol client.

The VSIX shell and Remote UI tool window require a Windows machine with the Visual Studio extension-development workload. They cannot be compiled or integration-tested on this macOS workspace. The host client is intentionally separated so protocol behavior is testable on every .NET-supported platform.

Release packaging will bundle signed Windows engine binaries. It will not invoke a mutable executable found later on `PATH` without digest verification.
