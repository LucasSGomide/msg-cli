import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { AreaSlug } from '../../src/core/areas';
import { describeScaffold } from '../../src/core/description';
import { scaffold } from '../../src/core/scaffold';
import { readProjectTemplate } from '../../src/core/templates';

const VERSION = '9.9.9';
const AREAS: AreaSlug[] = ['design', 'naming'];
const dirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'msg-desc-'));
  dirs.push(dir);
  return dir;
}

function listFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else found.push(relative(root, path).split('\\').join('/'));
    }
  };
  walk(root);
  return found.sort();
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('describeScaffold', () => {
  it('yields one entry per path scaffold() writes, and no others', () => {
    const root = tempRoot();
    scaffold({ root, areas: AREAS, seed: false, version: VERSION });

    const described = describeScaffold({ areas: AREAS, seed: false, version: VERSION })
      .map((entry) => entry.path)
      .sort();

    expect(described).toEqual(listFiles(root));
  });

  it('marks the two appended blocks and nothing else as appended', () => {
    const entries = describeScaffold({ areas: AREAS, seed: false, version: VERSION });

    const kinds = new Set(entries.map((entry) => entry.kind));
    expect(kinds).toEqual(new Set(['file', 'copied', 'appended']));
    expect(entries.filter((entry) => entry.kind === 'appended').map((entry) => entry.path)).toEqual(
      ['Makefile', 'CLAUDE.md'],
    );
  });

  it.each([true, false])('matches what scaffold() writes byte for byte with seed: %s', (seed) => {
    const root = tempRoot();
    scaffold({ root, areas: AREAS, seed, version: VERSION });

    for (const entry of describeScaffold({ areas: AREAS, seed, version: VERSION })) {
      const written = readFileSync(join(root, entry.path), 'utf8');
      // Both blocks land in files that did not exist, so createOrAppend wrote
      // the block with its leading newlines stripped.
      const expected =
        entry.kind === 'appended' ? entry.candidates[0].replace(/^\n+/, '') : entry.candidates[0];
      expect(written, entry.path).toBe(expected);
    }
  });

  it('carries both rule-doc bodies, the one init writes first', () => {
    const seeded = describeScaffold({ areas: ['design'], seed: true, version: VERSION });
    const stubbed = describeScaffold({ areas: ['design'], seed: false, version: VERSION });

    const fromSeeded = seeded.find((entry) => entry.path === 'docs/design.md')!;
    const fromStub = stubbed.find((entry) => entry.path === 'docs/design.md')!;

    expect(fromSeeded.candidates).toHaveLength(2);
    expect([...fromSeeded.candidates].sort()).toEqual([...fromStub.candidates].sort());
    expect(fromSeeded.candidates[0]).not.toBe(fromStub.candidates[0]);
  });

  it('has an entry only for the areas given', () => {
    const paths = describeScaffold({ areas: ['naming'], seed: false, version: VERSION }).map(
      (entry) => entry.path,
    );
    expect(paths).toContain('docs/naming.md');
    expect(paths).not.toContain('docs/design.md');
  });
});

describe('Makefile.block', () => {
  const block = readProjectTemplate('Makefile.block');

  it('opens and closes with the msg-roadmap markers', () => {
    expect(block.trimStart().startsWith('# --- msg-roadmap:start')).toBe(true);
    expect(block.trimEnd().endsWith('# --- msg-roadmap:end')).toBe(true);
  });

  it('keeps the target createOrAppend tests for on re-run', () => {
    expect(block).toContain('roadmap-sync:');
  });
});
