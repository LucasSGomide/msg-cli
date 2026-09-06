# Goal: Make `msg` harness-agnostic so `init` and `uninstall` support both Claude Code and Codex

**Status:** executed on 2026-09-06
**Rating:** —

## Context

The CLI currently assumes Claude Code everywhere: it writes `CLAUDE.md`,
installs skills and hooks under `.claude/`, merges hook configuration into
`.claude/settings.json`, emits Claude-style skill invocations, and hardcodes
those paths in `.gitignore`, uninstall planning, documentation, and tests.

Refactor that Claude-specific behavior behind a harness boundary and add Codex
as the second supported harness. A user must be able to choose `claude` or
`codex` during `msg init`; the generated project must use that harness's native
instruction, skill, and hook locations; and `msg uninstall` must identify the
installed harness and remove only the matching msg-owned artifacts. Keep the
planning docs, manifest, Makefile block, and roadmap sync engine shared because
they describe the msg workflow rather than an agent product.

Use the current official Codex documentation as the source of truth while
implementing the adapter. In particular, Codex loads project instructions from
`AGENTS.md`, repository skills from `.agents/skills`, and repository hook
configuration from `.codex/hooks.json` or `.codex/config.toml`:

- https://learn.chatgpt.com/docs/agent-configuration/agents-md
- https://learn.chatgpt.com/docs/build-skills
- https://learn.chatgpt.com/docs/hooks

Read the existing flow before changing it: `src/cli.ts`,
`src/commands/init.ts`, `src/commands/uninstall.ts`,
`src/core/description.ts`, `src/core/scaffold.ts`, `src/core/plan.ts`,
`src/core/settingsJson.ts`, `src/core/gitignore.ts`, `src/core/templates.ts`,
`src/prompts.ts`, and `src/usage.ts`.

## Constraints

1. Introduce one public harness vocabulary: `claude` and `codex`. Add
   `--harness <claude|codex>` to `msg init` and `msg uninstall`. Reject unknown
   values as usage errors and call the concept “harness” consistently in code,
   help text, prompts, and command output.

2. Harness selection for `init` follows this order:
   - an explicit `--harness` wins;
   - an existing full scaffold uses the harness recorded in `project.yml`;
   - a legacy manifest with no harness field means `claude`, preserving every
     project created before this change;
   - a new interactive init asks which harness to use;
   - a new non-interactive init with no flag keeps `claude` as the backwards-
     compatible default, including `-y`.
     Print the selected harness in the normal `init` summary.

3. Record the selected harness as a top-level field in every full scaffold's
   `project.yml`, and add a focused parser for it alongside the existing
   manifest readers. Do not round-trip or reformat a hand-edited manifest.
   Treat a missing field as legacy Claude rather than healing it silently.
   If a later `init --harness` conflicts with the recorded harness, stop with
   an actionable error instead of leaving two half-installed harnesses. A
   harness migration is not part of this change.

4. Model harness-specific behavior in one registry or adapter abstraction used
   by both description/scaffolding and removal planning. It must own at least:
   the project-instructions filename and block renderer, the skill directory,
   the hook directory, the hook-config path and merge/strip behavior, rendered
   skill references, and the harness-specific `.gitignore` paths. Do not spread
   new `if (harness === ...)` path literals across commands.

5. Preserve Claude behavior and file content unless a change is required to
   pass through the new abstraction. Claude remains:
   - project guidance in the marked block in `CLAUDE.md`;
   - skills under `.claude/skills/<skill>/SKILL.md`;
   - scripts under `.claude/hooks/`;
   - structurally merged hooks in `.claude/settings.json`.
     Existing Claude projects must remain idempotent, uninstallable, and covered
     by the current tests rather than being forced through a migration.

6. The Codex adapter must produce only Codex-native agent artifacts:
   - the equivalent marked planning-workflow block in `AGENTS.md`;
   - skills under `.agents/skills/<skill>/SKILL.md`;
   - hook scripts under `.codex/hooks/`;
   - structurally merged lifecycle configuration in `.codex/hooks.json`.
     A fresh Codex init must not create `CLAUDE.md`, `.claude/skills`,
     `.claude/hooks`, or `.claude/settings.json`.

7. Make the installed skills operational in each harness, not merely copied to
   a different directory. Audit all `templates/skills/msg-*` references to
   other skills and all harness-specific agent/tool language. Render explicit
   Claude invocations as `/msg-*` and Codex invocations as `$msg-*`, or use
   genuinely neutral wording where that is clearer. Keep one canonical skill
   source where practical; if rendering is required, make it deterministic and
   test the generated Claude and Codex variants.

8. Codex hooks must preserve the intent of all four existing guards: branch
   creation before code edits, recording branch creation after a shell command,
   acceptance checks before landing, and roadmap-breakdown retirement after a
   land or merge. Do not blindly reuse Claude environment assumptions or hook
   output contracts. Adapt the scripts/configuration to Codex's documented
   stdin fields, tool names, blocking response, and stable repository-root
   resolution. Keep Claude's current hook behavior unchanged.

9. Generalize the structural hook-config code. It must merge msg's handlers
   into an existing user-owned Claude or Codex configuration without deleting,
   reordering, or replacing unrelated keys, matcher groups, or handlers.
   Uninstall must strip only msg's own handlers and delete the config file only
   when nothing else remains. Invalid user-owned configuration stays untouched
   and is reported rather than guessed at.

10. Full-scaffold uninstall reads the recorded harness automatically; users
    should not have to repeat `--harness`. If an explicit uninstall flag
    conflicts with the manifest, fail safely. For `--shape skills-only`, which
    intentionally has no manifest, infer the harness from the installed
    msg-owned skill directory. If both harnesses are present or neither can be
    identified safely, make no changes and require `--harness`. Remove and
    prune directories only for the selected harness, leaving artifacts owned
    by the other harness untouched.

11. Preserve the current ownership and safety rules for both adapters: msg
    overwrites its own `msg-*` skills on re-init, never overwrites user-owned
    files or blocks, reports modified files as kept, plans before deleting,
    respects `--dry-run`, and removes only byte-identical files or its own
    structurally identifiable blocks. `init` and `uninstall` must continue to
    derive their path lists from the same descriptions so they cannot drift.

12. Make `.gitignore` rendering harness-aware. The `skills` and `hooks` groups
    must name the selected harness's paths, while the docs and Makefile groups
    remain shared. Re-running init, edited-block detection, skills-only mode,
    and uninstall cleanup must retain their current semantics for both
    harnesses. A Codex install must not add `.claude/*` ignore entries.

13. Keep the full and `--shape skills-only` init paths working for both
    harnesses. The common scaffold is still created once, portable-skill
    validation still uses the canonical skill list, and package contents must
    continue to include every template needed at runtime.

14. Add tests at the narrowest useful levels, including:
    - CLI parsing, interactive selection, non-interactive defaults, invalid
      harnesses, and conflicting flags/recorded values;
    - manifest rendering and legacy-Claude fallback;
    - description/path parity for each adapter;
    - fresh, repeated, and skills-only init for Claude and Codex;
    - Codex `AGENTS.md`, skill references, hook paths, hook-config merge, and
      hook-config strip behavior;
    - full and skills-only uninstall for each harness, including ambiguous
      skills-only detection and preservation of the other harness;
    - harness-aware `.gitignore` blocks and edited-block protection;
    - built-package integration coverage for at least one Codex init/uninstall
      round trip.

15. Update `README.md`, `src/usage.ts`, package description/keywords where
    appropriate, and any comments or tests that describe msg as Claude-only.
    Document the flag, interactive choice, Claude compatibility default,
    generated paths for both harnesses, automatic uninstall selection, and the
    deliberate “uninstall then re-init” path for changing harnesses.

16. Do not redesign the roadmap data model, shapes, areas, sync engine, or
    planning workflow. This change makes their agent-facing installation layer
    portable; it does not change what the workflow means.

## Output

TypeScript and template changes that introduce the harness adapter, add the
Codex implementation, wire harness selection through `init` and `uninstall`,
and update tests and user documentation. This is a code-changing session under
`CLAUDE.md`: create the required dedicated branch before the first code edit
and keep it until the work is approved to land. Run formatting checks,
typechecking, the full test suite, and the production build before finishing.
