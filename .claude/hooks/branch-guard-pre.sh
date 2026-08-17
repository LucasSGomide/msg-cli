#!/usr/bin/env bash
# PreToolUse guard: block edits to planning files (docs/prompts, docs/roadmap,
# docs/tasks) until this session has created a dedicated branch — GitButler if
# set up in the repo, else plain git. See CLAUDE.md "Branch-first for planning
# work".
set -euo pipefail

input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
session=$(echo "$input" | jq -r '.session_id // empty')

[[ -z "$file" ]] && exit 0

guarded=0
base=$(basename -- "$file")
case "$file" in
  */docs/prompts/*.md)
    guarded=1
    ;;
  */docs/roadmap/*.md)
    [[ "$base" != "README.md" ]] && guarded=1
    ;;
  */docs/tasks/*.md)
    [[ "$base" != "README.md" ]] && guarded=1
    ;;
esac

[[ $guarded -eq 0 ]] && exit 0

flag="/tmp/claude-branch-guard/${session}.created"
if [[ -f "$flag" ]]; then
  exit 0
fi

echo "Create a dedicated branch before editing planning files (CLAUDE.md \"Branch-first for planning work\") — GitButler if set up in this repo (\`but branch new\` or \`but commit -b <branch> -m \"...\" <id>\`), else plain git (\`git checkout -b <branch>\`), then retry." >&2
exit 2
