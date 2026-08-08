import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const BIN = join(REPO, 'dist', 'cli.js');

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'msg-bin-'));
  dirs.push(dir);
  return dir;
}

/**
 * npm installs a bin as `node_modules/.bin/<name>`, a **symlink** to the real
 * file. `import.meta.url` is already resolved but `process.argv[1]` is the
 * symlink path, so an entry-point guard comparing them raw is false for every
 * installed user and the CLI exits 0 having done nothing.
 *
 * Nothing else in the suite catches that: importing `run` directly bypasses the
 * guard entirely, and running dist/cli.js by its real path passes.
 */
describe.runIf(existsSync(BIN))('the built bin, invoked through a symlink', () => {
  function linkedRun(args: string[], cwd?: string) {
    const dir = temp();
    const link = join(dir, 'msg');
    symlinkSync(BIN, link);
    return spawnSync(process.execPath, [link, ...args], { encoding: 'utf8', cwd });
  }

  it('prints the version', () => {
    const result = linkedRun(['--version']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prints usage with no arguments', () => {
    const result = linkedRun([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('msg init');
  });

  it('scaffolds a real project', () => {
    const root = temp();
    mkdirSync(join(root, '.git'), { recursive: true });

    const result = linkedRun(['init', '--shape', 'docs-only', '--no-seed', '--root', root]);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('created project.yml');
    expect(existsSync(join(root, 'scripts', 'roadmap-sync.mjs'))).toBe(true);
    expect(existsSync(join(root, '.claude', 'skills', 'grill-me', 'SKILL.md'))).toBe(true);
  });

  it('leaves a scaffolded project passing its own check', () => {
    const root = temp();
    mkdirSync(join(root, '.git'), { recursive: true });
    linkedRun(['init', '--shape', 'both', '--seed', '--root', root]);

    const sync = spawnSync(
      process.execPath,
      [join(root, 'scripts', 'roadmap-sync.mjs'), '--check'],
      {
        encoding: 'utf8',
      },
    );

    expect(sync.status, sync.stdout + sync.stderr).toBe(0);
    expect(sync.stdout).toContain('roadmap tables are up to date');
  });

  it('exits 2 without a shape when there is no terminal to ask on', () => {
    const result = linkedRun(['init', '--root', temp()]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('not a terminal');
  });

  it('exits 2 on an unknown flag', () => {
    const result = linkedRun(['init', '--frobnicate']);
    expect(result.status).toBe(2);
  });
});
