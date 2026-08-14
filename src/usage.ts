export const USAGE = `msg — scaffold the msg planning workflow into a project

Usage
  msg init [options]            scaffold skills, docs, manifest and the sync engine
  msg check [--root <dir>]      verify every path named in project.yml exists
  msg add-area <slug> [--seed]  add one area and its rule doc to an existing project
  msg uninstall [options]       remove the scaffold from a project

init options
  --shape <s>     api | web | both | docs-only | skills-only
                  (detected from the repo if omitted)
  --areas <a,b>   explicit area slugs; overrides --shape
  --skills <a,b>  portable skill names for --shape skills-only
  --auth          include the auth area (the default; asked when interactive)
  --no-auth       leave auth out — no sessions, guards or sign-in in the docs
  --seed          fill rule docs with the opinionated defaults
  --no-seed       leave rule docs empty (the default is to ask)
  --root <dir>    project root (default: cwd)
  -y, --yes       accept every detected default, never prompt

  --shape skills-only skips areas, auth, seed, project.yml, the docs/ folders
  and the CLAUDE.md block, and instead writes just the picked skills under
  .claude/skills/ — for cherry-picking a portable skill without the rest of
  the planning workflow.

uninstall options
  --root <dir>    project root (default: cwd)
  --dry-run       print the plan and remove nothing
  -y, --yes       skip the confirmation prompt

  -h, --help      show this
  -v, --version   print the version

Nothing is ever overwritten. Re-running init fills only the gaps.

A file you have modified is never removed — uninstall names it and leaves it.
Only what init wrote, byte for byte, goes; the CLAUDE.md and Makefile blocks are
cut out between their markers rather than deleted with the file. Uninstall runs
only when the version in project.yml matches the CLI in hand, because that is
the only set of templates the comparison is sound against; on a mismatch it
names the version to run instead.
`;
