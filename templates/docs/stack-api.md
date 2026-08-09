# Back-end stack — `packages/api`

The concrete choices that implement [architecture-api.md](architecture-api.md).
That doc says what the rules are; this one says what enforces them. Swapping a
library here should not require reopening that one.

## What is chosen

| Concern         | Choice                                        | Why this one                                                          |
| --------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| Framework       | NestJS with the Fastify adapter               | DI container the layering already needs; Fastify for throughput and its plugin set |
| ORM             | Drizzle                                       | SQL-shaped, no entity decorators leaking toward the domain            |
| Database        | Postgres, local via Docker Compose            | One engine everywhere, including tests                                |
| Email           | An `EmailPort` with a provider adapter        | Transactional sends behind a contract; the port is the seam a queue plugs into later |
| Request schemas | `class-validator` + `class-transformer`       | Shape and format only, at the boundary                                |
| API contract    | `@nestjs/swagger`                             | Generated from the code that serves it                                |
| Tests           | Jest, `@testcontainers/postgresql`            | A real database for the integration tier                              |
| Lint            | oxlint                                        | Fast enough to encode the dependency rule as import bans              |

Deployment is deliberately **not chosen yet** — see [Known gaps](#known-gaps).
Auth is its own area: if this project has sessions and guards, `docs/auth.md`
holds them, and nothing in this doc assumes a caller has an identity.

## Layout

```
src/
  application/
    read/                 query use cases      → depend on DAO interfaces
    write/                command use cases    → depend on repository interfaces
    dao/                  DAO interfaces (read contracts)
    port/                 every other injectable contract (*.port.ts)
  config/
    database/
      migrations/         drizzle migrations (generated, committed)
      schemas/            drizzle table schemas
      seeders/
    modules/              NestJS modules (wiring / providers)
  domain/
    aggregate/
    entity/
    value-object/
    service/              domain services (two-aggregate orchestration only)
    repository/           repository interfaces (write contracts)
  entry-point/
    http/
      controller/
      decorator/           composite @ApiProperty / enum decorators
      dto/
      mapper/              domain → response DTO
      guards/
      filters/
      interceptors/
      middleware/          request-id, then the transaction interceptor
    cli/                   one-off tasks, incl. running migrations
  infrastructure/
    dao/                  concrete DAOs (Drizzle)
    repository/           concrete repositories (Drizzle)
    adapter/              concrete ports (*.adapter.ts)
```

## How the dependency rule is enforced

`packages/api/.oxlintrc.json` encodes it as per-layer `no-restricted-imports`
overrides, and every violation names its gotcha in the error message:

| Layer               | May not import                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `domain/**`         | Drizzle, `pg`, `config/database/**`, any other layer, any `@nestjs/*` except `@nestjs/common` |
| `application/**`    | Drizzle, `pg`, `config/database/**`, `entry-point/**`, `infrastructure/**`, another use case  |
| `infrastructure/**` | `entry-point/**`                                                                              |

`process.env` is a `no-restricted-properties` error everywhere except
`config/environment.config.ts`. Test and mock files opt out of both — they
legitimately reach across layers.

The one rule oxlint cannot express is the domain/persistence mapping requirement,
which is why `domain/persistence-isolation.architecture.test.ts` exists alongside
it.

## Mechanisms

- **DI tokens** are `Symbol` constants in `SCREAMING_SNAKE_CASE`, declared in the
  same file as the interface:

  ```ts
  // domain/repository/character.repository.ts
  export const CHARACTER_REPOSITORY = Symbol('CharacterRepository');
  export interface CharacterRepository { … }
  ```

- **Transactions** are opened by a Nest interceptor, which starts a Drizzle
  transaction and stores it in an `AsyncLocalStorage`, committing or rolling back
  when the handler settles. `entry-point/cli/*.cli.ts` wraps its work in the same
  helper.
- **Errors** are the `@nestjs/common` HTTP exceptions
  (`NotFoundException`, `ConflictException`, `BadRequestException`, …). The
  catch-all is `entry-point/http/filters/global-exception.filter.ts`.
- **Logging** is `new Logger(SomeClass.name)`, constructed per class. `console.*`
  is banned by oxlint. Every line carries a `requestId` — see below.

## Structured logs and the request id

Logs are JSON with a correlation id, and nothing more elaborate than that until
there is traffic worth measuring.

- `entry-point/http/middleware/request-id.middleware.ts` runs **before** the
  transaction interceptor. It takes the inbound `x-request-id` if there is one and
  generates a UUID otherwise, stores it in the same `AsyncLocalStorage` the
  transaction uses, and echoes it back on the response header.
- A small logger wrapper reads the id from the store and merges it into the
  context object, so no class signature changes and no `LoggerPort` is threaded
  through the domain.
- Entry-points without a request (`cli/`) generate their own id with the same
  helper, exactly as they open their own transaction.
- On a managed runtime, log the platform's own request id in the same line — one
  field each, never one overwriting the other.

The web package sends a fresh `x-request-id` per request, so a browser report and
a server log line meet on the same value. Error tracking, metrics and tracing are
an open decision — [Known gaps](#known-gaps).

## Email

An `EmailPort` in `application/port/`, with the provider adapter in
`infrastructure/adapter/` and a capture adapter used by dev and tests. Everything
that sends resolves the port — nothing imports a provider SDK directly.

Sends are **inline in the request** for now. That is a known cost: a slow or
failing provider slows or fails the request that triggered it. The port is the
seam a queue plugs into, and the trigger for adding one is the first send that is
not a direct consequence of a user action (digests, exports, retries).

## Pagination

Every list endpoint uses the **same cursor envelope** — one DTO, one DAO
signature, no per-endpoint invention:

```ts
export class PageResponseDto<T> {
  items!: T[];
  nextCursor!: string | null; // null = end of the list
}
```

- The DAO takes `{ cursor?: string; limit: number }` and returns the same shape.
  The cursor is opaque to the client and encodes the sort key plus the id
  tiebreaker — never a raw offset.
- `limit` has a documented default and a hard maximum, validated at the boundary.
- Cursor, not offset: pages stay stable while rows are being inserted, and there
  is no counting query. Jump-to-page is the thing given up; if a screen genuinely
  needs it, that is a new decision, not a new response shape.
- Note the generic: `PageResponseDto<T>` needs `@ApiExtraModels` +
  `getSchemaPath` to appear correctly in the spec, or Orval generates `unknown`
  for `items`.

## Persistence

Drizzle schemas live in `config/database/schemas/`, migrations in
`config/database/migrations/`, seeders in `config/database/seeders/`. Migrations
are generated by Drizzle and committed.

## OpenAPI

Enums always pass `enumName` (gotcha 2), and **every exposed enum is wrapped
once** in `entry-point/http/decorator/api-enums.decorator.ts`. DTOs use the
wrapper, never a raw `@ApiProperty({ enum })`:

```ts
export const ApiVocationProperty = () =>
  applyDecorators(ApiProperty({ enum: Vocation, enumName: 'Vocation' }), IsEnum(Vocation));
```

The same applies to any `@ApiProperty` + `class-validator` pairing repeated across
more than one DTO — define the composite in
`entry-point/http/decorator/api-properties.decorator.ts` instead.

Response DTOs are built by a `.mapper.ts` in `entry-point/http/mapper/`.

## Testing tooling

- Jest, with `Test.createTestingModule` and `jest.Mocked` for the use-case tier.
- Integration files are suffixed `.integration.test.ts` and share one
  `@testcontainers/postgresql` container per Jest worker via
  `config/database/integration-test.setup.ts`.
- Mock factories live in colocated `.mock.ts` files.

## Commands

| Command                    | What it does                                            |
| -------------------------- | ------------------------------------------------------- |
| `make check`               | format, typecheck, lint, build and both test suites      |
| `make check-fast`          | the subset that does not need a container                |
| `make api-openapi`         | regenerate the committed contract                        |
| `pnpm --filter api build`  | `tsc` build — see gotcha 1 before swapping the bundler   |

## Known gaps

Deliberately unanswered, with the condition that reopens each one. Listed so a
gap is not mistaken for an oversight and improvised around in a hurry.

| Gap                         | Intended direction when it comes up                                        | Trigger                                     |
| --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| Deployment / hosting        | Undecided. Nothing in the code assumes a target — see gotcha 1 before choosing a bundler-based one | First deploy                                |
| Background jobs             | A queue behind the existing ports; `entry-point/queue/` beside http and cli | First send or write not caused by a request |
| Observability tooling       | Structured logs + requestId are in place; error tracking, metrics and tracing are unresearched | First incident nobody can reconstruct       |
| Rate limiting and hardening | `@fastify/rate-limit` with a shared store (not in-memory), `@fastify/helmet`, a Fastify `bodyLimit` | First public deploy — do not skip this one  |
| File upload / blob storage  | Presigned URLs through a `FileStoragePort`; bytes never pass through the API | First avatar or attachment                  |

## Gotchas

Each of these cost real time. Read the symptom, apply the rule. Numbered, and
never renumbered — append.

### 1. Never bundle Nest with esbuild — it strips metadata reflection

**Symptom:** the app starts but Nest DI fails at runtime with unresolvable
dependencies, or `class-validator`/`class-transformer` silently stop validating.
Everything works when run from source.

**Cause:** esbuild does not implement `emitDecoratorMetadata`, and Nest's DI,
`class-validator` and `@nestjs/swagger` all read that metadata. Any esbuild-based
packager inherits this — tsup, Vite's SSR build, and the deploy frameworks built
on it (this is what cost the time on SST specifically).

**Rule:** `packages/api` is built by `tsc`, which does emit the metadata, and
anything that runs it points at the **compiled** output:

```
packages/api/dist/entry-point/http/main.js
```

If a future deploy target wants to bundle, it re-exports the `tsc` output — it
never points at TypeScript source. `pnpm --filter api build` runs first, always.

### 2. Always set `enumName` on exposed enums

**Symptom:** Orval generates `CharacterResponseDtoVocation`,
`CreateCharacterDtoVocation`, `GetCharacter200Vocation`… — one duplicate enum per
usage site, and no shared type between them.

**Rule:** every `@ApiProperty({ enum: X })` passes `enumName`, and **the same enum
uses the same `enumName` everywhere**:

```ts
@ApiProperty({ enum: Vocation, enumName: 'Vocation' })
vocation!: Vocation;
```

Mismatched or missing `enumName` is a review blocker, not a nit.

### 3. Domain entities are never the DB schema

**Symptom:** the domain grows nullable fields, public setters, surrogate ids and
ORM decorators to satisfy the database.

**Rule:** Drizzle schemas live in `config/database/schemas/`; domain
entities/aggregates live in `domain/` with no persistence awareness. Repositories
map between them (`*.mapper.ts`). Mapping code is cheap; a domain shaped by its
tables is not.

### 4. A use case never imports another use case

**Symptom:** transaction boundaries blur, one command silently triggers three
others, tests need half the container.

**Rule:** `application/**` files must not import from `application/read` or
`application/write` siblings. If a flow needs multiple commands, that
orchestration is a **new pattern to be agreed first** (domain event, saga, or an
explicit orchestrator layer) — do not improvise it inline.

### 5. Typed config module from day one

**Symptom:** `process.env.SOMETHING` scattered across the codebase, undefined in
the deployed environment, discovered in production.

**Rule:** `config/environment.config.ts` reads and **validates** the environment
once at startup with `class-validator` and exports a typed object, failing fast on
a missing var. No `process.env` access outside it. The web package has its own
version of this rule — see [stack-web.md](stack-web.md).

### 6. A nullable `@ApiProperty` must state its `type`

**Symptom:** a nullable string arrives on the web side as
`{ [key: string]: unknown } | null`, and every use of it fails the typecheck with
"not assignable to `ReactNode`" or "not assignable to `string`".

**Rule:** `nullable: true` alone makes Nest emit `"type": "object"` — its default
— because the reflected TypeScript type is `string | null`, not `string`. Orval
faithfully turns that into an index-signature object. Always pass `type` (and
`format` for a date) beside `nullable`:

```ts
@ApiProperty({ type: String, format: 'date-time', nullable: true })
endedAt!: Date | null;
```

A nullable property whose type is another DTO already works, because
`type: SomeDto` is spelled out.

### 7. `enableCors` under Fastify allows only GET, HEAD and POST

**Symptom:** a new `PATCH` or `DELETE` route fails in the browser with "Failed to
fetch". Nothing reaches a controller, nothing appears in the API's log, and `curl`
against the same route works perfectly — because `curl` sends no preflight.

**Rule:** Nest's documented CORS default covers every verb, but under Fastify
`app.enableCors()` delegates to `@fastify/cors`, whose own default is
`GET,HEAD,POST`. Passing only `origin` leaves that default in place, so the
browser refuses the preflight before the request is ever sent.

Pass the whole options object from `cors.util.ts`, never just the origins:

```ts
app.enableCors(corsOptions(config.get('WEB_ORIGIN', { infer: true })));
```

`ALLOWED_METHODS` is checked against every method in the committed `openapi.json`,
so a route added with a verb nobody thought about fails `cors.util.test.ts`
instead of failing in a browser.

**Diagnosing it:** the preflight tells you directly —

```
curl -i -X OPTIONS http://127.0.0.1:3000/<route> \
  -H 'Origin: http://localhost:5173' -H 'Access-Control-Request-Method: PATCH'
```

If `access-control-allow-methods` comes back missing the verb, this is the bug.
