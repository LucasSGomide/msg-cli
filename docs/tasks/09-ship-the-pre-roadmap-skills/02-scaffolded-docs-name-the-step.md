# 02 — Scaffolded docs name the requirements step

**Roadmap:** [09](../../roadmap/09-ship-the-pre-roadmap-skills.md) · **Scope:** back-end · **Depends on:** 01

## Context

- Task 01 puts the two skills in the scaffold. This slice makes the scaffolded
  workspace's own documentation say they exist and in what order they run —
  without it an agent has the skills but no written reason to run
  `msg-pre-roadmap` before `msg-roadmap-plan-item`.
- Docs-only, so it lands separately from the code change and stays revertable on
  its own.
- Two of its three steps are audits that may correctly turn out to be no-ops.
  `templates/skills/msg-setup/SKILL.md` currently says `.claude/skills/ these
  skills` rather than naming them individually, and this repo's own
  `.claude/skills/` already holds both folders. Confirm rather than assume, and
  record a no-op as a no-op instead of inventing a change.
- Existing workspaces get the skill files back on re-init but still lack
  `requirementsFile`, so `msg-pre-roadmap` refuses to run. Roadmap item 10 closes
  that; until it lands this item only fixes new workspaces.

## Technical details

- **Design** — report format unchanged; no new verb, rule 1.
- **Naming** — no new command or flag, rule 1 untouched.
- Add the requirements step to `templates/project/claude-block.md`: name
  `docs/requirements.md` and state the pre-roadmap-before-plan-item order.
- Check whether `templates/skills/msg-setup/SKILL.md`'s "What `init` writes" list
  names skills individually; update it only if it does.
- Mirror the two skills into this repo's own `.claude/skills/` only if absent —
  expect a no-op.

## Acceptance criteria

- [ ] `(unit)` the rendered CLAUDE.md block names `docs/requirements.md`
- [ ] `(unit)` the rendered CLAUDE.md block states that pre-roadmap runs before plan-item
- [ ] `(integration)` `init` appends the block containing the requirements step to a fresh workspace
- [ ] `(manual)` `templates/skills/msg-setup/SKILL.md` is confirmed not to enumerate skills individually, or is updated to include the two new ones
- [ ] `(unit)` this repo's own `.claude/skills/` contains both `msg-pre-roadmap` and `msg-brainstorm`

## References

- `templates/project/claude-block.md` — the appended block
- `src/core/description.ts:98` — where the block is added as an `appended` entry
- `templates/skills/msg-setup/SKILL.md` — the "What `init` writes" list to audit
- `docs/design.md` — rule 1
- `docs/naming.md` — rule 1
- `docs/requirements.md` — UN.1, UN.2, UN.4

## Implement with

`/backend-standards`
