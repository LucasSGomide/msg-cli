import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { AREA_SLUGS, type AreaSlug } from './areas';

/**
 * A project's shape is the question you actually have an answer to. Areas are
 * derived from it, so `init` asks one question instead of six checkboxes.
 */
export const SHAPES = {
  api: ['back-end', 'api-stack', 'naming'],
  web: ['front-end', 'web-stack', 'design', 'naming'],
  both: AREA_SLUGS,
  'docs-only': ['design', 'naming'],
} as const satisfies Record<string, readonly AreaSlug[]>;

export type Shape = keyof typeof SHAPES;

export const SHAPE_NAMES = Object.keys(SHAPES) as Shape[];

export function isShape(value: string): value is Shape {
  return Object.hasOwn(SHAPES, value);
}

export function areasForShape(shape: Shape): AreaSlug[] {
  return [...SHAPES[shape]];
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
