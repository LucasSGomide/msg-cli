import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { UsageError } from './areas';

/**
 * Walk up to the package root rather than counting `../` hops. This module sits
 * two levels down in the repo (`src/core/`) but one level down in the published
 * tarball, where the bundler has flattened it into `dist/cli.js` — a fixed
 * relative path is correct in exactly one of those.
 *
 * templates/ is resolved at runtime and never bundled: the payload has to land
 * on disk byte-identical to what ships.
 */
function findPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'templates'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error('could not locate the msg-cli package root holding templates/');
    }
    dir = parent;
  }
}

export const TEMPLATES = join(findPackageRoot(), 'templates');

export const SKILLS_DIR = join(TEMPLATES, 'skills');
export const DOCS_DIR = join(TEMPLATES, 'docs');
export const PROJECT_DIR = join(TEMPLATES, 'project');
export const ENGINE_SRC = join(TEMPLATES, 'scripts', 'roadmap-sync.mjs');
export const HOOKS_DIR = join(TEMPLATES, 'hooks');
export const BRANCH_GUARD_PRE_SRC = join(HOOKS_DIR, 'branch-guard-pre.sh');
export const BRANCH_GUARD_POST_SRC = join(HOOKS_DIR, 'branch-guard-post.sh');
export const ACCEPTANCE_GATE_SRC = join(HOOKS_DIR, 'acceptance-criteria-gate.sh');

/**
 * The skills a scaffolded project gets, in pipeline order. msg-grill-me and
 * msg-brainstorm are here because msg-roadmap-plan-item and msg-pre-roadmap
 * invoke them directly — without them the pipeline breaks on a fresh machine.
 *
 * This list must stay set-equal to the folders under `templates/skills/`; a
 * name here with no folder crashes `init` at runtime, and a folder with no name
 * here silently never ships. `test/unit/skills.test.ts` asserts both directions.
 */
export const SKILLS = [
  'msg-setup',
  'msg-pre-roadmap',
  'msg-roadmap-plan-item',
  'msg-roadmap-task-breakdown',
  'msg-wireframes',
  'msg-sequence-diagrams',
  'msg-api-contracts',
  'msg-roadmap-task-review',
  'msg-roadmap-sync',
  'msg-brainstorm',
  'msg-grill-me',
  'msg-write-prompt',
  'msg-write-prompt-slides',
  'msg-commit',
] as const;

/**
 * The subset of SKILLS that doesn't read or write msg-cli's project structure
 * (project.yml, docs/roadmap, docs/tasks, …) and so can be scaffolded on its
 * own, without the rest of the planning workflow — see `msg init --shape
 * skills-only`.
 */
export const PORTABLE_SKILLS = [
  'msg-brainstorm',
  'msg-grill-me',
  'msg-write-prompt',
  'msg-write-prompt-slides',
  'msg-commit',
] as const;

export type PortableSkill = (typeof PORTABLE_SKILLS)[number];

export function isPortableSkill(value: string): value is PortableSkill {
  return (PORTABLE_SKILLS as readonly string[]).includes(value);
}

/**
 * Parse `--skills msg-grill-me,msg-write-prompt`. Unknown names are a usage
 * error rather than a silent skip, same reasoning as `parseAreas`.
 */
export function parsePortableSkills(raw: string): PortableSkill[] {
  const chosen = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');

  const unknown = chosen.filter((s) => !isPortableSkill(s));
  if (unknown.length) {
    throw new UsageError(
      `unknown skill(s) ${unknown.join(', ')}. Known: ${PORTABLE_SKILLS.join(', ')}`,
    );
  }
  return [...new Set(chosen as PortableSkill[])];
}

export function readProjectTemplate(name: string): string {
  return readFileSync(join(PROJECT_DIR, name), 'utf8');
}

export function readDocTemplate(name: string): string {
  return readFileSync(join(DOCS_DIR, name), 'utf8');
}
