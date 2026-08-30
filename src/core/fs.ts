import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative } from 'node:path';

import { normalise } from './classify';
import { mergeBranchGuardHooks } from './settingsJson';

/**
 * What a scaffolding run did, one entry per path it touched. `kept` is not a
 * failure — it is the never-overwrite rule working, and worth reporting so a
 * user who already had a file knows theirs won.
 *
 * `updated` and `unchanged` are the msg-owned counterparts of `kept`: a path
 * msg owns has no "yours" to lose, so it either needed rewriting or already
 * matched.
 */
export interface Change {
  readonly path: string;
  readonly action: 'created' | 'appended' | 'kept' | 'updated' | 'unchanged';
}

export class Recorder {
  readonly changes: Change[] = [];

  constructor(private readonly root: string) {}

  private rel(path: string): string {
    return relative(this.root, path).split('\\').join('/');
  }

  record(path: string, action: Change['action']): void {
    this.changes.push({ path: this.rel(path), action });
  }

  /** Nothing is ever overwritten. Re-running fills only the gaps. */
  writeIfAbsent(path: string, content: string): boolean {
    if (existsSync(path)) {
      this.record(path, 'kept');
      return false;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
    this.record(path, 'created');
    return true;
  }

  copyIfAbsent(from: string, to: string, options?: { readonly executable?: boolean }): boolean {
    if (existsSync(to)) {
      this.record(to, 'kept');
      return false;
    }
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    // A hook script needs its own +x — copyFileSync carries content, not mode,
    // and neither git nor npm packaging reliably keeps the executable bit
    // through every checkout/install path.
    if (options?.executable) chmodSync(to, 0o755);
    this.record(to, 'created');
    return true;
  }

  /**
   * Copy a path msg owns, replacing whatever is there.
   *
   * The deliberate opposite of `copyIfAbsent`: for an owned path the template
   * is the source of truth, so a local edit is overwritten rather than
   * preserved. Reported as `unchanged` when the bytes already match, so a
   * re-run does not claim a write it did not make.
   *
   * Line endings are normalised before comparing, the same way `classifyFile`
   * does it — a CRLF checkout is not rewritten on every run.
   */
  copyOwned(from: string, to: string, options?: { readonly executable?: boolean }): void {
    const existed = existsSync(to);
    if (existed && normalise(readFileSync(to, 'utf8')) === normalise(readFileSync(from, 'utf8'))) {
      this.record(to, 'unchanged');
      return;
    }
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    if (options?.executable) chmodSync(to, 0o755);
    this.record(to, existed ? 'updated' : 'created');
  }

  /**
   * Merge the branch-guard hook entries into `.claude/settings.json`,
   * creating the file when absent. A structural merge, not a whole-file
   * write — see `mergeBranchGuardHooks` for what "changed" means here.
   */
  mergeHooks(path: string): void {
    const existed = existsSync(path);
    const { text, changed, skipped } = mergeBranchGuardHooks(
      existed ? readFileSync(path, 'utf8') : null,
    );
    if (skipped || !changed) {
      this.record(path, 'kept');
      return;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf8');
    this.record(path, existed ? 'appended' : 'created');
  }

  /**
   * Create the file, or append to it when it exists and does not already carry
   * the marker. Used for the Makefile and CLAUDE.md, both of which a project is
   * likely to own already — clobbering either would be hostile.
   */
  createOrAppend(path: string, block: string, marker: string): void {
    if (!existsSync(path)) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, block.replace(/^\n+/, ''), 'utf8');
      this.record(path, 'created');
      return;
    }
    if (readFileSync(path, 'utf8').includes(marker)) {
      this.record(path, 'kept');
      return;
    }
    appendFileSync(path, block, 'utf8');
    this.record(path, 'appended');
  }
}
