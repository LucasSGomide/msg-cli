import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { AREA_SLUGS, parseAreas, UsageError } from '../../src/core/areas';
import { addAreaLine, renderManifest } from '../../src/core/manifest';
import { areasForShape, detectShape, SHAPE_NAMES, supportsAuth } from '../../src/core/shapes';

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'msg-core-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('parseAreas', () => {
  it('accepts known slugs in the order written', () => {
    expect(parseAreas('naming,back-end')).toEqual(['naming', 'back-end']);
  });

  it('is case-insensitive and tolerates whitespace', () => {
    expect(parseAreas(' Back-End , naming ')).toEqual(['back-end', 'naming']);
  });

  it('dedupes', () => {
    expect(parseAreas('naming,naming')).toEqual(['naming']);
  });

  it('rejects an unknown slug rather than skipping it', () => {
    expect(() => parseAreas('back-end,mobile')).toThrow(UsageError);
    expect(() => parseAreas('back-end,mobile')).toThrow(/Known: /);
  });
});

describe('shapes', () => {
  it('maps every shape to known area slugs', () => {
    for (const shape of SHAPE_NAMES) {
      for (const slug of areasForShape(shape)) {
        expect(AREA_SLUGS).toContain(slug);
      }
    }
  });

  it('gives skills-only no areas at all', () => {
    expect(areasForShape('skills-only')).toEqual([]);
    expect(supportsAuth('skills-only')).toBe(false);
  });

  it('gives `both` every area', () => {
    expect(areasForShape('both').sort()).toEqual([...AREA_SLUGS].sort());
  });

  it('keeps docs-only to the two stack-neutral areas', () => {
    expect(areasForShape('docs-only')).toEqual(['design', 'naming']);
  });

  it('includes auth by default for every shape that can have it', () => {
    for (const shape of SHAPE_NAMES) {
      if (!supportsAuth(shape)) continue;
      expect(areasForShape(shape), shape).toContain('auth');
    }
  });

  it('drops only auth when auth is declined', () => {
    for (const shape of SHAPE_NAMES) {
      const kept = areasForShape(shape, false);
      expect(kept, shape).not.toContain('auth');
      expect(kept, shape).toEqual(areasForShape(shape).filter((slug) => slug !== 'auth'));
    }
  });

  it('never offers auth for docs-only — there is nothing to sign in to', () => {
    expect(supportsAuth('docs-only')).toBe(false);
    expect(areasForShape('docs-only', true)).toEqual(['design', 'naming']);
  });
});

describe('detectShape', () => {
  it('reads a monorepo with both packages as both', () => {
    const root = tempDir();
    mkdirSync(join(root, 'packages', 'api'), { recursive: true });
    mkdirSync(join(root, 'packages', 'web'), { recursive: true });
    expect(detectShape(root)).toBe('both');
  });

  it('reads an api-only package layout as api', () => {
    const root = tempDir();
    mkdirSync(join(root, 'packages', 'api'), { recursive: true });
    expect(detectShape(root)).toBe('api');
  });

  it('reads an index.html as web', () => {
    const root = tempDir();
    writeFileSync(join(root, 'index.html'), '', 'utf8');
    expect(detectShape(root)).toBe('web');
  });

  it('falls back to docs-only for an empty directory', () => {
    expect(detectShape(tempDir())).toBe('docs-only');
  });
});

describe('renderManifest', () => {
  it('lists the areas in the order given', () => {
    const manifest = renderManifest(['naming', 'back-end'], '1.2.3');
    const areas = manifest.slice(manifest.indexOf('areas:'));
    expect(areas.indexOf('Naming')).toBeLessThan(areas.indexOf('Back-end'));
  });

  it('carries the version and the four structure entries', () => {
    const manifest = renderManifest(['naming'], '1.2.3');
    expect(manifest).toContain('msg_version: 1.2.3');
    for (const folder of ['roadmap', 'tasks', 'explorations', 'ditched']) {
      expect(manifest).toContain(`  ${folder}: docs/${folder}/`);
    }
  });
});

describe('addAreaLine', () => {
  const base = renderManifest(['naming'], '1.0.0');

  it('appends inside the areas block', () => {
    const updated = addAreaLine(base, 'design')!;
    expect(updated).toContain('  Naming: docs/naming.md');
    expect(updated).toContain('  Design: docs/design.md');
    expect(updated.trimEnd().endsWith('  Design: docs/design.md')).toBe(true);
  });

  it('returns null when the label is already listed', () => {
    expect(addAreaLine(base, 'naming')).toBeNull();
  });

  it('preserves comments and everything above the block', () => {
    const updated = addAreaLine(base, 'design')!;
    expect(updated).toContain('# Project manifest.');
    expect(updated).toContain('structure:');
  });

  it('adds before trailing content that follows the block', () => {
    const manifest = 'areas:\n  Naming: docs/naming.md\n\n# a trailing note\n';
    const updated = addAreaLine(manifest, 'design')!;
    expect(updated).toBe(
      'areas:\n  Naming: docs/naming.md\n  Design: docs/design.md\n\n# a trailing note\n',
    );
  });

  it('throws when there is no areas block', () => {
    expect(() => addAreaLine('msg_version: 1.0.0\n', 'design')).toThrow(/no `areas:` block/);
  });
});
