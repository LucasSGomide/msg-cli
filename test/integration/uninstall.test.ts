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
import { join, relative } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { init } from '../../src/commands/init';
import { uninstall } from '../../src/commands/uninstall';
import { classifyBlock } from '../../src/core/blocks';
import { describeScaffold } from '../../src/core/description';
import { buildPlan, type Plan } from '../../src/core/plan';
import * as prompts from '../../src/prompts';

const VERSION = '9.9.9';
const dirs: string[] = [];

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'msg-uninst-'));
  dirs.push(dir);
  mkdirSync(join(dir, '.git'), { recursive: true });
  return dir;
}

async function scaffolded(shape = 'docs-only'): Promise<string> {
  const root = project();
  await init({ root, shape, seed: false }, VERSION);
  return root;
}

function listFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (name === '.git') continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else found.push(relative(root, path).split('\\').join('/'));
    }
  };
  walk(root);
  return found.sort();
}

function planOf(root: string, version = VERSION): Plan {
  const result = buildPlan(root, version);
  if (!result.ok) throw new Error(result.error);
  return result.plan;
}

function outcomeFor(plan: Plan, path: string): string | undefined {
  return plan.entries.find((entry) => entry.path === path)?.outcome;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('classifyBlock, against a real init', () => {
  it('restores a pre-existing Makefile and CLAUDE.md to their pre-init bytes', async () => {
    const root = project();
    const makefile = 'build:\n\techo hi\n';
    const claude = '# My rules\n\nDo the thing.\n';
    writeFileSync(join(root, 'Makefile'), makefile, 'utf8');
    writeFileSync(join(root, 'CLAUDE.md'), claude, 'utf8');

    await init({ root, shape: 'docs-only', seed: false }, VERSION);
    const described = describeScaffold({
      areas: ['design', 'naming'],
      seed: false,
      version: VERSION,
    });

    for (const [path, before] of [
      ['Makefile', makefile],
      ['CLAUDE.md', claude],
    ] as const) {
      const entry = described.find((candidate) => candidate.path === path);
      if (entry?.kind !== 'appended') throw new Error(`${path} is not an appended entry`);
      const result = classifyBlock(root, entry);
      expect(result.outcome, path).toBe('strip');
      expect(result.content, path).toBe(before);
    }
  });
});

describe('buildPlan', () => {
  it('yields no plan on a version mismatch, and the message to run instead', async () => {
    const root = await scaffolded();
    const result = buildPlan(root, '1.2.3');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(`npx @lucas-gomide/msg-cli@${VERSION} uninstall`);
  });

  it('marks every scaffolded path remove straight after init, project.yml included', async () => {
    const root = await scaffolded('both');
    const plan = planOf(root);

    for (const entry of plan.entries) {
      expect(entry.outcome, entry.path).toBe('remove');
    }
    expect(outcomeFor(plan, 'project.yml')).toBe('remove');
  });

  it('plans project.yml for removal even when it has been hand-edited', async () => {
    const root = await scaffolded();
    const manifest = readFileSync(join(root, 'project.yml'), 'utf8');
    writeFileSync(join(root, 'project.yml'), `${manifest}\n# a note of my own\n`, 'utf8');

    expect(outcomeFor(planOf(root), 'project.yml')).toBe('remove');
  });

  it('keeps a planning folder holding authored work, and never lists the doc', async () => {
    const root = await scaffolded();
    writeFileSync(join(root, 'docs/roadmap/01-mine.md'), '# Mine\n', 'utf8');

    const plan = planOf(root);

    expect(plan.folders).not.toContain('docs/roadmap');
    expect(plan.entries.map((e) => e.path)).not.toContain('docs/roadmap/01-mine.md');
    expect(plan.warnings.join('\n')).toContain('docs/roadmap/ stays');
  });

  it('still removes that folder README when it is unmodified', async () => {
    const root = await scaffolded();
    writeFileSync(join(root, 'docs/roadmap/01-mine.md'), '# Mine\n', 'utf8');

    expect(outcomeFor(planOf(root), 'docs/roadmap/README.md')).toBe('remove');
  });

  it('removes a folder holding only our README, and the README', async () => {
    const root = await scaffolded();
    const plan = planOf(root);

    expect(outcomeFor(plan, 'docs/ditched/README.md')).toBe('remove');
    expect(plan.folders).toContain('docs/ditched');
  });

  it("never plans scripts/ itself, nor a project's own script", async () => {
    const root = await scaffolded();
    writeFileSync(join(root, 'scripts/other.mjs'), '// mine\n', 'utf8');

    const plan = planOf(root);

    expect(plan.entries.map((e) => e.path)).not.toContain('scripts/other.mjs');
    expect(plan.folders).not.toContain('scripts');
    expect(outcomeFor(plan, 'scripts/roadmap-sync.mjs')).toBe('remove');
  });

  it('has no entry for an area the workspace never installed', async () => {
    const root = await scaffolded();
    const paths = planOf(root).entries.map((e) => e.path);

    expect(paths).toContain('docs/design.md');
    expect(paths).not.toContain('docs/architecture-api.md');
  });

  it('writes nothing and deletes nothing', async () => {
    const root = await scaffolded('both');
    const before = listFiles(root);

    planOf(root);

    expect(listFiles(root)).toEqual(before);
  });
});

describe('uninstall', () => {
  it('leaves no scaffolded path behind with -y', async () => {
    const root = await scaffolded('both');

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.code).toBe(0);
    expect(listFiles(root)).toEqual([]);
  });

  it('prints the plan and touches nothing with --dry-run', async () => {
    const root = await scaffolded('both');
    const before = listFiles(root);

    const result = await uninstall({ root, dryRun: true }, VERSION);

    expect(result.code).toBe(0);
    expect(result.out.join('\n')).toContain('remove  project.yml');
    expect(result.out.join('\n')).toContain('dry run — nothing was removed');
    expect(listFiles(root)).toEqual(before);
  });

  it('is still a dry run with -y', async () => {
    const root = await scaffolded();
    const before = listFiles(root);

    await uninstall({ root, dryRun: true, yes: true }, VERSION);

    expect(listFiles(root)).toEqual(before);
  });

  it('writes nothing and exits 2 when the prompt is declined', async () => {
    const root = await scaffolded();
    const before = listFiles(root);
    // The plan is flushed to the terminal before the prompt; keep it out of the
    // runner's own output.
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(prompts, 'isInteractive').mockReturnValue(true);
    vi.spyOn(prompts, 'askUninstall').mockResolvedValue(false);

    const result = await uninstall({ root }, VERSION);

    expect(result.code).toBe(2);
    expect(listFiles(root)).toEqual(before);
  });

  // `emit` prints what a command returns, which is after the prompt — so a plan
  // left in `out` renders under a question the user has already answered.
  it('puts the whole plan on screen before it asks', async () => {
    const root = await scaffolded();
    const written: string[] = [];
    let onScreenWhenAsked = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    vi.spyOn(prompts, 'isInteractive').mockReturnValue(true);
    vi.spyOn(prompts, 'askUninstall').mockImplementation(async () => {
      onScreenWhenAsked = written.join('');
      return false;
    });

    const result = await uninstall({ root }, VERSION);

    expect(onScreenWhenAsked).toContain('remove  project.yml');
    expect(onScreenWhenAsked).toContain('remove  docs/design.md');
    // And not a second time once the command returns.
    expect(result.out.join('\n')).not.toContain('remove  project.yml');
  });

  it('keeps a modified rule doc and says whose it is', async () => {
    const root = await scaffolded();
    writeFileSync(join(root, 'docs/design.md'), '# Mine now\n', 'utf8');

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.out.join('\n')).toContain('kept    docs/design.md — yours, remove by hand');
    expect(existsSync(join(root, 'docs/design.md'))).toBe(true);
    expect(existsSync(join(root, 'project.yml'))).toBe(false);
  });

  it('exits 1 naming the version to run, with no plan printed', async () => {
    const root = await scaffolded();

    const result = await uninstall({ root, yes: true }, '1.2.3');

    expect(result.code).toBe(1);
    expect(result.err.join('\n')).toContain(`npx @lucas-gomide/msg-cli@${VERSION} uninstall`);
    expect(result.out).toEqual([]);
    expect(existsSync(join(root, 'project.yml'))).toBe(true);
  });

  it('exits 1 without deleting anything when there is no project.yml', async () => {
    const root = project();
    writeFileSync(join(root, 'CLAUDE.md'), '# Mine\n', 'utf8');

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.code).toBe(1);
    expect(result.err.join('\n')).toContain('no project.yml');
    expect(listFiles(root)).toEqual(['CLAUDE.md']);
  });

  it('refuses non-interactively without -y, and deletes nothing', async () => {
    const root = await scaffolded();
    const before = listFiles(root);
    vi.spyOn(prompts, 'isInteractive').mockReturnValue(false);

    await expect(uninstall({ root }, VERSION)).rejects.toThrow(/pass -y/);
    expect(listFiles(root)).toEqual(before);
  });

  it('cuts our blocks out of files the project owns and leaves the rest', async () => {
    const root = project();
    const makefile = 'build:\n\techo hi\n';
    const claude = '# My rules\n\nDo the thing.\n';
    writeFileSync(join(root, 'Makefile'), makefile, 'utf8');
    writeFileSync(join(root, 'CLAUDE.md'), claude, 'utf8');
    await init({ root, shape: 'docs-only', seed: false }, VERSION);

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.code).toBe(0);
    expect(readFileSync(join(root, 'Makefile'), 'utf8')).toBe(makefile);
    expect(readFileSync(join(root, 'CLAUDE.md'), 'utf8')).toBe(claude);
    expect(listFiles(root)).toEqual(['CLAUDE.md', 'Makefile']);
  });
});

describe('uninstall, against a --shape skills-only scaffold', () => {
  const WRITE_PROMPT = '.claude/skills/msg-write-prompt/SKILL.md';

  it('removes it even though it wrote no project.yml', async () => {
    const root = project();
    await init({ root, shape: 'skills-only', skills: 'msg-write-prompt' }, VERSION);

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.code).toBe(0);
    expect(existsSync(join(root, WRITE_PROMPT))).toBe(false);
    expect(listFiles(root)).toEqual([]);
  });

  it('keeps a hand-edited skill and says whose it is', async () => {
    const root = project();
    await init({ root, shape: 'skills-only', skills: 'msg-write-prompt' }, VERSION);
    writeFileSync(join(root, WRITE_PROMPT), '# Mine now\n', 'utf8');

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.out.join('\n')).toContain(`kept    ${WRITE_PROMPT} — yours, remove by hand`);
    expect(existsSync(join(root, WRITE_PROMPT))).toBe(true);
  });

  it('still errors cleanly when nothing was scaffolded at all', async () => {
    const root = project();
    writeFileSync(join(root, 'CLAUDE.md'), '# Mine\n', 'utf8');

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.code).toBe(1);
    expect(result.err.join('\n')).toContain('no project.yml');
    expect(listFiles(root)).toEqual(['CLAUDE.md']);
  });
});

describe('uninstall and the branch-guard hook', () => {
  const SETTINGS = '.claude/settings.json';
  const HOOK_PRE = '.claude/hooks/branch-guard-pre.sh';
  const HOOK_POST = '.claude/hooks/branch-guard-post.sh';

  it('removes a freshly created settings.json and both hook scripts', async () => {
    const root = await scaffolded();

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.code).toBe(0);
    expect(existsSync(join(root, SETTINGS))).toBe(false);
    expect(existsSync(join(root, HOOK_PRE))).toBe(false);
    expect(existsSync(join(root, HOOK_POST))).toBe(false);
  });

  it('ships the hook scripts executable', async () => {
    const root = await scaffolded();

    expect(statSync(join(root, HOOK_PRE)).mode & 0o111).not.toBe(0);
    expect(statSync(join(root, HOOK_POST)).mode & 0o111).not.toBe(0);
  });

  it('merges into a settings.json the project already owns, and strips only its own entries back out', async () => {
    const root = project();
    mkdirSync(join(root, '.claude'), { recursive: true });
    writeFileSync(
      join(root, SETTINGS),
      JSON.stringify({ permissions: { allow: ['Bash(npm test)'] } }, null, 2),
      'utf8',
    );
    await init({ root, shape: 'docs-only', seed: false }, VERSION);

    const afterInit = JSON.parse(readFileSync(join(root, SETTINGS), 'utf8'));
    expect(afterInit.permissions).toEqual({ allow: ['Bash(npm test)'] });
    expect(afterInit.hooks.PreToolUse).toBeDefined();

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.out.join('\n')).toContain(`strip   ${SETTINGS}`);
    const afterUninstall = JSON.parse(readFileSync(join(root, SETTINGS), 'utf8'));
    expect(afterUninstall).toEqual({ permissions: { allow: ['Bash(npm test)'] } });
    expect(existsSync(join(root, HOOK_PRE))).toBe(false);
  });

  it('leaves settings.json alone once the project has removed our hook entries', async () => {
    const root = await scaffolded();
    writeFileSync(join(root, SETTINGS), JSON.stringify({ permissions: {} }, null, 2), 'utf8');

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.out.join('\n')).not.toContain(SETTINGS);
    expect(existsSync(join(root, SETTINGS))).toBe(true);
  });
});

// Roadmap item 09 assumed uninstall needs no code change, because it builds its
// plan from the same describeScaffold that init writes from. These tests are
// what turns that assumption into a fact.
describe('uninstall and the pre-roadmap skills', () => {
  const PRE_ROADMAP = '.claude/skills/msg-pre-roadmap/SKILL.md';
  const BRAINSTORM = '.claude/skills/msg-brainstorm/SKILL.md';

  it('plans both new skills for removal without a change to its own code', async () => {
    const root = await scaffolded();
    const plan = planOf(root);

    expect(outcomeFor(plan, PRE_ROADMAP)).toBe('remove');
    expect(outcomeFor(plan, BRAINSTORM)).toBe('remove');
  });

  it('deletes both, leaving no .claude/skills behind', async () => {
    const root = await scaffolded('both');
    expect(listFiles(root)).toContain(PRE_ROADMAP);
    expect(listFiles(root)).toContain(BRAINSTORM);

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.code).toBe(0);
    expect(listFiles(root)).toEqual([]);
    expect(existsSync(join(root, '.claude', 'skills'))).toBe(false);
  });

  it('keeps a hand-edited msg-brainstorm and says whose it is', async () => {
    const root = await scaffolded();
    writeFileSync(join(root, BRAINSTORM), '# Mine now\n', 'utf8');

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.out.join('\n')).toContain(`kept    ${BRAINSTORM} — yours, remove by hand`);
    expect(existsSync(join(root, BRAINSTORM))).toBe(true);
  });
});

// Roadmap 10 — what removal does with a manifest `init` healed. Pinned so a
// later change has to state its intent rather than drift into one by accident.
describe('uninstall, against a healed manifest', () => {
  async function healed(): Promise<string> {
    const root = project();
    writeFileSync(
      join(root, 'project.yml'),
      [
        '# Project manifest, written before requirementsFile existed.',
        '',
        `msg_version: ${VERSION}`,
        '',
        'structure:',
        '  roadmap: docs/roadmap/',
        '  tasks: docs/tasks/',
        '  explorations: docs/explorations/',
        '  ditched: docs/ditched/',
        '',
        'areas:',
        '  Naming: docs/naming.md',
        '',
      ].join('\n'),
      'utf8',
    );
    await init({ root, shape: 'docs-only', seed: false }, VERSION);
    return root;
  }

  it('still reads the healed manifest — the appended key does not block the plan', async () => {
    const root = await healed();
    expect(readFileSync(join(root, 'project.yml'), 'utf8')).toContain(
      'requirementsFile: docs/requirements.md',
    );

    expect(outcomeFor(planOf(root), 'project.yml')).toBe('remove');
  });

  // `project.yml` is the one exemption from the byte-comparison in `plan.ts`:
  // it is hand-edited by design, so it is removed regardless of content. A
  // healed manifest changes nothing about that, and healing deliberately did
  // not widen its scope to change it.
  it('removes the healed manifest rather than keeping it as user-modified', async () => {
    const root = await healed();

    const result = await uninstall({ root, yes: true }, VERSION);

    expect(result.code).toBe(0);
    expect(result.out.join('\n')).toContain(
      '  remove  project.yml — hand-edited by design, removed regardless',
    );
    expect(existsSync(join(root, 'project.yml'))).toBe(false);
  });
});
