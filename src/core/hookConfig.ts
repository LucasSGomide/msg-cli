/** A command hook owned by msg inside a harness-owned JSON configuration. */
export interface HookDefinition {
  readonly event: string;
  readonly matcher: string;
  readonly command: string;
}

interface HookCommand {
  readonly type: string;
  readonly command?: string;
  readonly [key: string]: unknown;
}

interface MatcherGroup {
  readonly matcher?: string;
  hooks: HookCommand[];
  readonly [key: string]: unknown;
}

interface HookConfig {
  hooks?: Record<string, MatcherGroup[]>;
  [key: string]: unknown;
}

function parseObject(text: string): HookConfig | null {
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;

    const config = value as HookConfig;
    if (config.hooks === undefined) return config;
    if (config.hooks === null || typeof config.hooks !== 'object' || Array.isArray(config.hooks)) {
      return null;
    }

    for (const groups of Object.values(config.hooks)) {
      if (!Array.isArray(groups)) return null;
      for (const group of groups) {
        if (group === null || typeof group !== 'object' || !Array.isArray(group.hooks)) return null;
        if (group.matcher !== undefined && typeof group.matcher !== 'string') return null;
        if (group.hooks.some((hook) => hook === null || typeof hook !== 'object')) return null;
      }
    }
    return config;
  } catch {
    return null;
  }
}

function serialize(value: HookConfig): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export interface MergeResult {
  readonly text: string;
  readonly changed: boolean;
  /** The existing file was not a supported JSON object and stayed byte-identical. */
  readonly skipped: boolean;
}

/** Merge only the supplied handlers, retaining unrelated keys, groups, and handlers. */
export function mergeHookConfiguration(
  existing: string | null,
  definitions: readonly HookDefinition[],
): MergeResult {
  const config = existing === null ? {} : parseObject(existing);
  if (config === null) return { text: existing ?? '', changed: false, skipped: true };

  let changed = false;
  for (const { event, matcher, command } of definitions) {
    config.hooks ??= {};
    config.hooks[event] ??= [];
    // Do not claim an empty user-owned group: if msg appended its only handler
    // there, uninstall could not distinguish that original empty group from a
    // group msg created. A sibling matcher group preserves ownership exactly.
    const group = config.hooks[event].find(
      (candidate) => candidate.matcher === matcher && candidate.hooks.length > 0,
    );
    if (group) {
      if (!group.hooks.some((hook) => hook.type === 'command' && hook.command === command)) {
        group.hooks.push({ type: 'command', command });
        changed = true;
      }
    } else {
      config.hooks[event].push({ matcher, hooks: [{ type: 'command', command }] });
      changed = true;
    }
  }

  return { text: serialize(config), changed, skipped: false };
}

export interface StripResult {
  readonly outcome: 'remove' | 'strip' | 'absent' | 'kept-modified';
  readonly content: string;
}

/** Strip only the supplied handlers; malformed user configuration is retained verbatim. */
export function stripHookConfiguration(
  existing: string,
  definitions: readonly HookDefinition[],
): StripResult {
  const config = parseObject(existing);
  if (config === null) return { outcome: 'kept-modified', content: existing };
  if (!config.hooks) return { outcome: 'absent', content: existing };

  let found = false;
  for (const { event, matcher, command } of definitions) {
    const groups = config.hooks[event];
    if (!groups) continue;

    const emptiedByUs = new Set<MatcherGroup>();

    for (const group of groups) {
      if (group.matcher !== matcher) continue;
      const before = group.hooks.length;
      group.hooks = group.hooks.filter(
        (hook) => !(hook.type === 'command' && hook.command === command),
      );
      if (group.hooks.length !== before) {
        found = true;
        if (group.hooks.length === 0) emptiedByUs.add(group);
      }
    }

    config.hooks[event] = groups.filter((group) => !emptiedByUs.has(group));
    if (config.hooks[event].length === 0) delete config.hooks[event];
  }

  if (!found) return { outcome: 'absent', content: existing };
  if (Object.keys(config.hooks).length === 0) delete config.hooks;
  if (Object.keys(config).length === 0) return { outcome: 'remove', content: '' };
  return { outcome: 'strip', content: serialize(config) };
}
