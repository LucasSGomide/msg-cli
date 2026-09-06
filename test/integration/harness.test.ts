import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { init } from '../../src/commands/init';
import { uninstall } from '../../src/commands/uninstall';
import * as prompts from '../../src/prompts';

const VERSION = '9.9.9';
const roots: string[] = [];

function project(): string {
  const root = mkdtempSync(join(tmpdir(), 'msg-codex-'));
  roots.push(root);
  mkdirSync(join(root, '.git'), { recursive: true });
  return root;
}

function files(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory).sort()) {
      if (name === '.git') continue;
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else found.push(relative(root, path).split('\\').join('/'));
    }
  };
  walk(root);
  return found.sort();
}

function write(root: string, path: string, content: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content, 'utf8');
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Codex init', () => {
  it('creates only Codex-native agent artifacts and records the harness', async () => {
    const root = project();
    const result = await init({ root, harness: 'codex', shape: 'docs-only', seed: false }, VERSION);
    const installed = files(root);

    expect(result.out).toContain('  harnesses codex');
    expect(readFileSync(join(root, 'project.yml'), 'utf8')).toContain('harnesses: [codex]');
    expect(installed).toContain('AGENTS.md');
    expect(installed).toContain('.agents/skills/msg-roadmap-plan-item/SKILL.md');
    expect(installed).toContain('.codex/hooks/branch-guard-pre.sh');
    expect(installed).toContain('.codex/hooks.json');
    expect(statSync(join(root, '.codex/hooks/branch-guard-pre.sh')).mode & 0o111).not.toBe(0);
    expect(installed.some((path) => path === 'CLAUDE.md' || path.startsWith('.claude/'))).toBe(
      false,
    );
  });

  it('renders Codex skill references, instruction paths, and question-tool language', async () => {
    const root = project();
    await init({ root, harness: 'codex', shape: 'docs-only', seed: false }, VERSION);

    const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    const plan = readFileSync(join(root, '.agents/skills/msg-roadmap-plan-item/SKILL.md'), 'utf8');
    const brainstorm = readFileSync(join(root, '.agents/skills/msg-brainstorm/SKILL.md'), 'utf8');
    expect(agents).toContain('$msg-pre-roadmap');
    expect(agents).toContain('.codex/hooks.json');
    expect(agents).not.toContain('.claude/');
    expect(plan).toContain('$msg-pre-roadmap');
    expect(plan).not.toMatch(/(?<![A-Za-z0-9._-])\/msg-/);
    expect(brainstorm).toContain('request_user_input');
    expect(brainstorm).not.toContain('AskUserQuestion');
  });

  it('is byte-idempotent on a repeated init', async () => {
    const root = project();
    await init({ root, harness: 'codex', shape: 'docs-only', seed: false }, VERSION);
    const before = new Map(
      files(root).map((path) => [path, readFileSync(join(root, path), 'utf8')]),
    );

    const second = await init({ root, shape: 'docs-only', seed: false }, VERSION);

    expect(second.out.join('\n')).toContain('nothing to do');
    expect(
      new Map(files(root).map((path) => [path, readFileSync(join(root, path), 'utf8')])),
    ).toEqual(before);
  });

  it('merges into user-owned hooks.json and leaves unrelated structure in place', async () => {
    const root = project();
    write(
      root,
      '.codex/hooks.json',
      JSON.stringify({ description: 'mine', hooks: { Stop: [{ hooks: [] }] } }),
    );

    await init({ root, harness: 'codex', shape: 'docs-only', seed: false }, VERSION);

    const config = JSON.parse(readFileSync(join(root, '.codex/hooks.json'), 'utf8'));
    expect(config.description).toBe('mine');
    expect(config.hooks.Stop).toEqual([{ hooks: [] }]);
    expect(config.hooks.PreToolUse).toBeDefined();
    expect(JSON.stringify(config)).toContain('git rev-parse --show-toplevel');
    expect(JSON.stringify(config)).not.toContain('CLAUDE_PROJECT_DIR');
    expect(JSON.stringify(config).match(/\.codex\/hooks\//g)).toHaveLength(4);
  });

  it('adapts the edit guard to Codex apply_patch stdin', async () => {
    const root = project();
    await init({ root, harness: 'codex', shape: 'docs-only', seed: false }, VERSION);
    const hook = join(root, '.codex/hooks/branch-guard-pre.sh');
    const result = spawnSync('bash', [hook], {
      input: JSON.stringify({
        session_id: 'codex-harness-test',
        cwd: root,
        tool_name: 'apply_patch',
        tool_input: { command: '*** Begin Patch\n*** Update File: src/app.ts\n' },
      }),
      encoding: 'utf8',
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Create a dedicated branch');
    expect(readFileSync(hook, 'utf8')).not.toContain('CLAUDE_PROJECT_DIR');
  });

  it('supports the Codex skills-only shape without writing full-scaffold files', async () => {
    const root = project();
    const result = await init(
      { root, harness: 'codex', shape: 'skills-only', skills: 'msg-grill-me' },
      VERSION,
    );

    expect(result.out).toContain('  harnesses codex');
    expect(files(root)).toEqual(['.agents/skills/msg-grill-me/SKILL.md']);

    const second = await init(
      { root, harness: 'codex', shape: 'skills-only', skills: 'msg-grill-me' },
      VERSION,
    );
    expect(second.out.join('\n')).toContain('nothing to do');
  });

  it('renders and protects a Codex-only .gitignore block', async () => {
    const root = project();
    await init(
      {
        root,
        harness: 'codex',
        shape: 'docs-only',
        seed: false,
        gitignore: 'skills,hooks',
      },
      VERSION,
    );
    const path = join(root, '.gitignore');
    const block = readFileSync(path, 'utf8');
    expect(block).toContain('.agents/skills/msg-*');
    expect(block).toContain('.codex/hooks/branch-guard-pre.sh');
    expect(block).not.toContain('.claude/');

    const edited = block.replace('.agents/skills/msg-*', '.agents/skills/custom-*');
    writeFileSync(path, edited, 'utf8');
    const result = await init({ root, shape: 'docs-only', seed: false, gitignore: 'all' }, VERSION);
    expect(result.out).toContain('  kept    .gitignore (yours)');
    expect(readFileSync(path, 'utf8')).toBe(edited);
  });

  it('uses the interactive harness answer even when shape was supplied', async () => {
    const root = project();
    vi.spyOn(prompts, 'isInteractive').mockReturnValue(true);
    const asked = vi.spyOn(prompts, 'askHarnesses').mockResolvedValue(['codex']);

    await init({ root, shape: 'docs-only', seed: false }, VERSION);

    expect(asked).toHaveBeenCalledOnce();
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(true);
  });
});

describe('harness selection safety', () => {
  it('installs both harnesses from a comma-separated flag and records them together', async () => {
    const root = project();

    await init({ root, harness: 'claude,codex', shape: 'docs-only', seed: false }, VERSION);

    expect(readFileSync(join(root, 'project.yml'), 'utf8')).toContain('harnesses: [claude, codex]');
    expect(existsSync(join(root, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(root, '.claude/skills/msg-grill-me/SKILL.md'))).toBe(true);
    expect(existsSync(join(root, '.agents/skills/msg-grill-me/SKILL.md'))).toBe(true);
  });

  it('defaults a new non-interactive init to Claude', async () => {
    const root = project();
    vi.spyOn(prompts, 'isInteractive').mockReturnValue(false);

    const result = await init({ root, shape: 'docs-only', seed: false }, VERSION);

    expect(result.out).toContain('  harnesses claude');
    expect(readFileSync(join(root, 'project.yml'), 'utf8')).toContain('harnesses: [claude]');
  });

  it('-y accepts the backwards-compatible Claude default without asking', async () => {
    const root = project();
    vi.spyOn(prompts, 'isInteractive').mockReturnValue(true);
    const asked = vi.spyOn(prompts, 'askHarnesses');

    const result = await init({ root, shape: 'docs-only', seed: false, yes: true }, VERSION);

    expect(asked).not.toHaveBeenCalled();
    expect(result.out).toContain('  harnesses claude');
  });

  it('keeps a legacy manifest on Claude without healing the missing field', async () => {
    const root = project();
    await init({ root, harness: 'claude', shape: 'docs-only', seed: false }, VERSION);
    const manifest = readFileSync(join(root, 'project.yml'), 'utf8').replace(
      'harnesses: [claude]\n',
      '',
    );
    writeFileSync(join(root, 'project.yml'), manifest, 'utf8');

    const result = await init({ root, shape: 'docs-only', seed: false }, VERSION);

    expect(result.out).toContain('  harnesses claude');
    expect(readFileSync(join(root, 'project.yml'), 'utf8')).toBe(manifest);
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
  });

  it('rejects unknown harnesses and permits adding another harness to a full scaffold', async () => {
    const root = project();
    await expect(
      init({ root, harness: 'cursor', shape: 'docs-only', seed: false }, VERSION),
    ).rejects.toThrow(/unknown harness 'cursor'/);
    await init({ root, harness: 'codex', shape: 'docs-only', seed: false }, VERSION);
    await init({ root, harness: 'claude', shape: 'docs-only', seed: false }, VERSION);
    expect(readFileSync(join(root, 'project.yml'), 'utf8')).toContain('harnesses: [claude, codex]');
    expect(existsSync(join(root, 'CLAUDE.md'))).toBe(true);
  });
});

describe('harness-aware uninstall', () => {
  it('removes a selected harness from a dual full scaffold and retains the shared project', async () => {
    const root = project();
    await init({ root, harness: 'claude,codex', shape: 'docs-only', seed: false }, VERSION);

    const result = await uninstall({ root, harness: 'codex', yes: true }, VERSION);

    expect(result.code).toBe(0);
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
    expect(existsSync(join(root, '.codex'))).toBe(false);
    expect(existsSync(join(root, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(root, '.claude/skills/msg-grill-me/SKILL.md'))).toBe(true);
    expect(readFileSync(join(root, 'project.yml'), 'utf8')).toContain('harnesses: [claude]');
    expect(existsSync(join(root, 'docs/roadmap/README.md'))).toBe(true);
  });

  it('offers installed harnesses for interactive dual-harness uninstall', async () => {
    const root = project();
    await init({ root, harness: 'claude,codex', shape: 'docs-only', seed: false }, VERSION);
    vi.spyOn(prompts, 'isInteractive').mockReturnValue(true);
    const selected = vi.spyOn(prompts, 'askUninstallHarnesses').mockResolvedValue(['codex']);
    vi.spyOn(prompts, 'askUninstall').mockResolvedValue(true);

    await uninstall({ root }, VERSION);

    expect(selected).toHaveBeenCalledWith(['claude', 'codex']);
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
    expect(existsSync(join(root, 'CLAUDE.md'))).toBe(true);
  });

  it('reads Codex from the full manifest, strips hooks, and preserves Claude artifacts', async () => {
    const root = project();
    write(root, '.codex/hooks.json', JSON.stringify({ description: 'mine' }));
    write(root, '.claude/skills/msg-grill-me/SKILL.md', '# another harness\n');
    await init({ root, harness: 'codex', shape: 'docs-only', seed: false }, VERSION);

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.code).toBe(0);
    expect(JSON.parse(readFileSync(join(root, '.codex/hooks.json'), 'utf8'))).toEqual({
      description: 'mine',
    });
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
    expect(existsSync(join(root, '.agents/skills/msg-grill-me/SKILL.md'))).toBe(false);
    expect(readFileSync(join(root, '.claude/skills/msg-grill-me/SKILL.md'), 'utf8')).toBe(
      '# another harness\n',
    );
  });

  it('rejects an explicit full-scaffold harness that conflicts with project.yml', async () => {
    const root = project();
    await init({ root, harness: 'codex', shape: 'docs-only', seed: false }, VERSION);

    await expect(uninstall({ root, harness: 'claude', yes: true }, VERSION)).rejects.toThrow(
      /conflicts with project.yml/,
    );
    expect(existsSync(join(root, 'project.yml'))).toBe(true);
  });

  it('keeps and reports invalid user-owned Codex hook configuration', async () => {
    const root = project();
    write(root, '.codex/hooks.json', 'not json\n');
    await init({ root, harness: 'codex', shape: 'docs-only', seed: false }, VERSION);

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.out.join('\n')).toContain('kept    .codex/hooks.json — yours, remove by hand');
    expect(readFileSync(join(root, '.codex/hooks.json'), 'utf8')).toBe('not json\n');
  });

  it('infers one manifest-less skills harness and removes only that harness', async () => {
    const root = project();
    await init(
      { root, harness: 'codex', shape: 'skills-only', skills: 'msg-write-prompt' },
      VERSION,
    );
    write(root, '.claude/skills/my-skill/SKILL.md', '# mine\n');
    mkdirSync(join(root, '.codex'), { recursive: true });

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.code).toBe(0);
    expect(existsSync(join(root, '.agents/skills/msg-write-prompt/SKILL.md'))).toBe(false);
    expect(existsSync(join(root, '.claude/skills/my-skill/SKILL.md'))).toBe(true);
    expect(existsSync(join(root, '.codex'))).toBe(true);
  });

  it('makes no changes when both skills-only harnesses are present without a flag', async () => {
    const root = project();
    await init(
      { root, harness: 'claude', shape: 'skills-only', skills: 'msg-write-prompt' },
      VERSION,
    );
    await init(
      { root, harness: 'codex', shape: 'skills-only', skills: 'msg-write-prompt' },
      VERSION,
    );
    const before = files(root);

    const ambiguous = await uninstall({ root, yes: true }, VERSION);

    expect(ambiguous.code).toBe(1);
    expect(ambiguous.err.join('\n')).toContain('both harnesses are present');
    expect(files(root)).toEqual(before);

    const selected = await uninstall({ root, harness: 'codex', yes: true }, VERSION);
    expect(selected.code).toBe(0);
    expect(existsSync(join(root, '.agents/skills/msg-write-prompt/SKILL.md'))).toBe(false);
    expect(existsSync(join(root, '.claude/skills/msg-write-prompt/SKILL.md'))).toBe(true);
  });
});
