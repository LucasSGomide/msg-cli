#!/usr/bin/env bash
# PreToolUse gate: when a Bash command lands or merges an implementation into the
# target branch (`but land`, a `git merge`, or a `git push` aimed at main/master),
# refuse if any task file under docs/tasks/*/ still has an unticked checkbox
# beneath its "## Acceptance criteria" heading. The sync engine derives item
# status from those boxes, so a shipped item left with unticked boxes still reads
# as in progress. Routine checkpoint commits (`but commit`, `git commit`) are
# never blocked. Needs only bash and jq. See CLAUDE.md "Branch-first for
# implementation work".
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

offenders=()
while IFS= read -r -d '' file; do
  # Read the lines beneath "## Acceptance criteria" up to the next "## " heading;
  # an unticked "- [ ]" box in that span is a blocker.
  if awk '
      /^##[[:space:]]+[Aa]cceptance[[:space:]]+[Cc]riteria[[:space:]]*$/ { in_block = 1; next }
      /^##[[:space:]]/                                                  { in_block = 0 }
      in_block && /^[[:space:]]*-[[:space:]]+\[[[:space:]]\]/           { unticked = 1 }
      END { exit(unticked ? 0 : 1) }
    ' "$file"; then
    offenders+=("${file#"$root"/}")
  fi
done < <(find "$tasks" -mindepth 2 -type f -name '*.md' -print0)

if [[ ${#offenders[@]} -gt 0 ]]; then
  {
    echo "Blocked: unticked acceptance criteria remain in:"
    for f in "${offenders[@]}"; do echo "  - $f"; done
    echo "Tick every box beneath \"## Acceptance criteria\", then run the roadmap sync, before landing."
  } >&2
  exit 2
fi

exit 0
