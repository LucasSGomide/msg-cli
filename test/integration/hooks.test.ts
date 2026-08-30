import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

/** Run a hook script with a stdin payload; return its exit code and stderr
 *  (stderr is captured on a clean exit too — the gate warns without blocking). */
function runHook(
  script: string,
  payload: unknown,
  env: NodeJS.ProcessEnv = {},
): { code: number; stderr: string } {
  const r = spawnSync('bash', [script], {
    input: JSON.stringify(payload),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  return { code: r.status ?? -1, stderr: r.stderr ?? '' };
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
  type Git = (...args: string[]) => string;

  /** A throwaway repo — no real project touched. `main` is the ship target. */
  function initRepo(): { root: string; git: Git } {
    const root = tempRoot();
    const git: Git = (...args) =>
      execFileSync('git', args, {
        cwd: root,
        env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
        stdio: ['pipe', 'pipe', 'pipe'],
      }).toString();
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@e.st');
    git('config', 'user.name', 'test');
    git('config', 'commit.gpgsign', 'false');
    return { root, git };
  }

  function write(root: string, files: Record<string, string>): void {
    for (const [rel, body] of Object.entries(files)) {
      const full = join(root, rel);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, body, 'utf8');
    }
  }

  function commit(root: string, git: Git, message: string, files: Record<string, string>): void {
    write(root, files);
    git('add', '-A');
    git('commit', '-qm', message);
  }

  /** Build `main` with the given task files, then freeze it as the ship target. */
  function project(mainFiles: Record<string, string>): { root: string; git: Git } {
    const { root, git } = initRepo();
    commit(root, git, 'init', { 'README.md': '# repo\n', ...mainFiles });
    git('update-ref', 'refs/remotes/origin/main', 'refs/heads/main');
    git('config', 'gitbutler.project.targetref', 'refs/remotes/origin/main');
    return { root, git };
  }

  const branch = (git: Git, name: string, from = 'main') => git('checkout', '-q', '-b', name, from);
  const checkout = (git: Git, name: string) => git('checkout', '-q', name);

  const bash = (command: string) => ({ tool_input: { command } });
  const gate = (root: string, command: string) =>
    runHook(ACCEPTANCE_GATE_SRC, bash(command), { CLAUDE_PROJECT_DIR: root });

  const CRIT = (a: string, b: string) =>
    `# Slice\n\n## Acceptance criteria\n\n- [${a}] one\n- [${b}] two\n`;
  const NONE_TICKED = CRIT(' ', ' ');
  const SOME_TICKED = CRIT('x', ' ');
  const ALL_TICKED = CRIT('x', 'x');
  const SCRIPT_TICKED =
    '# Test script\n\n## Setup\n\n- [x] boot\n\n## 01 — A\n\n- [x] hit the route\n';
  const SCRIPT_UNTICKED =
    '# Test script\n\n## Setup\n\n- [x] boot\n\n## 01 — A\n\n- [ ] hit the route\n';

  // --- the matrix constraint 7 asks for --------------------------------------

  it('does not gate a ship whose diff touches no task file', () => {
    const { root, git } = project({
      'docs/tasks/01-x/01-a.md': SOME_TICKED,
      'docs/tasks/01-x/test-script.md': SCRIPT_TICKED,
    });
    branch(git, 'feat/unrelated');
    commit(root, git, 'feat: code', { 'src/app.ts': 'export const x = 1;\n' });
    checkout(git, 'main');

    expect(gate(root, 'but land feat/unrelated --yes').code).toBe(0);
  });

  it('exempts a ship that only adds task files (a freshly authored breakdown)', () => {
    const { root, git } = project({});
    branch(git, 'plan/04');
    commit(root, git, 'docs: breakdown', {
      'docs/tasks/04-y/01-a.md': NONE_TICKED,
      'docs/tasks/04-y/02-b.md': NONE_TICKED,
    });
    checkout(git, 'main');

    expect(gate(root, 'but land plan/04 --yes').code).toBe(0);
  });

  it('blocks a ship that ticks some acceptance boxes but leaves others', () => {
    const { root, git } = project({
      'docs/tasks/01-x/01-a.md': NONE_TICKED,
      'docs/tasks/01-x/test-script.md': SCRIPT_TICKED,
    });
    branch(git, 'feat/x');
    commit(root, git, 'feat: partial', { 'docs/tasks/01-x/01-a.md': SOME_TICKED });
    checkout(git, 'main');

    const r = gate(root, 'but land feat/x --yes');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('docs/tasks/01-x/01-a.md');
  });

  it('allows the same ship once every box it touched is ticked', () => {
    const { root, git } = project({
      'docs/tasks/01-x/01-a.md': NONE_TICKED,
      'docs/tasks/01-x/test-script.md': SCRIPT_TICKED,
    });
    branch(git, 'feat/x');
    commit(root, git, 'feat: done', { 'docs/tasks/01-x/01-a.md': ALL_TICKED });
    checkout(git, 'main');

    expect(gate(root, 'but land feat/x --yes').code).toBe(0);
  });

  it('is not tripped by a commit message or heredoc that spells the trigger words', () => {
    const { root } = project({ 'docs/tasks/01-x/01-a.md': SOME_TICKED });

    expect(
      gate(root, 'git commit -m "chore: document how but land and git merge trip the gate"').code,
    ).toBe(0);
    expect(
      gate(root, "git commit -F- <<'EOF'\nchore: notes\nbut land then git merge into main\nEOF")
        .code,
    ).toBe(0);
  });

  // --- defect 2: judge the ref, never the working tree ----------------------

  it('judges the ship by the ref content, not the working tree', () => {
    const { root, git } = project({
      'docs/tasks/01-x/01-a.md': NONE_TICKED,
      'docs/tasks/01-x/test-script.md': SCRIPT_TICKED,
    });
    branch(git, 'feat/x');
    commit(root, git, 'feat: done', { 'docs/tasks/01-x/01-a.md': ALL_TICKED });
    checkout(git, 'main');
    // The working tree now holds main's copy — still fully unticked on disk.
    expect(readFileSync(join(root, 'docs/tasks/01-x/01-a.md'), 'utf8')).toBe(NONE_TICKED);

    expect(gate(root, 'but land feat/x --yes').code).toBe(0);
  });

  // --- the anti-circular case: land a slice, leave a later one open ---------

  it('allows landing one slice while a later slice in the same folder stays open', () => {
    const { root, git } = project({
      'docs/tasks/01-x/01-a.md': NONE_TICKED,
      'docs/tasks/01-x/02-b.md': NONE_TICKED,
      'docs/tasks/01-x/test-script.md': SCRIPT_TICKED,
    });
    branch(git, 'feat/x-01');
    commit(root, git, 'feat: slice 01', { 'docs/tasks/01-x/01-a.md': ALL_TICKED });
    checkout(git, 'main');
    // 02-b.md is untouched by the ship and fully unticked — must not block.
    expect(gate(root, 'but land feat/x-01 --yes').code).toBe(0);
  });

  // --- the case the signal cannot separate: warn, never block --------------

  it('lets a prose-only task-file edit through, saying it could not verify the slice', () => {
    const { root, git } = project({ 'docs/tasks/01-x/01-a.md': NONE_TICKED });
    branch(git, 'feat/x');
    commit(root, git, 'docs: reword', {
      'docs/tasks/01-x/01-a.md': `# Slice\n\nReworded.\n\n## Acceptance criteria\n\n- [ ] one\n- [ ] two\n`,
    });
    checkout(git, 'main');

    const r = gate(root, 'but land feat/x --yes');
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('cannot tell');
  });

  // --- test-script.md, scoped to what the ship accepts --------------------

  it('blocks an accepted slice whose folder has no test-script.md', () => {
    const { root, git } = project({ 'docs/tasks/01-x/01-a.md': NONE_TICKED });
    branch(git, 'feat/x');
    commit(root, git, 'feat: done', { 'docs/tasks/01-x/01-a.md': ALL_TICKED });
    checkout(git, 'main');

    const r = gate(root, 'but land feat/x --yes');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('docs/tasks/01-x/test-script.md');
  });

  it('blocks an accepted slice whose test-script.md has an unchecked step', () => {
    const { root, git } = project({
      'docs/tasks/01-x/01-a.md': NONE_TICKED,
      'docs/tasks/01-x/test-script.md': SCRIPT_TICKED,
    });
    branch(git, 'feat/x');
    commit(root, git, 'feat: done', {
      'docs/tasks/01-x/01-a.md': ALL_TICKED,
      'docs/tasks/01-x/test-script.md': SCRIPT_UNTICKED,
    });
    checkout(git, 'main');

    expect(gate(root, 'but land feat/x --yes').code).toBe(2);
  });

  it('does not require a test script for a folder the ship only adds or rewords', () => {
    const { root, git } = project({ 'docs/tasks/01-x/01-a.md': NONE_TICKED });
    branch(git, 'feat/x');
    commit(root, git, 'docs: reword', {
      'docs/tasks/01-x/01-a.md': `# Slice\n\nMore.\n\n## Acceptance criteria\n\n- [ ] one\n- [ ] two\n`,
    });
    checkout(git, 'main');

    expect(gate(root, 'but land feat/x --yes').code).toBe(0);
  });

  // --- ship detection: merge, push, and the non-ships --------------------

  it('gates a git merge that carries a half-ticked slice', () => {
    const { root, git } = project({
      'docs/tasks/01-x/01-a.md': NONE_TICKED,
      'docs/tasks/01-x/test-script.md': SCRIPT_TICKED,
    });
    branch(git, 'feat/x');
    commit(root, git, 'feat: partial', { 'docs/tasks/01-x/01-a.md': SOME_TICKED });
    checkout(git, 'main');

    expect(gate(root, 'git merge --no-ff feat/x').code).toBe(2);
  });

  it('gates a push that names the target branch, not one to a feature branch', () => {
    const { root, git } = project({
      'docs/tasks/01-x/01-a.md': NONE_TICKED,
      'docs/tasks/01-x/test-script.md': SCRIPT_TICKED,
    });
    branch(git, 'feat/x');
    commit(root, git, 'feat: partial', { 'docs/tasks/01-x/01-a.md': SOME_TICKED });
    checkout(git, 'main');
    git('merge', '-q', '--ff-only', 'feat/x'); // main now ahead of origin/main

    expect(gate(root, 'git push origin main').code).toBe(2);
    expect(gate(root, 'git push origin feat/x').code).toBe(0);
  });

  it('never blocks a routine commit', () => {
    const { root } = project({ 'docs/tasks/01-x/01-a.md': NONE_TICKED });

    expect(gate(root, 'but commit -m "wip" abc').code).toBe(0);
    expect(gate(root, 'git commit -am wip').code).toBe(0);
  });

  // --- fail toward letting the ship through when it cannot look ----------

  it('does not gate when the shipped ref cannot be resolved', () => {
    const { root } = project({ 'docs/tasks/01-x/01-a.md': NONE_TICKED });

    const r = gate(root, 'but land no/such/branch --yes');
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('could not resolve');
  });

  it('does not gate outside a git repo', () => {
    const root = tempRoot();
    write(root, { 'docs/tasks/01-x/01-a.md': NONE_TICKED });

    expect(gate(root, 'but land feat/x --yes').code).toBe(0);
  });

  it('does not gate when there is no docs/tasks tree', () => {
    const { root } = project({});

    expect(gate(root, 'but land feat/x --yes').code).toBe(0);
  });

  it('reads criteria to end of file, exactly as the sync engine does', () => {
    const { root, git } = project({
      'docs/tasks/01-x/01-a.md':
        '# Slice\n\n## Notes\n\n- [ ] a stray box before the heading\n\n## Acceptance criteria\n\n- [ ] one\n',
      'docs/tasks/01-x/test-script.md': SCRIPT_TICKED,
    });
    branch(git, 'feat/x');
    commit(root, git, 'feat: done', {
      'docs/tasks/01-x/01-a.md':
        '# Slice\n\n## Notes\n\n- [ ] a stray box before the heading\n\n## Acceptance criteria\n\n- [x] one\n',
    });
    checkout(git, 'main');

    // The pre-heading box is ignored; the one criterion is ticked -> allowed.
    expect(gate(root, 'but land feat/x --yes').code).toBe(0);
  });
});
