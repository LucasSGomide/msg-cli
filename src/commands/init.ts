import { resolve } from 'node:path';

import { UsageError, parseAreas, type AreaSlug } from '../core/areas';
import {
  areasForShape,
  detectShape,
  isShape,
  SKILLS_ONLY_SHAPE,
  supportsAuth,
  type Shape,
} from '../core/shapes';
import { findAncestorManifest, healManifest, scaffold, scaffoldSkills } from '../core/scaffold';
import { parsePortableSkills, type PortableSkill } from '../core/templates';
import { askAuth, askSeed, askShape, askSkills, isInteractive } from '../prompts';

export interface InitFlags {
  readonly shape?: string | undefined;
  readonly areas?: string | undefined;
  readonly auth?: boolean | undefined;
  readonly seed?: boolean | undefined;
  readonly root?: string | undefined;
  readonly yes?: boolean | undefined;
  readonly skills?: string | undefined;
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
    throw new UsageError(
      `unknown shape '${flags.shape}'. Known: api, web, both, docs-only, skills-only`,
    );
  }

  if (flags.skills !== undefined && flags.areas !== undefined) {
    throw new UsageError('--skills cannot be combined with --areas');
  }
  if (flags.skills !== undefined && flags.shape !== undefined && flags.shape !== 'skills-only') {
    throw new UsageError('--skills only applies to --shape skills-only');
  }
  if (flags.auth !== undefined && flags.shape === 'skills-only') {
    throw new UsageError('--auth/--no-auth means nothing for --shape skills-only');
  }
  if (flags.seed !== undefined && flags.shape === 'skills-only') {
    throw new UsageError('--seed/--no-seed means nothing for --shape skills-only');
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

    if (shape === SKILLS_ONLY_SHAPE) {
      return initSkillsOnly({ flags, interactive, out, root });
    }

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

  // Before the scaffold, so everything downstream — and the user's next command
  // — reads a manifest that carries every key the skills expect.
  const healed = healManifest(root);
  const rec = scaffold({ root, areas, seed, version });

  // A manifest that was healed was appended to, not kept: the scaffold reports
  // the same path as `kept` because it never overwrites, and reporting both
  // verbs for one path would contradict itself.
  const healedPaths = new Set(healed.changes.map((change) => change.path));
  const changes = [
    ...healed.changes,
    ...rec.changes.filter((change) => !healedPaths.has(change.path)),
  ];

  if (shape) out.push(`  shape   ${shape}`);
  if (auth !== null) out.push(`  auth    ${auth ? 'included' : 'not included'}`);
  out.push(`  areas   ${areas.join(', ')}`);
  out.push(`  docs    ${seed ? 'seeded with the defaults' : 'empty stubs'}`);

  const created = changes.filter((c) => c.action === 'created');
  const appended = changes.filter((c) => c.action === 'appended');
  const updated = changes.filter((c) => c.action === 'updated');
  const kept = changes.filter((c) => c.action === 'kept');

  for (const change of created) out.push(`  created ${change.path}`);
  for (const change of appended) out.push(`  appended ${change.path}`);
  // Named individually because this is the one place `init` overwrites: a skill
  // that had drifted is replaced, and a silent rewrite is the wrong shape for
  // that.
  for (const change of updated) out.push(`  updated ${change.path} (ours)`);
  // Reported rather than silent: the never-overwrite rule means the user's own
  // copy won, and they should know which.
  for (const change of kept) out.push(`  kept    ${change.path} (yours)`);

  if (created.length === 0 && appended.length === 0 && updated.length === 0) {
    out.push('  nothing to do — the project is already set up');
  } else {
    out.push('', '  Next: /msg-roadmap-plan-item to turn an idea into a roadmap item.');
  }

  return { code: 0, out, err };
}

interface SkillsOnlyOptions {
  readonly flags: InitFlags;
  readonly interactive: boolean;
  readonly out: string[];
  readonly root: string;
}

/**
 * Picking the "skills only" shape bypasses areas, auth, seed, project.yml,
 * the docs/ folders, and the CLAUDE.md block entirely — it writes just the
 * picked skills' SKILL.md files, for a project that wants a portable skill
 * without the roadmap scaffold.
 */
async function initSkillsOnly(options: SkillsOnlyOptions): Promise<InitResult> {
  const { flags, interactive, out, root } = options;

  let skills: PortableSkill[];
  if (flags.skills !== undefined) {
    skills = parsePortableSkills(flags.skills);
    if (skills.length === 0) throw new UsageError('--skills was empty');
  } else if (interactive) {
    skills = await askSkills();
  } else {
    throw new UsageError('--shape skills-only needs --skills, or a terminal to ask on');
  }

  const rec = scaffoldSkills(root, skills);

  out.push('  shape   skills-only');
  out.push(`  skills  ${skills.join(', ')}`);

  const created = rec.changes.filter((c) => c.action === 'created');
  const updated = rec.changes.filter((c) => c.action === 'updated');

  for (const change of created) out.push(`  created ${change.path}`);
  for (const change of updated) out.push(`  updated ${change.path} (ours)`);

  if (created.length === 0 && updated.length === 0) {
    out.push('  nothing to do — the project is already set up');
  }

  return { code: 0, out, err: [] };
}
