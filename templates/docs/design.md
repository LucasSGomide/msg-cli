# Design guidelines — anything that renders UI

Read this before writing or reviewing a file under `packages/web` that produces markup.
[architecture-web.md](architecture-web.md) says where code goes; this says what it looks like and
how it behaves.

Each rule is one imperative and one line of why. Some rules name a primitive that **does not exist
yet** — those are marked `NOT BUILT`, and they carry what to do until it does. A rule marked
`NOT BUILT` is still the rule; it just costs more to follow today.

Rules 1–3 are enforced by `pnpm lint:tokens` in `packages/web`, part of `make check-fast`. The rest
are read, not linted.

## Colour

**1. Every colour comes from a semantic token — never a Tailwind palette class.**
`bg-muted`, not `bg-neutral-800`. A palette class is a colour with no meaning attached, so the next
person cannot tell whether it was a considered choice or the nearest grey to hand. The full set is
in `packages/web/src/styles.css`: `background`, `foreground`, `card`, `popover`, `primary`,
`secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `border`, `input`, `ring` —
each with a `-foreground` pair where it takes content.

**2. Raw palette values live only in `styles.css`.**
That file is where a colour is _defined_; everywhere else it is _referenced_. The talent-tree score
ramps (`--score-stat-*`, `--score-special-*`) are the only raw values in the repo and they are
declared there for exactly this reason.

**3. A colour that means something new gets a token, not an exception.**
`--warning` exists because "(disputed)" needed amber and amber meant nothing. Adding a token is two
lines in `styles.css` plus two in `@theme inline`; adding an exception is permanent.

**4. Data scales are tokens too, named by what the step means.**
`bg-score-stat-excellent`, never `bg-score-stat-3`. A ramp is read as an ordered scale, and a number
in the class name makes the _position_ the API rather than the _meaning_ — reordering the scale then
silently changes what every call site claims.

**5. State colour follows the same three words everywhere.**
`destructive` for irreversible or failed, `warning` for measured-but-contested, `success` for
confirmed. Do not introduce a fourth mood; if something needs one, it needs a token (rule 3).

## Themes

**6. The app ships dark-only. Never write a `dark:` variant.**
`index.html` pins `class="dark"` and there is no toggle, so a `dark:` utility is markup that
executes but was never compared against its alternative — dead code that reads as tested.

**7. Every colour still goes through a token, so the light `:root` block stays correct.**
Rule 6 is a shipping decision, not a licence to hard-code dark values. Following rule 1 makes a
theme toggle a one-line change; hard-coding makes it an audit of every file.

## Type and density

**8. Body text is 14px/20px and is set once, in `styles.css` `@layer base`.**
This app is a wall of numbers on a handful of screens. A component that picks its own base size
makes two tables disagree about how dense a row is.

**9. Use the size scale, not arbitrary sizes: `text-xs` for secondary detail, the inherited body
size for content, `text-xl font-semibold` for a page title.**
Three steps are enough for a tool of this shape; a fourth is almost always a heading that wants to
be a `Card` instead.

**10. Muted text means "supporting", not "small".**
`text-muted-foreground` for units, labels and timestamps that qualify a number. Shrinking text to
de-emphasise it is how a table ends up with five type sizes.

## Layout

**11. A page is `<section>` → `<h1>` → one-line description → content, with `mt-1` under the title
and `mt-6` under the description.**
Every page already does this (`captures.page.tsx:75`, `bosses.page.tsx:19`). It is copy-pasted, so
it is a convention; keeping it identical is what lets it become a primitive later.

**12. `NOT BUILT` — a `PageHeader` primitive should own rule 11.**
Until it exists, copy the shape above exactly rather than improving it in one place. A local
improvement is the thing that makes the extraction expensive.

**13. Spacing comes from the `1 / 2 / 4 / 6` step set: `gap-2` inside a control, `gap-4` between
controls, `space-y-4` between blocks, `mt-6` between page regions.**
An arbitrary `mt-5` reads as deliberate emphasis to the next reader, and it never is.

**14. Content that can be wide scrolls inside its own container.**
The `Table` primitive brings its own scroll container for this reason (`captures.page.tsx:101`).
The page body must never scroll sideways.

## Query states

**15. Every screen that fetches renders all four states: pending, error, empty, and content.**
Nine pages do this by hand today. Omitting the empty state is the usual miss, and it makes a working
screen look broken.

**16. The wording is fixed: `Loading <things>…` · `Could not load <things>: <message>` ·
`No <things> have been loaded yet.`**
Consistent phrasing is the cheapest way for a user to tell "nothing matched" from "nothing exists"
from "it broke".

**17. An error renders in `text-destructive` with `role="alert"`; an empty or pending state renders
in `text-muted-foreground` with no role.**
Only the error is worth interrupting a screen reader for.

**18. A filtered-to-nothing result says so in its own words, separate from the empty state.**
`bosses.page.tsx:60` says "No boss matches that search." — "No bosses have been seeded yet." would
be a lie about the data.

**19. `NOT BUILT` — a shared query-state component should own rules 15–18.**
Until it exists, copy the wording exactly. Do not invent a new phrasing for a fifth screen.

## Controls and forms

**20. Use the `shared/ui` primitive if one exists. Never restyle a bare element next to one.**
`Button`, `Badge`, `Card`, `Table`, `Select`, `MultiSelect`, `Tooltip`, `Collapsible`, `DataTable`
are built. A hand-styled `<button>` beside `Button` is a variant nobody can find.

**21. `NOT BUILT` — there is no `Input`. Until there is, use exactly
`border-input rounded border bg-transparent px-2 py-1`.**
Four bare `<input>` elements diverged before this was written. One string, copied, beats four
opinions.

**22. Every control has an accessible name — a `<label>`, or `aria-label` when the design has no
visible label.**
`MultiSelect` takes a required `label` prop for this reason: a filter with no name is unreachable by
voice and unlabelled to a screen reader.

**23. Pick the `Button` variant by consequence, not by looks: `destructive` for irreversible,
`default` for the primary action, `outline` for a secondary one, `ghost` for a row-level action.**
`button.tsx:18` already says why — a confirm that deletes ~34k rows should not look like a Save.

**24. A destructive action is confirmed, and the confirmation names the thing.**
"Delete this?" is unanswerable when two runs of the same hunt sit ten minutes apart.

## Keyboard and focus

**25. Anything clickable is reachable and operable by keyboard.**
Enter activates, Escape cancels an open editor or dialog, and focus returns to whatever opened it.

**26. Prefer real elements over roles: a link that navigates is an `<a>`, a button that acts is a
`<button>`.**
`role="link"` on a `<tr>` gives up the URL preview, middle-click and the browser's own focus
handling, and buys nothing a real anchor does not already do.

**27. Prefer a primitive that brings focus management over writing it.**
Radix `DropdownMenu` gives roving focus, Escape and outside-click for free (`multi-select.tsx` is
built on it precisely for that). Hand-rolled handlers get three of the four cases right.

**28. Never remove a focus ring.** `styles.css` sets `outline-ring/50` globally; a component that
clears it is unusable by keyboard even though it looks fine.

## Tables

**29. A column earns its width. Drop a column whose fact is already implied by another, or is
available one click deeper.**
`Started` went because `Duration` implies it and the report screen shows it exactly.

**30. Badges carry the state; timestamps and long sentences do not belong in a cell.**
`level up`, not `someone levelled up mid-capture at 2026-08-01 14:22 UTC`. A cell is scanned, not
read.

**31. A missing value renders `-` in muted text — never blank, never `null`, never `0`.**
Blank reads as a rendering bug and `0` is a claim about the data that is usually false.

## Numbers and words

**32. Formatting lives in a feature's `*-format.util.ts`, never inline in markup.**
`capture-format.util.ts` is the pattern. Formatting the same value two ways in two components is the
bug this prevents.

**33. Formatting only. Anything rule-shaped belongs to the API.**
Non-negotiable 9 in `CLAUDE.md`, and `planner-calculation.architecture.test.ts` fails the build for
it. A unit suffix is formatting; a threshold that decides a colour is a rule.

**34. Timestamps are UTC to the minute; durations are `1h 58m`.**
A capture is read against the game's clock and against other captures, never as local wall time.

**35. Sentence case for everything — headings, buttons, badges, menu items.**
"Party levels", not "Party Levels". One casing rule means no one has to decide.
