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

**Areas**

{{areas}}

**Commands**

- `make roadmap-sync` — recompute every derived status and table from the docs
- `make roadmap-check` — fail on a stale table, a bad dependency, or a missing
  path named in `project.yml`

Run the sync after ticking an acceptance criterion, changing a status, or adding
a doc. Only the engine writes tables; prose and checkboxes are written by hand.

<!-- msg-roadmap:end -->
