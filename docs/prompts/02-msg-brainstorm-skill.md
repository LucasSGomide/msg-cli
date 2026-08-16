# Goal: Build a new `msg-brainstorm` skill for open-ended idea exploration

**Status:** not executed
**Rating:** —
**Run:** parallel with 01 — no shared files

## Context

msg-cli scaffolds `.claude/skills/*` planning skills into projects. Today,
`msg-grill-me` interviews a user to resolve an *existing* decision tree —
branches the caller already knows about — down to shared understanding. It
assumes there's a plan with forks to walk.

We need a different, earlier step: when the user has a project or feature idea
but no plan yet, `msg-brainstorm` explores what the idea even is — the problem,
who it's for, why now — before there's anything shaped like a decision tree.
Divergent first (generate/explore), then convergent (narrow to a project view),
which is why it can't just be `msg-grill-me` run at low effort: grill-me's
question style assumes branches to walk, not ideas to generate.

This is **prompt 2 of 4**, depends on prompt 1 (manifest) only by not needing
anything from it — it can be built in parallel with or independently of
prompt 1. Prompt 3 (`msg-pre-roadmap`) is the orchestrator that calls this
skill as its first phase, then hands off to `msg-grill-me` itself to close any
remaining gaps/loose ends once there's an actual project view with branches to
resolve. `msg-brainstorm` itself does not call `msg-grill-me` — that handoff is
`msg-pre-roadmap`'s job, not this skill's.

Reference `.claude/skills/msg-grill-me/SKILL.md` for the existing interaction
pattern this skill should feel like a sibling of, and
`.claude/skills/msg-write-prompt/SKILL.md` for how a sibling skill documents its
own effort/verbosity defaults.

## Constraints

1. New skill directory `.claude/skills/msg-brainstorm/` (and its counterpart
   under `templates/skills/msg-brainstorm/` — every existing skill is mirrored
   there per the current repo layout) with a `SKILL.md`.
2. Every question uses the `AskUserQuestion` tool: 3 options plus 1 clearly
   marked recommended, free text always available — same rule `msg-grill-me`
   follows. One question at a time.
3. Default effort `high`, default verbosity `med` — stated explicitly in the
   skill, not inferred per-call the way `msg-grill-me` infers from the caller's
   wording. A caller (like `msg-pre-roadmap`) can still override both.
4. Scope the skill strictly to brainstorming: explore the idea, the problem it
   solves, who it's for, why now, and rough shape. It does **not** attempt to
   close every loose end or resolve every branch — that's explicitly left to
   whatever calls it next. Say this boundary in the skill's own doc so it
   doesn't scope-creep into `msg-grill-me`'s job later.
5. Output is a short prose/bullet summary of the project view reached — not a
   file write. `msg-pre-roadmap` (prompt 3) is what persists anything to disk.
6. Follow the same "how to talk" register as the other `msg-*` skills: short
   sentences, plain words, no filler, lead with the point (see
   `.claude/skills/msg-roadmap-plan-item/SKILL.md`'s "How to talk" section for
   the house style).
7. The skill's `description` frontmatter must state a clear trigger condition
   distinct from `msg-grill-me`'s, so the two don't both fire on the same
   request (e.g. "use when there's an idea but no plan yet" vs. `msg-grill-me`'s
   "use when there's a plan/design to stress-test").

## Output

A new skill: `.claude/skills/msg-brainstorm/SKILL.md` (plus its
`templates/skills/msg-brainstorm/SKILL.md` mirror). No CLI/manifest code
changes — this is a skill file only, like the other `msg-*` skills.
