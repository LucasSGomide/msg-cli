# Goal: Strip the copied artifacts out of task files — the breakdown links the roadmap item folder instead, and the review skill audits against it

**Status:** executed on 2026-08-31
**Rating:** —
**Run:** sequential after 19 — the task file's `## References` must point at a
folder layout that already exists. Parallel with 20, 23 and 25: no shared files.
**Not** parallel with 22: both edit
`templates/skills/msg-roadmap-task-breakdown/SKILL.md`, in disjoint sections (22
owns only its `## Acceptance: the boxes and the test script` section). Run this
one first, then 22 on top of it.

## Context

A task file is the whole brief for one shippable slice. Today that brief carries
copies: a `## Wireframes` section drawn by `msg-wireframes`, a
`## Sequence diagrams` section drawn by `msg-sequence-diagrams`, and a pointer to
a `docs/tasks/<item>/openapi.json` written by `msg-api-contracts`. All three are
produced during breakdown, and all three die when the task folder is retired.

Prompt 19 made the roadmap item a folder that holds those artifacts permanently,
and prompt 20 retargeted the three skills to write there. So the task file stops
carrying copies and starts carrying links. That is the whole change here, plus
the audit skill that checks breakdowns has to be taught the same thing.

Two files, both large, both to be read end to end before editing:

- `templates/skills/msg-roadmap-task-breakdown/SKILL.md` (369 lines)
- `templates/skills/msg-roadmap-task-review/SKILL.md` (177 lines)

What does **not** change: the slicing rules, the acceptance criteria rules, the
numbering rules, the write barrier on ticked checkboxes, and the task `## Context`
prose rules that prompt 17 introduced. Leave all of it alone.

## Constraints

1. **Remove `## Wireframes` and `## Sequence diagrams` from the task file.**
   Delete both from the `### Template` block and from the `**Sections**` list
   that describes each section. Delete the per-task `openapi.json` too: step 7's
   sentence about what the folder ends up holding currently names
   `openapi.json`, and it no longer does.

2. **Delete flow steps 8, 9 and 10.** Those are the three "invoke
   `/msg-wireframes` / `/msg-api-contracts` / `/msg-sequence-diagrams`" steps.
   The breakdown no longer invokes any artifact skill — they all ran during
   planning. Renumber the remaining steps so the flow still reads 1..N, and keep
   step 11 (`Run /msg-roadmap-sync`) as the last step.

3. **`## References` becomes the link section.** Every task file carries it, and
   it links the roadmap item folder's artifacts with relative paths that work
   from the task file's location (`docs/tasks/NN-slug/MM-slice.md` →
   `../../roadmap/NN-slug/...`). Spell the paths out in the template so nobody
   guesses:

   ```markdown
   ## References

   - [Roadmap item](../../roadmap/NN-slug/README.md) — the full picture
   - [`openapi.json`](../../roadmap/NN-slug/openapi.json) — the item's contract
   - [Sequence diagrams](../../roadmap/NN-slug/sequence-diagrams.md)
   - [Wireframes](../../roadmap/NN-slug/wireframes/) — screens this slice renders
   - the rule docs the slice's Scope implies
   ```

   Only link artifacts that exist: a back-end-only item has no `wireframes/`, a
   UI-only item has no `openapi.json`.

4. **No per-task narrowing of wireframes or diagrams.** This is a real change of
   philosophy and it needs saying out loud in the skill. Today the breakdown
   narrows the parent's material down into each slice. For wireframes and
   sequence diagrams it stops doing that: the artifacts describe the whole item,
   every slice links the same files, and the slice's own sections say which part
   of them it builds. Do not invent a "which wireframe belongs to which slice"
   mechanism.

5. **`## User experience` and `## Technical details` stay per-slice.** They are
   still narrowed from the parent, still required by Scope in the same way, still
   bullets. The parent's shape changed underneath them, though: Technical Details
   in the item is now prose under `### Back-end` and `### Front-end`, not a
   numbered list. Update the wording that tells the agent where to copy from —
   "copied from the parent's bullets" is no longer literally true. The task file's
   own sections stay bullets with `**Area**` prefixes drawn from `areas` in
   `project.yml`.

6. **Rewrite `## Is the item ready?`.** Five tests today. Test 3 cites Key Areas,
   which prompt 19 deleted; rewrite it against the item's Back-end/Front-end
   prose citing its rule docs, and against any reused pattern citing a numbered
   design rule. **Keep the literal strings "traceable to a" and "concrete action
   on a concrete thing"** — `test/unit/skills.test.ts` asserts both appear in this
   skill and in `msg-roadmap-plan-item`, and prompt 19 keeps them there too.
   Also keep the heading `## Is the item ready?` verbatim; the same test asserts
   it.

7. **Replace the "older item" paragraph.** The skill has a paragraph about an
   item written before Key Areas existed. Replace it with the real legacy case
   now: an item still in the **old single-file shape**
   (`docs/roadmap/NN-slug.md`, no folder). The breakdown stops and tells the user
   to run the migration command — prompt 24 adds it, and its exact name is
   `msg migrate-roadmap`. Do not invent a second migration path here.

8. **Fix flow step 5, the UX backfill.** It currently triggers on "a
   `**Front-end**` bullet in Key Areas and no `## User Experience:` section".
   Key Areas is gone. Trigger it instead on: the item's Technical Details has a
   `### Front-end` half and the item's `README.md` has no `## User Experience`
   section. The fix is still to grill briefly and write the section onto the
   item's `README.md`, not onto a task file.

9. **`msg-roadmap-task-review`: audit against the folder.** Same idea, applied to
   the audit skill:
   - `## What is read` — item 1 becomes the item folder's `README.md`; item 3
     becomes the item folder's `openapi.json`, `sequence-diagrams.md` and
     `wireframes/`, when they exist.
   - Gap class 1 (Fidelity): the "walk every parent **Key Areas** bullet" bullet
     is rewritten against the Back-end/Front-end prose — every area the item's
     prose describes must be carried by some task's `Scope`. The bullets about a
     task lacking a `## Sequence diagrams` section, carrying one it should not,
     or having no path in the folder's `openapi.json` are rewritten as gaps
     against the **item folder's** artifacts: an endpoint the item's tasks
     implement with no path in `docs/roadmap/NN-slug/openapi.json`, a new route
     with no block in `sequence-diagrams.md`. The fix is to run the artifact
     skill against the item, not against a task.
   - Gap class 2 (User experience): the "no `## Wireframes` section" and "a
     `back-end` task carrying a `## Wireframes` section" bullets go. In their
     place: a screen the item's User Experience describes with no file under
     `wireframes/` is a gap, and a task that renders a screen but whose
     `## References` does not link the wireframes folder is a gap.
   - The write barrier on ticked checkboxes stays exactly as it is.
   - The sample report block near the end names `Wireframes section` and
     `Sequence diagrams section` gaps; update those lines to the new wording so
     the example matches the rules above it.

10. **Update both frontmatter descriptions** if the change makes them wrong.
    Task breakdown still breaks an item into task files, so it probably survives;
    task review's mentions of what it reads may need a word.

11. **Do not touch the test-script material yet.** Both skills talk about
    `docs/tasks/<item>/test-script.md`. Prompt 22 moves that file into the
    roadmap item folder and owns every sentence about it, including the ones in
    `msg-roadmap-task-breakdown`'s `## Acceptance: the boxes and the test script`
    section. Leave those paragraphs byte-identical here, even though you know
    they are about to change. Two prompts editing one paragraph is the conflict
    the staging exists to avoid.

12. **Stay inside this stage.** Only
    `templates/skills/msg-roadmap-task-breakdown/SKILL.md` and
    `templates/skills/msg-roadmap-task-review/SKILL.md`. Not the artifact skills,
    not the sync skill, not the engine, not the hooks, not `templates/project/`,
    not fixtures, not `src/`.

## Tone

Direct, clear, avoiding jargon, explaining like a teacher addressing a beginner
who is lazy to read.

## Output

Two edited skill files under `templates/skills/`. No new files. Run the test
suite before finishing — `test/unit/skills.test.ts` asserts the readiness-bar
strings and the `## Is the item ready?` heading this prompt must preserve.
