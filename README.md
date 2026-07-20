# GAEP

GAEP is currently a pre-implementation body of work for governed human-AI engineering. The repository contains documentation and candidate specification material; it does not contain or authorize a GAEP software implementation.

## Documentation states

- [`docs/`](docs/) contains the original Draft corpus.
- [`docs/next/000_READ_FIRST.md`](docs/next/000_READ_FIRST.md) is a non-destructive candidate baseline being developed from the repository-wide gap analysis.

Neither corpus is an approved implementation baseline. The candidate remains `proposed` until the GAEP-on-GAEP readiness and approval process is completed.

“Candidate baseline” is an informal working-corpus label. It does not mean that a Core Candidate Revision Set, Baseline Proposal, Approval Determination, or Baseline Set already exists.

## Recommended starting points

1. Read the candidate [orientation](docs/next/000_READ_FIRST.md).
2. Review the proposed Product Charter and Constitution.
3. Review the Core Specification and applicable Profiles.
   - The [Core Open Decision Register](docs/next/99_Registries_and_References/009_CORE_OPEN_DECISION_REGISTER.md) records all 70 unresolved Core questions.
   - The [Core Boundary and Complexity Budget](docs/next/99_Registries_and_References/010_CORE_BOUNDARY_AND_COMPLEXITY_BUDGET.md) currently blocks baseline approval and identifies required extractions.
4. Inspect the [GAEP-on-GAEP workspace](docs/next/06_GAEP_On_GAEP/), especially the [Repository Gap Register](docs/next/06_GAEP_On_GAEP/012_REPOSITORY_GAP_REGISTER.md) and [Product Decision Crosswalk](docs/next/06_GAEP_On_GAEP/011_PRODUCT_DECISION_CROSSWALK.md).
5. Follow the pre-implementation gates in order:
   - [Pilot Readiness Gate](docs/next/08_Roadmap_and_Adoption/005_PILOT_READINESS_GATE.md) before a bounded manual pilot;
   - [Candidate Baseline Approval Gate](docs/next/08_Roadmap_and_Adoption/006_CANDIDATE_BASELINE_APPROVAL_GATE.md) before designating an authoritative specification baseline;
   - [Implementation Readiness Gate](docs/next/08_Roadmap_and_Adoption/003_IMPLEMENTATION_READINESS_GATE.md) before an implementation investment decision; and
   - [Implementation Authorization Process](docs/next/08_Roadmap_and_Adoption/007_IMPLEMENTATION_AUTHORIZATION_PROCESS.md) before any effectful implementation work.
6. Apply the [Complexity and Subtraction Gate](docs/next/08_Roadmap_and_Adoption/008_COMPLEXITY_AND_SUBTRACTION_GATE.md) to material additions, including the candidate structure itself.

A passing gate is evidence assessment, not approval or authorization. Each later decision remains a separate, version-bound record.

## Current restrictions

The repository does not currently authorize runtime/product code, provider integrations, production-data access, procurement, release, deployment, public conformance claims, or organizational mandates. Existing AI-assisted document authoring does not imply that an AI adapter, provider configuration, or GAEP workflow has passed candidate conformance.

## Candidate validation

The candidate corpus can be checked without third-party packages:

```bash
ruby scripts/validate_next_docs.rb
```

The check covers metadata and approval-shape rules, owner-role resolution, unique document and requirement IDs, exact requirement references, normative dependency integrity and cycles, candidate document references, Profile contract structure, Product and Core decision-register coverage, synchronization of conflicting Core decisions with their current-assumption disclosures, repository-gap ID uniqueness, all 44 legacy migration entries, required root governance files, local links, headings, fenced blocks, trailing whitespace, and extra blank lines at end of file. Passing it demonstrates machine-checkable document consistency only; it does not resolve semantic contradictions, close open decisions, approve the specification, validate product value, or authorize implementation.

## License and contribution status

Distribution, licensing, contribution rights, and external publication are unresolved decisions. Do not assume permission beyond the repository owner's existing rights and access grants. See [License Status](LICENSE_STATUS.md) and [Contributing](CONTRIBUTING.md).
