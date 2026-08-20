# Goal: Create a `msg-write-prompt-slides` skill that structures prompts for slide decks built with Claude Design

**Status:** executed on 2026-08-20
**Rating:** 7

## Context

`msg-write-prompt` turns a request into a Goal/Context/Constraints/Tone/Output/Examples
prompt file. That template is shaped for code and documents, not for decks. A deck
prompt has to carry things the general template has no place for: who is in the room,
the story order, what each slide claims, and how it should look.

`msg-write-prompt-slides` is a sibling skill for exactly that. It writes prompts whose
deliverable is a slide deck, built with the `design` skill's canvas (one artboard per
slide). The decks it covers are technical and product explainers, and status/review
decks — a system, a feature, or what changed since last time. Audience shifts per deck
across engineers, product, business, and sales, so the skill captures it every time
rather than assuming.

It keeps the same working discipline as its sibling — the Status/Rating block, the
grill-only-for-what's-missing flow, the branch-first execution rule, the 0–10 rating
when the work lands — but replaces the template with a slide-native one.

## Constraints

1. Skill lives at `.claude/skills/msg-write-prompt-slides/SKILL.md`, with `name:` and
   `description:` frontmatter following the conventions of the other `msg-*` skills in
   this repo.
2. The prompt template is slide-native, not the six-section template with extra headings
   bolted on. Section order: Goal, Status/Rating block, Context, Audience & Takeaway,
   Narrative Arc, Slide-by-Slide, Visual System, Output, Constraints, Tone (optional),
   Examples (optional). See **Examples** below for the exact shape.
3. `Slide-by-Slide` is written at title-plus-one-point depth: every slide gets a title and
   the single claim it makes. Content and visual treatment are left for the design run to
   fill in — the prompt is not a full deck script.
4. `Audience & Takeaway` names the audience from engineers, product, business, or sales
   (more than one is allowed), states what they already know, and states the one thing
   they should leave with.
5. `Visual System` defaults to a house style the skill carries, not a per-deck
   interrogation: dark ground, generous whitespace, one idea per slide, diagrams over
   bullet lists, with a dark/neon purple accent. The skill only asks about visuals when
   the user wants to deviate from the house style.
6. `Output` names Claude Design explicitly, with canvas specifics — the `design` skill,
   one canvas, N artboards (one per slide), 16:9 — so whoever executes the prompt knows
   exactly what to invoke.
7. Tone and Examples are optional sections, included only when they apply, and omitted
   entirely (no empty headings) when they don't — same rule as the sibling skill.
8. Prompt files go in `docs/prompts/` using the existing project-wide `NN-<kebab-slug>.md`
   sequence, shared with `msg-write-prompt`. One counter, never reused, never renumbered.
9. The skill reuses the sibling's flow: read the request, map it onto the template, assess
   gaps, invoke `msg-grill-me` at an effort level matched to the gap size with `med`
   verbosity pointed at the missing fields, then assemble and write the file. Skip the
   grill when nothing real is missing.
10. The skill carries the full "Executing a written prompt" section: check Status before
    running, create a session branch before building anything (following this repo's
    GitButler convention), set `Status` to `executed on <date>` when the deck is done, and
    always ask the 0–10 rating before finishing the turn.
11. Never overwrite an existing prompt file. Report the path; don't paste the file contents
    back into chat.
12. Do not modify `msg-write-prompt`. This is a new, standalone sibling.

## Tone

Direct, clear, avoiding jargon, explaining like a teacher addressing a beginner —
matching the voice of the existing `msg-*` skills.

## Output

A single new skill directory containing `SKILL.md`.

## Examples

The prompt template the skill must produce:

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
