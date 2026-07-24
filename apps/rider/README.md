# GAEP for Rider

This host is a thin Rider tool-window client for the shared `gaep-engine` stdio protocol. It deliberately contains no duplicate Product, governance, adapter, or authorization logic.

The development client resolves `gaep-engine` from `PATH` or `GAEP_ENGINE_EXECUTABLE` to a canonical absolute file, captures its SHA-256 on first launch, and revalidates the path and digest before every restart and immediately after process start. `GAEP_ENGINE_SHA256` may provide an expected 64-character digest (with an optional `sha256:` prefix). Requests are serialized and JSON-validated, stderr is drained, response frames are bounded, and process-tree termination is attempted on failure or disposal. Capturing a locally selected digest detects replacement but is not a publisher-authenticity claim.

Release packaging will bundle signed platform-specific engine binaries and supply their approved digests before launch.

Build requirements follow the official IntelliJ Platform Gradle Plugin 2.x baseline: Gradle 9 or newer and Java 17 or newer. The configured toolchain is Java 21.

From the repository root, `npm run test:rider:package` performs a clean test, mandatory IntelliJ bytecode instrumentation, plugin assembly, and archive-structure verification without parallel instrumentation. The installable output is `apps/rider/build/distributions/gaep-rider-0.1.0.zip`, with stable plugin ID `dev.gaep.productstudio`. This local package gate does not claim native interactive Rider execution or Marketplace signing.
