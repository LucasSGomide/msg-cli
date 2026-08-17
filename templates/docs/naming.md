# Naming standards

Every file: **`kebab-case.<purpose>.ts`**. The purpose suffix is mandatory — a file without one is a
naming bug.

```
character-level.vo.ts
create-character.command.ts
character.controller.ts
create-character.dto.ts
```

Tests sit next to the file they test and repeat its full name:

```
create-character.command-handler.test.ts             unit
character.drizzle.repository.integration.test.ts     integration (real DB / MSW)
character.repository.mock.ts                         reusable mock factory (unit)
character.repository.integration.mock.ts             seed helper (integration only)
```

There is **no `test/` or `tests/` subfolder** — test and mock files sit directly beside their
source.

## The suffix list is closed

Both lists below are complete. **Adding a suffix is a decision, not a judgement call** — it needs
sign-off in the same conversation, and it lands in this table in the same change. If a new file does
not fit an existing suffix, the usual answer is that the code belongs inside something that already
has one.

### `packages/api`

| Concept                                                   | Suffix                  |
| --------------------------------------------------------- | ----------------------- |
| Aggregate                                                 | `.aggregate.ts`         |
| Entity                                                    | `.entity.ts`            |
| Value object                                              | `.vo.ts`                |
| Enum                                                      | `.enum.ts`              |
| Repository interface / impl (write side)                  | `.repository.ts`        |
| DAO interface / impl (read side)                          | `.dao.ts`               |
| Port — any other injectable contract                      | `.port.ts`              |
| Adapter — the implementation of a port                    | `.adapter.ts`           |
| Command (`CreateCharacterCommand`)                        | `.command.ts`           |
| Command handler (`CreateCharacterCommandHandler`)         | `.command-handler.ts`   |
| Query (`GetCharacterQuery`)                                | `.query.ts`             |
| Query handler (`GetCharacterQueryHandler`)                | `.query-handler.ts`     |
| Injectable pre-save check (needs a DB read)               | `.validator.ts`         |
| Domain service — orchestrates two aggregates              | `.service.ts`           |
| Controller                                                | `.controller.ts`        |
| DTO                                                       | `.dto.ts`               |
| Mapper (row ↔ domain, domain → DTO, wire format → domain) | `.mapper.ts`            |
| NestJS module                                             | `.module.ts`            |
| Drizzle schema                                            | `.schema.ts`            |
| Seeder                                                    | `.seeder.ts`            |
| Guard                                                     | `.guard.ts`             |
| Exception filter                                          | `.filter.ts`            |
| Interceptor                                               | `.interceptor.ts`       |
| Decorator                                                 | `.decorator.ts`         |
| Config                                                    | `.config.ts`            |
| CLI command (`entry-point/cli/`)                          | `.cli.ts`               |
| Standalone shared type alias                              | `.type.ts`              |
| Pure helper module (no state, no framework)               | `.util.ts`              |
| Test mock factory                                         | `.mock.ts`              |
| Architecture rule test (layer boundaries)                 | `.architecture.test.ts` |

### `packages/web`

| Concept                        | Suffix           |
| ------------------------------ | ---------------- |
| Page / route component         | `.page.tsx`      |
| React component                | `.component.tsx` |
| Hook                           | `.hook.ts`       |
| React Context store            | `.store.tsx`     |
| Pure helper module             | `.util.ts`       |
| Standalone shared type alias   | `.type.ts`       |
| Test mock factory              | `.mock.ts`       |
| Router / route-tree definition | `.router.ts`     |

## Retired suffixes

Each of these existed and was folded into something else. Reintroducing one is the same decision as
adding a new suffix.

| Gone            | Where it went              | Why                                                       |
| --------------- | -------------------------- | --------------------------------------------------------- |
| `.client.ts`    | `.port.ts` + `.adapter.ts` | An outbound API is a port like any other.                 |
| `.storage.ts`   | `.port.ts` + `.adapter.ts` | Same — blob storage is not a special category.            |
| `.interface.ts` | `.port.ts`                 | One word for "injectable contract".                       |
| `.reader.ts`    | `.mapper.ts`               | Parsing a wire format into domain objects **is** mapping. |
| `.loader.ts`    | inlined into `.seeder.ts`  | Only seeders read committed data files.                   |
| `.harness.ts`   | fixed-name setup files     | See below.                                                |
| `.fixture.json` | `.mock.ts` as typed code   | A committed JSON blob is untyped and unreviewable.        |
| `.msw.mock.ts`  | `api/generated`            | Orval generates MSW handlers; see architecture-web.md.    |
| `.use-case.ts`  | `.command.ts` + `.command-handler.ts` + `.query.ts` + `.query-handler.ts` | CQRS module adopted. |

**Test bootstrap has no suffix.** It lives in a small, fixed set of files whose names are part of the
standard, so a second one cannot be added by accident:

```
packages/api/src/config/database/integration-test.setup.ts
packages/web/src/test/render.setup.tsx
packages/web/vitest.setup.ts
```

## Where a script lives

Python and Node scripts sit outside the suffix rule — they are named by what they do
(`extract_trees.py`, `roadmap_sync.py`). What is standardised is **which folder owns them**:

| Folder                            | Owns                                             | Test                                                        |
| --------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| `.claude/skills/<skill>/scripts/` | a skill's own tooling                            | Nothing outside that skill runs or reads it                 |
| `scripts/`                        | repo tooling                                     | `make` invokes it, or `docs/` tells a human to run it       |
| `tools/<thing>/`                  | a self-contained artefact with its own lifecycle | It is installed or shipped somewhere, not run from the repo |

**A skill script is the narrow case, not the default.** `buildcode.py` and its `nodes.json` qualify:
only `tibia-idle-build` calls them. `roadmap_sync.py` does not — `make roadmap-sync` and
`make roadmap-check` run it, so it is repo tooling that a skill happens to invoke. Neither do
`extract_catalog.py`, `fetch_server_config.py` or `rank_hunts.py`, all documented for humans in
`docs/knowledge-base/README.md`.

A skill's `reference/` folder is **singular**, and holds the docs its `SKILL.md` loads on demand.

**Invoke every script from the repo root, by its root-relative path.** A `SKILL.md` that `cd`s into
its own folder makes every later `scripts/…` in that file ambiguous — the one bug this rule exists to
prevent.

**Known exception:** `scripts/extract_trees.py` writes
`.claude/skills/tibia-idle-build/scripts/nodes.json`, so a repo script owns a file inside a skill.
It is accepted, not accidental — `docs/explorations/06-retire-the-markdown-folders.md` records it as
a blocker. Do not add a second one.

## Resolved ambiguities

- **Ports and adapters, and the two exceptions.** An injectable contract is `x.port.ts` (interface +
  its `Symbol` token) and its implementation is `x.<tech>.adapter.ts` — `capture.port.ts` ←
  `capture.local.adapter.ts`, `baiak-game.port.ts` ← `baiak-game.http.adapter.ts`. **Repositories and
  DAOs are deliberately exempt**: they are the two contracts whose role is worth reading off the
  filename, so they keep `capture.repository.ts` ← `capture.drizzle.repository.ts`.
- **Components and pages use `.tsx`**, not `.ts` — they contain JSX. The suffix is unchanged.
- **Concrete implementations name their technology** and share the interface's base name, so the
  pair is obvious: `character.drizzle.repository.ts`, `capture.local.adapter.ts`.
- **Class names mirror the file**: `create-character.command-handler.ts` exports `CreateCharacterCommandHandler`.
  Interfaces are not prefixed with `I` — `CharacterRepository` is the interface,
  `DrizzleCharacterRepository` the implementation.
- **Lookup methods are always `find*` and always nullable.** `findById(): Promise<Capture | undefined>`,
  never `getById()` that throws. Whether a missing row is a 404 is the caller's decision, and the
  method name says so. `list*` for a collection that is legitimately empty.
- **DAOs are entity-shaped, not query-shaped**: one `character.dao.ts` exporting a `CharacterDao`
  with a method per read. Not one file and one DI token per query. Its return types are declared
  **inline in the same file** — a DAO can only return read models, so they do not earn a `.type.ts`.
- **Props types are declared inline** in the aggregate/entity/VO file they construct:
  `capture.aggregate.ts` exports `CapturePropsType` beside `Capture`.
- **`.type.ts` is for a standalone type shared by more than one file** — an external wire format, a
  cross-module shape. Anything owned by one class lives in that class's file.
- **DI tokens are `SCREAMING_SNAKE_CASE` `Symbol` constants declared beside their interface**:
  `export const CHARACTER_REPOSITORY = Symbol('CharacterRepository')` in
  `character.repository.ts`. Never a bare string, never a separate `tokens.ts`.
- **Generated code keeps its generator's filenames.** Drizzle migrations, Orval's output in
  `packages/web/src/api/generated/` and Shadcn components in `packages/web/src/shared/ui/` are
  written by a tool and re-derived on demand; renaming them would be undone on the next run. Every
  hand-written file obeys the suffix rule.
- **Entry-point files keep their tool's expected name** — `main.ts`, `main.tsx`, `vite.config.ts`.
  The build looks them up by name.
- **Barrel files (`index.ts`) are not used.** Import from the concrete path; it keeps the layer of an
  import visible at the call site.
