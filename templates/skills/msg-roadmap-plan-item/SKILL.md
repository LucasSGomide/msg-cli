---
name: msg-roadmap-plan-item
description: Grill an idea into a roadmap item, an exploration, or a ditched record. A roadmap item is a folder holding its main document plus its contract, diagrams and wireframes. Use when the user proposes a feature, says "add this to the roadmap", wants an idea stress-tested before committing to it, or asks to record why something was rejected.
---

# Plan a roadmap item

The roadmap item is the deliverable, and it is a folder. The folder holds the
main document plus every artifact that describes the work: the API contract, the
sequence diagrams, the wireframes. Write the item so that breaking it into tasks
later is only splitting work that is already described — not inventing it.

That is a change from how this used to work. The item used to be deliberately
thin, on the theory that the real thinking happened during task breakdown. That
was the wrong call: a thin item makes a thin breakdown, and the breakdown then
burns its budget deciding things that should have been decided once, here. So the
item is now long and detailed, and the breakdown's job shrinks.

**Read `project.yml` first.** It names the folders and the areas with their rule
docs. Everywhere below that says "the roadmap folder" means the path it gives. If
there is no `project.yml`, stop and tell the user to run
`npx @lucas-gomide/msg-cli init`.

## How to talk

Short and plain. The user reads every word, so every extra word costs them.

- Short sentences. One idea each. Cut any sentence that only sets up the next one.
- Plain words over jargon. Say "the parsing code" not "the anti-corruption layer".
  If a term like _aggregate_ or _port_ is the real name of the thing, use it once
  and say what it means in four words.
- Lead with the point. No "before questions", no "that reframes X", no recapping
  what you just read. State the finding, then stop.
- Findings: one line each, max 3 lines. `file:line` beats describing the file.
- Questions: 2 lines of setup, max. Options get one short sentence, not a
  paragraph.
- No praise, no filler, no summarising your own answer.

This is about how you talk to the user during the grill. It is **not** how you
write the item — the item is prose, and it is long on purpose. See the template.

## Flow

1. **No argument?** Ask what the idea is. Nothing else happens first.
2. **Requirements gate.** Read `docs/requirements.md` (or whatever
   `requirementsFile` names in `project.yml`) and look for a row whose `Feature`
   column matches the idea/feature name — case-insensitive, trimmed, exact
   string match; no fuzzy matching. If no row matches, stop: tell the user to
   run `/msg-pre-roadmap <feature name>` first, and do not proceed. This is a
   hard gate — do not offer to continue without requirements.
3. **Ditched check.** Read the ditched and explorations READMEs (tables only). If
   the idea matches a ditched doc or a `ruled out` verdict, open that doc, state
   the reason, and ask whether to proceed anyway. Stop if the answer is no.
4. **Grill.** Invoke the `msg-grill-me` skill at `med` effort and verbosity
   unless the user's own words already imply a level — relay their words rather
   than picking a level yourself. One question at a time, each with a
   recommended answer. Explore the repo instead of asking anything the repo can
   answer. Nothing is a hard gate — surface conflicts and let the user decide.
5. **User experience grill**, only when the item touches the front end. See
   "The User Experience section" below.
6. **Ask the outcome**, with a recommendation: **roadmap** · **exploration** ·
   **ditch**. A ditch skips straight to the ditched template below, then
   `make roadmap-sync`, and stops — no folder, no artifacts.
7. **Front-end reference question.** Only for an item with a front-end aspect.
   Ask the user for a front-end reference — a URL to the running app, or an
   equivalent — with one `AskUserQuestion` call: "provide a reference"
   recommended, "no reference" a real option. This is not a gate.
   - Reference given → run the web investigator (see "## Web investigator").
   - Declined → note in the flow that no reference was given, then build the
     Front-end prose and the interaction diagrams from `design.md`,
     `architecture-web.md` and whatever the user told you about the UI and UX.
     Do not re-ask, do not stall.
   - Back-end-only item → skip this step; the question is never asked.
8. **Create the folder and write `README.md`** per the template below.
9. **Generate the artifacts.** Invoke the three artifact skills against the
   folder. See "## Artifact generation".
10. **Run `make roadmap-sync`.**
11. **Check it is ready to break down** against the bar below. If it is not, fix
    `README.md` now — a thin item becomes a thin breakdown.

Read only what the grill actually touches. `grep` the metadata headers to learn
the number space and dependency graph; open full docs on demand. Open an area's
rule doc only when the item is shaped like that area.

## Numbering

Roadmap, exploration and ditched each have their own number sequence. A new item
takes the next free number in its sequence, zero-padded. **Numbers are permanent
IDs. Never renumber, never reuse.**

A roadmap item is a folder — `NN-kebab-slug/` — and the document inside it is
always `README.md`. The folder's name is what the sync engine and the task
breakdown key off, so choose the slug once and do not let it drift.

## What a roadmap item looks like

A roadmap item is a folder, not a file: `docs/roadmap/NN-slug/`. It holds the
main document and every artifact that describes the item. Nothing in it is ever
deleted when a task breakdown is retired — that is the whole reason the folder
exists.

| Path                   | What it is                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `README.md`            | The main document — the `# NN — Title` line, the metadata header, every prose section, and the inline Mermaid interaction diagrams |
| `openapi.json`         | The item's OpenAPI contract, at the folder root                                                             |
| `wireframes/`          | One markdown file per wireframe                                                                              |
| `sequence-diagrams.md` | Every sequence diagram for the item, in one file                                                            |
| `test-script.md`       | The hand-run verification runbook — **this skill does not create it**                                        |

`test-script.md` is written later, by the first task that reaches acceptance,
exactly as it works today. Only its location moved. Name the path here, and leave
the file alone.

The Mermaid interaction diagrams are **not** a separate file. They live inline in
`README.md`, inside the User Experience section.

This folder rule is only for roadmap items. Explorations (`docs/explorations/`)
and ditched records (`docs/ditched/`) stay single markdown files — never give
them folders.

## Template — roadmap and exploration

This goes in the folder's `README.md`.

````markdown
# NN — Title

**Depends on:** 01, 02 · **Status:** not-started · **Estimate:** 8

## Context

Plain-language prose that explains what is going to be implemented and why, to a
reader who knows nothing about the project. 3000–6000 characters.

## User Experience

- **Entry** — …
- **Flow** — …
- **States** — …
- **Pattern** — …

### <name of the interaction>

```mermaid
…
```

Short plain-language explanation of this interaction: which screen, which
components, which states, what the user does and what they see.

## Technical Details

### Back-end

Prose. What to create and in which layer, in the vocabulary the project already
uses, citing the rule docs and rule numbers it obeys.

### Front-end

Prose. What to create — components, pages, hooks — citing the design and
front-end rule docs and rule numbers.

### Technical References

- …

## Blockers

- …
````

The `# NN — Title` line and the metadata header are unchanged from before.
`**Depends on:**`, `**Status:**` and `**Estimate:**` are still the only fields
the sync engine reads, and the title line is still the cell the generated tables
print.

Caps and rules, enforced:

| Section                     | Rule                                                           |
| --------------------------- | ------------------------------------------------------------- |
| Context                     | 3000–6000 characters, both ends enforced                      |
| User Experience             | no cap                                                        |
| Technical Details           | no cap                                                        |
| Technical References        | concise, no fixed number                                      |
| Blockers                    | no cap — every bullet cites a concrete repo reference (file, table, field, doc number) |
| Findings (exploration only) | 1000 chars                                                    |

No cap is not permission to ramble. A section with no cap still cuts anything
that is neither a decision nor a fact.

**Format by section.** There is no global "bullets only" rule any more.

- **Context** and **Technical Details** are prose paragraphs.
- **User Experience** is bullets, plus one Mermaid diagram per interaction, each
  with a prose explanation beneath it.
- **Technical References** and **Blockers** stay bullets.

### The Context section

3000–6000 characters, both ends enforced. Under the floor explains too little to
be worth reading; over the ceiling has stopped being the quick read it is meant
to be.

It is prose written for a smart reader who knows nothing about this codebase. It
says plainly what is going to be built and why it exists. Same discipline the
task file's Context already has (see
`templates/skills/msg-roadmap-task-breakdown/SKILL.md`):

- Short sentences, ordinary words, no shorthand.
- Every reference is explained in the sentence that uses it. No bare numbers, no
  requirement codes like `FR.25.5`, no class or symbol names, no file paths, no
  rule numbers — unless the same sentence says in plain words what the thing is.
- Readable start to finish without opening another file.
- Not a restatement of Technical Details, not a decision log, not a list of
  design choices and their justifications. Those have their own sections.

### The User Experience section

**Mandatory when the item has a front-end aspect. Omitted entirely otherwise** —
an API-only item does not get an empty heading.

It sits above Technical Details on purpose: what the user does, before how it
gets built.

Bullet prefixes, in this order:

| Prefix            | Holds                                                                              |
| ----------------- | --------------------------------------------------------------------------------- |
| `**Entry**`       | Where the user arrives from: a route, a row action, a button on an existing screen |
| `**Flow**`        | The steps they take, one bullet each. No wireframes, no copy                       |
| `**States**`      | What pending, error, empty and filtered-to-nothing say                             |
| `**Pattern**`     | The primitive or screen this reuses                                                |
| `**New pattern**` | Only when nothing existing covers it                                               |

**Every `**Pattern**` bullet cites** a numbered rule in the Design rule doc named
by `project.yml`, or a `file:line`. Same rule Blockers carries, for the same
reason: an uncited bullet is a wish, and nobody can check it.

Then, **one Mermaid diagram per main user interaction**, each under its own
`###` heading with a short plain-language explanation beneath it. The explanation
exists so the task breakdown can tell which components, states and behaviours the
interaction needs without reading them out of the picture. Name the screen, the
components, the states, and what the user does and sees.

#### When the grill finds a new pattern

Grill briefly — two or three questions, not a design review. Then write a
`**New pattern**` bullet saying what it adds and why nothing existing covers it,
and note that the design doc owes a rule once it ships:

```markdown
- **New pattern** — a side-by-side diff column set. Nothing in docs/design.md
  covers a two-pane compare; the design doc owes a rule once this ships.
```

The rule is written against real code later, not guessed now. Do not block the
item on it, and do not add the rule to the design doc during planning.

### The Technical Details section

Prose, not a numbered list. No length cap. Exactly two subheadings, in this
order.

**`### Back-end`** — what to create and in which layer: controllers, use-cases,
repositories, DAOs, utility methods, and so on. Write it against the concepts the
project already uses: read the architecture doc the project's `back-end` area
points at in `project.yml` (usually `docs/architecture-api.md`) and stick to its
vocabulary. **This prose also names which rule doc and which rule numbers the
work obeys** — that is the job the old Key Areas section used to do, folded in
here. If the item forces a concept the project does not have yet, flag it in that
sentence — do not slip it in as if it already existed.

**`### Front-end`** — what to create: components, pages, hooks, and so on. Read
the `design` and `front-end` area docs (usually `docs/design.md` and
`docs/architecture-web.md`) and use their vocabulary. Name the rule docs and rule
numbers this obeys, and cite a numbered design rule for any pattern it reuses.
Flag anything new the same way.

### The Technical References section

Research only. If this item — or the `msg-pre-roadmap` phase that produced its
requirements — triggered research, list the findings that will actually be
applied and explain each in direct, concise terms. Not a link dump, not a
reading list. No bullet cap.

### The Blockers section

Every bullet cites a concrete repo reference (file, table, field, doc number)
that justifies it. A dependency is never a blocker — the header already carries
it. Blockers are the real unknowns.

Differences by folder:

- **Roadmap** — header uses `**Status:**` with one of `not-started`,
  `in-progress`, `parked`, `done`. New items are `not-started`. `Depends on`
  lists roadmap numbers, or `—`.
- **Exploration** — header uses `**Verdict:**` instead of Status
  (`viable, verified` · `viable, not yet spiked` · `blocked` · `ruled out`), and
  the doc gains a final `## Findings` section (≤1000 chars) holding what the
  research established, so the knowledge survives even if the idea never ships.
  Cross-folder deps are prefixed `R` (`R14` = roadmap 14).

## Web investigator

Only when the user gave a front-end reference in flow step 7.

Spawn an **inline subagent** with the Task tool — created on the fly, **not** a
file under `templates/agents/`. Model it on the optional research subagent in
`templates/skills/msg-pre-roadmap/SKILL.md` step 4:

- Scoped to one pass. No back-and-forth with the user.
- Uses `WebFetch` / `WebSearch`.
- Reports back a summary and nothing else.

Its job: visit the reference, map the DOM, the components and the structure of
the part of the app this item relates to, and report how that app builds that
piece.

Back in the main thread, hold the report against the project's `design.md`
guidelines with a critical eye on user experience — what to copy, what to reject,
and why. The report feeds the Front-end prose and the interaction diagrams. It is
not a reusable agent; do not build it as one, and do not add it to
`templates/agents/`.

## Artifact generation

After `README.md` is written and the folder exists, invoke the three artifact
skills against the roadmap item folder, in this order:

1. `/msg-api-contracts` — writes `openapi.json` at the folder root.
2. `/msg-sequence-diagrams` — writes `sequence-diagrams.md`. It reads
   `openapi.json` to know which routes the item adds, so it runs after contracts.
3. `/msg-wireframes` — writes `wireframes/`. Front-end items only.

A back-end-only item skips step 3. A UI-only item skips steps 1 and 2. These
three used to run during task breakdown; they run here now.

## Template — ditched

```markdown
# NN — Title

**Ditched:** YYYY-MM-DD · **Estimate:** 6

## Idea

<= 500 chars.

## Why not

- Concrete repo references, same rule as Blockers.
```

No `Depends on`, no Status, no User Experience. Ditched items have no queue
position and no screen. A ditched record is a single file, not a folder.

## README regeneration

**Run `make roadmap-sync`.** Never hand-patch a table — every one of them is
derived from the docs' metadata headers, and a hand-edited row is drift the check
will fail on.

Two consequences for how the doc is written, because the table is generated from
it:

- The `# NN — Title` line **is** the table's Idea/Item cell. It now lives in the
  folder's `README.md`, and that `README.md` is the file the sync engine parses.
  Write the title as the line you want to read in the table, not as a filename.
- `Depends on`, `Status`/`Verdict` and `Estimate` in the header are the only
  inputs. A dependency that is not a real number, or an estimate that is not a
  number, fails the check.

Then update the prose above the table if the new item changes what to pick up
next.

## Revival

If a ditched idea is picked up again and the user proceeds, **delete the ditched
doc** once the item's folder exists and its `README.md` is written, then sync —
the row goes with it. Do not leave a pointer behind and do not renumber the
remaining ditched docs.

## Ready to break down

`/msg-roadmap-task-breakdown` refuses an item that does not meet this bar, and
names the gap. Check it yourself before you finish, so the refusal never happens.

1. **Every User Experience behaviour is traceable to a** line in Technical
   Details. If a state, a flow step or an entry point has nothing in Technical
   Details that produces it, the breakdown will not produce it either.
2. **Every Technical Details sentence names a concrete action on a concrete thing.**
   A sentence nobody can turn into a commit is a heading, not a step.
3. **The Back-end and Front-end prose each cite the rule doc for their area**,
   and any reused pattern cites a numbered design rule.
4. **Blockers are real unknowns, each with a repo reference.** A dependency is
   not a blocker; the header already carries it.
5. **The estimate is a number.** `make roadmap-check` fails otherwise.

An item that fails 1 or 2 is not "needs more detail during breakdown" — it is not
planned yet. Go back to the grill.
