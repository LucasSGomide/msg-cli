import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AREAS, type AreaSlug } from './areas';
import { MANIFEST, renderManifest } from './manifest';
import { ENGINE_SRC, SKILLS, SKILLS_DIR, readDocTemplate, readProjectTemplate } from './templates';

/**
 * How an entry got onto disk, because removal treats each differently: a whole
 * file is deleted, an appended block is cut out of a file the project owns, and
 * a copied file is compared against its source rather than a rendered template.
 */
export type EntryKind = 'file' | 'appended' | 'copied';

interface BaseEntry {
  /** Relative to the project root, always with forward slashes. */
  readonly path: string;
  /**
   * Every body this entry could legitimately hold. The first is what `init`
   * writes for the options given; the rest exist because `project.yml` does not
   * record which `--seed` answer was used, so a rule doc has two originals.
   */
  readonly candidates: readonly [string, ...string[]];
}

export type ScaffoldEntry =
  | (BaseEntry & { readonly kind: 'file' })
  | (BaseEntry & { readonly kind: 'copied'; readonly source: string })
  | (BaseEntry & { readonly kind: 'appended'; readonly marker: string });

export interface DescriptionOptions {
  readonly areas: readonly AreaSlug[];
  readonly seed: boolean;
  readonly version: string;
}

export const FOLDER_READMES: ReadonlyArray<readonly [string, string]> = [
  ['docs/roadmap', 'roadmap-README.md'],
  ['docs/explorations', 'explorations-README.md'],
  ['docs/ditched', 'ditched-README.md'],
  ['docs/tasks', 'tasks-README.md'],
];

export const MAKEFILE_MARKERS = ['# --- msg-roadmap:start', '# --- msg-roadmap:end'] as const;
export const CLAUDE_MARKERS = ['<!-- msg-roadmap:start -->', '<!-- msg-roadmap:end -->'] as const;

/**
 * What a scaffolded workspace consists of. `init` writes this list and
 * `uninstall` reads it, so neither can drift from the other — and the order is
 * the order both of them report in.
 */
export function describeScaffold(options: DescriptionOptions): readonly ScaffoldEntry[] {
  const { areas, seed, version } = options;
  const entries: ScaffoldEntry[] = [];

  entries.push({ path: MANIFEST, kind: 'file', candidates: [renderManifest(areas, version)] });

  for (const [folder, template] of FOLDER_READMES) {
    entries.push({
      path: `${folder}/README.md`,
      kind: 'file',
      candidates: [readProjectTemplate(template)],
    });
  }

  for (const slug of areas) {
    entries.push({ path: AREAS[slug].doc, kind: 'file', candidates: ruleDocBodies(slug, seed) });
  }

  entries.push({
    path: 'scripts/roadmap-sync.mjs',
    kind: 'copied',
    source: ENGINE_SRC,
    candidates: [readFileSync(ENGINE_SRC, 'utf8')],
  });

  entries.push({
    path: 'Makefile',
    kind: 'appended',
    marker: 'roadmap-sync:',
    candidates: [readProjectTemplate('Makefile.block')],
  });

  entries.push({
    path: 'CLAUDE.md',
    kind: 'appended',
    marker: CLAUDE_MARKERS[0],
    candidates: [claudeBlock(areas)],
  });

  for (const skill of SKILLS) {
    const source = join(SKILLS_DIR, skill, 'SKILL.md');
    entries.push({
      path: `.claude/skills/${skill}/SKILL.md`,
      kind: 'copied',
      source,
      candidates: [readFileSync(source, 'utf8')],
    });
  }

  return entries;
}

/** The marker pair delimiting an appended block, by the file it lands in. */
export function markersFor(path: string): readonly [string, string] {
  return path === 'Makefile' ? MAKEFILE_MARKERS : CLAUDE_MARKERS;
}

/**
 * The seeded content is a starting point the project then owns outright: no
 * version stamp, no upstream link, nothing reconciles it later.
 *
 * Both bodies are returned, the one `init` writes first. Which of the two a
 * workspace actually got is not recorded anywhere, so removal has to accept
 * either as ours.
 */
function ruleDocBodies(slug: AreaSlug, seed: boolean): readonly [string, string] {
  const area = AREAS[slug];
  const seeded = readDocTemplate(area.seed);
  const stub = readProjectTemplate('rule-doc.md')
    .replaceAll('{{Label}}', area.label)
    .replaceAll('{{label}}', area.label.toLowerCase());
  return seed ? [seeded, stub] : [stub, seeded];
}

export function claudeBlock(areas: readonly AreaSlug[]): string {
  const table = areas
    .map((slug) => `- **${AREAS[slug].label}** — \`${AREAS[slug].doc}\``)
    .join('\n');
  return readProjectTemplate('claude-block.md').replace('{{areas}}', table);
}
