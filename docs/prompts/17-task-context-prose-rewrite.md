# Goal: Rewrite the task file's Context section from a cramped bullet list into a plain-language prose explanation

**Status:** executed on 2026-08-30
**Rating:** —

## Context

`templates/skills/msg-roadmap-task-breakdown/SKILL.md` tells the agent how to
write each task file. Its `## Context` section is currently defined as bullets
only, capped at 2000 characters. In practice that produces Context sections
nobody can read. The bullets are dense, they lean on bare references — a task
number like `04`, a requirement code like `FR.25.5`, a symbol like `OnlineSlot`
— with no explanation of what any of them are, and they explain the *reasoning
behind decisions* instead of explaining *what is going to be built*. An agent or
a human opening the task file cold learns nothing from it.

The fix is to change what Context is for. It should be a short prose
explanation, written for someone with no prior knowledge of the project, that
says plainly what this slice implements and why it exists. Not a decision log,
not a summary of the technical details section, not architecture rationale — a
direct explanation a non-expert can read once and understand what is being
built.

Three things change together: the character budget goes up so there is room to
actually explain, the format switches from bullets to prose, and the skill gains
a rule that every reference must be self-explanatory in the sentence that uses
it.

## Constraints

1. Update the caps table in `## Slicing rules`: the `Context` row becomes a
   range, roughly **1000–3000 characters**. Both ends are enforced — a Context
   under the floor is as wrong as one over the ceiling — and the table row (or a
   line under it) must say so.
2. Change the `## Context` bullet in the `**Sections**` list. It currently reads
   "why this slice, not why the roadmap item. Bullets only." It must instead
   describe prose written for a reader with no context on the project: what this
   slice builds, in plain words, and why it exists.
3. Carve Context out of the global "Bullets only, no prose paragraphs" rule
   under `## Rules`. Context is the single exception; every other section in the
   task file stays bullets. State the exception explicitly so the two rules do
   not contradict each other.
4. Update the `### Template` block so the `## Context` placeholder shows prose,
   not a bullet, and its inline hint reflects the new range and purpose.
5. Add a rule banning unexplained references in Context. No bare task numbers
   (`04`), requirement codes (`FR.25.5`), class or symbol names, file paths, or
   rule numbers unless the same sentence says in plain words what the thing is.
   Context must be readable without opening any other file.
6. Say what Context is *not*: not a restatement of `## Technical details`, not a
   list of design decisions and their justifications, not architecture-rule
   citations. Those already have their own sections.
7. Keep the prose target explicit — write for a smart reader who knows nothing
   about this codebase. Short sentences, ordinary words, no shorthand.
8. Do not change any other section of the skill: the flow steps, the acceptance
   criteria guidance, the test-script section, the numbering rules and the
   sync-skill boundaries all stay as they are.
9. This edits a template shipped by the CLI. Check whether any test fixture,
   golden file or docs guideline in the repo asserts the old "bullets only"
   Context or the 2000-char cap, and update those together with the skill.

## Output

Edited `templates/skills/msg-roadmap-task-breakdown/SKILL.md` (plus any fixtures
or docs the change invalidates). No new files.

## Examples

The Context below is what the new rule must prevent. It is dense, bullet-shaped,
and unreadable to anyone who has not already read the rest of the project — bare
task numbers (`03`, `04`), an undefined requirement code (`FR.25.5`), and symbol
names (`libs/contracts`, `.meta({ id })`, Orval, MSW) used as if the reader
already knows them:

```markdown
## Context

- Both selection paths on `/characters` go through one mutation: the slot is
  free, or a *different* character holds it and must be left first. One endpoint
  is why `FR.25.5`'s five seconds lands in one place when the hunt features add
  it, instead of in two callers that have to agree.
- Contracts come first: `libs/contracts` is the single source `openapi.json`, the
  Orval client, its hooks and the MSW handlers are generated from. Nothing on the
  web is hand-written against this route.
- Every component is named explicitly with `.meta({ id })` so it lands in
  `openapi.json` as a referenced component rather than an inlined shape — the
  discipline `03` and `04` already follow.
- The character id stays out of the URL on the web side because the server holds
  which character is online; the endpoint is where that server state is written.
- `04` built the character card's online render against a placeholder. Extending
  the list reply here is what fills it, without the select screen making a second
  request.
```

The replacement should read like an explanation given to a new teammate: what
the endpoint does, what a player experiences, why one endpoint rather than two,
and what a term like "the online slot" means the first time it appears.
