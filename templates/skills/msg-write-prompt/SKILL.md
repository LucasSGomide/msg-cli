---
name: msg-write-prompt
description: Structure a prompt as a Goal/Context/Constraints/Tone/Output/Examples markdown block, filling it from what the user already said and grilling only for what's missing. Use when the user asks to generate, write, or structure a prompt for a task.
---

# Write a structured prompt

Turn what the user already said into a structured prompt, and interview them
only for the parts they didn't cover. The prompt is the deliverable — write
it, don't summarize it.

## Template

```markdown
# Goal: <short descriptive text — the prompt's main goal>

**Status:** not executed
**Rating:** —

## Context
<descriptive text, more detail on what the user wants to achieve>

## Constraints
1. <constraint>
2. <constraint>

## Tone
<optional — only when the intended output is text/a document>

## Output
<optional — the format the prompt should produce: code, a script in another
language, an MD file, etc.>

## Examples
<optional — examples the user provides for the goal>
```

- **Goal** — required, one line, imperative/descriptive.
- **Context** — required. No fixed length; scale it to how bold the task
  is. A small task gets 1–2 sentences; an ambitious one gets a fuller
  paragraph. Still no filler.
- **Constraints** — numbered list. Only written when real constraints exist
  or are elicited. Never invent one.
- **Tone** — optional. Include only when the intended output is text or a
  document. If it applies and the user hasn't stated one, default to
  "direct, clear, avoiding jargon, explaining like a teacher addressing a
  beginner."
- **Output** — optional. Include only when the deliverable format isn't
  already obvious from Goal and Context.
- **Examples** — optional. Include only when the user actually supplies
  examples. Never fabricate one.

Omit an inapplicable optional section entirely — no empty headings.

## Flow

1. **Read the request.** Map whatever it already states onto Goal, Context,
   Constraints, Tone, Output, Examples.
2. **Check the scope.** Decide whether the request is one cohesive change
   (several related parts of a single deliverable) or genuinely spans more
   than one independent concern (e.g. "fix a skill, update the CLI, add an
   agent, and create a new skill" — four unrelated deliverables). If it's
   genuinely multiple concerns, stop drafting and tell the user it should be
   split: propose the number of prompts and a one-line goal for each, and
   confirm before writing anything. If it's one cohesive change, continue.
3. **Assess the gaps:**
   - Goal unclear or missing → gap.
   - Context too thin for how ambitious the task sounds → gap.
   - The task clearly has real constraints but none are stated → gap.
   - Tone and Output are gaps only when the prompt genuinely needs them
     (Tone when the output is a document; Output when the format is
     genuinely ambiguous) — never force them.
   - Examples are never a gap.
4. **Map the gap size to a `msg-grill-me` effort level:**
   - No real gaps → skip the grill; draft directly.
   - A little missing (e.g. Context thin, everything else clear) → `low`
     effort.
   - A lot missing (Goal vague, Context absent, Constraints unstated) →
     `high` effort.
   - Verbosity is always `med` — fixed, not inferred.
5. **Invoke `msg-grill-me`** at the effort level from step 4 and `med`
   verbosity, stating both explicitly. Point it at exactly the missing
   template fields as the branches to walk — not a generic plan grill.
6. **Assemble the prompt(s)** from the original request plus the grill's
   answers, following the template and section rules above. Every prompt
   gets the `Status`/`Rating` block from the template, set to `not executed`
   / `—`.
7. **Name and number each file.** Prompt files live under `docs/prompts/`
   (create the directory if it doesn't exist) and are named
   `NN-<kebab-slug-of-the-goal>.md`, where `NN` is a zero-padded,
   project-wide sequence number — scan existing filenames for the highest
   `NN` prefix (ignore unnumbered legacy files) and increment by one per new
   prompt. Numbers are permanent: never reuse or renumber an existing file.
8. **Tag multi-prompt runs.** If step 2 produced more than one prompt, add a
   `**Run:**` line to each file's Status block stating whether it can run in
   parallel with its siblings or must run sequentially, e.g.:
   ```markdown
   **Run:** parallel with 02, 03 — no shared files
   ```
   or
   ```markdown
   **Run:** sequential — depends on 01
   ```
   Base the call on whether the prompts touch overlapping files/state. This
   lets GitButler put independent prompts on separate branches worked in
   parallel, and keep dependent ones sequential on the same stack. Omit this
   line for a single-prompt run.
9. **Write the file(s).** Never overwrite an existing prompt. Tell the user
   the path(s). Don't also paste the full contents into chat.

## Executing a written prompt

Whatever invokes/runs a prompt file (an agent, a skill, or the user pasting
it in) checks its Status block first:

- If `Status` already says `executed on <date>`, say so before proceeding —
  don't silently re-run without mention.
- **Before writing any code, create a new branch dedicated to this prompt's
  session.** Check first whether the repo already states its own
  branching/VCS convention (a project CLAUDE.md, a VCS skill like
  GitButler's, or similar) and follow it — naming, tool, everything. Only
  when nothing says otherwise, default to: GitButler (`but`) if it's set up
  in the repo, else a plain `git checkout -b`. Do not skip creating a branch
  regardless of which path applies.
- Once the work the prompt describes is actually done — this is the last
  step of execution, not an afterthought the surrounding conversation can
  crowd out — update `Status` to `executed on <today's date>` and **always**
  ask the user one quick question — how well the prompt performed, `0`–`10`
  — before considering the prompt's execution finished. Do not end the turn
  without having asked. Write the answer into `Rating`. If the user
  volunteers a reason (unprompted or in answer to a follow-up), append it
  after an em dash: `**Rating:** 3 — missed the edge case around X`. Don't
  press for a reason if the user gives a bare number; the field stays `N`
  with no dash.

## How to talk

Short sentences, plain words. Lead with the point. No recapping what the
user just said, no praise, no filler.
