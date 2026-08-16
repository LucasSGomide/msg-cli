# Goal: Gate `msg-roadmap-plan-item` on the feature having requirements recorded

**Status:** not executed
**Rating:** —
**Run:** sequential — depends on 01, 03

## Context

`msg-roadmap-plan-item` (`.claude/skills/msg-roadmap-plan-item/SKILL.md`) grills
an idea into a roadmap doc, exploration, or ditched record. We're adding a
precondition: before it starts its own grill, it must check whether the feature
being planned already has rows in `docs/requirements.md` (the file named by
`requirementsFile` in `project.yml`, added in
`docs/prompts/01-requirements-manifest-scaffolding.md`).

If the feature has no rows there, `msg-roadmap-plan-item` **refuses and points
at `msg-pre-roadmap`** (`docs/prompts/03-msg-pre-roadmap-skill.md`), scoped to
that feature — it does not run the pre-roadmap flow itself, and it does not ask
the user whether to proceed without requirements. This was chosen specifically
to keep `msg-roadmap-plan-item` simple and keep "gather requirements" as one
flow's job, not two.

This check is **per feature**, not per-project and not one-time: the
`requirements.md` table's `Feature` column and per-feature `UN`/`FR` numbering
(prompt 1) exist precisely so a feature planned a year after the project's first
roadmap item still gets its own gate-check.

This is **prompt 4 of 4**, depends on prompt 1 (the file and its format must
exist) and prompt 3 (the skill it points users at must exist to be named
correctly).

## Constraints

1. Edit `.claude/skills/msg-roadmap-plan-item/SKILL.md`'s Flow section: insert
   the requirements check as a new early step, after the "Read `project.yml`
   first" step and before the ditched-check step (step 2 in the current
   numbering) — planning shouldn't proceed past this gate even to check ditched
   items.
2. The check reads `docs/requirements.md` (or whatever `requirementsFile`
   names) and looks for any row whose `Feature` column matches the idea/feature
   name the user gave. Matching is name-based, not fuzzy — if it's ambiguous
   how "matches" should work (exact string vs. case-insensitive vs. asking the
   user to confirm), resolve that ambiguity in the skill doc rather than leaving
   it implicit.
3. If no matching rows exist: stop, tell the user to run
   `/msg-pre-roadmap <feature name>` first, and do not proceed to the grill.
   Do not offer a "continue anyway" option — this is a hard stop, not a
   surfaced-conflict-and-let-the-user-decide case (unlike the ditched-check
   step, which explicitly is soft).
4. If matching rows exist: proceed as today, with no other behavior change to
   the rest of the skill.
5. Apply the identical edit to the `templates/skills/msg-roadmap-plan-item/`
   mirror, keeping both copies in sync (same rule the other three prompts
   follow for their new skills).
6. Do not touch `msg-roadmap-task-breakdown` or `msg-roadmap-task-review` — the
   gate belongs at the point a roadmap item is created, not at later stages.

## Output

An edit to `.claude/skills/msg-roadmap-plan-item/SKILL.md` and its
`templates/skills/msg-roadmap-plan-item/SKILL.md` mirror. No CLI/manifest code
changes.
