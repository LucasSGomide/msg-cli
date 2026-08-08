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
| `.claude/skills/`                                                  | The `msg-*` planning skills plus `grill-me`                                 |
| `project.yml`                                                      | The manifest every skill reads — folders and the area→doc map               |
| `docs/roadmap/` `docs/tasks/` `docs/explorations/` `docs/ditched/` | The planning tree                                                           |
| `docs/<area>.md`                                                   | One rule doc per area, empty by default or seeded with opinionated defaults |
| `scripts/roadmap-sync.mjs`                                         | The sync engine, vendored — the project owns its copy                       |
| `Makefile`                                                         | `roadmap-sync` and `roadmap-check` targets                                  |

Nothing is ever overwritten. Re-running `init` fills only the gaps.

## Commands

```sh
msg init [--shape api|web|both|docs-only] [--areas a,b] [--seed|--no-seed] [--root .] [-y]
msg check [--root .]
msg add-area <slug> [--seed] [--root .]
```

`init` detects the project shape from its layout and offers that as the default.
Run it with `--shape` or `--areas` to skip the prompts entirely.

## The workflow

1. `/msg-roadmap-plan-item` grills an idea into a numbered roadmap item, an
   exploration, or a ditched record.
2. `/msg-roadmap-task-breakdown` slices a committed item into implementable tasks
   whose acceptance criteria double as its tests.
3. `/msg-roadmap-task-review` audits the breakdown against its parent item.
4. `make roadmap-sync` recomputes every derived status and table from the docs.

The engine is the only thing that writes tables; humans and skills write prose and
tick checkboxes. That split is what keeps the derived state real.

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
