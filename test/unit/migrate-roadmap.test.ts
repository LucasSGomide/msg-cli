import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { planMigration, type MigrationPlan } from '../../src/commands/migrate-roadmap';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'msg-migrate-'));
  dirs.push(root);
  mkdirSync(join(root, '.git'), { recursive: true });
  writeFileSync(
    join(root, 'project.yml'),
    'msg_version: 9.9.9\nstructure:\n  roadmap: docs/roadmap/\n  tasks: docs/tasks/\n',
  );
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const HEADER =
  '# 01 — A thing\n\n**Depends on:** — · **Estimate:** 3 · **Status:** not-started\n\n';

function itemDoc(context: string, extra = ''): string {
  return `${HEADER}## Context\n\n${context}\n\n## User Experience\n\nStuff.\n${extra}`;
}

function actionFor(plan: MigrationPlan, slug: string): string | undefined {
  return plan.items.find((i) => i.slug === slug)?.action;
}

describe('planMigration', () => {
  it('migrates a single-file item into the folder shape', () => {
    const root = project({
      'docs/roadmap/README.md': '# Roadmap\n',
      'docs/roadmap/01-old-thing.md': itemDoc('x'.repeat(3200)),
    });

    const plan = planMigration(root);
    const item = plan.items.find((i) => i.slug === '01-old-thing');

    // A file whose name contains a dash is not also mistaken for a folder.
    expect(plan.items).toHaveLength(1);
    expect(item?.action).toBe('migrate');
    expect(item?.moves).toEqual([
      {
        from: join(root, 'docs/roadmap/01-old-thing.md'),
        to: join(root, 'docs/roadmap/01-old-thing/README.md'),
      },
    ]);
  });

  it('keeps an item already in folder shape', () => {
    const root = project({
      'docs/roadmap/README.md': '# Roadmap\n',
      'docs/roadmap/02-done/README.md': itemDoc('x'.repeat(3200)),
      'docs/roadmap/02-done/openapi.json': '{}',
    });

    const plan = planMigration(root);
    expect(actionFor(plan, '02-done')).toBe('kept');
    expect(plan.items.find((i) => i.slug === '02-done')?.moves).toEqual([]);
  });

  it('reports a name collision without touching either side', () => {
    const root = project({
      'docs/roadmap/README.md': '# Roadmap\n',
      'docs/roadmap/03-clash.md': itemDoc('x'.repeat(3200)),
      'docs/roadmap/03-clash/README.md': itemDoc('x'.repeat(3200)),
    });

    const plan = planMigration(root);
    const item = plan.items.find((i) => i.slug === '03-clash');
    expect(item?.action).toBe('collision');
    expect(item?.moves).toEqual([]);
    expect(item?.note).toContain('move one aside by hand');
  });

  it('moves openapi.json and test-script.md out of an open breakdown', () => {
    const root = project({
      'docs/roadmap/README.md': '# Roadmap\n',
      'docs/roadmap/01-with-breakdown.md': itemDoc('x'.repeat(3200)),
      'docs/tasks/01-with-breakdown/README.md': '# breakdown\n',
      'docs/tasks/01-with-breakdown/openapi.json': '{}',
      'docs/tasks/01-with-breakdown/test-script.md': '# runbook\n',
      'docs/tasks/01-with-breakdown/01-first.md': '# task\n',
    });

    const plan = planMigration(root);
    const item = plan.items.find((i) => i.slug === '01-with-breakdown');

    expect(item?.moves).toContainEqual({
      from: join(root, 'docs/tasks/01-with-breakdown/openapi.json'),
      to: join(root, 'docs/roadmap/01-with-breakdown/openapi.json'),
    });
    expect(item?.moves).toContainEqual({
      from: join(root, 'docs/tasks/01-with-breakdown/test-script.md'),
      to: join(root, 'docs/roadmap/01-with-breakdown/test-script.md'),
    });
    // A task file stays where it is.
    expect(item?.moves.map((m) => m.from)).not.toContain(
      join(root, 'docs/tasks/01-with-breakdown/01-first.md'),
    );
    // The contract will land in the folder, so it is not flagged as missing.
    expect(plan.leftover.noContract).not.toContain('01-with-breakdown');
  });

  it('lists the prose fixes it will not make', () => {
    const root = project({
      'docs/roadmap/README.md': '# Roadmap\n',
      'docs/roadmap/01-keyareas.md': itemDoc('x'.repeat(3200), '\n## Key Areas\n\n- **Auth**\n'),
      'docs/roadmap/02-thin.md': itemDoc('too short'),
      'docs/roadmap/03-nocontract.md': itemDoc('x'.repeat(3200)),
      'docs/tasks/03-nocontract/README.md': '# breakdown\n',
      'docs/tasks/03-nocontract/01-slice.md': '# task\n\n## Wireframes\n\n```\n[ ok ]\n```\n',
      'docs/tasks/03-nocontract/02-api.md': '# task\n\n## Sequence diagrams\n\nmermaid\n',
    });

    const plan = planMigration(root);

    expect(plan.leftover.keyAreas).toContain('01-keyareas');
    expect(plan.leftover.thinContext).toContainEqual({
      slug: '02-thin',
      chars: 'too short'.length,
    });
    expect(plan.leftover.noContract).toEqual(
      expect.arrayContaining(['01-keyareas', '02-thin', '03-nocontract']),
    );
    expect(plan.leftover.taskArtifacts).toEqual(
      expect.arrayContaining([
        'docs/tasks/03-nocontract/01-slice.md — ## Wireframes',
        'docs/tasks/03-nocontract/02-api.md — ## Sequence diagrams',
      ]),
    );
  });

  it('is a no-op plan when every item is already a folder', () => {
    const root = project({
      'docs/roadmap/README.md': '# Roadmap\n',
      'docs/roadmap/01-a/README.md': itemDoc('x'.repeat(3200)),
      'docs/roadmap/01-a/openapi.json': '{}',
      'docs/roadmap/02-b/README.md': itemDoc('x'.repeat(3200)),
      'docs/roadmap/02-b/openapi.json': '{}',
    });

    const plan = planMigration(root);
    expect(plan.items.every((i) => i.action === 'kept' && i.moves.length === 0)).toBe(true);
  });
});
