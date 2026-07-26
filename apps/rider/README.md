# GAEP for Rider

This host is a thin Rider tool-window client for the shared `gaep-engine` stdio protocol. It deliberately contains no duplicate Product, governance, adapter, or authorization logic.

The current development build expects `gaep-engine` on `PATH` or an absolute executable path in `GAEP_ENGINE_EXECUTABLE`. Release packaging will bundle signed platform-specific engine binaries and verify their digests before launch.

Build requirements follow the official IntelliJ Platform Gradle Plugin 2.x baseline: Gradle 9 or newer and Java 17 or newer. The configured toolchain is Java 21.

## GAEP-P0-CS02 (provider/model read-only slice, 0.2.0)

Installable 0.2.0 artifact with a native GAEP surface, provider detection (Codex/Claude Code),
server-derived model truth, provider/model selection and switching, and one bounded read-only
analysis over the shared Engine Host protocol (v3). The bundled Engine Host runtime is digest-
verified before launch and never resolved from `PATH`. See
[`docs/06_Roadmap/CS02_INSTALL_AND_RELEASE_GUIDE.md`](../../docs/06_Roadmap/CS02_INSTALL_AND_RELEASE_GUIDE.md)
for install, provider prerequisites, model truth, uninitialized-Product behavior, execution
limitations, test commands, upgrade, uninstall, and rollback.
