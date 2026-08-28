---
name: msg-commit
description: Commit uncommitted changes as an ordered set of semantic commits — lowest-dependency files first, grouped by change type — after showing the full plan for confirmation. Use when asked to commit work, "commit my changes", "make commits", "split this into commits", or "/msg-commit".
---

# Commit changes as an ordered set of semantic commits

Committing a session's work as one blob loses the structure of what changed.
This skill turns the uncommitted diff into several semantic commits, ordered so
each commit only depends on the ones before it, and split so a feature and a
bug fix never ride in the same commit. It computes the whole plan first, shows
it, and does nothing until the user confirms.

Invocation: `/msg-commit`. Bare, it works on everything uncommitted, giving the
files this session touched priority (see step 2). It never pushes and never
opens a pull request.

## 1. Detect the commit tool

- If `but` is on `PATH` and `but status` succeeds → use **GitButler**.
- Else if the working directory is a Git repo → use **git**.
- If both are available and the repo's `CLAUDE.md` or a version-control skill
  names one as the standard, follow that. If nothing says and both work, ask
  the user which to use before going further.

Every later step has a GitButler path and a git path; pick the one detected
here and don't mix them.

## 2. Discover the changed files

Collect every uncommitted change:

- **GitButler:** `but status -fv` for file and hunk IDs.
- **git:** `git status --porcelain` — note which paths are staged, which are
  unstaged, and which are untracked.

Then partition:

- **Session files** — the files this agent session edited. These are always in
  scope.
- **Other files** — anything else with uncommitted changes. If there are any,
  list them and ask the user: commit session files only, add specific ones, or
  include everything. Do not silently commit a file the user didn't touch and
  didn't approve.
- **git staging:** if the user has already staged a subset, treat that as the
  intended set, confirm it, and still surface anything unstaged or untracked.

## 3. Order by dependency

Build a commit order from lowest-dependency to highest-dependency file, judged
by imports **within the change set** only:

1. For each changed source file, read its `import` / `require` / `include` /
   `use` statements and resolve the ones that point at another file in the
   change set.
2. Add an edge `A → B` whenever A imports B.
3. Topologically sort: a file is committed only after every changed file it
   imports. Files that import nothing changed (shared helpers, types,
   constants) come first; entry points and mains come last.
4. **Cycles:** commit the files in the cycle together in one commit and note
   why. If that's not possible, order them by smallest inbound-edge count
   first and say the order is heuristic.
5. **Non-code files:** docs, config, and assets have no import edges. Place a
   test file in the same commit as the code whose behavior it verifies. Place
   a docs-only or config-only change next to the group it describes, or last
   if it stands alone.
6. If a file's language isn't recognized or the imports don't resolve, fall
   back to: shared/utility directories first, entry points last — and tell the
   user the order is a heuristic, not import-derived.

## 4. Group into commits

1. Give each changed file (or hunk) a change type from what the diff actually
   does — not the filename, not the branch name: `feat`, `fix`, `refactor`,
   `chore`, `docs`, `test`.
2. Put files in the same commit when they are one logical change **and** share
   a change type. A new endpoint plus its new schema → one `feat`. A new
   endpoint plus an unrelated bug fix in a helper → two commits.
3. Different change types never share a commit, even when the files are
   related.
4. Tests go with the behavior they verify: a feature and its tests are one
   commit typed `feat`. A test change unrelated to any code in this set is its
   own `test` commit.
5. If one file carries two change types, split it by hunk (step 7) so each
   part lands in the right commit.
6. Every commit must read as coherent on its own.

## 5. Write the commit messages

Format, exactly: `<type>(<context>): <message>`

- **type** — one of `feat`, `chore`, `refactor`, `fix`, `docs`, `test`.
- **context** — the module or library the commit is about, from the path the
  files share (`src/api/**` → `api`, `packages/shared/**` → `shared`,
  `apps/web/**` → `web`). If a group has no single shared module, that's a
  sign it should be split further.
- **message** — imperative mood, lowercase, no trailing period, one line. Say
  what changed. No filler: "update", "changes", "fixes", "misc" are not
  messages.
- No body unless a real decision needs recording; if you write one, it says
  *why*, not what.
- **Never** add `Co-Authored-By`, a co-author trailer, or any other trailer.

Examples:

- `feat(api): add user authentication endpoint`
- `fix(shared): resolve type mismatch in validation helper`
- `refactor(web): simplify dashboard state management`
- `docs(cli): update command reference for msg-commit`

## 6. Show the plan and confirm

Print the ordered plan — oldest commit first:

```
1. feat(api): add user authentication
   src/api/userSchema.ts
   src/api/userController.ts

2. fix(shared): handle async logging errors
   src/shared/logger.ts
```

Add a one-line note when the order isn't obvious (a cycle, a heuristic
fallback, a test grouped with a feature). Then ask the user to confirm, adjust,
or abort. Execute nothing until they confirm.

## 7. Execute in order

Commit oldest-first, in the confirmed order.

- **GitButler:** pick the branch per the repo's naming convention (ask if
  unknown). First commit: `but commit -b <branch> -m "<msg>" <file-ids…>` —
  this creates the branch. Each following commit repeats
  `but commit -b <branch> -m "<msg>" <file-ids…>`; they stack oldest-first.
  Use hunk IDs (`<file-id>:<hunk-id>`) when only part of a file belongs to a
  commit.
- **git:** `git reset` to clear the index, then per commit
  `git add -- <paths>` (or `git add -p <path>` for a partial file) followed by
  `git commit -m "<msg>"`.
- If any commit fails, stop and report — don't continue down the list.
- When all commits are made, show the result (`but status` or
  `git log --oneline`) and stop. Do not push or open a pull request.

## Rules

- Change type is read from the diff, never guessed from the filename or branch.
- Never commit a file the user excluded in step 2.
- Never add `Co-Authored-By` or any co-author / trailer line to a message.
- Commit-to-commit order follows imports within the change set; files inside
  one commit are atomic and need no internal ordering.
- A file with two change types is split by hunk, not committed whole.
- When import analysis can't run, say the order is heuristic — don't present a
  guess as derived.
- No push, no PR — this skill stops at local commits.
