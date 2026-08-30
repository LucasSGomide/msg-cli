# Goal: Build the `msg-docs-audit` skill that checks rule docs against their guidelines block and interviews the user to fix what it finds

**Status:** not executed
**Rating:** —
**Run:** sequential — depends on 08

## Context

Prompt 08 gives every rule doc a guidelines block stating the template, the
required sections and the voice that doc must follow. Nothing checks that the
doc still obeys it. Docs drift: a section quietly disappears, a rule is added
in a different shape, two docs end up asserting opposite things, a rule points
at a file or a decision that no longer exists.

`msg-docs-audit` is the check. It reads a doc's own guidelines block as the
spec, reports where the doc has drifted from it, reads the docs together to
find rules that contradict each other or dangle, then walks the user through
the findings one at a time and writes the agreed fixes. The point is
documentation that stays stable: no contradictions, no loose ends, every doc
still in the shape it declared.

## Constraints

1. New skill `msg-docs-audit` under `templates/skills/`, with its own
   `SKILL.md`, sibling to the `msg-roadmap-*` family.
2. It ships with every scaffold: added to `SKILLS` in `src/core/templates.ts`.
   It is **not** added to `PORTABLE_SKILLS` — it reads `docs/` and the area
   docs `project.yml` points at, so it depends on the project shape.
3. Target: a single named doc, or all of them. Both are invocations of the
   same skill.
4. Two kinds of finding, both in scope:
   - **Template drift** — the doc against its own guidelines block: missing or
     renamed required sections, rules written in the wrong shape, a rule with
     no why, gotchas not in symptom/rule form, renumbering where the block
     says append.
   - **Contradictions and loose ends** — across docs and within one: two rules
     that cannot both hold, a rule referring to a file, command or decision
     that no longer exists, a cross-doc link pointing at a section that is
     gone.
5. It **interviews** rather than rewriting silently: report the findings
   first, then take them one at a time with `AskUserQuestion`, offering the
   options for resolving each. A finding the user rejects is dropped, not
   re-argued.
6. It **applies** the agreed fixes to the docs after approval. It never edits
   a doc's guidelines block to make a finding go away — the block is the
   contract; if the block itself is wrong, that is a finding to raise, and
   changing it is an explicit decision by the user.
7. It reads the guidelines block from the doc being audited, not from a copy
   held inside the skill — a project that has edited its own block must be
   audited against what it now says.
8. Keep `test/unit/skills.test.ts` passing: the skills list and the
   `templates/skills/` folders must stay set-equal.
9. Update the README and `src/usage.ts` to list the new skill alongside the
   others.

## Tone

`SKILL.md` follows the voice of the existing `msg-*` skills: short sentences,
plain words, imperative instructions to the agent running it, no preamble.
Findings reported to the user are factual and specific — name the doc, the
section and what the block requires — never scolding.

## Output

A new `templates/skills/msg-docs-audit/SKILL.md`, a one-line addition to
`SKILLS` in `src/core/templates.ts`, and README/usage updates.
