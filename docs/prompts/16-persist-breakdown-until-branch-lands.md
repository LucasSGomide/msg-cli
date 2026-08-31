# Goal: Stop the sync engine from deleting a task breakdown as an automatic side effect of an item reaching done — a breakdown must survive until the work is actually merged

**Status:** executed on 2026-08-30
**Rating:** —

## Context

When an item's last acceptance criterion was ticked (or it was marked `done`),
`make roadmap-sync` retired `docs/tasks/<NN>-*/` — it printed a `retire` line and
`make roadmap-check` failed with `done, but docs/tasks/<NN>-*/ still exists` —
even though the item's branch was still unmerged and under review. Reviewers then
had no breakdown to check the implementation against, and getting it back meant
digging through git history. This bit item 04.

## Change

Decouple "retire the breakdown" from "item is done". Retire only on an explicit,
separate signal that the branch has landed. Absent that signal, `roadmap-sync`
and `roadmap-check` must treat a present-but-complete breakdown folder as valid,
not stale — no deletion, no check failure.

## Acceptance

- Ticking the final criterion of an item and running `make roadmap-sync` leaves
  `docs/tasks/<NN>-*/` untouched.
- `make roadmap-check` passes with a completed breakdown folder on disk for a
  `done` item whose branch is unmerged.
- Exactly one documented, explicit action retires the folder; it is never
  triggered by criterion or status changes alone.
- `SKILL.md` documents the new retire trigger and states that breakdowns persist
  through review and merge.

## What was built

**The signal — a `Landed:` / `Merged:` field in the roadmap item's header.**
Added as the last step of landing the branch: `**Landed:** <date>` for a
GitButler `but land`, `**Merged:** <date>` for a plain `git merge` / PR. Two
spellings of one signal; the value is a free-text note. `Landed` wins the message
wording if a doc somehow carries both. The engine stays git-free and doc-driven —
it never inspects branches, it reads the header like everything else.

**Engine (`templates/scripts/roadmap-sync.mjs`):**

- New `RoadmapItem.retiredBy` (`'Landed'` \| `'Merged'` \| `''`), read off the
  header; `isRetired(item)` is `Boolean(item.retiredBy)`.
- Deleted the `done, but docs/tasks/<NN>/ still exists — retire it` problem. A
  `done` item with a fully-ticked breakdown folder and no marker is now valid:
  no `problem`, silent `roadmap-check`.
- The `retire` advisory line and the matching problem now fire on
  `isRetired && status === 'done' && tasks.length` — the marker, not the status.
- New guard: marker present while status is not `done` →
  `marked landed/merged, but status is <x>, not done` (protects "ticked
  checkboxes are sacred" — a premature marker is flagged, never acted on).

**Docs:**

- `msg-roadmap-sync/SKILL.md` — "Retiring a shipped breakdown" rewritten around
  the marker; description and `problem`-line handling updated; a derivation-table
  row added.
- `templates/project/claude-block.md` — a "Retiring the breakdown after it lands"
  paragraph in the acceptance/landing block.
- `templates/project/roadmap-README.md` — a Rules bullet for the `Landed:` /
  `Merged:` field.
- `templates/project/tasks-README.md` — folder-lifecycle sentence corrected
  ("from breakdown until the item's branch lands").

**Tests:**

- `done-lingering-folder` fixture renamed to `done-unmerged-folder`; its golden
  is now green (the state it describes is valid).
- New fixtures: `landed-retire-folder` (`done` + `Landed:` + folder → `retire`
  line + problem) and `merged-unfinished` (`Merged:` + unticked box → the
  not-done guard, and coverage of the alternate spelling).

**The auto-stamp hook (added in the same branch).**
`templates/hooks/retire-breakdown-post.sh` — a `PostToolUse` hook on `Bash`,
wired through `src/core/settingsJson.ts` / `description.ts` / `templates.ts` and
installed by `msg init` like the other three hooks. When this session runs
`but land <ref>` or `git merge <ref>` (parsed from argv, not matched as a
substring) and `<ref>` carries a 1-4 digit run naming a `done` roadmap doc whose
breakdown folder still exists and has no marker, it stamps
`· **Landed:** <date>` / `· **Merged:** <date>` on that doc's header. It verifies
the commits are actually in the target (or that the branch is gone, as after a
successful `but land`) before writing, and no-ops on anything it cannot resolve.
The marker stays the source of truth — a project whose branches omit the item
number just adds it by hand. Covered by 11 cases in `test/integration/hooks.test.ts`.
