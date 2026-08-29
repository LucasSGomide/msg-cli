---
name: msg-roadmap-task-review
description: Audit an existing task breakdown against its roadmap item and fix the gaps in place. Use after a breakdown is written, when the user says "review the breakdown", "find gaps in the plan", "did we miss anything", or before starting work on a task folder.
---

# Review a task breakdown

`/msg-roadmap-task-breakdown` writes the plan. This skill checks whether that plan
actually covers the roadmap item, and **applies the fixes itself**. It is not a
planning conversation — it reads, decides, edits, and reports.

**Read `project.yml` first** for the folders and the area vocabulary.

Invocation: `/msg-roadmap-task-review 04` — the roadmap item number, or the task
folder name. Bare invocation with exactly one task folder present reviews that
one; with several, ask which.

---

## What is read

1. The roadmap doc, in full.
2. Every numbered task file in the folder.
3. The folder's `openapi.json`, when it has one.
4. The rule docs named by `project.yml` for the areas the tasks cite — and the
   Design doc whenever any task is `front-end` or `full-stack`.

Do not preload rule docs for areas no task touches.

## The write barrier

A task file with **any** `- [x]` is read-only. Work has started against those
criteria; rewriting them invalidates finished work.

- Tasks with zero ticked boxes: edit freely.
- Tasks with any ticked box: report the gap under **Not applied**, never edit.
- New tasks: append at the next free number. Never renumber, never reuse a
  number, never delete a task file.

Ticked checkboxes are sacred — no path through this skill removes or rewrites one.

---

## Gap classes

Exactly four. Slicing shape and dependency ordering are **out of scope** — do not
flag a task for being layer-sliced, mis-sized, or wrongly ordered, and do not
rewrite an existing `Depends on`.

### 1. Fidelity to the roadmap

The parent is not read again at implementation time, so anything dropped in the
breakdown is lost.

- Walk every parent **Technical Details** step. Each must appear in at least one
  task's Technical details, verbatim or narrowed to that slice. A step in no task
  is a gap, and steps landing out of order across tasks is a gap too — the parent
  decided that order for a reason.
- Walk every parent **Key Areas** bullet. Each names a rule doc some task must
  obey; an area no task carries in its Scope is a gap.
- Same for **Technical References** — each must be cited by the task it bears on.
- A bullet reworded into something weaker or ambiguous is a gap; restore the
  parent's wording.
- A task whose Technical details add or change an **API endpoint** and whose
  endpoint has no matching path in the folder's `openapi.json` is a gap — the
  request and response shapes were left to be re-derived at implementation time,
  once by the implementer and again by the caller. Fill it with
  `/msg-api-contracts`.
- A task that adds a **new route** — a path + method the application does not
  serve yet — and has no `## Sequence diagrams` section is a gap: the request
  path was left to be re-derived. Fill it with `/msg-sequence-diagrams`.
- A task that only **changes** an existing route's contract and yet carries a
  `## Sequence diagrams` section is a gap the other way — the flow did not move,
  so the diagram redraws what the codebase already answers. Remove it; the
  contract in `openapi.json` is what that slice needs. Same for a task carrying
  a diagram for an endpoint it does not touch at all.
- A slice that only touches migrations, seeders, mappers, config or an internal
  refactor needs neither a diagram nor a contract.
- A diagram with no **Architecture rules** list under it is a gap — restore the
  rule numbers from the `back-end` area's doc.

### 2. User experience coverage

Only when the parent has a `## User Experience:` section.

- Every parent UX bullet must appear in at least one `front-end` or `full-stack`
  task's `## User experience`. A bullet in no task is a screen detail that will
  not get built.
- A `front-end` or `full-stack` task with **no** `## User experience` section is a
  gap. Narrow the parent's bullets into it.
- A `**Pattern**` bullet that lost its citation on the way down is a gap — restore
  the design-doc rule number or `file:line`.
- A `back-end` task carrying a UX section is a gap the other way. Remove it.
- A `front-end` or `full-stack` task with **no** `## Wireframes` section is a
  gap. Fill it with `/msg-wireframes` from that task's UX bullets. A `back-end`
  task carrying a `## Wireframes` section is a gap the other way — remove it.
- A wireframe with no **Design rules** list under it is a gap — restore the rule
  numbers from the Design doc.

If the parent has a `**Front-end**` bullet but **no** UX section at all, that is
the breakdown skill's backfill step having been skipped. Say so and stop — writing
one here would be planning a screen the user never saw a question about.

### 3. Criteria quality

Criteria are the deliverable and the TDD red phase.

- Every criterion carries a level: `(unit)` · `(integration)` · `(e2e)` ·
  `(manual)`. Missing level is a gap — infer the right one from what it asserts.
- `(manual)` on anything testable is a gap. Rewrite it at the level that can prove
  it. `(manual)` is legitimate only where the container or harness genuinely
  cannot reach — say why in one line beside it.
- A criterion that is not a single observable behavior is a gap.
- 3–10 criteria per task. Under 3 usually means behaviors are missing — add them.
  **Over 10 means the slice is really two tasks: stop and ask**, since splitting
  is out of scope here.
- Every **States** bullet in a task's UX section needs a criterion proving it.
- Whatever the project's rule docs make non-negotiable for the areas a slice
  touches must be asserted by a criterion.

### 4. Missing slices

Something the roadmap item commits to that no task covers.

- Derive it only from the parent doc — never from what would be "nice to have".
- Prefer folding the orphan into an existing untouched task. Write a new task file
  only when it cannot fit one without breaking the criteria cap or the
  vertical-slice rule.
- **Stop and ask** before writing a new task file if it would push the folder over
  8 tasks.

---

## After applying

1. Run `/msg-roadmap-sync` — new tasks and new criteria change the counts, and it
   is the only thing that writes those tables.
2. Do not touch roadmap statuses yourself. Review changes no checkbox, so no
   status moves.

## Report

One table, newest gap class first. No prose walkthrough, no restating what the
tasks now say.

```
Reviewed 04-capture-ingestion — 6 tasks, 7 gaps applied, 1 not applied.

  fidelity   03  "fx events keyed by effect id" was dropped from the parent
  ux         05  front-end task had no User experience section
  ux         06  front-end task had no Wireframes section
  fidelity   04  new route POST /captures had no Sequence diagrams section
  fidelity   04  POST /captures had no path in openapi.json
  fidelity   02  PATCH /captures only reshapes an existing route — diagram removed
  criteria   05  two criteria had no test level → (e2e)
  missing    07  new task: capture deletion — parent commits to it, no task covered it

  not applied  02  gotcha not asserted — task has ticked boxes, fix by hand
```

Each line is `class · task · what the gap was`. The "why it happened" is the gap
itself — do not add a paragraph explaining it.

If nothing is found, say so in one line.

## Rules

- Apply first, report after. Never present findings for approval.
- Only stop to ask when a rule above says so: criteria over cap, folder over 8
  tasks, a missing parent UX section, or a bare invocation with several folders.
- Never edit a task file that has a ticked box — that includes adding a missing
  `## Wireframes` or `## Sequence diagrams` section, and the `openapi.json`
  reference line. A barred slice's paths are not written into `openapi.json`
  either, since nothing in the task file would point at them. Report it under
  **Not applied**.
- Never renumber, delete, or merge a task.
- Never invent scope the roadmap item does not commit to.
