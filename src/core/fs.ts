import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative } from 'node:path';

import { normalise } from './classify';
import { classifyGitignore, buildGitignoreBlock, type GitignoreGroup } from './gitignore';
import type { Harness } from './harness';
import type { MergeResult } from './hookConfig';

/**
 * What a scaffolding run did, one entry per path it touched. `kept` is not a
 * failure — it is the never-overwrite rule working, and worth reporting so a
 * user who already had a file knows theirs won.
 *
 * `updated` and `unchanged` are the msg-owned counterparts of `kept`: a path
 * msg owns has no "yours" to lose, so it either needed rewriting or already
 * matched.
 *
 * `removed` is `.gitignore`-only: unlike everything else, a re-run can shrink
 * a msg-owned entry away to nothing rather than only ever adding to it.
 */
export interface Change {
  readonly path: string;
  readonly action: 'created' | 'appended' | 'kept' | 'updated' | 'unchanged' | 'removed';
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

  /** Copy a rendered candidate while retaining its canonical source for parity checks. */
  copyContentIfAbsent(
    from: string,
    to: string,
    content: string,
    options?: { readonly executable?: boolean },
  ): boolean {
    if (content === readFileSync(from, 'utf8')) return this.copyIfAbsent(from, to, options);
    const written = this.writeIfAbsent(to, content);
    if (written && options?.executable) chmodSync(to, 0o755);
    return written;
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

  /** Write deterministic rendered content to a path owned by msg. */
  writeOwned(to: string, content: string, options?: { readonly executable?: boolean }): void {
    const existed = existsSync(to);
    if (existed && normalise(readFileSync(to, 'utf8')) === normalise(content)) {
      this.record(to, 'unchanged');
      return;
    }
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, content, 'utf8');
    if (options?.executable) chmodSync(to, 0o755);
    this.record(to, existed ? 'updated' : 'created');
  }

  /**
   * Merge the msg hook entries into the selected harness's configuration,
   * creating the file when absent. A structural merge, not a whole-file
   * write — see `mergeBranchGuardHooks` for what "changed" means here.
   */
  mergeHooks(path: string, merge: (existing: string | null) => MergeResult): void {
    const existed = existsSync(path);
    const { text, changed, skipped } = merge(existed ? readFileSync(path, 'utf8') : null);
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
   * the marker. Used for the Makefile and project-instructions file, both of
   * which a project is likely to own already — clobbering either would be hostile.
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

  /**
   * Rewrite `.gitignore`'s block to hold exactly `groups`, unlike
   * `createOrAppend`: a re-run doesn't skip once the marker exists, it
   * replaces the block so a group dropped from the picks loses its lines. An
   * edited block is left alone entirely, `groups` or not — see
   * `classifyGitignore`.
   */
  gitignore(
    path: string,
    groups: readonly GitignoreGroup[],
    allowed: readonly GitignoreGroup[],
    harnesses: Harness | readonly Harness[] = 'claude',
  ): void {
    const state = classifyGitignore(path, allowed, harnesses);

    if (state.outcome === 'kept-modified') {
      this.record(path, 'kept');
      return;
    }

    // `absent` covers both "no file" and "a file with no marker of ours" —
    // `state.content` is only meaningful for strip/remove, so read fresh.
    const withoutBlock = state.outcome === 'absent' ? readIfPresent(path) : state.content;

    if (groups.length === 0) {
      if (state.outcome === 'absent') return; // nothing of ours there, nothing to do
      if (withoutBlock.trim() === '') {
        rmSync(path, { force: true });
        this.record(path, 'removed');
      } else {
        writeFileSync(path, withoutBlock, 'utf8');
        this.record(path, 'updated');
      }
      return;
    }

    const block = buildGitignoreBlock(groups, harnesses);
    if (state.outcome === 'absent' && withoutBlock === '') {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, block.replace(/^\n+/, ''), 'utf8');
      this.record(path, 'created');
      return;
    }
    if (state.outcome === 'absent') {
      appendFileSync(path, block, 'utf8');
      this.record(path, 'appended');
      return;
    }

    const rewritten = withoutBlock.trim() === '' ? block.replace(/^\n+/, '') : withoutBlock + block;
    if (rewritten === readFileSync(path, 'utf8')) {
      this.record(path, 'unchanged');
      return;
    }
    writeFileSync(path, rewritten, 'utf8');
    this.record(path, 'updated');
  }
}

function readIfPresent(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}
