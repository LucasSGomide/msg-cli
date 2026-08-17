# Goal: Build the `msg-pre-roadmap` orchestrator skill

**Status:** executed on 2026-08-17
**Rating:** 8
**Run:** sequential — depends on 01, 02

## Context

msg-cli's planning flow today starts at `msg-roadmap-plan-item`, which assumes
the user already knows what they want built. We're adding a phase before that:
`msg-pre-roadmap`, a standalone skill the user (or `msg-roadmap-plan-item`'s
gate-check, see prompt 4) invokes explicitly for a given feature, that runs
end-to-end in the **main thread** — not a subagent — because every step up to
the research branch is a live interview, and a subagent can't hold that kind of
turn-by-turn back-and-forth.

Flow, in order:

1. **Brainstorm.** Invoke `msg-brainstorm` (prompt 2) to explore the feature's
   idea/goal at a high level.
2. **Close gaps.** Invoke `msg-grill-me` at `high` effort / `med` verbosity to
   walk whatever branches the brainstorm surfaced, until the project view for
   this feature is settled.
3. **Offer the research branch.** Ask the user (one `AskUserQuestion` call,
   recommended option marked) whether to research the topic: common
   frameworks/libraries, best practices, common pitfalls, standards typical for
   this kind of feature. If yes, spawn a **subagent** (Task tool) that uses the
   `WebSearch`/`WebFetch` tools to research and reports back a summary — this is
   the one step that runs isolated, because it's read-heavy with no user
   back-and-forth needed, unlike steps 1–2 and 4. Scope this subagent's
   capability to this flow only; it is not a reusable "researcher" skill (that
   was explicitly deferred, not because it's wrong, but because there's no
   second caller yet).
4. **Write requirements.** Refine the settled project view (plus research
   findings, if any) into user needs and functional requirements, and append
   them to the file named by `requirementsFile` in `project.yml` (prompt 1) —
   default `docs/requirements.md`. Follow the table format and numbering scheme
   prompt 1 defines: `UN.<n>` restarting per feature, `FR.<un-number>.<seq>`
   nested under its user need, one row per need/requirement, `Addition Date` set
   to today. This is the **last step of this skill** — no separate
   "requirements" skill, per the earlier design decision.
5. **Hand off.** Tell the user the feature now has requirements recorded and
   that `msg-roadmap-plan-item` is the next step. Do not invoke it automatically
   — the user decides when to move on.

This is **prompt 3 of 4**, depends on prompt 1 (the `requirementsFile` manifest
key must exist) and prompt 2 (`msg-brainstorm` must exist to be invoked).
Prompt 4 (plan-item's gate-check) depends on this one existing, so it can point
users here by name.

## Constraints

1. New skill directory `.claude/skills/msg-pre-roadmap/` and its
   `templates/skills/msg-pre-roadmap/` mirror, with a `SKILL.md`.
2. **Read `project.yml` first**, same rule every `msg-roadmap-*` skill follows —
   if there's no `project.yml`, stop and tell the user to run
   `npx @lucas-gomide/msg-cli init`. If `project.yml` has no `requirementsFile`
   key (an older install that predates prompt 1), stop and say what's missing
   rather than guessing a path.
3. Takes a feature name as an argument (`/msg-pre-roadmap <feature name>`).
   Bare invocation asks for the feature name before anything else — same
   pattern `msg-roadmap-plan-item` uses for a missing idea argument.
4. The research branch is genuinely optional — do not skip asking, and do not
   default to "yes" without the user picking it.
5. When appending to `docs/requirements.md`, never renumber or rewrite existing
   rows for other features — this file only grows, per row, per feature.
6. Follow the same "how to talk" house style as the other `msg-*` skills: short
   sentences, plain words, lead with the point, no recap of what the user just
   said.
7. State this skill's default effort/verbosity for its own `msg-grill-me` call
   (`high`/`med`, step 2) explicitly in the doc, the same way prompt 2 asks
   `msg-brainstorm` to state its own defaults.

## Output

A new skill: `.claude/skills/msg-pre-roadmap/SKILL.md` (plus its
`templates/skills/msg-pre-roadmap/SKILL.md` mirror). No CLI/manifest code
changes beyond what prompt 1 already added.
