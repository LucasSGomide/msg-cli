# Goal: Add a roadmap item for a new `msg-wireframes` skill

**Status:** not executed — msg-cli stopped self-hosting its roadmap/requirements structure (2026-08-26; that framework now only applies to projects scaffolded by `msg init`), so this prompt's original deliverable (a roadmap item added via `msg-roadmap-plan-item`) no longer applies as written. Revisit before running.
**Rating:** —

## Context

Task breakdown today has no visual spec: a UI-touching task slice gets prose
only, so whoever implements it guesses at layout, and `docs/design.md`'s rules
sit disconnected from any concrete screen. `msg-wireframes` closes that gap —
a new skill, sibling to the `msg-roadmap-*` family, that
`msg-roadmap-task-breakdown` calls automatically whenever a roadmap item
touches the front end. It writes ASCII wireframes for the item's screens into
`docs/tasks/<item>/wireframes.md`, with the relevant `docs/design.md` rules
quoted next to each one.

This prompt's deliverable is the roadmap item itself, added via
`msg-roadmap-plan-item` — not the skill. The skill's actual build is a later
task breakdown of that item.

## Constraints

1. New skill name: `msg-wireframes`, sibling to the `msg-roadmap-*` skills,
   with its own `SKILL.md`.
2. Trigger: `msg-roadmap-task-breakdown` invokes it automatically, only for
   roadmap items that touch the front end / UI — mirrors the existing "User
   experience grill... only when the item touches front end" scoping already
   in `msg-roadmap-plan-item`. This means `msg-roadmap-task-breakdown`'s own
   `SKILL.md` needs a new step, not just a new sibling skill dropped in
   unconnected.
3. Output file: `docs/tasks/<item>/wireframes.md`, one file per roadmap item
   covering every task slice. Each UI-touching task slice gets its own
   section inside it, added or updated as breakdown proceeds — not a separate
   file per slice.
4. Wireframes are ASCII art.
5. Ships to every project scaffolded by `msg init` — added to `SKILLS` in
   `src/core/templates.ts` and to `templates/skills/` — but is **not** added
   to `PORTABLE_SKILLS`: like its sibling `msg-roadmap-task-breakdown`, its
   normal path depends on `docs/tasks/` existing.
6. Fallback: when invoked in a repo with no `project.yml` / `docs/tasks/`
   structure (msg-cli's planning setup hasn't been run there), it writes a
   standalone `wireframes.md` at the repo root instead of failing.
7. For each screen, quote or summarize the specific `docs/design.md` rules
   that apply, placed next to its wireframe — not just a list of deviations.
8. `test/unit/skills.test.ts` already asserts `SKILLS` against the folders
   under `templates/skills/`; the new skill's folder must keep that
   assertion passing.

## Output

A new roadmap item in `docs/roadmap/`, created via `msg-roadmap-plan-item`
and grilled the normal way for that skill — dependencies, estimate, Key
Areas, User Experience. This prompt only fixes the scope; it doesn't
pre-write the roadmap doc's shape.
