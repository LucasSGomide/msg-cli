---
name: msg-roadmap-task-breakdown
description: Break a roadmap item into implementable task files under the tasks folder. Use when the user is about to start a roadmap item, says "break this down", "split into tasks", or asks how to slice an item into commits.
---

# Break a roadmap item into tasks

A roadmap item is a commitment. A task is a **shippable vertical slice** — the
smallest change that leaves the repo green and coherent, sized so one agent
session finishes it without compaction. One task, one commit.

The task file is the whole brief. An agent implementing it should never need to
open the roadmap doc.

**Read `project.yml` first** for the folders and the area vocabulary. No
`project.yml` means stop and tell the user to run
`npx @lucas-gomide/msg-cli init`.

Invocation: `/msg-roadmap-task-breakdown 03`. Bare, ask which item.

**This skill writes plans, never status.** Statuses, tables and ordering are
derived — see `/msg-roadmap-sync`, the only thing that writes them.

## Is the item ready?

The item is the whole input. These are the same five tests
`/msg-roadmap-plan-item` applies before it finishes, checked here because a thin
item is invisible once it has been sliced.

1. **Every User Experience behaviour is traceable to a Technical Details step.**
2. **Every step names a concrete action on a concrete thing.**
3. **Every Key Areas bullet uses a key from `areas` in `project.yml`**, and any
   `**Pattern**` bullet cites a numbered design rule.
4. **Blockers are real unknowns, each with a repo reference.**
5. **The estimate is a number.**

Failing 3, 4 or 5 is a fix you can offer to make on the roadmap doc and carry on.
Failing 1 or 2 means the item is not planned yet: point at
`/msg-roadmap-plan-item` and stop.

An older item written before Key Areas existed carries a flat `## Technical
Details:` list of area-prefixed bullets. Read those as Key Areas, and treat the
missing implementation flow as a failure of test 2.

## Flow

1. **Guard.** If the item's task folder already exists, **stop**. Print the
   existing task list with progress counts and say the folder must be deleted to
   redo the breakdown. Never overwrite a task file — ticked checkboxes are the
   only state under the docs tree that cannot be reconstructed.
2. **Read the roadmap doc.** Only that doc. Do not preload the area rule docs.
3. **Check it is ready to break down.** See the bar above. If it fails, say which
   test it failed and what is missing, and stop. Do not invent the missing detail
   — an item too vague to slice produces tasks too vague to implement, and the
   vagueness then looks decided.
4. **Check dependencies.** If a dependency is not `done`, say so once and
   continue — not a gate.
5. **Backfill a missing User Experience section.** If the item has a
   `**Front-end**` bullet in Key Areas and no `## User Experience:` section, it
   was planned before the section existed. Grill briefly for it — Entry, Flow,
   States,
   Pattern — and **write it onto the roadmap doc** before slicing. Two or three
   questions, not a design review.
6. **Propose the slice list and stop.** Table only, no files written:

   ```
   Proposed breakdown of roadmap 01 (5 tasks):

     01  api package scaffold + config module   back-end   deps: —
     02  postgres compose + drizzle-kit         back-end   deps: 01
     03  reference tables (11)                  back-end   deps: 02

   Approve, or tell me what to merge / split / reorder.
   ```

6. **On approval, write the task files and the folder README in one pass.** The
   README is prose plus an empty table — heading row and separator only:

   ```markdown
   # NN — Roadmap item title

   One or two lines on how this item was sliced. Hand-written; sync never touches it.

   | #   | Task | Scope | Depends on | Criteria | Status |
   | --- | ---- | ----- | ---------- | -------- | ------ |
   ```

7. **Run `/msg-roadmap-sync`.** It fills that table, adds the tasks README row,
   and moves the roadmap item to `in-progress` once a box is ticked. Never write a
   status or a table row by hand.

## Slicing rules

Slice **vertically**, never by architectural layer. "All the schemas" is not a
task; "reference tables, migration and mappers" is. A slice that cannot be
described without the word "and" three times is two slices.

The roadmap doc's Technical Details bullets are the raw material — group them into
slices, don't map them one-to-one.

Caps, enforced:

| Rule                               | Cap        |
| ---------------------------------- | ---------- |
| Tasks per roadmap item             | 2–8        |
| Acceptance criteria per task       | 3–10       |
| Technical details bullets per task | 8          |
| User experience bullets per task   | 6          |
| Context                            | 2000 chars |

Over the criteria cap means the slice is really two tasks — split it. Under it
means it should merge into a sibling. An item too small to justify two tasks still
gets a folder with one task file, so the shape stays uniform.

### Numbering

Task numbers are per-folder, zero-padded, starting at `01`. **Permanent IDs —
never renumbered, never reused**, same rule as roadmap numbers. Filename is
`MM-kebab-slug.md`. Folder name is the roadmap doc's own filename without `.md`.

### Template

```markdown
# MM — Title

**Roadmap:** [NN](../../roadmap/NN-roadmap-slug.md) · **Scope:** back-end · **Depends on:** 01, 02

## Context

- Why this slice exists. ≤2000 chars.

## User experience

- **Flow** — …
- **States** — …

## Technical details

- **Database** — …
- **Back-end** — …

## Acceptance criteria

- [ ] `(integration)` migration creates `monster` with a unique constraint on the natural key
- [ ] `(unit)` MonsterMapper maps a row to a Monster without importing the schema

## References

- …

## Implement with

`/api-feature`
```

**Header fields**

- `Roadmap` — breadcrumb for provenance. It is **not** required reading;
  everything needed to implement is in this file.
- `Scope` — `back-end` · `front-end` · `full-stack`. Drives which rule docs the
  implementing agent reads. `full-stack` means both, so prefer splitting when the
  halves are independently shippable.
- `Depends on` — **sibling task numbers only**, or `—`. Never reference a task in
  another folder; cross-item ordering lives in the roadmap README. Never restate
  the parent's dependencies.
- No `Status` field. No `Estimate`. Status is derived.

**Sections**

- **Context** — why this slice, not why the roadmap item. Bullets only.
- **User experience** — **required when `Scope` is `front-end` or `full-stack`,
  omitted otherwise.** Narrowed from the parent's `## User Experience:` section,
  same prefixes (`**Entry**`, `**Flow**`, `**States**`, `**Pattern**`,
  `**New pattern**`), keeping only what this slice renders. Copy verbatim where
  possible. The parent is not read at implementation time, so a bullet left out is
  a screen detail nobody sees again.
- **Technical details** — copied from the parent's bullets, keeping only what this
  slice needs, same `**Area**` prefixes. The legal set is the keys under `areas`
  in `project.yml`.
- **References** — the parent's Technical References that bear on this slice, plus
  the rule docs the scope implies. A `front-end` slice always cites the Design doc.
- **Implement with** — the skill that does the work.

### Acceptance criteria

Criteria are the deliverable. They double as the TDD red phase, so each one is a
**single observable behavior** with the test level that proves it:

- `(unit)` — colocated spec
- `(integration)` — against real dependencies
- `(e2e)` — full stack, driven like a user
- `(manual)` — verified by hand; must be rare, and never used for anything
  testable

Write them so a passing test can be pointed at each one. `- [ ] (integration)
upserting the same natural key twice leaves one row` is a criterion. `- [ ] the
DAO works` is not.

A `front-end` slice gets at least one criterion per **States** bullet. The empty
state is the usual miss, and it is what makes a working screen look broken.

Derive the rest from the parent's bullets and from whatever the project's rule
docs make non-negotiable for the areas the slice touches.

---

## Who ticks the boxes

Not this skill. Acceptance criteria are ticked by whoever implements the task.
Then `/msg-roadmap-sync` counts them and everything derived follows. Ticked
checkboxes are the only state under the docs tree that cannot be reconstructed.

## Rules

- Bullets only, no prose paragraphs. Every bullet is a decision or a fact.
- Never duplicate a roadmap dependency into a task's `Depends on`.
- Never write a task that spans two roadmap items.
- A criterion with no test level is not a criterion.
- Ticked checkboxes are sacred. No path through this skill removes one.
- Never write a status, a table row, or a section ordering. That is the sync
  skill's job.
