# Goal: Update `msg-pre-roadmap` so its research findings flow into the roadmap item's Technical References section

**Status:** executed on 2026-08-31
**Rating:** —
**Run:** sequential after 19 — it references the item's new section names.
Parallel with 20, 21, 22, 23 and 24: this stage touches one file nobody else
touches. It is the smallest stage; do not pad it.

## Context

`templates/skills/msg-pre-roadmap/SKILL.md` is the phase before planning. It
takes a feature name, brainstorms it, grills the gaps, **optionally** spawns a
research subagent, and ends by writing user needs and functional requirements
into `docs/requirements.md`. Then it hands off: it tells the user that
`msg-roadmap-plan-item` is the next step, and stops.

The research step (flow step 4) is where the problem is. A subagent goes and
finds out what frameworks, libraries, practices and pitfalls apply to this kind
of feature, reports a summary — and then that summary has nowhere to go. The
requirements table has no column for it. The next phase starts fresh.

Prompt 19 gave the roadmap item a `### Technical References` section defined as
*research only*: the findings that will actually be applied, each explained in
direct, concise terms, no link dump. That is the destination this research was
always missing. This prompt connects the two.

The change is small and confined to one file. Read that file and the rewritten
`templates/skills/msg-roadmap-plan-item/SKILL.md` first, so the section name and
its rules are quoted correctly rather than approximated.

## Constraints

1. **Say where the research goes, in flow step 4.** When the user opts into
   research, the subagent's summary is not just reported in conversation — it is
   the raw material for the roadmap item's `### Technical References` section,
   which `msg-roadmap-plan-item` writes in the next phase. State that in the step
   itself, so the agent knows the output has a destination and shapes it
   accordingly.

2. **Shape the report for that destination.** Tell the subagent (in the
   instructions this skill gives it) to report findings that are *applicable*,
   each with a one-or-two-line explanation of what it means for this feature.
   Not a bibliography, not a list of links, not a survey of everything found. The
   plan-item section's own rule is "the findings that will actually be applied,
   explained in direct, concise terms" — mirror that wording so the two skills
   agree.

3. **Carry it across the handoff, in flow step 6.** The hand-off step currently
   says the feature has requirements recorded and `msg-roadmap-plan-item` is
   next. Add: if research ran, say so and name what it found, so the user can
   hand those findings to plan-item — and note that plan-item's Technical
   References section is where they land. Keep the existing rule that this skill
   does **not** invoke plan-item; the user decides when to move on.

4. **Do not change the requirements table.** The columns, the `UN.<n>` /
   `FR.<un>.<seq>` numbering scoped to the module, the append-only rule, and the
   module question in step 1 all stay exactly as they are. Research findings do
   not become requirement rows.

5. **Do not change the gate.** `msg-roadmap-plan-item` stops on a feature with no
   matching row in the requirements file. That gate is untouched by this refactor
   and untouched by this prompt.

6. **Keep the subagent as it is otherwise.** One pass, `WebSearch`/`WebFetch`, no
   back-and-forth with the user, not built as a reusable agent, and genuinely
   optional — never default to yes without the user picking it. Prompt 19 models
   the new web investigator on this same shape, so leave the shape recognisable.

7. **Stay inside this stage.** Only
   `templates/skills/msg-pre-roadmap/SKILL.md`. Nothing else.

## Tone

Direct, clear, avoiding jargon, explaining like a teacher addressing a beginner
who is lazy to read.

## Output

One edited skill file, `templates/skills/msg-pre-roadmap/SKILL.md`. No new files.
