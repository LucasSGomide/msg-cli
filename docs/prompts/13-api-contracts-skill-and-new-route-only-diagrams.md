# Goal: Narrow sequence diagrams to new routes only, and add a `msg-api-contracts` skill that writes an `openapi.json` into the task folder for every endpoint a slice adds or changes

**Status:** executed on 2026-08-29
**Rating:** 10

## Context

`msg-sequence-diagrams` currently fires whenever a slice adds **or changes** an
API endpoint. That is too wide. A sequence diagram earns its place when the
request path itself is new — new participants, a new order of calls, a new
failure branch. When the route already exists and only its contract moves — a
field added to the payload, a response reshaped, a status code or auth rule
changed — the flow is unchanged, and the diagram redraws something the codebase
already answers. The artifact that actually helps there is the contract itself.

So the two artifacts split by what changed. A **new route** gets a sequence
diagram, because nobody can read the flow anywhere yet. **Any** endpoint the
slice adds or changes gets an OpenAPI contract, because the request and response
shapes are what the implementer and the front-end both need to agree on, and
prose in `## Technical details` is a poor place to pin them down.

The contract is a machine-readable file, not a section: `openapi.json` in the
item's task folder, one per item, accumulating the paths of every slice in that
item. It sits next to the task files rather than inside one because it is a real
spec — tooling can lint it, mock it, or diff it against the implementation,
which a fenced block in a markdown section cannot.

## Constraints

1. New skill `msg-api-contracts`, a sibling of `msg-wireframes` and
   `msg-sequence-diagrams`, with its own
   `templates/skills/msg-api-contracts/SKILL.md`. It owns the OpenAPI contract
   and nothing else. Do not extend `msg-sequence-diagrams` to write it, and do
   not fold the job into `msg-roadmap-task-breakdown`.
2. `msg-sequence-diagrams` narrows its trigger to a **new route** — a
   path + method combination the application does not serve yet. A slice that
   only changes an existing route's payload, response, status codes, auth or
   validation gets **no** diagram. Update the skill's **When it applies**
   section, its intro, and every place the old "adds or changes" wording
   appears.
3. Deciding whether a route is new is a read, not a guess: the slice's
   `## Technical details` wording, the item's existing `openapi.json`, and the
   codebase's routes. When it is genuinely ambiguous, ask rather than draw.
4. `msg-api-contracts` fires for **any** slice that adds or changes an API
   endpoint — the superset of the diagram trigger. A slice that only touches
   migrations, seeders, mappers, config or an internal refactor gets no
   contract, the same way it gets no diagram.
5. One contract file per roadmap item: `docs/tasks/<item>/openapi.json`. Every
   slice in the item that touches an endpoint merges its paths into that one
   file. Merging is additive and surgical — adding or replacing only the
   `paths` entries the current slice touches, never rewriting or dropping a path
   another slice wrote. Do not create per-slice or per-endpoint files.
6. OpenAPI 3.1.0, valid JSON, pretty-printed with 2-space indent so diffs are
   readable. `info.title` is the roadmap item's title; `info.version` starts at
   `0.1.0`. Shared schemas go under `components.schemas` and are referenced with
   `$ref` rather than inlined twice.
7. For a **changed** endpoint the file describes the endpoint as it will be
   **after** the change — the full post-change operation, not a diff and not
   only the changed field. A contract that only lists what moved is unusable as
   a spec.
8. The contract states only what the slice already states. Request and response
   shapes, status codes, error responses and auth come from the slice's
   `## Technical details` and the `back-end` area's rule doc, resolved through
   `project.yml`'s `areas` — never hard-code `docs/architecture-api.md`. Never
   invent a field, a status code or an error the slice doesn't describe; if the
   Technical details are too thin to write an operation, say so and stop, the
   same discipline `msg-sequence-diagrams` has.
9. The task file points at the contract instead of duplicating it: the slice's
   `## References` section gains a line naming `openapi.json` and the endpoints
   this slice contributes to it. `msg-api-contracts` writes that line; it is the
   only edit it makes to a task file.
10. The same write barrier applies as in the two sibling skills: a task file
    carrying any `- [x]` acceptance criterion has work against it. Do not edit
    it — report that the slice needs a contract and that it must be added by
    hand. State the rule in the skill. The `openapi.json` itself is not a task
    file and is not barrier-protected, but a barred slice's paths are not
    written either, since its reference line cannot be added.
11. Keep the standalone fallback the sibling skills have: with no `project.yml`
    or no `docs/tasks/<item>/` folder, write `openapi.json` at the repo root,
    say once that this is the fallback, and skip the task-file reference line.
12. `msg-roadmap-task-breakdown` invokes `/msg-api-contracts` for every slice
    that adds or changes an endpoint, right after the task file is written and
    alongside the existing `/msg-sequence-diagrams` step — whose invocation
    condition narrows to new routes. Its task-file field list updates to match:
    `## Sequence diagrams` is required only when the slice adds a **new route**,
    and the contract is described as a task-folder file, not a section.
13. `msg-roadmap-task-review` gains contract checks and retunes the diagram
    ones, inside its existing four-class structure:
    - a slice that adds or changes an endpoint with no matching path in
      `docs/tasks/<item>/openapi.json` is a gap;
    - a slice that adds a new route with no `## Sequence diagrams` section is a
      gap;
    - a slice that only changes an existing route's contract but carries a
      `## Sequence diagrams` section is a gap the other way — remove it.
      Update the report's example lines so they show the new classes.
14. Ship the skill through the CLI: add `msg-api-contracts` to `SKILLS` in
    `src/core/templates.ts`, ordered next to `msg-sequence-diagrams`. Do **not**
    add it to `PORTABLE_SKILLS` — like its siblings, its normal path depends on
    `docs/tasks/` existing.
15. `test/unit/skills.test.ts` asserts `SKILLS` set-equal to the folders under
    `templates/skills/`, and `test/integration/init.test.ts` asserts the
    scaffolded tree; keep both passing.
16. Update prompt `12-sequence-diagrams-and-inline-task-diagram-sections.md`'s
    record only if this change contradicts something it states as built; do not
    rewrite its history.

## Output

- `templates/skills/msg-api-contracts/SKILL.md` — the new skill.
- Edits to `templates/skills/msg-sequence-diagrams/SKILL.md` — new-route-only
  trigger.
- Edits to `templates/skills/msg-roadmap-task-breakdown/SKILL.md` — the new
  invocation step and the retuned field descriptions.
- Edits to `templates/skills/msg-roadmap-task-review/SKILL.md` — the new checks.
- `src/core/templates.ts` — `msg-api-contracts` in `SKILLS`.

## Examples

The shape of `docs/tasks/03/openapi.json` after one slice adds `POST /characters`
and a later slice adds an optional `avatarUrl` to it:

```json
{
  "openapi": "3.1.0",
  "info": { "title": "Character roster", "version": "0.1.0" },
  "paths": {
    "/characters": {
      "post": {
        "summary": "Create a character",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/CreateCharacter" }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Created",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": { "id": { "type": "string", "format": "uuid" } },
                  "required": ["id"]
                }
              }
            }
          },
          "409": { "description": "Name already taken" }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "CreateCharacter": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "maxLength": 40 },
          "class": { "type": "string", "enum": ["warrior", "mage", "rogue"] },
          "avatarUrl": { "type": "string", "format": "uri" }
        },
        "required": ["name", "class"]
      }
    }
  }
}
```

The reference line the skill adds to the slice's `## References`:

```markdown
- `openapi.json` — contract for `POST /characters`
```
