import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ScaffoldEntry } from './description';

/**
 * What removal will do with one path.
 *
 * - `remove` — the bytes on disk are ours, delete it
 * - `strip` — ours is a marked region inside a file the project owns
 * - `kept-modified` — the user changed it, so it is theirs now and stays
 * - `absent` — nothing there, which a partly removed workspace makes normal
 */
export type Outcome = 'remove' | 'strip' | 'kept-modified' | 'absent';

/**
 * Identity is path plus byte-identical content. Matching one of the entry's
 * candidate bodies means we wrote it and nobody has touched it since; anything
 * else is the user's writing and is never deleted on a guess.
 *
 * Line endings are normalised first, the same way `check` does it, so a
 * workspace checked out with CRLF is not reported wholesale as modified.
 */
export function classifyFile(
  root: string,
  entry: Extract<ScaffoldEntry, { kind: 'file' | 'copied' }>,
): Outcome {
  const path = join(root, entry.path);
  if (!existsSync(path)) return 'absent';

  const actual = normalise(readFileSync(path, 'utf8'));
  return entry.candidates.some((candidate) => normalise(candidate) === actual)
    ? 'remove'
    : 'kept-modified';
}

export function normalise(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}
