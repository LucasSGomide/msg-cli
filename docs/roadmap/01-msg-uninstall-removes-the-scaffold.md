# 01 — `msg uninstall` removes the scaffold from a workspace

**Depends on:** — · **Status:** done · **Estimate:** 6

## Context

- `init` only ever adds. There is no way out: a user who tries msg and does not
  want it has to hand-delete eleven-plus paths, two appended blocks and six
  skill files.
- `Recorder` (`src/core/fs.ts:19`) knows what a run touched but nothing persists
  it, so removal cannot read a ledger — it reconstructs the same path list
  `scaffold()` writes.
- Overlap is the whole problem. `CLAUDE.md` and `Makefile` are appended to files
  the project already owns (`src/core/fs.ts:createOrAppend`), rule docs are
  seeded then filled in by hand, and the planning folders end up holding real
  authored work next to our READMEs. Deleting by path alone destroys all three.
- Decided: identity is **path + byte-identical content**. Matches the template →
  ours, remove. Differs → theirs, keep and say so. `project.yml` is the one
  exemption; it is hand-edited by design and leaving it behind means the
  workspace still claims to be msg-scaffolded.
- Decided: markers go on the two **appended blocks** only. Files init creates
  whole stay unstamped, so the "the project owns it outright" promise in
  `src/core/scaffold.ts:57` survives.
- Decided: the content check is only sound against the templates that wrote the
  workspace, so uninstall refuses to run on a version mismatch and names the
  version to use. No override flag — `0.1.0` (`package.json:3`) is unpublished,
  so no scaffolded workspace exists in the wild and there is nothing to migrate.
  The markers and `uninstall` ship together in the first release.
- Decided: only the installed version's templates are ever compared. Past
  template text is never carried, so anything unrecognised is reported as
  "remove by hand" rather than guessed at.

## Key Areas:

- **Naming** — command is `uninstall`, the inverse of `init`, not `clean-up`;
  `docs/naming.md` is still an empty stub, so this item owes it the first rule
  on CLI verb naming once it ships.
- **Design** — the run's report reuses the `  created` / `  kept    <path>
  (yours)` two-column line format `add-area` already prints
  (`src/commands/add-area.ts:48`); `docs/design.md` is an empty stub and owes a
  rule for it.

## Technical Details:

1. Add `# --- msg-roadmap:start` / `# --- msg-roadmap:end` markers around
   `templates/project/Makefile.block`, mirroring what
   `templates/project/claude-block.md` already carries. Nothing else gains a
   stamp.
2. Extract the path list out of `scaffold()` (`src/core/scaffold.ts:22`) into a
   shared description of what a scaffold consists of, so `init` writes and
   `uninstall` reads from one source rather than two drifting lists.
3. Gate the run on the version: read `msg_version` from `project.yml`, compare
   with `readVersion()` (`src/version.ts`), and on a mismatch exit 1 printing
   the exact command to run instead — `npx @lucas-gomide/msg-cli@<recorded>
   uninstall`. Make `msg check` print the recorded version too, so the answer
   is one command away before anything is deleted. Correct
   `templates/skills/msg-setup/SKILL.md:87`, which says nothing reads
   `msg_version`.
4. Add a `Planner` (or extend `Recorder`) that classifies one path into
   `remove` · `kept-modified` · `absent` by comparing on-disk bytes with
   `readProjectTemplate` / `readDocTemplate` / `ENGINE_SRC` output.
5. For rule docs, try both candidate bodies from `ruleDoc()`
   (`src/core/scaffold.ts:60`) — seeded and stub — because `project.yml` does
   not record which `--seed` answer was given.
6. Strip the `CLAUDE.md` block between `<!-- msg-roadmap:start -->` and
   `<!-- msg-roadmap:end -->`; if the file is empty afterwards, delete the file.
7. Strip the `Makefile` block between its new markers; if either marker is
   missing, classify `kept-modified` and leave the file. If the file is empty
   afterwards, delete the file.
8. Classify the four folder READMEs against `roadmap-README.md`,
   `explorations-README.md`, `ditched-README.md`, `tasks-README.md`; never
   touch numbered docs in those folders. Remove `docs/roadmap/`, `docs/tasks/`,
   `docs/explorations/`, `docs/ditched/` only when empty after the README goes.
9. Remove `scripts/roadmap-sync.mjs` and nothing else under `scripts/` — the
   directory stays even when it ends up empty, because projects keep their own
   scripts there.
10. Remove `project.yml` unconditionally, skipping the content check, and warn
    in the report when authored planning docs survived it.
11. Print the full plan — one line per path, `remove` or
    `kept — yours, remove by hand` — then prompt once to proceed, reusing the
    prompt helpers in `src/prompts.ts` and the cancellation path
    `src/cli.ts:83` already handles.
12. Wire `uninstall` into the `switch` in `src/cli.ts:60` with `--root`,
    `--dry-run` and `-y`, and add it to `USAGE` (`src/usage.ts`) with the
    "modified files are never removed" guarantee and the version rule.

### Technical References:

- `src/core/scaffold.ts:22` — the authoritative list of what a scaffold writes
- `src/core/fs.ts:19` — `Recorder`, the in-memory-only change log
- `src/core/fs.ts:createOrAppend` — the append-with-marker rule uninstall reverses
- `src/core/templates.ts:26` — `TEMPLATES` resolves against the installed package
- `src/core/templates.ts:36` — `SKILLS`, the six skill files copied into `.claude/skills/`
- `src/commands/add-area.ts:48` — the report line format to reuse
- `templates/project/claude-block.md` — start/end markers already present
- `templates/project/Makefile.block` — no end marker yet
- `src/cli.ts:60` — the command switch
- `src/usage.ts` — help text
- `src/core/manifest.ts:20` — where `msg_version` is written
- `src/version.ts` — `readVersion()`, the running version to compare against
- `package.json:3` — version `0.1.0`, unpublished; nothing is scaffolded in the wild
- `templates/skills/msg-setup/SKILL.md:87` — the stale "nothing reads `msg_version`" line

## As built

- Undoing an append is not "delete the marked lines". `createOrAppend` writes the
  block's own leading newline into the file, and leaving it behind means a second
  `init`/`uninstall` cycle grows a blank line each time. The stripper takes back
  as many leading newlines as the template carries, which is what makes the
  round-trip byte-identical rather than merely close.
- The two rule-doc bodies could not stay a special case in the classifier. Making
  every described entry carry a list of `candidates` — what `init` writes first,
  any other legitimate original after — meant the classifier never has to know
  which entry it is looking at.
- `seed` is not recorded in `project.yml` and the plan does not try to infer it:
  it instantiates the description with `seed: false` and relies on the candidate
  list, so both answers classify identically.
- Emptying a folder is recursive, not a per-folder check. `.claude/` holds six
  skill directories inside `.claude/skills/`, so "is it empty once its files go"
  had to be answered by walking children that are themselves removable. The same
  walk gives `scripts/` its exemption for free — it is simply not a candidate.
- The plan needed a fourth outcome. `remove` · `kept-modified` · `absent` cannot
  say "the file survives with our block cut out", and reporting that as `remove`
  would have been a lie about a file the project owns. `strip` carries the
  post-strip content so `--dry-run` and the real run are one code path.
- Declining the prompt exits 2, the same code as cancelling it. Both mean nothing
  was written, and a caller that has to tell them apart does not exist.

## Blockers:

- None. Both earlier unknowns are closed: `0.1.0` is unpublished
  (`package.json:3`), so the markers in step 1 and `uninstall` ship in the same
  release with no legacy shape to support, and the stale `msg_version` line
  (`templates/skills/msg-setup/SKILL.md:87`) is now step 3's job.
