# Naming Conventions

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-REP-035  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Naming and terminology conventions

## Purpose

This document defines naming conventions that make GAEP artifacts predictable, searchable, portable, and understandable to humans and tools.

## General Rules

- use the canonical name **Governed AI Engineering Platform (GAEP)**;
- use one controlled term for one concept;
- prefer clear domain language over internal abbreviations;
- keep stable identity separate from mutable display names;
- use English canonical machine names; localized labels may be added;
- avoid names tied to a vendor unless the artifact is a vendor adapter;
- do not encode lifecycle state or `final` in filenames;
- preserve established public or domain terms where changing them would create confusion;
- record aliases and deprecated terms in the terminology registry.

## File and Directory Names

### Platform documentation

- numbered uppercase snake case for ordered normative documents;
- example: `010_PLATFORM_ARCHITECTURE.md`;
- domain directories use numeric prefix plus readable name, such as `02_Platform`.
- numeric prefixes define order within their domain directory and are not globally unique document identity;
- cross-domain prose and machine references use the stable Document ID, linked title, or repository-relative path rather than a bare numeric prefix.

### Runtime and package assets

- lowercase kebab case;
- examples: `analyze-impact`, `domain-boundary-analysis`, `product-foundation`.

### Initiative and Product IDs and folders

- generic initiative folders use stable lowercase kebab-case slugs;
- generic initiative IDs use the `INI` scope or type according to the applicable ID registry;
- stable lowercase kebab-case folder slug;
- separate uppercase stable product ID in metadata;
- example initiative folder: `initiatives/payment-modernization`;
- example initiative ID: `INI-PAYMENT-0001`;
- example folder: `products/gaep`;
- example ID: `PROD-GAEP`.

Paths are locations, not identity.

## Stable IDs

Recommended format:

`<SCOPE>-<TYPE>-<SEQUENCE>`

Rules:

- uppercase ASCII;
- hyphen separators;
- no mutable title, owner, status, or folder;
- sequence padded consistently within type;
- once issued, never reused;
- aliases point to canonical IDs rather than replacing them.

Common type codes:

| Code | Meaning |
|---|---|
| `FND` | Foundation document or rule. |
| `PLT` | Platform specification. |
| `INI` | Engineering Initiative profile or record. |
| `APP` | Applicability decision or matrix. |
| `CAP` | Business or product capability. |
| `DOM` | Domain or bounded-context artifact. |
| `PRC` | Process. |
| `DAT` | Data concept or model. |
| `EVT` | Event. |
| `UX` | Experience artifact. |
| `BKL` | Backlog artifact. |
| `ARC` | Architecture artifact. |
| `ADR` | Architecture decision. |
| `HLD` | High-Level Design artifact or set. |
| `LLD` | Low-Level Design artifact or set. |
| `TPR` | Technology Profile. |
| `BPL` | Boilerplate or binding record. |
| `ASP` | Assurance Profile. |
| `TST` | Test or validation artifact. |
| `QGT` | Quality Gate definition or result. |
| `EVD` | Evidence. |
| `REL` | Release. |
| `RSK` | Risk. |
| `CHG` | Change. |
| `DEC` | Decision. |
| `APR` | Approval. |
| `CTX` | Context pack. |
| `RUN` | Runtime execution. |

Registries may add codes through governed change.

## Commands

Commands use lowercase action-object kebab case:

- `define-scope`;
- `model-capabilities`;
- `design-domain`;
- `review-architecture`;
- `analyze-impact`;
- `prepare-release`.

Avoid nouns alone, tool names, and ambiguous verbs such as `process`, `handle`, or `generate` without an object.

## Skills

Skills use lowercase method or capability names:

- `capability-mapping`;
- `bounded-context-analysis`;
- `event-classification`;
- `story-slicing`;
- `architecture-conformance-review`.

The skill name describes the reusable method, not the agent persona.

## Agents

Agent role names use a domain or responsibility plus `Agent` in prose, and kebab case in manifests:

- Product Architecture Agent / `product-architecture-agent`;
- Review Agent / `review-agent`;
- Governance Agent / `governance-agent`.

Provider-specific configurations append an adapter or profile field rather than changing the canonical role.

## Events

Domain event names use past tense because they describe facts:

- `ArtifactBaselined`;
- `ApprovalGranted`;
- `ChangeScopeExpanded`;
- `ContextPackInvalidated`.

Commands or requested actions use imperative intent:

- `BaselineArtifact`;
- `RequestApproval`.

Integration event schemas use a versioned contract name and stable event type.

## States

Machine state values use lowercase snake case:

- `in_review`;
- `awaiting_approval`;
- `partially_completed`.

Use only values defined by the applicable state registry. Do not create synonyms such as `under-review`, `pending-review`, and `reviewing` for the same state.

## Versions

- semantic versions for commands, skills, schemas, packages, and adapters: `1.2.0`;
- controlled document/artifact versions may use `1.0`, `1.1`, `2.0`;
- never use `latest`, `new`, `final`, `final2`, or dates as the only version;
- versions do not include approval status.

## Dates and Times

- ISO 8601;
- include timezone for timestamps;
- machine example: `2026-07-18T15:30:00+03:30`;
- date-only example: `2026-07-18` when time is not relevant;
- avoid locale-ambiguous `07/18/26`.

## Domain Language

- Each Engineering Initiative maintains or references a glossary with canonical term, definition, scope, aliases, and deprecated terms. Product initiatives may retain a Product glossary.
- Domain names use singular concepts where possible.
- Bounded contexts may intentionally use different meanings; context qualifier is required.
- Technical implementation terms must not replace business concepts in upstream artifacts.
- Acronyms are expanded at first use and registered when reused.

## Document Headings

- one level-one heading matching the artifact title;
- sentence-style or title-style headings used consistently within a document;
- avoid numbering headings manually when numbering may change;
- use normative words carefully: `shall` for requirement, `should` for strong recommendation, `may` for permission.

## External Names

Preserve official names such as .NET, Next.js, Figma, Codex, Claude Code, and Domain-Driven Design. External tool names appear in adapter or reference context and do not define core GAEP concepts.

## Renaming

A rename requires:

- reason and impact analysis;
- alias or redirect for stable references;
- terminology registry update;
- migration of display names and paths;
- no change to stable ID;
- communication if external consumers are affected.

Breaking semantic changes are not simple renames; they create a new concept or version.

## Prohibited Ambiguity

Avoid:

- `misc`, `other`, `temp`, or `general` as long-lived domain names;
- `manager` without decision responsibility;
- `service` without business or technical qualifier;
- `model` when it could mean AI model, domain model, data model, or representation;
- `approved` in a filename;
- `AI-generated` as a quality claim;
- `package` without package type or ID.

## Validation

Automated naming checks should validate:

- file and directory patterns;
- ID format and uniqueness;
- command and skill names;
- state and relationship registries;
- version and timestamp format;
- forbidden status words in filenames;
- unknown acronyms and deprecated terms where feasible.

## Design Implications

These conventions directly control:

- [Metadata Model](034_METADATA_MODEL.md)
- [Repository Structure](030_REPOSITORY_STRUCTURE.md)
- [Command Model](../02_Platform/014_COMMAND_MODEL.md)
- [Skill Model](../02_Platform/015_SKILL_MODEL.md)
- [Glossary](../99_References/991_GLOSSARY.md)
- [Terminology](../99_References/992_TERMINOLOGY.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
