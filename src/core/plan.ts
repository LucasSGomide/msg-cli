import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { classifyBlock } from './blocks';
import { classifyFile, type Outcome } from './classify';
import { FOLDER_READMES, describeScaffold, type ScaffoldEntry } from './description';
import { MANIFEST, manifestAreas, readRecordedVersion, versionMismatchMessage } from './manifest';

export interface PlanEntry {
  readonly path: string;
  readonly outcome: Outcome;
  /** Set only for `strip`: what the file holds once our block is cut out. */
  readonly content?: string;
  /** Why this entry is not the ordinary case, printed after the path. */
  readonly note?: string;
}

export interface Plan {
  readonly entries: readonly PlanEntry[];
  /** Directories to remove after the files, deepest first, and only if empty. */
  readonly folders: readonly string[];
  readonly warnings: readonly string[];
}

export type PlanResult =
  { readonly ok: true; readonly plan: Plan } | { readonly ok: false; readonly error: string };

/** Planning folders that hold authored work beside our README. */
const PLANNING_FOLDERS = FOLDER_READMES.map(([folder]) => folder);

/**
 * Every path a scaffolded workspace holds, and what removal will do with each.
 *
 * Pure: it reads the workspace and writes nothing, which is what makes
 * `--dry-run` the same code path as the real run.
 */
export function buildPlan(root: string, running: string): PlanResult {
  const manifestPath = join(root, MANIFEST);
  if (!existsSync(manifestPath)) {
    return { ok: false, error: `error: no ${MANIFEST} — nothing here was scaffolded by msg` };
  }

  const manifest = readFileSync(manifestPath, 'utf8');
  const { recorded, matches } = readRecordedVersion(manifest, running);
  if (!matches) return { ok: false, error: versionMismatchMessage(recorded) };

  const entries: PlanEntry[] = [];
  const folders: string[] = [];
  const warnings: string[] = [];

  // An area the workspace never installed must not appear in the plan, so the
  // description is instantiated from what the manifest actually records. `seed`
  // is not recorded — the description carries both bodies for that reason.
  const areas = manifestAreas(manifest);
  const removed = new Set<string>();

  for (const entry of describeScaffold({ areas, seed: false, version: running })) {
    const planned = plan(root, entry);
    entries.push(planned);
    if (planned.outcome === 'remove') removed.add(entry.path);
  }

  // Directories `init` created. `scripts/` is deliberately absent: projects keep
  // their own scripts there, so it stays even when it ends up empty.
  const candidates = new Set<string>(['docs', '.claude', '.claude/skills', ...PLANNING_FOLDERS]);
  for (const entry of entries) {
    if (entry.outcome === 'remove' && entry.path.startsWith('.claude/skills/')) {
      candidates.add(dirOf(entry.path));
    }
  }

  const goes = (dir: string): boolean =>
    contents(join(root, dir)).every((name) => {
      const child = `${dir}/${name}`;
      if (isDirectory(join(root, child))) return candidates.has(child) && goes(child);
      return removed.has(child);
    });

  for (const dir of candidates) {
    if (!existsSync(join(root, dir))) continue;
    if (goes(dir)) folders.push(dir);
    else if (PLANNING_FOLDERS.includes(dir)) {
      warnings.push(`  warning ${dir}/ stays — it still holds work you wrote`);
    }
  }

  // Deepest first, so a parent is only tried once its children are gone.
  folders.sort((a, b) => b.split('/').length - a.split('/').length);

  return { ok: true, plan: { entries, folders, warnings } };
}

function plan(root: string, entry: ScaffoldEntry): PlanEntry {
  // `project.yml` is the one exemption from the content check. It is hand-edited
  // by design, so comparing it would always report `kept-modified` — and a
  // workspace that keeps it still claims to be msg-scaffolded.
  if (entry.path === MANIFEST) {
    return existsSync(join(root, MANIFEST))
      ? { path: MANIFEST, outcome: 'remove', note: 'hand-edited by design, removed regardless' }
      : { path: MANIFEST, outcome: 'absent' };
  }

  if (entry.kind === 'appended') {
    const { outcome, content } = classifyBlock(root, entry);
    return outcome === 'strip'
      ? { path: entry.path, outcome, content }
      : { path: entry.path, outcome };
  }

  return { path: entry.path, outcome: classifyFile(root, entry) };
}

function contents(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir);
}

function isDirectory(path: string): boolean {
  return statSync(path).isDirectory();
}

function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}
