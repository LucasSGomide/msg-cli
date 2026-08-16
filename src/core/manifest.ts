// The engine's parser, not a second one: the CLI and the vendored engine must
// never disagree about what a manifest says.
import { parseSimpleYaml } from '../../templates/scripts/roadmap-sync.mjs';
import { AREAS, AREA_SLUGS, type AreaSlug } from './areas';

export const MANIFEST = 'project.yml';

/** The name to tell a user to `npx`, when the running version is the wrong one. */
export const PACKAGE = '@lucas-gomide/msg-cli';

export const STRUCTURE: ReadonlyArray<readonly [string, string]> = [
  ['roadmap', 'docs/roadmap/'],
  ['tasks', 'docs/tasks/'],
  ['explorations', 'docs/explorations/'],
  ['ditched', 'docs/ditched/'],
];

/**
 * The single append-only log of user needs and functional requirements. Not a
 * rule doc — it's tracked content, so it lives as its own top-level key rather
 * than under `areas`.
 */
export const REQUIREMENTS_FILE = 'docs/requirements.md';

const HEADER = `# Project manifest. The msg-roadmap skills read this and nothing else about
# where things live — which is what makes them portable.
#
# Every entry under \`areas\` points at the doc holding that area's rules. The
# key is also the bold bullet prefix a roadmap item's Key Areas section must
# use, so adding an area here adds it to the planning vocabulary.
#
# \`requirementsFile\` is different: it's a single append-only log of user needs
# and functional requirements, not a rule doc.`;

export function renderManifest(areas: readonly AreaSlug[], version: string): string {
  const lines = [HEADER, '', `msg_version: ${version}`, '', 'structure:'];
  for (const [key, value] of STRUCTURE) lines.push(`  ${key}: ${value}`);
  lines.push('', 'areas:');
  for (const slug of areas) {
    const area = AREAS[slug];
    lines.push(`  ${area.label}: ${area.doc}`);
  }
  lines.push('', `requirementsFile: ${REQUIREMENTS_FILE}`);
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

function parse(manifest: string): Map<string, unknown> {
  return parseSimpleYaml(manifest.replace(/\r\n?/g, '\n')) as Map<string, unknown>;
}

export interface RecordedVersion {
  /** null when the manifest predates the field, or carries it empty. */
  readonly recorded: string | null;
  readonly matches: boolean;
}

/**
 * Identity is path plus byte-identical content, and that comparison is only
 * sound against the templates that actually wrote the workspace — so a caller
 * that is about to delete something has to know the versions agree first.
 *
 * A manifest with no `msg_version` is a mismatch rather than a pass: it was
 * written before the field existed and its templates are unknown.
 */
export function readRecordedVersion(manifest: string, running: string): RecordedVersion {
  const value = parse(manifest).get('msg_version');
  const recorded = typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  return { recorded, matches: recorded !== null && recorded === running };
}

export function versionMismatchMessage(recorded: string | null): string {
  if (recorded === null) {
    return `error: ${MANIFEST} records no msg_version — the templates that wrote this workspace are unknown, so nothing can be removed safely`;
  }
  return `error: this workspace was scaffolded by ${recorded} — run \`npx ${PACKAGE}@${recorded} uninstall\` instead`;
}

/**
 * The areas a workspace actually installed, read back off its `areas:` block by
 * doc path rather than by label — the label is prose a user could have retyped,
 * the path is what everything else keys on.
 */
export function manifestAreas(manifest: string): AreaSlug[] {
  const areas = parse(manifest).get('areas');
  if (!(areas instanceof Map)) return [];
  const docs = new Set((areas as Map<string, string>).values());
  return AREA_SLUGS.filter((slug) => docs.has(AREAS[slug].doc));
}
