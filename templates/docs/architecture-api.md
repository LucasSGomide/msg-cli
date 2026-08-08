# Back-end architecture

The rules a back-end obeys, stated without naming a library. What implements them
— framework, ORM, test runner, the concrete folder tree — lives in
[stack-api.md](stack-api.md), so the stack can be swapped without renegotiating
the design.

Four layers. `domain` holds the rules, `application` orchestrates them,
`entry-point` translates the outside world in, `infrastructure` translates it
out.

## Dependency rule

```
entry-point ─┐
             ├─→ application ─→ domain
infrastructure ┘                  ↑
                       (infrastructure also implements domain/ + application/ interfaces)
```

- `domain/` imports nothing from another layer. No framework decorators, no ORM,
  no transport types.
- `application/` imports `domain/` only, under the same restrictions.
- **One deliberate exception, both layers:** the framework's HTTP exception
  classes may be imported and thrown anywhere. See [Errors](#errors) — a chosen
  trade, not an oversight.
- `entry-point/` and `infrastructure/` are the only layers that know about
  frameworks.
- Interfaces are bound to implementations in one wiring layer. **Each interface
  declares its own DI token beside the interface, in the same file**, so the
  token cannot be imported without the contract being visible at the same import
  site.

The rule is lint-enforced per layer rather than left to review, and every
violation names the gotcha it protects. The one part a linter cannot express is
the domain/persistence mapping requirement, which gets a dedicated architecture
test.

## The canonical request flow

Every write endpoint looks like this. Deviating from it is a design decision, not
a shortcut.

```
request
  → request schema            shape and format only
  → controller                validates, authorises, calls ONE use case. No logic.
  → use case                  repository.findX() → aggregate methods → repository.save()
  → aggregate                 every invariant lives here
  → repository.save()         upsert; maps domain → rows inside
  → mapper                    domain → response shape
  → response
```

Rules:

- One use case per file, one public method (`execute`).
- The controller's whole job is request validation, authorisation and delegation.
  If a controller contains an `if` about domain state, it is in the wrong place.
- **Never import a use case from another use case.** If two commands must run
  together, that is a domain service — or, if it is genuinely asynchronous, a new
  pattern to be agreed first.
- Validation needing a database read (uniqueness, existence of a referenced row)
  cannot be decided from the aggregate's own state. Extract it into an injectable
  validator in the write layer and inject it into the use case. **This is the
  sanctioned place for a write path to touch a DAO.** The use case stays one
  public method; the validator is independently testable and reusable.
- A write use case may also read a DAO to hydrate data an aggregate needs but
  does not own. Prefer not to: if the aggregate needs it to be correct, it
  usually belongs in the aggregate's own load.

### Domain services

A domain service exists for **one** case: an operation spanning two aggregates,
where introducing domain events would cost more than it buys. It takes the
aggregates as arguments and returns the result; it does not persist, and it does
not call another service.

That narrow charter is the whole reason the name survives. A service that
computes something for a single aggregate belongs in that aggregate, and one that
just holds use-case code belongs in the use case.

## Read path (queries)

Queries bypass the domain entirely: DAO interfaces in the application layer,
implemented in infrastructure, returning read models shaped for the response.
**Never load an aggregate to serve a read.**

**A controller may call a DAO directly when the call is a pure pass-through** —
no composition, no shaping, no combining. The moment anything is derived from the
result, a read use case appears and the controller stops seeing the DAO. This is
the one asymmetry with the write side, and it is deliberate: a class that only
forwards a call is not a design, it is a file.

## The repository / DAO standard

The two sides of persistence answer to opposite rules, and both are enforced by
an architecture test rather than by review:

- **A repository is the write side, and its whole API is the aggregate.** Every
  method takes and returns aggregates and value objects — never a surrogate id,
  never a read model. `save(x)` is an **upsert**: the caller never chooses
  between insert and update. Any method that speaks in aggregates may exist. Keep
  them few — a finder that exists to serve one screen is a DAO method wearing the
  wrong suffix.
- **A DAO is the read side, and it owes no aggregate.** Its methods return
  read-model shapes only, declared inline, never an aggregate or an entity.
  Surrogate ids are legal _inputs_ — that is exactly what the read side is for.
  The DAO is where a bespoke shape is allowed, precisely so the repository never
  grows one.
- **Mapping in both directions is the repository's job.** Resolving what the
  aggregate carries onto rows is driven by what the aggregate carries, never by
  ids passed in from the use case.

A row-writer keyed by a parent id (`saveX(parentId, rows)`) is the shape this rule
exists to stop: it forces the caller to carry the ids and row shapes the aggregate
should own. The fix for a failure is always moving the method, never adding an
exemption.

## Transactions

A transaction is **per request**, not per repository call. It is opened once at
the entry-point, carried in ambient context, and resolved by repositories and
DAOs from that context rather than from an injected handle — so no use case, no
repository signature and no test ever mentions a transaction.

Entry-points without a request open their own, using the same helper. This is the
known cost of the choice: those entry-points are on their own, and forgetting the
wrapper means autocommit per statement.

Aggregates remain the consistency boundary in the domain sense: one command
mutates one aggregate. The request-scoped transaction is what makes the write
_durable_ as a unit, not a licence to mutate three aggregates in a handler.

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

- **Private constructor, static `create(props)`.** Every rule that decides whether
  the object may exist lives in `create`.
- **`create` is also how the object comes back from the database.** There is no
  `restore()` / `fromPersistence()` — the props type carries `id`, `createdAt` and
  friends as optional fields and the mapper passes them in. Cost, stated once:
  creation rules re-run on every load, so a rule that can only be true at creation
  time does not belong in `create`.
- **`public readonly` for identity and immutable facts; `private _x` plus a getter
  for anything that changes.** Never a public setter.
- **Collections are exposed as `ReadonlyArray<T>`.** Mutating them is the
  aggregate's job.
- **Mutators are intention-named and return `void`**: `close()`, `addMember()`,
  `changeMemberRole()`. Not `setEndedAt()`. Shared bookkeeping goes in a private
  `_touch()`; shared checks in a private `_validateX()`.
- **Entities are mutated only through their aggregate.** A use case calls
  `organization.updateMemberLastActivity(id)`, never `member.updateLastActivity()`.
  Mappers are the one exception — rebuilding stored state is exactly their job.
- **Value objects expose meaning-named getters**, not a generic `.value`. A VO
  with one field still names it (`.amount`, `.percentage`) so multi-field VOs need
  no different rule.

## Errors

There is **no custom error base class and no shared error package.** Throw the
framework's built-in HTTP exceptions, from any layer including `domain/`.

Why this over the usual `ApiError` + `ErrorType` + custom filter stack: one API,
one HTTP entry-point, and the built-ins already carry the status code and
serialise correctly. A parallel error hierarchy would exist only to be mapped back
onto the one it replaced.

What it costs, stated so nobody rediscovers it:

- HTTP status codes are now baked into domain rules. A future non-HTTP
  entry-point inherits vocabulary it has no use for.
- The client discriminates on **status code plus message**, not on a stable `type`
  field. If a screen ever needs targeted per-error feedback, that is the moment to
  revisit this decision — not a reason to hand-roll a `type` field onto one
  endpoint.

Rules that still hold:

- A global exception filter catches everything that is _not_ an HTTP exception,
  logs it with the stack, and returns a bare `500`. Internal details never reach a
  response body.
- `infrastructure/` never throws domain-meaningful errors. Catch the driver
  exception, log it with the query context, rethrow as an internal server error. A
  unique-constraint violation surfacing as a `409` is the _use case's_ decision,
  made from a prior read — not the repository's.
- Every route declares its error responses, so the generated client knows the
  shape.

## Logging

A logger is **constructed where it is used** — not injected, and not abstracted
behind a port. Injection buys testability we do not need (a logger call is not an
assertion) at the cost of a constructor parameter in every class. Same reasoning
as the errors section: skip the indirection until something demands it.

Hard rules:

- **`console.*` is banned**, and lint-enforced.
- Context is always a **structured object**, never interpolated into the message.
  The message is a constant string; the variables are data.

  ```ts
  // ✅
  this.logger.error('Failed to persist character', { characterId, error });
  // ❌
  this.logger.error(`Failed to persist character ${characterId}: ${error.message}`);
  ```

- Log at **boundaries only** — request in/out, external calls, persistence
  failures, fallback paths. Never inside a loop (log one summary after), never in
  getters or trivial mappers.
- Never log credentials, tokens or session data.
- Levels: `debug` local-only diagnostics, `info` completion of meaningful work,
  `warn` handled-but-unexpected, `error` operation failed (always pass the error
  object so the stack survives).

## Persistence

- Database schemas are **infrastructure**. Domain entities are separate classes;
  repositories and DAOs map both ways.
- Migrations are generated and committed. **Never edit an applied migration.**
- Seeders read whatever committed data they need directly — there is no loader
  indirection.

## Testing

Everything is tested. The file's role decides the tier, and there is no
negotiating it:

| Under test                                  | Tier        | How                                                                     |
| ------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| Aggregates, entities, value objects         | unit        | Own static factory, **no mocks at all**                                 |
| Use cases                                   | unit        | Mocks bound to the real DI tokens — the test proves the wiring too      |
| Validators, domain services, mappers, utils | unit        | Plain construction                                                      |
| Repositories, DAOs, adapters                | integration | Against a real database                                                 |
| Controllers                                 | integration | Through the real application                                            |

- Mock factories live in colocated files beside what they mock. Committed
  expected-output blobs are typed code, never JSON.
- Integration tests share one database container per test worker.
- Controllers get **no** unit tests. A unit-tested controller only proves its
  mocks.

## The API contract

The contract is generated from the code, and the client from the contract. Every
route declares its response types, status codes and error responses; every
exposed property is documented.

Response shapes are built by a dedicated mapper, not inline in the controller and
not by a static method on the response type. One mapper per resource, both
directions if the request side needs one.
