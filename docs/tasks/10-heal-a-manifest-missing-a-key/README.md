# 10 — Heal a manifest missing a top-level key

Sliced at the seam between the healing primitive and its callers: task 01 is a
pure textual function over manifest text with unit tests, task 02 wires it into
`init` and pins how `uninstall` and `check` behave against a healed manifest.

| # | Task | Scope | Depends on | Criteria | Status |
|---|---|---|---|---|---|
| [01](01-add-top-level-key.md) | addTopLevelKey and the expected-key set | back-end | — | 0/7 | not-started |
| [02](02-init-heals-the-manifest.md) | init heals, uninstall and check agree | back-end | 01 | 0/6 | not-started |
