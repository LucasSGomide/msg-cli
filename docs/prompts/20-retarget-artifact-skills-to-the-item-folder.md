# Goal: Point `msg-wireframes`, `msg-sequence-diagrams` and `msg-api-contracts` at the roadmap item folder instead of the task file, and make wireframes simpler

**Status:** executed on 2026-08-31
**Rating:** —
**Run:** sequential after 19 — the folder shape has to exist before these three
skills can write into it. Parallel with 21, 22, 23 and 25: no shared files.

## Context

Three skills draw the technical documentation for a piece of work:

- `templates/skills/msg-wireframes/SKILL.md` — ASCII screens.
- `templates/skills/msg-sequence-diagrams/SKILL.md` — mermaid `sequenceDiagram`
  blocks for new API routes.
- `templates/skills/msg-api-contracts/SKILL.md` — an OpenAPI `openapi.json`.

All three run today during **task breakdown**, and all three write into the
**task folder**: the first two into a section of a task file (`## Wireframes`,
`## Sequence diagrams`), the third into `docs/tasks/<item>/openapi.json`. When
the branch ships, the task folder is deleted and all of it goes with it.

Prompt 19 moved a roadmap item from a single file to a folder,
`docs/roadmap/NN-slug/`, and made `msg-roadmap-plan-item` invoke these three
skills at **planning** time. This prompt retargets them so they write into that
folder, where the work survives forever. Read the three skills end to end first,
and read the rewritten `msg-roadmap-plan-item` so your invocation contracts
match what it actually calls.

Nothing about *how well* these skills draw changes, except for wireframes, which
get deliberately simpler.

## Constraints

1. **New write targets.** Each skill reads the item's
   `docs/roadmap/NN-slug/README.md` and writes into that same folder:

   | Skill                  | Reads from `README.md`                   | Writes                                  |
   | ---------------------- | ---------------------------------------- | --------------------------------------- |
   | `msg-api-contracts`    | `## Technical Details` → `### Back-end`   | `docs/roadmap/NN-slug/openapi.json`      |
   | `msg-sequence-diagrams`| `## Technical Details` → `### Back-end`   | `docs/roadmap/NN-slug/sequence-diagrams.md` |
   | `msg-wireframes`       | `## User Experience`                      | `docs/roadmap/NN-slug/wireframes/<name>.md` |

   The input sections changed shape in prompt 19: Technical Details is now prose
   under a `### Back-end` / `### Front-end` split, not a numbered list, and User
   Experience now carries Mermaid interaction diagrams alongside its bullets.
   Update each skill's "read this section" instructions to match, including the
   line each one has saying the section is *the entire input* and nothing may be
   invented beyond it. That rule stays.

2. **Delete the task-file path entirely.** None of the three writes into a task
   file any more. Concretely:
   - `msg-wireframes` stops writing a `## Wireframes` section.
   - `msg-sequence-diagrams` stops writing a `## Sequence diagrams` section.
   - `msg-api-contracts` stops adding its one line to a task's `## References`,
     which means it no longer edits a task file at all.

   Every mention of `docs/tasks/` as a write target goes. Prompt 21 removes the
   matching sections from the task template; do not edit task-breakdown here.

3. **The write barrier changes meaning — decide it and write it down.** Today
   each skill refuses to edit a task file carrying any `- [x]` acceptance
   criterion, because work has started against it. Roadmap item folders have no
   checkboxes, so that exact rule no longer fires. Replace it with a rule that
   protects finished work: **an item whose `**Status:**` is `done`, or whose
   header carries `**Landed:**` or `**Merged:**`, has shipped — do not silently
   rewrite its artifacts. Report what would change and ask.** For an item that is
   `not-started` or `in-progress`, re-running a skill updates its artifact in
   place. State this in each skill in one short paragraph.

4. **`msg-sequence-diagrams`: the "new route" trigger, at planning time.** The
   skill draws a diagram only for a route the application does not serve yet,
   and never for a route whose contract merely changes. That distinction still
   holds, but the evidence changes. Today it reads a slice's wording, the item's
   task-folder `openapi.json` and the codebase. Now it reads:
   - the item's `### Back-end` prose ("add `POST /characters`" is new; "add
     `avatarUrl` to `POST /characters`" is not);
   - the item's own `docs/roadmap/NN-slug/openapi.json`, written moments earlier
     by `msg-api-contracts`;
   - the project's served spec and its routes.

   One diagram per new route the item adds. All of them in the single
   `sequence-diagrams.md`, one `**Endpoint:**` block each, in the order the
   contract lists them. Keep the rule that a diagram covers the failure path and
   carries an **Architecture rules** list.

5. **`msg-api-contracts`: keep the house-style work, fix the paths.** The whole
   `## Mimic the project's existing spec` section stays — it is the most valuable
   part of that skill. Two changes inside it:
   - Precedence item 2 currently reads "another item's
     `docs/tasks/<other-item>/openapi.json`". It becomes
     `docs/roadmap/<other-item>/openapi.json`.
   - The `find` command that hunts for an existing spec stays as it is, but it
     will now also turn up roadmap item contracts. Say in one line that those are
     precedence 2, never precedence 1.

   Also: `info.title` is the roadmap item's title and `info.version` stays
   `0.1.0`. The file is now written once during planning instead of accumulating
   across slices, so the "merge additively, never drop a path another slice
   wrote" rule becomes "merge additively when re-run against an item that already
   has a contract". Keep the merge discipline; change the story around it.

6. **`msg-wireframes`: less ASCII ceremony.** The current format is a big ASCII
   box per screen. Replace it with one markdown file per wireframe under
   `wireframes/`, named after the screen (`character-list.md`), each holding:
   - **Purpose** — one or two lines on what this screen is for.
   - **Where it sits** — a pointer to the part of the item's `## User Experience`
     section it renders, by its `**Entry**` / `**Flow**` / `**States**` bullet or
     its interaction diagram.
   - **The screen** — a short plain-language description of the layout: what is
     on it, roughly where, what the user can do. A small ASCII sketch is allowed
     where it genuinely helps, but it is no longer the point and no longer
     required.
   - **Design rules** — unchanged and still mandatory. Cite each rule by number
     with a one-line paraphrase. A wireframe with no cited rule is decoration.

   Keep the rule that this skill never invents a screen, a state or a flow step
   the User Experience section does not already have.

7. **Decide the standalone fallback per skill, and say so.** Each skill today
   has a "no `project.yml`, or no task folder" fallback that writes
   `wireframes.md` / `sequence-diagrams.md` / `openapi.json` at the repo root.
   Decide for each whether that is still worth carrying now that the target is a
   roadmap item folder, and write the decision into the skill in one line.
   Recommended: keep it for `msg-api-contracts` (contracting an endpoint outside
   a planning workspace is genuinely useful), drop it for the other two (both now
   read sections that only exist inside an item's `README.md`, so a fallback
   would be guessing). If you keep a fallback, say exactly what it writes; if you
   drop one, say the skill stops and names what is missing.

8. **Update the frontmatter `description` of all three.** All three currently
   advertise themselves as task-breakdown-time skills writing into a task file.
   They are now planning-time skills writing into a roadmap item folder. The
   description is what makes the skill get picked, so this is not cosmetic.
   `test/unit/skills.test.ts` asserts every skill's frontmatter carries a `name`
   matching its folder and a non-empty `description` — keep both valid.

9. **Update the invocation contracts.** Each skill says how it is invoked. It is
   now `/msg-<skill> <item>` against a roadmap item number, or invoked
   automatically by `msg-roadmap-plan-item` right after it writes the item's
   `README.md`. Delete every reference to being invoked by
   `msg-roadmap-task-breakdown` "right after it writes a task". Keep the bare
   invocation behaviour: ask which item.

10. **Stay inside this stage.** Only these three files:
    `templates/skills/msg-wireframes/SKILL.md`,
    `templates/skills/msg-sequence-diagrams/SKILL.md`,
    `templates/skills/msg-api-contracts/SKILL.md`. Do not touch task breakdown,
    task review, the sync skill, the engine, the hooks, `templates/project/`,
    fixtures or `src/`. `templates/skills/msg-roadmap-task-review/SKILL.md`
    references these skills and their old sections; prompt 21 fixes it.

## Tone

Direct, clear, avoiding jargon, explaining like a teacher addressing a beginner
who is lazy to read. These skills are read cold by an agent that has never seen
this refactor.

## Output

Three edited skill files under `templates/skills/`. No new files. This is a
templates change with no `src/` edit, but it ships inside the CLI's payload —
run the test suite before you finish, because `test/unit/skills.test.ts` asserts
things about every skill's frontmatter and content.
