import { existsSync, readFileSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { UsageError } from '../core/areas';
import { GITIGNORE_PATH } from '../core/gitignore';
import { HARNESSES, parseHarnesses, type Harness } from '../core/harness';
import { MANIFEST, readRecordedHarnesses } from '../core/manifest';
import { buildPlan, detectSkillsOnlyHarnesses, type Plan, type PlanEntry } from '../core/plan';
import {
  askGitignoreUninstall,
  askUninstall,
  askUninstallHarnesses,
  isInteractive,
} from '../prompts';

export interface UninstallFlags {
  readonly root?: string | undefined;
  readonly dryRun?: boolean | undefined;
  readonly yes?: boolean | undefined;
  readonly harness?: string | undefined;
}

export interface UninstallResult {
  readonly code: 0 | 1 | 2;
  readonly out: string[];
  readonly err: string[];
}

function actionable(entry: PlanEntry): boolean {
  return entry.outcome === 'remove' || entry.outcome === 'strip';
}

/**
 * The inverse of `init`. Deletion is irreversible, so the whole plan is printed
 * before anything happens and confirmed once — and a file the user changed is
 * never removed, only named.
 *
 * `.gitignore` is confirmed separately from everything else: it is the one
 * entry a user might reasonably keep even while removing the rest of the
 * scaffold, or vice versa.
 */
export async function uninstall(flags: UninstallFlags, version: string): Promise<UninstallResult> {
  const out: string[] = [];
  const err: string[] = [];
  const root = resolve(flags.root ?? '.');

  if (flags.harness !== undefined && parseHarnesses(flags.harness) === null) {
    throw new UsageError(`unknown harness '${flags.harness}'. Known: ${HARNESSES.join(', ')}`);
  }
  let requestedHarnesses = flags.harness === undefined ? undefined : parseHarnesses(flags.harness)!;
  const manifestPath = join(root, MANIFEST);
  if (existsSync(manifestPath)) {
    let recorded: Harness[];
    try {
      recorded = readRecordedHarnesses(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      err.push(`error: ${(error as Error).message}`);
      return { code: 1, out, err };
    }
    if (
      requestedHarnesses !== undefined &&
      requestedHarnesses.some((harness) => !recorded.includes(harness))
    ) {
      throw new UsageError(
        `--harness ${requestedHarnesses.join(',')} conflicts with ${MANIFEST}, which records ${recorded.join(', ')}. Omit the flag or select only installed harnesses`,
      );
    }
    if (
      requestedHarnesses === undefined &&
      recorded.length > 1 &&
      isInteractive() &&
      flags.yes !== true
    ) {
      requestedHarnesses = await askUninstallHarnesses(recorded);
    }
  } else if (requestedHarnesses === undefined) {
    const detected = detectSkillsOnlyHarnesses(root);
    if (detected.length > 1 && isInteractive() && flags.yes !== true) {
      requestedHarnesses = await askUninstallHarnesses(detected);
    }
  }

  if (requestedHarnesses !== undefined && requestedHarnesses.length === 0) {
    return { code: 2, out: ['  nothing was selected'], err };
  }
  const result = buildPlan(root, version, requestedHarnesses);
  if (!result.ok) {
    err.push(result.error);
    return { code: 1, out, err };
  }

  const { plan } = result;
  out.push(...report(plan));

  const gitignoreEntry = plan.entries.find((e) => e.path === GITIGNORE_PATH);
  const mainDue = plan.entries.some((e) => e.path !== GITIGNORE_PATH && actionable(e));
  const gitignoreDue = gitignoreEntry !== undefined && actionable(gitignoreEntry);

  if (!mainDue && !gitignoreDue) {
    out.push('  nothing to remove — no scaffolded file is still ours');
    return { code: 0, out, err };
  }

  if (flags.dryRun) {
    out.push('', '  dry run — nothing was removed');
    return { code: 0, out, err };
  }

  let removeMain = mainDue;
  let removeGitignore = gitignoreDue;

  if (flags.yes !== true) {
    if (!isInteractive()) {
      throw new UsageError('uninstall deletes files — pass -y, or run it on a terminal');
    }
    // The plan has to be on screen before the question is asked. `emit` only
    // prints what a command returns, and that is after the prompt has already
    // been answered — which would put "Remove everything listed above?" above
    // an empty screen.
    flush(out);
    removeMain = mainDue && (await askUninstall());
    // Asked after the main question, and independently of its answer — the
    // block can go while the rest stays, or stay while the rest goes.
    removeGitignore = gitignoreDue && (await askGitignoreUninstall());
  }

  if (!removeMain && !removeGitignore) {
    out.push('  nothing was removed');
    return { code: 2, out, err };
  }

  const lines: string[] = [];
  if (removeMain) {
    applyMain(root, plan);
    lines.push(`  removed the msg scaffold from ${root}`);
  }
  if (removeGitignore && gitignoreEntry) {
    applyGitignore(root, gitignoreEntry);
    lines.push(`  removed the msg block from ${GITIGNORE_PATH}`);
  }
  out.push('', ...lines);
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

/** Every entry but `.gitignore`, which is applied on its own answer instead. */
function applyMain(root: string, plan: Plan): void {
  for (const entry of plan.entries) {
    if (entry.path === GITIGNORE_PATH) continue;
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

function applyGitignore(root: string, entry: PlanEntry): void {
  const path = join(root, entry.path);
  if (entry.outcome === 'remove') rmSync(path, { force: true });
  if (entry.outcome === 'strip') writeFileSync(path, entry.content ?? '', 'utf8');
}
