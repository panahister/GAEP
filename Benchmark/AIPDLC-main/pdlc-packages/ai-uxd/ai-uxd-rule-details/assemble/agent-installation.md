<!-- Copyright (c) 2026 Mohammad Maheri. Licensed under Apache 2.0. See LICENSE. Attribution required - see NOTICE. -->
# Post-Workflow: Agent Installation (ALWAYS EXECUTE)

**Phase:** Assemble (runs after the UXP completes, or at any point during AI-UXD execution)
**Purpose:** Install the AI-UXD governance agent into the destination workspace so the `UXC__` UX-consistency shortcut is available for post-UXP validation. This step is **automatic** — no user interaction required.

---

## What Gets Installed

| Artifact | Destination | Action |
|----------|-------------|--------|
| `ux-consistency-agent.md` | `.kiro/agents/` | Copy from `templates/agents/` |
| Shortcut rules block | `.kiro/steering/workspace-rules.md` | Append `<!-- BEGIN AI-UXD AGENT SHORTCUTS -->` block (or replace if exists) |
| Agent registry entries | `.governance/AGENT_REGISTRY.md` | Create file if absent; append AI-UXD entries if exists |
| Agent guide section | `.governance/AGENT-GUIDE.md` | Create file if absent; append AI-UXD section if exists |

---

## Installation Logic

1. **Agent file:** Copy `templates/agents/ux-consistency-agent.md` to `.kiro/agents/ux-consistency-agent.md`. Populate `{version}` with the current AI-UXD version and `{ISO-date}` with today's date.

2. **Shortcut block:** Check `.kiro/steering/workspace-rules.md` for the `<!-- BEGIN AI-UXD AGENT SHORTCUTS -->` marker:
   - If found → replace the block (between BEGIN and END markers)
   - If not found → append the block from `templates/agents/shortcut-rules-block.md`

3. **Agent registry:** Check for `.governance/AGENT_REGISTRY.md`:
   - If absent → create with header + AI-UXD entry (UXD-AG-01)
   - If exists → append AI-UXD entry using the next available `UXD-AG-{NN}` ID
   - Entry: `| UXD-AG-01 | ux-consistency-agent | Process | UXC__ | 1 | AI-UXD | Active | {date} |`

4. **Agent guide:** Check for `.governance/AGENT-GUIDE.md`:
   - If absent → create with header + AI-UXD section (when to call, consequences, recovery — from `ux-consistency-agent.md`)
   - If exists → append AI-UXD section (between `<!-- BEGIN AI-UXD AGENT GUIDE SECTION -->` markers)

---

## Self-Sufficiency Rule (AGENT_GOVERNANCE_CONTRACT §5)

AI-UXD installs its own agent independently. No dependency on AI-GCE being present. If AI-GCE runs later, it will detect and preserve the AI-UXD entries via marker-based ownership.

---

## Post-Install Confirmation

```
🤖 AI-UXD Governance Agent Installed
   • Agent: ux-consistency-agent (UXD-AG-01)
   • Shortcut: UXC__ (active immediately)
   • Call UXC__ before UXP handoff (AI-POLC / AI-DWG / AI-GCE) to validate consistency, traceability, token alignment, and handoff consumability.
```

---

*Detail file for AI-UXD Post-Workflow Agent Installation | Phase: Assemble*

---

## Family upgrade agent (create-if-absent) — PDLC-UPG-01 / `UPG__`

In addition to this package's quality agent, install the **family upgrade agent** — a family-level agent shared by all PDLC packages, installed once per workspace. Whichever PDLC package the user installs provides it; later packages detect it and skip.

1. **Install agent (if absent)** → if the platform agent slot has no `family-upgrade-agent.md`, copy `templates/agents/family-upgrade-agent.md` there. If it exists, skip.
2. **Register the `UPG__` shortcut (if absent)** → if `.kiro/steering/workspace-rules.md` has no `<!-- BEGIN PDLC UPGRADE SHORTCUT -->` marker, append `templates/agents/upgrade-shortcut-block.md`. If present, skip.
3. **Register in AGENT_REGISTRY.md (if absent)** → append the `PDLC-UPG-01` row — agent `family-upgrade-agent`, type **Migration**, trigger `UPG__`, producer PDLC (family-level), scope: all PDLC `pdlc-ws/` output. Do not duplicate if already present.
4. **Catalogue availability** → the upgrade agent reads `.aiflc/pdlc/MIGRATION_CATALOGUE.md` (installed as a family artifact). No per-package action needed beyond ensuring the family install placed it.

The upgrade agent is report-and-confirm and idempotent — see `family-upgrade-agent.md` and `MIGRATION_CATALOGUE.md`.
