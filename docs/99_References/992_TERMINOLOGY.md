# Terminology

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-REF-992  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Controlled terminology and usage rules

## Purpose

This document establishes canonical GAEP terms, distinguishes frequently confused concepts, and records preferred, allowed, and deprecated usage.

## Canonical Product Name

Use:

> **Governed AI Engineering Platform (GAEP)**

Do not use `Govern AI Engineering Platform` as the formal expansion. `Governed` describes the defining property: AI participation and engineering operate within governance.

`GAEP` may be used after the full name is introduced.

## Normative Language

- **shall:** mandatory requirement in a normative document;
- **must:** unavoidable requirement or direct imperative, used sparingly;
- **should:** strong recommendation with possible justified exception;
- **may:** permitted option;
- **can:** capability or possibility, not permission;
- **will:** prediction or stated future behavior, not a requirement.

## Platform Versus Framework

### Platform

An integrated set of stable semantics, governance, reusable capabilities, runtime contracts, and extension points supporting multiple Engineering Initiatives, Products, and methods.

### Framework

A structured method or implementation toolkit applied within a defined scope.

GAEP is a platform. AI-DLC and other execution approaches may be frameworks or methodologies integrated into it.

## Adaptive Engineering, Product Engineering, and SDLC

### Adaptive Engineering

GAEP's initiative-neutral approach that selects lifecycle, architecture, security, technology, assurance, assets, and approvals through applicability and risk rather than a universal pipeline.

### Product Engineering

Includes discovery, business architecture, product architecture, domain/process/data/event design, UX, backlog, implementation, quality, release, operations, and learning.

### Software Development Lifecycle (SDLC)

Commonly emphasizes software planning through operation. GAEP may support SDLC activities but intentionally begins earlier with product and business understanding.

GAEP may also govern non-Product work that does not require Product discovery or business architecture. Product Engineering and SDLC are applicable profiles or domains, not universal names for all GAEP work.

## Engineering Initiative Versus Product

- **Engineering Initiative:** generic governed unit of engineering work.
- **Product:** an Engineering Initiative type with Product-specific value, user, market, lifecycle, and ownership semantics.

Use Engineering Initiative in generic platform contracts. Use Product only when Product semantics actually apply. Do not rename valid Product-specific lifecycle or architecture concepts merely to remove the word Product.

## Command, Skill, Agent, and Runtime

| Term | Canonical distinction |
|---|---|
| Command | Declared user/system intent and governance contract. |
| Skill | Reusable method for achieving or evaluating an outcome. |
| Agent | Bounded reasoning/execution participant applying context and skills. |
| Runtime | Orchestrator enforcing state, policy, tools, evidence, and lifecycle. |

Do not call a prompt a command unless it has a stable contract. Do not call an agent a skill merely because it performs a method.

## Artifact, Document, and File

- A **file** is a storage object.
- A **document** is a human-readable content form.
- An **artifact** is a governed unit with identity, metadata, lifecycle, and relationships.

One artifact may use several files or an external system. One file may contain several small entities, but governance should keep identity clear.

## Approval, Review, and Validation

- **Review:** evaluates fitness and produces findings.
- **Validation:** checks defined criteria or contract.
- **Approval:** accountable authorization for an exact subject and scope.

An AI review is not human approval. A successful validator does not approve an initiative or Product decision.

## Approved Versus Baseline

- **Approved:** accepted by an authorized role.
- **Baseline:** approved version designated as the current authoritative reference.

Not every approved artifact becomes the active baseline immediately.

## Fact, Assumption, Inference, and Decision

- **Fact:** claim intended to describe reality with source and scope.
- **Assumption:** unverified proposition temporarily used.
- **Inference:** conclusion derived from facts or observations.
- **Decision:** accountable choice among alternatives.

Agents must label these distinctions when material.

## Domain Event Versus Integration Event

- **Domain Event:** meaningful fact within a domain model and bounded context.
- **Integration Event:** published contract for communication across a boundary.

One occurrence may produce both representations, but they have different ownership, schema, and compatibility concerns.

## Product Architecture Versus Solution Architecture

- **Product Architecture:** technology-independent logical structure, responsibilities, actors, domains, modules, access, and quality intent.
- **Solution Architecture:** implementation-oriented components, services/modules, contracts, data ownership, quality tactics, and deployment constraints.

Do not let solution technology define product boundaries by default.

## HLD Versus LLD

- **HLD:** major architecture context, boundaries, topology, data, integrations, deployment, trust, and quality attributes.
- **LLD:** implementation-guiding components, interfaces, sequences, states, transactions, failures, enforcement, and observability.

Both are applicability- and risk-driven artifact sets. Neither term implies one notation, file, or mandatory depth.

## Authentication Versus Authorization

- **Authentication:** establishes and validates identity or credential trust.
- **Authorization:** determines whether a subject may perform an action on a resource in context.

Authentication does not automatically solve authorization. Authorization belongs at the authoritative service, resource, data, or infrastructure boundary, not only in a UI.

## Repository Versus Codebase

- **Repository:** governed engineering memory and storage boundary.
- **Codebase:** implementation source and related engineering assets.

A GAEP initiative may reference several code repositories. A code repository may also contain initiative or Product knowledge.

## Context Versus Memory

- **Context:** knowledge selected for a current objective.
- **Memory:** durable or temporary knowledge retained across time.

Initiative and organizational memory belongs in governed repositories. Provider-side agent memory is not authoritative context.

## Applicability, Lifecycle, Approval, and Freshness

- **Applicability:** whether a phase, artifact, method, test, or approval is required or relevant.
- **Lifecycle:** progression of a governed subject through its type-specific states.
- **Approval:** version-bound accountable authorization.
- **Freshness:** whether a change-sensitive artifact remains current.

These are separate dimensions. Approved does not mean applicable everywhere or current forever. Not Applicable is not an artifact lifecycle state. Stale does not erase historical approval.

## Assurance Strategy Versus Assurance Profile

- **Assurance Strategy:** initiative-level governing intent for how claims will be supported proportionally to risk.
- **Assurance Profile:** executable, versioned assurance contract for an initiative, implementation unit, interface, workflow, or release.

## Test Methodology Versus Test Level

- **Test methodology:** collaboration or design approach such as BDD, TDD, ATDD, risk-based testing, or specification by example.
- **Test level:** boundary or assurance scope such as unit, component, integration, contract, API, security, authorization, or end-to-end.

Gherkin is a representation that may support a methodology; it is not universally required and is not a substitute for selecting applicable test levels.

## Recommendation, Challenge, Human Decision, and Approval

- **AI recommendation:** advisory option with rationale and uncertainty.
- **Challenge outcome:** recorded questions, alternatives, evidence, and revision.
- **Human decision:** accountable selection, rejection, modification, or deferral.
- **Formal approval:** authorization for an exact version and transition when policy requires it.

These states must not be collapsed or inferred from each other.

## Evidence Versus Confidence

- **Evidence:** observable support for a claim.
- **Confidence:** degree of belief or uncertainty.

High AI confidence is not evidence. Evidence quality influences, but is not replaced by, confidence.

## Governance Versus Control

- **Governance:** decision rights, policies, accountability, and outcome oversight.
- **Control:** specific mechanism that prevents, detects, or responds to risk.

GAEP uses controls to implement governance without reducing governance to approval gates.

## Deprecated or Discouraged Terms

| Avoid | Use instead | Reason |
|---|---|---|
| `AI employee` | Agent or AI collaborator | Avoids false accountability and employment semantics. |
| `fully autonomous engineer` | Governed agent with declared authority | Autonomy is scoped and does not own outcomes. |
| `single source of truth` without scope | Authoritative source for `<scope>` | Truth can be domain- and time-scoped. |
| `final` filename | Version plus lifecycle status | Final is ambiguous and becomes stale. |
| `prompt library` for GAEP | Command/skill catalog | GAEP contracts are broader than prompts. |
| `AI-DLC platform` | GAEP with AI-DLC execution profile | Avoids methodology lock-in. |
| `model` alone | Qualified model type | Could mean AI, domain, data, process, or representation. |
| `approved by AI` | AI-reviewed; human approval recorded separately | AI lacks accountable approval authority. |
| `product` as a generic name for all work | Engineering Initiative | Product is one initiative type. |
| `coverage` without a dimension | Qualified Coverage Target | A single percentage does not establish assurance adequacy. |

## Localization

Canonical machine identifiers and cross-initiative platform terms are English. Initiative and Product artifacts may be Persian or multilingual when:

- a canonical term and language are recorded;
- important domain definitions include approved translations;
- identifiers remain stable;
- translation provenance and review are visible;
- no information is lost in the authoritative representation.

## Terminology Change Process

1. propose new term or change;
2. identify owning domain and conflicting meanings;
3. define canonical, aliases, localized labels, and examples;
4. assess impact on artifacts, schemas, commands, skills, and code;
5. approve and version;
6. migrate machine values or add aliases;
7. deprecate old usage with a transition period.

## Design Implications

This terminology controls:

- [Glossary](991_GLOSSARY.md)
- [Naming Conventions](../04_Repository/035_NAMING_CONVENTIONS.md)
- [Metadata Model](../04_Repository/034_METADATA_MODEL.md)
- all future GAEP schemas, commands, skills, and artifacts.
- [Adaptive Engineering Principles](../01_Foundation/006_ADAPTIVE_ENGINEERING_PRINCIPLES.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
