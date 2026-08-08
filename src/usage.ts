export const USAGE = `msg — scaffold the msg planning workflow into a project

Usage
  msg init [options]            scaffold skills, docs, manifest and the sync engine
  msg check [--root <dir>]      verify every path named in project.yml exists
  msg add-area <slug> [--seed]  add one area and its rule doc to an existing project

init options
  --shape <s>     api | web | both | docs-only   (detected from the repo if omitted)
  --areas <a,b>   explicit area slugs; overrides --shape
  --seed          fill rule docs with the opinionated defaults
  --no-seed       leave rule docs empty (the default is to ask)
  --root <dir>    project root (default: cwd)
  -y, --yes       accept every detected default, never prompt

  -h, --help      show this
  -v, --version   print the version

Nothing is ever overwritten. Re-running init fills only the gaps.
`;
