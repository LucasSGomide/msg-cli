import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { AreaSlug } from './areas';
import { describeScaffold } from './description';
import { Recorder } from './fs';
import { MANIFEST } from './manifest';

export interface ScaffoldOptions {
  readonly root: string;
  readonly areas: readonly AreaSlug[];
  readonly seed: boolean;
  readonly version: string;
}

export function scaffold(options: ScaffoldOptions): Recorder {
  const { root } = options;
  const rec = new Recorder(root);

  for (const entry of describeScaffold(options)) {
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
