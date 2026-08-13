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
2. **Assess the gaps:**
   - Goal unclear or missing → gap.
   - Context too thin for how ambitious the task sounds → gap.
   - The task clearly has real constraints but none are stated → gap.
   - Tone and Output are gaps only when the prompt genuinely needs them
     (Tone when the output is a document; Output when the format is
     genuinely ambiguous) — never force them.
   - Examples are never a gap.
3. **Map the gap size to a `msg-grill-me` effort level:**
   - No real gaps → skip the grill; draft directly.
   - A little missing (e.g. Context thin, everything else clear) → `low`
     effort.
   - A lot missing (Goal vague, Context absent, Constraints unstated) →
     `high` effort.
   - Verbosity is always `med` — fixed, not inferred.
4. **Invoke `msg-grill-me`** at the effort level from step 3 and `med`
   verbosity, stating both explicitly. Point it at exactly the missing
   template fields as the branches to walk — not a generic plan grill.
5. **Assemble the prompt** from the original request plus the grill's
   answers, following the template and section rules above.
6. **Write it to a file** under `docs/prompts/`, named
   `<kebab-slug-of-the-goal>.md` (create the directory if it doesn't exist).
   If that slug is already taken, append `-2`, `-3`, etc. — never overwrite
   an existing prompt. Tell the user the path. Don't also paste the full
   contents into chat.

## How to talk

Short sentences, plain words. Lead with the point. No recapping what the
user just said, no praise, no filler.
