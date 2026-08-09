import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { AREA_SLUGS, type AreaSlug } from './areas';

/**
 * A project's shape is the question you actually have an answer to. Areas are
 * derived from it, so `init` asks one question instead of six checkboxes.
 */
export const SHAPES = {
  api: ['back-end', 'api-stack', 'auth', 'naming'],
  web: ['front-end', 'web-stack', 'auth', 'design', 'naming'],
  both: AREA_SLUGS,
  'docs-only': ['design', 'naming'],
} as const satisfies Record<string, readonly AreaSlug[]>;

export type Shape = keyof typeof SHAPES;

export const SHAPE_NAMES = Object.keys(SHAPES) as Shape[];

export function isShape(value: string): value is Shape {
  return Object.hasOwn(SHAPES, value);
}

/**
 * Plenty of projects have no sign-in at all, so auth is a question rather than a
 * given — but only where it could mean something. A docs-only project has no
 * runtime to put a session in, and asking would be noise.
 */
export function supportsAuth(shape: Shape): boolean {
  return slugsOf(shape).includes('auth');
}

/**
 * Auth sits in the shape lists at its natural position and is filtered back out,
 * so declining it never reorders the areas a project does keep — the manifest
 * of an api project without auth is the api list minus one line.
 */
export function areasForShape(shape: Shape, auth = true): AreaSlug[] {
  return slugsOf(shape).filter((slug) => auth || slug !== 'auth');
}

/** The tuples are readonly literal types; widen once so they can be iterated. */
function slugsOf(shape: Shape): readonly AreaSlug[] {
  return SHAPES[shape];
}

/**
 * Guess the shape from the repo's layout, so the prompt arrives pre-filled with
 * the answer rather than an empty one. Only ever a default — the user confirms.
 */
export function detectShape(root: string): Shape {
  const has = (...parts: string[]) => existsSync(join(root, ...parts));

  const api = has('packages', 'api') || has('apps', 'api') || has('src', 'main.ts');
  const web = has('packages', 'web') || has('apps', 'web') || has('index.html');

  if (api && web) return 'both';
  if (api) return 'api';
  if (web) return 'web';
  return 'docs-only';
}
