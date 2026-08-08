# Back-end stack — `packages/api`

The concrete choices that implement [architecture-api.md](architecture-api.md).
That doc says what the rules are; this one says what enforces them. Swapping a
library here should not require reopening that one.

## What is chosen

| Concern         | Choice                                        | Why this one                                                        |
| --------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| Framework       | NestJS with the Fastify adapter               | DI container the layering already needs; Fastify for Lambda cold start |
| ORM             | Drizzle                                       | SQL-shaped, no entity decorators leaking toward the domain          |
| Database        | Postgres, local via Docker Compose            | One engine everywhere, including tests                              |
| Request schemas | `class-validator` + `class-transformer`       | Shape and format only, at the boundary                              |
| API contract    | `@nestjs/swagger`                             | Generated from the code that serves it                              |
| Deploy          | SST v3, `@fastify/aws-lambda`                 | Lambda without a bespoke handler                                    |
| Tests           | Jest, `@testcontainers/postgresql`            | A real database for the integration tier                            |
| Lint            | oxlint                                        | Fast enough to encode the dependency rule as import bans            |

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
    lambda/               @fastify/aws-lambda handler
    cli/
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
  is banned by oxlint.

  **Known gap:** a per-class logger has no request scope, so lines from one
  request are not correlated by a `requestId`. The transaction interceptor's
  `AsyncLocalStorage` is the obvious place to also carry one when CloudWatch
  grepping gets painful — not a `LoggerPort` threaded through the domain.

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
| `pnpm --filter api build`  | `tsc` build — required before `sst deploy`, see gotcha 1 |

## Gotchas

Each of these cost real time. Read the symptom, apply the rule. Numbered, and
never renumbered — append.

### 1. SST/esbuild strips metadata reflection — build Nest first

**Symptom:** the Lambda deploys but Nest DI fails at runtime with unresolvable
dependencies, or `class-validator`/`class-transformer` silently stop validating.

**Cause:** SST bundles with esbuild, which does not emit `emitDecoratorMetadata`.

**Rule:** never point an SST function at TypeScript source. Build `packages/api`
with `tsc` (which does emit metadata), then point the Lambda handler at the
**compiled** entry-point:

```
packages/api/dist/entry-point/lambda/main.js   ← handler target
```

The SST function is a thin `index` re-exporting that built handler.
`pnpm --filter api build` must run before `sst deploy`.

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
Lambda, discovered in production.

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
