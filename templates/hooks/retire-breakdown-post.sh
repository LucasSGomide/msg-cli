#!/usr/bin/env bash
# PostToolUse on Bash: when this session lands or merges a feature branch whose
# name carries a roadmap item number, stamp `**Landed:**` / `**Merged:**` onto
# that item's roadmap doc. That marker is the one signal that retires the item's
# task breakdown (see /msg-roadmap-sync) — reaching `done` never does, because a
# reviewer needs the breakdown through the whole review. This hook only saves
# you writing the marker by hand once the branch is actually in.
#
# ---------------------------------------------------------------------------
# It is deliberately timid — a false stamp would tell the next `make
# roadmap-sync` to retire a folder that should still be there. It acts only when
# every one of these holds:
#
#   * the command was `but land <ref>` or `git merge <ref>`, read from the
#     invocation's argv — never matched as a substring, so a commit message or a
#     heredoc that spells "but land" is not a land;
#   * <ref> carries a 1-4 digit run (`feat/04-profiles`, `04-profiles`) that
#     names an existing roadmap doc under the configured roadmap folder;
#   * that doc's `**Status:**` is `done`, it has no `Landed:` / `Merged:` field
#     yet, and its `docs/tasks/<slug>/` breakdown folder still exists;
#   * the shipped commits are in the target branch now — or the ref no longer
#     resolves, which is what GitButler leaves behind after a successful
#     `but land`.
#
# Anything short of that: it does nothing and exits 0. A project whose branches
# do not carry the item number never trips it — add the marker by hand.
#
# Needs bash, jq and git. See CLAUDE.md "Acceptance before landing".
# ---------------------------------------------------------------------------
set -euo pipefail

input=$(cat)
[[ "$(printf '%s' "$input" | jq -r '.tool_name // "Bash"')" == "Bash" ]] || exit 0
[[ "$(printf '%s' "$input" | jq -r '.tool_response.interrupted // false')" == "true" ]] && exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[[ -z "$cmd" ]] && exit 0

root="${CLAUDE_PROJECT_DIR:-.}"
git_c() { git -C "$root" "$@"; }
git_c rev-parse --git-dir >/dev/null 2>&1 || exit 0

# --- project.yml folders — a one-level reader under `structure:` -------------
manifest="$root/project.yml"
yaml_structure() { # $1 = key
  [[ -f "$manifest" ]] || return 0
  awk -v k="$1" '
    /^[^[:space:]#]/ { in_s = ($0 ~ /^structure:/) }
    in_s && $0 ~ ("^[[:space:]]+" k ":[[:space:]]") {
      sub(/^[[:space:]]+[^:]+:[[:space:]]*/, ""); gsub(/["\047]/, ""); sub(/[[:space:]]+#.*/, "")
      sub(/\/+$/, ""); print; exit
    }
  ' "$manifest"
}
roadmap_rel="$(yaml_structure roadmap)"; roadmap_rel="${roadmap_rel:-docs/roadmap}"
tasks_rel="$(yaml_structure tasks)"; tasks_rel="${tasks_rel:-docs/tasks}"
[[ -d "$root/$roadmap_rel" && -d "$root/$tasks_rel" ]] || exit 0

# --- detect a land / merge from argv, not from the raw string ---------------
cmd_joined=$(printf '%s' "$cmd" | sed ':a;N;$!ba;s/\\\n/ /g')
cmd_nohd=$(printf '%s\n' "$cmd_joined" | awk '
  skip == 1 { if ($0 ~ ("^[ \t]*" delim "[ \t]*$")) skip = 0; next }
  {
    if (match($0, /<<-?[ \t]*["\047]?[A-Za-z_][A-Za-z0-9_]*["\047]?/)) {
      w = substr($0, RSTART, RLENGTH); sub(/^<<-?[ \t]*/, "", w); gsub(/["\047]/, "", w)
      delim = w; skip = 1
    }
    print
  }
')
segments=$(printf '%s\n' "$cmd_nohd" | sed -E 's/\|\||&&|[;&|]/\n/g')

# --- the configured target branch -----------------------------------------
target=""
if t=$(git_c config --get gitbutler.project.targetref 2>/dev/null) && [[ -n "$t" ]]; then
  target="$t"
elif t=$(git_c symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null); then
  target="$t"
elif git_c show-ref --verify --quiet refs/heads/main; then
  target="refs/heads/main"
elif git_c show-ref --verify --quiet refs/heads/master; then
  target="refs/heads/master"
fi

resolve_ref() {
  local r="$1" c
  for c in "$r" "refs/heads/$r" "refs/gitbutler/$r" "refs/remotes/$r"; do
    git_c rev-parse --verify --quiet "${c}^{commit}" >/dev/null 2>&1 && { printf '%s' "$c"; return 0; }
  done
  return 1
}

# Stamp one <ref> with <verb> (Landed|Merged) if it clears every check.
try_stamp() {
  local ship_ref="$1" verb="$2" num num_nopad pad doc slug header ref today field tmp

  [[ "$ship_ref" =~ (^|[/_-])([0-9]{1,4})([-_/]|$) ]] || return 0
  num="${BASH_REMATCH[2]}"
  num_nopad=$((10#$num))
  pad=$(printf '%02d' "$num_nopad")

  doc=""
  for cand in "$root/$roadmap_rel/$pad-"*.md "$root/$roadmap_rel/$num_nopad-"*.md; do
    [[ -f "$cand" ]] && { doc="$cand"; break; }
  done
  [[ -n "$doc" ]] || return 0
  slug=$(basename -- "$doc" .md)

  header=$(awk 'NR>=2 && NR<=6 && /^\*\*/ { print; exit }' "$doc")
  [[ -n "$header" ]] || return 0
  [[ "$header" == *"**Landed:**"* || "$header" == *"**Merged:**"* ]] && return 0
  [[ "$header" =~ \*\*Status:\*\*[[:space:]]*done ]] || return 0
  [[ -d "$root/$tasks_rel/$slug" ]] || return 0

  if ref=$(resolve_ref "$ship_ref"); then
    [[ -n "$target" ]] || return 0
    git_c merge-base --is-ancestor "$ref" "$target" 2>/dev/null || return 0
  fi
  # ref gone: a successful `but land` removes the branch — treat as shipped.

  today=$(date +%F)
  field=" · **${verb}:** ${today}"
  tmp=$(mktemp)
  awk -v add="$field" '
    !stamped && NR>=2 && NR<=6 && /^\*\*/ { print $0 add; stamped=1; next }
    { print }
  ' "$doc" >"$tmp" && mv "$tmp" "$doc"

  echo "retire-breakdown: stamped **${verb}:** ${today} on ${roadmap_rel}/${slug}.md" >&2
  echo "  run 'make roadmap-sync', then /msg-roadmap-sync to retire ${tasks_rel}/${slug}/." >&2
}

while IFS= read -r seg; do
  seg="${seg#"${seg%%[![:space:]]*}"}"
  [[ -z "$seg" ]] && continue
  read -ra tok <<<"$seg"
  [[ ${#tok[@]} -eq 0 ]] && continue

  idx=0
  while [[ $idx -lt ${#tok[@]} && "${tok[$idx]:-}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; do idx=$((idx + 1)); done
  [[ "${tok[$idx]:-}" == "env" || "${tok[$idx]:-}" == "command" ]] && idx=$((idx + 1))

  prog=$(basename -- "${tok[$idx]:-/none}")
  sub="${tok[$((idx + 1))]:-}"

  verb=""
  case "$prog:$sub" in
    but:land) verb="Landed" ;;
    git:merge) verb="Merged" ;;
    *) continue ;;
  esac

  for ((j = idx + 2; j < ${#tok[@]}; j++)); do
    [[ "${tok[$j]}" == -* ]] && continue
    try_stamp "${tok[$j]}" "$verb"
  done
done <<<"$segments"

exit 0
