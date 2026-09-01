# Goal: Plan the roadmap-item-as-folder refactor and write the staged execution prompts for it

**Status:** executed on 2026-08-31
**Rating:** 9 — should have kept the "lazy to read" detail the user added

## Context

Today a roadmap item is a single markdown file. The OpenAPI contract,
wireframes and sequence diagrams for that item are generated later, during task
breakdown, and they live inside the task folder. When the task folder is
retired after the branch ships, that technical documentation is deleted with
it. The knowledge is gone, and the next person who needs it has to regenerate
it from scratch.

This refactor moves that documentation to where it belongs: the roadmap item.
A roadmap item stops being one file and becomes a folder. The folder holds the
item's main doc plus its contract, its wireframes, its sequence diagrams and a
test script — all generated once, during planning, and kept forever. Task files
stop carrying their own copies and just point at the folder. Retiring a
breakdown never touches the folder again.

The roadmap item template also gets much richer. The point is to hand the task
breakdown a near-complete picture so it can focus on splitting and
parallelising the work instead of guessing at what to build. Context becomes a
longer prose explanation. Technical Details becomes prose with a Back-end and a
Front-end half, each grounded in the project's own architecture and design
docs, flagging anything new. For any item that touches the UI, the skill asks
the user for a front-end reference but does not require one: if the user
provides it, an investigator subagent maps that reference against the design
guidelines during planning; if the user declines, planning proceeds from
`design.md` and whatever the user described about the UI and UX. Mermaid
diagrams capture the main user interactions.

**This prompt does not do the refactor.** Running it produces a set of new,
numbered prompt files under `docs/prompts/`, each one a self-contained brief
for a single implementation session, with `Run:` tags describing what can go in
parallel and what must be sequential. The planning is the work: read the
current skills, the sync engine, the templates and the test fixtures first, so
every child prompt names real files and real sections.

## Constraints

1. **Deliverable.** Write several new prompt files under `docs/prompts/`,
   numbered continuing from the current highest `NN` prefix, one per coherent
   stage of the refactor. Each file follows the `msg-write-prompt` template
   (Goal, `Status: not executed`, `Rating: —`, Context, Constraints, Output),
   and each carries a `**Run:**` line stating whether it is parallel-safe with
   its siblings or sequential, based on which files it touches. This planning
   prompt changes no skill, engine, template, CLI or fixture itself.

2. **Read before writing.** Before drafting the child prompts, read the current
   `templates/skills/msg-roadmap-plan-item`, `msg-roadmap-task-breakdown`,
   `msg-wireframes`, `msg-sequence-diagrams`, `msg-api-contracts`,
   `msg-roadmap-sync` and `msg-pre-roadmap`; `templates/scripts/roadmap-sync.mjs`;
   the `templates/project/` README and block templates; and the roadmap/task
   fixtures and golden files under `test/fixtures/`. Child prompts must
   reference real paths and real section names.

3. **The folder shape.** A roadmap item becomes `docs/roadmap/NN-slug/` instead
   of `docs/roadmap/NN-slug.md`. Layout:
   - `README.md` — the main doc (header, all prose sections).
   - `openapi.json` — the item's contract, at the folder root.
   - `wireframes/` — one file per wireframe.
   - `sequence-diagrams.md` — all sequence diagrams for the item.
   - `test-script.md` — the step-by-step verification runbook (see 11).
   Mermaid interaction diagrams live inline in `README.md`, in the User
   Experience section — not as separate files.

4. **New `README.md` template — sections and rules:**
   - **Context** — plain-language prose, **3000–6000 characters**, explaining
     what is going to be implemented and why. Same "readable without opening
     another file" discipline the task Context already has (prompt 17).
   - **User Experience** — its own section, no length cap. Entry, flow and
     states, plus one Mermaid diagram per main user interaction, each with a
     short plain-language explanation so the breakdown knows which components,
     states and behaviours the interaction needs.
   - **Technical Details** — prose, not a bullet list, no length cap, with two
     subheadings:
     - **Back-end** — what to create and in which layer (controllers,
       use-cases, repositories, DAOs, utility methods, and so on). Check the
       architecture docs the project's `areas` point at (e.g.
       `architecture-api.md`) for the concepts the project already uses and
       stick to them. If the item forces a new concept, flag it explicitly.
     - **Front-end** — what to create (components, pages, hooks, and so on).
       Check `design.md` and `architecture-web.md`. Flag anything new the same
       way.
   - **Key Areas** — removed as a section. Fold its "which rule doc constrains
     this" citations into the Back-end and Front-end prose.
   - **Technical References** — research only. If the item, or its
     `msg-pre-roadmap` phase, triggered research, list the findings that will
     actually be applied and explain each in direct, concise terms. Not a link
     dump.
   - **Blockers** — kept. Every bullet still cites a concrete repo reference
     (file, table, field, doc number).

5. **Caps.** Remove the numeric caps on Context (replaced by the 3000–6000
   range), User Experience and Technical Details. Keep the Blockers citation
   rule. Technical References stays concise but needs no hard number. Update the
   caps table in `msg-roadmap-plan-item` accordingly.

6. **Front-end reference prompt (optional).** For any item with a front-end
   aspect, `msg-roadmap-plan-item` asks the user for a front-end reference (a
   URL or equivalent) but does not hard-stop. If the user supplies one, the web
   investigator subagent (7) runs against it. If the user declines, the skill
   records that no reference was given and builds the Front-end prose and
   interaction diagrams from `design.md`, `architecture-web.md` and whatever
   UI/UX detail the user provided. Back-end-only items skip the prompt entirely.

7. **Web investigator subagent.** During `msg-roadmap-plan-item`, an inline
   subagent — spawned on the fly, not shipped as an installable
   `templates/agents/` file — visits the front-end reference, maps the DOM,
   components and structure of the part of the app the item relates to, and
   reports how the app builds that piece. Its report is related back to the
   `design.md` guidelines with a critical eye on user experience, and it feeds
   the Front-end prose and the interaction diagrams. Model it on
   `msg-pre-roadmap`'s optional research subagent — scoped to one pass, no
   back-and-forth with the user, not built as a reusable agent. It runs only
   when the user supplied a front-end reference; when none is given, this step
   is skipped and the child prompt should say so explicitly.

8. **`msg-roadmap-plan-item` orchestrates artifact generation.** After the
   `README.md` is written, the skill invokes `msg-wireframes`,
   `msg-sequence-diagrams` and `msg-api-contracts` against the roadmap item
   folder. These three skills move from task-breakdown time to plan-item time.

9. **Retarget the three artifact skills.** `msg-wireframes`,
   `msg-sequence-diagrams` and `msg-api-contracts` read the roadmap item's
   `README.md` and write into the roadmap item folder (`wireframes/`,
   `sequence-diagrams.md`, `openapi.json`). Drop the "write into a task file
   section" path. Decide per skill whether the standalone repo-root fallback is
   still worth keeping and say so in the child prompt.

10. **Simpler wireframes.** Each wireframe file states its purpose, points at
    the relevant part of the User Experience section, and briefly describes the
    screen — less ASCII ceremony than today. It still cites the `design.md`
    rules it obeys.

11. **`test-script.md` moves and becomes permanent.** It lives in the roadmap
    item folder, not the task folder. It replaces the `## As built` concept
    entirely — drop `## As built` from `msg-roadmap-sync`, `claude-block.md` and
    the templates. The end-of-implementation "does an agent validate this or do
    I" question is **out of scope** for this refactor; only ensure the test
    script exists in the folder and survives retirement.

12. **`msg-roadmap-task-breakdown`.** Task files drop the `## Wireframes` and
    `## Sequence diagrams` sections and the per-task `openapi.json` copy. A task
    carries a `## References` section that links the roadmap item folder's
    artifacts instead. No per-task narrowing of wireframes or diagrams. The task
    Context prose rules from prompt 17 stay unchanged. The breakdown no longer
    invokes the three artifact skills.

13. **Retirement leaves the folder alone.** When a breakdown's branch lands or
    merges, `msg-roadmap-sync` deletes the task folder only. The roadmap item
    folder and every file in it is never modified on retirement. Update the
    retirement rules in `msg-roadmap-sync`, `templates/project/claude-block.md`
    and `templates/project/tasks-README.md`.

14. **`roadmap-sync.mjs` becomes folder-aware.** A roadmap item is
    `docs/roadmap/NN-slug/README.md`; parse the header from there. Update status
    derivation, all five table generators, the retirement logic and the
    freshness check. Update every invalidated fixture project and golden file
    under `test/fixtures/`.

15. **Migration is a temporary CLI command.** Add a new command under
    `src/commands/` that converts a target repo's single-file roadmap items into
    the folder shape. The user runs it against their own repos. Mark it
    explicitly temporary / deprecated — it exists to migrate existing
    repositories and will be removed later. It ships with tests. This is what
    makes the refactor a code-changing session that touches `src/`, not just
    `templates/`.

16. **`msg-pre-roadmap` handoff.** Update the wording so research findings flow
    into the new roadmap item's Technical References section.

17. **Templates and guidance.** Update `templates/project/claude-block.md`,
    `roadmap-README.md`, `tasks-README.md`, any doc-guideline blocks, and the
    `msg-roadmap-plan-item` template block for the folder shape, the new
    sections, the dropped `## Key Areas` and `## As built`, and the retirement
    rule.

18. **Stage seams (guidance, not binding).** Suggested split for the child
    prompts: (a) folder shape + `msg-roadmap-plan-item` rewrite + web
    investigator + template; (b) retarget `msg-wireframes` /
    `msg-sequence-diagrams` / `msg-api-contracts` to the folder; (c)
    `msg-roadmap-task-breakdown` + `test-script.md` relocation + retirement
    rule; (d) `roadmap-sync.mjs` + fixtures + golden files + templates; (e)
    `msg-pre-roadmap` handoff; (f) the temporary migration CLI command. Size
    each to one implementation session. Set `Run:` tags from the file overlap —
    the sync-engine and fixture prompt is likely sequential after the skill
    prompts; the migration command depends on the folder shape being defined.

## Tone

Direct, clear, avoiding jargon, explaining like a teacher addressing a
beginner who is lazy to read. The child prompts are read cold by whoever implements each stage.

## Output

New numbered prompt files under `docs/prompts/`, continuing the project-wide
sequence, one per stage, each following the `msg-write-prompt` template with a
`**Run:**` line. No skill, engine, template, fixture or CLI code is changed by
this planning prompt itself.
