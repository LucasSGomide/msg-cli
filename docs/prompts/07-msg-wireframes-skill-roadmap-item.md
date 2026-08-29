# Goal: Build the `msg-wireframes` skill and ship it through the CLI scaffolding

**Status:** executed on 2026-08-26 — deliverable changed from "add a roadmap item" to building the skill directly, since msg-cli no longer self-hosts a roadmap/requirements structure. Built the skill, wired it into `msg-roadmap-task-breakdown`, and added it to `SKILLS`.
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

This prompt originally scoped its deliverable to a roadmap item added via
`msg-roadmap-plan-item`, leaving the skill's build for a later task breakdown.
That structure no longer exists for msg-cli's own work, so the deliverable is
the skill build itself, direct: the constraints below already fully specify it.

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
   file per slice. **Superseded by prompt 12** (2026-08-29): the wireframe now
   lives in the task file's own `## Wireframes` section, and the per-item
   `wireframes.md` is written only in the standalone fallback.
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
9. `msg uninstall` must remove the skill from a project that scaffolded it.
   No bespoke removal code is needed for this: `describeScaffold` already
   loops every entry in `SKILLS` unconditionally, so adding
   `msg-wireframes` there is sufficient — verified by
   `test/integration/init.test.ts`'s full scaffolded-tree assertion and by
   running `uninstall --dry-run` against a scaffolded project.
10. More generally: if wiring this skill (or any future one) ever requires
    writing into a scaffolded project's `.claude/settings.json` or
    `.claude/hooks/`, that write must be described as a `ScaffoldEntry` the
    same way skills and docs are, so `uninstall` removes it through the same
    generic mechanism rather than a special-cased removal path. As built,
    `msg-wireframes` needs neither — it is invoked the same way
    `msg-grill-me` is, by another skill's own instructions — so there is
    nothing there yet for uninstall to track. Building that machinery now,
    with no concrete write to drive its shape, was left undone rather than
    added speculatively.

## Output

The skill itself: `templates/skills/msg-wireframes/SKILL.md`, added to
`SKILLS` in `src/core/templates.ts`, and a new step in
`msg-roadmap-task-breakdown`'s `SKILL.md` invoking it for every task slice
whose `Scope` is `front-end` or `full-stack`.
