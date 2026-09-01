import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';

// The engine's config loader, not a second one: the roadmap and tasks folders
// come from `project.yml` via the same code the sync engine uses, so the two
// can never disagree about where the docs tree lives.
import { loadConfig } from '../../templates/scripts/roadmap-sync.mjs';
import { UsageError } from '../core/areas';
import { MANIFEST } from '../core/manifest';
import { askMigrateRoadmap, isInteractive } from '../prompts';

/*
 * TEMPORARY COMMAND — expected to be deleted.
 *
 * The seam: a roadmap item used to be a single file, `docs/roadmap/NN-slug.md`.
 * The roadmap-item-folder refactor made it a folder, `docs/roadmap/NN-slug/`,
 * whose `README.md` carries the document and whose other files (the OpenAPI
 * contract, wireframes, sequence diagrams, test script) are permanent artifacts
 * of the item. New items get the folder shape for free — `msg-roadmap-plan-item`
 * writes it. Repositories that installed the workflow before the refactor do
 * not: they have a pile of single files, and after the folder-aware engine
 * landed, `make roadmap-sync` refuses to read them and tells the user to run
 * this command.
 *
 * This command moves an existing repository across that seam once. It is
 * mechanical only: it creates folders and moves files, and never rewrites
 * content — the prose rewrites the new shape wants are judgement calls, so it
 * prints them as a to-do list instead. Once repositories have crossed, this file
 * and its tests should be removed.
 */

export interface MigrateRoadmapFlags {
  readonly root?: string | undefined;
  readonly dryRun?: boolean | undefined;
  readonly yes?: boolean | undefined;
}

export interface MigrateRoadmapResult {
  readonly code: 0 | 1 | 2;
  readonly out: string[];
  readonly err: string[];
}

/** Both ends of the folder rename, plus the label the report prints for it. */
interface FileMove {
  readonly from: string;
  readonly to: string;
}

interface ItemPlan {
  readonly slug: string;
  readonly action: 'migrate' | 'kept' | 'collision';
  readonly moves: FileMove[];
  readonly note?: string;
}

/** What the migration would do, and what a human still has to do by hand. */
export interface MigrationPlan {
  readonly roadmapRel: string;
  readonly tasksRel: string;
  readonly items: ItemPlan[];
  readonly leftover: {
    /** Items whose README still carries a `## Key Areas` section. */
    readonly keyAreas: string[];
    /** Items whose `## Context` is under the 3000-character floor. */
    readonly thinContext: { readonly slug: string; readonly chars: number }[];
    /** Items with no `openapi.json` in the folder once the moves are done. */
    readonly noContract: string[];
    /** Task files still carrying a `## Wireframes` / `## Sequence diagrams` section. */
    readonly taskArtifacts: string[];
  };
}

const CONTEXT_FLOOR = 3000;

/** Matches the glob `[0-9]*-*.md` — a single-file roadmap item. */
const isItemFile = (name: string) => /^[0-9].*-.*\.md$/.test(name);

/** Matches the glob `[0-9]*-*` — a roadmap item folder. */
const isItemFolder = (name: string) => /^[0-9]/.test(name) && name.indexOf('-', 1) !== -1;

/**
 * Read a file with newlines normalised, so a section heading written on a CRLF
 * checkout still matches. Missing file reads as empty.
 */
function readTextOrEmpty(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n?/g, '\n') : '';
}

/**
 * The body of a `## <name>` section: everything between that heading and the
 * next level-2 heading (or the end of the doc). Level-3 headings inside it, like
 * `### Back-end`, stay part of the section.
 */
function sectionBody(text: string, name: string): string | null {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^##\\s+${name}\\s*$`, 'i').test(line));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s+\S/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

/**
 * Decide, without writing anything, what every roadmap item needs: a folder
 * rename, a skip, or a hands-off failure — plus the list of prose fixes a human
 * still owns. The real run and `--dry-run` share this.
 */
export function planMigration(root: string): MigrationPlan {
  const cfg = loadConfig(root);
  const roadmap: string = cfg.roadmap;
  const tasks: string = cfg.tasks;
  const roadmapRel: string = cfg.rel(roadmap);
  const tasksRel: string = cfg.rel(tasks);

  const entries = existsSync(roadmap) ? readdirSync(roadmap, { withFileTypes: true }) : [];
  const files = new Set(entries.filter((e) => e.isFile() && isItemFile(e.name)).map((e) => e.name));
  const folders = new Set(
    entries.filter((e) => e.isDirectory() && isItemFolder(e.name)).map((e) => e.name),
  );

  const slugs = new Set<string>();
  for (const file of files) slugs.add(file.replace(/\.md$/, ''));
  for (const folder of folders) slugs.add(folder);

  const items: ItemPlan[] = [];
  const keyAreas: string[] = [];
  const thinContext: { slug: string; chars: number }[] = [];
  const noContract: string[] = [];
  const taskArtifacts: string[] = [];

  for (const slug of [...slugs].sort()) {
    const hasFile = files.has(`${slug}.md`);
    const hasFolder = folders.has(slug);
    const folderPath = join(roadmap, slug);

    // Both shapes at once: we do not know which is authoritative, so we touch
    // neither. The other items still migrate.
    if (hasFile && hasFolder) {
      items.push({
        slug,
        action: 'collision',
        moves: [],
        note: `both ${slug}.md and ${slug}/ exist — move one aside by hand, then run this again`,
      });
      continue;
    }

    const moves: FileMove[] = [];
    let readme: string;

    if (hasFile) {
      const from = join(roadmap, `${slug}.md`);
      const to = join(folderPath, 'README.md');
      moves.push({ from, to });
      readme = readTextOrEmpty(from);
    } else {
      readme = readTextOrEmpty(join(folderPath, 'README.md'));
    }

    // The contract and the test script are now permanent artifacts of the item,
    // not of the breakdown. If an open breakdown still holds them, move them.
    let contractLandsInFolder = existsSync(join(folderPath, 'openapi.json'));
    for (const artifact of ['openapi.json', 'test-script.md']) {
      const src = join(tasks, slug, artifact);
      const dest = join(folderPath, artifact);
      if (existsSync(src) && !existsSync(dest)) {
        moves.push({ from: src, to: dest });
        if (artifact === 'openapi.json') contractLandsInFolder = true;
      }
    }

    items.push({ slug, action: hasFile ? 'migrate' : 'kept', moves });

    // Leftover work — the prose the command will not rewrite for you.
    if (/^##\s+Key Areas\s*$/m.test(readme)) keyAreas.push(slug);

    const context = sectionBody(readme, 'Context');
    if (context !== null && context.length < CONTEXT_FLOOR) {
      thinContext.push({ slug, chars: context.length });
    }

    if (!contractLandsInFolder) noContract.push(slug);

    const taskDir = join(tasks, slug);
    if (existsSync(taskDir)) {
      for (const name of readdirSync(taskDir).sort()) {
        if (name === 'README.md' || !name.endsWith('.md')) continue;
        const body = readTextOrEmpty(join(taskDir, name));
        for (const heading of ['Wireframes', 'Sequence diagrams']) {
          if (new RegExp(`^##\\s+${heading}\\s*$`, 'm').test(body)) {
            taskArtifacts.push(`${tasksRel}/${slug}/${name} — ## ${heading}`);
          }
        }
      }
    }
  }

  return {
    roadmapRel,
    tasksRel,
    items,
    leftover: { keyAreas, thinContext, noContract, taskArtifacts },
  };
}

function rel(root: string, path: string): string {
  return path
    .slice(root.length + 1)
    .split('\\')
    .join('/');
}

function report(root: string, plan: MigrationPlan): string[] {
  const lines: string[] = [];

  for (const item of plan.items) {
    if (item.action === 'collision') {
      lines.push(`  FAILED  ${plan.roadmapRel}/${item.slug} — ${item.note}`);
      continue;
    }
    if (item.action === 'kept' && item.moves.length === 0) {
      lines.push(`  kept    ${plan.roadmapRel}/${item.slug}/ — already a folder`);
      continue;
    }
    const [first, ...more] = item.moves;
    if (first) lines.push(`  move    ${rel(root, first.from)} -> ${rel(root, first.to)}`);
    for (const m of more) lines.push(`          + ${rel(root, m.from)} -> ${rel(root, m.to)}`);
  }

  const l = plan.leftover;
  if (l.keyAreas.length || l.thinContext.length || l.noContract.length || l.taskArtifacts.length) {
    lines.push('', '  Still to do by hand — this command does not rewrite content:');
    for (const slug of l.keyAreas) {
      lines.push(`    ${slug}: rewrite the "## Key Areas" section into Technical Details prose`);
    }
    for (const { slug, chars } of l.thinContext) {
      lines.push(
        `    ${slug}: expand "## Context" — ${chars} characters, the floor is now ${CONTEXT_FLOOR}`,
      );
    }
    for (const entry of l.taskArtifacts) {
      lines.push(`    move ${entry} out of the task file into the roadmap item folder`);
    }
    for (const slug of l.noContract) {
      lines.push(`    ${slug}: no openapi.json — add one if this item has an API contract`);
    }
  }

  return lines;
}

/**
 * Convert an existing repo's single-file roadmap items into the folder shape.
 * Filesystem only — no git, no GitButler. Nothing is ever deleted or
 * overwritten: the command creates folders and moves files, and reports
 * anything it will not touch.
 */
export async function migrateRoadmap(flags: MigrateRoadmapFlags): Promise<MigrateRoadmapResult> {
  const out: string[] = [];
  const err: string[] = [];
  const root = resolve(flags.root ?? '.');

  if (!existsSync(join(root, MANIFEST))) {
    err.push(`error: no ${MANIFEST} — run \`msg init\` first`);
    return { code: 1, out, err };
  }

  const plan = planMigration(root);

  if (!existsSync(join(root, plan.roadmapRel))) {
    err.push(`error: no ${plan.roadmapRel}/ — nothing to migrate`);
    return { code: 1, out, err };
  }

  out.push(...report(root, plan));

  const hasMoves = plan.items.some((item) => item.moves.length > 0);
  const hasCollision = plan.items.some((item) => item.action === 'collision');

  if (!hasMoves) {
    out.push(
      '',
      hasCollision
        ? '  nothing moved — resolve the collisions above and run this again'
        : '  nothing to migrate — every roadmap item is already a folder',
    );
    out.push('', temporaryNotice());
    return { code: hasCollision ? 1 : 0, out, err };
  }

  if (flags.dryRun) {
    out.push('', '  dry run — nothing was moved');
    out.push('', temporaryNotice());
    return { code: hasCollision ? 1 : 0, out, err };
  }

  if (flags.yes !== true) {
    if (!isInteractive()) {
      throw new UsageError('migrate-roadmap moves files — pass -y, or run it on a terminal');
    }
    // The plan has to be on screen before the question is asked — `emit` only
    // prints what a command returns, and that is after the prompt is answered.
    for (const line of out.splice(0)) process.stdout.write(`${line}\n`);
    if (!(await askMigrateRoadmap())) {
      out.push('  nothing was moved');
      return { code: 2, out, err };
    }
  }

  apply(root, plan);

  out.push(
    '',
    '  Done. This command only moved files — it did not commit anything.',
    '  Review the result with your version-control tool and commit it yourself.',
    '',
    temporaryNotice(),
  );
  return { code: hasCollision ? 1 : 0, out, err };
}

function apply(root: string, plan: MigrationPlan): void {
  for (const item of plan.items) {
    for (const move of item.moves) {
      // Re-check at write time: a file that appeared since the plan was built
      // keeps whatever is already there — this command never overwrites.
      if (!existsSync(move.from) || existsSync(move.to)) continue;
      mkdirSync(join(root, plan.roadmapRel, item.slug), { recursive: true });
      renameSync(move.from, move.to);
    }
  }
}

function temporaryNotice(): string {
  return (
    '  `msg migrate-roadmap` is temporary. It exists only to move existing\n' +
    '  repositories to the folder shape, and will be removed once they have.'
  );
}
