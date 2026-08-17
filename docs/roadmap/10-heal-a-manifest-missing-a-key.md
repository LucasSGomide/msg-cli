# 10 — Heal a manifest missing a top-level key

**Depends on:** 09 · **Status:** not-started · **Estimate:** 6

## Context

- `msg init` never overwrites, so an existing `project.yml` is kept whole
  (`src/core/scaffold.ts:32`). A manifest written before `requirementsFile`
  existed can therefore never gain it, and `msg-pre-roadmap` stops on its first
  instruction when the key is absent.
- This repo hit it directly: its own manifest predated the key and had to be
  patched by hand.
- Covers UN.3 of `Pre-roadmap Skills in Init and Uninstall` in
  `docs/requirements.md`.
- Scope decision: only missing **top-level** keys are healed. Gaps inside
  `structure:` and `areas:` are left alone — a trimmed manifest may be
  deliberate.

## Key Areas:

- **Design** — the healed manifest is reported with the existing `appended`
  verb, no new vocabulary, rule 1.
- **Naming** — no new command; healing is a side effect of `init`, so the
  inverse-verb rule 1 does not apply.

## Technical Details:

1. Add `addTopLevelKey(manifest, key, value)` to `src/core/manifest.ts`,
   modelled on `addAreaLine`: textual append, returns `null` when the key is
   already present so the caller reports a no-op.
2. Place the appended key after the `areas:` block, matching `renderManifest`'s
   own ordering.
3. Define the expected key set in one place so a future key heals without new
   code — today it is `requirementsFile: docs/requirements.md`.
4. Call it from `init` when `project.yml` exists, before `scaffold` runs, and
   record the result on the `Recorder` as `appended`.
5. Leave every existing value untouched: no re-serialise, no reorder, no
   removal — comments in a hand-edited manifest must survive.
6. Test: a manifest with no `requirementsFile` gains exactly one line, comments
   and area entries byte-identical otherwise.
7. Test: a manifest that already has the key is untouched and reported as kept.
8. Test: `structure:` and `areas:` gaps are not filled.
9. Test: `uninstall` reports a healed `project.yml` as user-modified and leaves
   it on disk — it no longer byte-matches `renderManifest`, which is the
   accepted outcome, not a bug.
10. Confirm `msg check` passes on a healed manifest — it already validates
    `requirementsFile` (`src/commands/check.ts`).

### Technical References:

- `src/core/manifest.ts:55` — `addAreaLine`, the textual-append precedent and
  its "never round-trip through a parser" comment
- `src/core/manifest.ts:35` — `renderManifest`, the key ordering to match
- `src/core/scaffold.ts:16` — `scaffold`; `:25` — `applyEntries`
- `src/commands/init.ts:98` — where the existing-manifest case is already
  detected (`findAncestorManifest`)
- `src/core/plan.ts` — how `uninstall` classifies a file as user-modified
- `docs/requirements.md` — UN.3

## Blockers:

- Healing bends the never-overwrite rule that `src/core/scaffold.ts:32` and the
  `kept ... (yours)` report line both state plainly. The narrow scope (absent
  top-level keys only) is what keeps that promise true; if implementation finds
  it cannot stay that narrow, stop and re-plan rather than widening.
- ~~`readRecordedVersion` (`src/core/manifest.ts:103`) gates `uninstall` on an
  exact version match. Whether healing should also stamp `msg_version` is
  undecided and needs a call during the breakdown — writing it makes the
  workspace claim a version that never wrote it.~~ Resolved during the
  breakdown: healing does **not** stamp `msg_version`. `readRecordedVersion`
  treats a missing field as a mismatch on purpose, because the templates that
  wrote the workspace are unknown; stamping the running version would forge that
  provenance and let `uninstall` byte-compare against templates that never wrote
  the files. `requirementsFile` is the only healed key.
