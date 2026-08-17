# 01 — addTopLevelKey and the expected-key set

**Roadmap:** [10](../../roadmap/10-heal-a-manifest-missing-a-key.md) · **Scope:** back-end · **Depends on:** —

## Context

- `msg init` never overwrites, so a `project.yml` written before
  `requirementsFile` existed can never gain it, and `msg-pre-roadmap` stops on
  its first instruction when the key is absent.
- This slice is the healing primitive only — a pure function over manifest text,
  with no `init` wiring. Task 02 calls it.
- The manifest is hand-edited and carries comments explaining what each area
  means, so healing is a textual append and never a parser round-trip. This is
  the same reasoning `addAreaLine` already records.
- Only missing **top-level** keys are healed. Gaps inside `structure:` and
  `areas:` are left alone — a trimmed manifest may be deliberate, and filling it
  would turn healing into an opinion about someone's project.
- `msg_version` is **not** a healed key. `readRecordedVersion` treats a missing
  `msg_version` as a mismatch on purpose, because the templates that wrote the
  workspace are unknown; stamping the running version would forge that
  provenance and let a later `uninstall` byte-compare against templates that
  never wrote the files. Today the expected set is exactly
  `requirementsFile: docs/requirements.md`.

## Technical details

- **Naming** — no new command or flag; this is an internal function, so the
  inverse-verb rule 1 does not apply.
- Add `addTopLevelKey(manifest, key, value)` to `src/core/manifest.ts`, modelled
  on `addAreaLine`: textual append, returns `null` when the key is already
  present so the caller can report a no-op rather than rewriting an identical
  file.
- Place the appended key after the `areas:` block, matching `renderManifest`'s
  own ordering.
- Define the expected key set in one place so a future key heals without new
  code.
- Leave every existing value untouched: no re-serialise, no reorder, no removal.

## Acceptance criteria

- [ ] `(unit)` a manifest with no `requirementsFile` gains exactly one line
- [ ] `(unit)` the appended line lands after the `areas:` block, matching `renderManifest` ordering
- [ ] `(unit)` every other byte of a commented, hand-edited manifest is identical after healing
- [ ] `(unit)` a manifest that already carries the key returns `null`
- [ ] `(unit)` a manifest missing a `structure:` entry is not filled in
- [ ] `(unit)` a manifest missing an `areas:` entry is not filled in
- [ ] `(unit)` the expected-key set contains `requirementsFile` and not `msg_version`

## References

- `src/core/manifest.ts:55` — `addAreaLine`, the textual-append precedent and its
  "never round-trip through a parser" comment
- `src/core/manifest.ts:35` — `renderManifest`, the key ordering to match
- `src/core/manifest.ts:103` — `readRecordedVersion`, why `msg_version` is excluded
- `docs/requirements.md` — UN.3

## Implement with

`/backend-standards`
