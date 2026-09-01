# Goal: Move `test-script.md` into the roadmap item folder, drop `## As built`, and make retirement delete the task folder and nothing else

**Status:** not executed
**Rating:** —
**Run:** sequential after 19 and after 21 — the item folder has to exist first,
and 21 edits the same file this stage touches one section of
(`templates/skills/msg-roadmap-task-breakdown/SKILL.md`; the two edits are in
disjoint sections, but they are the same file). Parallel with 20, 23 and 25.

## Context

Two things die today when a breakdown is retired, and both should not.

The first is `test-script.md`. It is the hand-run runbook that proves a feature
actually works — a checklist of commands, requests and click paths with the
result each one must produce. It lives at `docs/tasks/<item>/test-script.md`,
inside the task folder, so it is deleted the moment the branch ships. The next
person who wants to verify that feature writes it again from nothing.

The second is `## As built`. That is the section `msg-roadmap-sync` tells the
agent to extract onto the roadmap doc while retiring a breakdown — a summary of
what the work taught that the plan did not. It exists because the task folder was
about to be deleted and something had to survive. Now the roadmap item is a
folder that keeps its contract, its diagrams, its wireframes and its test script
forever, so `## As built` has nothing left to rescue. It goes.

This prompt makes those two changes and updates every file that states the
retirement rule. That includes a shell hook and its tests, so this is a
code-changing session under `CLAUDE.md`: create the session branch before the
first edit and keep it until the work is approved to land.

Files, all to be read before editing:

- `templates/skills/msg-roadmap-sync/SKILL.md`
- `templates/hooks/acceptance-criteria-gate.sh` (the `test-script.md` logic is
  around lines 205–245)
- `test/integration/hooks.test.ts` (roughly 11 cases seed
  `docs/tasks/01-x/test-script.md`)
- `templates/project/claude-block.md`
- `templates/project/tasks-README.md`
- `templates/project/roadmap-README.md`
- `templates/skills/msg-setup/SKILL.md` (line ~89)
- `src/core/areas.ts` (line ~3) and `src/core/manifest.ts` (line ~47) — comments only

## Constraints

1. **`test-script.md` moves to `docs/roadmap/NN-slug/test-script.md`.** Only the
   path moves. Everything about how it is written stays: the **first task to
   reach acceptance** creates it with `## Setup` and `## Teardown`, each later
   task appends its own `## MM — Task title` section and reuses a Setup step
   already written rather than restating it, every line is a checkbox holding one
   concrete action and the observable result it must produce, and a box is ticked
   only after the step has actually been run. Neither
   `msg-roadmap-plan-item` nor `msg-roadmap-task-breakdown` creates the file.
   State that decision explicitly wherever the file is described, so nobody
   later assumes planning should have stubbed it out.

2. **The file is permanent.** Because it now lives in the item folder, it
   survives retirement like every other artifact there. Say so in the same
   breath as the move — it is the reason for the move.

3. **`## As built` is deleted from the workflow.** Remove it from
   `templates/skills/msg-roadmap-sync/SKILL.md` (it appears around lines 15, 110,
   116, 145 and 151) and from `templates/project/claude-block.md` (around line
   113). The sync skill's opening paragraph currently lists three things the
   script deliberately refuses to do — "tick a checkbox, write `## As built`, and
   update the hand-written prose" — and becomes two. The retirement procedure
   loses its "read the task files, add or extend `## As built`" step, so retiring
   is now a single act: delete the task folder, re-run the sync.

4. **Retirement never touches the roadmap item folder.** Write this as a rule in
   its own right, in the sync skill and in `claude-block.md`: when a breakdown's
   branch lands or merges, `docs/tasks/NN-slug/` is deleted and
   `docs/roadmap/NN-slug/` is not modified — not its `README.md`, not its
   contract, not its diagrams, not its wireframes, not its test script. The sync
   skill currently has a paragraph saying a front-end item's `## User Experience:`
   section is "kept, not deleted, and corrected if the screen shipped differently"
   — that survives as a plain statement that the item folder is the permanent
   record, but nothing in retirement edits it automatically.

5. **What triggers retirement does not change.** `**Landed:** <date>` or
   `**Merged:** <date>` on the roadmap item's header, added when the branch
   ships, is still the one and only signal. Reaching `done` still retires
   nothing. Ticked checkboxes are still sacred. Do not touch that machinery —
   prompt 16 built it deliberately.

6. **The acceptance gate hook follows the file.**
   `templates/hooks/acceptance-criteria-gate.sh` hardcodes `tasks_rel="docs/tasks"`
   at line ~69 and then builds `ts="$tasks_rel/$folder/test-script.md"` at line
   ~241. Add a `roadmap_rel="docs/roadmap"` beside the existing one and point the
   test-script lookup at `$roadmap_rel/$folder/test-script.md`. The folder name is
   the same on both sides — the sync engine already reports a problem when a task
   folder is not named after its roadmap item — so no extra mapping is needed;
   say that in a comment so the next reader does not wonder.

   Two details not to miss:
   - The hook decides scope from `git diff --name-status -M "$mb" "$ref" -- "$tasks_rel"`
     (line ~185). The test script is no longer in that diff, and it does not need
     to be: it is read from the shipped ref with `git show "$ref:$ts"`, which
     still works. Do not widen the diff to `docs/roadmap` — the gate judges task
     acceptance, and a roadmap item folder edit is not that.
   - Line ~215, `[[ "$fname" == "test-script.md" ]] && continue`, existed because
     the file used to sit among the task files. It is now dead. Remove it, or keep
     it with a one-line comment saying why (a repository mid-migration may still
     have one there). Either is fine; decide and say which.
   - Update the hook's header comment block and its blocked-message text
     (`"If the slice is done: tick its boxes, write its test-script.md section…"`)
     so the path it names is the real one.

7. **Update `test/integration/hooks.test.ts`.** Every case that seeds
   `docs/tasks/01-x/test-script.md` moves the file to
   `docs/roadmap/01-x/test-script.md`, and the assertions that check the blocked
   message names a path move with it. Add one case that would have caught this
   bug: a ship that accepts a slice whose **task** folder still has an old
   `test-script.md` but whose item folder has none is still blocked. Do not
   weaken any existing case to make it pass.

8. **`templates/project/claude-block.md`.** This is the block `msg init` writes
   into a project's `CLAUDE.md`, so it is what an agent in a scaffolded project
   actually reads. Update:
   - The folder table: `docs/roadmap/` is "committed work, one numbered **folder**
     per item, holding the item's doc and its permanent technical artifacts", and
     say in a line what those artifacts are (`README.md`, `openapi.json`,
     `wireframes/`, `sequence-diagrams.md`, `test-script.md`).
   - The "Acceptance before landing" section: act 2 now writes into
     `docs/roadmap/<item>/test-script.md`. Fix the "one file per roadmap item
     beside `README.md` and `openapi.json`" phrasing — that is still true, it is
     just a different folder now.
   - The gate's description: the bullet about "a folder this ship accepts a slice
     into whose `test-script.md` is missing" now points at the item folder.
   - The "Retiring the breakdown after it lands" paragraph: drop `## As built`,
     and state that the item folder is never modified by retirement.

9. **`templates/project/tasks-README.md`.** It describes what a task folder
   holds and how long it lives. Remove `test-script.md` from the list of what the
   folder holds, keep the "acceptance means both" sentence but point the second
   half at the item folder, and keep the lifecycle sentence (breakdown until the
   branch lands). Do **not** touch the literal line `Items — are \`done\`.` — the
   sync engine rewrites that line by regex (`/Items [^\n]*(?:\n(?!\n)[^\n]*)* are `done`/`)
   and changing its shape breaks every freshly scaffolded project's first
   `make roadmap-check`.

10. **`templates/project/roadmap-README.md`.** The header prose says "One doc per
    item, numbered on creation". It becomes one **folder** per item, with
    `README.md` inside carrying the metadata header the tables are generated
    from. Keep every existing Rules bullet, including the `Landed:` / `Merged:`
    one. Do not change the `## Ready` / `## Blocked` / `## Parked` / `## Done`
    headings or the `_(none)_` placeholders — the engine parses them, and prompt
    23 owns the engine.

11. **Three stale comments about Key Areas.** Prompt 19 deleted the `## Key
    Areas` section, and three places still describe an `areas` key as "the bold
    bullet prefix a roadmap item's Key Areas section must use":
    `src/core/areas.ts` (~line 3), `src/core/manifest.ts` (~line 47) and
    `templates/skills/msg-setup/SKILL.md` (~line 89). Rewrite all three to say
    what is true now: the key names an area, and the area's rule doc is what the
    item's Technical Details prose (and each task's `**Area**` bullets) must
    cite. These are comments and documentation only — no behaviour changes, and
    the area keys themselves are untouched.

12. **Stay inside this stage.** The file list at the top of this prompt is
    exhaustive. Do not edit `msg-roadmap-plan-item`, the three artifact skills,
    `msg-roadmap-task-breakdown`, `msg-roadmap-task-review`, the sync engine, any
    fixture, or any `src/` file beyond the two comments named in constraint 11.
    In particular: `msg-roadmap-task-breakdown` has a whole
    `## Acceptance: the boxes and the test script` section describing the old
    path — that section is **yours** to update, and prompt 21 was told to leave it
    byte-identical. Update it here, and touch no other part of that file.

## Tone

Direct, clear, avoiding jargon, explaining like a teacher addressing a beginner
who is lazy to read.

## Output

Edited skill, hook, project-template and test files as listed above, plus the
one section of `templates/skills/msg-roadmap-task-breakdown/SKILL.md` that
constraint 12 assigns to this stage. No new files except any fixture a new hook
test case needs. Run the full test suite before finishing; `test/integration/hooks.test.ts`
is the one that will actually exercise the hook change.
