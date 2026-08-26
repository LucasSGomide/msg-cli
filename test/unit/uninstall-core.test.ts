import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { stripBlock } from '../../src/core/blocks';
import { classifyFile } from '../../src/core/classify';
import {
  CLAUDE_MARKERS,
  MAKEFILE_MARKERS,
  claudeBlock,
  describeScaffold,
  type ScaffoldEntry,
} from '../../src/core/description';
import {
  manifestAreas,
  readRecordedVersion,
  renderManifest,
  versionMismatchMessage,
} from '../../src/core/manifest';
import { readProjectTemplate } from '../../src/core/templates';

const VERSION = '9.9.9';
const dirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'msg-uninstall-'));
  dirs.push(dir);
  return dir;
}

function write(root: string, path: string, content: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content, 'utf8');
}

function entryFor(
  path: string,
  areas: Parameters<typeof renderManifest>[0] = ['design'],
): Extract<ScaffoldEntry, { kind: 'file' | 'copied' }> {
  const entry = describeScaffold({ areas, seed: false, version: VERSION }).find(
    (candidate) => candidate.path === path,
  );
  if (!entry) throw new Error(`no described entry for ${path}`);
  if (entry.kind !== 'file' && entry.kind !== 'copied') {
    throw new Error(`${path} is not a file/copied entry`);
  }
  return entry;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readRecordedVersion', () => {
  it('reports a match and returns the version when they agree', () => {
    const result = readRecordedVersion(renderManifest(['design'], VERSION), VERSION);
    expect(result).toEqual({ recorded: VERSION, matches: true });
  });

  it('reports a mismatch and carries the recorded version', () => {
    const result = readRecordedVersion(renderManifest(['design'], '0.1.0'), VERSION);
    expect(result).toEqual({ recorded: '0.1.0', matches: false });
  });

  it('treats a manifest with no msg_version as a mismatch', () => {
    const result = readRecordedVersion('areas:\n  Design: docs/design.md\n', VERSION);
    expect(result).toEqual({ recorded: null, matches: false });
  });

  it('names the exact command to run instead', () => {
    expect(versionMismatchMessage('0.1.0')).toContain('npx @lucas-gomide/msg-cli@0.1.0 uninstall');
  });

  it('says the templates are unknown when no version was recorded', () => {
    expect(versionMismatchMessage(null)).toContain('no msg_version');
    expect(versionMismatchMessage(null)).not.toContain('npx');
  });
});

describe('manifestAreas', () => {
  it('reads back exactly the areas that were written', () => {
    expect(manifestAreas(renderManifest(['naming', 'back-end'], VERSION)).sort()).toEqual([
      'back-end',
      'naming',
    ]);
  });

  it('is empty for a manifest with no areas block', () => {
    expect(manifestAreas('msg_version: 9.9.9\n')).toEqual([]);
  });
});

describe('classifyFile', () => {
  it('classifies an untouched file as remove', () => {
    const root = tempRoot();
    const entry = entryFor('docs/roadmap/README.md');
    write(root, entry.path, entry.candidates[0]);

    expect(classifyFile(root, entry)).toBe('remove');
  });

  it('classifies one changed byte as kept-modified', () => {
    const root = tempRoot();
    const entry = entryFor('docs/roadmap/README.md');
    write(root, entry.path, `${entry.candidates[0]}x`);

    expect(classifyFile(root, entry)).toBe('kept-modified');
  });

  it('classifies a missing file as absent without throwing', () => {
    expect(classifyFile(tempRoot(), entryFor('docs/roadmap/README.md'))).toBe('absent');
  });

  it('accepts either rule-doc body as ours', () => {
    const entry = entryFor('docs/design.md');
    for (const body of entry.candidates) {
      const root = tempRoot();
      write(root, entry.path, body);
      expect(classifyFile(root, entry)).toBe('remove');
    }
  });

  it('keeps a rule doc a user has added a section to', () => {
    const root = tempRoot();
    const entry = entryFor('docs/design.md');
    write(root, entry.path, `${entry.candidates[0]}\n## My rules\n\n1. Do the thing.\n`);

    expect(classifyFile(root, entry)).toBe('kept-modified');
  });

  it('compares the vendored engine as bytes', () => {
    const root = tempRoot();
    const entry = entryFor('scripts/roadmap-sync.mjs');
    write(root, entry.path, entry.candidates[0]);

    expect(classifyFile(root, entry)).toBe('remove');
  });

  it('ignores CRLF line endings', () => {
    const root = tempRoot();
    const entry = entryFor('docs/roadmap/README.md');
    write(root, entry.path, entry.candidates[0].replace(/\n/g, '\r\n'));

    expect(classifyFile(root, entry)).toBe('remove');
  });
});

describe('stripBlock', () => {
  const makefile = readProjectTemplate('Makefile.block');
  const claude = claudeBlock(['design']);

  it('removes a CLAUDE.md holding only our block', () => {
    const result = stripBlock(claude, claude, CLAUDE_MARKERS);
    expect(result.outcome).toBe('remove');
  });

  it('strips to the project content on both sides, byte for byte', () => {
    const before = '# My rules\n\nDo the thing.\n';
    const after = '\n## After\n\nMore.\n';

    const result = stripBlock(before + claude + after, claude, CLAUDE_MARKERS);

    expect(result.outcome).toBe('strip');
    expect(result.content).toBe(before + after);
  });

  it('keeps a CLAUDE.md missing its end marker', () => {
    const content = `# Mine\n\n${CLAUDE_MARKERS[0]}\n\nsomething\n`;
    const result = stripBlock(content, claude, CLAUDE_MARKERS);

    expect(result.outcome).toBe('kept-modified');
    expect(result.content).toBe(content);
  });

  it('keeps a file whose end marker comes before its start marker', () => {
    const content = `${CLAUDE_MARKERS[1]}\n\n${CLAUDE_MARKERS[0]}\n`;
    expect(stripBlock(content, claude, CLAUDE_MARKERS).outcome).toBe('kept-modified');
  });

  it('keeps an edited region between intact markers', () => {
    const content = claude.replace('## Planning workflow', '## My planning workflow');
    const result = stripBlock(content, claude, CLAUDE_MARKERS);

    expect(result.outcome).toBe('kept-modified');
    expect(result.content).toBe(content);
  });

  it('removes a Makefile holding only our block', () => {
    // What createOrAppend writes when the Makefile did not exist.
    const content = makefile.replace(/^\n+/, '');
    expect(stripBlock(content, makefile, MAKEFILE_MARKERS).outcome).toBe('remove');
  });

  it("keeps the project's own targets and strips only our block", () => {
    const own = 'build:\n\techo hi\n';
    const result = stripBlock(own + makefile, makefile, MAKEFILE_MARKERS);

    expect(result.outcome).toBe('strip');
    expect(result.content).toBe(own);
  });

  it('keeps a Makefile with no markers at all', () => {
    const result = stripBlock('build:\n\techo hi\n', makefile, MAKEFILE_MARKERS);
    expect(result.outcome).toBe('kept-modified');
    expect(result.content).toBe('build:\n\techo hi\n');
  });

  it('removes a file left holding only whitespace', () => {
    const result = stripBlock(`\n  \n${claude}\n\n`, claude, CLAUDE_MARKERS);
    expect(result.outcome).toBe('remove');
  });
});
