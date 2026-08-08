import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { addArea } from './commands/add-area';
import { check } from './commands/check';
import { init } from './commands/init';
import { UsageError } from './core/areas';
import { isCancellation } from './prompts';
import { USAGE } from './usage';
import { readVersion } from './version';

/** 0 ok · 1 check failed · 2 usage error. */
export type ExitCode = 0 | 1 | 2;

const OPTIONS = {
  shape: { type: 'string' },
  areas: { type: 'string' },
  seed: { type: 'boolean' },
  'no-seed': { type: 'boolean' },
  root: { type: 'string' },
  yes: { type: 'boolean', short: 'y' },
} as const;

export async function run(argv: string[]): Promise<ExitCode> {
  const [command, ...rest] = argv;

  if (command === undefined || command === '-h' || command === '--help' || command === 'help') {
    process.stdout.write(USAGE);
    return 0;
  }
  if (command === '-v' || command === '--version' || command === 'version') {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }

  try {
    const { values, positionals } = parseArgs({
      args: rest,
      options: OPTIONS,
      allowPositionals: true,
    });

    // --seed and --no-seed are separate flags so "unset" stays distinguishable
    // from "explicitly false" — unset is what triggers the prompt.
    if (values.seed && values['no-seed']) {
      throw new UsageError('--seed and --no-seed contradict each other');
    }
    const seed = values.seed ? true : values['no-seed'] ? false : undefined;

    switch (command) {
      case 'init': {
        const result = await init(
          {
            shape: values.shape,
            areas: values.areas,
            seed,
            root: values.root,
            yes: values.yes,
          },
          readVersion(),
        );
        return emit(result);
      }
      case 'check':
        return emit(check(resolveRoot(values.root)));
      case 'add-area': {
        const slug = positionals[0];
        if (slug === undefined) throw new UsageError('add-area needs an area slug');
        return emit(addArea(slug, { seed: seed === true, root: values.root }));
      }
      default:
        process.stderr.write(`error: unknown command \`${command}\`\n\n${USAGE}`);
        return 2;
    }
  } catch (error) {
    if (isCancellation(error)) return 2;
    if (error instanceof UsageError) {
      process.stderr.write(`error: ${error.message}\n`);
      return 2;
    }
    // parseArgs throws for an unknown flag; that is a usage error too.
    if (
      error instanceof Error &&
      'code' in error &&
      String(error.code).startsWith('ERR_PARSE_ARGS')
    ) {
      process.stderr.write(`error: ${error.message}\n\n${USAGE}`);
      return 2;
    }
    throw error;
  }
}

function resolveRoot(root: string | undefined): string {
  return root ?? '.';
}

function emit(result: { code: number; out: string[]; err: string[] }): ExitCode {
  for (const line of result.out) process.stdout.write(`${line}\n`);
  for (const line of result.err) process.stderr.write(`${line}\n`);
  return result.code as ExitCode;
}

// Run only as a bin, never on import — otherwise a test that imports `run` also
// executes it against the test runner's own argv.
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = await run(process.argv.slice(2));
}
