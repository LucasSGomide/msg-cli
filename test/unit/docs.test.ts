import { describe, expect, it } from 'vitest';

import { readDocTemplate } from '../../src/core/templates';

/**
 * The point of splitting architecture from stack is that an architecture doc can
 * be seeded into a project running a different stack and still be true. These
 * tests are what stop a library name drifting back across the seam.
 */
const LIBRARIES = [
  'NestJS',
  'Nest',
  'Fastify',
  'Drizzle',
  'SST',
  'Testcontainers',
  'testcontainers',
  'Jest',
  'oxlint',
  'Vite',
  'Tanstack',
  'Orval',
  'MSW',
  'Vitest',
  'Shadcn',
  'Tailwind',
  'Playwright',
  'jsdom',
  'Zustand',
  'Redux',
  'React',
];

describe.each(['architecture-api.md', 'architecture-web.md'])('%s', (name) => {
  const text = readDocTemplate(name);

  it('names no library', () => {
    for (const library of LIBRARIES) {
      // Word boundary, so "Nest" does not match "nested".
      expect(text, `${name} mentions ${library}`).not.toMatch(new RegExp(`\\b${library}\\b`));
    }
  });

  it('points at its stack doc', () => {
    const stack = name.replace('architecture-', 'stack-');
    expect(text).toContain(`(${stack})`);
  });

  it('still carries its load-bearing rules', () => {
    expect(text).toMatch(/## Testing/);
    expect(text.length).toBeGreaterThan(2000);
  });
});

describe.each(['stack-api.md', 'stack-web.md'])('%s', (name) => {
  const text = readDocTemplate(name);

  it('points back at its architecture doc', () => {
    const architecture = name.replace('stack-', 'architecture-');
    expect(text).toContain(`(${architecture})`);
  });

  it('carries the gotchas that used to live in gotchas.md', () => {
    expect(text).toContain('## Gotchas');
    expect(text).toMatch(/\*\*Symptom:\*\*/);
    expect(text).toMatch(/\*\*Rule:\*\*/);
  });
});

describe('the docs payload', () => {
  it('no longer ships a standalone gotchas doc', () => {
    expect(() => readDocTemplate('gotchas.md')).toThrow();
  });

  it('keeps every seeded doc free of dangling links to it', () => {
    for (const name of [
      'architecture-api.md',
      'architecture-web.md',
      'stack-api.md',
      'stack-web.md',
      'design.md',
      'naming.md',
    ]) {
      expect(readDocTemplate(name), name).not.toContain('gotchas.md');
    }
  });
});
