# VS Code Founder Edition 0.2.0 — Phase 1 Checkpoint

Status: PASS

Captured: 2026-07-23T08:53:17Z (`2026-07-23T12:23:17+03:30`)

## Purpose

This record freezes the reproducible starting point for the remaining VS Code Founder Edition 0.2.0 completion work. It is implementation evidence only. It does not designate the GAEP specification candidate as approved and does not authorize public distribution, deployment, or marketplace publication.

## Repository checkpoint

- Branch: `codex/gaep-founder-edition`
- Commit: `b7e9539f7221710f514869b64e80b3e3f4be834a`
- Commit subject: `fix: correct type assertion for ToolDefinition and refine workspace scope handling`
- Git tree: `7d29744f961bde1403eb92097818559beb82b22b`
- Upstream: `origin/codex/gaep-founder-edition`
- Ahead/behind at capture: `0/0`
- Worktree before evidence creation: clean
- `git diff --check HEAD`: PASS

## Toolchain and installed baseline

- macOS architecture used by VS Code: `arm64`
- Node.js: `v24.13.1`
- npm: `11.8.0`
- TypeScript: `6.0.3`
- Vitest: `4.1.10`
- VS Code: `1.129.1` (`8a7abeba6e03ea3af87bfbce9a1b7e48fed567b8`)
- Installed GAEP extension: `gaep.gaep-vscode@0.1.0`
- Codex CLI: `0.135.0`
- Claude Code: `2.1.153`
- Root and workspace package versions: `0.1.0`
- `npm ls --depth=0`: PASS with workspace dependencies resolved
- `package-lock.json` SHA-256: `76c70aa2b848cbc9db6d3b61d68768c0e44b51ef4467ce1d291f0eb5f9cdef3c`

## Founder foundation gate

Command: `npm run check:founder`

Result: PASS

- TypeScript project-reference compilation: PASS
- Vitest files: 36 passed
- Tests: 309 passed, 1 skipped, 310 total
- Expected skip: the root-only foreign-UID managed-stage-registry test cannot run as the non-root local user
- Candidate documentation structural validation: PASS
- Candidate documents: 83
- Requirement definitions: 868
- Active Core contracts: 8
- Active Core requirements: 160
- Documentation warnings: 0
- VS Code production bundle build: PASS
- Extension-host activation: PASS
- Contributed command registration: PASS
- Four native GAEP views: PASS
- Product Studio open: PASS
- Explicit multi-root non-mutation scenario: PASS

The extension-host harness disables workspace trust through its Electron launch configuration. Untrusted-host interaction remains a separate verification item; this limitation is not represented as tested here.

## Phase 1 conclusion

The repository, dependency graph, local tools, installed extension baseline, documentation structure, unit/integration suite, and current extension-host baseline are suitable for beginning managed VS Code host integration. No Phase 2 implementation is included in this checkpoint.
