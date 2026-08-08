import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative } from 'node:path';

/**
 * What a scaffolding run did, one entry per path it touched. `kept` is not a
 * failure — it is the never-overwrite rule working, and worth reporting so a
 * user who already had a file knows theirs won.
 */
export interface Change {
  readonly path: string;
  readonly action: 'created' | 'appended' | 'kept';
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

  copyIfAbsent(from: string, to: string): boolean {
    if (existsSync(to)) {
      this.record(to, 'kept');
      return false;
    }
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    this.record(to, 'created');
    return true;
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
