---
name: msg-write-prompt-slides
description: Structure a prompt whose deliverable is a slide deck built with Claude Design — audience, narrative arc, slide-by-slide claims, and visual system — filling it from what the user already said and grilling only for what's missing. Use when the user asks to write or structure a prompt for a deck, presentation, or slides.
---

# Write a structured prompt for a slide deck

Turn what the user already said into a structured deck prompt, and interview
them only for the parts they didn't cover. The prompt is the deliverable —
write it, don't summarize it.

This is the deck sibling of `msg-write-prompt`. Same discipline, different
template. Use this one whenever the thing being built is a slide deck; use
`msg-write-prompt` for everything else.

The decks this covers are technical and product explainers, and status/review
decks — a system, a feature, or what changed since last time. The audience
shifts from deck to deck, so it is always captured, never assumed.

## Template

````markdown
# Goal: <one line — what the deck has to do>

**Status:** not executed
**Rating:** —

## Context
<what the deck is for, and what prompted it>

## Audience & Takeaway
<who is in the room, what they already know, the one thing they leave with>

## Narrative Arc
<the story beats, in order>

## Slide-by-Slide
### 1. <title>
- Point: <the single claim this slide makes>

### 2. <title>
- Point: <...>

## Visual System
<house style, plus any deviation: density, diagram-vs-text, accent>

## Output
<a Claude Design canvas via the `design` skill — N artboards, one per slide, 16:9>

## Constraints
1. <constraint>
2. <constraint>

## Tone
<optional — voice of the slide copy>

## Examples
<optional — reference decks or screenshots the user supplied>
````

### Section rules

- **Goal** — required, one line. What the deck has to accomplish, not what
  it is about.
- **Context** — required. Why this deck exists and what prompted it. Scale
  the length to the size of the deck; no filler.
- **Audience & Takeaway** — required. Name the audience from **engineers**,
  **product**, **business**, **sales** (more than one is fine). State what
  they already know — this is what stops the deck re-explaining basics or
  skipping them. Then state the one thing they should leave with. One
  takeaway, not three.
- **Narrative Arc** — required. The story beats in order, before any slide
  exists. A few lines: where it starts, what turns, where it lands. If the
  arc doesn't hold up here, no amount of slide polish saves it.
- **Slide-by-Slide** — required, written at **title-plus-one-point depth**.
  Every slide gets a title and the single claim it makes. Nothing more. The
  body content and the visual treatment are the design run's job — this
  prompt is not a full deck script. If a slide needs two points, it is two
  slides.
- **Visual System** — required, but usually one line. The house style below
  is the default. Only write more when the user wants to deviate.
- **Output** — required. Always names Claude Design explicitly, with the
  canvas specifics, so whoever executes the prompt knows what to invoke:
  > A Claude Design canvas via the `design` skill — one canvas, N artboards
  > (one per slide), 16:9.

  Fill in `N` with the real slide count from Slide-by-Slide.
- **Constraints** — numbered list. Only real constraints — a slide cap, a
  hard deadline, a fact that must appear, something that must not. Never
  invent one.
- **Tone** — optional. The voice of the slide copy. Include only when it
  actually matters for this deck. If it applies and the user hasn't stated
  one, default to "direct, clear, avoiding jargon, explaining like a teacher
  addressing a beginner."
- **Examples** — optional. Include only when the user actually supplies
  reference decks or screenshots. Never fabricate one.

Omit an inapplicable optional section entirely — no empty headings.

## The house visual style

The skill carries the style. Don't interrogate the user about visuals.

- Dark ground.
- Generous whitespace.
- One idea per slide.
- Diagrams over bullet lists.
- A dark/neon purple accent.

Write that into `Visual System` as the default. Ask about visuals **only**
when the user signals they want something different — a brand palette, a
light deck, a denser layout. Then record the deviation on top of the house
style rather than replacing the whole thing.

## Flow

1. **Read the request.** Map whatever it already states onto Goal, Context,
   Audience & Takeaway, Narrative Arc, Slide-by-Slide, Visual System,
   Output, Constraints, Tone, Examples.
2. **Assess the gaps:**
   - Goal unclear or missing → gap.
   - Context too thin for how big the deck sounds → gap.
   - Audience unnamed, or the single takeaway unstated → gap. This is the
     most common one, and the most expensive to get wrong.
   - No sense of the story order → gap in Narrative Arc.
   - Slides unlisted, or listed as topics with no claim attached → gap.
   - The deck clearly has real constraints (a slide cap, a time slot) but
     none are stated → gap.
   - Visual System is a gap only when the user wants to deviate from the
     house style and hasn't said how.
   - Tone and Examples are never gaps.
3. **Map the gap size to a `msg-grill-me` effort level:**
   - No real gaps → skip the grill; draft directly.
   - A little missing (e.g. the arc is implied, everything else clear) →
     `low` effort.
   - A lot missing (audience unknown, no takeaway, no slide list) → `high`
     effort.
   - Verbosity is always `med` — fixed, not inferred.
4. **Invoke `msg-grill-me`** at the effort level from step 3 and `med`
   verbosity, stating both explicitly. Point it at exactly the missing
   template fields as the branches to walk — not a generic plan grill.
5. **Assemble the prompt** from the original request plus the grill's
   answers, following the template and section rules above. Every prompt
   gets the `Status`/`Rating` block, set to `not executed` / `—`.
6. **Name and number the file.** Prompt files live under `docs/prompts/`
   (create the directory if it doesn't exist) and are named
   `NN-<kebab-slug-of-the-goal>.md`. `NN` is the zero-padded, project-wide
   sequence shared with `msg-write-prompt` — one counter for both skills.
   Scan existing filenames for the highest `NN` prefix (ignore unnumbered
   legacy files) and increment by one. Numbers are permanent: never reuse or
   renumber an existing file.
7. **Write the file.** Never overwrite an existing prompt. Tell the user the
   path. Don't also paste the full contents into chat.

## Executing a written prompt

Whatever invokes/runs a prompt file (an agent, a skill, or the user pasting
it in) checks its Status block first:

- If `Status` already says `executed on <date>`, say so before proceeding —
  don't silently re-run without mention.
- **Before building anything, create a new branch dedicated to this prompt's
  session.** Check first whether the repo already states its own
  branching/VCS convention (a project CLAUDE.md, a VCS skill like
  GitButler's, or similar) and follow it — naming, tool, everything. Only
  when nothing says otherwise, default to: GitButler (`but`) if it's set up
  in the repo, else a plain `git checkout -b`. Do not skip creating a branch
  regardless of which path applies.
- Build the deck with the `design` skill: one canvas, one artboard per
  slide, 16:9.
- Once the deck is actually done — this is the last step of execution, not
  an afterthought the surrounding conversation can crowd out — update
  `Status` to `executed on <today's date>` and **always** ask the user one
  quick question — how well the prompt performed, `0`–`10` — before
  considering the prompt's execution finished. Do not end the turn without
  having asked. Write the answer into `Rating`. If the user volunteers a
  reason (unprompted or in answer to a follow-up), append it after an em
  dash: `**Rating:** 3 — the arc didn't survive contact with the audience`.
  Don't press for a reason if the user gives a bare number; the field stays
  `N` with no dash.

## How to talk

Short sentences, plain words. Lead with the point. No recapping what the
user just said, no praise, no filler.
