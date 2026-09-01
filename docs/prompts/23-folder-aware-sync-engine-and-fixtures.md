# Goal: Teach `roadmap-sync.mjs` that a roadmap item is a folder whose `README.md` carries the header, and convert every fixture and golden file to the new shape

**Status:** not executed
**Rating:** —
**Run:** sequential after 19 — the folder layout has to be settled before the
parser encodes it. Parallel with 20, 21, 22 and 25: this stage touches only the
engine, the engine's tests and the fixtures, and none of those files belong to
another stage. It is the largest stage; do not bundle anything else into it.

## Context

`templates/scripts/roadmap-sync.mjs` (944 lines) is the deterministic half of the
planning workflow. It reads every doc under the docs tree and regenerates five
kinds of table, derives each item's status from its tasks' ticked checkboxes,
sorts items into Ready / Blocked / Parked / Done, and reports which shipped
breakdowns need retiring. `make roadmap-sync` writes; `make roadmap-check` fails
on drift. It is vendored into each project on `msg init`, and it imports nothing
outside Node builtins — `test/unit/engine-guards.test.ts` enforces that, so keep
it true.

Everywhere it currently assumes a roadmap item is a single file
`docs/roadmap/NN-slug.md`. Prompt 19 made an item a folder,
`docs/roadmap/NN-slug/`, with the document at `README.md` inside it and the
item's contract, wireframes, sequence diagrams and test script beside it. This
prompt makes the engine believe that.

Explorations and ditched records do **not** change shape. They stay single files,
and the code paths that read them (`isNumberedDoc`, `explorationsReadme`,
`ditchedReadme`) keep working exactly as they do now.

Read the engine end to end before you touch it. The comments in it explain why
several things are written the odd way they are — universal newlines, code-unit
sorting, `matchAll` instead of a `/g` loop, the self-execution guard at the
bottom. Do not "clean up" any of those.

## Constraints

1. **Parsing.** A roadmap item is the folder `docs/roadmap/NN-slug/` and its
   document is `docs/roadmap/NN-slug/README.md`. Concretely:
   - `loadRoadmap` currently lists `cfg.roadmap` with `isNumberedDoc` and parses
     each file. It now lists numbered **folders** (`isNumberedFolder` already
     exists and matches `[0-9]*-*`) and parses `join(folder, 'README.md')`.
   - `item.slug` stays the folder name; `item.path` becomes the path to
     `README.md`. Check every use of `item.path` — `deriveStatuses` writes the
     rewritten header back to it, and `run()` compares it against disk.
   - `parseHeader`'s error messages use `basename(path)`, which for every item is
     now the useless string `README.md` (`README.md: empty`,
     `README.md: first line is not …`). Make the label the item folder's name
     instead, so a broken doc can be found. Keep the message wording otherwise
     identical.
   - A numbered folder with no `README.md` is a problem line, not a crash.
   - A leftover single file `docs/roadmap/NN-slug.md` is a problem line naming
     the migration command by its real name: `msg migrate-roadmap` (prompt 24
     adds it). Word it so a user knows exactly what to run. Do not try to parse
     it, and do not silently ignore it — silence is how a repository ends up half
     migrated.
   - Everything else inside an item folder — `openapi.json`, `wireframes/`,
     `sequence-diagrams.md`, `test-script.md` — is ignored by the engine. It
     never reads them, never validates them, never rewrites them.

2. **Table links.** `itemLink` renders `[${key(item)}](${basename(item.path)})`,
   which used to be `01-slug.md`. Decide the new target once and apply it in
   every generator: recommended `01-slug/README.md`, because clicking it opens
   the document rather than a directory listing. Whatever you choose, the roadmap
   README, the tasks README and every other generated table must agree, and the
   choice must be stated in a comment next to `itemLink`.

3. **The five generators.** Walk all of them and fix anything that assumed a
   file: `roadmapReadme`, `explorationsReadme`, `ditchedReadme`, `folderReadme`,
   `tasksReadme`. The middle two should need no change at all — if you find
   yourself editing them, stop and work out why. `tasksReadme` already links task
   folders as `i.slug/`; make sure the roadmap link convention from constraint 2
   does not accidentally leak into it.

4. **Retirement and validation.** `validate` reports
   `` `${cfg.rel(cfg.tasks)}/${item.slug}/ still exists — retire it` `` and
   `run()` prints the matching `retire` line. Both stay, and both still refer to
   the **task** folder. Add nothing that deletes, rewrites or even reads the
   roadmap item folder during retirement — prompt 22 states that rule in the
   skills; this is the code that must not contradict it. `loadTasks`'s check that
   a task folder is named after its roadmap item (`folderName !== item.slug`)
   stays as it is: the two folder names still match.

5. **Freshness check.** `--check` compares every file the writer would write
   against what is on disk. Confirm the item's `README.md` participates
   correctly: a header the engine rewrites (`deriveStatuses` → `replaceField`)
   must show as `stale docs/roadmap/NN-slug/README.md`, with the path printed
   relative to the root, not as a bare `README.md`.

6. **Convert every fixture project.** `test/fixtures/projects/` holds 13 projects
   and each has one or more `docs/roadmap/NN-*.md` files. Move each to
   `docs/roadmap/NN-*/README.md`, keeping the content byte-identical apart from
   anything the new shape genuinely changes. Watch for the fixtures that exist to
   test edge cases and make sure the edge case survives the move:
   - `duplicate-number` — two items claiming `01`. As folders, that is
     `01-clash/` and `01-first/`; the duplicate-number error must still fire.
   - `folder-name-drift` — a task folder named differently from its item. Still
     valid, still a problem line.
   - `crlf` — CRLF line endings must stay CRLF in the fixture.
   - `empty` — no items at all.
   - `landed-retire-folder`, `done-unmerged-folder`, `merged-unfinished` — the
     retirement cases.

7. **Add fixtures for what is new.** At least two:
   - **A legacy single-file item.** A project with `docs/roadmap/01-old.md` and
     no folder, proving the engine reports it and names `msg migrate-roadmap`.
   - **An item folder carrying its artifacts.** Extend `landed-retire-folder` or
     add a sibling: the item folder holds `openapi.json`, `wireframes/one.md`,
     `sequence-diagrams.md` and `test-script.md`, the item is `done` with
     `**Landed:**`, and the run prints the `retire` line for the task folder while
     leaving every artifact byte-identical in the golden tree. That is the whole
     refactor's central promise, and it deserves a test that fails loudly if it
     breaks.
   - Consider also a numbered folder with no `README.md`.

8. **Regenerate the goldens, then read them.** `test/engine/golden.test.ts`
   snapshots stdout, stderr, exit code and the whole file tree per fixture, and
   `UPDATE_GOLDEN=1` rewrites the expectations. Use it — and then read every diff
   it produced, one by one, before committing. An unexplained change in a golden
   is a bug you just blessed. The sync skill's own rule applies here in reverse:
   normally "the check failing is drift, never a reason to edit the expected
   output"; this once the output is *supposed* to change, which is exactly when a
   blind accept is most dangerous.

9. **Update the engine's unit tests.** `test/unit/engine-pure.test.ts` exercises
   the exported pure functions (`splitLines`, `parseSimpleYaml`, `parseDeps`,
   `replaceField`, `compressNumbers`, `renderTable`, `replaceFirstTable`,
   `sortQueue`, `firstBullet`, `taskStatus`, `sectionOf`, `ditchedReadme`
   ordering). Fix whatever the signature or behaviour change breaks, and add
   cases for the new parsing rules. `test/unit/engine-guards.test.ts` asserts the
   engine imports nothing outside Node builtins and does not self-execute on
   import — both must still pass untouched.

10. **Update the engine's own header comment.** The block at the top of the file
    explains what the engine derives and from what. It says "a breakdown folder
    is retired only once its roadmap item's header records the branch shipped" —
    still true. Add the line that is now load-bearing: a roadmap item is a folder,
    its `README.md` is the doc, and everything else in that folder is permanent
    and untouched by the engine.

11. **Do not change the manifest.** `structure.roadmap` in `project.yml` is still
    `docs/roadmap/` — the folder that holds items, whatever shape an item is.
    `src/core/manifest.ts` and `src/commands/check.ts` need no edit, and
    `check.ts` imports `parseSimpleYaml` from this engine, so do not change that
    export's signature.

12. **Stay inside this stage.** Only `templates/scripts/roadmap-sync.mjs`,
    `test/fixtures/**`, `test/engine/**` and `test/unit/engine-*.test.ts`. No
    skill file, no `templates/project/` file, no hook, no `src/` file. If a skill
    now describes engine behaviour wrongly, note it in your report — prompts 19
    through 22 own those files.

## Tone

Direct, clear, avoiding jargon, explaining like a teacher addressing a beginner
who is lazy to read. That applies to the comments you write in the engine too;
it is the most-read file in the payload.

## Output

An edited `templates/scripts/roadmap-sync.mjs`, converted and added fixtures
under `test/fixtures/projects/`, regenerated goldens under
`test/fixtures/golden/`, and updated engine unit tests. This is a code-changing
session under `CLAUDE.md`: branch before the first edit, keep the branch until
the work is approved to land. `npm test` must be green before you finish.
