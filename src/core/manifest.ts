import { AREAS, type AreaSlug } from './areas';

export const MANIFEST = 'project.yml';

export const STRUCTURE: ReadonlyArray<readonly [string, string]> = [
  ['roadmap', 'docs/roadmap/'],
  ['tasks', 'docs/tasks/'],
  ['explorations', 'docs/explorations/'],
  ['ditched', 'docs/ditched/'],
];

const HEADER = `# Project manifest. The msg-roadmap skills read this and nothing else about
# where things live — which is what makes them portable.
#
# Every entry under \`areas\` points at the doc holding that area's rules. The
# key is also the bold bullet prefix a roadmap item's Key Areas section must
# use, so adding an area here adds it to the planning vocabulary.`;

export function renderManifest(areas: readonly AreaSlug[], version: string): string {
  const lines = [HEADER, '', `msg_version: ${version}`, '', 'structure:'];
  for (const [key, value] of STRUCTURE) lines.push(`  ${key}: ${value}`);
  lines.push('', 'areas:');
  for (const slug of areas) {
    const area = AREAS[slug];
    lines.push(`  ${area.label}: ${area.doc}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Append one area under the existing `areas:` block, textually. Never a
 * re-serialise: the manifest is hand-edited and carries comments explaining
 * what each area means, and round-tripping it through a parser would drop them.
 *
 * Returns null when the label is already present, so the caller can report a
 * no-op rather than writing an identical file.
 */
export function addAreaLine(manifest: string, slug: AreaSlug): string | null {
  const area = AREAS[slug];
  const entry = `  ${area.label}: ${area.doc}`;

  if (new RegExp(`^\\s+${escapeRegExp(area.label)}:`, 'm').test(manifest)) return null;

  const match = /^areas:[^\n]*$/m.exec(manifest);
  if (!match) {
    throw new Error(`${MANIFEST}: no \`areas:\` block to add to`);
  }

  // Walk to the end of the block: indented or blank lines belong to it, and a
  // blank run at the end belongs to whatever follows.
  const lines = manifest.split('\n');
  const start = manifest.slice(0, match.index).split('\n').length; // 0-based index after `areas:`
  let end = start;
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (/^[ \t]/.test(line) && line.trim() !== '') end = i + 1;
    else if (line.trim() !== '') break;
  }

  lines.splice(end, 0, entry);
  return lines.join('\n');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
