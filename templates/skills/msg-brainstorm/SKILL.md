---
name: msg-brainstorm
description: Explore an open-ended project or feature idea with the user — the problem, who it's for, why now — before there's anything shaped like a plan. Use when there's an idea but no plan yet, not when there's already a plan or design to stress-test (that's msg-grill-me).
---

# Brainstorm the idea

Explore what the idea even is before anything looks like a decision tree.
Divergent first — generate and explore possibilities — then convergent: narrow
to a project view the user can hand off to planning.

## Scope

This skill only brainstorms. It does not close every loose end or resolve
every branch — that is the next step's job, not this one's. Stop once the
project view below is reached; do not keep grilling toward a fully resolved
plan. If the caller wants remaining gaps closed after this, that is a
separate step (e.g. `msg-grill-me`), not something this skill does itself.

## Effort and verbosity

Fixed defaults, stated explicitly rather than inferred per-call:

- **Effort: `high`** — explore broadly. Don't stop at the first plausible
  shape; surface alternative framings of the problem and who it's really for
  before narrowing.
- **Verbosity: `med`** — one short setup sentence + options; recommendation
  stated, not justified at length.

A caller (e.g. `msg-pre-roadmap`) may override either explicitly. Absent an
override, use these defaults — do not infer from the user's wording the way
`msg-grill-me` does.

## Asking

Use the `AskUserQuestion` tool for every question. Always three options plus
one clearly marked recommended, and always allow free text. Ask one question
at a time. If a question can be answered by exploring the codebase, explore
instead of asking.

## Flow

1. **Divergent.** Explore the idea itself:
   - What problem does it solve?
   - Who is it for?
   - Why now — what makes this the moment to do it?
   - What rough shapes could this take? Don't settle on one yet.
2. **Convergent.** Narrow toward a single project view:
   - Pick the shape that best fits the answers so far.
   - Confirm the problem, audience, and motivation are stated in a way the
     user recognizes.
3. **Stop.** Do not chase every fork this view implies — leave those for
   whatever calls this skill next.

## Output

A short prose/bullet summary of the project view reached: problem, audience,
why now, rough shape. Not a file write — nothing is persisted here. Whatever
invoked this skill decides what to do with the summary, including whether to
write it to disk.

## How to talk

Plain words over jargon. Say "the parsing code" not "the anti-corruption
layer". If a term like _aggregate_ or _port_ is the real name of the thing,
use it once and say what it means in four words.

Short sentences. One idea each. Lead with the point — no "before I ask", no
recapping what was just said.
