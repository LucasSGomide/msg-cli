import { cancel, confirm, isCancel, select } from '@clack/prompts';

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
      ],
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
