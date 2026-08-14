import { cancel, confirm, isCancel, multiselect, select } from '@clack/prompts';

import { PORTABLE_SKILLS, type PortableSkill } from './core/templates';
import type { Shape } from './core/shapes';

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Ctrl-C returns a sentinel that must be handled. Bailing out here is what makes
 * a cancelled `init` write nothing at all rather than half a tree.
 */
class Cancelled extends Error {}

function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Nothing was written.');
    throw new Cancelled();
  }
  return value;
}

export function isCancellation(error: unknown): boolean {
  return error instanceof Cancelled;
}

export async function askShape(detected: Shape): Promise<Shape> {
  return unwrap(
    await select({
      message: 'What shape is this project?',
      initialValue: detected,
      options: [
        { value: 'api' as const, label: 'API', hint: 'back-end, API stack, naming' },
        { value: 'web' as const, label: 'Web', hint: 'front-end, web stack, design, naming' },
        { value: 'both' as const, label: 'Both', hint: 'every area' },
        { value: 'docs-only' as const, label: 'Docs only', hint: 'design, naming' },
        {
          value: 'skills-only' as const,
          label: 'Skills only',
          hint: 'cherry-pick portable skills, no roadmap scaffold',
        },
      ],
    }),
  );
}

/**
 * Only asked down the `skills-only` branch, where there is no roadmap
 * scaffold to imply a skill list from — the user has to name what they want.
 */
export async function askSkills(): Promise<PortableSkill[]> {
  return unwrap(
    await multiselect({
      message: 'Which skills do you want?',
      options: PORTABLE_SKILLS.map((skill) => ({ value: skill, label: skill })),
      required: true,
    }),
  );
}

/**
 * Asked only for a shape that could have a session — see `supportsAuth`. Yes is
 * the default because the seeded stack assumes it; saying no drops the area
 * entirely rather than seeding an "auth: none" doc nobody would maintain.
 */
export async function askAuth(): Promise<boolean> {
  return unwrap(
    await confirm({
      message: 'Does this project need auth?',
      active: 'Yes — sessions, guards, sign-in',
      inactive: 'No — nothing to sign in to',
      initialValue: true,
    }),
  );
}

/**
 * Deletion is irreversible and the plan above it is long, so the default is no:
 * a stray Enter must never remove a workspace.
 */
export async function askUninstall(): Promise<boolean> {
  return unwrap(
    await confirm({
      message: 'Remove everything listed above?',
      active: 'Remove it',
      inactive: 'Leave it alone',
      initialValue: false,
    }),
  );
}

export async function askSeed(): Promise<boolean> {
  return unwrap(
    await confirm({
      message: 'Seed the rule docs with the opinionated defaults?',
      active: 'Seed them',
      inactive: 'Leave them empty',
      initialValue: false,
    }),
  );
}
