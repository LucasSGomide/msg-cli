# 02 — init heals, uninstall and check agree

**Roadmap:** [10](../../roadmap/10-heal-a-manifest-missing-a-key.md) · **Scope:** back-end · **Depends on:** 01

## Context

- Task 01 leaves a healing primitive with no caller. This slice wires it into
  `init` and pins how the two commands that read the manifest behave afterwards.
- Healing bends the never-overwrite rule that `src/core/scaffold.ts:32` and the
  `kept ... (yours)` report line both state plainly. The narrow scope — absent
  top-level keys only, one line appended — is what keeps that promise true. If
  the implementation finds it cannot stay that narrow, stop and re-plan rather
  than widening.
- A healed `project.yml` no longer byte-matches `renderManifest`, so `uninstall`
  classifies it as user-modified and leaves it on disk. That is the accepted
  outcome, not a bug, and it needs a test so nobody later "fixes" it.
- `msg check` already validates `requirementsFile`, so a healed manifest should
  pass it where the unhealed one did not.

## Technical details

- **Design** — the healed manifest is reported with the existing `appended`
  verb, no new report vocabulary, rule 1.
- **Naming** — no new command; healing is a side effect of `init`, so the
  inverse-verb rule 1 does not apply.
- Call the healing primitive from `init` when `project.yml` exists, before
  `scaffold` runs, at the point the existing-manifest case is already detected
  via `findAncestorManifest`.
- Record the result on the `Recorder` as `appended`; an already-complete
  manifest records the no-op rather than a write.
- Leave every existing value untouched: no re-serialise, no reorder, no removal
  — comments in a hand-edited manifest must survive the full `init` run.

## Acceptance criteria

- [x] `(integration)` `init` over a manifest lacking `requirementsFile` appends the key and reports it `appended`
- [x] `(integration)` the healed manifest keeps its comments and area entries byte-identical apart from the appended line
- [x] `(integration)` a second `init` run reports the manifest as a no-op, not `appended` again
- [x] `(integration)` `init` heals before `scaffold` runs, so the rest of the scaffold sees the completed manifest
- [x] `(integration)` `uninstall` removes a healed `project.yml` regardless of content, and healing does not change that
- [x] `(integration)` `msg check` passes on a healed manifest that failed before healing

The fifth criterion originally read "`uninstall` reports a healed `project.yml`
as user-modified and leaves it on disk". That was written on a stale premise and
has been rewritten to match real behaviour. `project.yml` is already the one
exemption from the byte-comparison in `buildPlan` (`src/core/plan.ts:97`): it is
hand-edited by design, so comparing it would always report `kept-modified`, and
it is removed regardless of content. Healing changes nothing about that. Making
a healed manifest classify as user-modified would mean reworking how removal
treats the manifest — outside the narrow scope this item promised to stay inside
— so the behaviour is pinned as it stands instead, in
`test/integration/uninstall.test.ts`.

## References

- `src/commands/init.ts:98` — where the existing-manifest case is already
  detected (`findAncestorManifest`)
- `src/core/scaffold.ts:16` — `scaffold`; `:25` — `applyEntries`, the
  never-overwrite rule
- `src/core/plan.ts` — how `uninstall` classifies a file as user-modified
- `src/commands/check.ts` — the existing `requirementsFile` validation
- `docs/design.md` — the report verbs, rule 1
- `docs/naming.md` — the inverse-verb rule 1
- `docs/requirements.md` — UN.3

## Implement with

`/backend-standards`
