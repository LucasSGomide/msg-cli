# Back-end architecture — `packages/api`

Stack: NestJS (Fastify adapter), Drizzle ORM, local Postgres via Docker Compose, class-validator + class-transformer,
`@nestjs/swagger`, SST v3 for deploy, `@testcontainers/postgresql` for integration tests.

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

## Dependency rule

```
entry-point ─┐
             ├─→ application ─→ domain
infrastructure ┘                  ↑
                       (infrastructure also implements domain/ + application/ interfaces)
```

- `domain/` imports nothing from other layers. No Nest decorators, no Drizzle, no DTOs.
- `application/` imports `domain/` only. No Nest decorators, no Drizzle, no DTOs.
- **One deliberate exception, both layers:** the exception classes from `@nestjs/common`
  (`NotFoundException`, `ConflictException`, …) may be imported and thrown anywhere. See
  [Errors](#errors) — this is a chosen trade, not an oversight.
- `entry-point/` and `infrastructure/` are the only layers that know about frameworks.
- `config/modules/` binds interfaces to implementations. Each interface declares its own DI token as
  a `Symbol` constant **in the same file as the interface**, named in `SCREAMING_SNAKE_CASE`:

  ```ts
  // domain/repository/character.repository.ts
  export const CHARACTER_REPOSITORY = Symbol('CharacterRepository');
  export interface CharacterRepository { … }
  ```

  The token cannot be imported without the contract being visible at the same import site.

### How the rule is enforced

The dependency rule is not a convention — `packages/api/.oxlintrc.json` encodes it as per-layer
`no-restricted-imports` overrides, and every violation names its gotcha in the error message:

| Layer               | May not import                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `domain/**`         | Drizzle, `pg`, `config/database/**`, any other layer, any `@nestjs/*` except `@nestjs/common` |
| `application/**`    | Drizzle, `pg`, `config/database/**`, `entry-point/**`, `infrastructure/**`, another use case  |
| `infrastructure/**` | `entry-point/**`                                                                              |

`process.env` is a `no-restricted-properties` error everywhere except `config/environment.config.ts`
(gotcha #6). Test and mock files opt out of both — they legitimately reach across layers.

The one rule oxlint cannot express is gotcha #3's _mapping_ requirement, which is why
`domain/persistence-isolation.architecture.test.ts` exists alongside it.

`make check` runs this plus format, typecheck, build and both test suites.

## The canonical request flow

Every write endpoint looks like this. Deviating from it is a design decision, not a shortcut.

```
HTTP request
  → DTO                       class-validator + @ApiProperty; shape and format only
  → controller                validates, authorises, calls ONE use case. No logic.
  → use case                  repository.findX() → aggregate methods → repository.save()
  → aggregate                 every invariant lives here
  → repository.save()         upsert; maps domain → rows inside
  → mapper                    domain → response DTO
  → HTTP response
```

Rules:

- One use case per file, one public method (`execute`).
- The controller's whole job is request validation, authorisation and delegation. If a controller
  contains an `if` about domain state, it is in the wrong place.
- **Never import a use case from another use case.** If two commands must run together, that is a
  domain service (below) — or, if it is genuinely asynchronous, a new pattern to be agreed first.
- Validation that needs a database read (uniqueness, existence of a referenced row) cannot be decided
  from the aggregate's own state. Extract it into an `@Injectable()` `.validator.ts` in
  `application/write/`, injected into the use case: `character-name-available.validator.ts`. **This
  is the sanctioned place for a write path to touch a DAO.** The use case stays one public method;
  the validator is independently testable and reusable across commands.
- A write use case may also read a DAO to hydrate data an aggregate needs but does not own. Prefer
  not to: if the aggregate needs it to be correct, it usually belongs in the aggregate's own load.

### Domain services

`domain/service/*.service.ts` exists for **one** case: an operation that spans two aggregates, where
introducing domain events would cost more than it buys. It takes the aggregates as arguments and
returns the result; it does not persist, and it does not call another service. That narrow charter is
the whole reason the suffix survives — a `.service.ts` that computes something for a single aggregate
belongs in that aggregate, and one that just holds use-case code belongs in the use case.

## Read path (queries)

Queries bypass the domain entirely: DAO interfaces in `application/dao/`, implemented in
`infrastructure/dao/` with Drizzle queries returning read models shaped for the response. **Never
load an aggregate to serve a read.**

**A controller may call a DAO directly when the call is a pure pass-through** — no composition, no
shaping, no combining. The moment anything is derived from the result, an `application/read` use case
appears and the controller stops seeing the DAO. This is the one asymmetry with the write side, and
it is deliberate: a class that only forwards a call is not a design, it is a file.

## The repository / DAO standard

The two sides of persistence answer to opposite rules, and both are enforced by
`domain/persistence-isolation.architecture.test.ts`:

- **A repository is the write side, and its whole API is the aggregate.** Every method takes and
  returns aggregates and value objects — never a surrogate id, never a `*ReadModel`. `save(capture)`
  is an **upsert**: the caller never chooses between insert and update. `findBySha256(): Capture |
undefined`, `findAll(): Capture[]`, `softDelete(capture)` are all fine — any method that speaks in
  aggregates may exist. Keep them few: a finder that exists to serve one screen is a DAO method
  wearing the wrong suffix.
- **A DAO is the read side, and it owes no aggregate.** Its methods return read-model shapes only,
  declared inline in the `.dao.ts`, never an aggregate or an entity. Surrogate ids are legal
  _inputs_ — `findReport(captureId)` is exactly what the read side is for. The DAO is where a
  bespoke shape is allowed, precisely so the repository never grows one.
- **Mapping in both directions is the repository's job**, in its `.mapper.ts`. Resolving what the
  aggregate carries onto rows (`huntGameKey` → a `hunt` row, a vocation → a `character` row) is
  driven by what the aggregate carries, never by ids passed in from the use case.

A row-writer keyed by a parent id (`saveX(parentId, rows)`) is the shape this rule exists to stop:
it forces the caller to carry the ids and row shapes the aggregate should own. The fix for a failure
is always moving the method, never adding an exemption.

## Transactions

A transaction is **per request**, not per repository call. A Nest interceptor opens a Drizzle
transaction, stores it in an `AsyncLocalStorage`, and commits or rolls back when the handler settles.
Repositories and DAOs resolve their handle from that store rather than from an injected `db`, so no
use case, repository signature or test ever mentions a transaction.

Entry-points without a request open their own: `entry-point/cli/*.cli.ts` wraps its work in the same
helper the interceptor uses. This is the known cost of the choice — the CLI is on its own, and
forgetting the wrapper means autocommit per statement.

Aggregates remain the consistency boundary in the domain sense: one command mutates one aggregate.
The request-scoped transaction is what makes the write _durable_ as a unit, not a licence to mutate
three aggregates in a handler.

## Domain object shape

Aggregates, entities and value objects are all built the same way.

```ts
export type CapturePropsType = {
  id?: number;
  sha256: string;
  startedAt: Date;
  events?: CombatEventPropsType[];
};

export class Capture {
  public readonly id: number | undefined;
  public readonly sha256: string;

  private _endedAt: Date | undefined;
  private _events: CombatEvent[];

  get endedAt(): Date | undefined {
    return this._endedAt;
  }

  get events(): ReadonlyArray<CombatEvent> {
    return this._events;
  }

  private constructor(props: CapturePropsType) { … }

  static create(props: CapturePropsType): Capture {
    if (!props.sha256) {
      throw new BadRequestException('Capture sha256 is required');
    }
    return new Capture(props);
  }

  close(endedAt: Date): void { … }
}
```

Hard rules:

- **Private constructor, static `create(props)`.** Every rule that decides whether the object may
  exist lives in `create`.
- **`create` is also how the object comes back from the database.** There is no `restore()` /
  `fromPersistence()` — the props type carries `id`, `createdAt` and friends as optional fields and
  the mapper passes them in. Cost, stated once: creation rules re-run on every load, so a rule that
  can only be true at creation time (and not of already-stored rows) does not belong in `create`.
- **`public readonly` for identity and immutable facts; `private _x` + a getter for anything that
  changes.** Never a public setter.
- **Collections are exposed as `ReadonlyArray<T>`.** Mutating them is the aggregate's job.
- **Mutators are intention-named and return `void`**: `close()`, `addMember()`, `changeMemberRole()`.
  Not `setEndedAt()`. Shared bookkeeping goes in a private `_touch()`; shared checks in a private
  `_validateX()`.
- **Entities are mutated only through their aggregate.** A use case calls
  `organization.updateMemberLastActivity(id)`, never `member.updateLastActivity()`. Mappers are the
  one exception — they may construct and populate entities directly, because rebuilding stored state
  is exactly their job.
- **Value objects expose meaning-named getters**, not a generic `.value`. A VO with one field still
  names it (`.amount`, `.percentage`) so multi-field VOs need no different rule.

## Errors

There is **no custom error base class and no shared error package.** Throw the built-in
`@nestjs/common` HTTP exceptions, from any layer including `domain/`.

```ts
// domain/aggregate/character.aggregate.ts
if (this.level < requirement) {
  throw new BadRequestException('Character level too low for this equipment');
}
```

Why this over the usual `ApiError` + `ErrorTypeEnum` + custom filter stack: one API, one HTTP
entry-point, and the built-ins already carry the status code and serialise correctly. A parallel
error hierarchy would exist only to be mapped back onto the one it replaced.

What it costs, stated so nobody rediscovers it:

- HTTP status codes are now baked into domain rules. A future CLI or Lambda-event entry-point
  inherits vocabulary it has no use for.
- The front-end discriminates on **status code plus message**, not on a stable `type` field. If a
  screen ever needs targeted per-error feedback, that is the moment to revisit this decision — not a
  reason to hand-roll a `type` field onto one endpoint.

Rules that still hold:

- A `GlobalExceptionFilter` in `entry-point/http/filters/` catches everything that is _not_ an
  `HttpException`, logs it with the stack, and returns a bare `500`. Internal details never reach a
  response body.
- `infrastructure/` never throws domain-meaningful errors. Catch the Drizzle/driver exception, log
  it with the query context, rethrow as `InternalServerErrorException`. A unique-constraint violation
  surfacing as a `409` is the _use case's_ decision, made from a prior read — not the repository's.
- Every controller route declares its error responses with `@ApiResponse`, so the generated Orval
  client knows the shape.

## Logging

Nest's `Logger` is **constructed where it is used** — not injected, and not abstracted behind a port:

```ts
private readonly logger = new Logger(CreateCharacterUseCase.name);
```

Injection buys testability we do not need (a logger call is not an assertion) at the cost of a
constructor parameter in every class. Same reasoning as the errors section: skip the indirection
until something demands it.

Hard rules:

- **`console.log` / `console.error` are banned.** Oxlint enforces it.
- Context is always a **structured object**, never interpolated into the message. The message is a
  constant string; the variables are data.

  ```ts
  // ✅
  this.logger.error('Failed to persist character', { characterId, error });
  // ❌
  this.logger.error(`Failed to persist character ${characterId}: ${error.message}`);
  ```

- Log at **boundaries only** — request in/out, external calls, persistence failures, fallback paths.
  Never inside a loop (log one summary after), never in getters or trivial mappers.
- Never log credentials, tokens or session data.
- Levels: `debug` local-only diagnostics, `info` completion of meaningful work, `warn` handled-but-
  unexpected, `error` operation failed (always pass the error object so the stack survives).

**Known gap:** a per-class `new Logger()` has no request scope, so lines from one request are not
correlated by a `requestId`. The transaction interceptor's `AsyncLocalStorage` is the obvious place
to also carry a `requestId` when CloudWatch grepping gets painful — not a `LoggerPort` threaded
through the domain.

## Persistence

- Drizzle schemas in `config/database/schemas/` are **infrastructure**. Domain entities are separate
  classes; repositories/DAOs do the mapping both ways (see gotcha #3).
- Migrations are generated by Drizzle and committed. Never edit an applied migration.
- Seeders read whatever committed data they need directly — there is no loader indirection.

## Testing

Everything is tested. The file's role decides the tier, and there is no negotiating it:

| Under test                                  | Tier        | How                                                                                                        |
| ------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| Aggregates, entities, value objects         | unit        | Own static factory, **no mocks at all**                                                                    |
| Use cases                                   | unit        | `Test.createTestingModule` with `jest.Mocked` bound to the real DI tokens — the test proves the wiring too |
| Validators, domain services, mappers, utils | unit        | Plain construction                                                                                         |
| Repositories, DAOs, adapters                | integration | Real Postgres via `@testcontainers/postgresql`                                                             |
| Controllers                                 | integration | Through the real Nest app in the test container                                                            |

- Mock factories live in colocated `.mock.ts` files. Committed expected-output blobs are typed
  `.mock.ts` code, never JSON.
- Integration files are suffixed `.integration.test.ts` and share one container per Jest worker via
  `config/database/integration-test.setup.ts`.
- Controllers get **no** unit tests. A unit-tested controller only proves its mocks.

The `/api-test` skill is the full standard: `makeSut` factories, mock naming and placement, the
read/write split, and the setup contract.

## OpenAPI

Every controller route declares response types, status codes and error responses; every DTO property
has `@ApiProperty`. Enums always pass `enumName` (gotcha #2) — the generated Orval client in
`packages/web` depends on it.

Because gotcha #2 is violated by copy-paste more than by ignorance, **every exposed enum is wrapped
once** in `entry-point/http/decorator/api-enums.decorator.ts` and DTOs use the wrapper, never a raw
`@ApiProperty({ enum })`:

```ts
export const ApiVocationProperty = () =>
  applyDecorators(ApiProperty({ enum: Vocation, enumName: 'Vocation' }), IsEnum(Vocation));
```

The same applies to any `@ApiProperty` + `class-validator` pairing repeated across more than one DTO
— define the composite in `entry-point/http/decorator/api-properties.decorator.ts` instead.

Response DTOs are built by a `.mapper.ts` in `entry-point/http/mapper/`, not inline in the controller
and not by a static method on the DTO. One mapper per resource, both directions if the request side
needs one.
