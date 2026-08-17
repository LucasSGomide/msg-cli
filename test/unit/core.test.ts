import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { AREA_SLUGS, parseAreas, UsageError } from '../../src/core/areas';
import {
  addAreaLine,
  addTopLevelKey,
  EXPECTED_TOP_LEVEL_KEYS,
  renderManifest,
  REQUIREMENTS_FILE,
} from '../../src/core/manifest';
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

  it('carries requirementsFile as a top-level key, not nested under areas', () => {
    const manifest = renderManifest(['naming'], '1.2.3');
    expect(manifest).toMatch(/^requirementsFile: docs\/requirements\.md$/m);
  });
});

describe('addAreaLine', () => {
  const base = renderManifest(['naming'], '1.0.0');

  it('appends inside the areas block', () => {
    const updated = addAreaLine(base, 'design')!;
    expect(updated).toContain('  Naming: docs/naming.md');
    expect(updated).toContain('  Design: docs/design.md');
    // Lands right before the block that follows `areas:` (`requirementsFile`),
    // not at the end of the whole manifest.
    const areas = updated.slice(updated.indexOf('areas:'), updated.indexOf('requirementsFile:'));
    expect(areas.trimEnd().endsWith('  Design: docs/design.md')).toBe(true);
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

describe('addTopLevelKey', () => {
  // A manifest written before `requirementsFile` existed: hand-edited, with its
  // own comments, a trimmed `structure:` block and one area.
  const legacy = [
    '# Project manifest, hand-edited.',
    '#',
    '# Every entry under `areas` points at the doc holding that area rules.',
    '',
    'msg_version: 0.0.9',
    '',
    'structure:',
    '  roadmap: docs/roadmap/',
    '  tasks: docs/tasks/',
    '',
    'areas:',
    '  # the only rule doc this project kept',
    '  Naming: docs/naming.md',
    '',
    '# a trailing note',
    '',
  ].join('\n');

  const heal = (manifest: string): string =>
    addTopLevelKey(manifest, 'requirementsFile', REQUIREMENTS_FILE)!;

  it('gains exactly one line', () => {
    const healed = heal(legacy);
    expect(healed.split('\n').length).toBe(legacy.split('\n').length + 1);
    expect(healed).toContain(`requirementsFile: ${REQUIREMENTS_FILE}`);
  });

  it('lands after the areas block, matching renderManifest ordering', () => {
    const healed = heal(legacy);
    expect(healed.indexOf('requirementsFile:')).toBeGreaterThan(
      healed.indexOf('  Naming: docs/naming.md'),
    );
    // Same ordering `renderManifest` writes: after the last area entry, and
    // before anything that follows the block.
    expect(healed).toContain('  Naming: docs/naming.md\nrequirementsFile: docs/requirements.md\n');
    const rendered = renderManifest(['naming'], '1.0.0');
    expect(heal(rendered.replace(/^requirementsFile:.*\n/m, ''))).toContain(
      '  Naming: docs/naming.md\nrequirementsFile: docs/requirements.md\n',
    );
  });

  it('leaves every other byte of a commented, hand-edited manifest identical', () => {
    const healed = heal(legacy);
    expect(healed.replace(`requirementsFile: ${REQUIREMENTS_FILE}\n`, '')).toBe(legacy);
  });

  it('returns null when the manifest already carries the key', () => {
    expect(addTopLevelKey(heal(legacy), 'requirementsFile', REQUIREMENTS_FILE)).toBeNull();
  });

  it('does not fill in a missing structure entry', () => {
    const healed = heal(legacy);
    expect(healed).not.toContain('explorations: docs/explorations/');
    expect(healed).not.toContain('ditched: docs/ditched/');
    expect(healed.slice(healed.indexOf('structure:'), healed.indexOf('areas:'))).toBe(
      legacy.slice(legacy.indexOf('structure:'), legacy.indexOf('areas:')),
    );
  });

  it('does not fill in a missing areas entry', () => {
    const healed = heal(legacy);
    expect(healed).not.toContain('Design: docs/design.md');
    expect(healed).toContain('areas:\n  # the only rule doc this project kept\n  Naming:');
  });
});

describe('EXPECTED_TOP_LEVEL_KEYS', () => {
  it('carries requirementsFile', () => {
    expect(EXPECTED_TOP_LEVEL_KEYS).toContainEqual(['requirementsFile', REQUIREMENTS_FILE]);
  });

  it('does not carry msg_version — healing must not forge a provenance', () => {
    expect(EXPECTED_TOP_LEVEL_KEYS.map(([key]) => key)).not.toContain('msg_version');
  });
});
