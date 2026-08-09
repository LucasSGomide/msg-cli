import { resolve } from 'node:path';

import { UsageError, parseAreas, type AreaSlug } from '../core/areas';
import { areasForShape, detectShape, isShape, supportsAuth, type Shape } from '../core/shapes';
import { findAncestorManifest, scaffold } from '../core/scaffold';
import { askAuth, askSeed, askShape, isInteractive } from '../prompts';

export interface InitFlags {
  readonly shape?: string | undefined;
  readonly areas?: string | undefined;
  readonly auth?: boolean | undefined;
  readonly seed?: boolean | undefined;
  readonly root?: string | undefined;
  readonly yes?: boolean | undefined;
}

export interface InitResult {
  readonly code: 0 | 2;
  readonly out: string[];
  readonly err: string[];
}

export async function init(flags: InitFlags, version: string): Promise<InitResult> {
  const out: string[] = [];
  const err: string[] = [];
  const root = resolve(flags.root ?? '.');

  if (flags.shape !== undefined && !isShape(flags.shape)) {
    throw new UsageError(`unknown shape '${flags.shape}'. Known: api, web, both, docs-only`);
  }

  if (flags.auth !== undefined && flags.areas !== undefined) {
    throw new UsageError(
      '--auth/--no-auth cannot be combined with --areas — list `auth` or omit it',
    );
  }
  if (flags.auth !== undefined && flags.shape === 'docs-only') {
    throw new UsageError('--auth/--no-auth means nothing for --shape docs-only');
  }

  const explicit = flags.shape !== undefined || flags.areas !== undefined;
  const interactive = isInteractive() && !explicit && flags.yes !== true;

  if (!interactive && !explicit && flags.yes !== true) {
    throw new UsageError('no --shape or --areas given, and stdin is not a terminal to ask on');
  }

  let areas: AreaSlug[];
  let shape: Shape | null = null;
  let auth: boolean | null = null;
  if (flags.areas !== undefined) {
    areas = parseAreas(flags.areas);
    if (areas.length === 0) throw new UsageError('--areas was empty');
  } else {
    const detected = detectShape(root);
    shape = interactive
      ? await askShape(detected)
      : ((flags.shape as Shape | undefined) ?? detected);
    // Auth is included unless something says otherwise: the seeded stack docs
    // assume a session, and a scaffold that quietly dropped it would be the
    // surprising default.
    auth = supportsAuth(shape) ? (flags.auth ?? (interactive ? await askAuth() : true)) : null;
    areas = areasForShape(shape, auth !== false);
  }

  const seed = flags.seed ?? (interactive ? await askSeed() : false);

  const ancestor = findAncestorManifest(root);
  if (ancestor) {
    out.push(
      `  warning a project.yml already exists at ${ancestor} — the sync engine binds to the nearest one`,
    );
  }

  const rec = scaffold({ root, areas, seed, version });

  if (shape) out.push(`  shape   ${shape}`);
  if (auth !== null) out.push(`  auth    ${auth ? 'included' : 'not included'}`);
  out.push(`  areas   ${areas.join(', ')}`);
  out.push(`  docs    ${seed ? 'seeded with the defaults' : 'empty stubs'}`);

  const created = rec.changes.filter((c) => c.action === 'created');
  const appended = rec.changes.filter((c) => c.action === 'appended');
  const kept = rec.changes.filter((c) => c.action === 'kept');

  for (const change of created) out.push(`  created ${change.path}`);
  for (const change of appended) out.push(`  appended ${change.path}`);
  // Reported rather than silent: the never-overwrite rule means the user's own
  // copy won, and they should know which.
  for (const change of kept) out.push(`  kept    ${change.path} (yours)`);

  if (created.length === 0 && appended.length === 0) {
    out.push('  nothing to do — the project is already set up');
  } else {
    out.push('', '  Next: /msg-roadmap-plan-item to turn an idea into a roadmap item.');
  }

  return { code: 0, out, err };
}
