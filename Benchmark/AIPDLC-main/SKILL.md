---
name: aipdlc
description: "AIFLC PDLC Family — 11 injectable workflow packages that guide AI coding agents through professional software delivery: idea evaluation → project initiation → portfolio governance → product ownership → UX design → architecture → workspace generation → compliance → test accountability."
version: 0.1.0-beta.1
author: Mohammad Maheri
license: Apache-2.0
tags:
  - sdlc
  - architecture
  - project-management
  - governance
  - testing
  - workflow
  - process
  - ai-coding-assistant
  - product-development
---

# AIPDLC — The AI-* PDLC Family

> Injectable workflow packages that give AI coding agents structured expertise for professional software delivery.

## What This Skill Provides

When installed, your AI agent gains access to **11 chained workflow packages** covering the full Product Development Life Cycle — from raw idea to production-ready workspace with governance and test accountability baked in.

Each package makes your agent behave like a senior domain expert: a PMO advisor for initiation, a CTO/architect for design, a DevOps engineer for workspace setup, a compliance officer for governance, a QA lead for test strategy. No plugins, no APIs — just markdown-based procedural knowledge your agent reads and executes.

## The Chain

```
╔══════════ PORTFOLIO LAYER · scope = MANY projects ══════════╗

   (optional)
    AI-ILC  ⇢  AI-PILC  ⇢  AI-PPM
    Decide it   Initiate it   Govern it (portfolio)

╚═══════════════════════╤═════════════════════════════════════╝
                         │
                      AI-FLO   Route it (package-to-package)
                         │
╔══════════ PROJECT LAYER · scope = ONE project ══════════════╗

    AI-POLC → AI-UXD → AI-ADLC → AI-DWG → AI-DLC v1 (build)
    Own it    Design UX  Design it  Prepare it

    AI-GCE + AI-TGE ── alongside (continuous quality) ──►
    Guard it  Test it

╚═════════════════════════════════════════════════════════════╝
```

## Packages at a Glance

| Package | What It Does | Expert Role |
|---------|-------------|-------------|
| **AI-ILC** | Raw idea → Approved Idea Brief | Product Manager |
| **AI-PILC** | Requirement → Project Initiation Package | PMO Advisor |
| **AI-PPM** | Multiple PIPs → Portfolio governance | Portfolio Manager |
| **AI-FLO** | Package-to-package routing | Orchestration Engine |
| **AI-POLC** | PIP → Product Backlog Package | Product Owner |
| **AI-UXD** | PIP + PBP → UX Design Package | UX Designer |
| **AI-ADLC** | Requirements → Architecture Package | CTO / Architect |
| **AI-DWG** | AP + PBP + UXP → Ready-to-code workspace | DevOps Engineer |
| **AI-GCE** | Workspace → Compliance enforcement | Governance Officer |
| **AI-TGE** | Workspace → Test strategy & coverage | QA Lead |

## How to Use

### Quick start (single package)

Tell your AI agent:

```
Using AI-PILC, help me initiate this project from my requirements.
```

```
Using AI-ADLC, design the architecture for this system.
```

```
Using AI-DWG, generate a development workspace from this architecture.
```

### Full chain

Start at AI-ILC or AI-PILC and let each package hand off to the next. Every stage has a human approval gate — the AI proposes, you decide.

### Standalone or chained

Each package works independently. You can install one, a few, or all eleven. When chained, each detects its predecessor's output and enriches its own work. When standalone, it handles missing predecessors gracefully.

## Key Principles

- **Human-in-the-loop** — approval gates at every stage
- **Injectable** — drop files into any workspace, no plugins
- **Professional quality** — output reads as if written by a senior domain expert
- **Platform-agnostic** — works with any AI assistant that reads workspace files
- **Chain-aware** — packages hand off via state markers, but each works alone too
- **Adaptive depth** — Minimal / Standard / Comprehensive tiers match project complexity

## Supported Platforms

Works with 6+ AI coding platforms:

- Kiro
- Amazon Q Developer
- Cursor
- Claude Code
- Cline
- GitHub Copilot (partial — workspace instructions only)
- Any AI assistant that reads workspace markdown files

## Installation

After installing this skill, clone the package set into a temporary nested folder, run the installer against your workspace root, then delete the source. This keeps your workspace root clean — the installer only leaves `.aiflc/pdlc/` (the package home) and `pdlc-ws/` (your outputs) behind.

```bash
# 1. Clone into a temporary folder — NOT your workspace root
git clone https://github.com/mbmd/AIPDLC.git .aiflc-src/AIPDLC

# 2. Install into your workspace root (add --platform / --bundle to skip prompts)
./.aiflc-src/AIPDLC/pdlc-packages/installer/install.sh --target .

# 3. Remove the source — nothing unnecessary is left in your root
rm -rf .aiflc-src
```

On Windows (PowerShell):

```powershell
git clone https://github.com/mbmd/AIPDLC.git .aiflc-src/AIPDLC
.\.aiflc-src\AIPDLC\pdlc-packages\installer\install.ps1 -TargetWorkspace .
Remove-Item -Recurse -Force .aiflc-src
```

The installer copies each package into `.aiflc/pdlc/` and creates `pdlc-ws/` for your outputs. For platform-specific detail, see each package's `setup/INSTALL.md`.

## Learn More

- **Repository:** https://github.com/mbmd/AIPDLC
- **Umbrella project:** https://github.com/mbmd/AIFLC
- **Author:** [Mohammad Maheri](https://www.linkedin.com/in/mohammad-maheri-8399565b)
- **License:** Apache 2.0 with Attribution Addendum

---

*Built on AIFLC by Mohammad Maheri — part of the AI Full Life Cycle project.*
