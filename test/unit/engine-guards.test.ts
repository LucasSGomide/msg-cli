import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const ENGINE = new URL('../../templates/scripts/roadmap-sync.mjs', import.meta.url);

describe('the vendored engine', () => {
  it('imports nothing outside node builtins', () => {
    const source = readFileSync(ENGINE, 'utf8');

    // Static imports and any dynamic import()/require() call.
    const specifiers = [
      ...source.matchAll(/^import\s[^'"]*from\s*['"]([^'"]+)['"]/gm),
      ...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g),
      ...source.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((m) => m[1]!);

    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier, `${specifier} is not a node: builtin`).toMatch(/^node:/);
    }
  });

  it('declares no dependency on the package it ships in', () => {
    const source = readFileSync(ENGINE, 'utf8');
    expect(source).not.toMatch(/from\s*['"]\.\./);
  });
});

describe('importing the engine', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('has no side effects — no run, no write, from an empty cwd', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'msg-engine-'));
    dirs.push(dir);

    const previous = process.cwd();
    process.chdir(dir);
    try {
      // A top-level `run()` would fire here and either throw or write.
      const engine = await import(ENGINE.href);
      expect(typeof engine.run).toBe('function');
      expect(typeof engine.parseSimpleYaml).toBe('function');
    } finally {
      process.chdir(previous);
    }

    const { readdirSync } = await import('node:fs');
    expect(readdirSync(dir)).toEqual([]);
  });
});
