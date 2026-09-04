import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { run } from '../../src/cli';
import { readVersion } from '../../src/version';

const dirs: string[] = [];

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'msg-cli-'));
  dirs.push(dir);
  mkdirSync(join(dir, '.git'), { recursive: true });
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function captureStdout() {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  return { chunks, restore: () => spy.mockRestore() };
}

function captureStderr() {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  return { chunks, restore: () => spy.mockRestore() };
}

describe('run', () => {
  it('prints usage and exits 0 with no arguments', async () => {
    const out = captureStdout();
    const code = await run([]);
    out.restore();

    expect(code).toBe(0);
    expect(out.chunks.join('')).toContain('msg init');
  });

  it('prints the package version', async () => {
    const out = captureStdout();
    const code = await run(['--version']);
    out.restore();

    expect(code).toBe(0);
    expect(out.chunks.join('').trim()).toBe(readVersion());
  });

  it('exits 2 on an unknown command', async () => {
    const err = captureStderr();
    const code = await run(['frobnicate']);
    err.restore();

    expect(code).toBe(2);
    expect(err.chunks.join('')).toContain('unknown command');
  });

  it('rejects --gitignore and --no-gitignore together', async () => {
    const root = project();
    const err = captureStderr();
    const out = captureStdout();
    const code = await run([
      'init',
      '--shape',
      'docs-only',
      '--no-seed',
      '--gitignore',
      'docs',
      '--no-gitignore',
      '--root',
      root,
    ]);
    err.restore();
    out.restore();

    expect(code).toBe(2);
    expect(err.chunks.join('')).toContain('--gitignore and --no-gitignore contradict each other');
  });

  it('passes --gitignore through to init, end to end', async () => {
    const root = project();
    const out = captureStdout();
    const code = await run([
      'init',
      '--shape',
      'docs-only',
      '--no-seed',
      '--gitignore',
      'makefile',
      '--root',
      root,
    ]);
    out.restore();

    expect(code).toBe(0);
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain('Makefile');
  });
});

describe('readVersion', () => {
  it('returns a semver-shaped string', () => {
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
