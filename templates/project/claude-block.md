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

**Branch-first for implementation work**

Create a dedicated session branch — GitButler (`but branch new` / `but commit -b`)
if it's set up in the repo, else plain git (`git checkout -b`) — **before the
first code edit** of an implementation. Code means application source, libraries,
tests, and build/manifest/config files: `src/`, `lib/`, `app/`, `test/`,
`tests/`, `*.config.*`, `package.json` and lockfiles, `Makefile`.

Neither tool is mandatory; either satisfies the rule. A `PreToolUse` hook (see
`.claude/settings.json`) enforces it — a Write/Edit touching code without a
session branch already created is blocked. Documentation and planning edits
(prompt files, roadmap docs, task breakdowns) don't need a branch first; create
one only when you specifically want to.

**Acceptance before landing**

Accepting a task is two acts, done together as the last step of implementing it:

1. **Tick every box** beneath the task's `## Acceptance criteria` heading, once a
   passing automated test backs each one. The engine derives item status from
   those boxes.
2. **Write the task's own section into `docs/tasks/<item>/test-script.md`** — a
   hand-run runbook, one file per roadmap item beside `README.md` and
   `openapi.json`, that proves the feature works end to end. It never replaces
   the `(unit)` / `(integration)` / `(e2e)` criteria; it sits beside them.

`test-script.md` shape: a `## Setup` and a `## Teardown` section written by the
first task to reach acceptance, then one `## MM — Task title` section appended by
each later task. Every line is a checkbox holding one concrete action and the
observable result it must produce — a command and its output, data to seed, a
request with its status and body, or a click path and what appears. "Verify the
endpoint works" is not a step. A box is ticked only after the step has actually
been run; reuse a Setup step already written rather than restating it.

Ticked checkboxes are sacred, in the criteria and in `test-script.md` alike.
Append your own section and, if you need one, a shared `## Setup` step; never
rewrite, reorder, untick, or delete another task's section.

A `PreToolUse` hook gates the ship moment: `but land`, a `git merge`, or a
`git push` aimed at the target branch is blocked while any task folder under
`docs/tasks/*/` that holds a numbered task file still has an unticked box beneath
a `## Acceptance criteria` heading, is missing `test-script.md`, or has an
unticked step anywhere in that file. Tick the boxes and run `make roadmap-sync`
before landing. Routine `but commit` / `git commit` are never blocked.

<!-- msg-roadmap:end -->
