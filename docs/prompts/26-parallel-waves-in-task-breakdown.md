# Goal: Teach the task-breakdown skill to plan tasks in parallel-safe waves

**Status:** not executed
**Rating:** —

## Context

Implementation currently runs one task at a time. A roadmap item is sliced into
task files, and each is picked up in order, even when three of them have nothing
to do with each other. The lost velocity is the whole problem: with spare token
budget there is no reason those three can't be handed to three sub agents at
once.

The information needed to spot them is almost there already. Every task header
carries `**Depends on:**` with sibling task numbers, so the ordering is a graph:
tasks with no dependencies run first, tasks that depend only on those run next,
and so on. Group the graph into levels and each level is a set of tasks that can
run at the same time — a **wave**. Wave 1 is every task with no dependencies;
a task's wave is one higher than the highest wave among the tasks it depends on.
Nothing needs to be computed by the engine or stored in a new field. The number
falls out of `Depends on`.

Two things are missing. First, `Depends on` currently means *logical* ordering —
"04 needs the table 03 creates". It says nothing about two slices that are
logically independent but edit the same file, which is exactly what breaks when
two agents run at once. GitButler doesn't rescue this: every applied branch
shares one working tree, so parallel agents write the same files on disk and
GitButler only sorts the result into branches afterwards. So `Depends on` has to
start meaning "cannot run at the same time", covering collisions as well as
ordering. Second, the wave plan is never stated anywhere a person or an agent
can read it.

The fix is entirely inside `templates/skills/msg-roadmap-task-breakdown/SKILL.md`:
a slicing rule that turns file collisions into dependency edges, a wave grouping
in the approval table the skill already stops at, a wave paragraph in the folder
README it already writes, and a rule for handing `test-script.md` sections back
to the session that spawned the wave instead of having sub agents append to one
shared file concurrently.

## Constraints

1. **No new field in the task file header.** The wave is derived from
   `Depends on` and never written down. One copy of the fact means nothing can
   drift out of agreement with anything else.
2. **No engine change, no CLI command, no new skill.** `roadmap-sync.mjs` is
   untouched; the folder README table keeps exactly the columns it has. The
   deliverable is edits to
   `templates/skills/msg-roadmap-task-breakdown/SKILL.md`.
3. **Wave = 1 + the highest wave among a task's dependencies.** A task with
   `Depends on: —` is wave 1.
4. **Add a slicing rule: two slices that would edit the same file must not share
   a wave.** Express that by putting one in the other's `Depends on`, pushing it
   to the next wave. After this change `Depends on` means "cannot run at the same
   time" — logical ordering and file collisions both.
5. **Group the step 6 approval table by wave**, naming which tasks are parallel
   and which run alone. This is the only place a wrong dependency map is ever
   caught: no automated check can find one, because a wave computed from bad
   edges is consistent with those bad edges. The user is approving the parallel
   plan, not just the slice list.
6. **Step 7's folder README prose gains a `**Waves.**` paragraph** stating the
   grouping in plain words. That prose is hand-written and sync never rewrites
   it, so it survives every later sync.
7. **Sub agents do not write `test-script.md`.** Each returns its
   `## MM — Task title` section with its boxes already ticked, since it ran the
   steps; the session that spawned the wave appends the sections in task-number
   order and reuses a `## Setup` step already written rather than restating it.
   A parallel agent cannot see its siblings' Setup steps, so only the spawning
   session can dedupe them. Keep the existing rule that a box is ticked only
   after the step has actually been run — the spawning session transcribes, it
   never authors a tick.
8. **Nothing spawns automatically.** The skill plans; the user decides when to
   run a wave in parallel and says so at execution time. Do not add a spawn
   command, a prompt to spawn, or a token-budget heuristic.
9. **New breakdowns only.** No migration command, no back-fill rule for task
   folders that already exist. They keep working — their `Depends on` edges are
   just not collision-checked.
10. **Leave the rest of the skill alone**: the caps table, the numbering rules,
    the readiness tests, and every rule about ticked checkboxes being sacred.
11. `test/unit/skills.test.ts` asserts on this skill's section headings. Keep
    the existing headings or update that test.

## Tone

Match the skill's existing voice: short sentences, imperative, rules stated as
rules rather than explained. No hedging and no new jargon. An agent reads this
file in the middle of a task, so every line added has to earn its place.

## Examples

The wave grouping in the step 6 approval table:

```
Proposed breakdown of roadmap 01 (5 tasks):

  wave 1 — run alone
    01  api package scaffold + config     back-end  deps: —

  wave 2 — 3 tasks, parallel
    02  postgres compose + drizzle-kit    back-end  deps: 01
    03  reference tables (11)             back-end  deps: 01
    04  monster mapper + DAO              back-end  deps: 01

  wave 3 — run alone
    05  capture endpoint                  back-end  deps: 02, 03, 04

Approve, or tell me what to merge / split / reorder.
```

The wave paragraph in the folder README written at step 7:

```markdown
# 01 — Capture API

Sliced back-to-front: scaffolding first, then the three
independent data slices, then the endpoint that uses them.

**Waves.** 01 runs alone. 02, 03 and 04 depend only on 01
and touch no shared files — safe to run in parallel. 05
needs all three and runs alone.

| #   | Task | Scope | Depends on | Criteria | Status |
| --- | ---- | ----- | ---------- | -------- | ------ |
```
