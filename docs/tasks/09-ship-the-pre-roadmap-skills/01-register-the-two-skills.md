# 01 — Register the two skills and guard the drift

**Roadmap:** [09](../../roadmap/09-ship-the-pre-roadmap-skills.md) · **Scope:** back-end · **Depends on:** —

## Context

- `msg-roadmap-plan-item` hard-stops with "run `/msg-pre-roadmap` first", but
  neither `msg-pre-roadmap` nor its `msg-brainstorm` dependency is in `SKILLS`.
  A scaffolded workspace therefore reaches a gate with no skill able to pass it.
- The cause is drift, not a typo: `templates/skills/` holds nine folders, `SKILLS`
  lists seven, and nothing fails when they disagree. The same class of drift
  already shipped a `project.yml` with no `requirementsFile`.
- The set-equality test ships in this slice rather than a later one — adding the
  two names without it fixes today's gap and leaves the next one just as
  invisible.
- `uninstall` is expected to need no code change: it builds its plan from the
  same `describeScaffold`, so the two skills should become removable for free.
  That is an assumption worth a test, not a given — if a test proves otherwise,
  that discovery belongs in this task.
- Covers UN.1, UN.2 and UN.4 of `Pre-roadmap Skills in Init and Uninstall`.

## Technical details

- **Naming** — no new command or flag; `--skills` gains a value, not a verb, so
  rule 1 is untouched.
- **Design** — report format unchanged; the two new skill files appear under the
  existing `created` verb, rule 1.
- Add `msg-pre-roadmap` and `msg-brainstorm` to `SKILLS` in
  `src/core/templates.ts`, keeping pipeline order — pre-roadmap before
  plan-item, brainstorm next to grill-me.
- Add `msg-brainstorm` to `PORTABLE_SKILLS`: it persists nothing and reads no
  project structure, which is the stated bar for that list.
- Read `templates/skills/` with `readdirSync` and assert set equality against
  `SKILLS`, failing with the folders each side lacks rather than a bare count.

## Acceptance criteria

- [x] `(unit)` `SKILLS` and the folder names under `templates/skills/` are set-equal
- [x] `(unit)` the set-equality failure message names the folders missing from each side
- [x] `(unit)` every `PORTABLE_SKILLS` name appears in `SKILLS`
- [x] `(integration)` `init` writes the `msg-pre-roadmap` and `msg-brainstorm` SKILL.md paths
- [x] `(integration)` a second `init` run reports both as `kept`
- [x] `(unit)` `parsePortableSkills('msg-brainstorm')` returns it rather than throwing
- [x] `(unit)` the unknown-skill error message enumerates three portable names
- [x] `(integration)` `uninstall` removes both new skills without a change to its own code

## References

- `src/core/templates.ts:38` — `SKILLS`; `:54` — `PORTABLE_SKILLS`
- `src/core/description.ts:98` — the loop that turns `SKILLS` into scaffold
  entries, read by both `init` and `uninstall`
- `src/core/scaffold.ts:25` — `applyEntries`, the never-overwrite rule
- `src/commands/uninstall.ts:36` — `describeScaffold` → `buildPlan`
- `docs/naming.md` — rule 1
- `docs/design.md` — rule 1
- `docs/requirements.md` — UN.1, UN.2, UN.4

## Implement with

`/backend-standards`
