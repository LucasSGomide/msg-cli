# Goal: Offer a `.gitignore` step in `msg init`, and a clean-up on `uninstall`

**Status:** not executed
**Rating:** —

## Context
`msg init` writes skills, docs, a manifest, hook scripts and the sync engine
into the project. All of it lands in the git tree, and every user then has to
decide by hand what to commit and what to ignore. Add a step to `init` that
asks the question for them and, if they say yes, writes the chosen paths into
`.gitignore` — and a matching clean-up offer on `uninstall`.

The step runs on both init paths. The normal scaffold offers four groups as a
checklist; the `--shape skills-only` path offers only the skills, all or
nothing, because that is all it installed.

## Constraints
1. msg may only ever add, rewrite or remove **its own** lines in `.gitignore`.
   They live inside one marker block appended to the end of the file, reusing
   the existing `# --- msg-roadmap:start` / `# --- msg-roadmap:end` mechanism
   in `src/core/blocks.ts`. If the user edited inside the markers, msg leaves
   the whole file alone and reports it as `kept (yours)`.
2. The normal scaffold offers a multi-select checklist of four groups, nothing
   checked by default — checking nothing means ignore nothing:
   - **docs** — all of `docs/`, plus `project.yml` and
     `scripts/roadmap-sync.mjs`
   - **skills** — `.claude/skills/msg-*`
   - **hooks** — the four msg hook scripts under `.claude/hooks/`, written out
     one path per line (`branch-guard-pre.sh`, `branch-guard-post.sh`,
     `acceptance-criteria-gate.sh`, `retire-breakdown-post.sh`) so hooks the
     user added stay tracked
   - **Makefile** — always offered, no warning
3. `CLAUDE.md` and `.claude/settings.json` are never ignored: msg only appends
   to them and git cannot ignore part of a file.
4. On `--shape skills-only` the only thing offered is the installed skills,
   all or nothing — never a per-skill pick.
5. `--gitignore <groups>` drives the step without a terminal, comma-separated
   in the same shape as `--areas`: `--gitignore docs,skills`, or
   `--gitignore all`. `--no-gitignore` skips it. On the skills-only path the
   only accepted values are `skills` and `all`. With neither flag and no
   terminal to ask on, `.gitignore` is left untouched.
6. No `.gitignore` yet → msg creates one holding just its block. The step is
   skipped entirely when the project is not a git repository.
7. Re-running `init` rewrites the block to match the new picks: a group no
   longer chosen loses its lines, a newly chosen one gains them.
8. `uninstall` asks about the `.gitignore` block in its **own** confirmation,
   after the main one. The block is listed in the printed plan like any other
   entry (`strip .gitignore`), `--dry-run` prints it, and `-y` answers both
   questions yes. If msg created the file and nothing but the block is left,
   the file goes too. A block the user edited inside is never offered — it is
   reported `kept (yours)`.

## Output
TypeScript changes in the msg-cli codebase — likely a new `.gitignore`
description/entry alongside `src/core/description.ts` and `src/core/blocks.ts`,
the group definitions and their path lists, a checklist prompt plus a
skills-only confirm in `src/prompts.ts`, the new branch in
`src/commands/init.ts` (both paths), the extra question and plan entry in
`src/commands/uninstall.ts` and `src/core/plan.ts`, and the `--gitignore` /
`--no-gitignore` flags in `src/cli.ts` and `src/usage.ts` — plus tests covering
the groups, the re-run rewrite, the edited-block case, the non-TTY flag path,
and the uninstall clean-up. Update `README.md` where it documents the `init`
flags and what gets installed.
