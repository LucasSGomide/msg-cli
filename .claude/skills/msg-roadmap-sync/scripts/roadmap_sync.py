#!/usr/bin/env python3
"""Regenerate every derived table under the docs tree from the docs themselves.

Nothing in markdown computes. This is what makes the derived state real:

- a task's status is the count of its ticked acceptance criteria
- a roadmap item's status is its tasks' statuses, once it has a breakdown
- a roadmap item is Ready when every dependency is done, Blocked when one is not
- every table under the roadmap, explorations, ditched and tasks folders is a
  projection of the docs' metadata headers

What it never does: tick a checkbox, edit a task file, delete a task folder, or
touch hand-written prose. Those are judgement calls and belong to the skill.

Paths come from `project.yml` at the repo root, so this file is the same in every
project that installs it. `msg-setup` writes that file.

    python3 scripts/roadmap_sync.py            # write
    python3 scripts/roadmap_sync.py --check    # verify freshness, exit 1 on drift
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

DASH = "—"
STATUSES = ("not-started", "in-progress", "parked", "done")

TITLE_RE = re.compile(r"^#\s+(\d+)\s+[—-]\s+(.*)$")
FIELD_RE = re.compile(r"\*\*(?P<key>[A-Za-z ]+):\*\*\s*(?P<value>[^·\n]*)")
CHECKBOX_RE = re.compile(r"^\s*-\s+\[( |x)\]", re.IGNORECASE)
TABLE_RE = re.compile(r"^\|.*\|$\n^\|[\s:|-]+\|$\n(?:^\|.*\|$\n)*", re.MULTILINE)

DEFAULT_STRUCTURE = {
    "roadmap": "docs/roadmap/",
    "tasks": "docs/tasks/",
    "explorations": "docs/explorations/",
    "ditched": "docs/ditched/",
}


class DocError(Exception):
    pass


# --------------------------------------------------------------------------- project.yml


def find_root(start: Path) -> Path:
    """Nearest ancestor holding project.yml, else the repo root, else the cwd."""
    for candidate in [start, *start.parents]:
        if (candidate / "project.yml").is_file():
            return candidate
    for candidate in [start, *start.parents]:
        if (candidate / ".git").exists():
            return candidate
    return start


def parse_simple_yaml(text: str) -> dict[str, object]:
    """A deliberately tiny YAML subset: scalars, one level of nesting, flow lists.

    project.yml is a manifest, not a program. Supporting the whole language would
    mean a dependency, and the schema `msg-setup` writes never needs one.
    """
    root: dict[str, object] = {}
    current: dict[str, str] | None = None

    for raw in text.splitlines():
        line = raw.split(" #", 1)[0].rstrip() if " #" in raw else raw.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indented = line[0] in " \t"
        key, _, value = line.strip().partition(":")
        key, value = key.strip(), value.strip()

        if indented and current is not None:
            current[key] = value.strip("'\"")
            continue

        if value == "":
            current = {}
            root[key] = current
        elif value.startswith("[") and value.endswith("]"):
            root[key] = [v.strip().strip("'\"") for v in value[1:-1].split(",") if v.strip()]
            current = None
        else:
            root[key] = value.strip("'\"")
            current = None

    return root


@dataclass
class Config:
    root: Path
    roadmap: Path
    tasks: Path
    explorations: Path
    ditched: Path
    sync_command: str
    breakdown_skill: str

    def rel(self, path: Path) -> str:
        try:
            return str(path.relative_to(self.root))
        except ValueError:
            return str(path)


def load_config() -> Config:
    root = find_root(Path(__file__).resolve().parent)
    raw: dict[str, object] = {}
    manifest = root / "project.yml"
    if manifest.is_file():
        raw = parse_simple_yaml(manifest.read_text(encoding="utf-8"))

    structure = raw.get("structure") if isinstance(raw.get("structure"), dict) else {}
    commands = raw.get("commands") if isinstance(raw.get("commands"), dict) else {}
    skills = raw.get("skills") if isinstance(raw.get("skills"), dict) else {}

    def folder(name: str) -> Path:
        return root / str(structure.get(name) or DEFAULT_STRUCTURE[name]).rstrip("/")

    return Config(
        root=root,
        roadmap=folder("roadmap"),
        tasks=folder("tasks"),
        explorations=folder("explorations"),
        ditched=folder("ditched"),
        sync_command=str(commands.get("sync") or "make roadmap-sync"),
        breakdown_skill=str(skills.get("breakdown") or "/msg-roadmap-task-breakdown"),
    )


CFG = load_config()


# --------------------------------------------------------------------------- parsing


def parse_header(path: Path) -> tuple[int, str, dict[str, str], str]:
    """Return (number, title, header fields, body) for a numbered doc."""
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines:
        raise DocError(f"{path.name}: empty")

    title_match = TITLE_RE.match(lines[0])
    if not title_match:
        raise DocError(f"{path.name}: first line is not `# NN — Title`")
    number, title = int(title_match.group(1)), title_match.group(2).strip()

    header_line = next((line for line in lines[1:6] if line.startswith("**")), None)
    if header_line is None:
        raise DocError(f"{path.name}: no `**Key:** value` metadata header")
    fields = {
        m.group("key").strip(): m.group("value").strip()
        for m in FIELD_RE.finditer(header_line)
    }
    return number, title, fields, text


def parse_deps(raw: str) -> list[str]:
    """`01, 02` -> ['01', '02']; an em dash or blank -> []. Kept as written."""
    if not raw or raw.strip() in {DASH, "-", ""}:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


@dataclass
class RoadmapItem:
    number: int
    title: str
    slug: str
    path: Path
    estimate: str
    status: str
    deps: list[str]
    text: str
    tasks: list["Task"] = field(default_factory=list)

    @property
    def key(self) -> str:
        return f"{self.number:02d}"

    @property
    def dep_numbers(self) -> list[int]:
        return [int(d) for d in self.deps if d.isdigit()]

    @property
    def link(self) -> str:
        return f"[{self.key}]({self.path.name})"


@dataclass
class Task:
    number: int
    title: str
    path: Path
    scope: str
    deps: list[str]
    ticked: int
    total: int

    @property
    def key(self) -> str:
        return f"{self.number:02d}"

    @property
    def status(self) -> str:
        if self.total and self.ticked == self.total:
            return "done"
        return "in-progress" if self.ticked else "not-started"


def load_roadmap() -> dict[int, RoadmapItem]:
    items: dict[int, RoadmapItem] = {}
    for path in sorted(CFG.roadmap.glob("[0-9]*.md")):
        number, title, fields, text = parse_header(path)
        status = fields.get("Status", "").strip()
        if status not in STATUSES:
            raise DocError(f"{path.name}: status {status!r} not one of {STATUSES}")
        if number in items:
            raise DocError(
                f"{path.name}: number {number:02d} is already taken by {items[number].slug}.md"
            )
        items[number] = RoadmapItem(
            number=number,
            title=title,
            slug=path.stem,
            path=path,
            estimate=fields.get("Estimate", "").strip(),
            status=status,
            deps=parse_deps(fields.get("Depends on", "")),
            text=text,
        )
    return items


def load_tasks(items: dict[int, RoadmapItem], problems: list[str]) -> None:
    if not CFG.tasks.is_dir():
        return
    for folder in sorted(p for p in CFG.tasks.glob("[0-9]*-*") if p.is_dir()):
        number = int(folder.name.split("-", 1)[0])
        item = items.get(number)
        if item is None:
            problems.append(f"{CFG.rel(CFG.tasks)}/{folder.name}: no roadmap doc {number:02d}")
            continue
        if folder.name != item.slug:
            problems.append(
                f"{CFG.rel(CFG.tasks)}/{folder.name}: folder should be named {item.slug} "
                "after its roadmap doc"
            )
        for path in sorted(folder.glob("[0-9]*.md")):
            task_number, title, fields, text = parse_header(path)
            body = text.split("## Acceptance criteria", 1)
            if len(body) != 2:
                problems.append(
                    f"{CFG.rel(CFG.tasks)}/{folder.name}/{path.name}: no acceptance criteria"
                )
                continue
            boxes = [m.group(1).lower() for m in
                     (CHECKBOX_RE.match(line) for line in body[1].splitlines()) if m]
            item.tasks.append(
                Task(
                    number=task_number,
                    title=title,
                    path=path,
                    scope=fields.get("Scope", "").strip() or DASH,
                    deps=parse_deps(fields.get("Depends on", "")),
                    ticked=sum(1 for b in boxes if b == "x"),
                    total=len(boxes),
                )
            )
        item.tasks.sort(key=lambda t: t.number)


# --------------------------------------------------------------------------- derivation


def derive_statuses(items: dict[int, RoadmapItem]) -> list[str]:
    """A breakdown's checkboxes win over the roadmap doc's stored status."""
    changes = []
    for item in items.values():
        if not item.tasks:
            continue
        if item.status == "parked":
            continue
        ticked = sum(t.ticked for t in item.tasks)
        total = sum(t.total for t in item.tasks)
        derived = "done" if total and ticked == total else "in-progress" if ticked else "not-started"
        if derived != item.status:
            changes.append(f"roadmap {item.key} {item.status} -> {derived}")
            item.status = derived
            item.text = replace_field(item.text, "Status", derived)
    return changes


def replace_field(text: str, key: str, value: str) -> str:
    return re.sub(
        rf"(\*\*{key}:\*\*\s*)([^·\n]*)",
        lambda m: f"{m.group(1)}{value} " if m.group(2).endswith(" ") else f"{m.group(1)}{value}",
        text,
        count=1,
    )


def section_of(item: RoadmapItem, items: dict[int, RoadmapItem]) -> str:
    if item.status == "done":
        return "Done"
    if item.status == "parked":
        return "Parked"
    blocked = any(
        n in items and items[n].status != "done" for n in item.dep_numbers
    )
    return "Blocked" if blocked else "Ready"


def validate(items: dict[int, RoadmapItem], problems: list[str]) -> None:
    for item in items.values():
        for dep in item.deps:
            if not dep.isdigit():
                problems.append(f"roadmap {item.key}: dependency {dep!r} is not a number")
            elif int(dep) not in items:
                problems.append(f"roadmap {item.key}: depends on {dep}, which does not exist")
            elif int(dep) == item.number:
                problems.append(f"roadmap {item.key}: depends on itself")
        if item.status == "done":
            open_deps = [d for d in item.dep_numbers
                         if d in items and items[d].status != "done"]
            if open_deps:
                problems.append(
                    f"roadmap {item.key}: done, but {', '.join(f'{d:02d}' for d in open_deps)} is not"
                )
            if item.tasks:
                problems.append(
                    f"roadmap {item.key}: done, but {CFG.rel(CFG.tasks)}/{item.slug}/ still "
                    "exists — retire it"
                )
        if not item.estimate.isdigit():
            problems.append(f"roadmap {item.key}: estimate {item.estimate!r} is not a number")


# --------------------------------------------------------------------------- rendering


def render_table(headers: list[str], rows: list[list[str]]) -> str:
    if not rows:
        return "_(none)_\n"
    out = ["| " + " | ".join(headers) + " |",
           "|" + "|".join("---" for _ in headers) + "|"]
    out += ["| " + " | ".join(row) + " |" for row in rows]
    return "\n".join(out) + "\n"


def empty_table(headers: list[str]) -> str:
    """Heading row and separator only — a table that still parses as one."""
    return ("| " + " | ".join(headers) + " |\n"
            + "|" + "|".join("---" for _ in headers) + "|\n")


def sort_queue(entries: list[RoadmapItem]) -> list[RoadmapItem]:
    return sorted(entries, key=lambda i: (-int(i.estimate or 0), i.number))


def roadmap_readme(items: dict[int, RoadmapItem], current: str) -> str:
    buckets: dict[str, list[RoadmapItem]] = {"Ready": [], "Blocked": [], "Parked": [], "Done": []}
    for item in items.values():
        buckets[section_of(item, items)].append(item)

    parts = []
    for name in ("Ready", "Blocked", "Parked", "Done"):
        entries = (sorted(buckets[name], key=lambda i: i.number)
                   if name == "Done" else sort_queue(buckets[name]))
        rows = [[e.link, e.title, e.estimate, ", ".join(e.deps) or DASH, e.status] for e in entries]
        parts.append(f"## {name}\n\n" + render_table(
            ["#", "Item", "Est", "Depends on", "Status"], rows))

    head, marker, _ = current.partition("## Ready")
    if not marker:
        raise DocError(f"{CFG.rel(CFG.roadmap)}/README.md: no `## Ready` heading to regenerate from")
    return head + "\n".join(parts)


def replace_first_table(text: str, table: str, where: str) -> str:
    match = TABLE_RE.search(text)
    if not match:
        raise DocError(f"{where}: no table to regenerate")
    return text[: match.start()] + table + text[match.end():]


def explorations_readme(current: str) -> str:
    rows = []
    for path in sorted(CFG.explorations.glob("[0-9]*.md")):
        number, title, fields, _ = parse_header(path)
        rows.append([
            f"[{number:02d}]({path.name})",
            title,
            fields.get("Estimate", "").strip(),
            ", ".join(parse_deps(fields.get("Depends on", ""))) or DASH,
            fields.get("Verdict", "").strip(),
        ])
    rows.sort(key=lambda r: (-int(r[2] or 0), r[0]))
    headers = ["#", "Idea", "Est", "Depends on", "Verdict"]
    # An empty table keeps its heading row: `_(none)_` would leave nothing for the
    # next run to find, and the run after that would fail with "no table to
    # regenerate". Only ever hit by a project with no explorations yet.
    table = render_table(headers, rows) if rows else empty_table(headers)
    return replace_first_table(current, table, f"{CFG.rel(CFG.explorations)}/README.md")


def first_bullet(text: str, heading: str) -> str:
    section = text.split(heading, 1)
    if len(section) != 2:
        return ""
    for line in section[1].splitlines():
        if line.startswith("- "):
            return line[2:].strip()
        if line.startswith("#"):
            break
    return ""


def ditched_readme(current: str) -> str:
    rows = []
    for path in sorted(CFG.ditched.glob("[0-9]*.md")):
        number, title, fields, text = parse_header(path)
        rows.append([
            f"[{number:02d}]({path.name})",
            title,
            fields.get("Ditched", "").strip(),
            first_bullet(text, "## Why not"),
        ])
    rows.sort(key=lambda r: r[2], reverse=True)
    headers = ["#", "Idea", "Ditched", "Why not"]
    table = render_table(headers, rows) if rows else empty_table(headers)
    return replace_first_table(current, table, f"{CFG.rel(CFG.ditched)}/README.md")


def folder_readme(item: RoadmapItem, current: str) -> str:
    rows = [[
        f"[{t.key}]({t.path.name})",
        t.title,
        t.scope,
        ", ".join(t.deps) or DASH,
        f"{t.ticked}/{t.total}",
        t.status,
    ] for t in item.tasks]
    table = render_table(
        ["#", "Task", "Scope", "Depends on", "Criteria", "Status"], rows)
    return replace_first_table(current, table, f"{CFG.rel(CFG.tasks)}/{item.slug}/README.md")


def compress_numbers(numbers: list[int]) -> str:
    """[1,2,3,10,15,16,17] -> '01–03, 10 and 15–17' — the tasks README's prose line.

    A run of two stays two numbers; a range of one is not a range.
    """
    if not numbers:
        return ""
    groups: list[list[int]] = [[numbers[0]]]
    for n in numbers[1:]:
        (groups[-1].append(n) if n == groups[-1][-1] + 1 else groups.append([n]))
    parts: list[str] = []
    for g in groups:
        parts += ([f"{g[0]:02d}–{g[-1]:02d}"] if len(g) > 2
                  else [f"{n:02d}" for n in g])
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]


def no_breakdown_line() -> str:
    return f"_No breakdown is open. Create one with `{CFG.breakdown_skill} NN`._\n"


def tasks_readme(items: dict[int, RoadmapItem], current: str) -> str:
    open_items = [i for i in sorted(items.values(), key=lambda i: i.number) if i.tasks]
    rows = [[
        f"[{i.key}]({i.slug}/)",
        i.title,
        str(len(i.tasks)),
        f"{sum(1 for t in i.tasks if t.status == 'done')}/{len(i.tasks)}",
        i.status,
    ] for i in open_items]

    done = compress_numbers([i.number for i in sorted(items.values(), key=lambda i: i.number)
                             if i.status == "done"])
    text = re.sub(
        r"Items [^\n]*(?:\n(?!\n)[^\n]*)* are `done`",
        f"Items {done} are `done`",
        current,
        count=1,
    )

    none_open = no_breakdown_line()
    if rows:
        table = render_table(["#", "Roadmap item", "Tasks", "Progress", "Status"], rows)
        if none_open.strip() in text:
            return text.replace(none_open.strip(), table.rstrip("\n"))
        return replace_first_table(text, table, f"{CFG.rel(CFG.tasks)}/README.md")
    match = TABLE_RE.search(text)
    return text[: match.start()] + none_open + text[match.end():] if match else text


# --------------------------------------------------------------------------- driver


def run(check: bool) -> int:
    problems: list[str] = []
    try:
        if not CFG.roadmap.is_dir():
            print(
                f"error: {CFG.rel(CFG.roadmap)}/ does not exist — run /msg-setup first",
                file=sys.stderr,
            )
            return 2

        items = load_roadmap()
        load_tasks(items, problems)
        status_changes = derive_statuses(items)
        validate(items, problems)

        writes: dict[Path, str] = {}
        for item in items.values():
            if item.text != item.path.read_text(encoding="utf-8"):
                writes[item.path] = item.text

        readme = CFG.roadmap / "README.md"
        writes[readme] = roadmap_readme(items, readme.read_text(encoding="utf-8"))

        for folder, builder in (
            (CFG.explorations / "README.md", explorations_readme),
            (CFG.ditched / "README.md", ditched_readme),
        ):
            if folder.exists():
                writes[folder] = builder(folder.read_text(encoding="utf-8"))

        tasks_index = CFG.tasks / "README.md"
        if tasks_index.exists():
            writes[tasks_index] = tasks_readme(items, tasks_index.read_text(encoding="utf-8"))
        for item in items.values():
            path = CFG.tasks / item.slug / "README.md"
            if item.tasks and path.exists():
                writes[path] = folder_readme(item, path.read_text(encoding="utf-8"))
    except DocError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    stale = [p for p, content in writes.items()
             if p.read_text(encoding="utf-8") != content]

    for line in status_changes:
        print(f"  status  {line}")
    for line in problems:
        print(f"  problem {line}")

    if check:
        for path in stale:
            print(f"  stale   {CFG.rel(path)}")
        if stale or problems:
            print(
                f"\n{len(stale)} file(s) stale, {len(problems)} problem(s). "
                f"Run `{CFG.sync_command}`.",
                file=sys.stderr,
            )
            return 1
        print("  roadmap tables are up to date")
        return 0

    for path in stale:
        path.write_text(writes[path], encoding="utf-8")
        print(f"  wrote   {CFG.rel(path)}")
    if not stale and not status_changes:
        print("  nothing to do — every table already matches the docs")

    retire = [i for i in items.values() if i.status == "done" and i.tasks]
    for item in sorted(retire, key=lambda i: i.number):
        print(f"  retire  {CFG.rel(CFG.tasks)}/{item.slug}/ — {item.key} is done")

    return 1 if problems else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true",
                        help="verify the tables are fresh; write nothing, exit 1 on drift")
    return run(parser.parse_args().check)


if __name__ == "__main__":
    raise SystemExit(main())
