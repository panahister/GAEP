<!-- Copyright (c) 2026 Mohammad Maheri. Licensed under Apache 2.0. See LICENSE. Attribution required - see NOTICE. -->
# Post-Workflow: Agent Installation

## Execution: ALWAYS (automatic — first run only, no user interaction required)

After the AI-ILC workflow completes its first full run in a workspace, install the governance agent so the user can validate future idea briefs independently.

---

## Agent Artifacts to Install

| Artifact | Destination | Action |
|----------|-------------|--------|
| `idea-quality-agent.md` | `.kiro/agents/` | Copy from `templates/agents/` |
| Shortcut rules block | `.kiro/steering/workspace-rules.md` | Append `<!-- BEGIN AI-ILC AGENT SHORTCUTS -->` block (or replace if exists) |
| Agent registry entries | `.governance/AGENT_REGISTRY.md` | Create file if absent; append AI-ILC entries if exists |
| Agent guide section | `.governance/AGENT-GUIDE.md` | Create file if absent; append AI-ILC section if exists |

---

## Installation Logic

1. **Agent file:** Copy `templates/agents/idea-quality-agent.md` to `.kiro/agents/idea-quality-agent.md`. Populate `{version}` with current AI-ILC version and `{ISO-date}` with today's date.

2. **Shortcut block:** Check `.kiro/steering/workspace-rules.md` for `<!-- BEGIN AI-ILC AGENT SHORTCUTS -->` marker:
   - If found → replace the block (between BEGIN and END markers)
   - If not found → append the block from `templates/agents/shortcut-rules-block.md`

3. **Agent registry:** Check for `.governance/AGENT_REGISTRY.md`:
   - If absent → create with header + AI-ILC row: `| ILC-AG-01 | idea-quality-agent | Audit | IQC__ | 1 | AI-ILC | Active |`
   - If exists → append AI-ILC row (between `<!-- custom -->` markers if team rows exist)

4. **Agent guide:** Check for `.governance/AGENT-GUIDE.md`:
   - If absent → create with header + AI-ILC section from `templates/agents/agent-guide.md`
   - If exists → append AI-ILC section (between `<!-- BEGIN AI-ILC AGENT GUIDE SECTION -->` markers)

---

## When to Install

- **First run only.** If `.kiro/agents/idea-quality-agent.md` already exists, skip installation (agent already present from a prior run).
- **Re-derivation safe.** If the agent file exists but the version differs, update it (replace file, preserve any `<!-- custom -->` blocks if present).

---

## Self-Sufficiency Rule (AGENT_GOVERNANCE_CONTRACT §5)

AI-ILC installs its own agent independently. No dependency on AI-GCE being present. If AI-GCE runs later, it detects and preserves the AI-ILC entries via marker-based ownership.

---

## Post-Install Confirmation

```
🤖 AI-ILC Governance Agent Installed
   • Agent: idea-quality-agent (ILC-AG-01)
   • Shortcut: IQC__ (active immediately)
   • Call IQC__ to validate an idea brief's quality before handoff.
```

---

*Version: 1.0.0 | Part of AI-ILC — AI-Driven Idea Life Cycle*

---

## Family upgrade agent (create-if-absent) — PDLC-UPG-01 / `UPG__`

In addition to this package's quality agent, install the **family upgrade agent** — a family-level agent shared by all PDLC packages, installed once per workspace. Whichever PDLC package the user installs provides it; later packages detect it and skip.

1. **Install agent (if absent)** → if the platform agent slot has no `family-upgrade-agent.md`, copy `templates/agents/family-upgrade-agent.md` there. If it exists, skip.
2. **Register the `UPG__` shortcut (if absent)** → if `.kiro/steering/workspace-rules.md` has no `<!-- BEGIN PDLC UPGRADE SHORTCUT -->` marker, append `templates/agents/upgrade-shortcut-block.md`. If present, skip.
3. **Register in AGENT_REGISTRY.md (if absent)** → append the `PDLC-UPG-01` row — agent `family-upgrade-agent`, type **Migration**, trigger `UPG__`, producer PDLC (family-level), scope: all PDLC `pdlc-ws/` output. Do not duplicate if already present.
4. **Catalogue availability** → the upgrade agent reads `.aiflc/pdlc/MIGRATION_CATALOGUE.md` (installed as a family artifact). No per-package action needed beyond ensuring the family install placed it.

The upgrade agent is report-and-confirm and idempotent — see `family-upgrade-agent.md` and `MIGRATION_CATALOGUE.md`.
