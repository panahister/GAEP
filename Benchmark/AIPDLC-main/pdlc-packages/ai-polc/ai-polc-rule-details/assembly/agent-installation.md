<!-- Copyright (c) 2026 Mohammad Maheri. Licensed under Apache 2.0. See LICENSE. Attribution required - see NOTICE. -->
# Post-Workflow: Agent Installation (ALWAYS EXECUTE)

**Phase:** Assembly & Handoff (runs after the PBP completes, or at any point during AI-POLC execution)
**Purpose:** Install the AI-POLC governance agent into the destination workspace so the `BLH__` backlog-health shortcut is available for post-PBP validation. This step is **automatic** — no user interaction required.

---

## What Gets Installed

| Artifact | Destination | Action |
|----------|-------------|--------|
| `backlog-health-agent.md` | `.kiro/agents/` | Copy from `templates/agents/` |
| Shortcut rules block | `.kiro/steering/workspace-rules.md` | Append `<!-- BEGIN AI-POLC AGENT SHORTCUTS -->` block (or replace if exists) |
| Agent registry entries | `.governance/AGENT_REGISTRY.md` | Create file if absent; append AI-POLC entries if exists |
| Agent guide section | `.governance/AGENT-GUIDE.md` | Create file if absent; append AI-POLC section if exists |

---

## Installation Logic

1. **Agent file:** Copy `templates/agents/backlog-health-agent.md` to `.kiro/agents/backlog-health-agent.md`. Populate `{version}` with current AI-POLC version and `{ISO-date}` with today's date.

2. **Shortcut block:** Check `.kiro/steering/workspace-rules.md` for `<!-- BEGIN AI-POLC AGENT SHORTCUTS -->` marker:
   - If found → replace the block (between BEGIN and END markers)
   - If not found → append the block from `templates/agents/shortcut-rules-block.md`

3. **Agent registry:** Check for `.governance/AGENT_REGISTRY.md`:
   - If absent → create with header + AI-POLC entry (POLC-AG-01)
   - If exists → append AI-POLC entry using next available `POLC-AG-{NN}` ID
   - Entry: `| POLC-AG-01 | backlog-health-agent | Process | BLH__ | 1 | AI-POLC | Active | {date} |`

4. **Agent guide:** Check for `.governance/AGENT-GUIDE.md`:
   - If absent → create with header + AI-POLC section from `templates/agents/agent-guide.md`
   - If exists → append AI-POLC section (between `<!-- BEGIN AI-POLC AGENT GUIDE SECTION -->` markers)

---

## Self-Sufficiency Rule (AGENT_GOVERNANCE_CONTRACT §5)

AI-POLC installs its own agent independently. No dependency on AI-GCE being present. If AI-GCE runs later, it will detect and preserve the AI-POLC entries via marker-based ownership.

---

## Post-Install Confirmation

```
🤖 AI-POLC Governance Agent Installed
   • Agent: backlog-health-agent (POLC-AG-01)
   • Shortcut: BLH__ (active immediately)
   • Call BLH__ before PBP handoff to validate backlog health.
```

---

*Detail file for AI-POLC Post-Workflow Agent Installation | Phase: Assembly & Handoff*

---

## Family upgrade agent (create-if-absent) — PDLC-UPG-01 / `UPG__`

In addition to this package quality agent, install the **family upgrade agent** — a family-level agent shared by all PDLC packages, installed once per workspace. Whichever PDLC package the user installs provides it; later packages detect it and skip.

1. **Install agent (if absent)** → if the platform agent slot has no `family-upgrade-agent.md`, copy `templates/agents/family-upgrade-agent.md` there. If it exists, skip.
2. **Register the `UPG__` shortcut (if absent)** → if `.kiro/steering/workspace-rules.md` has no `<!-- BEGIN PDLC UPGRADE SHORTCUT -->` marker, append `templates/agents/upgrade-shortcut-block.md`. If present, skip.
3. **Register in AGENT_REGISTRY.md (if absent)** → append the `PDLC-UPG-01` row — agent `family-upgrade-agent`, type **Migration**, trigger `UPG__`, producer PDLC (family-level), scope: all PDLC `pdlc-ws/` output. Do not duplicate if already present.
4. **Catalogue availability** → the upgrade agent reads `.aiflc/pdlc/MIGRATION_CATALOGUE.md` (installed as a family artifact). No per-package action needed beyond ensuring the family install placed it.

The upgrade agent is report-and-confirm and idempotent — see `family-upgrade-agent.md` and `MIGRATION_CATALOGUE.md`.
