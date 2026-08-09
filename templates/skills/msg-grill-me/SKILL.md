---
name: msg-grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree, at a chosen effort and verbosity level. Use when the user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

# Grill the user

Interview the user about every part of their plan until you both understand it
the same way. Walk each branch of the decision tree one at a time, and follow a
branch's forks before moving to the next branch.

## Effort and verbosity

Two independent settings, each `min` / `med` / `high` / `max`:

- **Effort** — how much of the tree you walk.
  - `min` — only the questions that block starting: hard dependencies,
    ambiguous scope. 1–3 questions, no follow-ups.
  - `med` (default) — walk every branch once; one follow-up if an answer opens
    a new fork.
  - `high` — walk every branch; chase second-order forks (an answer reopens
    something an earlier question assumed); surface edge cases.
  - `max` — everything in `high`, plus actively look for what the user hasn't
    raised — failure modes, scale limits, naming collisions — even if nothing
    in their plan implied it.
- **Verbosity** — how much context rides on each question.
  - `min` — bare question + options, no setup sentence, no rationale for the
    recommendation.
  - `med` (default) — one short setup sentence + options; recommendation
    stated, not justified.
  - `high` — 1–2 setup sentences + options; recommendation includes a one-line
    why.
  - `max` — full context: setup, the trade-off each option implies, why the
    recommended one is recommended. Still capped — this is a ceiling, not
    permission to write a wall of text.

**Determining the levels:** read the invocation for either setting, stated or
implied ("grill me hard", "quick sanity check", "medium effort", or a caller
relaying the human's own words). Use whatever you can infer. For whatever isn't
inferable, ask once, up front, before the first real question.

## Asking

Use the `AskUserQuestion` tool for every question, including the levels
question. Always three options plus one clearly marked recommended, and always
allow free text — the tool provides this by default.

**Levels question**, only for what wasn't inferred: four symmetric presets, one
per level (`min`/`min`, `med`/`med`, `high`/`high`, `max`/`max`), with
`med`/`med` marked recommended. A mismatched combination (e.g. `high` effort
with `min` verbosity) goes through free text, not a fifth option.

**Every other question**: 3 options plus 1 marked recommended, free text always
open. How much setup and rationale each option carries follows the verbosity
level above.

Ask one question at a time. If a question can be answered by exploring the
codebase, explore instead of asking.

## How to talk

Plain words over jargon, always — this does not scale with verbosity. Say "the
parsing code" not "the anti-corruption layer". If a term like _aggregate_ or
_port_ is the real name of the thing, use it once and say what it means in four
words.

Short sentences. One idea each. Lead with the point — no "before I ask", no
recapping what was just said.
