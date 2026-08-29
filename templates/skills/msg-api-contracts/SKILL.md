---
name: msg-api-contracts
description: Write an OpenAPI contract into the roadmap item's task folder for every endpoint a task slice adds or changes, merged into one openapi.json per item. Use during task breakdown when a slice touches an API endpoint, or when asked for the contract of an endpoint.
---

# Contract a task slice's endpoints

A slice that adds or changes an API endpoint describes it in prose, so the
request and response shapes — which fields, which types, which status codes,
which errors — are re-derived by whoever implements it, and separately again by
whoever calls it. This skill closes that gap: it writes the endpoint as an
OpenAPI operation into a real spec file, so the contract can be linted, mocked
and diffed against the implementation instead of read out of a paragraph.

It is the third sibling of `msg-wireframes` and `msg-sequence-diagrams`, and it
splits the back-end job with the second one by **what changed**. A new route
gets a sequence diagram, because nobody can read the flow anywhere yet. **Any**
endpoint a slice adds or changes gets a contract, because the shapes are what
the implementer and the caller have to agree on either way.

The contract is not a task-file section. It is `openapi.json` in the item's task
folder — one file per roadmap item, accumulating the paths of every slice in it.
The task file only points at it.

This skill never designs the endpoint. It writes down what
`msg-roadmap-task-breakdown` already wrote in a task's `## Technical details`
section — if that section is thin, there is no contract to write, and that is a
task-breakdown problem, not this skill's to fix.

Invocation: `/msg-api-contracts <item>` for one item's pending slices, or
invoked automatically by `msg-roadmap-task-breakdown` right after it writes a
task whose Technical details add or change an API endpoint. Bare, ask which item
and slice.

## When it applies

The trigger is the endpoint, not the scope. A slice qualifies when its
`## Technical details` **add or change an API endpoint** — a route added, a
payload or response changed, a status code, auth rule or validation altered.
This is the superset of the `msg-sequence-diagrams` trigger, which fires only
for a route the application does not serve yet.

A slice that only touches migrations, seeders, mappers, config or an internal
refactor gets no contract. Say so in one line and stop.

One `paths` entry per route, one operation per method the slice adds or
changes.

## Locate context

Read `project.yml` for the tasks folder and the `back-end` area's rule doc.
Resolve the rule doc through `areas` — do not hard-code
`docs/architecture-api.md`, which is only the default.

- **No `project.yml`, or the item's `docs/tasks/<item>/` folder doesn't exist
  yet** — this isn't a msg-cli planning workspace, or the item hasn't been
  broken down. Do not fail. Write to (or update) `openapi.json` at the repo root
  instead of the task folder, using `docs/architecture-api.md` at the repo root
  as the rule doc if it exists, skip the task-file reference line, and say once
  that this is the standalone fallback.
- **Otherwise** write `docs/tasks/<item>/openapi.json` and read the rule doc
  `project.yml`'s `back-end` area names.

## Flow

1. **Read the task slice(s).** From `msg-roadmap-task-breakdown`: the task
   file(s) just written for this item. Invoked standalone: ask which task
   number(s), or which endpoint if there's no task file at all (fallback mode).
2. **Decide whether it applies.** See **When it applies** above. Skip the slice
   if no endpoint is added or changed.
3. **Read the slice's `## Technical details` section** — the `**Area**` bullets.
   This is the entire input; never add a field, a status code or an error the
   slice doesn't already describe.
4. **Read the back-end rule doc**, only the rules the contract actually
   exercises — error mapping, status codes, auth, validation, pagination,
   whatever applies. Skim by heading; don't read the whole file for a
   one-endpoint slice.
5. **Read the item's existing `openapi.json`** if it has one. An earlier slice
   may already have written the path this slice changes, and its shapes and
   `components.schemas` are the baseline this slice edits.
6. **Write the operation(s).** For a **new** route, a new `paths` entry. For a
   **changed** one, the endpoint as it will be **after** the change — the full
   post-change operation, not a diff and not only the field that moved. A
   contract listing only what changed is unusable as a spec.
7. **Merge into the item's one file.** Create it if it doesn't exist. Adding or
   replacing only the `paths` entries this slice touches, and only the
   `components.schemas` they reference. Never rewrite, reorder wholesale, or
   drop a path another slice wrote.
8. **Add the reference line** to the slice's `## References` section, naming
   `openapi.json` and the endpoints this slice contributes. That is the only
   edit this skill makes to a task file.

## The write barrier

A task file with **any** `- [x]` acceptance criterion has work against it. Do
not edit it: report that the slice needs a contract and that it must be added by
hand, the same barrier `msg-roadmap-task-review` applies.

`openapi.json` is not a task file and is not barrier-protected. But a barred
slice's paths are not written either — its reference line cannot be added, so a
contract nothing points at would go unnoticed.

Ticked checkboxes are sacred — no path through this skill removes or rewrites
one, and no path through it touches a section other than `## References`.

## Format

`docs/tasks/<item>/openapi.json`, after one slice adds `POST /characters` and a
later slice adds an optional `avatarUrl` to it:

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

The line added to the slice's `## References`:

```markdown
- `openapi.json` — contract for `POST /characters`
```

Fallback mode (no `docs/tasks/`) writes the same file at the repo root and adds
no reference line.

## Rules

- OpenAPI 3.1.0, valid JSON, pretty-printed with 2-space indent so diffs stay
  readable. No YAML, no other spec version.
- One file per roadmap item, at `docs/tasks/<item>/openapi.json`. Never a
  per-slice or per-endpoint file, and never a `## Contracts` section in a task
  file.
- `info.title` is the roadmap item's title. `info.version` starts at `0.1.0` and
  is not bumped per slice — the file is one item's evolving contract, not a
  released API.
- Merging is additive and surgical. A path another slice wrote and this one does
  not touch comes through byte-identical.
- A shape used by two operations goes in `components.schemas` and is referenced
  with `$ref`, never inlined twice.
- A changed endpoint is described whole, as it will be after the change.
- Every operation carries the error responses the slice describes, not just the
  success one. An operation whose only response is `200` is half a spec.
- Never invent a field, a type, a status code, an error or an auth rule the
  slice's Technical details don't already state. If they are too thin to write
  an operation, say so and stop rather than guessing a contract.
- The task file gains exactly one line, in `## References`. Never copy the
  operation back into `## Technical details`.
