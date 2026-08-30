# Goal: Open every scaffolded rule doc with a guidelines block that defines how that doc must be written

**Status:** not executed
**Rating:** —
**Run:** sequential — 09 depends on this

## Context

A scaffolded project's rule docs are written by whoever (or whatever) fills
them in, and nothing in the file says what "filled in correctly" means. Today
`--seed` copies an opinionated `templates/docs/<area>.md` and `--no-seed`
writes a near-empty stub from `templates/project/rule-doc.md`; in the unseeded
case the reader gets a title and a sentence, so every project invents its own
shape, verbosity and tone for the same seven documents.

This change puts a **guidelines block** at the top of every rule doc: the
template that doc follows, what information belongs in each of its sections,
and the voice and level of detail to write it in. The block is meta-content
about how to spec the document — it says nothing about the project's actual
architecture, stack or design.

Both install modes get the same block. Unseeded, the block is the whole file:
the doc is a contract waiting to be populated. Seeded, the block sits on top
and the current opinionated content follows it as the worked example of
itself.

## Constraints

1. The block's source is a **new per-area file** under
   `templates/docs/guidelines/<area>.md` — one per area, named to match the
   existing seed names (`architecture-api.md`, `architecture-web.md`,
   `stack-api.md`, `stack-web.md`, `auth.md`, `design.md`, `naming.md`).
2. The CLI **composes at scaffold time** and never stores the composed result:
   - `--no-seed` → guidelines file only.
   - `--seed` → guidelines file, then the existing opinionated
     `templates/docs/<area>.md` below it.
   - `msg add-area` follows the same two paths.
   This is what keeps the two modes from drifting: one source per area,
   prepended either way.
3. Each block is a **shared preamble plus per-area sections**. The preamble
   carries the house style that is identical for all seven docs — voice, rule
   format, numbering, gotcha format — and is authored once in the repo rather
   than retyped per area. The per-area part names that doc's required
   sections and says what belongs in each.
4. In the **scaffolded project** the preamble is copied into every doc, not
   linked. Each `docs/<area>.md` is self-contained: preamble, its own section
   guidance, then content. A doc pasted into a chat carries its own rules.
5. The block **stays in the file permanently**, as visible markdown — not an
   HTML comment, not a `<details>`, not something the populator deletes. It is
   present in seeded docs too, above the existing content. Every later edit to
   the doc is expected to obey it.
6. The meta-text already living inside the opinionated seeds moves **up into
   the block and out of the body** — `design.md`'s "How to read a rule" and
   its `[auto]`/`[manual]` tag table, the "Numbered, and never renumbered —
   append" notes in `auth.md`, `stack-api.md` and `stack-web.md`, the
   symptom/rule gotcha convention, `rule-doc.md`'s "one imperative and one
   line of why". Each rule about how to write the doc ends up stated exactly
   once per file. This means editing the seven opinionated docs, not only
   prepending to them.
7. Scope is **all seven areas plus the generic stub**.
   `templates/project/rule-doc.md` gets the shared preamble and a generic
   section list, so an area added later by `msg add-area` still lands with a
   contract rather than a bare heading.
8. The block is written for **both readers**: an LLM populating the doc and a
   human reviewing against it. No enforcement mechanism ships in this prompt —
   the text in the file is the whole mechanism. Do **not** modify the existing
   skills to read it; the checking skill is prompt 09.
9. Concreteness of the guidelines: name the voice as rules (imperative rule
   plus one line of why; gotchas as symptom then rule; no filler), list the
   required sections, and include **one short worked example** lifted from the
   opinionated docs so the shape is copyable. **State no per-section length
   targets** — a project that needs more context in a section must be free to
   write it.
10. No new CLI flags and no change to the `--seed` / `--no-seed` /
    `--shape skills-only` surface. `skills-only` still writes no docs.
11. Tests: cover the composed output in both modes for at least one area, and
    add a **set-equality test** asserting every slug in `AREAS` has a
    guidelines file and every guidelines file has a slug — the same guard
    `test/unit/skills.test.ts` gives the skills list.
12. Update the README and `src/usage.ts` to say that scaffolded rule docs now
    open with a guidelines block, in both modes.

## Tone

The guidelines text itself is written in the voice of the existing opinionated
docs: direct, imperative, short sentences, one line of why behind each rule,
no filler and no praise. It addresses whoever is about to write the doc.

## Output

Markdown template files under `templates/docs/guidelines/` and an updated
`templates/project/rule-doc.md`, edits to the seven opinionated
`templates/docs/*.md`, TypeScript changes in `src/core/` and `src/commands/`
for the composition, Vitest unit tests, and README/usage updates.

## Examples

The worked example in constraint 9 comes from the docs already in the repo —
e.g. `design.md` rule 46 (imperative, then one line of why, then a tag) and
`stack-api.md` gotcha 2 (symptom, then rule, then a code snippet).
