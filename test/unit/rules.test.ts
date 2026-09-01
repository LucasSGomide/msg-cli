import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SKILLS_DIR } from '../../src/core/templates';
import { USAGE } from '../../src/usage';

describe('USAGE', () => {
  it('lists uninstall with its flags', () => {
    expect(USAGE).toContain('msg uninstall');
    expect(USAGE).toContain('--dry-run');
    expect(USAGE).toMatch(/uninstall options[\s\S]*--root <dir>/);
    expect(USAGE).toMatch(/uninstall options[\s\S]*-y, --yes/);
  });

  it('lists migrate-roadmap, its flags, and that it is temporary', () => {
    expect(USAGE).toContain('msg migrate-roadmap');
    expect(USAGE).toContain('(temporary)');
    expect(USAGE).toMatch(/migrate-roadmap options[\s\S]*--dry-run/);
    expect(USAGE).toMatch(/migrate-roadmap options[\s\S]*-y, --yes/);
    expect(USAGE).toMatch(/migrate-roadmap options[\s\S]*will be removed once/);
  });

  it('states the never-remove-modified guarantee and the version rule', () => {
    expect(USAGE).toContain('A file you have modified is never removed');
    expect(USAGE).toContain('matches the CLI in hand');
  });
});

describe('the msg-setup skill', () => {
  it('no longer claims msg_version goes unread', () => {
    const text = readFileSync(join(SKILLS_DIR, 'msg-setup', 'SKILL.md'), 'utf8');
    expect(text).not.toMatch(/Nothing reads it/);
    expect(text).toContain('msg uninstall');
  });
});
