---
name: msg-roadmap-plan-item
description: Grill an idea into a roadmap item, an exploration, or a ditched record. Use when the user proposes a feature, says "add this to the roadmap", wants an idea stress-tested before committing to it, or asks to record why something was rejected.
---

# Plan a roadmap item

The planning is the deliverable. The doc is a receipt — keep it short.

**Read `project.yml` first.** It names the folders and the areas with their rule
docs. Everything below that says "the roadmap folder" means the path it gives. If
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

Aim for a third of what feels natural. When a section runs long, delete — don't
compress.

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
5. **User experience grill**, only when the item touches the front end. See below.
6. **Ask the outcome**, with a recommendation: **roadmap** · **exploration** ·
   **ditch**.
7. **Write** per the template below, then run `make roadmap-sync`.
8. **Check it is ready to break down** against the bar below. If it is not, fix
   the doc now — a thin item becomes a thin breakdown.

Read only what the grill actually touches. `grep` the metadata headers to learn
the number space and dependency graph; open full docs on demand. Open an area's
rule doc only when the item is shaped like that area.

## Numbering

Each folder has its own sequence. New doc takes the next free number in its
folder, zero-padded. **Numbers are permanent IDs. Never renumber, never reuse.**
Filename is `NN-kebab-slug.md`.

## Template — roadmap and exploration

```markdown
# NN — Title

**Depends on:** 01, 02 · **Status:** not-started · **Estimate:** 8

## Context

- Why this exists and why now.

## User Experience:

- **Entry** — …
- **Flow** — …

## Key Areas:

- **Back-end** — …
- **Front-end** — …

## Technical Details:

1. …
2. …

### Technical References:

- …

## Blockers:

- …
```

Caps, enforced:

| Section                     | Cap                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Context                     | 2000 chars total                                                                                                 |
| User Experience             | 8 bullets                                                                                                        |
| Key Areas                   | 6 bullets                                                                                                        |
| Technical Details           | 12 numbered steps                                                                                                |
| Technical References        | 15 bullets                                                                                                       |
| Blockers                    | no cap — but every bullet must cite a concrete repo reference (file, table, field, doc number) that justifies it |
| Findings (exploration only) | 1000 chars                                                                                                       |

Bullets only, no prose paragraphs. Every bullet is a decision or a fact; anything
that is neither gets cut.

## Key Areas vs Technical Details

They answer different questions, and collapsing them is what makes an item too
vague to slice.

**Key Areas — which rule docs this item has to obey.** Each bullet is prefixed
with an area in bold, and **the legal set is exactly the keys under `areas` in
`project.yml`**. A bullet prefixed with anything else points at no rules. Say
what the item does in that area and which rule constrains it:

```markdown
## Key Areas:

- **Back-end** — new read endpoint for the character list; DAO, not a repository
- **Front-end** — one new page, no new shared primitive
- **Design** — reuses the table pattern, rule 24
```

**Technical Details — the order the work happens in.** Numbered steps, free-form,
no area prefix. This is where the implementation flow is decided once so it does
not have to be re-derived later with less context:

```markdown
## Technical Details:

1. Add the endpoint and its response schema; regenerate the contract.
2. Run codegen so the client and mock handlers exist.
3. Tests for the API call first — they fail against the generated mock.
4. Tests for the page's empty, loading and error states.
5. Build the page from props.
6. Wire the call in through a feature hook.
```

A step names a concrete action on a concrete thing. "Handle errors" is not a
step; "map the 409 to the duplicate-name message on the form" is.

## The User Experience section

**Mandatory when Key Areas carries a `**Front-end**` bullet. Omitted entirely
otherwise** — an API-only item does not get an empty heading.

It sits above Key Areas on purpose: what the user does, before which rules
constrain it and in what order it gets built.

Bullet prefixes, in this order:

| Prefix            | Holds                                                                              |
| ----------------- | ---------------------------------------------------------------------------------- |
| `**Entry**`       | Where the user arrives from: a route, a row action, a button on an existing screen |
| `**Flow**`        | The steps they take, one bullet each. No wireframes, no copy                       |
| `**States**`      | What pending, error, empty and filtered-to-nothing say                             |
| `**Pattern**`     | The primitive or screen this reuses                                                |
| `**New pattern**` | Only when nothing existing covers it                                               |

**Every `**Pattern**` bullet cites** a numbered rule in the Design rule doc named
by `project.yml`, or a `file:line`. Same rule Blockers already carries, for the
same reason: an uncited bullet is a wish, and nobody can check it.

### When the grill finds a new pattern

Grill briefly — two or three questions, not a design review. Then write a
`**New pattern**` bullet saying what it adds and why nothing existing covers it,
and note that the design doc owes a rule once it ships:

```markdown
- **New pattern** — a side-by-side diff column set. Nothing in docs/design.md
  covers a two-pane compare; the design doc owes a rule once this ships.
```

The rule is written against real code later, not guessed now. Do not block the
item on it, and do not add the rule to the design doc during planning.

Differences by folder:

- **Roadmap** — header uses `**Status:**` with one of `not-started`,
  `in-progress`, `parked`, `done`. New items are `not-started`. `Depends on`
  lists roadmap numbers, or `—`.
- **Exploration** — header uses `**Verdict:**` instead of Status
  (`viable, verified` · `viable, not yet spiked` · `blocked` · `ruled out`), and
  the doc gains a final `## Findings` section (≤1000 chars) holding what the
  research established, so the knowledge survives even if the idea never ships.
  Cross-folder deps are prefixed `R` (`R14` = roadmap 14).

Never restate a dependency as a Blockers bullet — the header already says it.
Blockers are the real unknowns.

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
position and no screen.

## README regeneration

**Run `make roadmap-sync`.** Never hand-patch a table — every one
of them is derived from the docs' metadata headers, and a hand-edited row is
drift the check will fail on.

Two consequences for how the doc is written, because the table is generated from
it:

- The `# NN — Title` line **is** the table's Idea/Item cell. Write it as the line
  you want to read in the table, not as a filename.
- `Depends on`, `Status`/`Verdict` and `Estimate` in the header are the only
  inputs. A dependency that is not a real number, or an estimate that is not a
  number, fails the check.

Then update the prose above the table if the new item changes what to pick up
next.

## Revival

If a ditched idea is picked up again and the user proceeds, **delete the ditched
doc** once the roadmap or exploration doc is written, then sync — the row goes
with it. Do not leave a pointer behind and do not renumber the remaining ditched
docs.

## Ready to break down

`/msg-roadmap-task-breakdown` refuses an item that does not meet this bar, and
names the gap. Check it yourself before you finish, so the refusal never happens.

1. **Every User Experience behaviour is traceable to a step.** If a state, a flow
   step or an entry point has nothing in Technical Details that produces it, the
   breakdown will not produce it either.
2. **Every step names a concrete action on a concrete thing.** A step nobody can
   turn into a commit is a heading, not a step.
3. **Every Key Areas bullet cites its rule doc's area**, and any `**Pattern**`
   bullet cites a numbered rule.
4. **Blockers are real unknowns, each with a repo reference.** A dependency is not
   a blocker; the header already carries it.
5. **The estimate is a number.** `make roadmap-check` fails otherwise.

An item that fails 1 or 2 is not "needs more detail during breakdown" — it is not
planned yet. Go back to the grill.
