---
id: GAEP-RM-004
title: Legacy Draft Migration Map
document_type: roadmap
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: Current GAEP Draft corpus to GAEP Next candidate baseline
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies: []
informative_references:
  - ../../000_READ_FIRST.md
supersedes: []
---

# Legacy Draft Migration Map

No legacy file is superseded by this map. Supersession requires approved exact versions, preserved history, migration consequences and an explicit baseline decision.

| Current Draft | Candidate disposition |
|---|---|
| `000_READ_FIRST.md` | Replace after approval with the candidate portal and role-based paths |
| `01_Foundation/001_GAEP_CONSTITUTION.md` | Reduce to durable invariants in candidate Constitution |
| `01_Foundation/002_PROJECT_VISION.md` | Split into Product Charter, problem evidence and theory of change |
| `01_Foundation/003_PLATFORM_PHILOSOPHY.md` | Consolidate durable content into Constitution and Principle Catalog |
| `01_Foundation/004_CORE_PRINCIPLES.md` | Consolidate without duplicate obligations into Principle Catalog |
| `01_Foundation/005_DESIGN_PRINCIPLES.md` | Move durable principles to catalog; realization guidance to relevant documents |
| `01_Foundation/006_ADAPTIVE_ENGINEERING_PRINCIPLES.md` | Split into Scope/Work, Applicability, Profile and adoption content |
| `02_Platform/010_PLATFORM_ARCHITECTURE.md` | Replace with bounded contexts plus Repository/Runtime realizations |
| `02_Platform/011_REPOSITORY_PHILOSOPHY.md` | Move invariants to principles and mechanics to Repository Realization |
| `02_Platform/012_CONTEXT_ENGINEERING.md` | Consolidate into Capability/Workflow/Context Core and data/security profiles |
| `02_Platform/013_GOVERNANCE_MODEL.md` | Split into Identity/Authority, Policy/Risk and Decision/Authorization Core |
| `02_Platform/014_COMMAND_MODEL.md` | Normalize within Capability and Workflow Core |
| `02_Platform/015_SKILL_MODEL.md` | Normalize within Capability Core and Agent Adapter Conformance |
| `02_Platform/016_AGENT_MODEL.md` | Split into Identity/Authority, Capability, Execution and Adapter contracts |
| `02_Platform/017_RUNTIME_MODEL.md` | Replace with Execution Core and Runtime Realization |
| `02_Platform/018_STATE_MODEL.md` | Replace with orthogonal State/Event/Transition Core and profile statecharts |
| `02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md` | Split across Scope/Work, Applicability, Profile resolution and lifecycle profiles |
| `02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md` | Split into Claim/Evidence Core, Architecture Profile and Assurance Profile |
| `03_Product_Engineering/020_PACKAGE_STRATEGY.md` | Move package composition to Capability/Profile contracts and product packages to Product Profile |
| `03_Product_Engineering/021_PRODUCT_LIFECYCLE.md` | Become Product Development Profile; claims require evidence or hypothesis labels |
| `03_Product_Engineering/022_ARTIFACT_LIFECYCLE.md` | Split into Governed Resource/Version, State and Retention semantics |
| `03_Product_Engineering/023_CHANGE_MANAGEMENT.md` | Split into Scope/Work, Decision/Authorization and Operational profiles |
| `03_Product_Engineering/024_TRACEABILITY_MODEL.md` | Replace with Trace/Provenance/Semantic Registry Core |
| `03_Product_Engineering/025_HUMAN_APPROVAL_MODEL.md` | Consolidate under Identity and Decision/Authorization Core |
| `04_Repository/030_REPOSITORY_STRUCTURE.md` | Become Repository Realization after authority/federation validation |
| `04_Repository/031_CONTEXT_PACKS.md` | Split into Context Core, Repository Realization and profile rules |
| `04_Repository/032_KNOWLEDGE_MODEL.md` | Split into Trace/Provenance, Claim/Evidence and future learning profile |
| `04_Repository/033_ARTIFACT_MODEL.md` | Replace with Governed Resource and Version Core |
| `04_Repository/034_METADATA_MODEL.md` | Split into document metadata registry and governed-resource metadata contracts |
| `04_Repository/035_NAMING_CONVENTIONS.md` | Replace with namespaced identity and controlled-registry conventions |
| `05_AI_Runtime/040_CODEX_WORKING_MODEL.md` | Reduce to informative Codex delta plus evaluated adapter manifest later |
| `05_AI_Runtime/041_CLAUDE_WORKING_MODEL.md` | Reduce to informative Claude delta plus evaluated adapter manifest later |
| `05_AI_Runtime/042_AGENT_EXECUTION_FLOW.md` | Consolidate into Execution Core and Runtime Realization |
| `05_AI_Runtime/043_CONTEXT_LOADING.md` | Consolidate into Context Core and Runtime Realization |
| `05_AI_Runtime/044_DECISION_MODEL.md` | Consolidate into Decision/Authorization Core |
| `05_AI_Runtime/045_STOP_CONDITIONS.md` | Move to policy-driven execution requirements and profile rules |
| `06_Roadmap/050_PLATFORM_ROADMAP.md` | Replace with outcome-gated pre-implementation roadmap |
| `06_Roadmap/051_IMPLEMENTATION_STRATEGY.md` | Defer technology; retain only readiness and future slice-charter requirements |
| `06_Roadmap/052_ADOPTION_GUIDE.md` | Rebuild around first workflow, burden, behavior, support and trust |
| `06_Roadmap/053_FUTURE_EVOLUTION.md` | Retain extension points; move deferred capabilities out of Core commitments |
| `99_References/990_REFERENCES.md` | Rebuild as complete, versioned standards/reference crosswalk |
| `99_References/991_GLOSSARY.md` | Merge with terminology as human view of canonical registry |
| `99_References/992_TERMINOLOGY.md` | Become canonical terms registry with aliases and deprecation |
| `99_References/993_EXTERNAL_PROJECTS.md` | Split into external mapping registry and alternatives assessment |

## Migration gates

1. Candidate content and ownership review.
2. Contradiction and semantic-registry closure.
3. Reference-scenario and manual-pilot evidence.
4. Metadata, dependency, link and requirement validation.
5. Exact-version approval and named baseline set.
6. Supersession records and redirects.
7. Legacy archival or removal only through a separately approved, recoverable change.

