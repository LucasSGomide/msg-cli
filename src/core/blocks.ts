import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { normalise, type Outcome } from './classify';
import { markersFor, type ScaffoldEntry } from './description';

export interface StripResult {
  readonly outcome: Outcome;
  /** What the file should hold afterwards. Unchanged for anything but `strip`. */
  readonly content: string;
}

/**
 * The inverse of `createOrAppend`. `CLAUDE.md` and `Makefile` are appended to
 * files the project already owns, so this is the one place removal edits rather
 * than deletes — and the block's extent is exactly its marker pair, never a
 * guess. A missing marker means the user edited our block into something we
 * cannot measure, which is how a Makefile loses a target.
 */
export function stripBlock(
  content: string,
  block: string,
  markers: readonly [string, string],
): StripResult {
  const [START, END] = markers;
  const unchanged = { outcome: 'kept-modified' as const, content };

  const startIdx = content.indexOf(START);
  if (startIdx === -1) return unchanged;

  // Searching from the start marker means an end marker that only appears
  // before it reads as missing, which is what it is.
  const endIdx = content.indexOf(END, startIdx + START.length);
  if (endIdx === -1) return unchanged;

  let from = content.lastIndexOf('\n', startIdx) + 1;
  const lineEnd = content.indexOf('\n', endIdx + END.length);
  const to = lineEnd === -1 ? content.length : lineEnd + 1;

  if (trimEndNewlines(content.slice(from, to)) !== trimEndNewlines(leading(block).body)) {
    // Intact markers, different text between them: the user edited inside our
    // block, so the whole file is theirs.
    return unchanged;
  }

  // The template's own leading newlines are part of the block — without taking
  // them back, undoing an append leaves the blank line it introduced behind.
  for (let n = leading(block).newlines; n > 0 && from > 0 && content[from - 1] === '\n'; n -= 1) {
    from -= 1;
  }

  const remaining = content.slice(0, from) + content.slice(to);
  if (remaining.trim() === '') return { outcome: 'remove', content: '' };
  return { outcome: 'strip', content: remaining };
}

/** Classify an appended-block entry against the file on disk. */
export function classifyBlock(
  root: string,
  entry: Extract<ScaffoldEntry, { kind: 'appended' }>,
): StripResult {
  const path = join(root, entry.path);
  if (!existsSync(path)) return { outcome: 'absent', content: '' };

  const content = readFileSync(path, 'utf8');
  // Only `strip` writes, and only it needs the computed content back.
  const result = stripBlock(normalise(content), entry.candidates[0], markersFor(entry.path));
  return result.outcome === 'strip' ? result : { outcome: result.outcome, content };
}

function leading(block: string): { newlines: number; body: string } {
  const match = /^\n*/.exec(block)![0];
  return { newlines: match.length, body: block.slice(match.length) };
}

function trimEndNewlines(text: string): string {
  return text.replace(/\n+$/, '');
}
