<!-- Canonical behavior: Lessons Capture. Copied into each family as common/lessons-capture.md and referenced by every package core. Part of the shared Management Framework contract (§9). Keep in sync via the governance sync tooling — do not hand-edit family copies. -->

# Common Behavior — Lessons Capture (`LRN__` + Session-End)

This behavior populates the governance spine's `Lessons_Learned.md` register (see the family-root `MANAGEMENT_FRAMEWORK_CONTRACT.md`). It is available in every package of the family.

## When to capture

1. **On demand — `LRN__`.** When the user types `LRN__` (optionally followed by the lesson text) anywhere in a prompt, capture a lesson immediately.
2. **Session-end offer.** At a natural session close or after a significant gate, offer once: *"Capture any lessons from this session into the governance spine? (LRN__)"* — do not nag; ask at most once per session unless the user asks again.

## How to capture

1. **Resolve the active scope + spine** (per contract §2.1 / §3): find `management_framework/MANAGEMENT_FRAMEWORK.md` for the current scope (R1 → `{family}-ws/management_framework/`; R2/R3 → `{family}-ws/entities/{entityId}/management_framework/`; PDLC → the active project's spine). If no spine exists, create it (contract §4, create-if-absent).
2. **Draft the entry** with the user (or from the stated lesson): `Lesson`, `Context`, `Recommended Action`. Keep it concise and actionable.
3. **Assign the ID** `{PKG}-{SCOPE}-L-{N}` by scanning `Lessons_Learned.md` for the highest existing `{PKG}-{SCOPE}-L-*` and incrementing (contract §8).
4. **Append** the row to `Lessons_Learned.md` (create the file + register the package in the index's Contributing Packages table if this is the package's first contribution). Append-only — never edit another package's rows.
5. **Confirm** what was written (ID + one-line summary). Report-and-confirm: on `LRN__` with explicit text, write directly; on the session-end offer, write only on user assent.

## Register row

```markdown
| ID | Contributor | Date | Lesson | Context | Recommended Action | Status |
|----|-------------|------|--------|---------|--------------------|--------|
| {PKG}-{SCOPE}-L-{N} | {PKG} | {ISO-8601} | | | | Open |
```

> `{PKG}` = this package's code (e.g. `BAG`, `DGV`, `SAG`, `SPR`, `PILC`). `{SCOPE}` = the scope handle (project `{ABBREV}` or `{entityId}`). Timestamp via a shell command, never the hosted time tool (core rule X4).

## Boundaries

- This is destination-workspace runtime capture into the user's project governance spine — **not** the AIFLC build workspace's internal `LESSONS.md`.
- Lessons Learned is always **ADOPT** (no family has a native equivalent). It is the reserved input corpus for a future per-family decision engine (contract §9, deferred).
