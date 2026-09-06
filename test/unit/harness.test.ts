import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { describeScaffold, describeSkills } from '../../src/core/description';
import { getHarness } from '../../src/core/harness';
import { scaffold, scaffoldSkills } from '../../src/core/scaffold';
import { readProjectTemplate, SKILLS } from '../../src/core/templates';

const VERSION = '9.9.9';
const roots: string[] = [];

function root(): string {
  const path = mkdtempSync(join(tmpdir(), 'msg-harness-'));
  roots.push(path);
  return path;
}

function files(rootPath: string): string[] {
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else found.push(relative(rootPath, path).split('\\').join('/'));
    }
  };
  walk(rootPath);
  return found.sort();
}

afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe.each(['claude', 'codex'] as const)('%s harness description', (harness) => {
  it('describes exactly the files the full scaffolder writes', () => {
    const project = root();
    scaffold({ root: project, areas: ['design'], seed: false, version: VERSION, harness });

    expect(
      describeScaffold({ areas: ['design'], seed: false, version: VERSION, harness })
        .map((entry) => entry.path)
        .sort(),
    ).toEqual(files(project));
  });

  it('describes exactly the files the skills-only scaffolder writes', () => {
    const project = root();
    scaffoldSkills(project, ['msg-grill-me'], harness);

    expect(describeSkills(['msg-grill-me'], harness).map((entry) => entry.path)).toEqual(
      files(project),
    );
  });
});

describe('Codex adapter rendering', () => {
  const codex = getHarness('codex');

  it('owns the native instruction, skill, hook, and config locations', () => {
    expect(codex.instructionsPath).toBe('AGENTS.md');
    expect(codex.skillDirectory).toBe('.agents/skills');
    expect(codex.hookDirectory).toBe('.codex/hooks');
    expect(codex.hookConfigPath).toBe('.codex/hooks.json');
  });

  it('renders explicit invocations and harness-specific tool language', () => {
    const source =
      'Run `/msg-roadmap-sync`. Use AskUserQuestion. Read CLAUDE.md and .claude/settings.json.';
    expect(codex.renderText(source)).toBe(
      'Run `$msg-roadmap-sync`. Use request_user_input. Read AGENTS.md and .codex/hooks.json.',
    );
  });

  it('does not rewrite template source paths that merely contain a msg-* folder', () => {
    expect(codex.renderText('templates/skills/msg-roadmap-sync/SKILL.md')).toBe(
      'templates/skills/msg-roadmap-sync/SKILL.md',
    );
  });

  it('keeps Claude rendering byte-identical to the canonical source', () => {
    const source = readProjectTemplate('claude-block.md');
    expect(getHarness('claude').renderText(source)).toBe(source);
  });

  it('renders every canonical skill without Claude-only invocations or paths', () => {
    for (const entry of describeSkills(SKILLS, 'codex')) {
      const text = entry.candidates[0];
      expect(text, entry.path).not.toMatch(/(?<![A-Za-z0-9._-])\/msg-/);
      expect(text, entry.path).not.toContain('AskUserQuestion');
      expect(text, entry.path).not.toContain('CLAUDE.md');
      expect(text, entry.path).not.toContain('.claude/');
    }
  });

  it('renders every Codex hook without Claude environment or state assumptions', () => {
    const hooks = describeScaffold({
      areas: ['design'],
      seed: false,
      version: VERSION,
      harness: 'codex',
    }).filter((entry) => entry.path.startsWith('.codex/hooks/'));

    expect(hooks).toHaveLength(4);
    for (const hook of hooks) {
      if (hook.kind === 'settings-hook') throw new Error('hook script described as config');
      expect(hook.candidates[0], hook.path).not.toContain('CLAUDE');
      expect(hook.candidates[0], hook.path).not.toContain('/tmp/claude-branch-guard');
    }
  });

  it('merges and strips only Codex-owned hook handlers', () => {
    const existing = JSON.stringify({ description: 'mine', hooks: { Stop: [] } });
    const merged = codex.mergeHookConfig(existing);
    const parsed = JSON.parse(merged.text);
    expect(parsed.description).toBe('mine');
    expect(parsed.hooks.Stop).toEqual([]);
    expect(merged.text).toContain('.codex/hooks/branch-guard-pre.sh');
    expect(merged.text).not.toContain('CLAUDE_PROJECT_DIR');

    const stripped = codex.stripHookConfig(merged.text);
    expect(stripped.outcome).toBe('strip');
    expect(JSON.parse(stripped.content)).toEqual({ description: 'mine', hooks: { Stop: [] } });
  });

  it('preserves unrelated empty matcher groups while stripping msg handlers', () => {
    const existing = JSON.stringify({
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [] }] },
    });
    const merged = codex.mergeHookConfig(existing);
    const stripped = codex.stripHookConfig(merged.text);

    expect(stripped.outcome).toBe('strip');
    expect(JSON.parse(stripped.content).hooks.PreToolUse).toEqual([{ matcher: 'Bash', hooks: [] }]);
  });
});
