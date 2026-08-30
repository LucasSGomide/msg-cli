#!/usr/bin/env bash
# PreToolUse gate on Bash: refuse a ship that would land a task slice with its
# acceptance record left half-written. `make roadmap-sync` derives a roadmap
# item's status from the checkboxes beneath each task file's
# "## Acceptance criteria" heading, so a slice that ships with boxes it should
# have ticked still reads as in progress forever after. This is the one moment
# that can be caught: the ship.
#
# ---------------------------------------------------------------------------
# What the gate decides from, and why (constraint 4 of docs/prompts/15).
#
# The signal is *what this ship's diff does to the checkboxes* — never what
# files happen to sit in the repository, and never the item's derived status
# (that status is computed FROM the boxes, so using it here would reason in a
# circle). Concretely, the diff the ship carries is
# `git diff <merge-base(target, ref)>..<ref>`, and every task file in it is
# judged as it will exist on the target *after* the ship, read with
# `git show <ref>:<path>` — never from the working tree, which under GitButler
# is several applied branches merged together and belongs to none of them.
#
#   * Ship touches no numbered task file            -> allowed, silently.
#   * Ship ADDS a numbered task file                -> exempt. A freshly
#     authored breakdown is all-unticked by design; that is the correct state
#     for a slice nobody has begun.
#   * Ship MODIFIES a numbered task file and ticks
#     at least one acceptance box in it, but the
#     post-ship file still has an unticked box      -> BLOCKED. The ship is
#     doing acceptance and stopped half way — exactly the forgot-to-tick
#     failure this gate exists for.
#   * Ship MODIFIES a numbered task file, ticks a
#     box, and every box is ticked post-ship        -> allowed. Slice accepted.
#   * Ship MODIFIES a numbered task file but ticks
#     NO box (prose, wording, a new criterion line) -> allowed, with a note on
#     stderr. The gate cannot tell whether that slice is done, and constraint 5
#     says fail toward letting the ship through and saying what it could not
#     verify: a missed reminder is recoverable, a falsified acceptance record
#     corrupts the sync engine and is not.
#
# The case the signal CANNOT separate: a modifying ship that ticks some boxes
# because it finished one slice, versus one that ticks some boxes but also adds
# a genuinely-not-yet-done criterion for later work. Both look identical in the
# diff, and both are blocked. The escape is honest — tick the boxes if the work
# is done, or move the pending criteria onto their own slice — never "tick a box
# for work that does not exist", which is the one outcome this gate must never
# make the only way through.
#
# Only the ship moment is gated. `but land`, a `git merge`, and a `git push`
# that names the target branch ship; routine `but commit` / `git commit` never
# do. The ship is detected from the tool call's actual argv (program + sub-
# command), not from a substring of the command string — a commit message, a
# heredoc body, a grep pattern or a filename that spells "but land" is not a
# ship, and blocking one is a bug.
#
# Needs bash, jq and git only — it runs before every Bash tool call.
# See CLAUDE.md "Acceptance before landing".
# ---------------------------------------------------------------------------
set -euo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[[ -z "$cmd" ]] && exit 0

root="${CLAUDE_PROJECT_DIR:-.}"
git_c() { git -C "$root" "$@"; }

# No git, no diff to reason about, nothing to gate.
git_c rev-parse --git-dir >/dev/null 2>&1 || exit 0

tasks_rel="docs/tasks"
[[ -d "$root/$tasks_rel" ]] || exit 0

# --- the configured target branch -------------------------------------------
target=""
if t=$(git_c config --get gitbutler.project.targetref 2>/dev/null) && [[ -n "$t" ]]; then
  target="$t"                                   # GitButler, e.g. refs/remotes/origin/main
elif t=$(git_c symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null); then
  target="$t"                                   # generic, e.g. refs/remotes/origin/main
elif git_c show-ref --verify --quiet refs/heads/main; then
  target="refs/heads/main"
elif git_c show-ref --verify --quiet refs/heads/master; then
  target="refs/heads/master"
fi
target_short="${target##*/}"

# --- detect the ship from the invocation, not from the raw string -----------
# Join "\<newline>" continuations, strip heredoc bodies (their lines would
# otherwise read as fresh commands), then split into simple-command segments.
cmd_joined=$(printf '%s' "$cmd" | sed ':a;N;$!ba;s/\\\n/ /g')
cmd_nohd=$(printf '%s\n' "$cmd_joined" | awk '
  skip == 1 { if ($0 ~ ("^[ \t]*" delim "[ \t]*$")) skip = 0; next }
  {
    if (match($0, /<<-?[ \t]*["\047]?[A-Za-z_][A-Za-z0-9_]*["\047]?/)) {
      w = substr($0, RSTART, RLENGTH)
      sub(/^<<-?[ \t]*/, "", w)
      gsub(/["\047]/, "", w)
      delim = w
      skip = 1
    }
    print
  }
')
segments=$(printf '%s\n' "$cmd_nohd" | sed -E 's/\|\||&&|[;&|]/\n/g')

ship=0
ship_ref=""
push_remote=""
push_ship=0

while IFS= read -r seg; do
  seg="${seg#"${seg%%[![:space:]]*}"}"
  [[ -z "$seg" ]] && continue
  read -ra tok <<< "$seg"
  [[ ${#tok[@]} -eq 0 ]] && continue

  idx=0
  while [[ $idx -lt ${#tok[@]} && "${tok[$idx]}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; do idx=$((idx + 1)); done
  [[ "${tok[$idx]:-}" == "env" || "${tok[$idx]:-}" == "command" ]] && idx=$((idx + 1))

  prog=$(basename -- "${tok[$idx]:-/none}")
  sub="${tok[$((idx + 1))]:-}"

  case "$prog:$sub" in
    but:land | git:merge)
      ship=1
      for ((j = idx + 2; j < ${#tok[@]}; j++)); do
        [[ "${tok[$j]}" == -* ]] && continue
        ship_ref="${tok[$j]}"
        break
      done
      ;;
    git:push)
      [[ -z "$target_short" ]] && continue
      for ((j = idx + 2; j < ${#tok[@]}; j++)); do
        a="${tok[$j]}"
        [[ "$a" == -* ]] && continue
        if [[ -z "$push_remote" && "$a" != *:* && "$a" != "$target_short" ]]; then
          push_remote="$a"
          continue
        fi
        if [[ "$a" == "$target_short" || "$a" == *":$target_short" || "$a" == *":refs/heads/$target_short" ]]; then
          ship=1
          push_ship=1
          src="${a%%:*}"
          [[ "$src" == "$a" || -z "$src" ]] && ship_ref="$target_short" || ship_ref="$src"
        fi
      done
      ;;
  esac
done <<< "$segments"

[[ $ship -eq 1 ]] || exit 0

warn() {
  echo "acceptance-criteria-gate: $1" >&2
  echo "  verify task acceptance by hand before this lands." >&2
  exit 0
}

[[ -n "$target" ]] || warn "could not work out the target branch — not gating this ship."

# --- resolve the shipped ref and the diff base -----------------------------
resolve_ref() {
  local r="$1" c
  for c in "$r" "refs/heads/$r" "refs/gitbutler/$r"; do
    if git_c rev-parse --verify --quiet "${c}^{commit}" >/dev/null 2>&1; then
      printf '%s' "$c"
      return 0
    fi
  done
  return 1
}

ref=$(resolve_ref "${ship_ref:-}") || warn "could not resolve the shipped ref '${ship_ref:-?}' — not gating this ship."

base="$target"
if [[ $push_ship -eq 1 && -n "$push_remote" ]]; then
  rb="refs/remotes/${push_remote}/${target_short}"
  git_c rev-parse --verify --quiet "${rb}^{commit}" >/dev/null 2>&1 && base="$rb"
fi
git_c rev-parse --verify --quiet "${base}^{commit}" >/dev/null 2>&1 || warn "could not resolve the target ref '${base}' — not gating this ship."

mb=$(git_c merge-base "$base" "$ref" 2>/dev/null) || mb="$base"

# --- inspect only the task files this ship carries -------------------------
mapfile -t changes < <(git_c diff --name-status -M "$mb" "$ref" -- "$tasks_rel" 2>/dev/null || true)
[[ ${#changes[@]} -eq 0 ]] && exit 0

is_numbered() { [[ "$(basename -- "$1")" =~ ^[0-9].*\.md$ ]]; }

# an unticked box beneath "## Acceptance criteria", read to EOF exactly as the
# sync engine reads it (indexOf + slice-to-end, no stop at the next heading).
has_unticked_criteria() {
  awk '
    /^##[[:space:]]+[Aa]cceptance[[:space:]]+[Cc]riteria/ { f = 1; next }
    f && /^[[:space:]]*-[[:space:]]+\[[[:space:]]\]/       { u = 1 }
    END { exit(u ? 0 : 1) }
  '
}

declare -A in_scope=()
block=()
warn_files=()

for line in "${changes[@]}"; do
  st="${line%%$'\t'*}"
  rest="${line#*$'\t'}"
  path="${rest##*$'\t'}"                         # R/C lines carry old<TAB>new
  [[ "$st" == D* ]] && continue

  rel="${path#"$tasks_rel"/}"
  [[ "$rel" == "$path" ]] && continue            # not under docs/tasks
  folder="${rel%%/*}"
  fname="${rel#*/}"
  [[ "$fname" == */* ]] && continue              # deeper than a task file
  [[ "$fname" == "test-script.md" ]] && continue # judged via folder scope
  is_numbered "$path" || continue
  [[ "$st" == A* ]] && continue                  # freshly authored slice — exempt

  ticked_here=0
  if git_c diff "$mb" "$ref" -- "$path" | grep -qE '^\+[[:space:]]*-[[:space:]]+\[[xX]\]'; then
    ticked_here=1
  fi

  unticked=0
  if git_c show "$ref:$path" 2>/dev/null | has_unticked_criteria; then
    unticked=1
  fi

  if [[ $ticked_here -eq 1 && $unticked -eq 1 ]]; then
    block+=("$path|the ship ticked some acceptance boxes here and left others unchecked")
    in_scope["$folder"]=1
  elif [[ $ticked_here -eq 1 ]]; then
    in_scope["$folder"]=1
  elif [[ $unticked -eq 1 ]]; then
    warn_files+=("$path")
  fi
done

# test-script.md is required only for a folder this ship actually accepted into.
for folder in "${!in_scope[@]}"; do
  ts="$tasks_rel/$folder/test-script.md"
  if ! git_c cat-file -e "$ref:$ts" 2>/dev/null; then
    block+=("$ts|the ship accepts a slice in this folder but records no hand-run steps here (file missing)")
  elif git_c show "$ref:$ts" | grep -qE '^[[:space:]]*-[[:space:]]+\[[[:space:]]\]'; then
    block+=("$ts|the ship accepts a slice in this folder but a step here has not been checked off")
  fi
done

if [[ ${#block[@]} -gt 0 ]]; then
  {
    echo "Blocked: this ship carries incomplete task acceptance."
    echo "  ship ${ship_ref} -> target ${target_short}   (diff ${mb}..${ref})"
    for e in "${block[@]}"; do
      echo "  - ${e%%|*}"
      echo "      in scope because ${e#*|}"
    done
    if [[ ${#warn_files[@]} -gt 0 ]]; then
      echo "  unverified (edited by the ship, no box ticked — not blocking):"
      for p in "${warn_files[@]}"; do echo "      $p"; done
    fi
    echo
    echo "If the slice is done: tick its boxes, write its test-script.md section, run 'make roadmap-sync'."
    echo "If a criterion above is for later work: move it onto its own slice — do not tick a box for work that does not exist."
    echo "If the gate mis-scoped this ship: the paths above are what it saw in the diff; adjust the ship or the breakdown."
  } >&2
  exit 2
fi

if [[ ${#warn_files[@]} -gt 0 ]]; then
  {
    echo "acceptance-criteria-gate: this ship edits task files that still have unticked criteria,"
    echo "but it ticked no box itself, so the gate cannot tell whether those slices are done."
    echo "Letting it through — verify by hand if they were meant to land accepted:"
    for p in "${warn_files[@]}"; do echo "  - $p"; done
  } >&2
fi
exit 0
