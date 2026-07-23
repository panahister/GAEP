<!-- Copyright (c) 2026 Mohammad Maheri. Licensed under Apache 2.0. See LICENSE. Attribution required - see NOTICE. -->
# Post-Workflow: Agent Installation

## Phase: 🚀 ASSEMBLY (post-workflow)
## Execution: ALWAYS — automatic, no user interaction

---

## Purpose

After the Architecture Package (AP) workflow completes — or at any point during AI-ADLC execution — install the AI-ADLC governance agent into the destination workspace. This step is **automatic**: it requires no user interaction and runs independently of any sibling package.

The agent installed is the **architecture-decision-agent** (`ADLC-AG-01`), and the install activates the `ADA__` shortcut for post-AP architecture-quality validation.

---

## What Gets Installed

| Artifact | Destination | Action |
|----------|-------------|--------|
| `architecture-decision-agent.md` | `.kiro/agents/` | Copy from `templates/agents/` |
| Shortcut rules block | `.kiro/steering/workspace-rules.md` | Append `<!-- BEGIN AI-ADLC AGENT SHORTCUTS -->` block (or replace if exists) |
| Agent registry entries | `.governance/AGENT_REGISTRY.md` | Create file if absent; append AI-ADLC entries if exists |
| Agent guide section | `.governance/AGENT-GUIDE.md` | Create file if absent; append AI-ADLC section if exists |

---

## Installation Logic

1. **Agent file:** Copy `templates/agents/architecture-decision-agent.md` to `.kiro/agents/architecture-decision-agent.md`. Populate `{version}` with the current AI-ADLC version and `{ISO-date}` with today's date.

2. **Shortcut block:** Check `.kiro/steering/workspace-rules.md` for the `<!-- BEGIN AI-ADLC AGENT SHORTCUTS -->` marker:
   - If found → replace the block (between BEGIN and END markers)
   - If not found → append the block from `templates/agents/shortcut-rules-block.md`

3. **Agent registry:** Check for `.governance/AGENT_REGISTRY.md`:
   - If absent → create with header + AI-ADLC entry (ADLC-AG-01)
   - If exists → append AI-ADLC entry using the next available `ADLC-AG-{NN}` ID
   - Entry: `| ADLC-AG-01 | architecture-decision-agent | Process | ADA__ | 1 | AI-ADLC | Active | {date} |`

4. **Agent guide:** Check for `.governance/AGENT-GUIDE.md`:
   - If absent → create with header + AI-ADLC section from `templates/agents/agent-guide.md`
   - If exists → append AI-ADLC section (between `<!-- BEGIN AI-ADLC AGENT GUIDE SECTION -->` markers)

---

## Self-Sufficiency Rule (AGENT_GOVERNANCE_CONTRACT §5)

AI-ADLC installs its own agent independently. There is **no dependency** on AI-GCE or AI-PILC being present. If other packages run later, they will detect and preserve the AI-ADLC entries via marker-based ownership.

---

## Post-Install Confirmation

```
🤖 AI-ADLC Governance Agent Installed
   • Agent: architecture-decision-agent (ADLC-AG-01)
   • Shortcut: ADA__ (active immediately)
   • Call ADA__ after AP completion to validate architecture quality.
```

---

## Family upgrade agent (create-if-absent) — PDLC-UPG-01 / `UPG__`

In addition to this package quality agent, install the **family upgrade agent** — a family-level agent shared by all PDLC packages, installed once per workspace. Whichever PDLC package the user installs provides it; later packages detect it and skip.

1. **Install agent (if absent)** → if the platform agent slot has no `family-upgrade-agent.md`, copy `templates/agents/family-upgrade-agent.md` there. If it exists, skip.
2. **Register the `UPG__` shortcut (if absent)** → if `.kiro/steering/workspace-rules.md` has no `<!-- BEGIN PDLC UPGRADE SHORTCUT -->` marker, append `templates/agents/upgrade-shortcut-block.md`. If present, skip.
3. **Register in AGENT_REGISTRY.md (if absent)** → append the `PDLC-UPG-01` row — agent `family-upgrade-agent`, type **Migration**, trigger `UPG__`, producer PDLC (family-level), scope: all PDLC `pdlc-ws/` output. Do not duplicate if already present.
4. **Catalogue availability** → the upgrade agent reads `.aiflc/pdlc/MIGRATION_CATALOGUE.md` (installed as a family artifact). No per-package action needed beyond ensuring the family install placed it.

The upgrade agent is report-and-confirm and idempotent — see `family-upgrade-agent.md` and `MIGRATION_CATALOGUE.md`.
