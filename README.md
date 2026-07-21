# GAEP

GAEP is an IDE-native platform for designing Products and executing bounded Initiatives through installed AI agents under explicit governance. This branch contains the first local Founder Edition implementation alongside the proposed specification corpus.

Visual Studio Code is the first usable host. Rider has a native tool-window host scaffold, and Visual Studio has a cross-platform engine-protocol client; both consume the same local engine rather than redefining GAEP semantics. The specification remains proposed, so working software does not by itself designate an approved GAEP baseline or authorize production deployment.

## Founder Edition implementation

The implementation is local-first and keeps portable records in the workspace `.gaep/` directory:

- `packages/contracts`: versioned Product, Initiative, agent, charter, run, handoff, audit, and host-protocol contracts;
- `packages/engine`: state transitions, atomic persistence, append-only hash-chained audit, charter gates, runs, and governed switching;
- `packages/adapters`: capability-aware Codex CLI and Claude Code adapters using argument arrays rather than shell interpolation;
- `apps/engine-host`: newline-delimited JSON-RPC process shared by non-TypeScript IDE hosts;
- `apps/vscode`: native Product, Agent, and Governance views, guided onboarding, model/settings selection, charter confirmation, terminal execution, and handoff capture;
- `apps/rider` and `apps/visual-studio`: additional host foundations against the same protocol;
- `design/IDE_EXTENSION_UI_SPEC.md`: host-native interaction and accessibility baseline.

No provider credentials are copied into GAEP records. Provider-native permissions remain distinct from a GAEP approval or Authorization Grant.

### Build and verify

Requires Node.js 22 or newer. From the repository root:

```bash
npm install
npm run check
npm run build
npm run package:vscode
```

The packaged development VSIX is written to `apps/vscode/dist/gaep-vscode.vsix`. Install it in VS Code, open a workspace, select the GAEP Activity Bar view, and choose `Initialize Product`. Agent execution never starts during onboarding and requires both a confirmed charter and a separate launch confirmation.

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
   - The [Core Boundary and Complexity Budget](docs/next/99_Registries_and_References/010_CORE_BOUNDARY_AND_COMPLEXITY_BUDGET.md) records the working 8-contract / 160-requirement / 48-concept contraction and the remaining semantic and approval blockers.
4. Inspect the [GAEP-on-GAEP workspace](docs/next/06_GAEP_On_GAEP/), especially the [Repository Gap Register](docs/next/06_GAEP_On_GAEP/012_REPOSITORY_GAP_REGISTER.md), [Product Decision Crosswalk](docs/next/06_GAEP_On_GAEP/011_PRODUCT_DECISION_CROSSWALK.md), and [Pre-Implementation Candidate Closure Report](docs/next/06_GAEP_On_GAEP/013_PRE_IMPLEMENTATION_CLOSURE_REPORT.md).
5. Follow the pre-implementation gates in order:
   - [Pilot Readiness Gate](docs/next/08_Roadmap_and_Adoption/005_PILOT_READINESS_GATE.md) before a bounded manual pilot;
   - [Candidate Baseline Approval Gate](docs/next/08_Roadmap_and_Adoption/006_CANDIDATE_BASELINE_APPROVAL_GATE.md) before designating an authoritative specification baseline;
   - [Implementation Readiness Gate](docs/next/08_Roadmap_and_Adoption/003_IMPLEMENTATION_READINESS_GATE.md) before an implementation investment decision; and
   - [Implementation Authorization Process](docs/next/08_Roadmap_and_Adoption/007_IMPLEMENTATION_AUTHORIZATION_PROCESS.md) before any effectful implementation work.
6. Apply the [Complexity and Subtraction Gate](docs/next/08_Roadmap_and_Adoption/008_COMPLEXITY_AND_SUBTRACTION_GATE.md) to material additions, including the candidate structure itself.

A passing gate is evidence assessment, not approval or authorization. Each later decision remains a separate, version-bound record.

## Candidate restrictions

The proposed corpus does not authorize production-data access, procurement, release, deployment, public conformance claims, or organizational mandates. The local Founder Edition is development software and has not passed a formal candidate-baseline, cross-host conformance, signing, marketplace, or production-readiness determination.

## Candidate validation

The candidate corpus can be checked without third-party packages:

```bash
ruby scripts/validate_next_docs.rb
ruby scripts/validate_next_docs.rb --mode candidate
ruby scripts/validate_next_docs.rb --mode baseline
ruby scripts/validate_next_docs.rb --mode implementation-readiness
```

`structural` is the default. `candidate` additionally enforces the active Core budget, former-requirement dispositions, 19-Profile inventory, and paper-rehearsal coverage. `baseline` and `implementation-readiness` retain those checks but exit with `BLOCKED` while required decisions, authority, evidence, exact-set, approval, pilot, or implementation prerequisites are absent. A blocked result is an honest gate observation, not a tooling failure.

The check covers metadata and approval-shape rules, owner-role resolution, unique document and requirement IDs, exact and retired requirement references, normative dependency integrity and cycles, candidate document references, Profile contract structure, Product and Core decision-register coverage and tier classification, synchronization of conflicting Core decisions with their current-assumption disclosures, Core contraction and extraction coverage, repository-gap ID uniqueness, all 44 legacy migration entries, scenario and rehearsal coverage, required root governance files, local links, headings, fenced blocks, trailing whitespace, and extra blank lines at end of file. Passing it demonstrates machine-checkable document consistency only; it does not resolve semantic contradictions, close open decisions, approve the specification, validate product value, or authorize implementation.

An exact manifest can be generated without third-party packages. The builder refuses a dirty tree by default; the explicit dirty option can produce only a non-formal draft snapshot:

```bash
ruby scripts/build_candidate_revision_set.rb --allow-dirty-draft
ruby scripts/build_candidate_revision_set.rb --formal --candidate-set-id <canonical-id> --purpose <declared-purpose>
```

Output is written to standard output. Even a clean formal manifest has `not-approved` status and no authority, baseline, or implementation effect; its review, proposal, approval, and designation remain separate governed actions.

## License and contribution status

Distribution, licensing, contribution rights, and external publication are unresolved decisions. Do not assume permission beyond the repository owner's existing rights and access grants. See [License Status](LICENSE_STATUS.md) and [Contributing](CONTRIBUTING.md).
