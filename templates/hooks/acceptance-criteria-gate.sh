#!/usr/bin/env bash
# PreToolUse gate: when a Bash command lands or merges an implementation into the
# target branch (`but land`, a `git merge`, or a `git push` aimed at main/master),
# refuse unless every open task folder is fully accepted. Acceptance is two
# halves, checked at the same ship moment:
#   1. Every task file under docs/tasks/*/ has its boxes ticked beneath the
#      "## Acceptance criteria" heading. The sync engine derives item status
#      from those, so a shipped item left with unticked boxes still reads as in
#      progress.
#   2. Every task folder that holds a numbered task file carries a
#      "test-script.md" runbook with no unticked box anywhere in it — the
#      hand-run proof the feature actually works end to end, appended to as each
#      slice lands. A missing file and an unticked step are both blockers.
# Routine checkpoint commits (`but commit`, `git commit`) are never blocked.
# Needs only bash and jq. See CLAUDE.md "Branch-first for implementation work".
set -euo pipefail

input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')

[[ -z "$cmd" ]] && exit 0

# Only the ship/merge moment. `but land` always ships; a `git merge` integrates
# work; a `git push` only counts when it names the conventional target branch.
ships=0
if [[ "$cmd" =~ but[[:space:]]+land ]] || [[ "$cmd" =~ git[[:space:]]+merge ]]; then
  ships=1
elif [[ "$cmd" =~ git[[:space:]]+push ]] && [[ "$cmd" =~ (main|master) ]]; then
  ships=1
fi

[[ $ships -eq 0 ]] && exit 0

root="${CLAUDE_PROJECT_DIR:-.}"
tasks="$root/docs/tasks"
[[ -d "$tasks" ]] || exit 0

criteria_offenders=()
while IFS= read -r -d '' file; do
  # Read the lines beneath "## Acceptance criteria" up to the next "## " heading;
  # an unticked "- [ ]" box in that span is a blocker.
  if awk '
      /^##[[:space:]]+[Aa]cceptance[[:space:]]+[Cc]riteria[[:space:]]*$/ { in_block = 1; next }
      /^##[[:space:]]/                                                  { in_block = 0 }
      in_block && /^[[:space:]]*-[[:space:]]+\[[[:space:]]\]/           { unticked = 1 }
      END { exit(unticked ? 0 : 1) }
    ' "$file"; then
    criteria_offenders+=("${file#"$root"/}")
  fi
done < <(find "$tasks" -mindepth 2 -type f -name '*.md' -print0)

# For every task folder holding at least one numbered task file (NN-slug.md, the
# shape the sync engine counts), test-script.md must exist and hold no unticked
# "- [ ]" box anywhere in it.
missing_scripts=()
script_offenders=()
while IFS= read -r -d '' folder; do
  has_task=0
  while IFS= read -r -d '' task; do
    [[ "$(basename "$task")" =~ ^[0-9].*\.md$ ]] && has_task=1
  done < <(find "$folder" -mindepth 1 -maxdepth 1 -type f -name '*.md' -print0)
  [[ $has_task -eq 0 ]] && continue

  script="$folder/test-script.md"
  if [[ ! -f "$script" ]]; then
    missing_scripts+=("${folder#"$root"/}/test-script.md")
  elif grep -qE '^[[:space:]]*-[[:space:]]+\[[[:space:]]\]' "$script"; then
    script_offenders+=("${script#"$root"/}")
  fi
done < <(find "$tasks" -mindepth 1 -maxdepth 1 -type d -print0)

if [[ ${#criteria_offenders[@]} -gt 0 || ${#missing_scripts[@]} -gt 0 || ${#script_offenders[@]} -gt 0 ]]; then
  {
    echo "Blocked: task acceptance is incomplete."
    for f in ${criteria_offenders[@]+"${criteria_offenders[@]}"}; do
      echo "  - unticked acceptance criteria: $f"
    done
    for f in ${missing_scripts[@]+"${missing_scripts[@]}"}; do
      echo "  - missing test script: $f"
    done
    for f in ${script_offenders[@]+"${script_offenders[@]}"}; do
      echo "  - unticked test-script step: $f"
    done
    echo "Tick every box beneath \"## Acceptance criteria\", write and run every step in each test-script.md, then run the roadmap sync, before landing."
  } >&2
  exit 2
fi

exit 0
