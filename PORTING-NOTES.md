# Porting notes — `roadmap_sync.py` → `roadmap-sync.mjs`

The engine was ported from Python to zero-dependency JS so the whole toolchain is
Node. Correctness was established by running both engines over every fixture in
`test/fixtures/projects/`, in both write and `--check` mode, and diffing the
resulting trees, stdout, stderr and exit code:

```sh
git show <rev>:.claude/skills/msg-roadmap-sync/scripts/roadmap_sync.py > /tmp/roadmap_sync.py
node test/tools/parity.mjs --python /tmp/roadmap_sync.py
```

**24 of 26 runs were byte-identical.** The two that differed are listed below and
are deliberate. CI does not run this harness — it diffs the JS engine against the
golden trees in `test/fixtures/golden/`, which were generated once the parity run
was clean, so CI needs no Python and the engine cannot regress silently.

## Deliberate divergences

### 1. A non-numeric estimate no longer crashes

`sort_queue` (py l.367) evaluated `int(i.estimate or 0)` on every queued item.
`validate` records a non-numeric estimate as a problem but keeps going, so an
estimate of `soon` reached `int()` and raised `ValueError` — an uncaught
traceback that regenerated nothing.

The port sorts a non-numeric estimate as `0` and lets the recorded problem stand.
Rationale: a bad estimate is a docs mistake, not a reason to stop every table in
the repo from regenerating. `Number("soon")` would give `NaN` and a comparator
returning `NaN` leaves the order unspecified, so the guard is an explicit
`/^[0-9]+$/` test rather than a bare `Number()`.

Same fix in `explorations_readme`'s row sort, which had the identical latent bug.

### 2. A missing roadmap README exits 2 instead of a traceback

`run` (py l.533) called `readme.read_text()` outside any guard, so a project
whose `docs/roadmap/README.md` was deleted got a `FileNotFoundError` traceback.
The port raises a `DocError` naming the file, which prints `error: …` and exits 2
like every other structural failure.

### 3. Unicode digits are no longer accepted as numbers

Python's `str.isdigit()` is true for `²` and for Arabic-Indic digits, so
`**Estimate:** ٥` passed validation and then behaved unpredictably. The port uses
`/^[0-9]+$/`, which is stricter and matches what the docs actually mean.

### 4. The "run this first" message names the CLI

`error: docs/roadmap/ does not exist — run /msg-setup first` became
``run `npx @lucas-gomide/msg-cli init` first``. The skill can no longer scaffold
on its own, so pointing at it would be a dead end.

## New behaviour

**Manifest paths are checked as a fifth problem class.** `validateManifest`
verifies every path under `structure` and `areas` in `project.yml` exists, and
reports `project.yml <block>.<key> -> <value> points at nothing`. This is what
`setup.py --check` used to do behind a separate `project-check` make target that
hardcoded a Python path; folding it in makes `make roadmap-check` the single
gate. Problems append after `validate`'s, so a project with no manifest produces
byte-identical output to before.

## Structural changes that are not behaviour changes

- **`CFG` is no longer module-level.** Python evaluated `CFG = load_config()` at
  import time (l.140), which made the module impossible to import in a test
  without it resolving a root and reading the filesystem. `loadConfig(startDir)`
  now returns a config that every function takes as its first parameter, and the
  entry point is guarded by an `import.meta.url === pathToFileURL(argv[1]).href`
  check. A test asserts importing the file in an empty cwd writes nothing.
- **`commands:` and `skills:` are no longer read** from `project.yml`. Both
  already had fallbacks (l.135–136); the fallbacks are now the only values.
- **Newlines are normalised on read**, matching Python's universal-newline text
  mode. Without it `TITLE_RE`'s `.` would capture a trailing `\r` from a CRLF
  checkout into every title. The `crlf` fixture covers this and passes
  identically.
- **Dictionaries became `Map`s.** Integer-like keys reorder in a plain JS object,
  which would have silently shuffled the `areas` block and the roadmap items.

## Translation traps worth remembering

| Python                      | JS                              | Why it matters                                                             |
| --------------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| `(?P<k>…)`                  | `(?<k>…)`                       | Named groups differ in syntax only                                         |
| `re.finditer`               | `matchAll` + `/g`               | Reusing a module-level `/g` regex with `.exec` in a loop leaks `lastIndex` |
| `sorted(glob(…))`           | `readdirSync().filter().sort()` | readdir order is filesystem-dependent; `localeCompare` reorders digits     |
| `sort(key=…, reverse=True)` | descending comparator           | `.sort().reverse()` inverts ties; Python's reverse sort is stable          |
| `re.sub(…, count=1)`        | `.replace()` with no `/g`       | And a **function** replacement, so `$&` in the value stays literal         |
| `split(x, 1)`               | `indexOf` + `slice`             | JS `split` has no maxsplit and shatters a doc naming the heading twice     |
| `str.splitlines()`          | custom `splitLines`             | JS `split('\n')` leaves a trailing empty element                           |
