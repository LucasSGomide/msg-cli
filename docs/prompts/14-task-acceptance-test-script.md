# Goal: Make task acceptance require a per-item `test-script.md` runbook alongside the ticked criteria, and gate landing on both

**Status:** executed on 2026-08-30
**Rating:** —

## Context

Today a task is "accepted" by exactly one act: ticking the boxes under its
`## Acceptance criteria` heading. `templates/hooks/acceptance-criteria-gate.sh`
enforces it at the ship moment — `but land`, a `git merge`, or a `git push` at
the target branch is blocked while any task file under `docs/tasks/*/` still
holds an unticked box — and `/msg-roadmap-sync` derives every status from those
same boxes.

That is enough to prove the automated tests were written. It is not enough to
prove the feature works. Nobody records how a human (or an agent driving a
browser or a terminal) actually exercises the thing end to end: which container
to bring up, which seed script to run, which request to fire, which screen to
click through, and what should come back. That knowledge lives only in the
implementing session, and it dies with it.

So acceptance grows a second half: a **`test-script.md`** in the roadmap item's
task folder — `docs/tasks/<item>/test-script.md`, one per item, beside the
existing `openapi.json` and `README.md`. It is a hand-run runbook, not test
code, and it never replaces the `(unit)` / `(integration)` / `(e2e)` criteria —
it sits next to them.

**Who writes it and when.** The agent implementing a task writes that task's own
section as the last step before ticking its criteria boxes — it is the only
party that knows the real port, the real seed command, the real route. The first
task in a folder creates the file with its `## Setup` and `## Teardown`
sections; each later task appends its own section and, if a step it needs was
already written, reuses it rather than restating it.

**The shape.** Every line is a checkbox holding one concrete action and the
observable result it must produce — a command to run, data to seed, a request to
send, or a click path through the app. A reader starting from a clean checkout
runs it top to bottom:

```markdown
# Test script — NN Roadmap item title

## Setup

- [ ] `docker compose up -d db` — postgres answers on 5432
- [ ] `npm run seed:monsters` — 11 rows in `monster`

## 01 — Task title

- [ ] `curl -sX POST localhost:3000/captures -d '{"monsterId":1}'` → `201`, body carries `id`
- [ ] Repeat the same request → `409`, still one row in `captures`

## 02 — Task title

- [ ] Sign in as `demo@local`, open **Captures** → the seeded capture is listed
- [ ] Delete it → row disappears without a reload, list shows the empty state

## Teardown

- [ ] `docker compose down -v`
```

A step is ticked only after it has actually been run. "Verify the endpoint
works" is not a step; the request, the expected status and the expected body
are.

**The gate.** `acceptance-criteria-gate.sh` grows a second check on the same
ship moment: for every task folder under `docs/tasks/*/` that holds at least one
numbered task file, `test-script.md` must exist and must have no unticked box
anywhere in it. Missing file and unticked steps are both blockers, both named in
the refusal message. Routine `but commit` / `git commit` stay unblocked, exactly
as now.

The change lands in the scaffolded payload — the hook, the breakdown skill that
documents acceptance, the CLAUDE.md block that states the rule to implementing
agents, and the tasks README — plus the tests that cover them.

## Constraints

1. Scope is the scaffolded payload only:
   `templates/hooks/acceptance-criteria-gate.sh`,
   `templates/skills/msg-roadmap-task-breakdown/SKILL.md`,
   `templates/project/claude-block.md`, `templates/project/tasks-README.md`,
   and `test/`. Do not add or change hooks in msg-cli's own
   `.claude/settings.json`.
2. Extend the existing gate hook — no new hook file, and therefore no change to
   `src/core/settingsJson.ts` or the uninstall/strip path. Keep the filename
   `acceptance-criteria-gate.sh` and its current `PreToolUse` / `Bash` wiring.
3. `templates/` ships byte-identical: never bundled, formatted, or linted.
   Hand-write the shell to match the existing hooks — `#!/usr/bin/env bash`,
   `set -euo pipefail`, payload read from stdin via `jq`, dependencies limited
   to `bash` and `jq`.
4. Leave `templates/scripts/roadmap-sync.mjs` untouched. Its `isNumberedDoc`
   filter (`/^[0-9].*\.md$/`) already skips `test-script.md`, and the file must
   stay outside derived state — no status, no table, no column ever computed
   from it.
5. The task-breakdown skill still writes no test script. It documents the
   obligation: rename or extend its "Who ticks the boxes" section so acceptance
   means *tick every box **and** write this task's section into
   `test-script.md`*, and add the file to the task-folder shape it describes.
   The skill never creates the file at planning time.
6. `claude-block.md` must carry enough on its own for an implementing agent that
   reads nothing else: the file's location, the shape above, who appends what,
   and the extended gate. Rewrite the "Acceptance criteria before landing"
   section rather than bolting a paragraph on.
7. Ticked checkboxes stay sacred. An implementer appends its own section and may
   add a shared Setup step it needs; it never rewrites, reorders, unticks, or
   deletes another task's section. Say this in the skill and in the block.
8. The test script is additive verification, never a substitute for an
   acceptance criterion. Do not relax, reword, or expand the existing
   `(unit)` / `(integration)` / `(e2e)` / `(manual)` rules — in particular
   `(manual)` stays rare and stays banned for anything testable.
9. Out of scope: `msg-roadmap-task-review` (it audits plans, and cannot edit a
   task that already has ticked boxes), the sync engine's tables, and any new
   column on the item or tasks README.
10. `npm run typecheck` and `npm test` pass. Extend
    `test/integration/hooks.test.ts` to cover the new gate behaviour: blocked on
    a missing `test-script.md`, blocked on an unticked step, allowed when both
    checks pass, and still never blocking a plain commit.

## Output

An extended `templates/hooks/acceptance-criteria-gate.sh`, an updated
`templates/skills/msg-roadmap-task-breakdown/SKILL.md`, a rewritten acceptance
section in `templates/project/claude-block.md`, an updated
`templates/project/tasks-README.md`, and extended tests under `test/`.
