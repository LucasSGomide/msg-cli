#!/usr/bin/env bash
# PreToolUse guard: block Write/Edit/MultiEdit to code — application source,
# libraries, tests, and build/manifest/config files — until this session has
# created a dedicated branch (GitButler if set up in the repo, else plain git).
# Documentation and planning edits are never guarded. branch-guard-post.sh sets
# the per-session flag once a branch-creating command runs. See CLAUDE.md
# "Branch-first for implementation work".
set -euo pipefail

input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
session=$(echo "$input" | jq -r '.session_id // empty')

[[ -z "$file" ]] && exit 0

# What counts as code. Kept deliberately small and readable — a path segment
# under a source/test tree, or a build/manifest/config file by name.
guarded=0
base=$(basename -- "$file")
case "$file" in
  */src/*|*/lib/*|*/app/*|*/test/*|*/tests/*) guarded=1 ;;
esac
case "$base" in
  package.json|package-lock.json|pnpm-lock.yaml|yarn.lock|Makefile) guarded=1 ;;
  *.config.*) guarded=1 ;;
esac

[[ $guarded -eq 0 ]] && exit 0

flag="/tmp/claude-branch-guard/${session}.created"
if [[ -f "$flag" ]]; then
  exit 0
fi

echo "Create a dedicated branch before the first code edit of an implementation (CLAUDE.md \"Branch-first for implementation work\") — GitButler if set up in this repo (\`but branch new\` or \`but commit -b <branch> -m \"...\" <id>\`), else plain git (\`git checkout -b <branch>\`), then retry. Documentation and planning edits don't need a branch." >&2
exit 2
