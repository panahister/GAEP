<!-- GENERATED FILE: edit this narrative template and GAEP-REG-014, then run npm run render:guideline. -->

# GAEP Product-to-Operations Guideline

{{PROJECTION_HEADER}}

This is the maintained, human-facing GAEP Product surface bundled with the VS Code extension. It uses four progressive layers: stop after the layer that answers your question, or continue for the evidence and methodology details.

## Contents

- [1. Executive orientation](#1-executive-orientation)
- [2. Quick start](#2-quick-start)
- [3. Practitioner guide](#3-practitioner-guide)
- [4. Methodology and maintainer appendix](#4-methodology-and-maintainer-appendix)

<!-- BEGIN HAND-AUTHORED NARRATIVE -->

## 1. Executive orientation

_For executives, Product leaders, and evaluation sponsors · about 5 minutes_

### What GAEP is — and is not

GAEP is a proposed evidence-governed Product-to-Operations decision system. It keeps Product intent, Initiative decisions, sources, architecture, design, delivery, and operating evidence connected while preserving explicit human authority.

GAEP is not a coding-agent leaderboard, an automatic approval system, a replacement for specialist tools, or evidence that an outcome has been achieved. Current repository behavior, Product Owner acceptance, organizational authorization, market evidence, and future plans are separate dimensions.

{{EXECUTIVE_FACTS}}

### The operating model in one view

{{EXECUTIVE_OPERATING_MODEL}}

The thread is intentionally vertical: evidence grounds a candidate; a human reviews and decides; committed truth constrains downstream work; runtime feedback can trigger a new governed change. Skipping a decision does not silently turn it into “not applicable.”

### Authority and evidence boundary

{{AUTHORITY_LOOP}}

AI and tools may propose, challenge, summarize, compare, and prepare evidence. A human remains accountable for acceptance, commit, approval, publication, rollout, and organizational authority. “Implemented and automated-tested” is repository evidence—not Product Owner acceptance, enterprise readiness, security certification, compliance, production authorization, or outcome proof.

## 2. Quick start

_For a first GAEP session · about 10 minutes_

### Your first governed session

Open **GAEP: Open Guide** from the Command Palette at any time. In Chat, address `@gaep`; commands below are verified against the extension package during generation.

{{QUICK_START_FLOW}}

Practical first steps:

1. Run `@gaep /status` to see governed state, current work, and the next valid action.
2. For an existing Product, run `@gaep /adopt`; for a bounded attached document question, use `@gaep /intake`.
3. Use `@gaep /continue` to enter the next valid workflow and `@gaep /author` when a Product Journey record is ready to propose.
4. Inspect the candidate. Use `@gaep /accept` only after review, then `@gaep /commit CONFIRM` only when the exact candidate should become governed state.

Adding a useful link records the link; it does not fetch, read, or approve the linked content. Attach or ingest exact material when its content must become evidence.

### Where you are and what happens next

{{CURRENT_RUNTIME}}

The target lifecycle in Layer 3 is broader than today’s runtime checkpoint vocabulary. Treat the target as an honest map of current, partial, and planned coverage—not as a claim that every node is already automated.

### Visual language for every checkpoint

Use these compact callouts in GAEP conversations and future Product surfaces. They make the state actionable without pretending that an unanswered question is resolved.

> **Why this matters** — explains the downstream decision, risk, or evidence consequence.

> **What GAEP needs from you** — names the bounded human input or authority required now.

> **Previous step** — points to the exact governed predecessor or says that none exists.

> **Current step** — identifies the active checkpoint and whether its content is candidate or governed.

> **Next step** — names the next valid action; it is not a delivery promise.

> **Open question** — visually separates unresolved information from explanatory prose.

> **Blocking decision** — identifies the accountable human decision that prevents valid progression.

> **What will be persisted** — lists the exact candidate or governed fields that the action records.

> **What will not be authorized** — states which approval, publication, rollout, security, compliance, or production authorities remain outside the action.

## 3. Practitioner guide

_For Product, architecture, design, engineering, assurance, and operations practitioners · about 20 minutes_

### Target Product-to-Operations lifecycle

{{STATE_LEGEND}}

The lifecycle is split into three linked vertical views so it remains readable in narrow and wide VS Code panes. Every status is derived conservatively from the exact capability maturity records in the bound P02 registry.

{{TARGET_LIFECYCLE}}

Architecture and DDD precede architecture-bound backlog. Product Design is the canonical tool-neutral target stage. Repository distribution, CI/CD governance, and runtime feedback remain visibly partial or planned where the evidence says so.

### Source grounding and provenance

{{SOURCE_LINEAGE}}

A Source is a governed reference candidate, not automatic truth. A Baseline fixes exact membership and revisions for a bounded context. Provenance records lineage and limitations. A downstream record should point to the exact evidence that informed it and preserve uncertainty that was not resolved.

For source-sensitive work, use `@gaep /intake` to reason over explicitly attached content, `@gaep /record` to preserve reviewed files as candidate Sources, `@gaep /baseline` to propose exact membership, and `@gaep /provenance` to propose conservative lineage. Each proposal still requires review and explicit commit.

### Market and capability decision support

{{MARKET_GUIDE}}

Use this landscape to narrow a job-to-be-done, not to manufacture a universal ranking. A Verified support cell is stronger than Partial; Unknown means the reviewed evidence did not establish the conclusion; delivery state is a separate fact. A GAEP maturity state describes repository evidence and never turns into market support or approval.

### Choose by scenario, never by a winner score

{{SCENARIO_GUIDE}}

Before adopting or buying, state the scenario, required evidence, non-fit boundary, stewardship capacity, incumbent systems that should remain authoritative, and a predeclared proof-of-value measure. No aggregate winner score is permitted because it would erase Unknowns, delivery states, and scenario-specific tradeoffs.

## 4. Methodology and maintainer appendix

_For methodology stewards, reviewers, and maintainers · about 25 minutes_

### Methodology and reference cards

{{METHODOLOGY_GUIDE}}

These sources calibrate exact GAEP concerns. Catalog presence does not mean wholesale adoption, conformance, certification, endorsement, equivalence, safety, security, readiness, approval, or authorization. Figma is a Product and optional design adapter in the market registry; it is not the canonical lifecycle name and is not a methodology.

### Claim-control ledger

{{CLAIM_LEDGER}}

The ledger is not marketing copy. It retains dispositions, qualifiers, limitations, and authority states so internal fact use cannot silently become an approved or public claim.

### Deterministic maintenance contract

{{MAINTENANCE_CONTRACT}}

To change generated facts, update their owning canonical source first. To change explanation or reading flow, edit this narrative template. To change projection structure, lifecycle mappings, required visuals, or bindings, update `GAEP-REG-014`. Then run `npm run render:guideline` and `npm run test:guideline`.

Do not edit the generated Guide directly. CI validates the strict manifest, exact source identities/versions/digests, runtime checkpoint and command projections, all required audience layers and visuals, semantic authority boundaries, and byte-for-byte output freshness.

<!-- END HAND-AUTHORED NARRATIVE -->
