# msg-cli

Scaffold an AI-assisted planning and development workflow into any project: the
Claude Code or Codex skills that drive it, the standards docs they read, and the
sync engine that keeps every derived table honest.

```sh
npx @lucas-gomide/msg-cli init --harness codex
```

## What it installs

| Path                                                               | What it is                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `.claude/skills/` and/or `.agents/skills/`                         | The `msg-*` planning skills                                                 |
| `CLAUDE.md` and/or `AGENTS.md`                                     | The marked planning-workflow instructions                                   |
| `.claude/hooks/` and/or `.codex/hooks/`                            | Branch, acceptance, and retirement guards                                   |
| `.claude/settings.json` and/or `.codex/hooks.json`                 | Structurally merged lifecycle hook configuration                            |
| `project.yml`                                                      | The manifest every skill reads — folders and the area→doc map               |
| `docs/roadmap/` `docs/tasks/` `docs/explorations/` `docs/ditched/` | The planning tree                                                           |
| `docs/prompts/`                                                    | Structured prompts written by `msg-write-prompt`, not engine-managed        |
| `docs/<area>.md`                                                   | One rule doc per area, empty by default or seeded with opinionated defaults |
| `scripts/roadmap-sync.mjs`                                         | The sync engine, vendored — the project owns its copy                       |
| `Makefile`                                                         | `roadmap-sync` and `roadmap-check` targets                                  |

Nothing you write is ever overwritten. Re-running `init` fills only the gaps,
and reports as `kept (yours)` anything it left alone.

The one exception is the selected harnesses' `msg-*` skill paths, which msg
owns. Those track the installed CLI: `init` replaces them when they have drifted (reported as
`updated (ours)`), and `uninstall` removes them whether or not they were edited.
That is what makes upgrading work — the skills call each other by name, so a
project holding one generation of them and another of the CLI runs a pipeline
with missing steps. To add a skill of your own, give it its own name; anything
not called `msg-*` is yours and is never touched.

## Commands

```sh
msg init [--harness claude|codex|claude,codex] [--shape api|web|both|docs-only|skills-only] [--areas a,b] [--auth|--no-auth] [--seed|--no-seed] [--gitignore docs,skills,hooks,makefile|all] [--no-gitignore] [--root .] [-y]
msg check [--root .]
msg add-area <slug> [--seed] [--root .]
msg uninstall [--harness claude|codex|claude,codex] [--dry-run] [--root .] [-y]
```

For a new interactive install, `init` offers Claude Code and Codex as a
checklist, with both selected. `--harness` accepts one or both as a
comma-separated list; non-interactive runs and `-y` default to Claude for
compatibility. A full scaffold records the selected harnesses in `project.yml`,
and later init/uninstall runs use it automatically. Manifests created before the
field existed are treated as Claude projects and are not silently rewritten.

Re-running init can add another harness without replacing the existing one. To
remove a harness, use uninstall and select it from the checklist.

Codex loads repository hooks only from a trusted project layer and asks you to
review new or changed hooks. Use `/hooks` in Codex after init to inspect and
trust the four installed guards.

`init` detects the project shape from its layout and offers that as the default.
Run it with `--shape` or `--areas` to answer the project-shape question directly.

Not every project has something to sign in to, so **auth is a question, not a
given**: `init` asks whether the project needs it (for any shape but
`docs-only`), and answering no leaves out the `auth` area entirely — no sessions,
guards or sign-in in the seeded docs. `--no-auth` answers it up front; the
default is to include it. Add it later with `msg add-area auth`.

### Ignoring the generated paths

Inside a git repository, `init` also offers to add what it just wrote to
`.gitignore` — a checklist of four groups (`docs`, `skills`, `hooks`,
`makefile`), nothing checked by default, so checking nothing ignores nothing.
`--shape skills-only` only ever offers the skills it installed, all or
nothing. `--gitignore docs,skills` (or `--gitignore all`) answers it without a
prompt; `--no-gitignore` skips the step entirely.

Everything msg adds lives inside one marker block appended to the end of the
file — the same mechanism the Makefile and project-instructions block use — so
re-running `init` with different picks rewrites the block rather than piling
lines up, and a block you've edited by hand is left alone completely.
`uninstall` asks about it separately from the rest of the scaffold, since you
may want to keep the ignores, or drop them, independently of everything else.

Full-scaffold uninstall reads harnesses from `project.yml`; if more than one is
installed it offers a checklist with both selected by default. A skills-only
install has no manifest, so uninstall infers harnesses from installed `msg-*`
skills and offers the same checklist when both are present.

## The workflow

Claude invokes skills as `/msg-*`; Codex invokes them as `$msg-*`. For example:

1. `/msg-roadmap-plan-item` (Claude) or `$msg-roadmap-plan-item` (Codex) grills
   an idea into a numbered roadmap item, an exploration, or a ditched record.
2. `/msg-roadmap-task-breakdown` or `$msg-roadmap-task-breakdown` slices a
   committed item into implementable tasks whose acceptance criteria double as
   its tests.
3. `/msg-roadmap-task-review` or `$msg-roadmap-task-review` audits the breakdown
   against its parent item.
4. `make roadmap-sync` recomputes every derived status and table from the docs.

The engine is the only thing that writes tables; humans and skills write prose and
tick checkboxes. That split is what keeps the derived state real.

Rule docs start empty by default. A rule gets written the first time a decision
repeats — not up front. Pass `--seed` to start from an opinionated default
standard instead; those docs are a copy the project then owns outright, with
nothing reconciling them upstream later.

## If your project uses a formatter

The engine writes the tables under `docs/` and then checks them for drift. A
formatter rewrapping one is indistinguishable from a stale table, so
`make roadmap-check` fails. Exclude the four planning folders:

```
docs/roadmap/
docs/tasks/
docs/explorations/
docs/ditched/
```

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

The payload lives in `templates/` and ships byte-identical — it is never bundled
or formatted. `templates/scripts/roadmap-sync.mjs` is hand-written with zero
non-builtin imports, enforced by a test.

## License

MIT
