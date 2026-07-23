# Contributing to GAEP

## Current status

GAEP contains a local Founder Edition implementation alongside pre-implementation product and specification design. Contributions may improve the implementation when they are explicitly authorized for a bounded development scope, and may improve problem evidence, semantics, profiles, scenarios, trust, assurance, adoption, or governance. Existing code does not make the proposed specification approved, conformant, release-ready, or production-authorized; those determinations remain separately gated.

## Authority

A merged or committed contribution is not automatically an approved GAEP requirement. Candidate documents remain Proposed unless an exact version receives a complete approval record.

## Contribution expectations

- preserve the legacy Draft corpus unless a migration decision explicitly authorizes change;
- place candidate redesign work under `docs/next/`;
- follow the Document Metadata Contract and Normative Language and Conformance document;
- give normative requirements stable IDs and verification methods;
- bind changes to an explicit lineage/revision subject and declare compatibility, migration and invalidation consequences;
- distinguish evidence, inference, hypothesis, recommendation, decision and unknown;
- reference canonical terms instead of creating near-synonyms;
- separate normative dependencies from informative references;
- identify affected requirements, profiles, registries, scenarios and migration consequences;
- identify whether a result is a Gate Evaluation, Review Conclusion, Decision Outcome, Approval Determination, Authorization Grant or effect; never collapse them into a generic approval;
- keep standing authority, policy evaluation and executable authorization separate;
- avoid secrets, unnecessary personal data, confidential production information and unlicensed third-party material;
- include negative cases and burden consequences, not only intended behavior;
- do not claim current provider behavior without current authoritative evidence.

## Review dimensions

Changes are reviewed for product value, semantic ownership, cross-document consistency, security, privacy, AI risk, assurance, operations, adoption burden, portability, accessibility, legal/IP impact and migration compatibility as applicable.

Every expansion should also pass a subtraction review: can the same outcome be achieved with fewer concepts, required fields, state values, roles, artifacts or approval steps? Complexity that cannot show a proportional value or risk reduction remains a candidate gap, not a default requirement.

## Open contribution model

The public contribution and contributor-license model is not decided. External distribution or contribution acceptance requires the decisions recorded in `docs/next/00_GAEP_Product_Strategy/008_DISTRIBUTION_LICENSE_AND_ECOSYSTEM.md`.
