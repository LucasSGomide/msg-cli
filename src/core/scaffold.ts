import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { AreaSlug } from './areas';
import { describeScaffold, describeSkills, type ScaffoldEntry } from './description';
import { Recorder } from './fs';
import { addTopLevelKey, EXPECTED_TOP_LEVEL_KEYS, MANIFEST } from './manifest';

export interface ScaffoldOptions {
  readonly root: string;
  readonly areas: readonly AreaSlug[];
  readonly seed: boolean;
  readonly version: string;
}

export function scaffold(options: ScaffoldOptions): Recorder {
  return applyEntries(options.root, describeScaffold(options));
}

/**
 * Fill in the top-level keys an existing manifest is missing, and nothing else.
 *
 * This is the one place the never-overwrite rule bends, and the narrow scope is
 * what keeps the promise true: only absent top-level keys, appended textually,
 * with every existing value, comment and ordering left exactly as the user
 * wrote it. Gaps inside `structure:` and `areas:` are deliberately left alone.
 *
 * Records nothing when there is nothing missing, so a re-run reports the
 * manifest the way it always did rather than claiming a write.
 */
export function healManifest(root: string): Recorder {
  const rec = new Recorder(root);
  const path = join(root, MANIFEST);
  if (!existsSync(path)) return rec;

  const original = readFileSync(path, 'utf8');
  let text = original;
  for (const [key, value] of EXPECTED_TOP_LEVEL_KEYS) {
    text = addTopLevelKey(text, key, value) ?? text;
  }

  if (text === original) return rec;
  writeFileSync(path, text, 'utf8');
  rec.record(path, 'appended');
  return rec;
}

/** The `--shape skills-only` path: just the picked skills, nothing else. */
export function scaffoldSkills(root: string, skills: readonly string[]): Recorder {
  return applyEntries(root, describeSkills(skills));
}

function applyEntries(root: string, entries: readonly ScaffoldEntry[]): Recorder {
  const rec = new Recorder(root);

  for (const entry of entries) {
    const target = join(root, entry.path);
    switch (entry.kind) {
      case 'file':
        rec.writeIfAbsent(target, entry.candidates[0]);
        break;
      case 'copied':
        rec.copyIfAbsent(entry.source, target);
        break;
      case 'appended':
        rec.createOrAppend(target, entry.candidates[0], entry.marker);
        break;
    }
  }

  return rec;
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
