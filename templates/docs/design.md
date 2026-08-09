# Design guidelines — anything that renders UI

Read this before writing or reviewing a file under `packages/web` that produces markup.
[architecture-web.md](architecture-web.md) says where code goes; this says what it looks like and
how it behaves.

## The bar

**WCAG 2.2 Level AA**, plus three AAA criteria this project adopts by name: 1.4.6 Contrast
(Enhanced) for body text, 2.4.13 Focus Appearance, and 2.3.3 Animation from Interactions.

AA is not aspirational. The European Accessibility Act has been enforceable since June 2025 and
resolves through EN 301 549 to WCAG 2.1 AA; 2.2 is a superset, so building to 2.2 AA clears the
legal floor and the current standard at once. The three AAA criteria are here because each is
nearly free once the rules below are followed, and each is expensive to retrofit.

## How to read a rule

Each rule is one imperative and one line of why. A rule with no why is a preference, and the next
person will not know whether to keep it.

Each rule carries a tag saying how a violation is caught:

| Tag        | Meaning                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| `[auto]`   | The named lint or test rule catches it. Wire it into the check target and it fails the build |
| `[manual]` | No tool catches it. The tag says what a human does instead                     |

The `[auto]` tags name rules from `eslint-plugin-jsx-a11y`, `axe-core` (via `jest-axe` in component
tests or `@axe-core/playwright` end to end), and the project's own `lint:tokens`. **A project that
has not wired one of those in yet should read every rule it names as `[manual]`** — the rule still
holds, it just costs a person's attention instead of CI's.

Automated tooling catches somewhere under half of real accessibility defects. The `[manual]` rules
are not the leftovers; they are where the actual barriers live.

Some rules name a primitive that **does not exist yet** — those are marked `NOT BUILT`, and they
carry what to do until it does. A rule marked `NOT BUILT` is still the rule; it just costs more to
follow today.

Numbered, because roadmap items cite them by number — renumbering breaks the citations, so append
rather than reorder.

## Colour

**1. Every colour comes from a semantic token — never a Tailwind palette class, never a raw hex.**
`bg-muted`, not `bg-neutral-800` and not `#262626`. A palette class is a colour with no meaning
attached, so the next person cannot tell whether it was a considered choice or the nearest grey to
hand. `[auto: lint:tokens]`

**2. Raw colour values live only in `packages/web/src/styles.css`.**
That file is where a colour is _defined_; everywhere else it is _referenced_. One file to audit when
a contrast check fails, instead of a grep across the app. `[auto: lint:tokens]`

**3. Tokens are built on [Radix Colors](https://www.radix-ui.com/colors) 12-step scales, and the
step number is the meaning.**
The scales are contrast-checked at every step and ship a matching dark scale under the same step
numbers, which is what makes rule 13 a token swap rather than a redesign. `[manual: review styles.css]`

| Step  | What it is                          | Typical token                 |
| ----- | ----------------------------------- | ----------------------------- |
| 1–2   | App and subtle backgrounds          | `background`, `muted`         |
| 3–5   | Component background: rest, hover, active | `secondary`, `accent`   |
| 6–8   | Borders: separator, control edge, hovered edge | `border`, `input`, `ring` |
| 9–10  | Solid fills: rest, hover            | `primary`, `destructive`      |
| 11    | Low-contrast text                   | `muted-foreground`            |
| 12    | High-contrast text                  | `foreground`                  |

**4. Text uses step 11 or 12. Never step 9 or 10.**
Step 9 is the most saturated step in a scale, tuned to be seen as a solid shape, not read as a
glyph — it fails against step 1 in most hues. `[auto: axe color-contrast]`

**5. Text sitting on a step-9 solid uses that scale's paired contrast token, never a hard-coded
white.**
Whether white or black reads on step 9 depends on the hue — it is white on blue and black on yellow,
and guessing is how a "primary" button ends up unreadable in exactly one theme. `[auto: axe color-contrast]`

**6. Body text clears 7:1 and everything else clears 4.5:1 — large text (≥24px, or ≥18.7px bold)
clears 4.5:1.**
7:1 on body copy is AAA 1.4.6, adopted because prose is what gets read for minutes at a time and the
Radix step-12 tokens already reach it. `[auto: axe color-contrast-enhanced on prose, color-contrast elsewhere]`

**7. A control's boundary, an icon carrying meaning, and a chart mark all clear 3:1 against what
sits behind them.**
1.4.11 Non-text Contrast. An input whose border you cannot find is an input you cannot fill in.
`[auto: axe color-contrast]`

**8. Colour is never the only carrier of meaning — pair it with a word, an icon or a shape.**
1.4.1. A red border alone says nothing to a colourblind user, to a screen reader, or to anyone
printing the page. `[manual: view the screen in greyscale]`

**9. A colour that means something new gets a token, not an exception.**
Adding a token is two lines in `styles.css` plus two in `@theme inline`; adding an exception is
permanent. `[manual: review]`

**10. State colour follows the same three words everywhere: `destructive` for irreversible or
failed, `warning` for degraded or contested, `success` for confirmed.**
Do not introduce a fourth mood; if something needs one, it needs a token (rule 9). `[manual: review]`

**11. Data scales are tokens too, named by what the step means, not where it sits.**
`bg-score-excellent`, never `bg-score-3`. A number in the class name makes the _position_ the API
rather than the _meaning_, so reordering the scale silently changes what every call site claims.
`[auto: lint:tokens]`

## Light and dark

**12. Both themes ship. Every token is defined twice, and no component writes a `dark:` variant.**
A `dark:` utility in markup is a second, undiscoverable place where the theme is decided — the next
token change fixes one of them. `[auto: lint:tokens bans the dark: variant outside styles.css]`

**13. The OS preference decides by default; an explicit toggle overrides it and persists.**
`prefers-color-scheme` is the answer the user already gave; a site that ignores it is asking a
question that was answered before the page loaded. `[manual: toggle the OS setting and reload]`

**14. Dark is a separate scale, not an inverted light one.**
Radix ships a dark scale per hue for this reason. `filter: invert()` and hand-flipped lightness both
produce hue shifts and blown-out accents; a dark theme is designed, not computed. `[manual: review styles.css]`

**15. No pure black background and no pure white text.**
Step 1 and step 12, not `#000` and `#fff`. Maximum contrast on an emissive screen produces halation —
the text smears for astigmatic readers, and it is fatiguing for everyone else. `[manual: review styles.css]`

**16. In dark mode, elevation is a lighter surface — never a heavier shadow.**
A shadow on a dark ground is invisible, so a card that relies on one has no depth cue at all. Raise
a surface by one step (1 → 2 → 3). `[manual: compare the card against its page in dark]`

**17. Accents are desaturated in dark, not reused from light.**
A fully saturated hue on a dark ground vibrates against it and is genuinely hard to look at. The
Radix dark scales already do this — the failure mode is pasting a light-mode hex into the dark
block. `[manual: review styles.css]`

**18. Every contrast check is run in both themes.**
The two scales are independent, so passing in light says nothing about dark. This is the single most
common way an "accessible" palette ships broken. `[auto: axe, in both themes]`

## Type, density and reflow

**19. The base type size and line height are set once, in `styles.css` `@layer base`: 16px / 1.5.**
Anything smaller as a default forces mobile zoom, and a component that picks its own base size makes
two screens disagree about how dense a row is. `[manual: review styles.css]`

**20. Type and spacing use `rem`, not `px`.**
1.4.4 requires text to survive 200% zoom. A `px` type scale ignores the user's browser font size,
which is the setting low-vision users reach for first. `[auto: lint:tokens]`

**21. Use the size scale, not arbitrary sizes: `text-xs` for secondary detail, the inherited body
size for content, `text-xl font-semibold` for a page title.**
Three steps are enough for most screens; a fourth is almost always a heading that wants to be a
`Card` instead. `[manual: review]`

**22. Muted text means "supporting", not "small".**
`text-muted-foreground` for units, labels and timestamps that qualify a value. Shrinking text to
de-emphasise it is how a table ends up with five type sizes and one of them unreadable. `[manual: review]`

**23. The layout reflows to a 320px viewport with no horizontal scrolling.**
1.4.10. 320px is 1280px at 400% zoom, so this criterion is about magnification as much as phones.
`[manual: resize to 320px, or zoom to 400%]`

**24. The layout survives the Text Spacing overrides: line height 1.5×, paragraph spacing 2×, letter
spacing 0.12em, word spacing 0.16em.**
1.4.12. Fixed-height containers holding text is the usual failure — text clips instead of growing.
`[manual: the WCAG text-spacing bookmarklet]`

**25. Prose runs 45–75 characters per line.**
Beyond that the eye loses the line on the return sweep, which costs dyslexic readers the most.
`[manual: review]`

## Structure and landmarks

**26. Every page has exactly one `<main>`, exactly one `<h1>`, and its regions in real landmark
elements — `<nav>`, `<header>`, `<footer>`, `<aside>`.**
A screen reader user navigates by landmark before they read anything; a page of `<div>`s is a page
with no table of contents. `[auto: axe landmark-one-main, page-has-heading-one, region]`

**27. Heading levels never skip — an `<h3>` only ever follows an `<h2>`.**
Heading level is the outline, not a font size. Use the type scale for size. `[auto: axe heading-order]`

**28. A skip link to `#main` is the first thing in the tab order, visible on focus.**
Without it every keyboard user tabs the whole navigation on every page. `[manual: press Tab on a fresh load]`

**29. A page is `<section>` → `<h1>` → one-line description → content, with `mt-1` under the title
and `mt-6` under the description.**
Keeping the shape identical everywhere is what lets it become a primitive later. `[manual: review]`

**30. `NOT BUILT` — a `PageHeader` primitive should own rules 26–29.**
Until it exists, copy the shape above exactly rather than improving it in one place. A local
improvement is the thing that makes the extraction expensive.

**31. Spacing comes from the `1 / 2 / 4 / 6` step set: `gap-2` inside a control, `gap-4` between
controls, `space-y-4` between blocks, `mt-6` between page regions.**
An arbitrary `mt-5` reads as deliberate emphasis to the next reader, and it never is. `[manual: review]`

**32. Content that can be wide scrolls inside its own container, and that container is focusable.**
The page body must never scroll sideways (rule 23), and a scroll region a mouse can reach but a
keyboard cannot is a region keyboard users cannot read. `[auto: axe scrollable-region-focusable]`

## Keyboard and focus

**33. Anything clickable is reachable and operable by keyboard: Enter and Space activate, Escape
cancels an open editor or dialog.**
2.1.1 is the criterion the largest number of real users depend on, and a `<div onClick>` fails it
silently — it looks fine to everyone testing with a mouse. `[auto: jsx-a11y/click-events-have-key-events]`

**34. Prefer real elements over roles: a link that navigates is an `<a href>`, a button that acts is
a `<button>`.**
`role="link"` on a `<tr>` gives up the URL preview, middle-click and the browser's own focus
handling, and buys nothing a real anchor does not already do. `[auto: jsx-a11y/anchor-is-valid, no-noninteractive-element-to-interactive-role]`

**35. Never remove a focus ring, and the ring is at least 2px thick around the whole control at 3:1
against both the control and the page.**
AAA 2.4.13, adopted because a ring that technically exists but cannot be found is the same bug as no
ring. `styles.css` sets the global ring for this reason. `[auto: lint:tokens bans outline-none without a replacement ring]`

**36. Focus is never hidden behind a sticky header, footer or cookie bar.**
2.4.11. The element scrolls into view under the sticky bar and the user is typing into something
they cannot see. `[manual: tab down a long page with the sticky bar in place]`

**37. Tab order follows visual order, and `tabindex` is never positive.**
A positive `tabindex` jumps the user out of reading order and re-sequences the whole page, not just
that control. `[auto: jsx-a11y/tabindex-no-positive]`

**38. Focus moves into a dialog when it opens and returns to whatever opened it when it closes.**
Focus dumped to `<body>` sends a keyboard user back to the top of the document, several screens away
from what they were doing. `[manual: open, close with Escape, check where focus landed]`

**39. Focus is trapped inside a modal dialog and nowhere else.**
2.1.2. A trap in a modal is the point; a trap anywhere else means the only way out is to close the
tab. `[manual: Tab past the last control, then Shift+Tab past the first]`

**40. Prefer a primitive that brings focus management over writing it.**
Radix `Dialog`, `DropdownMenu` and `Popover` give roving focus, Escape, outside-click and focus
restore for free. Hand-rolled handlers get three of those four right. `[manual: review]`

**41. Never autofocus on load.**
It skips the user past everything above the field, and a screen reader starts mid-page with no idea
what it missed. `[auto: jsx-a11y/no-autofocus]`

**42. Every target is at least 24×24 CSS pixels, or spaced so that 24px circles centred on adjacent
targets do not overlap.**
2.5.8. Inline links in prose are exempt; a row of 16px icon buttons is exactly what this catches.
`[auto: axe target-size]`

**43. Anything operable by dragging has a single-pointer alternative that does not require dragging.**
2.5.7. Sliders take arrow keys, sortable lists take move-up/move-down, a kanban card takes a "move
to" menu. `[manual: try the interaction with one click, no drag]`

## Screen readers and announcements

**44. A route change updates `document.title`, moves focus to the new page's `<h1>`, and the new
main content is what gets read.**
The framework swaps the DOM without a page load, so nothing tells a screen reader anything changed —
the user is left listening to a page that no longer exists. `[manual: navigate with VoiceOver or NVDA on]`

**45. Anything that appears without the user asking for it is announced by a live region, and that
region exists in the DOM before it has content.**
4.1.3. A live region inserted at the same moment as its message is not announced — the browser had
nothing to observe changing. `[manual: trigger the message with a screen reader on]`

**46. Errors announce assertively (`role="alert"`); everything else announces politely
(`aria-live="polite"`).**
Only an error is worth cutting off what the user is currently listening to. `[manual: review]`

**47. Every image has an `alt` — `alt=""` when it is decorative, and the _meaning_ when it is not.**
An icon's alt is what it tells you, not what it depicts: "sent", not "paper aeroplane".
`[auto: jsx-a11y/alt-text]`

**48. Every icon-only control has an accessible name.**
A button whose entire content is an SVG is announced as "button" — the user is asked to press
something unnamed. `[auto: jsx-a11y/control-has-associated-label]`

**49. Nothing focusable is ever inside `aria-hidden`, and nothing visible is hidden with
`display: none` when it should be `sr-only`.**
Focus landing on an element the screen reader has been told does not exist is silence with no way to
tell why. Use the `sr-only` utility for text meant only for assistive tech. `[auto: axe aria-hidden-focus]`

**50. Prefer semantics to ARIA. No ARIA is better than bad ARIA.**
An ARIA role _replaces_ the element's native semantics rather than adding to them, so a wrong role
removes behaviour that already worked. `[auto: axe aria-allowed-attr, aria-required-attr]`

## Controls and forms

**51. Use the `shared/ui` primitive if one exists. Never restyle a bare element next to one.**
A hand-styled `<button>` beside `Button` is a variant nobody can find and nobody will maintain.
`[manual: review]`

**52. Every control has a visible `<label>` associated with it. A placeholder is never a label.**
The placeholder vanishes the moment the user types, taking the field's name with it — worst for
exactly the users who most need it in view. `[auto: jsx-a11y/label-has-associated-control]`

**53. A placeholder shows an example of the expected format and nothing else.**
`DD/MM/YYYY` is a placeholder. "Date of birth" is a label. `[manual: review]`

**54. Required fields say "required" in the label text.**
An asterisk is a colour-and-glyph convention that has to be learned, and it is often announced as
"star" or not at all. `[manual: review]`

**55. An invalid field carries `aria-invalid="true"` and an `aria-describedby` pointing at its error
message — both added when the error appears and removed when it clears.**
3.3.1. A permanently wired `aria-describedby` means the error text is read on every visit to a field
that is perfectly fine. `[auto: axe aria-valid-attr-value]`

**56. An error message names the field and says how to fix it.**
3.3.3. "Invalid input" tells the user only that they were wrong. "Enter an email address including
an @" tells them what to do next. `[manual: review the message text]`

**57. On a failed submit, focus moves to the first invalid field, and a summary at the top of the
form links to each error.**
Otherwise the user submits, hears nothing, and has to hunt the form for what changed.
`[manual: submit an empty form with a screen reader on]`

**58. Validate on blur and on submit — never on every keystroke.**
Per-keystroke validation tells the user their half-typed email is wrong, which is true and useless.
`[manual: review]`

**59. Never disable a submit button to express "not ready".**
A disabled button is unfocusable, so a keyboard user cannot reach it to discover why it is off. Let
it submit and answer with rule 57 — or use `aria-disabled` with a reason, which stays focusable.
`[manual: review]`

**60. Identity fields carry the right `autocomplete` token.**
1.3.5. It is what lets a password manager fill the form and what lets a browser show the user their
own saved value rather than making them recall it. `[auto: axe autocomplete-valid]`

**61. Password and one-time-code fields accept paste, and no step requires the user to recall or
transcribe anything.**
3.3.8. Blocking paste breaks every password manager, which converts a security feature into a reason
to pick a weaker password. `[manual: paste into the field]`

**62. Never ask again for information already given earlier in the same flow.**
3.3.7. Re-entry is a memory test with a failure mode of abandoning the form. `[manual: walk the flow]`

**63. Pick the `Button` variant by consequence, not by looks: `destructive` for irreversible,
`default` for the primary action, `outline` for a secondary one, `ghost` for a row-level action.**
A confirm that deletes everything should not look like a Save. `[manual: review]`

**64. A destructive action is confirmed, and the confirmation names the specific thing.**
"Delete this?" is unanswerable when two near-identical rows sit next to each other. `[manual: review]`

**65. Help sits in the same place on every page that has it.**
3.2.6. A support link that moves is a support link the user stops looking for. `[manual: review]`

## Feedback and state

**66. Every screen that fetches renders all four states: pending, error, empty, and content.**
Omitting the empty state is the usual miss, and it makes a working screen look broken. `[manual: review]`

**67. The wording is fixed: `Loading <things>…` · `Could not load <things>: <message>` ·
`No <things> have been loaded yet.`**
Consistent phrasing is the cheapest way for a user to tell "nothing matched" from "nothing exists"
from "it broke". `[manual: review the strings]`

**68. A filtered-to-nothing result says so in its own words, separate from the empty state.**
"No results match that search" and "Nothing has been created yet" are different facts, and one of
them is a lie about the data. `[manual: review]`

**69. A pending state holds the space the content will occupy.**
A spinner that collapses to nothing and then expands moves the target the user was about to click.
`[manual: throttle the network and watch for shift]`

**70. `NOT BUILT` — a shared query-state component should own rules 66–69.**
Until it exists, copy the wording exactly. Do not invent a fifth phrasing for a fifth screen.

**71. A toast is never the only place a message appears, and never carries an action or an error.**
It is announced unreliably, it times out before a screen reader reaches it, and its buttons often
cannot be tabbed to before it leaves. Errors belong inline (rules 55–57); actions belong in the
page. `[manual: review]`

**72. A toast that does appear stays at least six seconds, pauses on hover and focus, and is
dismissible.**
Anything faster is unreadable to a slow reader and invisible to anyone who looked away.
`[manual: time it]`

**73. `aria-busy` marks a region that is refreshing; the stale content stays visible underneath.**
Replacing a loaded table with a spinner on every refetch is a screen that flashes empty every few
seconds. `[manual: review]`

## Motion

**74. Motion is opt-in. Animations are declared inside
`@media (prefers-reduced-motion: no-preference)`.**
Declaring animation by default and disabling it in a reduced-motion block means the flash of motion
still ships whenever the override is missed. `[auto: lint:tokens flags animation outside the guard]`

**75. Under reduced motion, keep opacity and colour transitions and drop everything that moves —
parallax, slide-ins, zoom transitions, spinning loaders, autoplaying carousels.**
Reduced does not mean none: a 150ms fade aids comprehension and triggers nothing. Movement across
the viewport is what causes vertigo and nausea. `[manual: enable the OS setting and walk the app]`

**76. Transitions run 200ms or less.**
Past that the interface feels like it is deciding whether to obey. `[manual: review]`

**77. Anything that moves, blinks or autoplays for more than five seconds has a pause control.**
2.2.2. A carousel that advances on its own moves the content out from under a slow reader mid-
sentence. `[manual: review]`

**78. Any non-essential animation triggered by an interaction can be turned off.**
AAA 2.3.3, adopted because rule 74 already delivers it — the guard is the switch. `[manual: review]`

## Tables and data

**79. A table is a `<table>` with a `<caption>` and `scope` on every header cell.**
A grid of `<div>`s loses row-and-column announcement, so a screen reader user hears a stream of
values with nothing saying which column they came from. `[auto: axe th-has-data-cells, scope-attr-valid]`

**80. A column earns its width. Drop a column whose fact is implied by another, or is one click
deeper.**
Every column narrows the ones that are left, and narrow columns wrap, and wrapped rows are hard to
scan. `[manual: review]`

**81. Badges carry state; timestamps and long sentences do not belong in a cell.**
A cell is scanned, not read. `[manual: review]`

**82. A missing value renders `–` in muted text — never blank, never `null`, never `0`.**
Blank reads as a rendering bug, and `0` is a claim about the data that is usually false.
`[manual: review]`

**83. Sortable and filterable state is announced, not just drawn.**
`aria-sort` on the header. An arrow glyph is invisible to the user who most needs to know the table
just reordered under them. `[auto: axe aria-allowed-attr]`

## Words and numbers

**84. Formatting lives in a feature's `*-format.util.ts`, never inline in markup.**
Formatting the same value two ways in two components is the bug this prevents. `[manual: review]`

**85. Formatting only. Anything rule-shaped belongs to the API.**
A unit suffix is formatting; a threshold that decides a colour is a rule, and a rule in the client
is a rule that cannot be tested or trusted. `[manual: review]`

**86. Link text makes sense read on its own.**
2.4.4. Screen reader users list every link on a page — a list of nine "Read more" entries is a list
of nine unknowns. `[auto: jsx-a11y/anchor-has-content, axe link-name]`

**87. Sentence case for everything — headings, buttons, badges, menu items.**
"Party levels", not "Party Levels". One casing rule means no one has to decide. `[manual: review]`

**88. The page has a `lang` attribute, and any passage in another language carries its own.**
3.1.1 and 3.1.2. It is what tells a screen reader which voice and pronunciation rules to use.
`[auto: axe html-has-lang, valid-lang]`
