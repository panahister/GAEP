# GAEP for Kiro

GAEP for Kiro is a local Code OSS/Open VSX-compatible extension boundary for the GAEP engine host. It exposes a static Product Studio panel plus protocol-v2 import, list, and exact-read commands for portable-design snapshot metadata.

The extension starts only the configured local `gaep-engine` executable and sends no requests to external services. Import accepts one existing local folder. Files, archives, `.fig` ingestion, OAuth, network fetches, live design-tool accounts, and provider credentials are outside this extension.

Every imported snapshot remains `pending-human-review`. An upstream `approved` source-review value is preserved only as a claim; it is not GAEP approval, a Design Baseline, implementation readiness, or release readiness.
