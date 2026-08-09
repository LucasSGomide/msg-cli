import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { addArea } from '../../src/commands/add-area';
import { check } from '../../src/commands/check';
import { init } from '../../src/commands/init';
import { AREAS } from '../../src/core/areas';
import { readDocTemplate } from '../../src/core/templates';

const VERSION = '9.9.9';
const dirs: string[] = [];

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'msg-init-'));
  dirs.push(dir);
  // A root marker, so the vendored engine resolves this dir and not a temp
  // ancestor, and so findAncestorManifest has a realistic tree to walk.
  mkdirSync(join(dir, '.git'), { recursive: true });
  return dir;
}

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

function hashTree(root: string): Map<string, string> {
  const hashes = new Map<string, string>();
  for (const file of listFiles(root)) {
    hashes.set(
      file,
      createHash('sha256')
        .update(readFileSync(join(root, file)))
        .digest('hex'),
    );
  }
  return hashes;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('init', () => {
  it('scaffolds the full tree for --shape both', async () => {
    const root = project();
    const result = await init({ root, shape: 'both', seed: false }, VERSION);

    expect(result.code).toBe(0);
    expect(listFiles(root)).toEqual([
      '.claude/skills/grill-me/SKILL.md',
      '.claude/skills/msg-roadmap-plan-item/SKILL.md',
      '.claude/skills/msg-roadmap-sync/SKILL.md',
      '.claude/skills/msg-roadmap-task-breakdown/SKILL.md',
      '.claude/skills/msg-roadmap-task-review/SKILL.md',
      '.claude/skills/msg-setup/SKILL.md',
      'CLAUDE.md',
      'Makefile',
      'docs/architecture-api.md',
      'docs/architecture-web.md',
      'docs/auth.md',
      'docs/design.md',
      'docs/ditched/README.md',
      'docs/explorations/README.md',
      'docs/naming.md',
      'docs/roadmap/README.md',
      'docs/stack-api.md',
      'docs/stack-web.md',
      'docs/tasks/README.md',
      'project.yml',
      'scripts/roadmap-sync.mjs',
    ]);
  });

  it('writes a manifest with the version and no dropped blocks', async () => {
    const root = project();
    await init({ root, shape: 'api', seed: false }, VERSION);
    const manifest = readFileSync(join(root, 'project.yml'), 'utf8');

    expect(manifest).toContain(`msg_version: ${VERSION}`);
    expect(manifest).toContain('  Back-end: docs/architecture-api.md');
    expect(manifest).toContain('  API stack: docs/stack-api.md');
    expect(manifest).toContain('  Naming: docs/naming.md');
    // Dropped deliberately: both were convention pretending to be config.
    expect(manifest).not.toContain('commands:');
    expect(manifest).not.toContain('skills:');
    expect(manifest).not.toContain('vcs:');
  });

  it('points the make targets at node, not python', async () => {
    const root = project();
    await init({ root, shape: 'docs-only', seed: false }, VERSION);
    const makefile = readFileSync(join(root, 'Makefile'), 'utf8');

    expect(makefile).toContain('node scripts/roadmap-sync.mjs');
    expect(makefile).not.toContain('python');
    expect(makefile).not.toContain('project-check');
  });

  it('leaves rule docs as stubs without --seed', async () => {
    const root = project();
    await init({ root, shape: 'docs-only', seed: false }, VERSION);

    const design = readFileSync(join(root, 'docs/design.md'), 'utf8');
    expect(design).toContain('# Design rules');
    expect(design).toContain('Nothing here yet.');
  });

  it('copies the opinionated defaults byte-for-byte with --seed', async () => {
    const root = project();
    await init({ root, areas: 'design,naming', seed: true }, VERSION);

    expect(readFileSync(join(root, 'docs/design.md'), 'utf8')).toBe(readDocTemplate('design.md'));
    expect(readFileSync(join(root, 'docs/naming.md'), 'utf8')).toBe(readDocTemplate('naming.md'));
  });

  it('is idempotent — a second run changes no byte', async () => {
    const root = project();
    await init({ root, shape: 'both', seed: false }, VERSION);
    const before = hashTree(root);

    const second = await init({ root, shape: 'both', seed: false }, VERSION);

    expect(second.out.join('\n')).toContain('nothing to do');
    expect(hashTree(root)).toEqual(before);
  });

  it('never overwrites a file the project already had', async () => {
    const root = project();
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs/design.md'), 'MINE\n', 'utf8');

    const result = await init({ root, areas: 'design,naming', seed: true }, VERSION);

    expect(readFileSync(join(root, 'docs/design.md'), 'utf8')).toBe('MINE\n');
    expect(result.out.join('\n')).toContain('kept    docs/design.md (yours)');
  });

  it('appends to an existing Makefile rather than clobbering it', async () => {
    const root = project();
    writeFileSync(join(root, 'Makefile'), 'build:\n\techo hi\n', 'utf8');

    await init({ root, shape: 'docs-only', seed: false }, VERSION);
    const makefile = readFileSync(join(root, 'Makefile'), 'utf8');

    expect(makefile).toContain('build:');
    expect(makefile).toContain('roadmap-sync:');
  });

  it('appends a delimited block to an existing CLAUDE.md', async () => {
    const root = project();
    writeFileSync(join(root, 'CLAUDE.md'), '# My rules\n\nDo the thing.\n', 'utf8');

    await init({ root, shape: 'docs-only', seed: false }, VERSION);
    const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');

    expect(claude).toContain('Do the thing.');
    expect(claude).toContain('<!-- msg-roadmap:start -->');
    expect(claude).toContain('<!-- msg-roadmap:end -->');
    expect(claude).toContain('**Design** — `docs/design.md`');
  });

  it('warns when an ancestor already holds a manifest', async () => {
    const parent = project();
    writeFileSync(join(parent, 'project.yml'), 'areas:\n', 'utf8');
    const nested = join(parent, 'packages', 'api');
    mkdirSync(nested, { recursive: true });

    const result = await init({ root: nested, shape: 'api', seed: false }, VERSION);

    expect(result.out.join('\n')).toContain('warning a project.yml already exists');
  });

  it('leaves the auth doc out with --no-auth, and nothing else', async () => {
    const withAuth = project();
    const without = project();

    await init({ root: withAuth, shape: 'api', seed: true }, VERSION);
    const result = await init({ root: without, shape: 'api', auth: false, seed: true }, VERSION);

    expect(listFiles(withAuth)).toContain('docs/auth.md');
    expect(listFiles(without)).toEqual(listFiles(withAuth).filter((f) => f !== 'docs/auth.md'));
    expect(readFileSync(join(without, 'project.yml'), 'utf8')).not.toContain('Auth:');
    expect(result.out.join('\n')).toContain('auth    not included');
  });

  it('includes auth by default for a shape that can have one', async () => {
    const root = project();
    const result = await init({ root, shape: 'web', seed: false }, VERSION);

    expect(listFiles(root)).toContain('docs/auth.md');
    expect(readFileSync(join(root, 'project.yml'), 'utf8')).toContain('  Auth: docs/auth.md');
    expect(result.out.join('\n')).toContain('auth    included');
  });

  it('says nothing about auth for docs-only', async () => {
    const root = project();
    const result = await init({ root, shape: 'docs-only', seed: false }, VERSION);

    expect(listFiles(root)).not.toContain('docs/auth.md');
    expect(result.out.join('\n')).not.toContain('auth ');
  });

  it('keeps the seeded stack docs free of auth when it is declined', async () => {
    const root = project();
    await init({ root, shape: 'both', auth: false, seed: true }, VERSION);

    for (const doc of [
      'stack-api.md',
      'stack-web.md',
      'architecture-api.md',
      'architecture-web.md',
    ]) {
      const text = readFileSync(join(root, 'docs', doc), 'utf8');
      expect(text, doc).not.toMatch(/Better Auth|use-session|auth-client|getSession/);
    }
  });

  it('rejects --auth alongside --areas, which already says it', async () => {
    const root = project();
    await expect(init({ root, areas: 'design,naming', auth: true }, VERSION)).rejects.toThrow(
      /cannot be combined with --areas/,
    );
  });

  it('rejects an auth flag for docs-only', async () => {
    const root = project();
    await expect(init({ root, shape: 'docs-only', auth: false }, VERSION)).rejects.toThrow(
      /means nothing for --shape docs-only/,
    );
  });

  it('rejects an unknown shape', async () => {
    const root = project();
    await expect(init({ root, shape: 'mobile', seed: false }, VERSION)).rejects.toThrow(
      /unknown shape 'mobile'/,
    );
  });

  it('rejects an unknown area', async () => {
    const root = project();
    await expect(init({ root, areas: 'back-end,mobile', seed: false }, VERSION)).rejects.toThrow(
      /unknown area\(s\) mobile/,
    );
  });
});

describe('check', () => {
  it('passes on a freshly scaffolded project', async () => {
    const root = project();
    await init({ root, shape: 'both', seed: false }, VERSION);

    const result = check(root);
    expect(result.code).toBe(0);
    expect(result.out.join('\n')).toContain('project.yml is consistent');
  });

  it('fails and names the path when a doc is deleted', async () => {
    const root = project();
    await init({ root, shape: 'api', seed: false }, VERSION);
    rmSync(join(root, 'docs/stack-api.md'));

    const result = check(root);
    expect(result.code).toBe(1);
    expect(result.out.join('\n')).toContain('areas.API stack -> docs/stack-api.md  MISSING');
  });

  it('fails when there is no manifest at all', () => {
    const result = check(project());
    expect(result.code).toBe(1);
    expect(result.err.join('\n')).toContain('no project.yml');
  });
});

describe('add-area', () => {
  it('adds exactly one manifest line and one stub', async () => {
    const root = project();
    await init({ root, shape: 'web', seed: false }, VERSION);
    const before = readFileSync(join(root, 'project.yml'), 'utf8');

    const result = addArea('back-end', { root });

    expect(result.code).toBe(0);
    const after = readFileSync(join(root, 'project.yml'), 'utf8');
    expect(after.split('\n').length).toBe(before.split('\n').length + 1);
    expect(after).toContain('  Back-end: docs/architecture-api.md');
    expect(readFileSync(join(root, 'docs/architecture-api.md'), 'utf8')).toContain(
      'Nothing here yet.',
    );
  });

  it('keeps the manifest comments intact', async () => {
    const root = project();
    await init({ root, shape: 'web', seed: false }, VERSION);

    addArea('back-end', { root });
    const manifest = readFileSync(join(root, 'project.yml'), 'utf8');

    expect(manifest).toContain('# Project manifest.');
    expect(manifest).toContain('# Every entry under `areas` points at the doc');
  });

  it('is a no-op the second time', async () => {
    const root = project();
    await init({ root, shape: 'web', seed: false }, VERSION);
    addArea('back-end', { root });
    const after = readFileSync(join(root, 'project.yml'), 'utf8');

    const again = addArea('back-end', { root });

    expect(again.out.join('\n')).toContain('is already listed');
    expect(readFileSync(join(root, 'project.yml'), 'utf8')).toBe(after);
  });

  it('leaves the project consistent for check', async () => {
    const root = project();
    await init({ root, shape: 'web', seed: false }, VERSION);
    addArea('back-end', { root });

    expect(check(root).code).toBe(0);
  });

  it('adds auth to a project that started without it', async () => {
    const root = project();
    await init({ root, shape: 'api', auth: false, seed: false }, VERSION);

    const result = addArea('auth', { root });

    expect(result.code).toBe(0);
    expect(readFileSync(join(root, 'project.yml'), 'utf8')).toContain('  Auth: docs/auth.md');
    expect(check(root).code).toBe(0);
  });

  it('fails without a manifest', () => {
    const result = addArea('back-end', { root: project() });
    expect(result.code).toBe(1);
    expect(result.err.join('\n')).toContain('run `msg init` first');
  });

  it('rejects an unknown slug', () => {
    expect(() => addArea('mobile', { root: project() })).toThrow(/unknown area 'mobile'/);
  });
});

describe('the area registry', () => {
  // Without this, `init --seed` for a shape covering that area crashes at
  // runtime with ENOENT instead of failing here.
  it('has a seed file on disk for every area', () => {
    for (const [slug, area] of Object.entries(AREAS)) {
      expect(() => readDocTemplate(area.seed), `${slug} seed ${area.seed}`).not.toThrow();
    }
  });

  it('maps every area to a distinct doc', () => {
    const docs = Object.values(AREAS).map((a) => a.doc);
    expect(new Set(docs).size).toBe(docs.length);
  });
});
