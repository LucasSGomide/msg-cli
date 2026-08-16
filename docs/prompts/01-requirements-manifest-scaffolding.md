# Goal: Add a `requirementsFile` manifest entry and CLI scaffolding for a single, append-only requirements document

**Status:** not executed
**Rating:** —
**Run:** parallel with 02 — no shared files

## Context

msg-cli's `project.yml` is the manifest every skill reads and nothing else about
where things live (see `src/core/manifest.ts`, `.claude/skills/msg-setup/SKILL.md`).
It currently has two blocks: `structure` (folders with no rules — roadmap, tasks,
explorations, ditched) and `areas` (a key → rule-doc map, e.g. `Design:
docs/design.md`).

We're adding a third top-level manifest key, `requirementsFile`, pointing at a
single file — default `docs/requirements.md` — that is not a rule doc and not one
of the four planning folders. It's an append-only log of user needs and
functional requirements, written to by the future `msg-pre-roadmap` skill and
read by `msg-roadmap-plan-item`'s gate-check (both out of scope here — this
prompt only adds the manifest slot and the file's shape).

This is the **first of four dependent prompts**, in build order:

1. This one — manifest key + scaffolding (no dependents can reference the key
   until it exists)
2. `docs/prompts/02-msg-brainstorm-skill.md`
3. `docs/prompts/03-msg-pre-roadmap-skill.md`
4. `docs/prompts/04-plan-item-requirements-gate.md`

### The file's shape

One markdown file, one table, columns in this order:

| Feature | User Need Code | User Need Details | Functional Requirement Code | Functional Requirement Details | Addition Date |
| ------- | --------------- | ------------------ | ---------------------------- | -------------------------------- | -------------- |

- **Feature** — the feature name the row belongs to, exactly as later used for
  the gate-check lookup in prompt 4 (e.g. `Authentication and Authorization`).
- **User Need Code** — `UN.<n>`, numbered per feature, restarting at `UN.1` for
  every new feature name. `Authentication and Authorization`'s first need is
  `UN.1`; `Manager Portal`'s first need is also `UN.1`.
- **Functional Requirement Code** — `FR.<un-number>.<sequence>`, e.g. `UN.1`'s
  requirements are `FR.1.1`, `FR.1.2`, …. One user need can have N functional
  requirements; a functional requirement always names exactly one user need.
- **Addition Date** — the date the row was added, `YYYY-MM-DD`.

## Constraints

1. Add `requirementsFile: docs/requirements.md` as a new top-level key in
   `project.yml`, sibling to `structure` and `areas` — not nested under either.
   Update `renderManifest` in `src/core/manifest.ts` and the manifest's header
   comment to mention it.
2. `msg init` scaffolds `docs/requirements.md` with the table header row (no
   data rows) whenever the target doesn't already exist — same never-overwrite
   rule the rest of `init` follows (see `src/core/scaffold.ts`).
3. `msg check` (`src/commands/check.ts`) validates `requirementsFile` exists,
   same as it does today for every `structure` and `areas` path — extend its
   loop to also cover this new top-level key, not just `structure`/`areas`.
4. Update `.claude/skills/msg-setup/SKILL.md`'s "What `init` writes" list and
   its `project.yml` example to include `requirementsFile` and
   `docs/requirements.md`.
5. Update the vendored `templates/scripts/roadmap-sync.mjs` manifest parser
   only if it currently enumerates manifest keys by an explicit list rather
   than reading them generically — check before assuming a change is needed.
6. Do not add a `requirements` entry under `areas` — this is deliberately a
   different concept (tracked content, not a rule doc), per the earlier design
   discussion. Keep it a sibling top-level key.
7. `msg check`'s output format for the new key follows the existing per-line
   pattern (`  <label> -> <path>  ok|MISSING`) so its output stays uniform.

## Output

Code changes in `src/core/manifest.ts`, `src/commands/init.ts` (or
`src/core/scaffold.ts`, wherever file-writing lives), `src/commands/check.ts`,
and `.claude/skills/msg-setup/SKILL.md`. Include or update tests under `test/`
covering: manifest rendering includes the new key, `init` scaffolds the file
once and skips it on re-run, and `check` reports MISSING when the file is
deleted.
