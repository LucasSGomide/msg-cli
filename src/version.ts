import { readFileSync } from 'node:fs';

/**
 * Read from package.json at runtime rather than inlining a literal, so the
 * version in `--version` and the one written into `project.yml` can never drift
 * from the published one.
 */
export function readVersion(): string {
  const url = new URL('../package.json', import.meta.url);
  const pkg: unknown = JSON.parse(readFileSync(url, 'utf8'));
  if (typeof pkg === 'object' && pkg !== null && 'version' in pkg) {
    const { version } = pkg as { version: unknown };
    if (typeof version === 'string') return version;
  }
  throw new Error('package.json has no version string');
}
