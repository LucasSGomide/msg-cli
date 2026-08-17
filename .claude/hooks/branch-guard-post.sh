#!/usr/bin/env bash
# PostToolUse: once this session runs a branch-creating command — GitButler
# (`but branch new` / `but commit -b`) or plain git (`git checkout -b` /
# `git switch -c`) — mark the branch-guard flag so branch-guard-pre.sh stops
# blocking planning edits. Neither tool is mandatory; either satisfies the gate.
set -euo pipefail

input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')
session=$(echo "$input" | jq -r '.session_id // empty')

[[ -z "$session" ]] && exit 0

if [[ "$cmd" =~ but[[:space:]]+(branch[[:space:]]+new|commit[[:space:]]+-b) ]] \
  || [[ "$cmd" =~ git[[:space:]]+(checkout[[:space:]]+-b|switch[[:space:]]+-c) ]]; then
  mkdir -p /tmp/claude-branch-guard
  touch "/tmp/claude-branch-guard/${session}.created"
fi

exit 0
