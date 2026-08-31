import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SKILLS } from '../../src/core/templates';

const REPO = fileURLToPath(new URL('../..', import.meta.url));

/**
 * A wrong `files:` field publishes a package that installs but cannot scaffold,
 * and npm gives no warning. This is the only check that catches it.
 */
describe('the published tarball', () => {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: REPO,
    encoding: 'utf8',
  });

  const entries: string[] =
    result.status === 0
      ? (JSON.parse(result.stdout) as Array<{ files: Array<{ path: string }> }>)[0]!.files.map(
          (f) => f.path,
        )
      : [];

  it('packs successfully', () => {
    expect(result.status, result.stderr).toBe(0);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('ships the vendored engine', () => {
    expect(entries).toContain('templates/scripts/roadmap-sync.mjs');
  });

  it('ships every skill', () => {
    for (const skill of SKILLS) {
      expect(entries).toContain(`templates/skills/${skill}/SKILL.md`);
    }
  });

  it('ships the project templates the scaffolder reads', () => {
    for (const name of [
      'roadmap-README.md',
      'explorations-README.md',
      'ditched-README.md',
      'tasks-README.md',
      'rule-doc.md',
      'Makefile.block',
      'claude-block.md',
    ]) {
      expect(entries).toContain(`templates/project/${name}`);
    }
  });

  it('ships every hook the scaffolder installs', () => {
    for (const name of [
      'branch-guard-pre.sh',
      'branch-guard-post.sh',
      'acceptance-criteria-gate.sh',
      'retire-breakdown-post.sh',
    ]) {
      expect(entries).toContain(`templates/hooks/${name}`);
    }
  });

  it('does not ship the tests or fixtures', () => {
    expect(entries.some((p) => p.startsWith('test/'))).toBe(false);
  });
});
