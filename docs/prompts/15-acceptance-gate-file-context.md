# Goal: Rebuild `acceptance-criteria-gate.sh` so it decides from the file context of the change being shipped, instead of scanning every task file in the repository

**Status:** executed on 2026-08-30
**Rating:** —

## Context

`.claude/hooks/acceptance-criteria-gate.sh` is a `PreToolUse` hook on the `Bash`
matcher, wired in `.claude/settings.json`. Its job is real: `make roadmap-sync`
derives a roadmap item's status from the checkboxes beneath each task file's
`## Acceptance criteria`, so an item that ships with boxes left unticked still
reads as in progress forever after. The gate is meant to catch that at the one
moment it can be caught — the ship.

As written it does not distinguish *what is being shipped* from *what happens to
be in the repository*, and three defects follow from that. All three were found
and reproduced in a live session on 2026-08-30, not reasoned about:

1. **It scans every file under `docs/tasks/*/`.** Roadmap item 04 is
   `not-started` and its seven-slice breakdown has roughly forty unticked boxes —
   the correct state for an item nobody has begun. That breakdown blocked the
   landing of three entirely unrelated branches, and the only route through the
   gate was to tick boxes asserting a `character` table, migrations and endpoints
   that do not exist. A gate whose only escape is falsifying the record it
   protects is worse than no gate: it corrupts the sync engine it exists to keep
   honest.

2. **It reads the criteria from the working tree.** Under GitButler the working
   tree is every applied branch merged together, so a ship is judged by other
   branches' checkboxes rather than by the content that will actually land on the
   target. This was invisible until the scan was narrowed, then surfaced
   immediately: a throwaway repo where the shipping branch ticked its remaining
   box was still refused, because the check was reading the target's copy.

3. **It matches by grepping the raw command text.** Any command that merely
   *mentions* a trigger phrase trips it. Writing the commit message for the fix
   was blocked twice — first because the message contained the ship phrase, then
   again because it contained the merge phrase — and the message had to be
   reworded around its own subject matter to be committable.

A stopgap fix for defects 1 and 2 is already committed in the consuming
repository (`chore/acceptance-gate-file-context`). It resolves the branch from
the ship command's first non-flag argument, gates only the task files that branch
*modifies*, exempts newly added files, and reads content with `git show
<branch>:<path>`. It inherits defect 3 untouched, and this rebuild supersedes it.

The hard question: **how does the gate tell a breakdown whose boxes are correctly
unticked from an implementation whose boxes were forgotten?** "The branch
modified the file" is a proxy, not the signal, and item status cannot be the
discriminator — the sync engine derives status *from* the boxes.

## Constraints

1. The decision comes from the diff the ship actually carries — the branch or ref
   named by the command, compared against the configured target — never from a
   repository-wide walk. A ship that touches no task file is never gated.
2. Read each task file as it will exist on the target *after* the ship, with
   `git show <ref>:<path>`. Never read the working tree.
3. Detect the ship from the tool call's actual invocation, not from a substring
   of the command string. A commit message, a heredoc, a `grep` pattern or a
   filename that contains the words is not a ship.
4. Solve the breakdown-versus-implementation question explicitly and write the
   reasoning into the script's header comment. State plainly which cases the
   chosen signal cannot separate.
5. Never leave "tick a box for work that does not exist" as the only way past the
   gate. Where the gate cannot tell, it must fail toward letting the ship through
   and saying what it could not verify.
6. `bash`, `jq` and `git` only.
7. Ship a test harness with it — throwaway repositories asserting the matrix: an
   unrelated branch, a freshly authored breakdown, a branch that ticks some
   boxes, the same branch once all are ticked, and a command that merely mentions
   the trigger words.
8. Keep the failure message actionable — name the offending files, say why each
   one was in scope, and do not tell the reader to tick boxes when the real
   answer may be that the gate mis-scoped itself.

## What was built

**The signal (constraint 4).** The gate decides from *what the ship's diff does
to the checkboxes*, never from what files are in the repo and never from derived
status. The diff is `git diff <merge-base(target, ref)>..<ref>`; every task file
in it is read as `git show <ref>:<path>`.

| The ship's diff… | Verdict |
| --- | --- |
| touches no numbered task file | allowed |
| **adds** a numbered task file | exempt — a fresh breakdown is unticked by design |
| **modifies** one, ticks ≥1 acceptance box, a box still unticked after | **blocked** |
| **modifies** one, ticks a box, all ticked after | allowed |
| **modifies** one, ticks no box (prose, a new criterion) | allowed, noted on stderr |

`test-script.md` is required only for a folder the ship actually accepts a slice
into (ticked ≥1 box in one of its numbered files).

**The case the signal cannot separate:** a modifying ship that ticks some boxes
because it finished a slice, versus one that ticks some boxes but also adds a
genuinely-not-yet-done criterion for later work. Both are blocked; the honest
escapes are to tick what is done or to move the pending criteria onto their own
slice — never to tick a box for absent work.

**Ship detection (constraint 3).** The command is stripped of heredoc bodies and
line continuations, split into simple-command segments, and each segment's
`argv[0]`/`argv[1]` inspected: `but land`, `git merge`, or `git push` naming the
target short name. A `git commit` — with any `-m` / `-F` / heredoc payload — is
never a ship.

**Files changed:**

- `templates/hooks/acceptance-criteria-gate.sh` — rebuilt, reasoning in the
  header.
- `test/integration/hooks.test.ts` — the `acceptance-criteria-gate.sh` block
  rewritten to build throwaway git repos and assert the full matrix. `runHook`
  switched to `spawnSync` so stderr is captured on a clean exit (the gate's
  warn-without-block path).
- `templates/project/claude-block.md` — the "Acceptance before landing" gate
  paragraph rewritten to state what the gate does and does not catch.
- `templates/skills/msg-roadmap-task-breakdown/SKILL.md` and
  `templates/skills/msg-setup/SKILL.md` — gate one-liners updated.

`src/core/settingsJson.ts` and the uninstall/strip path are untouched: same
filename, same `PreToolUse` / `Bash` wiring. `templates/scripts/roadmap-sync.mjs`
is untouched.

## Rollout — how consuming repositories pick this up

The scaffolded hooks are `kind: 'copied'` **without** `owned: true` (see
`src/core/description.ts`), so `msg init` writes them only when absent and
**never replaces an existing copy**. A rebuilt hook does not reach a project that
already has one just by re-running `init`.

- **A project whose `acceptance-criteria-gate.sh` is byte-unmodified:** delete
  `.claude/hooks/acceptance-criteria-gate.sh` and run `npx @lucas-gomide/msg-cli
  init` — it fills the now-missing file with the new version. `.claude/settings.json`
  needs no change (same filename, same matcher). `msg uninstall && msg init` also
  works and is cleaner if several templates drifted.
- **The project that landed the local stopgap (`chore/acceptance-gate-file-context`):**
  its hook no longer matches any template, so `uninstall` would keep it as
  "yours". Delete the stopgap copy explicitly, run `msg init` to lay down the
  rebuilt hook, and drop the stopgap branch — this rebuild is its intended
  replacement and carries defect 3's fix, which the stopgap never had.

If hooks should upgrade automatically the way `msg-*` skills now do (commit
`271f303`), the durable fix is to mark the three hook entries `owned: true` and
extend the uninstall "msg's own, removed regardless" branch to cover them. That
is a deliberate change to the ownership model — out of scope here, recommended as
a follow-up.
