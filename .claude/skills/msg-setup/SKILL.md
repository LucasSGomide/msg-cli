---
name: msg-setup
description: Scaffold the planning structure the msg-roadmap skills need — project.yml, the roadmap/tasks/explorations/ditched folders, one empty rule doc per area, and the sync engine. Use when installing the msg-roadmap skills into a project for the first time, when `project-check` fails, or when the user says "set up the roadmap", "scaffold the docs" or adds a new area.
---

# Set up a project for the msg-roadmap skills

The msg-roadmap skills read **`project.yml` and nothing else** about where things
live. This skill writes that file and everything it points at.

Run it once per project. Re-run it after adding an area — every write is skipped
when the target exists, so a second run fills only the gap.

## What it writes

```
project.yml                     the manifest every msg-roadmap skill reads
docs/roadmap/README.md          seeded with the four section headings
docs/tasks/README.md
docs/explorations/README.md
docs/ditched/README.md
docs/<area>.md                  one empty rule doc per area
scripts/roadmap_sync.py         the engine, vendored from msg-roadmap-sync
Makefile                        roadmap-sync, roadmap-check, project-check targets
```

## Flow

1. **Ask which areas the project has**, unless the user already said. The default
   is all of them; a docs-only project usually wants `design` and `naming` alone.
   One question, with a recommendation. Do not ask anything else.
2. **Ask the VCS** only if it is not obvious. `gitbutler` when the repo's
   `CLAUDE.md` says to use `but`, otherwise `git`.
3. **Run the script:**

   ```
   python3 .claude/skills/msg-setup/scripts/setup.py --areas design,naming --vcs gitbutler
   ```

4. **Report what it created**, one line each. Then say the rule docs are empty and
   that the first rule gets written the first time a decision repeats — not now.

Never write the rule docs' contents during setup. An invented rule nobody agreed
to is worse than an empty file, because the next reader cannot tell which is
which.

## project.yml

```yaml
vcs: git

structure:
  roadmap: docs/roadmap/
  tasks: docs/tasks/
  explorations: docs/explorations/
  ditched: docs/ditched/

commands:
  sync: make roadmap-sync
  check: make roadmap-check

skills:
  plan: /msg-roadmap-plan-item
  breakdown: /msg-roadmap-task-breakdown
  review: /msg-roadmap-task-review
  sync: /msg-roadmap-sync

areas:
  Back-end: docs/architecture-api.md
  Front-end: docs/architecture-web.md
  Design: docs/design.md
  Naming: docs/naming.md
```

Three blocks and a key, each with a different job:

- **`areas`** is the load-bearing one. The key is the **bullet prefix** roadmap
  items must use (`**Front-end** — …`); the value is the doc holding that area's
  rules. Adding an area here adds it to the template's vocabulary, and points
  every bullet using it at something a reader can open.
- **`structure`** and **`commands`** exist because folders and make targets have
  no rules to hold — they are locations, not conventions.
- **`vcs`** tells the skills which version-control commands are legal here.

`Front-end` in `areas` is what makes an item's **User Experience** section
mandatory. Remove the key and the requirement goes with it.

## Adding an area later

Add the key to `project.yml`, re-run the script, and the rule doc appears empty.
The skills pick it up on the next run — there is nothing to register.

## Validation

`make project-check` fails when a path in `project.yml` points at nothing. Put it
in whatever gate the project already runs. This is the drift that actually
happens: a folder moves and the manifest does not.

## Rules

- Never invent rule-doc content. Empty is honest.
- Never overwrite an existing file. If something is wrong, say what and let the
  user fix it.
- Never renumber or move existing docs. Numbers are permanent IDs.
- The engine is vendored, not symlinked — a project owns its copy so a skill
  update cannot silently change how its tables render.
