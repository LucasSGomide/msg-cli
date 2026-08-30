import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ACCEPTANCE_GATE_SRC, BRANCH_GUARD_PRE_SRC } from '../../src/core/templates';

const dirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'msg-hooks-'));
  dirs.push(dir);
  return dir;
}

/** Run a hook script with a stdin payload; return its exit code and stderr. */
function runHook(
  script: string,
  payload: unknown,
  env: NodeJS.ProcessEnv = {},
): { code: number; stderr: string } {
  try {
    execFileSync('bash', [script], {
      input: JSON.stringify(payload),
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { code: 0, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stderr?: Buffer };
    return { code: e.status ?? -1, stderr: e.stderr?.toString() ?? '' };
  }
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  rmSync('/tmp/claude-branch-guard/hooks-test.created', { force: true });
});

describe('branch-guard-pre.sh', () => {
  const SESSION = 'hooks-test';
  const edit = (file: string) => ({ session_id: SESSION, tool_input: { file_path: file } });

  it('blocks a code edit when the session has no branch', () => {
    const result = runHook(BRANCH_GUARD_PRE_SRC, edit('/repo/src/core/foo.ts'));

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('Branch-first for implementation work');
  });

  it.each([
    '/repo/src/index.ts',
    '/repo/lib/util.js',
    '/repo/app/main.py',
    '/repo/test/foo.test.ts',
    '/repo/tests/bar_spec.rb',
    '/repo/package.json',
    '/repo/pnpm-lock.yaml',
    '/repo/Makefile',
    '/repo/vitest.config.ts',
  ])('treats %s as code', (file) => {
    expect(runHook(BRANCH_GUARD_PRE_SRC, edit(file)).code).toBe(2);
  });

  it.each([
    '/repo/docs/prompts/01-thing.md',
    '/repo/docs/roadmap/02-item.md',
    '/repo/docs/tasks/02-item/01-slice.md',
    '/repo/README.md',
    '/repo/CHANGELOG.md',
  ])('lets %s through without a branch', (file) => {
    expect(runHook(BRANCH_GUARD_PRE_SRC, edit(file)).code).toBe(0);
  });

  it('lets a code edit through once the branch-created flag is set', () => {
    mkdirSync('/tmp/claude-branch-guard', { recursive: true });
    writeFileSync(`/tmp/claude-branch-guard/${SESSION}.created`, '', 'utf8');

    expect(runHook(BRANCH_GUARD_PRE_SRC, edit('/repo/src/core/foo.ts')).code).toBe(0);
  });

  it('ignores a payload with no file_path', () => {
    expect(runHook(BRANCH_GUARD_PRE_SRC, { session_id: SESSION, tool_input: {} }).code).toBe(0);
  });
});

describe('acceptance-criteria-gate.sh', () => {
  function projectWithTasks(files: Record<string, string>): string {
    const root = tempRoot();
    for (const [rel, body] of Object.entries(files)) {
      const full = join(root, rel);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, body, 'utf8');
    }
    return root;
  }

  const bash = (command: string) => ({ tool_input: { command } });
  const UNTICKED = '# Slice\n\n## Acceptance criteria\n\n- [x] one\n- [ ] two\n';
  const ALL_TICKED = '# Slice\n\n## Acceptance criteria\n\n- [x] one\n- [x] two\n';
  const SCRIPT_TICKED =
    '# Test script\n\n## Setup\n\n- [x] boot\n\n## 01 — A\n\n- [x] hit the route\n';
  const SCRIPT_UNTICKED =
    '# Test script\n\n## Setup\n\n- [x] boot\n\n## 01 — A\n\n- [ ] hit the route\n';

  it('blocks `but land` while a task file has an unticked criterion', () => {
    const root = projectWithTasks({ 'docs/tasks/01-x/01-a.md': UNTICKED });

    const result = runHook(ACCEPTANCE_GATE_SRC, bash('but land feat/x --yes'), {
      CLAUDE_PROJECT_DIR: root,
    });

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('docs/tasks/01-x/01-a.md');
  });

  it('allows `but land` once every criterion is ticked and the test script is complete', () => {
    const root = projectWithTasks({
      'docs/tasks/01-x/01-a.md': ALL_TICKED,
      'docs/tasks/01-x/test-script.md': SCRIPT_TICKED,
    });

    expect(
      runHook(ACCEPTANCE_GATE_SRC, bash('but land feat/x --yes'), { CLAUDE_PROJECT_DIR: root })
        .code,
    ).toBe(0);
  });

  it('blocks `but land` when a task folder has no test-script.md', () => {
    const root = projectWithTasks({ 'docs/tasks/01-x/01-a.md': ALL_TICKED });

    const result = runHook(ACCEPTANCE_GATE_SRC, bash('but land feat/x --yes'), {
      CLAUDE_PROJECT_DIR: root,
    });

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('missing test script: docs/tasks/01-x/test-script.md');
  });

  it('blocks `but land` while test-script.md has an unticked step', () => {
    const root = projectWithTasks({
      'docs/tasks/01-x/01-a.md': ALL_TICKED,
      'docs/tasks/01-x/test-script.md': SCRIPT_UNTICKED,
    });

    const result = runHook(ACCEPTANCE_GATE_SRC, bash('but land feat/x --yes'), {
      CLAUDE_PROJECT_DIR: root,
    });

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('unticked test-script step: docs/tasks/01-x/test-script.md');
  });

  it('does not require a test script for a folder with no numbered task file', () => {
    const root = projectWithTasks({ 'docs/tasks/01-x/README.md': '# 01 — X\n' });

    expect(
      runHook(ACCEPTANCE_GATE_SRC, bash('but land feat/x --yes'), { CLAUDE_PROJECT_DIR: root })
        .code,
    ).toBe(0);
  });

  it('blocks a git merge and a push to main, but not a push to a feature branch', () => {
    const root = projectWithTasks({ 'docs/tasks/01-x/01-a.md': UNTICKED });
    const env = { CLAUDE_PROJECT_DIR: root };

    expect(runHook(ACCEPTANCE_GATE_SRC, bash('git merge --no-ff feat/x'), env).code).toBe(2);
    expect(runHook(ACCEPTANCE_GATE_SRC, bash('git push origin main'), env).code).toBe(2);
    expect(runHook(ACCEPTANCE_GATE_SRC, bash('git push origin feat/x'), env).code).toBe(0);
  });

  it('never blocks a routine commit', () => {
    const root = projectWithTasks({ 'docs/tasks/01-x/01-a.md': UNTICKED });
    const env = { CLAUDE_PROJECT_DIR: root };

    expect(runHook(ACCEPTANCE_GATE_SRC, bash('but commit -m "wip" abc'), env).code).toBe(0);
    expect(runHook(ACCEPTANCE_GATE_SRC, bash('git commit -am wip'), env).code).toBe(0);
  });

  it('passes when there is no docs/tasks tree at all', () => {
    const root = tempRoot();

    expect(
      runHook(ACCEPTANCE_GATE_SRC, bash('but land feat/x --yes'), { CLAUDE_PROJECT_DIR: root })
        .code,
    ).toBe(0);
  });

  it('only inspects task-file boxes under the Acceptance criteria heading', () => {
    const root = projectWithTasks({
      'docs/tasks/01-x/01-a.md':
        '# Slice\n\n## Notes\n\n- [ ] a stray box elsewhere\n\n## Acceptance criteria\n\n- [x] one\n',
      'docs/tasks/01-x/test-script.md': SCRIPT_TICKED,
    });

    expect(
      runHook(ACCEPTANCE_GATE_SRC, bash('but land feat/x --yes'), { CLAUDE_PROJECT_DIR: root })
        .code,
    ).toBe(0);
  });
});
