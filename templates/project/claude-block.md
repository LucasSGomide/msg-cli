<!-- msg-roadmap:start -->

## Planning workflow

`project.yml` at the repo root is the manifest: it names the planning folders and
maps each area to the doc holding that area's rules. Read it before planning work.

| Folder | What lives there |
| --- | --- |
| `docs/roadmap/` | Committed work, one numbered doc per item |
| `docs/tasks/` | An open item's breakdown, one file per shippable slice |
| `docs/explorations/` | Ideas being researched, each ending in `## Findings` |
| `docs/ditched/` | Rejected ideas, kept so they are not re-proposed |

Numbers are permanent IDs. Nothing is ever renumbered or reused.

**Requirements come first**

`docs/requirements.md` is the append-only log of user needs and functional
requirements, and a roadmap item has to trace back to one. Run
`/msg-pre-roadmap` to record them there **before** `/msg-roadmap-plan-item`
opens the item — plan-item stops on an idea with nothing recorded behind it.

**Areas**

{{areas}}

**Commands**

- `make roadmap-sync` — recompute every derived status and table from the docs
- `make roadmap-check` — fail on a stale table, a bad dependency, or a missing
  path named in `project.yml`

Run the sync after ticking an acceptance criterion, changing a status, or adding
a doc. Only the engine writes tables; prose and checkboxes are written by hand.

**Branch-first for planning work**

Create a dedicated session branch — GitButler (`but branch new` / `but commit -b`)
if it's set up in the repo, else plain git (`git checkout -b`) — **before**
touching any file, whenever the work is:

1. Executing a `docs/prompts/*.md` prompt file.
2. Working on a roadmap item (`docs/roadmap/`, `docs/tasks/`).
3. Creating a new roadmap item.

Neither tool is mandatory; either satisfies the rule. This is enforced by a
`PreToolUse` hook (see `.claude/settings.json`), not just this doc — an
Edit/Write touching those paths without a session branch already created is
blocked. Plain local edits outside these three cases don't require a branch
first.

<!-- msg-roadmap:end -->
