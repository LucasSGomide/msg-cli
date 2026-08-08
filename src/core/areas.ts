/**
 * Every area ships a rule doc. The doc is what `project.yml` points at, and the
 * label is the bold bullet prefix a roadmap item's Key Areas section must use —
 * so adding an area here adds it to the planning vocabulary, not just the docs.
 *
 * `seed` names the file under templates/docs/ holding the opinionated default
 * content. An area with no seed can only ever be scaffolded as an empty stub.
 */
export interface Area {
  readonly label: string;
  readonly doc: string;
  readonly seed: string;
}

export const AREAS = {
  'back-end': {
    label: 'Back-end',
    doc: 'docs/architecture-api.md',
    seed: 'architecture-api.md',
  },
  'front-end': {
    label: 'Front-end',
    doc: 'docs/architecture-web.md',
    seed: 'architecture-web.md',
  },
  'api-stack': {
    label: 'API stack',
    doc: 'docs/stack-api.md',
    seed: 'stack-api.md',
  },
  'web-stack': {
    label: 'Web stack',
    doc: 'docs/stack-web.md',
    seed: 'stack-web.md',
  },
  design: {
    label: 'Design',
    doc: 'docs/design.md',
    seed: 'design.md',
  },
  naming: {
    label: 'Naming',
    doc: 'docs/naming.md',
    seed: 'naming.md',
  },
} as const satisfies Record<string, Area>;

export type AreaSlug = keyof typeof AREAS;

export const AREA_SLUGS = Object.keys(AREAS) as AreaSlug[];

export function isAreaSlug(value: string): value is AreaSlug {
  return Object.hasOwn(AREAS, value);
}

/**
 * Parse `--areas back-end,naming`. Unknown slugs are a usage error rather than a
 * silent skip: a typo would otherwise scaffold a project quietly missing a doc.
 */
export function parseAreas(raw: string): AreaSlug[] {
  const chosen = raw
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a !== '');

  const unknown = chosen.filter((a) => !isAreaSlug(a));
  if (unknown.length) {
    throw new UsageError(`unknown area(s) ${unknown.join(', ')}. Known: ${AREA_SLUGS.join(', ')}`);
  }
  // Dedupe while keeping the order the user wrote.
  return [...new Set(chosen as AreaSlug[])];
}

export class UsageError extends Error {}
