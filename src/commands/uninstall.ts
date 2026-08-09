import { existsSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { UsageError } from '../core/areas';
import { MANIFEST } from '../core/manifest';
import { buildPlan, type Plan } from '../core/plan';
import { askUninstall, isInteractive } from '../prompts';

export interface UninstallFlags {
  readonly root?: string | undefined;
  readonly dryRun?: boolean | undefined;
  readonly yes?: boolean | undefined;
}

export interface UninstallResult {
  readonly code: 0 | 1 | 2;
  readonly out: string[];
  readonly err: string[];
}

/**
 * The inverse of `init`. Deletion is irreversible, so the whole plan is printed
 * before anything happens and confirmed once — and a file the user changed is
 * never removed, only named.
 */
export async function uninstall(flags: UninstallFlags, version: string): Promise<UninstallResult> {
  const out: string[] = [];
  const err: string[] = [];
  const root = resolve(flags.root ?? '.');

  if (!existsSync(join(root, MANIFEST))) {
    err.push(`error: no ${MANIFEST} — run \`msg init\``);
    return { code: 1, out, err };
  }

  const result = buildPlan(root, version);
  if (!result.ok) {
    err.push(result.error);
    return { code: 1, out, err };
  }

  const { plan } = result;
  out.push(...report(plan));

  if (!plan.entries.some((e) => e.outcome === 'remove' || e.outcome === 'strip')) {
    out.push('  nothing to remove — no scaffolded file is still ours');
    return { code: 0, out, err };
  }

  if (flags.dryRun) {
    out.push('', '  dry run — nothing was removed');
    return { code: 0, out, err };
  }

  if (flags.yes !== true) {
    if (!isInteractive()) {
      throw new UsageError('uninstall deletes files — pass -y, or run it on a terminal');
    }
    // The plan has to be on screen before the question is asked. `emit` only
    // prints what a command returns, and that is after the prompt has already
    // been answered — which would put "Remove everything listed above?" above
    // an empty screen.
    flush(out);
    if (!(await askUninstall())) {
      out.push('  nothing was removed');
      return { code: 2, out, err };
    }
  }

  apply(root, plan);
  out.push('', `  removed the msg scaffold from ${root}`);
  return { code: 0, out, err };
}

/** Print what has been collected so far, and empty it so `emit` cannot repeat it. */
function flush(lines: string[]): void {
  for (const line of lines.splice(0)) process.stdout.write(`${line}\n`);
}

/**
 * One line per path, in the two-column format `init` and `add-area` already
 * print. Absent paths are left out: they are the normal shape of a workspace
 * that was partly removed already, and listing them is noise.
 */
function report(plan: Plan): string[] {
  const lines: string[] = [];

  for (const entry of plan.entries) {
    switch (entry.outcome) {
      case 'remove':
        lines.push(`  remove  ${entry.path}${entry.note ? ` — ${entry.note}` : ''}`);
        break;
      case 'strip':
        lines.push(`  strip   ${entry.path} — our block only, the rest of the file stays`);
        break;
      case 'kept-modified':
        lines.push(`  kept    ${entry.path} — yours, remove by hand`);
        break;
      case 'absent':
        break;
    }
  }

  for (const folder of plan.folders) lines.push(`  remove  ${folder}/ — empty once its files go`);
  lines.push(...plan.warnings);

  return lines;
}

function apply(root: string, plan: Plan): void {
  for (const entry of plan.entries) {
    const path = join(root, entry.path);
    if (entry.outcome === 'remove') rmSync(path, { force: true });
    if (entry.outcome === 'strip') writeFileSync(path, entry.content ?? '', 'utf8');
  }

  // Already deepest-first, and each one is only removed if it really is empty —
  // a file that appeared since the plan was built keeps its folder.
  for (const folder of plan.folders) {
    try {
      rmdirSync(join(root, folder));
    } catch {
      // Not empty after all, or already gone. Either way the folder stays.
    }
  }
}
