# GAEP for Rider

This host is a thin Rider tool-window client for the shared `gaep-engine` stdio protocol. It deliberately contains no duplicate Product, governance, adapter, or authorization logic.

The current development build expects `gaep-engine` on `PATH` or an absolute executable path in `GAEP_ENGINE_EXECUTABLE`. Release packaging will bundle signed platform-specific engine binaries and verify their digests before launch.

Build requirements follow the official IntelliJ Platform Gradle Plugin 2.x baseline: Gradle 9 or newer and Java 17 or newer. The configured toolchain is Java 21.
