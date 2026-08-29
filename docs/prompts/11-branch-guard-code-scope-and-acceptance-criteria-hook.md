# Goal: Re-scope the scaffolded branch-guard hook to code edits, and add a hook that blocks landing an implementation with unticked acceptance criteria

**Status:** executed on 2026-08-29
**Rating:** —

## Context

`msg init` scaffolds two hooks into every project: `branch-guard-pre.sh` blocks
`Write`/`Edit`/`MultiEdit` to planning files (`docs/prompts/`, `docs/roadmap/`,
`docs/tasks/`) until the session has created a dedicated branch, and
`branch-guard-post.sh` sets the `/tmp/claude-branch-guard/<session>.created` flag
that lifts the block once a branch-creating command runs. The wiring lives in
`src/core/settingsJson.ts` — the `BRANCH_GUARD` array, structurally merged into
the target's `.claude/settings.json` — and the rule is documented in the
"Branch-first for planning work" section of `templates/project/claude-block.md`.

Two problems:

1. **Too many branches.** The guard fires on documentation and planning work —
   writing a prompt, editing a roadmap doc, breaking down tasks — spawning a
   dedicated branch for changes that never touch code. A branch should only be
   required once a code-changing implementation starts. Documentation and
   planning edits should not need a branch unless the user explicitly asks.

2. **Acceptance criteria get left unticked.** An implementation is sometimes
   landed or merged without ticking the acceptance-criteria checkboxes in its
   task file. The sync engine derives item status from those boxes, so a shipped
   item still reads as in-progress. Nothing stops this today.

The fix, applied to the scaffolded payload and its wiring only:

- **Re-scope `branch-guard-pre.sh`.** Stop guarding the `docs/` planning paths
  entirely. Instead block `Write`/`Edit`/`MultiEdit` to code — application
  source, libraries, tests, build/manifest/config files — until the session has
  created a dedicated branch. Keep `branch-guard-post.sh` and its
  `<session>.created` flag as the "branch exists" signal. Settle on the concrete
  path set that counts as code (e.g. `src/`, `lib/`, `app/`, `test/`, `tests/`,
  `*.config.*`, `package.json` and lockfiles, `Makefile`) and keep it easy to
  read in the script.

- **Add a new hook that gates landing.** A `PreToolUse` hook on `Bash` that
  inspects the command: when it lands or merges an implementation into the
  origin/target branch (`but land`, and a merge or push into the configured
  target branch), scan every task file under `docs/tasks/*/` for unticked
  checkboxes beneath a `## Acceptance criteria` heading. If any are found, block
  with `exit 2` and name the offending file(s). Routine checkpoint commits
  (`but commit`, `git commit`) are never blocked — only the ship/merge moment.

- **Wire both through `src/core/settingsJson.ts`.** Generalise the
  `BRANCH_GUARD` array (its own comment already anticipates a second hook) so the
  merge and the strip/uninstall path both cover the new `Bash` entry. Keep the
  merge structural and idempotent; never touch matcher groups or hooks the
  project already owns.

- **Rewrite the `claude-block.md` section** from "Branch-first for planning work"
  to describe the new trigger: a branch is required before the first code edit of
  an implementation, not before planning or documentation work.

- **Update the tests** in `test/` to cover the new `settingsJson` merge/strip
  entries and both hooks' behavior.

## Constraints

1. Scope is the scaffolded payload only: `templates/hooks/*.sh`,
   `src/core/settingsJson.ts`, `templates/project/claude-block.md`, and `test/`.
   Do not add the new hooks to msg-cli's own `.claude/settings.json`.
2. `templates/` ships byte-identical — never bundled, formatted, or linted.
   Hand-write the shell scripts to match the existing ones: `#!/usr/bin/env
   bash`, `set -euo pipefail`, read the tool payload from stdin via `jq`, key
   session state off `.session_id`.
3. The new gate hook depends on nothing beyond `bash` and `jq`, consistent with
   the existing hooks.
4. The `settingsJson.ts` merge stays structural and idempotent: add the new
   entry when absent, report `changed: false` when present, leave every
   unrelated key, matcher group, and hook untouched. The strip/uninstall path
   removes the new entry cleanly, collapsing now-empty groups exactly as it does
   today.
5. Do not block routine commits. The gate hook fires only on landing or merging
   into the target branch.
6. `npm run typecheck` and `npm test` pass. Leave
   `templates/scripts/roadmap-sync.mjs` untouched — this change does not go
   through the sync engine.

## Output

Edited shell hooks under `templates/hooks/` (one rewritten, one added), an
updated `src/core/settingsJson.ts`, a rewritten section in
`templates/project/claude-block.md`, and updated/added tests under `test/`.
