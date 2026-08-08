---
name: msg-roadmap-sync
description: Recompute every derived status and table under the docs tree — task checkboxes into roadmap statuses, roadmap statuses into Ready/Blocked/Parked/Done ordering — and retire finished breakdowns. Use after finishing a task, after ticking acceptance criteria, after adding or parking a roadmap item, when the roadmap check fails, or when the user asks what to pick up next.
---

# Sync the roadmap

The roadmap README is the source of truth for what to pick up next. It is only
true if it was regenerated after the last change — so this skill runs after any
change under the docs tree.

**`scripts/roadmap-sync.mjs` does the computing. Do not do it by hand.** Counting
checkboxes, deriving statuses, sorting sections and rewriting five kinds of table
are deterministic. Your job is the three things the script deliberately refuses to
do: tick a checkbox, write `## As built`, and update the hand-written prose.

**Read `project.yml` first** — it names the folders. No `project.yml` means stop
and tell the user to run `npx @lucas-gomide/msg-cli init`.

```
make roadmap-sync     # write
make roadmap-check    # verify freshness — put it in whatever gate the project runs
```

Those two targets are what `msg init` writes, and they are not configurable —
the engine is vendored per project, so there is nothing for a manifest entry to
vary. `roadmap-check` also fails on a path in `project.yml` that points at
nothing, which is why there is no separate project-check target.

## What the script derives

| From                                    | To                                                             |
| --------------------------------------- | -------------------------------------------------------------- |
| `- [x]` counts in each task file        | each task's status                                             |
| all tasks' statuses                     | the roadmap doc's `**Status:**` — written back into the header |
| `**Depends on:**` + every item's status | Ready · Blocked · Parked · Done                                |
| every doc's metadata header             | all five tables                                                |

Ready means every dependency is `done`. Blocked is derived on every run and never
stored — an item moves out of Blocked the moment its last dependency ships, with
no edit to that item's doc.

A `parked` item keeps its status even with a breakdown open; parking is a
decision, not a count.

## Flow

1. **Run `make roadmap-sync`.** Read its output — every line is `status`, `wrote`,
   `problem` or `retire`.
2. **Handle each `problem` line.** They are real inconsistencies, not noise:
   - _depends on NN, which does not exist_ — a typo or a retired number. Fix the
     header.
   - _done, but NN is not_ — either the dependency shipped and nobody synced, or
     the item was marked done early. Ask.
   - _done, but the task folder still exists_ — retire it, see below.
   - _estimate is not a number_ / _no metadata header_ — fix the doc.
3. **Retire every breakdown the script lists under `retire`.**
4. **Re-run** until it reports no problems.
5. **Refresh the prose above the roadmap table** — see below. This is the part
   only you can do.
6. **Report** — what flipped, what became Ready, what was retired. Short.

Never hand-edit a generated table. If a table looks wrong, the doc header it came
from is wrong.

## Ticking checkboxes is not this skill's job

Acceptance criteria are ticked by whoever did the work, as part of doing it. They
know what they proved; a counting script does not. This skill runs **after** that
and only reads what is already ticked.

If asked to sync and criteria are visibly satisfied but unticked, say so and stop.
Do not tick them on someone else's behalf.

## Retiring a finished breakdown

A task folder is scaffolding for work in flight. Once the item is `done` it is a
second, staler copy of what the code already says — so it goes, and the part worth
keeping moves onto the roadmap doc.

1. Read the task files. Add or extend `## As built` on the roadmap doc, **above
   `## Blockers:`** when one exists. Bullets only.
2. Delete the task folder, using whatever version-control command the project
   uses. The skills do not assume one.
3. Re-run the sync — the tables and the "Items … are `done`" line fix themselves.

**`## As built` is what the breakdown learned that the plan did not** — a decision
that came out differently, a constraint nobody saw, a test that had to be shaped a
certain way. Not a summary, not a list of files. If a bullet would still be true
had the work never happened, cut it. An item that taught nothing gets one line
saying so.

A front-end item's `## User Experience:` section is **kept, not deleted**, and
corrected if the screen shipped differently from the plan. It is the only record
of why the screen behaves the way it does once the task folder is gone.

Never retire a breakdown whose item is not `done`. Ticked checkboxes are sacred,
and so is an open folder.

## The prose above the table

The paragraphs above `## Ready` are hand-written and the script never touches
them. They carry what the table cannot: **why** the next item is next. The table
sorts by estimate, and estimate is not priority.

Update them when the sync changed something they describe:

- An item flipped to `done` — replace its "is next" paragraph with one line on
  what it unblocked, or delete it if it said nothing more.
- An item became Ready — say what makes it startable now, if it is not obvious.
- **Next up:** must name an item that is actually in **Ready**. If it names a
  `done` item, it is stale.

Cut ruthlessly. Every line here is read on every visit. A paragraph about work
that shipped two items ago is noise — the roadmap doc's `## As built` is where
that lives.

## Rules

- The script is the only thing that writes a table. You write prose and
  `## As built`.
- Never tick, untick, or edit an acceptance criterion.
- Never renumber anything. Numbers are permanent IDs in every folder.
- The check failing is drift, never a reason to edit the expected output.
