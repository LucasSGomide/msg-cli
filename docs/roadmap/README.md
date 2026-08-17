# Roadmap

Committed work. One doc per item, numbered on creation — **the number is a
permanent ID, never renumbered**. Ordering lives in this table only.

**Rules**

- Every table below is generated from the docs' metadata headers (`Depends on` /
  `Status` / `Estimate`). **Edit the doc, not the table.**
- Sections: **Ready** (every dependency `done`, not yet finished) first, then
  **Blocked**, each by estimate desc, ties by number asc. Then **Parked**.
  **Done** last, sorted by number asc.
- `Depends on` is roadmap numbers only. `—` means nothing blocks it.
- Status: `not-started` · `in-progress` · `parked` · `done`. Derived from the
  item's task checkboxes whenever a breakdown is open.
- The prose above the table is hand-written and says **why** the next item is
  next. The table sorts by estimate; that sort is not a priority.

**Next up: 03.** 02 landed the CQRS rewrite of the backend architecture doc, so
the backend template is settled. 03 is the natural next pick — it is the
frontend counterpart, and refining it now means the six remaining items are all
being planned against settled architecture docs on both sides rather than
against docs still in flux.

## Ready

| # | Item | Est | Depends on | Status |
|---|---|---|---|---|
| [03](03-refine-frontend-architecture-template.md) | Refine frontend architecture template | 8 | — | not-started |
| [08](08-refine-design-rules-template.md) | Refine design rules template | 8 | — | not-started |
| [05](05-refine-backend-stack-template.md) | Refine backend stack template | 6 | — | not-started |
| [06](06-refine-frontend-stack-template.md) | Refine frontend stack template | 6 | — | not-started |
| [07](07-refine-auth-template.md) | Refine auth template | 6 | — | not-started |
| [04](04-refine-naming-conventions-template.md) | Refine naming conventions template | 5 | — | not-started |

## Blocked

_(none)_

## Parked

_(none)_

## Done

| # | Item | Est | Depends on | Status |
|---|---|---|---|---|
| [01](01-msg-uninstall-removes-the-scaffold.md) | `msg uninstall` removes the scaffold from a workspace | 6 | — | done |
