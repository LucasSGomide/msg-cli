# 09 — Ship the pre-roadmap skills in the scaffold

**Depends on:** — · **Status:** done · **Estimate:** 5

## Context

- `msg-roadmap-plan-item` hard-stops with "run `/msg-pre-roadmap` first"
  (`templates/skills/msg-roadmap-plan-item/SKILL.md:39`), but neither
  `msg-pre-roadmap` nor its `msg-brainstorm` dependency is in `SKILLS`
  (`src/core/templates.ts:38`). A scaffolded workspace reaches a gate with no
  skill able to pass it.
- Cause is drift: `templates/skills/` holds nine folders, `SKILLS` lists seven,
  and nothing fails when they disagree. The same drift already shipped a
  `project.yml` with no `requirementsFile`.
- Covers UN.1, UN.2 and UN.4 of `Pre-roadmap Skills in Init and Uninstall` in
  `docs/requirements.md`. UN.3 is item 10.

## Key Areas:

- **Naming** — no new command or flag; `--skills` gains a value, not a verb, so
  rule 1 is untouched.
- **Design** — report format unchanged; the two new skill files appear under the
  existing `created` verb, rule 1.

## Technical Details:

1. Add `msg-pre-roadmap` and `msg-brainstorm` to `SKILLS` in
   `src/core/templates.ts`, keeping pipeline order (pre-roadmap before
   plan-item, brainstorm next to grill-me).
2. Add `msg-brainstorm` to `PORTABLE_SKILLS` — it persists nothing and reads no
   project structure, the stated bar for that list.
3. Test: read `templates/skills/` with `readdirSync` and assert set equality
   against `SKILLS`; fail naming the folders on each side that the other lacks.
4. Test: assert every `PORTABLE_SKILLS` name appears in `SKILLS`.
5. Test: `init` writes both new SKILL.md paths, and a second run reports them
   `kept`.
6. Test: `parsePortableSkills('msg-brainstorm')` returns it rather than throwing,
   and the unknown-skill error message now enumerates three names.
7. Add the requirements step to `templates/project/claude-block.md` — name
   `docs/requirements.md` and the pre-roadmap-before-plan-item order.
8. Update `templates/skills/msg-setup/SKILL.md` if its "What `init` writes" list
   names skills individually — check first; it currently says
   `.claude/skills/ these skills`, which may need no change.
9. Mirror the two skills into this repo's own `.claude/skills/` only if they are
   not already there — they are, so expect a no-op.

### Technical References:

- `src/core/templates.ts:38` — `SKILLS`; `:54` — `PORTABLE_SKILLS`
- `src/core/description.ts:98` — the loop that turns `SKILLS` into scaffold
  entries, read by both `init` and `uninstall`
- `src/core/scaffold.ts:25` — `applyEntries`, the never-overwrite rule
- `templates/project/claude-block.md` — the appended block
- `docs/requirements.md` — UN.1, UN.2, UN.4

## Blockers:

- ~~Uninstall needs no code change, but it is worth confirming: it builds its
  plan from the same `describeScaffold` (`src/commands/uninstall.ts:36`
  → `buildPlan`), so the two skills become removable for free. If a test proves
  otherwise, that discovery belongs in this item.~~ Confirmed during
  implementation: the assumption held, and `uninstall` needed no code change.
  Pinned by three tests in `test/integration/uninstall.test.ts` — both skills are
  planned `remove`, a full uninstall leaves no `.claude/skills` behind, and a
  hand-edited `msg-brainstorm` is reported `kept — yours, remove by hand`.
- Both audits in step 8 and step 9 came back as the predicted no-ops:
  `templates/skills/msg-setup/SKILL.md` enumerates no skills individually, and
  this repo's own `.claude/skills/` already held both folders.
- Not done, deliberately: this repo's own `CLAUDE.md` msg-roadmap block was not
  regenerated to match the updated `templates/project/claude-block.md`. No test
  enforces it, so the repo's own docs now lag its templates — worth a follow-up.
- Existing workspaces get the skill files back on re-init but still lack
  `requirementsFile`, so `msg-pre-roadmap` refuses to run
  (`templates/skills/msg-pre-roadmap/SKILL.md:12`). Item 10 closes that; until
  it lands this item only fixes new workspaces.
