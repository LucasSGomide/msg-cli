# Requirements

Append-only log of user needs and functional requirements. Written by
`msg-pre-roadmap`, read by `msg-roadmap-plan-item`'s gate-check. Never edit or
delete a row — add new ones.

| Module | Feature | User Need Code | User Need Details | Functional Requirement Code | Functional Requirement Details | Addition Date |
| ------ | ------- | --------------- | ------------------ | ---------------------------- | -------------------------------- | -------------- |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | UN.1 | Someone who scaffolds a project with `msg init` needs the workspace to contain every skill the planning pipeline invokes, so `msg-roadmap-plan-item`'s requirements gate is reachable instead of a dead end. | — | — | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | — | — | FR.1.1 | `msg init` writes `.claude/skills/msg-pre-roadmap/SKILL.md` and `.claude/skills/msg-brainstorm/SKILL.md`, under the same never-overwrite rule as every other scaffolded file. | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | — | — | FR.1.2 | `msg uninstall` removes both files when they are byte-identical to what `init` wrote, and reports them as kept otherwise — inherited from `describeScaffold`, with no second list to maintain. | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | — | — | FR.1.3 | `msg init --shape skills-only` offers `msg-brainstorm` alongside `msg-grill-me` and `msg-write-prompt`, and `--skills msg-brainstorm` parses without a usage error. | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | UN.2 | A maintainer adding a skill template needs shipping to fail loudly when a template is unaccounted for, so a skill can never again exist in the repo but reach no user. | — | — | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | — | — | FR.2.1 | A test compares the folders in `templates/skills/` against the `SKILLS` list and fails when either side holds an entry the other lacks. | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | — | — | FR.2.2 | A test asserts every name in `PORTABLE_SKILLS` also appears in `SKILLS`. | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | UN.3 | Someone whose workspace was scaffolded before a manifest key existed needs re-running `init` to add that key, so newer skills stop refusing to run against a manifest that predates them. | — | — | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | — | — | FR.3.1 | `msg init` appends a top-level manifest key the running version expects but the existing `project.yml` lacks — today `requirementsFile` — textually, preserving existing content, comments and ordering, as `addAreaLine` already does for areas. | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | — | — | FR.3.2 | Healing never modifies or removes an existing value, and never fills gaps inside the `structure:` or `areas:` blocks. | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | — | — | FR.3.3 | `init` reports a healed manifest distinctly from created and kept files, so the user sees their `project.yml` was changed. | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | — | — | FR.3.4 | `msg uninstall` classifies a healed `project.yml` as user-modified: it is named in the report and left on disk, not deleted. | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | UN.4 | An agent working in a scaffolded repo needs the appended `CLAUDE.md` block to name the requirements log and the pre-roadmap-first order, so it does not follow a workflow description that omits the mandatory first step. | — | — | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | — | — | FR.4.1 | `templates/project/claude-block.md` names `docs/requirements.md` and states that planning starts with `msg-pre-roadmap` before `msg-roadmap-plan-item`. | 2026-08-17 |
| CLI Scaffolding | Pre-roadmap Skills in Init and Uninstall | — | — | FR.4.2 | Existing workspaces keep their current block — the marker is already present, so `init` does not re-append — and refreshing appended blocks in place is out of scope. | 2026-08-17 |
