---
name: msg-pre-roadmap
description: Turn a raw feature idea into recorded user needs and functional requirements — brainstorm, close gaps, optionally research, then write requirements. Use before msg-roadmap-plan-item, when there's a feature name but nothing shaped like requirements yet.
---

# Pre-roadmap: idea to requirements

The phase before `msg-roadmap-plan-item`. Takes a feature name, ends with rows
in the requirements log. Runs in the main thread, not a subagent — every step
but the research one is a live interview.

**Read `project.yml` first.** If there is no `project.yml`, stop and tell the
user to run `npx @lucas-gomide/msg-cli init`. If `project.yml` has no
`requirementsFile` key, stop and say that key is missing — don't guess a path
(it means an install that predates that manifest addition).

## Argument

Takes a feature name: `/msg-pre-roadmap <feature name>`. Bare invocation asks
for the feature name before anything else.

## Modules and features

A **module** is the umbrella a feature belongs to — e.g. "Admin Management"
holds the "Read Users", "Edit Users", and "Delete Users" features. `UN`/`FR`
numbering is scoped to the **module**, not the feature: the first feature
recorded under a module starts at `UN.1`, and every later feature added under
that same module continues the count instead of restarting. Two different
modules never share a number sequence.

## Flow

1. **Determine the module.** Read the requirements file (if it exists) and
   check whether an existing `Module` value fits this feature. Ask the user
   with one `AskUserQuestion` call: reuse the matching existing module
   (recommended, when one plausibly fits), or name a new one. Never assume —
   confirm even an obvious match.
2. **Brainstorm.** Invoke `msg-brainstorm` for the feature idea. Let it run at
   its own stated defaults (`high` effort, `med` verbosity) — don't override.
3. **Close gaps.** Invoke `msg-grill-me` at `high` effort / `med` verbosity,
   stated explicitly, to walk whatever branches the brainstorm surfaced. Stop
   once the project view for this feature is settled.
4. **Offer research.** One `AskUserQuestion` call: research common
   frameworks/libraries, best practices, and pitfalls for this kind of
   feature, or skip straight to requirements. Mark a recommended option, but
   never default to yes without the user picking it — this step is genuinely
   optional.
   - If yes: spawn a subagent (Task tool) scoped to this one research pass —
     it uses `WebSearch`/`WebFetch`, has no back-and-forth with the user, and
     reports back a summary. It is not a reusable researcher; don't build it
     as one.
   - If no: continue straight to step 5.
5. **Write requirements.** This is the last step — no separate requirements
   skill. Refine the settled project view (plus research findings, if any)
   into user needs and functional requirements, and append them to the file
   named by `requirementsFile` in `project.yml` (default
   `docs/requirements.md`), following its table:

   | Module | Feature | User Need Code | User Need Details | Functional Requirement Code | Functional Requirement Details | Addition Date |
   | ------ | ------- | --------------- | ------------------ | ---------------------------- | -------------------------------- | -------------- |

   - **Module** — the module settled in step 1, exactly as it already appears
     in the table when reused.
   - **Feature** — the feature name, exactly as given (or settled during the
     brainstorm), used later for `msg-roadmap-plan-item`'s gate-check lookup.
   - **User Need Code** — `UN.<n>`, scoped to the module (see above). Find the
     highest existing `UN.<n>` for this module in the table and continue from
     there; if the module is new, start at `UN.1`.
   - **Functional Requirement Code** — `FR.<un-number>.<sequence>`, nested
     under its user need. One need can have several requirements; a
     requirement names exactly one need.
   - **Addition Date** — today, `YYYY-MM-DD`.
   - One row per need or requirement. Never renumber or rewrite an existing
     row for another feature or module — this file only grows.
6. **Hand off.** Tell the user the feature now has requirements recorded and
   that `msg-roadmap-plan-item` is the next step. Do not invoke it — the user
   decides when to move on.

## How to talk

Short sentences, plain words. Lead with the point. No recap of what the user
just said.
