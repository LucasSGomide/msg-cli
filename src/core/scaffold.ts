import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { AREAS, type AreaSlug } from './areas';
import { Recorder } from './fs';
import { MANIFEST, renderManifest } from './manifest';
import { ENGINE_SRC, SKILLS, SKILLS_DIR, readDocTemplate, readProjectTemplate } from './templates';

export interface ScaffoldOptions {
  readonly root: string;
  readonly areas: readonly AreaSlug[];
  readonly seed: boolean;
  readonly version: string;
}

const FOLDER_READMES: ReadonlyArray<readonly [string, string]> = [
  ['docs/roadmap', 'roadmap-README.md'],
  ['docs/explorations', 'explorations-README.md'],
  ['docs/ditched', 'ditched-README.md'],
  ['docs/tasks', 'tasks-README.md'],
];

export function scaffold(options: ScaffoldOptions): Recorder {
  const { root, areas, seed, version } = options;
  const rec = new Recorder(root);

  rec.writeIfAbsent(join(root, MANIFEST), renderManifest(areas, version));

  for (const [folder, template] of FOLDER_READMES) {
    rec.writeIfAbsent(join(root, folder, 'README.md'), readProjectTemplate(template));
  }

  for (const slug of areas) {
    rec.writeIfAbsent(join(root, AREAS[slug].doc), ruleDoc(slug, seed));
  }

  rec.copyIfAbsent(ENGINE_SRC, join(root, 'scripts', 'roadmap-sync.mjs'));

  rec.createOrAppend(
    join(root, 'Makefile'),
    readProjectTemplate('Makefile.block'),
    'roadmap-sync:',
  );

  rec.createOrAppend(join(root, 'CLAUDE.md'), claudeBlock(areas), '<!-- msg-roadmap:start -->');

  for (const skill of SKILLS) {
    rec.copyIfAbsent(
      join(SKILLS_DIR, skill, 'SKILL.md'),
      join(root, '.claude', 'skills', skill, 'SKILL.md'),
    );
  }

  return rec;
}

/**
 * The seeded content is a starting point the project then owns outright: no
 * version stamp, no upstream link, nothing reconciles it later.
 */
function ruleDoc(slug: AreaSlug, seed: boolean): string {
  const area = AREAS[slug];
  if (seed) return readDocTemplate(area.seed);
  return readProjectTemplate('rule-doc.md')
    .replaceAll('{{Label}}', area.label)
    .replaceAll('{{label}}', area.label.toLowerCase());
}

function claudeBlock(areas: readonly AreaSlug[]): string {
  const table = areas
    .map((slug) => `- **${AREAS[slug].label}** — \`${AREAS[slug].doc}\``)
    .join('\n');
  return readProjectTemplate('claude-block.md').replace('{{areas}}', table);
}

/**
 * Running `init` inside a package of a monorepo that already has a manifest
 * creates a second one, and the engine binds to the nearer — so say so before
 * writing anything.
 */
export function findAncestorManifest(root: string): string | null {
  let dir = dirname(root);
  for (;;) {
    if (existsSync(join(dir, MANIFEST))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
