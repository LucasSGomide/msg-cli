# Goal: Create a skill to author semantic commits with smart file ordering and grouping

**Status:** executed on 2026-08-28
**Rating:** —

## Context

The msg-commit skill commits staged changes following semantic commit conventions, automatically ordering files by dependency and grouping related changes intelligently. It prioritizes files changed during the current agent session but offers the user a choice if other files have uncommitted changes. The skill analyzes code imports to build a dependency graph, so files are committed from lowest to highest dependency. Within each logical group, commits are separated if changes are semantically distinct (e.g., a feature addition and a bug fix go into separate commits). After computing the full commit plan, the skill shows the user all proposed commits for confirmation before executing them.

## Constraints

1. Commit message format must follow semantic versioning: `<type>(<context>): <message>` where type is one of: `feat`, `chore`, `refactor`, `fix`, `docs`, `test`. Context is a module or library name (e.g., `api`, `shared`, `web`).
2. Never include co-author or Co-Authored-By lines in commit messages.
3. Commit messages must be concise and direct—no filler, no narrative.
4. Commits must be ordered from lowest-dependency files to highest-dependency files, as determined by analyzing code imports.
5. Related files should be grouped into single commits when they have the same semantic change type; separate them into different commits if change types differ.
6. The skill must list all proposed commits with their file lists before asking the user to confirm, giving the user a chance to review and abort.
7. Support both GitButler (`but` command) and conventional git (`git` command) as the commit tool. The skill should auto-detect which is available or ask the user.

## Output

A skill prompt (instructions for an agent to follow when implementing the msg-commit skill). The prompt should be actionable by a language model or developer and include:
- How to detect the commit tool (GitButler vs. git)
- How to discover and prioritize changed files
- How to analyze code imports for dependency ordering
- How to group files semantically and separate by change type
- How to generate commit messages
- How to present the commit plan and ask for confirmation
- How to execute commits in dependency order

## Examples

**Commit format examples:**
- `feat(api): add user authentication endpoint`
- `fix(shared): resolve type mismatch in validation helper`
- `refactor(web): simplify state management in dashboard component`
- `docs(cli): update command reference for msg-commit`

**File ordering example:**
Given files: `utils.ts` (imported by `api.ts` and `web.ts`), `api.ts` (imported by `server.ts`), `web.ts` (standalone), `server.ts` (main entry)
- Commit order: `utils.ts`, then `api.ts`, then `web.ts`, then `server.ts`

**Grouping example:**
Given changes to `userController.ts` (new endpoint), `userSchema.ts` (new validation), `logger.ts` (bug fix):
- Group 1 (feature): `userController.ts` + `userSchema.ts` → `feat(api): add user authentication`
- Separate commit (fix): `logger.ts` → `fix(shared): handle async logging errors`
