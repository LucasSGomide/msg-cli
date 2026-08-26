import { describe, expect, it } from 'vitest';

import { mergeBranchGuardHooks, stripBranchGuardHooks } from '../../src/core/settingsJson';

const PRE = '"$CLAUDE_PROJECT_DIR/.claude/hooks/branch-guard-pre.sh"';
const POST = '"$CLAUDE_PROJECT_DIR/.claude/hooks/branch-guard-post.sh"';

describe('mergeBranchGuardHooks', () => {
  it('creates the file from nothing', () => {
    const result = mergeBranchGuardHooks(null);

    expect(result.changed).toBe(true);
    expect(result.skipped).toBe(false);
    const parsed = JSON.parse(result.text);
    expect(parsed.hooks.PreToolUse).toEqual([
      { matcher: 'Write|Edit|MultiEdit', hooks: [{ type: 'command', command: PRE }] },
    ]);
    expect(parsed.hooks.PostToolUse).toEqual([
      { matcher: 'Bash', hooks: [{ type: 'command', command: POST }] },
    ]);
  });

  it('is idempotent against its own output', () => {
    const first = mergeBranchGuardHooks(null);
    const second = mergeBranchGuardHooks(first.text);

    expect(second.changed).toBe(false);
    expect(second.text).toBe(first.text);
  });

  it('adds our command to an existing matcher group rather than a new one', () => {
    const existing = JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: 'Write|Edit|MultiEdit',
            hooks: [{ type: 'command', command: '"./other-hook.sh"' }],
          },
        ],
      },
    });

    const result = mergeBranchGuardHooks(existing);

    expect(result.changed).toBe(true);
    const parsed = JSON.parse(result.text);
    expect(parsed.hooks.PreToolUse).toHaveLength(1);
    expect(parsed.hooks.PreToolUse[0].hooks).toEqual([
      { type: 'command', command: '"./other-hook.sh"' },
      { type: 'command', command: PRE },
    ]);
  });

  it('leaves unrelated top-level keys and matcher groups untouched', () => {
    const existing = JSON.stringify({
      permissions: { allow: ['Bash(npm test)'] },
      hooks: {
        PostToolUse: [{ matcher: 'Grep', hooks: [{ type: 'command', command: '"./x.sh"' }] }],
      },
    });

    const result = mergeBranchGuardHooks(existing);
    const parsed = JSON.parse(result.text);

    expect(parsed.permissions).toEqual({ allow: ['Bash(npm test)'] });
    expect(parsed.hooks.PostToolUse).toContainEqual({
      matcher: 'Grep',
      hooks: [{ type: 'command', command: '"./x.sh"' }],
    });
  });

  it('never touches a file that is not a JSON object', () => {
    const result = mergeBranchGuardHooks('not json at all');

    expect(result).toEqual({ text: 'not json at all', changed: false, skipped: true });
  });
});

describe('stripBranchGuardHooks', () => {
  it('removes the whole file when it held only our entries', () => {
    const installed = mergeBranchGuardHooks(null).text;

    const result = stripBranchGuardHooks(installed);

    expect(result.outcome).toBe('remove');
    expect(result.content).toBe('');
  });

  it('strips only our entries, leaving the rest of the file intact', () => {
    const installed = mergeBranchGuardHooks(
      JSON.stringify({
        permissions: { allow: ['Bash(npm test)'] },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Write|Edit|MultiEdit',
              hooks: [{ type: 'command', command: '"./mine.sh"' }],
            },
          ],
        },
      }),
    ).text;

    const result = stripBranchGuardHooks(installed);

    expect(result.outcome).toBe('strip');
    const parsed = JSON.parse(result.content);
    expect(parsed.permissions).toEqual({ allow: ['Bash(npm test)'] });
    expect(parsed.hooks.PreToolUse).toEqual([
      { matcher: 'Write|Edit|MultiEdit', hooks: [{ type: 'command', command: '"./mine.sh"' }] },
    ]);
    expect(parsed.hooks.PostToolUse).toBeUndefined();
  });

  it('reports absent when the file has neither entry', () => {
    const content = JSON.stringify({ permissions: { allow: [] } });
    expect(stripBranchGuardHooks(content)).toEqual({ outcome: 'absent', content });
  });

  it('reports absent when the file does not parse as JSON', () => {
    expect(stripBranchGuardHooks('not json').outcome).toBe('absent');
  });

  it('is a no-op the second time — nothing left to strip', () => {
    const installed = mergeBranchGuardHooks(null).text;
    const stripped = stripBranchGuardHooks(installed);

    expect(stripBranchGuardHooks(stripped.content)).toEqual({
      outcome: 'absent',
      content: stripped.content,
    });
  });
});
