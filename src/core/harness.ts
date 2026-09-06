import { AREAS, type AreaSlug } from './areas';
import {
  mergeHookConfiguration,
  stripHookConfiguration,
  type HookDefinition,
  type MergeResult,
  type StripResult,
} from './hookConfig';
import {
  ACCEPTANCE_GATE_SRC,
  BRANCH_GUARD_POST_SRC,
  BRANCH_GUARD_PRE_SRC,
  RETIRE_BREAKDOWN_SRC,
  readProjectTemplate,
} from './templates';

export const HARNESSES = ['claude', 'codex'] as const;
export type Harness = (typeof HARNESSES)[number];

export function isHarness(value: string): value is Harness {
  return (HARNESSES as readonly string[]).includes(value);
}

/** Parse the comma-separated form accepted by --harness, retaining canonical order. */
export function parseHarnesses(value: string): Harness[] | null {
  const chosen = value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '');
  if (chosen.length === 0 || chosen.some((entry) => !isHarness(entry))) return null;
  return HARNESSES.filter((harness) => chosen.includes(harness));
}

export function sameHarnesses(left: readonly Harness[], right: readonly Harness[]): boolean {
  return left.length === right.length && left.every((harness) => right.includes(harness));
}

export interface HarnessHook {
  readonly filename: string;
  readonly source: string;
}

export interface HarnessAdapter {
  readonly name: Harness;
  readonly instructionsPath: string;
  readonly skillDirectory: string;
  readonly hookDirectory: string;
  readonly hookConfigPath: string;
  readonly hooks: readonly HarnessHook[];
  readonly hookDefinitions: readonly HookDefinition[];
  readonly pruneDirectories: readonly string[];
  readonly skillPruneDirectories: readonly string[];
  readonly gitignore: {
    readonly skills: readonly string[];
    readonly hooks: readonly string[];
  };
  skillReference(skill: string): string;
  renderText(text: string): string;
  renderInstructions(areas: readonly AreaSlug[]): string;
  mergeHookConfig(existing: string | null): MergeResult;
  stripHookConfig(existing: string): StripResult;
}

const HOOKS: readonly HarnessHook[] = [
  { filename: 'branch-guard-pre.sh', source: BRANCH_GUARD_PRE_SRC },
  { filename: 'branch-guard-post.sh', source: BRANCH_GUARD_POST_SRC },
  { filename: 'acceptance-criteria-gate.sh', source: ACCEPTANCE_GATE_SRC },
  { filename: 'retire-breakdown-post.sh', source: RETIRE_BREAKDOWN_SRC },
];

const CLAUDE_DEFINITIONS: readonly HookDefinition[] = [
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

const codexCommand = (filename: string): string =>
  `"$(git rev-parse --show-toplevel)/.codex/hooks/${filename}"`;

const CODEX_DEFINITIONS: readonly HookDefinition[] = [
  {
    event: 'PreToolUse',
    matcher: 'Edit|Write',
    command: codexCommand('branch-guard-pre.sh'),
  },
  {
    event: 'PostToolUse',
    matcher: 'Bash',
    command: codexCommand('branch-guard-post.sh'),
  },
  {
    event: 'PostToolUse',
    matcher: 'Bash',
    command: codexCommand('retire-breakdown-post.sh'),
  },
  {
    event: 'PreToolUse',
    matcher: 'Bash',
    command: codexCommand('acceptance-criteria-gate.sh'),
  },
];

function areasTable(areas: readonly AreaSlug[]): string {
  return areas.map((slug) => `- **${AREAS[slug].label}** — \`${AREAS[slug].doc}\``).join('\n');
}

function adapter(options: {
  readonly name: Harness;
  readonly instructionsPath: string;
  readonly skillDirectory: string;
  readonly hookDirectory: string;
  readonly hookConfigPath: string;
  readonly definitions: readonly HookDefinition[];
  readonly pruneDirectories: readonly string[];
  readonly skillPruneDirectories: readonly string[];
}): HarnessAdapter {
  const renderText = (text: string): string => {
    if (options.name === 'claude') return text;
    return text
      .replaceAll('root="${CLAUDE_PROJECT_DIR:-${cwd:-.}}"', 'root="${cwd:-.}"')
      .replaceAll('.claude/settings.json', '.codex/hooks.json')
      .replaceAll('.claude/hooks/', '.codex/hooks/')
      .replaceAll('.claude/skills/', '.agents/skills/')
      .replaceAll('CLAUDE.md', 'AGENTS.md')
      .replaceAll('AskUserQuestion', 'request_user_input')
      .replaceAll('/tmp/claude-branch-guard', '/tmp/codex-branch-guard')
      .replace(/(?<![A-Za-z0-9._-])\/(msg-[a-z0-9-]+)/g, (_match, skill: string) => `$${skill}`);
  };

  return {
    name: options.name,
    instructionsPath: options.instructionsPath,
    skillDirectory: options.skillDirectory,
    hookDirectory: options.hookDirectory,
    hookConfigPath: options.hookConfigPath,
    hooks: HOOKS,
    hookDefinitions: options.definitions,
    pruneDirectories: options.pruneDirectories,
    skillPruneDirectories: options.skillPruneDirectories,
    gitignore: {
      skills: [`${options.skillDirectory}/msg-*`],
      hooks: HOOKS.map((hook) => `${options.hookDirectory}/${hook.filename}`),
    },
    skillReference: (skill) => `${options.name === 'claude' ? '/' : '$'}${skill}`,
    renderText,
    renderInstructions: (areas) =>
      renderText(readProjectTemplate('claude-block.md').replace('{{areas}}', areasTable(areas))),
    mergeHookConfig: (existing) => mergeHookConfiguration(existing, options.definitions),
    stripHookConfig: (existing) => stripHookConfiguration(existing, options.definitions),
  };
}

export const HARNESS_REGISTRY: Readonly<Record<Harness, HarnessAdapter>> = {
  claude: adapter({
    name: 'claude',
    instructionsPath: 'CLAUDE.md',
    skillDirectory: '.claude/skills',
    hookDirectory: '.claude/hooks',
    hookConfigPath: '.claude/settings.json',
    definitions: CLAUDE_DEFINITIONS,
    pruneDirectories: ['.claude/skills', '.claude/hooks', '.claude'],
    skillPruneDirectories: ['.claude/skills', '.claude'],
  }),
  codex: adapter({
    name: 'codex',
    instructionsPath: 'AGENTS.md',
    skillDirectory: '.agents/skills',
    hookDirectory: '.codex/hooks',
    hookConfigPath: '.codex/hooks.json',
    definitions: CODEX_DEFINITIONS,
    pruneDirectories: ['.agents/skills', '.agents', '.codex/hooks', '.codex'],
    skillPruneDirectories: ['.agents/skills', '.agents'],
  }),
};

export function getHarness(name: Harness): HarnessAdapter {
  return HARNESS_REGISTRY[name];
}
