# Auth — sessions, guards and the session hook

Everything about who the caller is and what they may do, on both sides. It sits
apart from the stack docs because plenty of projects have nothing to sign in to:
a project without this doc has no sessions, no guards and no sign-in screen, and
that is a decision rather than an omission.

## What is chosen

| Concern         | Choice                                   | Why this one                                                          |
| --------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| Library         | Better Auth                              | Owns sessions, providers and password reset; Drizzle adapter, no service to run |
| Session transport | Cookies                                | Nothing to store in JavaScript, so no interceptor and no refresh logic |
| Web client      | Better Auth React client                 | Same library as the API, talking to the same routes                   |
| Sending mail    | The API's `EmailPort`                    | Verification and reset resolve the port; no provider SDK in the auth config |

## Where it lives

```
packages/api/src/
  config/
    auth.config.ts        the Better Auth instance (Drizzle adapter, providers, hooks)
    database/schemas/     incl. the generated auth.schema.ts
  entry-point/http/
    auth/                 the Better Auth mount + session/roles guards

packages/web/src/
  api/auth-client.ts      Better Auth React client (sign-in, sign-out, session)
  shared/hooks/           incl. use-session.hook.ts — the only auth-client consumer
```

## It owns its tables

`better-auth generate` writes `user`, `session`, `account` and `verification`
into `config/database/schemas/auth.schema.ts`; that file is committed and **never
hand-edited**. Drizzle still generates the migration from it, so there is one
migration pipeline.

**The domain keeps its own user aggregate**, keyed by the Better Auth user id —
gotcha 3 in [stack-api.md](stack-api.md) applies to the auth tables like any
other schema. Source of truth is split on purpose and stated once: credentials,
sessions, verified email and linked providers are Better Auth's; everything the
product means by a user is the domain's.

## The API side

It is mounted as a Fastify route, not re-declared as Nest controllers:

- `config/auth.config.ts` builds the instance; `entry-point/http/auth/` mounts its
  handler at `/api/auth/*` and holds the guards.
- The session guard calls `auth.api.getSession` and puts the session into the
  request-scoped `AsyncLocalStorage`. Use cases receive the user id as an
  argument — `application/` never reaches into the store for it.
- **`/api/auth/*` is deliberately outside the OpenAPI contract.** It is not in
  `openapi.json`, Orval generates no client for it, and `codegen-check` is not
  expected to see it. The web package talks to it through Better Auth's own React
  client.

## Authorization

Three questions, three homes. Merging them is what makes permissions
untestable:

| Question                              | Where it lives                              | Result |
| ------------------------------------- | ------------------------------------------- | ------ |
| Is there a session?                   | session guard, `entry-point/http/auth/`     | 401    |
| Does this role reach this route?      | `@Roles()` guard on the controller          | 403    |
| May this user act on **this record**? | the aggregate's own invariant, in `domain/` | 403    |

Ownership is an invariant, not a route concern: the record is already loaded by
the use case, so checking it in a guard means fetching twice and putting the rule
somewhere no unit test can reach it. The aggregate throws `ForbiddenException`
like any other domain rule (see the Errors section of
[architecture-api.md](architecture-api.md)).

The identity itself is passed into the use case as an argument. `application/`
and `domain/` never read it from ambient context.

## The web side

**The session is server state like any other.** One hook owns it; components ask
that hook. Nothing about the signed-in user is copied into a store, and no
credential is kept in JavaScript.

- `api/client.ts` sets `credentials: 'include'` on every request. The API must
  answer with `credentials: true` and an explicit origin — see gotcha 1 below.
- `api/auth-client.ts` is Better Auth's React client, talking to `/api/auth/*`.
  That path is **not** in the OpenAPI spec, so Orval generates nothing for it —
  this is the one hand-written client, and the exception is deliberate.
- `shared/hooks/use-session.hook.ts` is the **only** consumer of the auth client.
  Pages and components ask that hook, never the client.
- Protected routes use a Tanstack Router `beforeLoad` guard that resolves the
  session and redirects to sign-in with the target route in a search param.

**Handling a 401.** An expired session surfaces as a 401 on an arbitrary query,
so it is handled centrally in `api/client.ts`: it throws a typed
`UnauthorizedError`, clears the session query and redirects to sign-in preserving
the current route. `beforeLoad` covers the first load; the client covers
everything after it.

**No component ever branches on status 401.** If a screen appears to need it, the
answer is a route guard or a 403 (permission), not a status check in JSX.

## Email

Better Auth's `sendVerificationEmail` / `sendResetPassword` hooks resolve the
API's `EmailPort` — they never import a provider SDK directly. The port, its
adapters and the inline-send trade-off are in [stack-api.md](stack-api.md).

## Commands

| Command                | What it does                                          |
| ---------------------- | ----------------------------------------------------- |
| `make api-auth-schema` | `better-auth generate` into `config/database/schemas/` |

## Known gaps

| Gap                | Intended direction when it comes up                                                | Trigger                                    |
| ------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| Rate limiting      | Better Auth's own rate limiter, with a shared store rather than in-memory          | First public deploy — do not skip this one |
| Roles and tenancy  | `@Roles()` covers a flat role list; anything hierarchical or per-tenant is unresearched | The second role that is not admin/user |

## Gotchas

Each of these cost real time. Read the symptom, apply the rule. Numbered, and
never renumbered — append.

### 1. Cookie sessions need `credentials` on both sides, and no wildcard origin

**Symptom:** sign-in succeeds, the response even carries `set-cookie` — and every
subsequent request is a 401. The browser is not storing or not sending the
cookie.

**Rule:** three things must line up, and missing any one produces the same 401:

1. `corsOptions` sets `credentials: true` **and** an explicit origin list. A
   wildcard `*` is silently ignored by the browser once credentials are involved.
2. The web fetch instance sends `credentials: 'include'` — see
   [stack-web.md](stack-web.md).
3. The cookie's `sameSite`/`secure` pair matches the deployment. Same-site over
   `localhost` works with `lax`; a cross-domain deploy needs `sameSite: 'none'`
   **and** `secure: true`, which means HTTPS on both ends.

Item 3 is the one that passes locally and fails deployed. Check the response's
`set-cookie` in the network tab before suspecting the session store.

### 2. MSW does not carry cookies — session state in tests is explicit

**Symptom:** an integration test of a protected page either renders the
signed-out branch forever or hangs on the session query, while the same page
works in the browser.

**Rule:** the cookie the API sets does not exist in jsdom, so the session is not
ambient in tests. Either stub `use-session.hook.ts`, or add an MSW handler for
the Better Auth session endpoint in `vitest.setup.ts` — the generated handlers
cover `/api/*` but **not** `/api/auth/*`, which was never in the spec. Pick one
per tier and keep it there: signed-in-by-default in setup, overridden per test
for the signed-out case.
