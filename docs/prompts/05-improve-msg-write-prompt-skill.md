# Goal: Add naming/ordering, execution tracking, and scope-breakdown to `msg-write-prompt`

**Status:** executed on 2026-08-16
**Rating:** 10

## Context

`msg-write-prompt` (`.claude/skills/msg-write-prompt/SKILL.md`, mirrored at
`templates/skills/msg-write-prompt/SKILL.md`) writes prompt files under
`docs/prompts/`. Today it only names files `<kebab-slug-of-the-goal>.md`, with
no numbering, no way to tell if a prompt was ever run, and no way to record how
well it performed. The existing `docs/prompts/01-`, `02-`, `03-`, `04-` files
already number themselves in build order and describe dependencies in prose
(see their "This is prompt N of 4, depends on prompt M" paragraphs), but that
convention isn't written down in the skill itself, and there's nothing tracking
whether a prompt was executed or how it went.

This prompt makes that convention explicit and adds three related pieces of
state to every prompt file: an order number in the filename, an
execution/rating block the skill checks and fills in, and — for a request that
actually spans unrelated concerns — a split into multiple ordered prompts each
tagged parallel or sequential, so GitButler can run independent ones on
separate branches at once.

## Constraints

1. **Naming standard.** Prompt files are named `NN-<kebab-slug-of-the-goal>.md`,
   where `NN` is a zero-padded, project-wide sequence number (`01`, `02`, …),
   not per-topic. `NN` is the next unused number across all of `docs/prompts/`
   — scan existing filenames for the highest `NN` prefix (ignoring any
   unnumbered legacy files like `init-skills-only-shape.md`) and increment by
   one. Never reuse or renumber an existing file's number, same permanence rule
   the roadmap docs already follow for their own IDs.
2. **Status block.** Every prompt file gets a small metadata block right after
   the `# Goal:` line, before `## Context`:
   ```markdown
   **Status:** not executed
   **Rating:** —
   ```
   `Status` is either `not executed` or `executed on YYYY-MM-DD`. `Rating` is
   either `—` or an integer `0`–`10` set after execution. Both fields live in
   the prompt file itself, not in a separate log.
3. **Execution check-in.** Whatever invokes/runs a prompt file (an agent, a
   skill, or the user pasting it in) is responsible for checking this block
   first: if `Status` already says `executed on <date>`, say so before
   proceeding — don't silently re-run without mention. After the work the
   prompt describes is actually done, update `Status` to `executed on
   <today's date>` and ask the user in one quick question (0–10) how well the
   prompt performed, then write that number into `Rating`. Add this as an
   explicit step in `msg-write-prompt`'s own doc so it isn't left implicit —
   even though the check/update happens at execution time, not write time, the
   convention has to be documented where prompts are created.
4. **Scope-breakdown detection.** Before assembling a prompt, `msg-write-prompt`
   must check whether the request actually spans more than one independent
   concern (e.g. "fix a skill, update the CLI, add an agent, and create a new
   skill" — four unrelated deliverables) versus one cohesive change with
   several related parts (like this prompt's own six related edits to one
   skill file, which stay as a single prompt). If it's genuinely multiple
   concerns, tell the user it should be split and propose the split — number of
   prompts and a one-line goal for each — rather than writing one oversized
   prompt.
5. **Parallel/sequential tagging.** When a single invocation produces more than
   one prompt file, add a line to each file's Status block:
   ```markdown
   **Run:** parallel with 02, 03 — no shared files
   ```
   or
   ```markdown
   **Run:** sequential — depends on 01
   ```
   Base the call on whether the prompts touch overlapping files/state (existing
   prose like "This is prompt 2 of 4, depends on prompt 1" in `docs/prompts/02-`
   through `04-` is the kind of reasoning this field makes structured instead of
   free text). This field exists so GitButler can put independent prompts on
   separate branches worked in parallel, and keep dependent ones sequential on
   the same stack.
6. Update both `.claude/skills/msg-write-prompt/SKILL.md` and its
   `templates/skills/msg-write-prompt/SKILL.md` mirror identically — every
   existing skill keeps both copies in sync.
7. Do not change the existing Goal/Context/Constraints/Tone/Output/Examples
   template sections or the gap-assessment/grill-effort logic in the current
   Flow — this prompt only adds the naming/status/split behavior around that
   template, not inside it.

## Output

Edits to `.claude/skills/msg-write-prompt/SKILL.md` and
`templates/skills/msg-write-prompt/SKILL.md`: an updated Template section
showing the Status block, an updated file-naming step in Flow (item 6 today),
and new Flow steps for the execution check-in and the scope-breakdown/split
decision. No other skills or CLI code change.
