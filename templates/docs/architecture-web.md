# Front-end architecture

The rules a front-end obeys, stated without naming a library. What implements them
— framework, router, codegen, test runner, the concrete folder tree — lives in
[stack-web.md](stack-web.md).

Naming follows [naming.md](naming.md). Where this doc and naming.md disagree,
naming.md wins.

## The front-end is deliberately dumb

**If a number appears on screen, the back-end should have sent that number.**

- The web layer formats and lays out. Dates, currency, labels, truncation, colour
  thresholds that are purely visual — all fine.
- A trivial reduce over data it already holds (summing a column it is displaying, a
  percentage of a total on the same page) is fine.
- **Anything rule-shaped is the back-end's.** Filtering, sorting by a derived key,
  diffing two payloads, ranking, bracketing, applying a domain rule, deciding what
  "significant" means — that is a new API field or a new endpoint, not a helper
  function.

The reason is not purity: those rules are also needed by other clients, they need
tests against real data, and a rule that lives in two places drifts. The exception
is honest — **if doing it on the back-end is disproportionately expensive, or the
web has information the API does not, say so and get it agreed** before writing
it. An unflagged calculation in the front-end is a review blocker.

## Layout

A feature folder is **grouped by type**, from a closed list of subfolders: pages,
components, hooks, stores, utils, types and mocks. **A subfolder is created only
once it has a file to hold** — a one-page feature is one page file and nothing
else, not seven empty directories.

Tests stay colocated with their subject, inside whichever subfolder it lives in.
Architecture tests that assert on a feature as a whole sit at the feature root,
which is the only thing allowed to live outside a subfolder.

Inside a feature, files import each other **relatively**. The path alias is for
the router reaching a page; using it inside a feature is a lint error, because
that is the only way one glob can tell "my own folder" from "someone else's".

A feature owns its components, pages, hooks and mocks. Cross-feature reuse gets
promoted to a shared folder; features never import from each other's internals.

## Data access

- All server calls go through the **generated** client. Do not hand-write fetch
  calls, and do not edit generated files — change the API's contract instead and
  regenerate.
- A page may call a generated hook directly. Wrap it in a feature hook when the
  wrapper **earns its file**: result shaping or derivation, combining several
  calls, error mapping, or reuse across pages. A pass-through wrapper is noise —
  don't add one for symmetry.
- Components render from props. That, not the wrapper hook, is what makes them
  testable: a component test passes data in, and only the page above it touches a
  query.

## Forms

**Client-side validation is a UX affordance, never enforcement.** The same rule
exists on the back-end and that is the one that counts; the client's copy exists
to answer sooner. A rejected submit shows its error **on the field**, which means
the server's field errors must be mappable back onto the form.

## State

Three places, in this order:

1. **Server state → the server-cache library.** No copying query results into
   local state.
2. **UI state → local component state, in the component that owns it.** Filters
   and selections that should be linkable go in the router's search params
   instead — and a filter the API could apply usually belongs in the request
   anyway.
3. **A context store only when prop-drilling actually hurts** — roughly three
   levels or more, or several sibling components sharing one piece of UI state.

**No external state-management library.** Context plus local state covers what is
left after the server cache owns the server state. If a context store starts
holding server data or business rules, both of those belong somewhere else.

## The API contract

The contract document is a **build artifact, not a live endpoint**: it is
generated from the API's code, the client is generated from it, and both are
committed. A drift check re-runs both steps and fails if the output moved.
Neither step needs a running server or a database.

Regenerating is therefore part of any API contract change, in the same commit.

## Environment

- Only variables carrying the build tool's public prefix reach the browser bundle.
- One config module reads and validates them once and exports a typed object.
  **Nothing else touches the raw environment object.**
- There is **no dev proxy**, so dev and deployed builds take the same code path.

## Routing

Routes are **code-based**: route definitions live in one place, each pointing at a
page file. File-based routing would derive URLs from filenames and force page
files to drop their naming suffix, so it is not used.

## Testing

- **Unit/component** — render with data passed as props, or with the feature's
  hooks stubbed.
- **Integration** — the real page, real hooks, the real server cache and a mock
  network layer, in a DOM emulator. This is the tier that covers "the page renders
  what the API returns", including empty and null states.
- **E2E** — a real browser against a **real** API. Reserved for journeys a DOM
  emulator cannot prove: navigation, mutations, real network behaviour. It lands
  with the first feature that needs it, rather than being spent on assertions the
  integration tier already makes.

**Network mock handlers are generated, not written.** They come from the same
contract as the client, so they cannot drift from it. A test that needs a specific
payload overrides it with a typed factory from the feature's mocks. Hand-written
handler files do not exist.

Bootstrap lives in exactly two fixed-name files — the shared network-mock wiring,
and render-with-providers. There is no per-feature harness.

## Enforced rules

These are encoded as lint rules, not left to review. A violation names the rule it
broke; the fix is moving the code, never adding an override.

1. A feature never imports another feature's internals — promote to the shared
   folder instead. The same rule bans the path alias from inside a feature: import
   your own files relatively.
2. The generated client is imported only from the API folder, feature hooks and
   pages — never from a component or from anything shared.
3. No state-management library in the dependency list.
4. The raw environment object is read only inside the config module.

## Styling

Utility classes in markup, plus a primitive component library. No CSS-in-JS, no
CSS modules. **Design tokens live in one stylesheet**, not in per-component
constants.

Everything else — what a colour is allowed to be, how a page is laid out, what the
four query states say, keyboard and focus, table and formatting conventions — is
[design.md](design.md).
