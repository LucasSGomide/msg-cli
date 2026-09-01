import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const BIN = join(REPO, 'dist', 'cli.js');

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function listFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (name === '.git') continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else found.push(relative(root, path).split('\\').join('/'));
    }
  };
  walk(root);
  return found.sort();
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'msg-migrate-int-'));
  dirs.push(root);
  mkdirSync(join(root, '.git'), { recursive: true });
  const write = (path: string, content: string) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  write(
    'project.yml',
    'msg_version: 9.9.9\nstructure:\n  roadmap: docs/roadmap/\n  tasks: docs/tasks/\n',
  );
  write('docs/roadmap/README.md', '# Roadmap\n');
  write(
    'docs/roadmap/01-old.md',
    '# 01 — Old\n\n**Depends on:** — · **Estimate:** 3 · **Status:** not-started\n\n## Context\n\nShort.\n',
  );
  write('docs/tasks/01-old/README.md', '# breakdown\n');
  write('docs/tasks/01-old/openapi.json', '{"openapi":"3.1.0"}\n');
  write('docs/tasks/01-old/test-script.md', '# runbook\n');
  write('docs/tasks/01-old/01-slice.md', '# task\n');
  return root;
}

function migrate(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [BIN, 'migrate-roadmap', '--root', root, ...args], {
    encoding: 'utf8',
  });
}

describe.runIf(existsSync(BIN))('msg migrate-roadmap, built bin', () => {
  it('moves a single-file item and its breakdown artifacts, then is a no-op', () => {
    const root = fixture();

    const first = migrate(root, '--yes');
    expect(first.status, first.stderr).toBe(0);

    expect(listFiles(root).sort()).toEqual(
      [
        'docs/roadmap/01-old/README.md',
        'docs/roadmap/01-old/openapi.json',
        'docs/roadmap/01-old/test-script.md',
        'docs/roadmap/README.md',
        'docs/tasks/01-old/01-slice.md',
        'docs/tasks/01-old/README.md',
        'project.yml',
      ].sort(),
    );

    // README content carried over untouched.
    expect(first.stdout).toContain('docs/roadmap/01-old.md -> docs/roadmap/01-old/README.md');
    // It names what is still left to do and that it did not commit.
    expect(first.stdout).toContain('## Context');
    expect(first.stdout).toContain('did not commit');
    expect(first.stdout).toContain('temporary');

    const before = listFiles(root);
    const second = migrate(root, '--yes');
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain('nothing to migrate');
    expect(listFiles(root)).toEqual(before);
  });

  it('--dry-run writes nothing', () => {
    const root = fixture();
    const before = listFiles(root);

    const result = migrate(root, '--dry-run');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('dry run — nothing was moved');
    expect(listFiles(root)).toEqual(before);
  });

  it('exits 2 when it would move files with no -y and no terminal', () => {
    const root = fixture();
    const result = migrate(root);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('pass -y');
  });
});
