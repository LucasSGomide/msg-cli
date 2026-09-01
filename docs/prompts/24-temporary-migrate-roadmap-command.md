# Goal: Add a temporary `msg migrate-roadmap` command that converts an existing repo's single-file roadmap items into the folder shape

**Status:** not executed
**Rating:** —
**Run:** sequential after 19 and 23 — it produces the shape prompt 19 defines,
and prompt 23's engine is what has to accept its output (the engine also prints a
problem line naming this command by name, so the two must agree on the spelling).
Parallel with nothing.

## Context

The refactor changes the shape of a roadmap item from
`docs/roadmap/04-profiles.md` to `docs/roadmap/04-profiles/README.md`, with the
item's contract, wireframes, sequence diagrams and test script beside it in the
folder. New items get the new shape for free — `msg-roadmap-plan-item` writes it.
Repositories that already installed this workflow do not: they have a pile of
single files, and after prompt 23 lands, `make roadmap-sync` will refuse to read
them and tell the user to run a migration command.

This prompt adds that command. It is **temporary by design**: it exists to move
existing repositories across the seam once, and it will be deleted once they have
crossed. Mark that everywhere — in the source header, in `USAGE`, and in what it
prints when it runs.

The CLI is small and has an obvious shape to copy. Read these before writing
anything:

- `src/cli.ts` — argument parsing, the command `switch`, `emit`, the exit codes
  (`0` ok, `1` failed, `2` usage error).
- `src/commands/add-area.ts` — the smallest full command: takes flags, returns
  `{ code, out, err }`, writes through `Recorder` from `src/core/fs.ts`, never
  prints directly.
- `src/commands/check.ts` — how a command finds `project.yml` and reads it with
  `parseSimpleYaml`, imported from the vendored engine so the CLI and the engine
  can never disagree about a manifest.
- `src/usage.ts` — the help text, asserted by `test/unit/rules.test.ts`.

## Constraints

1. **The command.** `msg migrate-roadmap [--root <dir>] [--dry-run] [-y|--yes]`.
   New file `src/commands/migrate-roadmap.ts`, exporting a function that returns
   `{ code, out, err }` like every sibling. Wire it into the `switch` in
   `src/cli.ts` and into `USAGE`. `--root` defaults to the current directory,
   exactly as the other commands do.

2. **What it does, per item.** For every `docs/roadmap/NN-slug.md` (the roadmap
   folder comes from `structure.roadmap` in `project.yml`, never hardcoded):
   - create `docs/roadmap/NN-slug/`;
   - move the file to `docs/roadmap/NN-slug/README.md`, content untouched;
   - if an open breakdown exists at `docs/tasks/NN-slug/`, move its
     `openapi.json` and its `test-script.md` into the item folder, because those
     two are now permanent artifacts of the item rather than of the breakdown.
     Leave every task file where it is.

3. **Mechanical only — never rewrite content.** The command moves files. It does
   not rewrite a `## Key Areas` section into Technical Details prose, does not
   expand a 2000-character Context into the new 3000–6000 range, does not extract
   `## Wireframes` sections out of task files, and does not touch `## As built`.
   Those are judgement calls, and a script making them badly is worse than a
   human making them slowly. Instead, **print what is left to do by hand**, per
   item, at the end of the run: which items still carry `## Key Areas`, which
   Contexts are under the new floor, which task files still carry `## Wireframes`
   or `## Sequence diagrams` sections, and which items have no `openapi.json`.
   That list is the command's real value.

4. **Idempotent and safe.** Running it twice changes nothing the second time. An
   item already in folder shape is skipped with a `kept` line. A name collision —
   `docs/roadmap/04-profiles.md` and `docs/roadmap/04-profiles/` both existing —
   is a reported failure for that item, not an overwrite and not a crash; the
   other items still migrate. Nothing is ever deleted: the command only creates
   folders and moves files.

5. **`--dry-run` prints the plan and writes nothing**, sharing the same code path
   that the real run uses to decide — the pattern `src/commands/uninstall.ts`
   already follows. `--yes` skips the confirmation prompt; without it and with a
   TTY, confirm before moving anything.

6. **No git.** The command uses filesystem operations only and never shells out
   to git or GitButler. Say so in the output: the user reviews the result and
   commits it themselves. A repository can be on any version-control tool, or
   none.

7. **Mark it temporary in three places.**
   - A header comment in `src/commands/migrate-roadmap.ts` saying why it exists,
     that it is expected to be deleted, and what the seam was.
   - A `USAGE` line that says so, e.g.
     `msg migrate-roadmap [options]   (temporary) convert single-file roadmap items to folders`.
   - A closing line on stdout after a successful run, telling the user this
     command is temporary and will be removed once repositories are migrated.

8. **Tests.** Follow the patterns already in the repo:
   - Unit tests for the planning half — given a tree, which items migrate, which
     are skipped, which collide, and what the leftover-work report says. Put them
     under `test/unit/`, named after the command.
   - At least one integration test that runs the built CLI against a temporary
     directory, in the style of `test/integration/init.test.ts` and
     `test/integration/bin.test.ts`, asserting the resulting file listing and a
     second run being a no-op.
   - Extend `test/unit/rules.test.ts` so `USAGE` is asserted to mention the
     command and its temporary status, the same way it already asserts the
     uninstall flags.

9. **The engine's message must match.** Prompt 23 makes `roadmap-sync.mjs` print
   a problem line for a leftover single-file item that names this command. Check
   the exact string it prints and make sure the command name, flags and spelling
   agree. If they do not, the engine's string is the one to match — do not rename
   the command to fit a typo.

10. **Stay inside this stage.** New file under `src/commands/`, plus `src/cli.ts`,
    `src/usage.ts`, and new tests. Do not edit any skill, any
    `templates/project/` file, the engine, the hooks, or existing fixtures. If
    the migration reveals that the engine handles something badly, report it
    rather than patching the engine here.

## Tone

Direct, clear, avoiding jargon, explaining like a teacher addressing a beginner
who is lazy to read. The command's own output is read by someone who has just
been told their roadmap stopped working — say plainly what happened, what moved,
and what they still have to do.

## Output

A new `src/commands/migrate-roadmap.ts`, edits to `src/cli.ts` and
`src/usage.ts`, and new tests under `test/unit/` and `test/integration/`. This is
a code-changing session under `CLAUDE.md`: branch before the first edit and keep
it until the work is approved to land. `npm test` must be green before you
finish.
