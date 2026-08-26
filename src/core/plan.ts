import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { classifyBlock } from './blocks';
import { classifyFile, type Outcome } from './classify';
import {
  FOLDER_READMES,
  describeScaffold,
  describeSkills,
  type ScaffoldEntry,
} from './description';
import { MANIFEST, manifestAreas, readRecordedVersion, versionMismatchMessage } from './manifest';
import { PORTABLE_SKILLS } from './templates';

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
  // `--shape skills-only` writes no project.yml by design — there is nothing
  // to version-gate against, so a workspace missing one is a skills-only
  // scaffold (or nothing msg wrote at all) rather than an error on its own.
  if (!existsSync(manifestPath)) return buildSkillsOnlyPlan(root);

  const manifest = readFileSync(manifestPath, 'utf8');
  const { recorded, matches } = readRecordedVersion(manifest, running);
  if (!matches) return { ok: false, error: versionMismatchMessage(recorded) };

  const entries: PlanEntry[] = [];

  // An area the workspace never installed must not appear in the plan, so the
  // description is instantiated from what the manifest actually records. `seed`
  // is not recorded — the description carries both bodies for that reason.
  const areas = manifestAreas(manifest);

  for (const entry of describeScaffold({ areas, seed: false, version: running })) {
    entries.push(plan(root, entry));
  }

  // Directories `init` created. `scripts/` is deliberately absent: projects keep
  // their own scripts there, so it stays even when it ends up empty.
  const candidates = new Set<string>(['docs', '.claude', '.claude/skills', ...PLANNING_FOLDERS]);
  const { folders, warnings } = pruneFolders(root, entries, candidates);

  return { ok: true, plan: { entries, folders, warnings } };
}

/**
 * The `--shape skills-only` path: no manifest, so no version to gate on and no
 * `areas` to read. That is not a gap here the way it would be for the full
 * scaffold: each portable skill's SKILL.md is a single deterministic
 * candidate straight from the running templates, so `classifyFile`'s byte
 * comparison is exactly as safe without a recorded version — a skill written
 * by a different msg-cli version just reports `kept-modified` instead of
 * `remove`, the same conservative outcome a version mismatch produces
 * elsewhere.
 *
 * Every portable skill is checked, not just ones a caller might guess were
 * installed — nothing records which subset `--skills` picked, and an absent
 * file is a no-op here the same way it is for the full scaffold.
 */
function buildSkillsOnlyPlan(root: string): PlanResult {
  const entries = describeSkills(PORTABLE_SKILLS).map((entry): PlanEntry => ({
    path: entry.path,
    outcome: classifyFile(root, entry),
  }));

  if (entries.every((entry) => entry.outcome === 'absent')) {
    return { ok: false, error: `error: no ${MANIFEST} — nothing here was scaffolded by msg` };
  }

  const { folders, warnings } = pruneFolders(root, entries, new Set(['.claude', '.claude/skills']));
  return { ok: true, plan: { entries, folders, warnings } };
}

/**
 * Directories to remove once their files are gone, deepest first — shared
 * between the full scaffold and the skills-only one so both prune the same
 * way. `candidates` is mutated with whichever skill folders this plan is
 * actually removing.
 */
function pruneFolders(
  root: string,
  entries: readonly PlanEntry[],
  candidates: Set<string>,
): { folders: string[]; warnings: string[] } {
  const removed = new Set(entries.filter((e) => e.outcome === 'remove').map((e) => e.path));
  const folders: string[] = [];
  const warnings: string[] = [];

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

  return { folders, warnings };
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
