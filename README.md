# msg-cli

Scaffold an AI-assisted planning and development workflow into any project: the
Claude skills that drive it, the standards docs it reads, and the sync engine that
keeps every derived table honest.

```sh
npx @lucas-gomide/msg-cli init
```

## What it installs

| Path                                                               | What it is                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `.claude/skills/`                                                  | The `msg-*` planning skills                                                 |
| `project.yml`                                                      | The manifest every skill reads — folders and the area→doc map               |
| `docs/roadmap/` `docs/tasks/` `docs/explorations/` `docs/ditched/` | The planning tree                                                           |
| `docs/prompts/`                                                    | Structured prompts written by `msg-write-prompt`, not engine-managed        |
| `docs/<area>.md`                                                   | One rule doc per area, empty by default or seeded with opinionated defaults |
| `scripts/roadmap-sync.mjs`                                         | The sync engine, vendored — the project owns its copy                       |
| `Makefile`                                                         | `roadmap-sync` and `roadmap-check` targets                                  |

Nothing you write is ever overwritten. Re-running `init` fills only the gaps,
and reports as `kept (yours)` anything it left alone.

The one exception is `.claude/skills/msg-*`, which msg owns. Those track the
installed CLI: `init` replaces them when they have drifted (reported as
`updated (ours)`), and `uninstall` removes them whether or not they were edited.
That is what makes upgrading work — the skills call each other by name, so a
project holding one generation of them and another of the CLI runs a pipeline
with missing steps. To add a skill of your own, give it its own name; anything
not called `msg-*` is yours and is never touched.

## Commands

```sh
msg init [--shape api|web|both|docs-only] [--areas a,b] [--auth|--no-auth] [--seed|--no-seed] [--root .] [-y]
msg check [--root .]
msg add-area <slug> [--seed] [--root .]
```

`init` detects the project shape from its layout and offers that as the default.
Run it with `--shape` or `--areas` to skip the prompts entirely.

Not every project has something to sign in to, so **auth is a question, not a
given**: `init` asks whether the project needs it (for any shape but
`docs-only`), and answering no leaves out the `auth` area entirely — no sessions,
guards or sign-in in the seeded docs. `--no-auth` answers it up front; the
default is to include it. Add it later with `msg add-area auth`.

## The workflow

1. `/msg-roadmap-plan-item` grills an idea into a numbered roadmap item, an
   exploration, or a ditched record.
2. `/msg-roadmap-task-breakdown` slices a committed item into implementable tasks
   whose acceptance criteria double as its tests.
3. `/msg-roadmap-task-review` audits the breakdown against its parent item.
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
