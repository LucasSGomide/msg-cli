# Front-end stack — `packages/web`

The concrete choices that implement [architecture-web.md](architecture-web.md).
That doc says what the rules are; this one says what enforces them.

## What is chosen

| Concern      | Choice                     | Why this one                                              |
| ------------ | -------------------------- | --------------------------------------------------------- |
| Framework    | React                      | —                                                         |
| Build        | Vite                       | Fast dev server, static env replacement at build time     |
| Routing      | Tanstack Router            | Code-based routes, typed search params                    |
| Server state | Tanstack Query             | Cache, invalidation and query states out of the box       |
| API client   | Orval                      | Generates client **and** mock handlers from one spec      |
| Network mock | MSW                        | Same handlers in tests and, if needed, in the browser     |
| Tests        | Vitest + jsdom             | Same transform pipeline as the app                        |
| E2E          | Playwright                 | Real browser, real API                                    |
| Primitives   | Shadcn                     | Owned source, not a dependency to fight                   |
| Styling      | Tailwind                   | Utilities in markup; tokens in one stylesheet             |
| Lint         | oxlint                     | Fast enough to encode the import rules                    |

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
  config/                 typed env access
  test/render.setup.tsx   the one render/bootstrap helper
e2e/                      Playwright specs
```

The alias for reaching a page from `app/` is `@/features/...`.

## Routing

`createRoute()` definitions live in `src/app/`, each pointing at a
`features/**/*.page.tsx`.

## Data access

Generated hooks live in `src/api/generated`; the fetch instance Orval is
configured with is `src/api/client.ts`. Feature wrappers are
`use-<thing>.hook.ts`.

## Codegen pipeline

The OpenAPI document is a build artifact, not a live endpoint:

1. `make api-openapi` boots Nest without listening and writes
   `packages/api/openapi.json`.
2. `make web-codegen` runs Orval against that file into `src/api/generated` — the
   client **and** the MSW handlers. (`make codegen` does both.)
3. Both the spec and the generated client are **committed**. `make codegen-check`
   re-runs both and fails if the output moved — that is the drift check.

## Environment

Only `VITE_`-prefixed variables reach the browser bundle. `src/config` reads and
validates them once and exports a typed object; nothing else touches
`import.meta.env`. The API base URL is `VITE_API_URL`, consumed by
`api/client.ts`.

Each variable is declared in `src/vite-env.d.ts` and read with **dot access**.
Vite replaces `import.meta.env.VITE_X` statically at build time;
`import.meta.env['VITE_X']` is **not** replaced and is `undefined` in a
production bundle. Values come from `.env` (copy `.env.example`) or from a
`VITE_`-prefixed shell variable; both are inlined at build time.

## Testing tooling

- Unit/component: `*.test.tsx`, Vitest + jsdom.
- Integration: `*.integration.test.tsx`, real page with MSW.
- E2E: Playwright specs in `e2e/`.

Bootstrap is exactly two fixed-name files: `vitest.setup.ts` at the package root
(the shared `setupServer` wiring) and `src/test/render.setup.tsx` (render with
providers).

## Styling

Tailwind utilities in markup; Shadcn primitives in `shared/ui`. Design tokens live
in `src/styles.css`. [design.md](design.md) rules 1–3 are enforced by
`pnpm lint:tokens`, which bans Tailwind palette classes outside `styles.css`.

## Enforced rules

`packages/web/.oxlintrc.json` encodes the architecture doc's four rules as
`no-restricted-imports` overrides — except rule 4: oxlint has no
`no-restricted-syntax`, so `import.meta.env` outside `src/config` is a grep in the
`lint:env` script instead. Same gate, less elegance. `process.env` is not read at
all.

## Commands

| Command              | What it does                                                 |
| -------------------- | ------------------------------------------------------------ |
| `make check-fast`    | both packages' lint and typecheck plus every non-Docker test  |
| `make codegen`       | regenerate the spec and the client                            |
| `make codegen-check` | prove the committed spec and client are current               |
| `make check`         | all of the above plus the container-backed suites             |

## Gotchas

Numbered, and never renumbered — append.

### 1. Inject dependencies through hooks

**Symptom:** components import API clients or singletons directly, and tests can
only be written by mocking modules.

**Rule:** components receive data and behaviour from hooks; hooks are the only
place that touches the generated API client, storage, or the router. Testing then
means stubbing a hook or serving MSW handlers — never a module mock of a deep
import path.

### 2. Typed config module from day one

**Symptom:** environment access scattered across the codebase, undefined in the
deployed bundle, discovered in production.

**Rule:** only `VITE_`-prefixed vars exist in the browser bundle. Validate them in
`src/config` and import from there. The API package has its own version of this
rule — see [stack-api.md](stack-api.md).

### 3. Orval appends to the model index and never prunes it

**Symptom:** the build breaks on `export * from './gone'` after a schema is
removed or renamed on the API side.

**Rule:** Orval **appends** to `src/api/generated/model/index.ts` and never prunes
it. Delete the orphaned model files _and_ `index.ts`, then re-run `make codegen`.

Usually spotted right after the API-side fix for a nullable property — see gotcha
6 in [stack-api.md](stack-api.md).
