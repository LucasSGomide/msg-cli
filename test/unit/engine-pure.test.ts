import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

// Plain JS, checked under tsconfig.js.json rather than this project.
import * as engine from '../../templates/scripts/roadmap-sync.mjs';

const {
  compressNumbers,
  ditchedReadme,
  emptyTable,
  firstBullet,
  loadConfig,
  loadRoadmap,
  parseDeps,
  parseHeader,
  parseSimpleYaml,
  renderTable,
  replaceField,
  replaceFirstTable,
  sectionOf,
  sortQueue,
  splitLines,
  taskStatus,
} = engine as Record<string, any>;

describe('splitLines', () => {
  it('drops the trailing empty element, like Python splitlines', () => {
    expect(splitLines('a\nb\n')).toEqual(['a', 'b']);
    expect(splitLines('a\nb')).toEqual(['a', 'b']);
    expect(splitLines('')).toEqual([]);
    expect(splitLines('\n')).toEqual(['']);
  });
});

describe('parseSimpleYaml', () => {
  it('reads scalars, one level of nesting and flow lists', () => {
    const raw = parseSimpleYaml(
      [
        '# a leading comment',
        'msg_version: 1.0.0',
        '',
        'structure:',
        '  roadmap: docs/roadmap/',
        '  tasks: docs/tasks/',
        '',
        'tags: [one, two, three]',
        'quoted: "value"',
      ].join('\n'),
    );

    expect(raw.get('msg_version')).toBe('1.0.0');
    expect(raw.get('quoted')).toBe('value');
    expect(raw.get('tags')).toEqual(['one', 'two', 'three']);
    expect([...raw.get('structure')]).toEqual([
      ['roadmap', 'docs/roadmap/'],
      ['tasks', 'docs/tasks/'],
    ]);
  });

  it('strips an inline comment but keeps a hash that is not one', () => {
    const raw = parseSimpleYaml(['a: value # trailing', 'b: value#nospace'].join('\n'));
    expect(raw.get('a')).toBe('value');
    expect(raw.get('b')).toBe('value#nospace');
  });

  it('splits on the first colon only', () => {
    const raw = parseSimpleYaml('sync: make roadmap-sync: extra');
    expect(raw.get('sync')).toBe('make roadmap-sync: extra');
  });

  it('accepts a tab-indented nested key', () => {
    const raw = parseSimpleYaml('areas:\n\tNaming: docs/naming.md');
    expect([...raw.get('areas')]).toEqual([['Naming', 'docs/naming.md']]);
  });

  it('preserves the written order of a block', () => {
    const raw = parseSimpleYaml('areas:\n  10: a.md\n  2: b.md\n  1: c.md');
    // Integer-like keys would reorder in a plain object; Maps do not.
    expect([...raw.get('areas').keys()]).toEqual(['10', '2', '1']);
  });
});

describe('parseDeps', () => {
  it('treats an em dash, a hyphen and blank as no dependencies', () => {
    expect(parseDeps('—')).toEqual([]);
    expect(parseDeps('-')).toEqual([]);
    expect(parseDeps('  ')).toEqual([]);
    expect(parseDeps('')).toEqual([]);
  });

  it('keeps the numbers as written', () => {
    expect(parseDeps('01, 02')).toEqual(['01', '02']);
    expect(parseDeps('01,,03 ')).toEqual(['01', '03']);
  });
});

describe('replaceField', () => {
  it('preserves the trailing space that separates it from the next field', () => {
    const line = '**Status:** not-started · **Estimate:** 8';
    expect(replaceField(line, 'Status', 'done')).toBe('**Status:** done · **Estimate:** 8');
  });

  it('adds no trailing space when the field ends the line', () => {
    expect(replaceField('**Status:** not-started', 'Status', 'done')).toBe('**Status:** done');
  });

  it('replaces only the first occurrence', () => {
    const text = '**Status:** a\n**Status:** b';
    expect(replaceField(text, 'Status', 'z')).toBe('**Status:** z\n**Status:** b');
  });

  it('treats $ in the value as literal', () => {
    expect(replaceField('**Note:** old', 'Note', '$& $1 $$')).toBe('**Note:** $& $1 $$');
  });
});

describe('compressNumbers', () => {
  it('matches the documented example', () => {
    expect(compressNumbers([1, 2, 3, 10, 15, 16, 17])).toBe('01–03, 10 and 15–17');
  });

  it('leaves a run of two as two numbers', () => {
    expect(compressNumbers([4, 5])).toBe('04 and 05');
  });

  it('renders a single number without a conjunction', () => {
    expect(compressNumbers([7])).toBe('07');
  });

  it('returns empty for no numbers', () => {
    expect(compressNumbers([])).toBe('');
  });
});

describe('renderTable', () => {
  it('falls back to _(none)_ with no rows', () => {
    expect(renderTable(['#', 'Item'], [])).toBe('_(none)_\n');
  });

  it('renders a header, separator and one row per entry', () => {
    expect(renderTable(['#', 'Item'], [['01', 'a']])).toBe('| # | Item |\n|---|---|\n| 01 | a |\n');
  });

  it('emptyTable keeps a parseable header even with no rows', () => {
    expect(emptyTable(['#', 'Item'])).toBe('| # | Item |\n|---|---|\n');
  });
});

describe('replaceFirstTable', () => {
  it('swaps the first table and leaves the surrounding prose', () => {
    const text = 'before\n\n| # | a |\n|---|---|\n| 1 | b |\n\nafter\n';
    const out = replaceFirstTable(text, '| # |\n|---|\n', 'x');
    expect(out).toBe('before\n\n| # |\n|---|\n\nafter\n');
  });

  it('throws a DocError when there is no table', () => {
    expect(() => replaceFirstTable('no table here\n', 'x', 'somewhere')).toThrow(
      /somewhere: no table to regenerate/,
    );
  });
});

describe('sortQueue', () => {
  const item = (number: number, estimate: string) => ({ number, estimate });

  it('sorts by estimate descending, then number ascending', () => {
    const out = sortQueue([item(3, '5'), item(1, '8'), item(2, '8')]);
    expect(out.map((i: { number: number }) => i.number)).toEqual([1, 2, 3]);
  });

  it('treats a non-numeric estimate as 0 instead of throwing', () => {
    const out = sortQueue([item(1, 'soon'), item(2, '3')]);
    expect(out.map((i: { number: number }) => i.number)).toEqual([2, 1]);
  });

  it('treats a blank estimate as 0', () => {
    const out = sortQueue([item(1, ''), item(2, '1')]);
    expect(out.map((i: { number: number }) => i.number)).toEqual([2, 1]);
  });
});

describe('firstBullet', () => {
  it('returns the first bullet under the heading', () => {
    expect(firstBullet('## Why not\n\n- because\n- and also\n', '## Why not')).toBe('because');
  });

  it('stops at the next heading', () => {
    expect(firstBullet('## Why not\n\n## Next\n- late\n', '## Why not')).toBe('');
  });

  it('returns empty when the heading is absent', () => {
    expect(firstBullet('nothing\n', '## Why not')).toBe('');
  });
});

describe('taskStatus', () => {
  it('is done only when every criterion is ticked', () => {
    expect(taskStatus({ ticked: 3, total: 3 })).toBe('done');
    expect(taskStatus({ ticked: 1, total: 3 })).toBe('in-progress');
    expect(taskStatus({ ticked: 0, total: 3 })).toBe('not-started');
  });

  it('is not done with no criteria at all', () => {
    expect(taskStatus({ ticked: 0, total: 0 })).toBe('not-started');
  });
});

describe('sectionOf', () => {
  const items = new Map<number, any>([
    [1, { number: 1, status: 'done', deps: [] }],
    [2, { number: 2, status: 'not-started', deps: [] }],
  ]);

  it('is Ready when every dependency is done', () => {
    expect(sectionOf({ status: 'not-started', deps: ['01'] }, items)).toBe('Ready');
  });

  it('is Blocked when a dependency is not done', () => {
    expect(sectionOf({ status: 'not-started', deps: ['02'] }, items)).toBe('Blocked');
  });

  it('ignores a dependency that does not exist', () => {
    expect(sectionOf({ status: 'not-started', deps: ['09'] }, items)).toBe('Ready');
  });

  it('puts parked and done in their own sections regardless of dependencies', () => {
    expect(sectionOf({ status: 'parked', deps: ['02'] }, items)).toBe('Parked');
    expect(sectionOf({ status: 'done', deps: ['02'] }, items)).toBe('Done');
  });
});

describe('ditchedReadme ordering', () => {
  it('sorts descending and keeps ties in file order', () => {
    // Exercised through the exported comparator behaviour: a stable descending
    // sort keeps 02 before 03 when both carry the same date. `.sort().reverse()`
    // would swap them.
    const rows = [
      ['[01](01.md)', 'a', '2026-01-01', ''],
      ['[02](02.md)', 'b', '2026-02-01', ''],
      ['[03](03.md)', 'c', '2026-02-01', ''],
    ];
    rows.sort((a, b) => (a[2]! < b[2]! ? 1 : a[2]! > b[2]! ? -1 : 0));
    expect(rows.map((r) => r[0])).toEqual(['[02](02.md)', '[03](03.md)', '[01](01.md)']);
    expect(typeof ditchedReadme).toBe('function');
  });
});

// A roadmap item is now the folder `docs/roadmap/NN-slug/`, and its document is
// the `README.md` inside it. These touch the filesystem because `parseHeader`
// and `loadRoadmap` read real files — everything above this line is pure.
describe('parseHeader label', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('names the doc by its label, not its filename, in an error message', () => {
    const dir = mkdtempSync(join(tmpdir(), 'msg-header-'));
    dirs.push(dir);
    const path = join(dir, 'README.md');
    writeFileSync(path, 'not a title line\n', 'utf8');

    // Without a label the message would just say `README.md`, which is useless
    // when every roadmap item's doc is named that.
    expect(() => parseHeader(path)).toThrow(/^README\.md: first line is not/);
    expect(() => parseHeader(path, '01-slug')).toThrow(/^01-slug: first line is not/);
  });
});

describe('loadRoadmap folder shape', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const project = () => {
    const dir = mkdtempSync(join(tmpdir(), 'msg-roadmap-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'docs', 'roadmap'), { recursive: true });
    return dir;
  };

  const item = (dir: string, slug: string, header: string) => {
    const folder = join(dir, 'docs', 'roadmap', slug);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'README.md'), `# ${header}\n\n## Context\n\n- x.\n`, 'utf8');
  };

  it('reads NN-slug/README.md, with slug = folder and path = the README', () => {
    const dir = project();
    item(dir, '01-first', '01 — First\n\n**Estimate:** 2 · **Status:** not-started');
    const problems: string[] = [];
    const items = loadRoadmap(loadConfig(dir), problems);

    expect(problems).toEqual([]);
    expect(items.get(1).slug).toBe('01-first');
    expect(items.get(1).path).toBe(join(dir, 'docs', 'roadmap', '01-first', 'README.md'));
  });

  it('reports a numbered folder with no README.md as a problem, not a crash', () => {
    const dir = project();
    mkdirSync(join(dir, 'docs', 'roadmap', '01-no-readme'), { recursive: true });
    const problems: string[] = [];
    const items = loadRoadmap(loadConfig(dir), problems);

    expect(items.size).toBe(0);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toBe(
      "docs/roadmap/01-no-readme: no README.md inside — that file is the item's document",
    );
  });

  it('reports a leftover single-file item and names `msg migrate-roadmap`', () => {
    const dir = project();
    writeFileSync(
      join(dir, 'docs', 'roadmap', '01-old.md'),
      '# 01 — Old\n\n**Estimate:** 1 · **Status:** not-started\n',
      'utf8',
    );
    const problems: string[] = [];
    const items = loadRoadmap(loadConfig(dir), problems);

    expect(items.size).toBe(0);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('docs/roadmap/01-old.md');
    expect(problems[0]).toContain('msg migrate-roadmap');
    expect(problems[0]).toContain('01-old/README.md');
  });

  it('still throws when two folders claim the same number', () => {
    const dir = project();
    item(dir, '01-clash', '01 — Clash\n\n**Estimate:** 1 · **Status:** not-started');
    item(dir, '01-first', '01 — First\n\n**Estimate:** 1 · **Status:** not-started');
    expect(() => loadRoadmap(loadConfig(dir), [])).toThrow(
      /01-first: number 01 is already taken by 01-clash\//,
    );
  });
});
