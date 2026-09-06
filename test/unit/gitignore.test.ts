import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { UsageError } from '../../src/core/areas';
import {
  GITIGNORE_GROUPS_FULL,
  GITIGNORE_MARKERS,
  buildGitignoreBlock,
  classifyGitignore,
  parseGitignoreGroups,
} from '../../src/core/gitignore';

const dirs: string[] = [];

function tempFile(content?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'msg-gitignore-'));
  dirs.push(dir);
  const path = join(dir, '.gitignore');
  if (content !== undefined) writeFileSync(path, content, 'utf8');
  return path;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('buildGitignoreBlock', () => {
  it('opens and closes with the msg-roadmap markers, reused from the Makefile block', () => {
    const block = buildGitignoreBlock(['docs']);
    expect(block.trimStart().startsWith(GITIGNORE_MARKERS[0])).toBe(true);
    expect(block.trimEnd().endsWith(GITIGNORE_MARKERS[1])).toBe(true);
  });

  it('lists each group in the same canonical order regardless of pick order', () => {
    const a = buildGitignoreBlock(['makefile', 'docs']);
    const b = buildGitignoreBlock(['docs', 'makefile']);
    expect(a).toBe(b);
    expect(a.indexOf('docs/')).toBeLessThan(a.indexOf('Makefile'));
  });

  it('lists exactly one path for the skills group', () => {
    expect(buildGitignoreBlock(['skills'])).toContain('.claude/skills/msg-*');
  });

  it('lists all four hook scripts for the hooks group', () => {
    const block = buildGitignoreBlock(['hooks']);
    for (const script of [
      'branch-guard-pre.sh',
      'branch-guard-post.sh',
      'acceptance-criteria-gate.sh',
      'retire-breakdown-post.sh',
    ]) {
      expect(block).toContain(`.claude/hooks/${script}`);
    }
  });

  it('renders Codex-native skill and hook paths without Claude entries', () => {
    const block = buildGitignoreBlock(['skills', 'hooks'], 'codex');
    expect(block).toContain('.agents/skills/msg-*');
    expect(block).toContain('.codex/hooks/branch-guard-pre.sh');
    expect(block).not.toContain('.claude/');
  });

  it('picking every group is byte-identical to "all"', () => {
    expect(buildGitignoreBlock(GITIGNORE_GROUPS_FULL)).toBe(
      buildGitignoreBlock(['makefile', 'hooks', 'skills', 'docs']),
    );
  });
});

describe('parseGitignoreGroups', () => {
  it('parses a comma list against the allowed groups', () => {
    expect(parseGitignoreGroups('docs,skills', GITIGNORE_GROUPS_FULL)).toEqual(['docs', 'skills']);
  });

  it('normalises case and whitespace', () => {
    expect(parseGitignoreGroups(' Docs , SKILLS ', GITIGNORE_GROUPS_FULL)).toEqual([
      'docs',
      'skills',
    ]);
  });

  it('"all" expands to every allowed group', () => {
    expect(parseGitignoreGroups('all', GITIGNORE_GROUPS_FULL)).toEqual([...GITIGNORE_GROUPS_FULL]);
    expect(parseGitignoreGroups('all', ['skills'])).toEqual(['skills']);
  });

  it('an empty string is a deliberate "ignore nothing"', () => {
    expect(parseGitignoreGroups('', GITIGNORE_GROUPS_FULL)).toEqual([]);
  });

  it('rejects a group outside skills-only’s allowed set', () => {
    expect(() => parseGitignoreGroups('docs', ['skills'])).toThrow(UsageError);
    expect(() => parseGitignoreGroups('docs', ['skills'])).toThrow(/unknown --gitignore group/);
  });

  it('rejects an unknown group name for the full scaffold', () => {
    expect(() => parseGitignoreGroups('bogus', GITIGNORE_GROUPS_FULL)).toThrow(UsageError);
  });

  it('re-orders picks into the canonical order', () => {
    expect(parseGitignoreGroups('makefile,docs', GITIGNORE_GROUPS_FULL)).toEqual([
      'docs',
      'makefile',
    ]);
  });
});

describe('classifyGitignore', () => {
  it('is absent when the file does not exist', () => {
    const path = tempFile();
    expect(classifyGitignore(path, GITIGNORE_GROUPS_FULL)).toEqual({
      outcome: 'absent',
      content: '',
    });
  });

  it('is absent when the file exists but never carried our marker', () => {
    const path = tempFile('node_modules/\n');
    expect(classifyGitignore(path, GITIGNORE_GROUPS_FULL).outcome).toBe('absent');
  });

  it('is "remove" when the block is the only content', () => {
    const path = tempFile(buildGitignoreBlock(['docs']).replace(/^\n+/, ''));
    const state = classifyGitignore(path, GITIGNORE_GROUPS_FULL);
    expect(state.outcome).toBe('remove');
    expect(state.content).toBe('');
  });

  it('is "strip" when the block sits beside content the project owns, and returns the rest', () => {
    const before = 'node_modules/\n*.log\n';
    const path = tempFile(before + buildGitignoreBlock(['skills', 'hooks']));
    const state = classifyGitignore(path, GITIGNORE_GROUPS_FULL);
    expect(state.outcome).toBe('strip');
    expect(state.content).toBe(before);
  });

  it('matches any subset of the allowed groups, not just the full set', () => {
    const path = tempFile(buildGitignoreBlock(['makefile']).replace(/^\n+/, ''));
    expect(classifyGitignore(path, GITIGNORE_GROUPS_FULL).outcome).toBe('remove');
  });

  it('is "kept-modified" when the user edited inside the markers', () => {
    const edited = `${GITIGNORE_MARKERS[0]}\ndist/\n${GITIGNORE_MARKERS[1]}\n`;
    const path = tempFile(edited);
    const state = classifyGitignore(path, GITIGNORE_GROUPS_FULL);
    expect(state.outcome).toBe('kept-modified');
    expect(state.content).toBe(edited);
  });

  it('classifies a Codex block only against Codex paths', () => {
    const path = tempFile(buildGitignoreBlock(['skills'], 'codex').replace(/^\n+/, ''));
    expect(classifyGitignore(path, GITIGNORE_GROUPS_FULL, 'codex').outcome).toBe('remove');
    expect(classifyGitignore(path, GITIGNORE_GROUPS_FULL, 'claude').outcome).toBe('kept-modified');
  });
});
