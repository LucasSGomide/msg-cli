import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ENGINE_SRC,
  parsePortableSkills,
  PORTABLE_SKILLS,
  SKILLS,
  SKILLS_DIR,
} from '../../src/core/templates';

const REPO = fileURLToPath(new URL('../..', import.meta.url));

const skillText = (skill: string) => readFileSync(join(SKILLS_DIR, skill, 'SKILL.md'), 'utf8');

const templateFolders = () =>
  readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const missingFrom = (from: readonly string[], of: readonly string[]) =>
  from.filter((name) => !of.includes(name)).sort();

/**
 * The drift report both directions of the set-equality check share. A bare count
 * mismatch says a folder is unaccounted for without saying which, which is the
 * whole cost of the drift this test exists to stop.
 */
function driftReport(skills: readonly string[], folders: readonly string[]): string {
  const unbacked = missingFrom(skills, folders);
  const unshipped = missingFrom(folders, skills);
  const parts: string[] = [];
  if (unbacked.length)
    parts.push(`in SKILLS with no templates/skills/ folder: ${unbacked.join(', ')}`);
  if (unshipped.length)
    parts.push(`under templates/skills/ but absent from SKILLS: ${unshipped.join(', ')}`);
  return parts.join('; ');
}

describe('SKILLS against the folders on disk', () => {
  // A name in SKILLS with no folder makes `init` throw ENOENT at runtime; a
  // folder with no name in SKILLS ships to nobody. Neither fails anywhere else.
  it('is set-equal to the folders under templates/skills/', () => {
    const folders = templateFolders();
    expect(driftReport(SKILLS, folders), driftReport(SKILLS, folders)).toBe('');
    expect([...SKILLS].sort()).toEqual([...folders].sort());
  });

  it('reports the folders missing from each side rather than a bare count', () => {
    const report = driftReport(['msg-setup', 'msg-ghost'], ['msg-setup', 'msg-orphan']);

    expect(report).toContain('msg-ghost');
    expect(report).toContain('msg-orphan');
    expect(report).toContain('no templates/skills/ folder');
    expect(report).toContain('absent from SKILLS');
  });

  it('says nothing when the two sides agree', () => {
    expect(driftReport(['msg-setup'], ['msg-setup'])).toBe('');
  });

  it('ships every portable skill as part of the full set', () => {
    expect(missingFrom(PORTABLE_SKILLS, SKILLS)).toEqual([]);
  });
});

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
  it.each(SKILLS)('%s matches the template', (skill) => {
    const live = join(REPO, '.claude', 'skills', skill, 'SKILL.md');
    expect(existsSync(live), `${live} is missing`).toBe(true);
    expect(readFileSync(live, 'utf8')).toBe(skillText(skill));
  });

  // Roadmap item 09, task 02: the two pre-roadmap skills have to exist here as
  // folders, not only as names in SKILLS — msg-cli plans its own work with them.
  it.each(['msg-pre-roadmap', 'msg-brainstorm'])('holds a %s folder of its own', (skill) => {
    expect(existsSync(join(REPO, '.claude', 'skills', skill, 'SKILL.md'))).toBe(true);
  });

  // msg-cli ran its own init, so it vendors the engine like any other project.
  // That copy is real and can go stale exactly the same way.
  it('vendors the same engine it ships', () => {
    const vendored = join(REPO, 'scripts', 'roadmap-sync.mjs');
    expect(existsSync(vendored), `${vendored} is missing — re-run \`msg init\``).toBe(true);
    expect(readFileSync(vendored, 'utf8')).toBe(readFileSync(ENGINE_SRC, 'utf8'));
  });
});

describe('parsePortableSkills', () => {
  it('accepts msg-brainstorm rather than throwing', () => {
    expect(parsePortableSkills('msg-brainstorm')).toEqual(['msg-brainstorm']);
  });

  it('enumerates all three portable names when one is unknown', () => {
    expect(() => parsePortableSkills('msg-setup')).toThrow(
      /Known: msg-brainstorm, msg-grill-me, msg-write-prompt/,
    );
    expect(PORTABLE_SKILLS).toHaveLength(3);
  });
});
