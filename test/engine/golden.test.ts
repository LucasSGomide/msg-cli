import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures', 'projects');
const GOLDEN = join(HERE, '..', 'fixtures', 'golden');
const ENGINE = join(HERE, '..', '..', 'templates', 'scripts', 'roadmap-sync.mjs');

/** Set UPDATE_GOLDEN=1 to rewrite the expectations after an intentional change. */
const UPDATE = process.env.UPDATE_GOLDEN === '1';

const temps: string[] = [];

afterAll(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function snapshot(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      if (name === '.git' || name === 'scripts') continue;
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else files[relative(dir, path).split('\\').join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(dir);
  return files;
}

function runEngine(fixture: string, args: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'msg-golden-'));
  temps.push(dir);
  cpSync(join(FIXTURES, fixture), dir, { recursive: true });
  // The engine walks up for project.yml then .git; vendored, it always sits
  // inside the tree it operates on.
  mkdirSync(join(dir, '.git'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  const target = join(dir, 'scripts', 'roadmap-sync.mjs');
  cpSync(ENGINE, target);

  const result = spawnSync(process.execPath, [target, ...args], { encoding: 'utf8' });
  return {
    code: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    tree: snapshot(dir),
  };
}

const fixtures = readdirSync(FIXTURES)
  .filter((name) => statSync(join(FIXTURES, name)).isDirectory())
  .sort();

describe('the engine against its golden trees', () => {
  it('has fixtures to run', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const fixture of fixtures) {
    for (const mode of ['write', 'check'] as const) {
      it(`${fixture} — ${mode}`, () => {
        const args = mode === 'check' ? ['--check'] : [];
        const actual = runEngine(fixture, args);
        const path = join(GOLDEN, `${fixture}.${mode}.json`);

        if (UPDATE) {
          mkdirSync(GOLDEN, { recursive: true });
          writeFileSync(path, `${JSON.stringify(actual, null, 2)}\n`, 'utf8');
          return;
        }

        const expected = JSON.parse(readFileSync(path, 'utf8')) as typeof actual;
        expect(actual.code).toBe(expected.code);
        expect(actual.stdout).toBe(expected.stdout);
        expect(actual.stderr).toBe(expected.stderr);
        expect(actual.tree).toEqual(expected.tree);
      });
    }
  }
});
