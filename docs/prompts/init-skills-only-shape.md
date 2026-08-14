# Goal: Add a "Skills only" shape to `msg init` for cherry-picking portable skills

## Context
`msg init` currently asks "What shape is this project?" with four options —
API, Web, Both, Docs only — then scaffolds `project.yml`, the `docs/`
folders, the `CLAUDE.md` block, and all 7 skills from `templates/skills/`
(`src/core/description.ts`, `src/core/templates.ts`).

Add a fifth shape, "Skills only", for a project that just wants a subset of
the msg-skills without any of the roadmap scaffold. Picking it skips the
rest of the normal flow — no areas, no auth prompt, no seed prompt, no
`project.yml`, no `docs/` folders, no `CLAUDE.md` edits — and instead prompts
the user to multi-select from the *portable* skills: the subset that doesn't
depend on the msg-cli project structure (`project.yml`, `docs/roadmap`,
`docs/tasks`, etc.). Of the current 7 skills, only `msg-grill-me` and
`msg-write-prompt` qualify — `msg-setup` and the `msg-roadmap-*` family all
read or write that structure and stay excluded.

No uninstall support is needed for this path; the user can delete a skill's
folder under `.claude/skills/` manually.

## Constraints
1. "Skills only" is a new value on the existing shape prompt/flag
   (`--shape skills-only`), not a separate subcommand.
2. Choosing it bypasses areas, auth, seed, `project.yml`, the `docs/`
   folders, and the `CLAUDE.md` block entirely — only the picked skills'
   `SKILL.md` files get written, to `.claude/skills/<name>/SKILL.md`.
3. Eligible skills are declared via a new hardcoded `PORTABLE_SKILLS` array
   in `src/core/templates.ts`, next to the existing `SKILLS` array — not
   SKILL.md frontmatter, not a separate template folder.
4. Add a `--skills` flag (comma-separated names, same shape as the existing
   `--areas` flag) so the skill list can be given non-interactively, for
   scripting or non-TTY use.
5. No uninstall support for the skills-only path.

## Output
TypeScript changes in the msg-cli codebase — likely `src/core/templates.ts`
(new `PORTABLE_SKILLS`), `src/core/shapes.ts` (new shape value),
`src/prompts.ts` (multi-select prompt), `src/commands/init.ts` (branch that
skips the normal scaffold), and `src/cli.ts` (new `--skills` flag) — plus
tests covering the new flow.
