---
name: msg-wireframes
description: Draw a wireframe into a roadmap item's folder for every screen the item's User Experience section describes, each paired with the design rules it must follow. Use at planning time when a roadmap item has a front-end aspect, or when asked to wireframe a screen.
---

# Wireframe a roadmap item's screens

A roadmap item's `## User Experience` section describes its screens in words and
interaction diagrams, but nobody has drawn what each screen actually looks like.
This skill closes that gap: it writes one short wireframe file per screen and
cites the exact `design.md` rules each one has to follow, so the wireframe and
the rule sit next to each other instead of in two documents nobody cross-checks.

The wireframes go into the item's own folder, at
`docs/roadmap/NN-slug/wireframes/`, one markdown file per screen. That folder is
the item's permanent home — nothing in it is deleted when a task breakdown is
retired — so the wireframes drawn here outlive the branch that implements them.

This skill never decides UX. It draws what `msg-roadmap-plan-item` already wrote
in the item's `## User Experience` section — if that section is thin, the
wireframe will be too, and that is a planning problem, not this skill's to fix.

Invocation: `/msg-wireframes <item>` against a roadmap item number, or invoked
automatically by `msg-roadmap-plan-item` right after it writes the item's
`README.md`. Invoked bare, ask which item.

## Locate context

Read `project.yml` for the roadmap folder and the `design` area's rule doc.

- **No `project.yml`, or the item's `docs/roadmap/NN-slug/README.md` has no
  `## User Experience` section** — there is nothing to draw from. This skill's
  only input is that section, which exists only inside an item's `README.md`, so
  a fallback would be guessing a layout. Do not write a file anywhere. Stop and
  name what is missing: the msg-cli planning workspace, or the item's User
  Experience section.
- **Otherwise** write into `docs/roadmap/NN-slug/wireframes/` and read the rule
  doc `project.yml`'s `design` area names.

## Flow

1. **Find the item.** Its folder is `docs/roadmap/NN-slug/`. Read its
   `README.md`. Invoked bare, ask which item first.
2. **Read the item's `## User Experience` section** — the `**Entry**`,
   `**Flow**`, `**States**`, `**Pattern**` / `**New pattern**` bullets, and the
   `###` interaction diagrams with their prose explanations. This is the entire
   input; never add a screen, a state, or a flow step the section doesn't
   already list.
3. **Read the design rule doc**, only the rules a screen actually exercises —
   colour, layout, focus order, empty/error/loading states, whatever applies.
   Skim by heading; don't read the whole file.
4. **List the screens.** One wireframe file per distinct screen the section
   describes — usually one per interaction diagram, plus any screen a
   `**Flow**` bullet names that has no diagram of its own. Merge minor variants
   of one screen (an empty state and a filled state of the same list) into one
   file with a note, not two files.
5. **Write one file per screen** under `docs/roadmap/NN-slug/wireframes/`, named
   after the screen in kebab-case (`character-list.md`). Replace a file that is
   already there; leave the others alone.

## The write barrier

A shipped item's artifacts are not silently rewritten. If the item's
`**Status:**` is `done`, or its header carries `**Landed:**` or `**Merged:**`,
the work has shipped: report which wireframe files would change and what would
change in them, then ask before writing. For an item that is `not-started` or
`in-progress`, re-running this skill updates its wireframe files in place — that
is the normal way to revise them.

## Format

One markdown file per screen, at `docs/roadmap/NN-slug/wireframes/<name>.md`:

````markdown
# Character list

## Purpose

Where the user sees every character they have made, and where they start
creating, editing or deleting one.

## Where it sits

Renders the `**Entry**` bullet ("from the roster nav link") and the "Browse the
roster" interaction diagram in `## User Experience`. Covers the empty and filled
cases from the `**States**` bullet.

## The screen

A page titled "Characters" with a "New character" button in the top-right.
Below it, the list of characters, one row each: the name on the left, "Edit" and
"Delete" actions on the right of the row. When there are no characters yet, the
list area is replaced by a short line ("No characters yet.") and a single
"Create your first character" button.

```
Characters                     [ + New ]
----------------------------------------
Kaelen the Bold            [Edit] [Del]
Mira Duskwalker            [Edit] [Del]
```

## Design rules

- Rule 4 — body text uses step 11/12, never step 9/10
- Rule 6 — body text clears 7:1 contrast
- Rule 24 — row actions stay in the trailing column, never a hover-only reveal
````

The ASCII sketch is optional. Include one only where it makes the layout
clearer than the words alone. A screen a paragraph already describes fully does
not need one — the sketch is no longer the point of this skill.

## Rules

- One file per screen, under the item folder's `wireframes/`. Never a
  `## Wireframes` section in any document, and never a `wireframes.md` next to
  the item folder.
- **Purpose** is a line or two. **The screen** is a paragraph, not a page. Keep
  each file short: the point is the layout and the rules, not exhaustive prose.
- **Where it sits** always points back to a concrete part of the
  `## User Experience` section — a named bullet or a named interaction diagram.
  A wireframe that cannot say which bullet it renders is inventing a screen.
- Every file carries a **Design rules** list. A wireframe with no cited rule is
  decoration, not spec — cut it or find the rule.
- Cite a rule by number (`Rule 4`) and a one-line paraphrase of what it
  requires — not the whole rule text, not just the number.
- Never invent a screen, a state, or a flow step the item's User Experience
  section doesn't already have. If that section is missing entirely, say so and
  stop rather than guessing a layout.
