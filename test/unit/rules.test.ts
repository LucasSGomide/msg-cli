import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SKILLS_DIR } from '../../src/core/templates';
import { USAGE } from '../../src/usage';

const REPO = fileURLToPath(new URL('../..', import.meta.url));

const ruleDoc = (name: string) => readFileSync(join(REPO, 'docs', name), 'utf8');

describe('USAGE', () => {
  it('lists uninstall with its flags', () => {
    expect(USAGE).toContain('msg uninstall');
    expect(USAGE).toContain('--dry-run');
    expect(USAGE).toMatch(/uninstall options[\s\S]*--root <dir>/);
    expect(USAGE).toMatch(/uninstall options[\s\S]*-y, --yes/);
  });

  it('states the never-remove-modified guarantee and the version rule', () => {
    expect(USAGE).toContain('A file you have modified is never removed');
    expect(USAGE).toContain('matches the CLI in hand');
  });
});

describe("this repo's own rule docs", () => {
  // The uninstall item owed both of these a first rule; a stub here means the
  // decisions it made are recorded nowhere a later item would find them.
  it('naming.md carries a numbered rule for CLI verb naming', () => {
    const text = ruleDoc('naming.md');
    expect(text).toMatch(/^1\. /m);
    expect(text).toContain('uninstall');
    expect(text).not.toContain('Nothing here yet.');
  });

  it('design.md carries a numbered rule for the report line format', () => {
    const text = ruleDoc('design.md');
    expect(text).toMatch(/^1\. /m);
    expect(text).toContain('two columns');
    expect(text).not.toContain('Nothing here yet.');
  });
});

describe('the msg-setup skill', () => {
  it('no longer claims msg_version goes unread', () => {
    const text = readFileSync(join(SKILLS_DIR, 'msg-setup', 'SKILL.md'), 'utf8');
    expect(text).not.toMatch(/Nothing reads it/);
    expect(text).toContain('msg uninstall');
  });
});
