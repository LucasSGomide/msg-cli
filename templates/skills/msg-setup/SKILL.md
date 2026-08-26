---
name: msg-setup
description: Scaffold or extend the planning structure the msg-roadmap skills need — project.yml, the roadmap/tasks/explorations/ditched folders, one rule doc per area, and the sync engine. Use when adding an area to an existing project, when `make roadmap-check` reports a missing manifest path, or when the user says "set up the roadmap", "scaffold the docs" or "add an area".
---

# Set up a project for the msg-roadmap skills

The msg-roadmap skills read **`project.yml` and nothing else** about where things
live. The `msg` CLI writes that file and everything it points at.

**This skill cannot bootstrap a project it is not installed in.** The CLI is what
puts these skills on disk, so first-time setup is a shell command the user runs:

```
npx @lucas-gomide/msg-cli init
```

What this skill is for is everything after that: adding an area, explaining what
the manifest means, and diagnosing a failing check.

## What `init` writes

```
project.yml                        the manifest every msg-roadmap skill reads
docs/roadmap/README.md             seeded with the four section headings
docs/tasks/README.md
docs/explorations/README.md
docs/ditched/README.md
docs/<area>.md                     one rule doc per area
docs/requirements.md               append-only log of user needs and functional requirements
scripts/roadmap-sync.mjs           the engine, vendored
Makefile                           roadmap-sync and roadmap-check targets
CLAUDE.md                          a delimited msg-roadmap block
.claude/hooks/branch-guard-*.sh    blocks planning-file edits until this session has a branch
.claude/settings.json              the two hooks above, merged into whatever the project already has
.claude/skills/                    these skills
```

Every write is skipped when the target exists, so re-running fills only gaps and
a file the project already owns is reported as kept.

## Flow

1. **Work out the shape** if the user has not said: `api`, `web`, `both`, or
   `docs-only`. The CLI detects it from the repo layout and offers that as the
   default, so usually there is nothing to ask. One question, with a
   recommendation. Do not ask anything else.
2. **Ask whether to seed the rule docs.** Seeded docs carry an opinionated
   default standard; empty stubs are the honest starting point for a project
   whose rules have not been decided. Default to empty.
3. **Run the command:**

   ```
   npx @lucas-gomide/msg-cli init --shape api --no-seed
   ```

4. **Report what it created**, one line each. If the docs are empty, say the
   first rule gets written the first time a decision repeats — not now.

Never write the rule docs' contents yourself. An invented rule nobody agreed to
is worse than an empty file, because the next reader cannot tell which is which.

## project.yml

```yaml
msg_version: 1.0.0

structure:
  roadmap: docs/roadmap/
  tasks: docs/tasks/
  explorations: docs/explorations/
  ditched: docs/ditched/

areas:
  Back-end: docs/architecture-api.md
  Front-end: docs/architecture-web.md
  API stack: docs/stack-api.md
  Web stack: docs/stack-web.md
  Auth: docs/auth.md
  Design: docs/design.md
  Naming: docs/naming.md

requirementsFile: docs/requirements.md
```

- **`areas`** is the load-bearing block. The key is the **bold prefix** a roadmap
  item's Key Areas section must use (`**Front-end** — …`); the value is the doc
  holding that area's rules. Adding an area here adds it to the planning
  vocabulary and points every bullet using it at something a reader can open.
- **`structure`** exists because folders have no rules to hold — they are
  locations, not conventions.
- **`requirementsFile`** points at a single append-only log of user needs and
  functional requirements — not a rule doc, so it is a sibling top-level key
  rather than an `areas` entry.
- **`msg_version`** records which CLI scaffolded the project. `msg check` prints
  it and `msg uninstall` refuses to run when it does not match the CLI in hand —
  removal compares files against the templates that wrote them, and only that
  version's templates are the right ones to compare with.

`Front-end` in `areas` is what makes an item's **User Experience** section
mandatory. Remove the key and the requirement goes with it.

The sync command is fixed at `make roadmap-sync`, not configurable. The engine is
vendored per project, so there is nothing for a manifest entry to vary.

## Adding an area later

```
npx @lucas-gomide/msg-cli add-area api-stack
```

It appends one line under `areas:` — textually, so the manifest's comments
survive — and writes the rule doc. The skills pick it up on the next run; there
is nothing to register. Pass `--seed` to fill the doc with the default standard
instead of a stub.

## Validation

`make roadmap-check` fails when a path in `project.yml` points at nothing, as
well as on a stale table or a dependency that does not add up. One gate, one
command. Put it in whatever check the project already runs — this is the drift
that actually happens: a folder moves and the manifest does not.

`npx @lucas-gomide/msg-cli check` reports the same manifest paths on their own,
which is the more readable output when that is the part that broke.

## Rules

- Never invent rule-doc content. Empty is honest.
- Seeded docs are a **copy, not a link**. The project owns them outright from the
  moment they land; nothing reconciles them with the CLI later. Edit them freely.
- Never overwrite an existing file. If something is wrong, say what and let the
  user fix it.
- Never renumber or move existing docs. Numbers are permanent IDs.
- The engine is vendored, not symlinked — a project owns its copy so an upstream
  update cannot silently change how its tables render.
