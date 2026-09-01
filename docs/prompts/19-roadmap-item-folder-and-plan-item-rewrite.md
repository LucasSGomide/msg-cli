# Goal: Turn a roadmap item into a folder and rewrite `msg-roadmap-plan-item` to fill it — richer prose sections, an optional front-end reference, a web investigator subagent, and the three artifact skills invoked at planning time

**Status:** not executed
**Rating:** —
**Run:** sequential — first stage of the refactor. Prompts 20, 21, 22, 23 and 25
define themselves against the folder shape this prompt fixes, so nothing else
starts until this one lands.

## Context

Read this part even if you skim the rest. It is the whole point of the refactor.

Today a roadmap item is one markdown file: `docs/roadmap/04-profiles.md`. The
technical documentation for that item — the OpenAPI contract, the wireframes,
the sequence diagrams — is not written during planning. It is written later,
during task breakdown, and it is written *into the task folder*
(`docs/tasks/04-profiles/`). When the branch ships, that task folder is deleted.
The contract, the wireframes and the diagrams are deleted with it. The next
person who needs them regenerates them from nothing.

The refactor moves that documentation to where it belongs, and makes it
permanent. A roadmap item stops being a file and becomes a folder. The folder
holds the item's main document plus every artifact that describes it. Nothing in
it is ever deleted when a breakdown is retired.

This prompt does the first stage: it defines the folder, and rewrites the skill
that creates it — `templates/skills/msg-roadmap-plan-item/SKILL.md`. Read that
file end to end before you change a line of it. It is 264 lines and every
section of it is affected.

The second thing this prompt changes is how much the roadmap item says. Today
the item is deliberately thin — the skill's own first line is "The planning is
the deliverable. The doc is a receipt — keep it short." That was the wrong trade.
A thin item produces a thin breakdown, and the breakdown then spends its budget
inventing what should have been decided once. So the item gets longer and
richer, and the task breakdown's job narrows to splitting work that is already
described.

## Constraints

1. **The folder shape.** A roadmap item is `docs/roadmap/NN-slug/`, not
   `docs/roadmap/NN-slug.md`. What lives inside:

   | Path                  | What it is                                                        |
   | --------------------- | ----------------------------------------------------------------- |
   | `README.md`           | The main document — the `# NN — Title` line, the metadata header, and every prose section |
   | `openapi.json`        | The item's OpenAPI contract, at the folder root                    |
   | `wireframes/`         | One markdown file per wireframe                                    |
   | `sequence-diagrams.md`| Every sequence diagram for the item, in one file                   |
   | `test-script.md`      | The hand-run verification runbook                                  |

   Mermaid interaction diagrams are **not** separate files. They live inline in
   `README.md`, inside the User Experience section.

   Explorations (`docs/explorations/`) and ditched records (`docs/ditched/`) do
   **not** change: they stay single markdown files. Say this explicitly in the
   skill so nobody generalises the folder rule to them.

2. **`test-script.md` is listed in the layout but this skill does not create
   it.** It is written later, by the first task that reaches acceptance, exactly
   as it works today — only its location moves. Prompt 22 owns that move. Here,
   just name the path in the layout and say the skill does not write it.

3. **Numbering.** The `## Numbering` section currently ends "Filename is
   `NN-kebab-slug.md`." It becomes: the folder is `NN-kebab-slug/` and the
   document inside it is always `README.md`. Numbers stay permanent IDs, never
   renumbered, never reused. The folder's name is what the engine and the task
   breakdown key off, so the slug is chosen once and does not drift.

4. **The new `README.md` template.** Replace the `## Template — roadmap and
   exploration` block. Sections, in this order:

   - `# NN — Title` and the metadata header line — unchanged. `**Depends on:**`,
     `**Status:**`, `**Estimate:**` are still the only machine-read fields, and
     the title line is still the cell the generated tables print.
   - **`## Context`** — plain-language prose, **3000–6000 characters**. Both ends
     enforced. It explains what is going to be implemented and why, to a reader
     who knows nothing about the project. Same discipline the task file's
     Context already has (see `templates/skills/msg-roadmap-task-breakdown/SKILL.md`
     and prompt 17): short sentences, ordinary words, every reference explained
     in the sentence that uses it, no bare numbers or symbol names, readable
     without opening another file.
   - **`## User Experience`** — its own section, no length cap. Keeps the
     `**Entry**`, `**Flow**`, `**States**`, `**Pattern**`, `**New pattern**`
     material it has today, and gains **one Mermaid diagram per main user
     interaction**, each with a short plain-language explanation beneath it. The
     explanation exists so the task breakdown can tell which components, states
     and behaviours that interaction needs without inferring them from the
     picture.
   - **`## Technical Details`** — prose, not a numbered list, no length cap, with
     exactly two subheadings:
     - `### Back-end` — what to create and in which layer: controllers,
       use-cases, repositories, DAOs, utility methods, and so on. Written against
       the concepts the project already uses. Read the architecture doc the
       project's `back-end` area points at in `project.yml` (usually
       `docs/architecture-api.md`) and stick to its vocabulary. If the item
       forces a concept the project does not have yet, flag it in that sentence
       — do not slip it in as if it existed.
     - `### Front-end` — what to create: components, pages, hooks, and so on.
       Read the `design` and `front-end` area docs (usually `docs/design.md` and
       `docs/architecture-web.md`). Flag anything new the same way.
   - **`### Technical References`** — research only. If this item, or the
     `msg-pre-roadmap` phase that produced its requirements, triggered research,
     list the findings that will actually be applied and explain each in direct,
     concise terms. Not a link dump, not a reading list. No hard bullet cap.
   - **`## Blockers`** — kept as it is. Every bullet still cites a concrete repo
     reference (file, table, field, doc number). A dependency is still never a
     blocker; the header already carries it.

5. **`## Key Areas` is removed.** Delete the section from the template, and
   delete the whole `## Key Areas vs Technical Details` section of the skill.
   The thing Key Areas actually carried — *which rule doc constrains this work* —
   does not disappear: it is folded into the Back-end and Front-end prose, which
   must cite the rule docs and rule numbers it obeys, the same way Key Areas
   bullets did.

6. **Rewrite the caps table.** The current table (Context 2000 chars, User
   Experience 8 bullets, Key Areas 6 bullets, Technical Details 12 steps,
   Technical References 15 bullets, Blockers citation rule, Findings 1000 chars)
   becomes:

   | Section              | Rule                                                        |
   | -------------------- | ----------------------------------------------------------- |
   | Context              | 3000–6000 characters, both ends enforced                     |
   | User Experience      | no cap                                                       |
   | Technical Details    | no cap                                                       |
   | Technical References | concise, no fixed number                                     |
   | Blockers             | no cap — every bullet cites a concrete repo reference        |
   | Findings (exploration only) | 1000 chars                                            |

   Removing a cap is not permission to ramble. Say so in one line: a section
   with no cap still cuts anything that is neither a decision nor a fact.

7. **The "bullets only" rule has to change.** The skill currently says "Bullets
   only, no prose paragraphs." That is now wrong for three sections. State the
   new rule plainly: Context and Technical Details are prose; User Experience is
   bullets plus diagrams with prose explanations; Blockers and Technical
   References stay bullets.

8. **Ask for a front-end reference, but never block on it.** For any item with a
   front-end aspect, the skill asks the user for a front-end reference — a URL to
   the running app or an equivalent — using one `AskUserQuestion` call with
   "provide a reference" recommended and "no reference" a real option. It is not
   a gate:
   - Reference given → the web investigator (constraint 9) runs against it.
   - Declined → record in the flow that no reference was given, skip the
     investigator, and build the Front-end prose and the interaction diagrams
     from `design.md`, `architecture-web.md` and whatever the user described
     about the UI and UX. Do not stall, do not re-ask.
   - Back-end-only item → the question is never asked at all.

9. **The web investigator subagent.** When a reference was given, spawn an
   inline subagent — on the fly, with the Task tool, **not** a file under
   `templates/agents/`. Model it on the optional research subagent in
   `templates/skills/msg-pre-roadmap/SKILL.md` step 4: scoped to one pass, uses
   `WebFetch`/`WebSearch`, no back-and-forth with the user, reports back a
   summary. Its job: visit the reference, map the DOM, the components and the
   structure of the part of the app this item relates to, and report how that
   app builds that piece. Back in the main thread, relate the report to the
   project's `design.md` guidelines with a critical eye on user experience — what
   to copy, what to reject and why. The report feeds the Front-end prose and the
   interaction diagrams. It is not a reusable agent; do not build it as one.

10. **The skill orchestrates artifact generation.** After `README.md` is written
    and the folder exists, the skill invokes the three artifact skills against
    the roadmap item folder, in this order:
    1. `/msg-api-contracts` — writes `openapi.json`.
    2. `/msg-sequence-diagrams` — writes `sequence-diagrams.md`, and reads the
       contract to know which routes the item adds.
    3. `/msg-wireframes` — writes `wireframes/`, only for an item with a
       front-end aspect.

    These three used to run during task breakdown; they now run here. Prompt 20
    retargets them. Write this skill against the folder paths above, and say in
    one line that a back-end-only item skips wireframes and a UI-only item skips
    contracts and diagrams.

11. **Update the `## Flow` list end to end.** It currently runs: no argument →
    requirements gate → ditched check → grill → UX grill → outcome → write →
    readiness check. The new flow has to place: the front-end reference question,
    the investigator, writing the folder and its `README.md`, invoking the three
    artifact skills, `make roadmap-sync`, and the readiness check. Keep the
    requirements gate and the ditched check exactly as they are — they are not
    part of this refactor.

12. **Update `## Ready to break down`.** Five tests today; test 3 cites Key
    Areas and has to be rewritten against the Back-end/Front-end prose (each half
    cites the rule doc for its area, and any reused pattern cites a numbered
    design rule). Test 1 and test 2 must keep their exact wording fragments
    "traceable to a" and "concrete action on a concrete thing" — `test/unit/skills.test.ts`
    asserts both strings appear in this skill and in
    `msg-roadmap-task-breakdown`, and prompt 21 is told not to touch them either.

13. **Update `## README regeneration`.** It still says run `make roadmap-sync`
    and never hand-patch a table. What changes is the sentence that assumes one
    file per item: the `# NN — Title` line now lives in the folder's `README.md`,
    and that is the file the engine parses. The engine change itself is prompt
    23's — do not touch `templates/scripts/roadmap-sync.mjs` here.

14. **Update `## Revival` and the ditched template.** Revival deletes the ditched
    doc once the roadmap item exists — now "once the item's folder exists". The
    ditched template itself is unchanged (single file, no folder).

15. **Fix the test this breaks.** `test/unit/skills.test.ts` line ~88 asserts
    `expect(skillText('msg-roadmap-plan-item')).toContain('## Key Areas vs Technical Details')`.
    That section is gone, so the assertion has to change to something the new
    skill actually guarantees — for example that both skills describe the
    Back-end/Front-end split. Keep the sibling assertion about
    `msg-roadmap-task-breakdown` containing `## Is the item ready?` intact;
    prompt 21 keeps that heading.

16. **Stay inside this stage.** Do not edit the three artifact skills, the task
    breakdown skill, the task review skill, the sync skill, the hooks, the sync
    engine, any fixture, any `templates/project/` file or anything under `src/`.
    Every one of those is another prompt's file, and two prompts editing one file
    is the conflict this staging exists to avoid. If you find something in those
    files that contradicts the folder shape, note it in your final report instead
    of fixing it.

## Tone

Direct, clear, avoiding jargon, explaining like a teacher addressing a beginner
who is lazy to read. That applies to the skill text you write, not just to this
prompt: the skill is read cold by an agent with no memory of this refactor.

## Output

An edited `templates/skills/msg-roadmap-plan-item/SKILL.md` and an edited
`test/unit/skills.test.ts`. No new files, no other files touched. This is a
templates-and-tests change, so it is a code-changing session under `CLAUDE.md` —
create the session branch before the first edit and keep it until the work is
approved to land.
