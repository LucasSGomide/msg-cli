import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ENGINE_SRC, SKILLS, SKILLS_DIR } from '../../src/core/templates';

const REPO = fileURLToPath(new URL('../..', import.meta.url));

const skillText = (skill: string) => readFileSync(join(SKILLS_DIR, skill, 'SKILL.md'), 'utf8');

describe('the skill payload', () => {
  it.each(SKILLS)('%s has frontmatter with a name and description', (skill) => {
    const text = skillText(skill);
    expect(text.startsWith('---\n')).toBe(true);
    const frontmatter = text.slice(4, text.indexOf('\n---', 4));
    expect(frontmatter).toMatch(/^name:\s*\S/m);
    expect(frontmatter).toMatch(/^description:\s*\S/m);
    expect(frontmatter).toContain(`name: ${skill}`);
  });

  it.each(SKILLS)('%s references no Python and no removed manifest keys', (skill) => {
    const text = skillText(skill);
    expect(text).not.toContain('roadmap_sync.py');
    expect(text).not.toContain('setup.py');
    expect(text).not.toContain('python3');
    // Dropped from the manifest; a skill still reading them would be wrong.
    expect(text).not.toMatch(/^commands:/m);
    expect(text).not.toMatch(/^skills:/m);
    expect(text).not.toMatch(/`vcs`|vcs:/);
  });

  it('ships no scripts alongside the skills — the engine is vendored instead', () => {
    for (const skill of SKILLS) {
      expect(existsSync(join(SKILLS_DIR, skill, 'scripts')), `${skill}/scripts`).toBe(false);
    }
  });

  it('describes the Key Areas and Technical Details split in both skills that use it', () => {
    expect(skillText('msg-roadmap-plan-item')).toContain('## Key Areas vs Technical Details');
    expect(skillText('msg-roadmap-task-breakdown')).toContain('## Is the item ready?');
  });

  it('states the same readiness bar on both sides of the handoff', () => {
    for (const skill of ['msg-roadmap-plan-item', 'msg-roadmap-task-breakdown']) {
      const text = skillText(skill);
      expect(text, skill).toContain('traceable to a');
      expect(text, skill).toContain('concrete action on a concrete thing');
    }
  });
});

describe("this repo's own skill copies", () => {
  // .claude/skills/ is the live copy used while developing msg-cli itself.
  // templates/skills/ is what ships. Two copies of the same prose drift the
  // moment one is edited alone, and nothing else would notice.
  it.each(SKILLS.filter((s) => s !== 'grill-me'))('%s matches the template', (skill) => {
    const live = join(REPO, '.claude', 'skills', skill, 'SKILL.md');
    expect(existsSync(live), `${live} is missing`).toBe(true);
    expect(readFileSync(live, 'utf8')).toBe(skillText(skill));
  });

  // msg-cli ran its own init, so it vendors the engine like any other project.
  // That copy is real and can go stale exactly the same way.
  it('vendors the same engine it ships', () => {
    const vendored = join(REPO, 'scripts', 'roadmap-sync.mjs');
    expect(existsSync(vendored), `${vendored} is missing — re-run \`msg init\``).toBe(true);
    expect(readFileSync(vendored, 'utf8')).toBe(readFileSync(ENGINE_SRC, 'utf8'));
  });
});
