# Gotchas

Each of these cost real time. Read the symptom, apply the rule.

## 1. SST/esbuild strips metadata reflection — build Nest first

**Symptom:** the Lambda deploys but Nest DI fails at runtime with unresolvable dependencies, or
`class-validator`/`class-transformer` silently stop validating.

**Cause:** SST bundles with esbuild, which does not emit `emitDecoratorMetadata`.

**Rule:** never point an SST function at TypeScript source. Build `packages/api` with `tsc` (which
does emit metadata), then point the Lambda handler at the **compiled** entry-point:

```
packages/api/dist/entry-point/lambda/main.js   ← handler target
```

The SST function is a thin `index` re-exporting that built handler. `pnpm --filter api build` must
run before `sst deploy`.

## 2. Always set `enumName` on exposed enums

**Symptom:** Orval generates `CharacterResponseDtoVocation`, `CreateCharacterDtoVocation`,
`GetCharacter200Vocation`… — one duplicate enum per usage site, and no shared type between them.

**Rule:** every `@ApiProperty({ enum: X })` passes `enumName`, and **the same enum uses the same
`enumName` everywhere**:

```ts
@ApiProperty({ enum: Vocation, enumName: 'Vocation' })
vocation!: Vocation;
```

Mismatched or missing `enumName` is a review blocker, not a nit.

## 3. Domain entities are never the DB schema

**Symptom:** the domain grows nullable fields, public setters, surrogate ids and ORM decorators to
satisfy the database.

**Rule:** Drizzle schemas live in `config/database/schemas/`; domain entities/aggregates live in
`domain/` with no persistence awareness. Repositories map between them (`*.mapper.ts`). Mapping code
is cheap; a domain shaped by its tables is not.

## 4. A use case never imports another use case

**Symptom:** transaction boundaries blur, one command silently triggers three others, tests need
half the container.

**Rule:** `application/**` files must not import from `application/read` or `application/write`
siblings. If a flow needs multiple commands, that orchestration is a **new pattern to be agreed
first** (domain event, saga, or an explicit orchestrator layer) — do not improvise it inline.

## 5. Inject front-end dependencies through hooks

**Symptom:** components import API clients or singletons directly, and tests can only be written by
mocking modules.

**Rule:** components receive data and behaviour from hooks; hooks are the only place that touches the
generated API client, storage, or the router. Testing then means stubbing a hook or serving MSW
handlers — never `jest.mock` of a deep module path.

## 6. Typed config module from day one, in both packages

**Symptom:** `process.env.SOMETHING` scattered across the codebase, undefined in Lambda, discovered
in production.

**Rule:** each package has a `config/` module that reads and **validates** its environment once at
startup and exports a typed object. No `process.env` access outside it.

- `packages/api` — validate with `class-validator` at bootstrap; fail fast on a missing var.
- `packages/web` — only `VITE_`-prefixed vars exist in the browser bundle; validate them in
  `src/config` and import from there.

## 7. A nullable `@ApiProperty` must state its `type`

**Symptom:** a nullable string arrives on the web side as `{ [key: string]: unknown } | null`, and
every use of it fails the typecheck with "not assignable to `ReactNode`" or "not assignable to
`string`".

**Rule:** `nullable: true` alone makes Nest emit `"type": "object"` — its default — because the
reflected TypeScript type is `string | null`, not `string`. Orval faithfully turns that into an
index-signature object. Always pass `type` (and `format` for a date) beside `nullable`:

```ts
@ApiProperty({ type: String, format: 'date-time', nullable: true })
endedAt!: Date | null;
```

A nullable property whose type is another DTO already works, because `type: SomeDto` is spelled out.

**Second trap, same change:** Orval **appends** to `src/api/generated/model/index.ts` and never
prunes it. Removing or renaming a schema leaves a stale `export * from './gone'` that breaks the
build. Delete the orphaned model files _and_ `index.ts`, then re-run `make codegen`.

## 8. `enableCors` under Fastify allows only GET, HEAD and POST

**Symptom:** a new `PATCH` or `DELETE` route fails in the browser with "Failed to fetch". Nothing
reaches a controller, nothing appears in the API's log, and `curl` against the same route works
perfectly — because `curl` sends no preflight.

**Rule:** Nest's documented CORS default covers every verb, but under Fastify `app.enableCors()`
delegates to `@fastify/cors`, whose own default is `GET,HEAD,POST`. Passing only `origin` leaves
that default in place, so the browser refuses the preflight before the request is ever sent.

Pass the whole options object from `cors.util.ts`, never just the origins:

```ts
app.enableCors(corsOptions(config.get('WEB_ORIGIN', { infer: true })));
```

`ALLOWED_METHODS` is checked against every method in the committed `openapi.json`, so a route added
with a verb nobody thought about fails `cors.util.test.ts` instead of failing in a browser.

**Diagnosing it:** the preflight tells you directly —

```
curl -i -X OPTIONS http://127.0.0.1:3000/<route> \
  -H 'Origin: http://localhost:5173' -H 'Access-Control-Request-Method: PATCH'
```

If `access-control-allow-methods` comes back missing the verb, this is the bug.
