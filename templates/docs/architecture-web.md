# Front-end architecture — `packages/web`

Stack: React, Vite, Tanstack Router, Tanstack Query, Orval (API client + MSW codegen), MSW, Vitest,
Shadcn, Tailwind, Playwright.

Naming follows [docs/naming.md](naming.md); the [gotchas](gotchas.md) apply here as they do to the
API. Where this doc and naming.md disagree, naming.md wins.

## The front-end is deliberately dumb

**If a number appears on screen, the back-end should have sent that number.**

- The web layer formats and lays out. Dates, currency, labels, truncation, colour thresholds that
  are purely visual — all fine.
- A trivial reduce over data it already holds (summing a column it is displaying, a percentage of a
  total on the same page) is fine.
- **Anything rule-shaped is the back-end's.** Filtering, sorting by a derived key, diffing two
  payloads, ranking, bracketing, applying a game rule, deciding what "significant" means — that is a
  new API field or a new endpoint, not a `.util.ts`.

The reason is not purity: those rules are also needed by the CLI and the reports, they need tests
against real data, and a rule that lives in two places drifts. The exception is honest — **if doing
it on the back-end is disproportionately expensive or the web has information the API does not, say
so and get it agreed** before writing it. An unflagged calculation in `packages/web` is a review
blocker.

## Layout

```
src/
  app/                    router tree (code-based), providers, root layout
  features/<feature>/
    pages/                *.page.tsx
    components/           *.component.tsx
    hooks/                *.hook.ts
    stores/               *.store.tsx
    utils/                *.util.ts
    types/                *.type.ts
    mocks/                *.mock.ts
  shared/
    ui/                   Shadcn components (generated, lightly edited)
    hooks/
    lib/                  pure helpers
  api/
    generated/            Orval output — client and MSW handlers. Never edited by hand
    client.ts             fetch instance Orval is configured to use
  config/                 typed env access (see gotcha #6)
  test/render.setup.tsx   the one render/bootstrap helper
e2e/                      Playwright specs
```

A feature folder is **grouped by type**. `pages/`, `components/`, `hooks/`, `stores/`, `utils/`,
`types/` and `mocks/` are the only subfolders allowed, and **a subfolder is created only once it has
a file to hold** — a one-page feature is `home/pages/home.page.tsx` and nothing else, not seven empty
directories.

Tests stay colocated with their subject, inside whichever subfolder it lives in. Architecture tests
that assert on the feature as a whole sit at the feature root (or at `features/`), which is the only
thing allowed to live outside a subfolder.

Inside a feature, files import each other **relatively** — `../components/x` from a page. The
`@/features/...` alias is for `app/` reaching a page; using it inside a feature is a lint error,
because that is the only way one glob can tell "my own folder" from "someone else's".

A feature owns its components, pages, hooks and mocks. Cross-feature reuse gets promoted to
`shared/`; features never import from each other's internals.

## Data access

- All server calls go through the **Orval-generated** hooks/functions in `api/generated`. Do not
  hand-write fetch calls, and do not edit generated files — change the API's OpenAPI output instead
  and regenerate.
- A page may call a generated hook directly. Wrap it in a feature hook (`use-<thing>.hook.ts`) when
  the wrapper **earns its file**: `select` shaping or derivation, combining several calls, error
  mapping, or reuse across pages. A pass-through wrapper is noise — don't add one for symmetry.
- Components render from props. That, not the wrapper hook, is what makes them testable: a
  component test passes data in, and only the page above it touches a query.

## State

Three places, in this order:

1. **Server state → Tanstack Query.** No copying query results into local state.
2. **UI state → `useState` in the component that owns it.** Filters and selections that should be
   linkable go in Tanstack Router search params instead — and a filter the API could apply usually
   belongs in the request anyway.
3. **A React Context store (`*.store.tsx`) only when prop-drilling actually hurts** — roughly three
   levels or more, or several sibling components sharing one piece of UI state.

**No external state library.** Zustand, Redux, Jotai and friends are not installed; Context plus
`useState` covers what is left after Query owns the server state. If a Context store starts holding
server data or business rules, both of those belong somewhere else.

### Codegen pipeline

The OpenAPI document is a build artifact, not a live endpoint:

1. `make api-openapi` boots Nest without listening and writes `packages/api/openapi.json`.
2. `make web-codegen` runs Orval against that file into `src/api/generated` — the client **and** the
   MSW handlers. (`make codegen` does both.)
3. Both the spec and the generated client are **committed**. `make codegen-check` re-runs both and
   fails if the output moved — that is the drift check. Neither step needs a running server or a
   database.

Regenerating is therefore part of any API contract change, in the same commit.

## Environment

Only `VITE_`-prefixed variables reach the browser bundle. `src/config` reads and validates them once
and exports a typed object; nothing else touches `import.meta.env` (gotcha #6). The API base URL is
`VITE_API_URL`, consumed by `api/client.ts` — there is no dev proxy, so dev and deployed builds take
the same code path.

Each variable is declared in `src/vite-env.d.ts` and read with **dot access**. Vite replaces
`import.meta.env.VITE_X` statically at build time; `import.meta.env['VITE_X']` is not replaced and
is `undefined` in a production bundle. Values come from `.env` (copy `.env.example`) or from a
`VITE_`-prefixed shell variable; both are inlined at build time.

## Routing

Routes are **code-based**: `createRoute()` definitions live in `src/app/`, each pointing at a
`features/**/*.page.tsx`. File-based routing would derive URLs from filenames and force route files
to drop the `.page.tsx` suffix, so it is not used.

## Testing

- **Unit/component** — render with data passed as props, or with the feature's hooks stubbed.
  `*.test.tsx`.
- **Integration** — the real page, real hooks, Tanstack Query and **MSW**, in jsdom.
  `*.integration.test.tsx`. This is the tier that covers "the page renders what the API returns",
  including empty and null states.
- **E2E** — Playwright in `e2e/`, driving a browser against a **real** API. Reserved for journeys a
  jsdom render cannot prove: navigation, mutations, real network behaviour. Not yet scaffolded; it
  lands with the first feature that needs it, rather than being spent on assertions the integration
  tier already makes.

**MSW handlers are generated, not written.** Orval emits them from the same spec as the client, into
`src/api/generated`, so they cannot drift from the contract. A test that needs a specific payload
overrides it with `server.use(...)` and a typed factory from the feature's `mocks/`. Hand-written
`*.msw.mock.ts` files do not exist.

Bootstrap lives in exactly two fixed-name files: `vitest.setup.ts` at the package root (the shared
`setupServer` wiring) and `src/test/render.setup.tsx` (render with providers). There is no
per-feature harness.

## Enforced rules

`packages/web/.oxlintrc.json` encodes what this doc would otherwise only assert, via
`no-restricted-imports` overrides. A violation names the rule it broke; the fix is moving the code,
never adding an override.

1. A feature never imports another feature's internals — promote to `shared/` instead. The
   same rule bans `@/features/...` from inside a feature: import your own files relatively.
2. `api/generated` is imported only from `src/api`, feature hooks and pages — never from a
   `*.component.tsx` or anything in `shared/`.
3. No state-management library in `package.json`.
4. `process.env` is not read at all. `import.meta.env` is read only inside `src/config` — oxlint has
   no `no-restricted-syntax`, so this one is a grep in the `lint:env` script rather than a lint
   rule. Same gate, less elegance.

`make check-fast` runs both packages' lint and typecheck plus every non-Docker test;
`make codegen-check` proves the committed spec and client are current. All three are in `make check`.

## Styling

Tailwind utilities in markup; Shadcn primitives in `shared/ui`. No CSS modules, no styled-components.
Design tokens live in `src/styles.css`, not in per-component constants.

Everything else — what a colour is allowed to be, how a page is laid out, what the four query states
say, keyboard and focus, table and formatting conventions — is [design.md](design.md). Its rules 1–3
are enforced by `pnpm lint:tokens`, which bans Tailwind palette classes outside `styles.css`.
