import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The engine's parser, not a second one: the CLI and the vendored engine must
// never disagree about what a manifest says.
import { parseSimpleYaml } from '../../templates/scripts/roadmap-sync.mjs';
import { MANIFEST, readRecordedVersion } from '../core/manifest';
import { readVersion } from '../version';

export interface CheckResult {
  readonly code: 0 | 1;
  readonly out: string[];
  readonly err: string[];
}

/** Every path named in project.yml must exist. That is the drift that happens. */
export function check(root: string): CheckResult {
  const out: string[] = [];
  const err: string[] = [];
  const manifest = join(root, MANIFEST);

  if (!existsSync(manifest)) {
    err.push(`error: no ${MANIFEST} — run \`msg init\``);
    return { code: 1, out, err };
  }

  const text = readFileSync(manifest, 'utf8');
  const raw = parseSimpleYaml(text.replace(/\r\n?/g, '\n')) as Map<string, unknown>;

  // Printed before anything else because `uninstall` refuses on a version
  // mismatch, and this is how a user finds the version to run without opening
  // the manifest.
  const { recorded } = readRecordedVersion(text, readVersion());
  out.push(`  msg_version -> ${recorded ?? 'not recorded'}`);

  const missing: string[] = [];
  for (const block of ['structure', 'areas']) {
    const entries = raw.get(block);
    if (!(entries instanceof Map)) continue;
    for (const [key, value] of entries as Map<string, string>) {
      const ok = existsSync(join(root, value));
      out.push(`  ${block}.${key} -> ${value}  ${ok ? 'ok' : 'MISSING'}`);
      if (!ok) missing.push(`${block}.${key} -> ${value}`);
    }
  }

  const requirementsFile = raw.get('requirementsFile');
  if (typeof requirementsFile === 'string' && requirementsFile.trim() !== '') {
    const ok = existsSync(join(root, requirementsFile));
    out.push(`  requirementsFile -> ${requirementsFile}  ${ok ? 'ok' : 'MISSING'}`);
    if (!ok) missing.push(`requirementsFile -> ${requirementsFile}`);
  }

  if (missing.length) {
    err.push(`\n${missing.length} path(s) in ${MANIFEST} point at nothing.`);
    return { code: 1, out, err };
  }

  out.push(`  ${MANIFEST} is consistent`);
  return { code: 0, out, err };
}
