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

## Mimic the project's existing spec

A project that already ships an OpenAPI file has already decided how its API is
described: how errors come back, which status code means what, whether a closed
value set is an `enum` and in which casing, what a schema is called. A contract
that ignores those decisions is a second dialect in the same repo, and the
divergence surfaces at implementation time as rework. So look for an existing
spec first and derive the house style from it. What this skill's **Format**
section shows is only the default, for a project with no spec to copy.

**Find it.** One search, with `node_modules`, `vendor` and `dist` pruned:

```bash
find . \( -name node_modules -o -name vendor -o -name dist \) -prune -o \
  -iregex '.*\(openapi\|swagger\).*\.\(json\|ya?ml\)' -print
```

Also follow any spec path the back-end rule doc names. Highest precedence first:

1. The project's own served spec — the file at the repo root, or the one the
   back-end rule doc points at. This is the standard.
2. Another item's `docs/tasks/<other-item>/openapi.json`, written by an earlier
   run of this skill. Weaker, but still this repo's house style.
3. Nothing found. Use this skill's defaults, and say so in one line.

**Read it cheaply.** A large spec is sampled, not read end to end: `info`, the
names under `components`, and two or three representative operations — one
carrying both a success and an error response, one collection endpoint, one with
a closed value set. That is enough to derive every convention below.

**Map these, then apply them:**

- **Errors** — the error body's shape and media type (a bare `message`, an
  `{ "error": { "code", "message" } }` envelope, RFC 7807
  `application/problem+json`), whether error responses live in
  `components.responses` and are reached by `$ref`, which status code the
  project actually uses for which failure (`422` or `400` for validation, `404`
  or `403` for a hidden resource), and how their `description` reads.
- **Enums** — whether closed value sets are written as `enum` at all, the casing
  of their values (`SCREAMING_SNAKE`, `kebab-case`, `camelCase`), and whether an
  enum is a named `components.schemas` entry reached by `$ref` rather than
  repeated inline. An enum the project already defines is reused under its
  existing name and values, never re-spelled.
- **Naming** — property casing, schema naming (`CreateCharacter` vs
  `CreateCharacterRequest` vs `CharacterCreateDto`), whether operations carry an
  `operationId` and how it is built, path segment casing and pluralization.
- **Everything else the operation touches** — `required` and nullability style,
  string `format`s, the pagination envelope, `tags`, `servers`, and whether
  `security` is declared per operation or once at the top against
  `components.securitySchemes`.
- **Spec version** — if the project spec pins 3.0.x, write 3.0.x so both files
  lint under one ruleset, and avoid 3.1-only constructs. This overrides the
  3.1.0 default under **Rules**. Serialization does not follow: the item's file
  stays JSON even when the project spec is YAML, because it is merged into
  repeatedly and JSON diffs cleanly.

**Reuse over redefinition.** If the project spec already defines a schema this
endpoint needs — its error shape, an enum, a resource representation — copy it
into the item's file under the same name with the same shape. The item's file
has to stand alone, so this is a copy and not a cross-file `$ref`; the point of
the identical name is that folding the item's paths back into the project spec
later is a no-op instead of a rename.

**Where the slice and the spec disagree**, split it. The project spec wins on
form — casing, envelope, enum style, schema naming — because the slice's prose
was not trying to overturn a house standard. The slice wins on substance — which
fields exist, which statuses, which errors — because that is the decision that
was actually made. Say in one line where the two diverged on substance rather
than resolving it silently, and never pull a field out of the spec that the
slice does not mention.

**A route the project spec already documents** is the pre-change baseline for
the "described whole" rule below: what gets written is that operation plus the
slice's change, not the slice's change alone.

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
5. **Read the project's existing spec**, if it has one, and derive its
   conventions. See **Mimic the project's existing spec** above.
6. **Read the item's existing `openapi.json`** if it has one. An earlier slice
   may already have written the path this slice changes, and its shapes and
   `components.schemas` are the baseline this slice edits.
7. **Write the operation(s).** For a **new** route, a new `paths` entry. For a
   **changed** one, the endpoint as it will be **after** the change — the full
   post-change operation, not a diff and not only the field that moved. A
   contract listing only what changed is unusable as a spec.
8. **Merge into the item's one file.** Create it if it doesn't exist. Adding or
   replacing only the `paths` entries this slice touches, and only the
   `components.schemas` they reference. Never rewrite, reorder wholesale, or
   drop a path another slice wrote.
9. **Add the reference line** to the slice's `## References` section, naming
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
later slice adds an optional `avatarUrl` to it. This is the default shape, for a
project with no spec of its own — where there is one, its conventions override
every convention shown here:

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

- OpenAPI 3.1.0 unless the project's own spec pins another version, valid JSON,
  pretty-printed with 2-space indent so diffs stay readable. No YAML, whatever
  the project spec is written in.
- House style beats default style. Every convention the **Format** example above
  shows — error envelope, enum casing, schema naming, status codes, spec
  version — is what to write only when the project has no spec of its own to
  copy.
- A schema the project spec already defines is copied under its existing name
  and shape, never re-invented under a new one.
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
