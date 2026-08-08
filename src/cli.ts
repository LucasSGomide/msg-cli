import { pathToFileURL } from 'node:url';

import { USAGE } from './usage';
import { readVersion } from './version';

/** 0 ok · 1 check failed · 2 usage error. */
export type ExitCode = 0 | 1 | 2;

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

  switch (command) {
    case 'init':
    case 'check':
    case 'add-area':
      // Wired up in phase 3.
      void rest;
      process.stderr.write(`error: \`msg ${command}\` is not implemented yet\n`);
      return 2;
    default:
      process.stderr.write(`error: unknown command \`${command}\`\n\n${USAGE}`);
      return 2;
  }
}

// Run only as a bin, never on import — otherwise a test that imports `run` also
// executes it against the test runner's own argv.
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = await run(process.argv.slice(2));
}
