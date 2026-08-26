---
name: msg-wireframes
description: Draw ASCII wireframes for a roadmap item's UI-touching task slices, each paired with the design rules that apply. Use when a task slice's Scope is front-end or full-stack during task breakdown, or when asked to wireframe a screen.
---

# Wireframe a roadmap item's screens

A UI-touching task slice gets prose only today, so whoever implements it
guesses at layout. This skill closes that gap: it draws the slice's screens as
ASCII art and cites the exact `docs/design.md` rules each one has to follow,
so the wireframe and the rule sit next to each other instead of in two
documents nobody cross-checks.

This skill never decides UX. It draws what `msg-roadmap-task-breakdown` already
wrote in a task's `## User experience` section — if that section is thin, the
wireframe will be too, and that is a task-breakdown problem, not this skill's
to fix.

Invocation: `/msg-wireframes <item>` for one item's pending slices, or invoked
automatically by `msg-roadmap-task-breakdown` right after it writes a task
whose `Scope` is `front-end` or `full-stack`. Bare, ask which item and slice.

## Locate context

Read `project.yml` for the tasks folder and the `design` area's rule doc.

- **No `project.yml`, or the item's `docs/tasks/<item>/` folder doesn't
  exist yet** — this isn't a msg-cli planning workspace, or the item hasn't
  been broken down. Do not fail. Write to (or update) `wireframes.md` at the
  repo root instead of `docs/tasks/<item>/wireframes.md`, using `docs/design.md`
  at the repo root as the rule doc if it exists, and say once that this is the
  standalone fallback.
- **Otherwise** write to `docs/tasks/<item>/wireframes.md` and read the rule
  doc `project.yml`'s `design` area names.

## Flow

1. **Read the task slice(s).** From `msg-roadmap-task-breakdown`: the task
   file(s) just written for this item with `Scope: front-end` or
   `full-stack`. Invoked standalone: ask which task number(s), or which
   screen if there's no task file at all (fallback mode).
2. **Read the slice's `## User experience` section** — `**Entry**`,
   `**Flow**`, `**States**`, `**Pattern**` bullets. This is the entire input;
   never add a screen, a state, or a flow step the slice doesn't already list.
3. **Read the design rule doc**, only the rules the screen actually
   exercises — colour, layout, focus order, empty/error/loading states,
   whatever applies. Skim by heading; don't read the whole file for a
   one-screen slice.
4. **Draw one ASCII wireframe per distinct layout** the slice's `**States**`
   bullets call for. Merge minor variants of the same layout (e.g. "loading"
   and "filled" that differ only in row count) into one block with a note
   instead of two near-identical boxes.
5. **Write or update the file.** One `## MM — Task slice title` section per
   task slice, holding its wireframe(s) and a **Design rules** list right
   under each one. A section already in the file for a slice this pass
   doesn't touch stays untouched; a section for a slice this pass does cover
   is replaced whole. Never remove a sibling slice's section.

## Format

One file per roadmap item, one section per task slice, added or updated as
breakdown proceeds:

````markdown
# NN — Roadmap item title — Wireframes

## MM — Task slice title

**Screen:** Character list — empty state

```
+------------------------------------------+
| Characters                     [ + New ]  |
+------------------------------------------+
|                                            |
|        No characters yet.                 |
|        [ Create your first character ]    |
|                                            |
+------------------------------------------+
```

**Design rules**

- Rule 4 — text uses step 11/12, never step 9/10
- Rule 6 — body text clears 7:1

**Screen:** Character list — filled

```
+------------------------------------------+
| Characters                     [ + New ]  |
+------------------------------------------+
| Kaelen the Bold              [Edit][Del]  |
| Mira Duskwalker              [Edit][Del]  |
+------------------------------------------+
```

**Design rules**

- Rule 24 — row actions stay in the trailing column, never a hover-only reveal
````

Fallback mode (no `docs/tasks/`) uses the same section shape without the
roadmap-item title line.

## Rules

- ASCII only — `+ - |` box drawing, fixed-width, bracketed labels like
  `[ Button ]` for controls. No colour, no icons, nothing a monospace block
  can't render.
- Every wireframe carries a **Design rules** list right under it. A wireframe
  with no cited rule is decoration, not spec — cut it or find the rule.
- Cite a rule by number (`Rule 4`) and a one-line paraphrase of what it
  requires — not the whole rule text, not just the number.
- Never invent a screen, state, or flow step the task's User experience
  section doesn't already have. If the section is missing entirely, say so
  and stop rather than guessing a layout.
- One file per roadmap item. Never a separate file per task slice.
