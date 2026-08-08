#!/usr/bin/env python3
"""Scaffold the planning structure the msg-roadmap skills need.

Writes `project.yml`, the four doc folders with their seeded READMEs, one empty
rule doc per area, and installs the sync engine plus its make targets.

Idempotent by construction: every write is skipped when the target already
exists. Re-running it after adding an area fills only the gap.

    python3 .claude/skills/msg-setup/scripts/setup.py --areas back-end,front-end
    python3 .claude/skills/msg-setup/scripts/setup.py --check
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
SKILLS = SKILL_ROOT.parent
ENGINE = SKILLS / "msg-roadmap-sync" / "scripts" / "roadmap_sync.py"

# Every area ships a rule doc. The doc is what `project.yml` points at, and the
# area name is the bullet prefix the roadmap templates enforce.
AREAS: dict[str, tuple[str, str]] = {
    "back-end": ("Back-end", "docs/architecture-api.md"),
    "front-end": ("Front-end", "docs/architecture-web.md"),
    "design": ("Design", "docs/design.md"),
    "database": ("Database", "docs/architecture-data.md"),
    "naming": ("Naming", "docs/naming.md"),
    "gotchas": ("Gotchas", "docs/gotchas.md"),
}

DEFAULT_AREAS = list(AREAS)


def rule_doc(area_label: str) -> str:
    return f"""# {area_label} rules

Rules for anything {area_label.lower()}-shaped. `project.yml` points every
`**{area_label}**` bullet in a roadmap item at this file.

Each rule is one imperative and one line of why. A rule with no why is a
preference, and the next person will not know whether to keep it.

Numbered, because roadmap items cite them by number — renumbering breaks the
citations, so append rather than reorder.

<!-- Nothing here yet. Write the first rule the first time a decision repeats. -->
"""


ROADMAP_README = """# Roadmap

Committed work. One doc per item, numbered on creation — **the number is a
permanent ID, never renumbered**. Ordering lives in this table only.

**Rules**

- Every table below is generated from the docs' metadata headers (`Depends on` /
  `Status` / `Estimate`). **Edit the doc, not the table.**
- Sections: **Ready** (every dependency `done`, not yet finished) first, then
  **Blocked**, each by estimate desc, ties by number asc. Then **Parked**.
  **Done** last, sorted by number asc.
- `Depends on` is roadmap numbers only. `—` means nothing blocks it.
- Status: `not-started` · `in-progress` · `parked` · `done`. Derived from the
  item's task checkboxes whenever a breakdown is open.
- The prose above the table is hand-written and says **why** the next item is
  next. The table sorts by estimate; that sort is not a priority.

**Next up: _nothing yet._**

## Ready

_(none)_

## Blocked

_(none)_

## Parked

_(none)_

## Done

_(none)_
"""

EXPLORATIONS_README = """# Explorations

Ideas being researched rather than committed to. An exploration earns a
**Verdict**, not a Status: `viable, verified` · `viable, not yet spiked` ·
`blocked` · `ruled out`.

Each doc ends with `## Findings` — what the research established, so the
knowledge survives even when the idea never ships.

| # | Idea | Est | Depends on | Verdict |
|---|---|---|---|---|
"""

DITCHED_README = """# Ditched

Ideas that were considered and rejected, kept so the same idea is not re-proposed
from scratch. Every entry says why in terms of a concrete repo reference.

| # | Idea | Ditched | Why not |
|---|---|---|---|
| _(none yet)_ | | | |
"""

TASKS_README = """# Task breakdowns

A roadmap item being implemented gets a folder here: one file per shippable
slice, each with acceptance criteria that double as its tests.

A folder lives only while the item is open. Items — are `done`.

_No breakdown is open. Create one with `/msg-roadmap-task-breakdown NN`._
"""

MAKEFILE_BLOCK = """
# --- msg-roadmap ------------------------------------------------------------
.PHONY: roadmap-sync roadmap-check project-check

roadmap-sync:  ## recompute every derived status and table under docs/
\tpython3 scripts/roadmap_sync.py

roadmap-check:  ## fail if any docs/ table is stale or a dependency does not add up
\tpython3 scripts/roadmap_sync.py --check

project-check:  ## fail if any path named in project.yml does not exist
\tpython3 .claude/skills/msg-setup/scripts/setup.py --check
"""


def project_yml(areas: list[str], vcs: str) -> str:
    lines = [
        "# Project manifest. The msg-roadmap skills read this and nothing else about",
        "# where things live — which is what makes them portable.",
        "#",
        "# Every entry under `areas` points at the doc holding that area's rules. The",
        "# key is also the bullet prefix roadmap items must use, so adding an area here",
        "# adds it to the template's vocabulary.",
        "",
        f"vcs: {vcs}",
        "",
        "structure:",
        "  roadmap: docs/roadmap/",
        "  tasks: docs/tasks/",
        "  explorations: docs/explorations/",
        "  ditched: docs/ditched/",
        "",
        "commands:",
        "  sync: make roadmap-sync",
        "  check: make roadmap-check",
        "",
        "skills:",
        "  plan: /msg-roadmap-plan-item",
        "  breakdown: /msg-roadmap-task-breakdown",
        "  review: /msg-roadmap-task-review",
        "  sync: /msg-roadmap-sync",
        "",
        "areas:",
    ]
    for slug in areas:
        label, doc = AREAS[slug]
        lines.append(f"  {label}: {doc}")
    return "\n".join(lines) + "\n"


def write_if_absent(path: Path, content: str, created: list[str], root: Path) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    created.append(str(path.relative_to(root)))


def parse_areas(raw: str | None) -> list[str]:
    if not raw:
        return DEFAULT_AREAS
    chosen = [a.strip().lower() for a in raw.split(",") if a.strip()]
    unknown = [a for a in chosen if a not in AREAS]
    if unknown:
        raise SystemExit(
            f"error: unknown area(s) {', '.join(unknown)}. "
            f"Known: {', '.join(AREAS)}"
        )
    return chosen


def scaffold(root: Path, areas: list[str], vcs: str) -> list[str]:
    created: list[str] = []

    write_if_absent(root / "project.yml", project_yml(areas, vcs), created, root)

    for folder, readme in (
        ("docs/roadmap", ROADMAP_README),
        ("docs/explorations", EXPLORATIONS_README),
        ("docs/ditched", DITCHED_README),
        ("docs/tasks", TASKS_README),
    ):
        write_if_absent(root / folder / "README.md", readme, created, root)

    for slug in areas:
        label, doc = AREAS[slug]
        write_if_absent(root / doc, rule_doc(label), created, root)

    engine = root / "scripts" / "roadmap_sync.py"
    if not engine.exists():
        engine.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ENGINE, engine)
        created.append(str(engine.relative_to(root)))

    makefile = root / "Makefile"
    if not makefile.exists():
        makefile.write_text(MAKEFILE_BLOCK.lstrip("\n"), encoding="utf-8")
        created.append("Makefile")
    elif "roadmap-sync:" not in makefile.read_text(encoding="utf-8"):
        with makefile.open("a", encoding="utf-8") as handle:
            handle.write(MAKEFILE_BLOCK)
        created.append("Makefile (appended targets)")

    return created


def check(root: Path) -> int:
    """Every path named in project.yml must exist. That is the drift that happens."""
    manifest = root / "project.yml"
    if not manifest.is_file():
        print("error: no project.yml — run /msg-setup", file=sys.stderr)
        return 1

    sys.path.insert(0, str(SKILLS / "msg-roadmap-sync" / "scripts"))
    from roadmap_sync import parse_simple_yaml  # noqa: PLC0415

    raw = parse_simple_yaml(manifest.read_text(encoding="utf-8"))
    missing: list[str] = []
    for block in ("structure", "areas"):
        entries = raw.get(block)
        if not isinstance(entries, dict):
            continue
        for key, value in entries.items():
            target = root / str(value)
            status = "ok" if target.exists() else "MISSING"
            print(f"  {block}.{key} -> {value}  {status}")
            if status == "MISSING":
                missing.append(f"{block}.{key} -> {value}")

    if missing:
        print(
            f"\n{len(missing)} path(s) in project.yml point at nothing.",
            file=sys.stderr,
        )
        return 1
    print("  project.yml is consistent")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", default=".", help="project root (default: cwd)")
    parser.add_argument("--areas", help=f"comma-separated subset of: {', '.join(AREAS)}")
    parser.add_argument("--vcs", default="git", choices=("git", "gitbutler"))
    parser.add_argument("--check", action="store_true",
                        help="verify every path in project.yml exists; write nothing")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if args.check:
        return check(root)

    created = scaffold(root, parse_areas(args.areas), args.vcs)
    for path in created:
        print(f"  created {path}")
    if not created:
        print("  nothing to do — the project is already set up")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
