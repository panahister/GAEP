# Repository Structure

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-REP-030  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Logical and physical repository organization

## Purpose

This document defines the target GAEP repository structure. The structure separates platform specifications, reusable capabilities, Engineering Initiative workspaces, Product-specific workspaces, implementation adapters, generated work, and evidence while preserving discoverability for humans and agents.

## Structural Principles

- organize by responsibility and authority, not by author or tool;
- keep platform assets separate from initiative-specific knowledge;
- distinguish authoritative content from generated and temporary work;
- use stable IDs and metadata rather than paths as permanent identity;
- keep core contracts vendor-neutral;
- allow external-system references without making them invisible;
- favor simple filesystem structures before specialized databases;
- validate structure deterministically.

## Target Top-Level Structure

```text
/
├── README.md
├── AGENTS.md
├── .gaep/
│   ├── workspace.yaml
│   ├── state/
│   ├── indexes/
│   └── local/                 # ignored local runtime data
├── docs/                      # platform knowledge architecture
├── governance/
│   ├── policies/
│   ├── standards/
│   ├── profiles/
│   └── exceptions/
├── schemas/
│   ├── artifacts/
│   ├── metadata/
│   ├── commands/
│   ├── skills/
│   ├── events/
│   └── state/
├── packages/
│   ├── product-foundation/
│   ├── business-architecture/
│   ├── product-architecture/
│   ├── process-data-event/
│   ├── experience-design/
│   ├── backlog-engineering/
│   ├── solution-architecture/
│   ├── implementation-engineering/
│   ├── quality-security/
│   ├── release-transition/
│   └── operations-evolution/
├── commands/
├── skills/
├── templates/
├── patterns/
├── adapters/
│   ├── agents/
│   ├── design/
│   ├── backlog/
│   ├── source-control/
│   ├── testing/
│   └── operations/
├── products/
│   └── <product-id>/
├── initiatives/
│   └── <initiative-id>/
├── examples/
├── tests/
│   ├── schemas/
│   ├── commands/
│   ├── skills/
│   ├── policies/
│   └── fixtures/
└── tools/
```

This is a target architecture, not authorization to create all directories immediately. Implementation follows the roadmap and should add structure only when the related contract exists.

## Documentation Structure

The current `/docs` tree is the platform knowledge architecture:

```text
docs/
├── 000_READ_FIRST.md
├── 01_Foundation/
├── 02_Platform/
├── 03_Product_Engineering/
├── 04_Repository/
├── 05_AI_Runtime/
├── 06_Roadmap/
└── 99_References/
```

Number prefixes define reading order, not stable entity identity. Each document also carries a stable document ID.

## Product Workspace Structure

```text
products/<product-id>/
├── product.yaml
├── README.md
├── context/
│   ├── profile/
│   ├── glossary/
│   ├── constraints/
│   └── context-packs/
├── discovery/
├── business/
│   ├── capabilities/
│   ├── value-streams/
│   └── business-context/
├── product-architecture/
│   ├── domains/
│   ├── modules/
│   ├── actors-roles/
│   └── quality-attributes/
├── behavior/
│   ├── processes/
│   ├── rules/
│   ├── data/
│   ├── events/
│   └── integrations/
├── experience/
│   ├── journeys/
│   ├── ux/
│   └── design-system/
├── backlog/
├── architecture/
│   ├── decisions/
│   ├── contracts/
│   └── views/
├── engineering/
├── verification/
├── releases/
├── operations/
├── changes/
├── decisions/
├── approvals/
├── risks/
├── evidence/
└── indexes/
```

Product workspaces may reference implementation repositories rather than contain source code. The product memory remains coherent through stable IDs and external artifact references.

## Engineering Initiative Workspace Extension

`initiatives/<initiative-id>/` is the generic workspace boundary for Product and non-Product work. Existing `products/<product-id>/` paths remain valid Product-specific workspaces and may map to an Initiative Profile without immediate relocation.

An initiative workspace shall be able to contain or reference these semantic facets using the smallest coherent physical structure:

```text
initiatives/<initiative-id>/
├── initiative.yaml
├── applicability/
├── requirements/
├── challenges/
├── architecture/
│   ├── decisions/
│   ├── hld/
│   ├── lld/
│   ├── diagrams/
│   └── topology/
├── technology-profiles/
├── identity-access/
├── assurance/
│   ├── methodology/
│   ├── test-cases/
│   ├── coverage/
│   ├── evidence/
│   └── quality-gates/
├── boilerplate-bindings/
├── readiness/
├── changes/
├── approvals/
└── indexes/
```

This tree is a conceptual extension, not an instruction to create every directory for every initiative. Facets may be flattened, combined, or externally referenced when metadata, authority, applicability, version, and traceability remain clear. Product-only discovery, experience, Figma, and backlog areas are created only when applicable.

## Reusable Capability Structure

Each package, command, skill, template, or pattern uses a predictable layout:

```text
<capability>/<canonical-name>/
├── manifest.yaml
├── README.md
├── resources/
├── examples/
├── schemas/
├── tests/
└── CHANGELOG.md
```

Only include directories the capability actually needs. Empty ceremony is discouraged.

## Governance Structure

```text
governance/
├── policies/       # enforceable rules
├── standards/      # approved quality or interoperability requirements
├── profiles/       # lightweight, standard, enterprise, regulated tailoring
└── exceptions/     # governed, scoped, expiring variations
```

Initiative-specific policy and exceptions live in the initiative or Product workspace but reference the governing organizational source.

## Runtime Data Boundary

`.gaep/` holds platform operational metadata:

- workspace descriptor;
- deterministic indexes derived from source artifacts;
- local state caches;
- adapter capability snapshots;
- ignored temporary runtime data.

Authoritative initiative decisions must not exist only in a cache or local runtime directory. Derived indexes must be rebuildable.

## Generated Work

Generated content is written to an isolated draft or change scope. It must not overwrite baselines directly.

Recommended behavior:

- run-scoped temporary output in ignored runtime storage;
- proposed artifacts in the active change area;
- accepted artifacts promoted through the artifact lifecycle;
- rejected or abandoned output retained only according to policy.

Do not create uncontrolled `generated`, `final`, or timestamp-only directories as substitute lifecycle state.

## External Artifact References

Figma, backlog platforms, CI systems, deployment systems, and other repositories are represented by metadata records containing:

- provider and resource type;
- stable external ID and URL;
- version, revision, or snapshot semantics;
- owner and authority;
- classification and access expectations;
- trace links and local evidence;
- synchronization or freshness policy.

## Repository Boundaries

GAEP may use:

- one repository for platform assets;
- separate initiative or Product knowledge repositories;
- separate source-code repositories;
- shared organizational package catalogs.

Cross-repository links use globally unique IDs and resolvable registry references. A monorepo is optional.

## Ignored and Sensitive Content

Ignore or secure:

- secrets and credentials;
- local model caches;
- raw sensitive context exports;
- transient tool output;
- personal settings;
- downloaded external content without governed provenance;
- large reproducible binaries unless policy requires retention.

Classification, not file extension, determines protection.

## Structural Validation

Automated checks should validate:

- allowed top-level directories;
- required manifests;
- schema conformance;
- unique IDs;
- valid names and versions;
- referenced file and artifact existence;
- forbidden secrets or sensitive patterns;
- orphaned, duplicate, and superseded content;
- generated-versus-baseline separation.

## Migration Strategy

When adopting GAEP in an existing repository:

1. inventory current knowledge and tools;
2. identify authoritative sources and duplicates;
3. create a minimal workspace descriptor and indexes;
4. map existing artifacts to GAEP IDs and types;
5. avoid moving source files without a clear benefit;
6. add metadata and trace incrementally;
7. retire old structures only after validation and redirects.

## Design Implications

This structure directly implements:

- [Repository Philosophy](../02_Platform/011_REPOSITORY_PHILOSOPHY.md)
- [Context Packs](031_CONTEXT_PACKS.md)
- [Artifact Model](033_ARTIFACT_MODEL.md)
- [Metadata Model](034_METADATA_MODEL.md)
- [Naming Conventions](035_NAMING_CONVENTIONS.md)
- [Implementation Strategy](../06_Roadmap/051_IMPLEMENTATION_STRATEGY.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
