import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { UsageError } from './areas';
import { stripBlock } from './blocks';
import { normalise, type Outcome } from './classify';
import { MAKEFILE_MARKERS } from './description';
import { getHarness, type Harness } from './harness';

/**
 * `.gitignore` reuses the Makefile's comment-based marker pair — both files
 * treat `#` as a comment the same way, and the block is msg's own the same
 * way a Makefile target is: appended, never merged into the project's.
 */
export const GITIGNORE_MARKERS = MAKEFILE_MARKERS;

export const GITIGNORE_PATH = '.gitignore';

/**
 * The four things `init` can offer to ignore. Each maps to the exact paths
 * `describeScaffold` writes for it — see `src/core/description.ts` — so a
 * group here can only ever go stale alongside the scaffold it names.
 */
function groupsFor(selected: Harness | readonly Harness[]) {
  const harnesses = Array.isArray(selected) ? selected : [selected];
  const adapters = harnesses.map(getHarness);
  return {
    docs: { label: 'docs', lines: ['docs/', 'project.yml', 'scripts/roadmap-sync.mjs'] },
    skills: { label: 'skills', lines: adapters.flatMap((adapter) => adapter.gitignore.skills) },
    hooks: { label: 'hooks', lines: adapters.flatMap((adapter) => adapter.gitignore.hooks) },
    makefile: { label: 'Makefile', lines: ['Makefile'] },
  } as const satisfies Record<string, { label: string; lines: readonly string[] }>;
}

/** Backwards-compatible labels and Claude paths for callers that only render prompts. */
export const GITIGNORE_GROUPS = groupsFor('claude');

export type GitignoreGroup = keyof typeof GITIGNORE_GROUPS;

/** Canonical order: what a rendered block lists in, regardless of pick order. */
export const GITIGNORE_GROUP_ORDER = Object.keys(GITIGNORE_GROUPS) as GitignoreGroup[];

/** What the normal scaffold offers — every group. */
export const GITIGNORE_GROUPS_FULL: readonly GitignoreGroup[] = GITIGNORE_GROUP_ORDER;

/** What `--shape skills-only` offers — itself, all or nothing. */
export const GITIGNORE_GROUPS_SKILLS_ONLY: readonly GitignoreGroup[] = ['skills'];

function isGitignoreGroup(
  value: string,
  allowed: readonly GitignoreGroup[],
): value is GitignoreGroup {
  return (allowed as readonly string[]).includes(value);
}

/**
 * Parse `--gitignore docs,skills` or `--gitignore all`, against whichever
 * groups the current init path actually offers. An empty string is a
 * deliberate "ignore nothing", the same as an unticked checklist — only an
 * unrecognised group name is a usage error.
 */
export function parseGitignoreGroups(
  raw: string,
  allowed: readonly GitignoreGroup[],
): GitignoreGroup[] {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'all') return [...allowed];

  const chosen = trimmed
    .split(',')
    .map((g) => g.trim())
    .filter((g) => g !== '');

  const unknown = chosen.filter((g) => !isGitignoreGroup(g, allowed));
  if (unknown.length) {
    throw new UsageError(
      `unknown --gitignore group(s) ${unknown.join(', ')}. Known: ${allowed.join(', ')}, all`,
    );
  }
  return GITIGNORE_GROUP_ORDER.filter((g) => allowed.includes(g) && chosen.includes(g));
}

/** Render the block for one selection, always in the same canonical order. */
export function buildGitignoreBlock(
  groups: readonly GitignoreGroup[],
  harnesses: Harness | readonly Harness[] = 'claude',
): string {
  const definitions = groupsFor(harnesses);
  const lines = GITIGNORE_GROUP_ORDER.filter((g) => groups.includes(g)).flatMap(
    (g) => definitions[g].lines,
  );
  const [START, END] = GITIGNORE_MARKERS;
  return `\n${START}\n${lines.join('\n')}\n${END}\n`;
}

/** Every non-empty subset of `items`, order preserved. */
function nonEmptySubsets<T>(items: readonly T[]): T[][] {
  const subsets: T[][] = [];
  for (let mask = 1; mask < 1 << items.length; mask += 1) {
    subsets.push(items.filter((_, i) => (mask & (1 << i)) !== 0));
  }
  return subsets;
}

export interface GitignoreState {
  readonly outcome: Outcome;
  /**
   * For `strip`/`remove`, the file's content with our block already cut out —
   * what a rewrite appends the new block onto. Unused otherwise.
   */
  readonly content: string;
}

/**
 * What `.gitignore` holds relative to every block msg could have written for
 * `allowed` — any subset of its groups is ours, regardless of which subset a
 * past run actually picked, since nothing records that choice. Content that
 * matches none of them is the user's edit, and `kept-modified` here is what
 * both a rewrite and a removal treat as hands-off.
 */
export function classifyGitignore(
  path: string,
  allowed: readonly GitignoreGroup[],
  harnesses: Harness | readonly Harness[] = 'claude',
): GitignoreState {
  if (!existsSync(path)) return { outcome: 'absent', content: '' };

  const raw = readFileSync(path, 'utf8');
  const normalised = normalise(raw);
  if (!normalised.includes(GITIGNORE_MARKERS[0])) return { outcome: 'absent', content: raw };

  for (const groups of nonEmptySubsets(allowed)) {
    const result = stripBlock(
      normalised,
      buildGitignoreBlock(groups, harnesses),
      GITIGNORE_MARKERS,
    );
    if (result.outcome === 'strip' || result.outcome === 'remove') {
      return { outcome: result.outcome, content: result.content };
    }
  }
  return { outcome: 'kept-modified', content: raw };
}

/** `.gitignore` only ever means something inside a git checkout. */
export function isGitRepo(root: string): boolean {
  return existsSync(join(root, '.git'));
}
