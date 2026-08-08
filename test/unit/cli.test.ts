import { describe, expect, it, vi } from 'vitest';

import { run } from '../../src/cli';
import { readVersion } from '../../src/version';

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
});

describe('readVersion', () => {
  it('returns a semver-shaped string', () => {
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
