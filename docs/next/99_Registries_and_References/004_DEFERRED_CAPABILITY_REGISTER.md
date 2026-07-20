---
id: GAEP-REG-004
title: Deferred Capability Register
document_type: registry
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: Capabilities deliberately excluded from the first-horizon Core and implementation readiness work
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies: []
informative_references:
  - ../../06_Roadmap/053_FUTURE_EVOLUTION.md
supersedes: []
---

# Deferred Capability Register

Deferral means the Core may preserve a compatible extension point, not that GAEP should design or build the capability now.

| Capability | Why deferred | Reconsideration trigger | Prerequisite evidence |
|---|---|---|---|
| graph database or knowledge graph | no demonstrated need beyond repository-visible trace | scale or query evidence shows file/index approach is insufficient | query corpus, correctness and operating-cost comparison |
| multi-agent orchestration | correlated errors and authority complexity exceed proven value | one-agent/manual workflow is stable and bounded coordination need is measured | identity, delegation, evidence independence and recovery maturity |
| microservices platform | premature operational and consistency burden | approved runtime has distinct scaling/trust/ownership boundaries | quality scenarios and simpler-deployment comparison |
| centralized enterprise control plane | risks over-centralization and adoption cost | federation pilots require shared governance services | tenant, identity, availability, data and exit requirements |
| broad web UI | workflow and personas unvalidated | repeated manual pilot identifies stable interaction needs | service blueprint and usability evidence |
| autonomous release/deployment | high-consequence effect path not justified | lower-autonomy paths prove safe and burdensome manual step is measured | effect authorization, monitoring, recovery and AI evaluation |
| adapter marketplace | supply-chain, liability and quality governance unresolved | multiple independent publishers and consumers exist | signing, publisher trust, conformance, revocation and support model |
| automatic learning promotion | contamination and stale-evidence risks unresolved | manual promotion becomes measurable bottleneck | learning quality, demotion, revocation and provenance evidence |
| cross-company benchmarking | privacy, comparability and incentive risks | organizations request it with a lawful and trusted model | metric equivalence, anonymization, governance and anti-gaming evidence |
| commercial pricing and partner channels | product mode and demand unvalidated | external product strategy is approved | customer evidence, support economics, license and liability model |
| complete standards certification | expensive and potentially category-defining | target market requires a named certification | licensed standards review, competent assessor and business case |
| real-time global policy service | availability and central authority risk | distributed policy resolution proves insufficient | service objectives, cache/degraded semantics and trust model |

## Anti-roadmap rule

Deferred items are not promises or hidden roadmap commitments. Moving one into active scope requires a new evidence-backed decision with owner, value, risk, alternatives, prerequisites and displaced work.
