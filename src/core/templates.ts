import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

/** The skills a scaffolded project gets. grill-me is here because
 * msg-roadmap-plan-item invokes it directly — without it the pipeline breaks on
 * a fresh machine. */
export const SKILLS = [
  'msg-setup',
  'msg-roadmap-plan-item',
  'msg-roadmap-task-breakdown',
  'msg-roadmap-task-review',
  'msg-roadmap-sync',
  'grill-me',
] as const;

export function readProjectTemplate(name: string): string {
  return readFileSync(join(PROJECT_DIR, name), 'utf8');
}

export function readDocTemplate(name: string): string {
  return readFileSync(join(DOCS_DIR, name), 'utf8');
}
