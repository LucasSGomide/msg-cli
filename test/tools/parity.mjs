#!/usr/bin/env node
/**
 * Diff the ported JS engine against the original Python one, fixture by fixture.
 *
 * This is a porting-time tool, not a CI gate: it needs python3 and the original
 * `roadmap_sync.py`, which a later commit deletes. Recover it from history:
 *
 *     git show <rev>:.claude/skills/msg-roadmap-sync/scripts/roadmap_sync.py > /tmp/roadmap_sync.py
 *     node test/tools/parity.mjs --python /tmp/roadmap_sync.py
 *
 * Every difference is either a bug in the port or a deliberate divergence that
 * belongs in PORTING-NOTES.md. Once the list is empty or explained, the golden
 * trees are regenerated from the JS side and CI diffs against those instead —
 * so CI never needs Python and the engine cannot regress silently.
 */

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures', 'projects');
const JS_ENGINE = join(HERE, '..', '..', 'templates', 'scripts', 'roadmap-sync.mjs');

const { values } = parseArgs({
  options: {
    python: { type: 'string' },
    only: { type: 'string' },
  },
});

if (!values.python || !existsSync(values.python)) {
  console.error('error: pass --python <path to roadmap_sync.py>');
  process.exit(2);
}
const PY_ENGINE = values.python;

/** @param {string} dir @returns {Map<string, string>} */
function snapshot(dir) {
  /** @type {Map<string, string>} */
  const files = new Map();
  const walk = (/** @type {string} */ current) => {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.set(relative(dir, path).split('\\').join('/'), readFileSync(path, 'utf8'));
    }
  };
  walk(dir);
  return files;
}

/**
 * The engines resolve their own root by walking up from the script's location,
 * so each must sit inside the tree it operates on — exactly as it does when
 * vendored into `scripts/`.
 *
 * @param {string} fixture
 * @param {'py' | 'js'} which
 * @param {string[]} args
 */
function runEngine(fixture, which, args) {
  const dir = mkdtempSync(join(tmpdir(), `msg-parity-${which}-`));
  cpSync(join(FIXTURES, fixture), dir, { recursive: true });
  // Both engines walk up for project.yml, then for .git. Without a marker they
  // would bind to scripts/ and report the roadmap folder missing. An empty .git
  // is the neutral choice: a project.yml would also trigger the JS-only
  // manifest path check and manufacture a difference.
  mkdirSync(join(dir, '.git'), { recursive: true });

  const scripts = join(dir, 'scripts');
  cpSync(which === 'py' ? PY_ENGINE : JS_ENGINE, join(scripts, 'engine'), { recursive: false });

  const target = join(scripts, 'engine');
  const result =
    which === 'py'
      ? spawnSync('python3', [target, ...args], { encoding: 'utf8' })
      : spawnSync(process.execPath, [target, ...args], { encoding: 'utf8' });

  rmSync(target);
  rmSync(scripts, { recursive: true, force: true });

  return {
    code: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    tree: snapshot(dir),
    dir,
  };
}

/** @param {Map<string, string>} a @param {Map<string, string>} b */
function treeDiff(a, b) {
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
  /** @type {string[]} */
  const out = [];
  for (const k of keys) {
    if (!a.has(k)) out.push(`    + only in js: ${k}`);
    else if (!b.has(k)) out.push(`    + only in py: ${k}`);
    else if (a.get(k) !== b.get(k)) out.push(`    ~ differs: ${k}`);
  }
  return out;
}

const fixtures = readdirSync(FIXTURES)
  .filter((n) => statSync(join(FIXTURES, n)).isDirectory())
  .filter((n) => (values.only ? n === values.only : true))
  .sort();

let differing = 0;

for (const fixture of fixtures) {
  for (const args of [[], ['--check']]) {
    const label = `${fixture}${args.length ? ' --check' : ''}`;
    const py = runEngine(fixture, 'py', args);
    const js = runEngine(fixture, 'js', args);

    /** @type {string[]} */
    const notes = [];
    if (py.code !== js.code) notes.push(`    exit: py=${py.code} js=${js.code}`);
    if (py.stdout !== js.stdout) {
      notes.push('    stdout:');
      notes.push(`      py: ${JSON.stringify(py.stdout)}`);
      notes.push(`      js: ${JSON.stringify(js.stdout)}`);
    }
    if (py.stderr !== js.stderr) {
      notes.push('    stderr:');
      notes.push(`      py: ${JSON.stringify(py.stderr)}`);
      notes.push(`      js: ${JSON.stringify(js.stderr)}`);
    }
    notes.push(...treeDiff(py.tree, js.tree));

    rmSync(py.dir, { recursive: true, force: true });
    rmSync(js.dir, { recursive: true, force: true });

    if (notes.length) {
      differing += 1;
      console.log(`DIFF  ${label}`);
      for (const line of notes) console.log(line);
    } else {
      console.log(`ok    ${label}`);
    }
  }
}

console.log(`\n${differing} differing run(s) across ${fixtures.length} fixture(s).`);
process.exitCode = differing ? 1 : 0;
