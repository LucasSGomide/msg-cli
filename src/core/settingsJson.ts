/**
 * `.claude/settings.json` is a file every project may already own for reasons
 * that have nothing to do with msg-cli, so this is a structural merge, never a
 * byte-for-byte template like the rest of the scaffold: a matcher group or
 * hook the project already has is never touched, only the branch-guard entries
 * are added or removed.
 */

interface HookCommand {
  readonly type: 'command';
  readonly command: string;
}

interface MatcherGroup {
  matcher: string;
  hooks: HookCommand[];
}

interface SettingsShape {
  hooks?: Record<string, MatcherGroup[]>;
  [key: string]: unknown;
}

/**
 * Every hook entry msg-cli installs. The merge and strip below iterate this
 * list, so adding a row here is all it takes to ship another hook: a new
 * `(event, matcher)` pair becomes its own matcher group, and a row sharing an
 * existing pair joins that group's `hooks` array.
 *
 *  - branch-guard-pre  — block code edits until the session has a branch
 *  - branch-guard-post — set the "branch exists" flag branch-guard-pre reads
 *  - acceptance-criteria-gate — block a land/merge while task acceptance
 *    criteria are still unticked
 *  - retire-breakdown-post — after a land/merge, stamp `Landed:` / `Merged:` on
 *    the roadmap item so the next sync retires its breakdown
 */
const BRANCH_GUARD: ReadonlyArray<{
  readonly event: string;
  readonly matcher: string;
  readonly command: string;
}> = [
  {
    event: 'PreToolUse',
    matcher: 'Write|Edit|MultiEdit',
    command: '"$CLAUDE_PROJECT_DIR/.claude/hooks/branch-guard-pre.sh"',
  },
  {
    event: 'PostToolUse',
    matcher: 'Bash',
    command: '"$CLAUDE_PROJECT_DIR/.claude/hooks/branch-guard-post.sh"',
  },
  {
    event: 'PostToolUse',
    matcher: 'Bash',
    command: '"$CLAUDE_PROJECT_DIR/.claude/hooks/retire-breakdown-post.sh"',
  },
  {
    event: 'PreToolUse',
    matcher: 'Bash',
    command: '"$CLAUDE_PROJECT_DIR/.claude/hooks/acceptance-criteria-gate.sh"',
  },
];

/** `null` for text that doesn't parse as a JSON object — never guessed at. */
function parseObject(text: string): SettingsShape | null {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as SettingsShape)
      : null;
  } catch {
    return null;
  }
}

function serialize(value: SettingsShape): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export interface MergeResult {
  readonly text: string;
  readonly changed: boolean;
  /** The existing file wasn't a JSON object — left byte-for-byte untouched. */
  readonly skipped: boolean;
}

/**
 * Add the branch-guard entries, creating `.claude/settings.json` when
 * `existing` is `null`. A matcher group the project already has for the same
 * matcher gains our command; a group for a different matcher, or any other
 * top-level key, is left exactly as it was. Idempotent: running this again
 * once the entries are present reports `changed: false`.
 */
export function mergeBranchGuardHooks(existing: string | null): MergeResult {
  const settings = existing === null ? {} : parseObject(existing);
  if (settings === null) return { text: existing ?? '', changed: false, skipped: true };

  let changed = false;
  for (const { event, matcher, command } of BRANCH_GUARD) {
    settings.hooks ??= {};
    settings.hooks[event] ??= [];
    const group = settings.hooks[event].find((g) => g.matcher === matcher);
    if (group) {
      if (!group.hooks.some((h) => h.command === command)) {
        group.hooks.push({ type: 'command', command });
        changed = true;
      }
    } else {
      settings.hooks[event].push({ matcher, hooks: [{ type: 'command', command }] });
      changed = true;
    }
  }

  return { text: serialize(settings), changed, skipped: false };
}

export interface StripResult {
  readonly outcome: 'remove' | 'strip' | 'absent';
  readonly content: string;
}

/**
 * Pull exactly the branch-guard entries back out, leaving every other key,
 * matcher group and hook the file holds untouched. `absent` means neither
 * entry is present — nothing of ours to remove, the same outcome whether the
 * file itself exists with unrelated content or doesn't exist at all.
 */
export function stripBranchGuardHooks(existing: string): StripResult {
  const settings = parseObject(existing);
  if (settings === null || !settings.hooks) return { outcome: 'absent', content: existing };

  let found = false;
  for (const { event, matcher, command } of BRANCH_GUARD) {
    const groups = settings.hooks[event];
    if (!groups) continue;

    const group = groups.find((g) => g.matcher === matcher);
    if (!group) continue;

    const before = group.hooks.length;
    group.hooks = group.hooks.filter((h) => h.command !== command);
    if (group.hooks.length !== before) found = true;

    settings.hooks[event] = group.hooks.length === 0 ? groups.filter((g) => g !== group) : groups;
    if (settings.hooks[event]!.length === 0) delete settings.hooks[event];
  }

  if (!found) return { outcome: 'absent', content: existing };

  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  if (Object.keys(settings).length === 0) return { outcome: 'remove', content: '' };
  return { outcome: 'strip', content: serialize(settings) };
}
