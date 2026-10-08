#!/usr/bin/env python3
"""ULTRA desk. One verb per run. State lives next to this file."""

import json
import shutil
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE = ROOT / "state" / "session.json"
CHANGELOG = ROOT / "state" / "changelog.md"
LATEST = ROOT / "outputs" / "latest.md"
JOBS = ROOT / "jobs"
SNAPS = ROOT / "snapshots"
AEDT = timezone(timedelta(hours=10))

VERBS = ("status", "plan", "ask", "build", "review", "save", "search", "next")


def now():
    return datetime.now(AEDT).strftime("%Y-%m-%dT%H:%M:%S+10:00")


def stamp():
    return datetime.now(AEDT).strftime("%Y%m%d-%H%M%S")


def load():
    if not STATE.exists():
        return {"desk": "ultra", "version": "1.0.0", "focus": "", "open": [], "last_output": "outputs/latest.md", "updated": now()}
    try:
        data = json.loads(STATE.read_text())
    except json.JSONDecodeError:
        recover()
        data = json.loads(STATE.read_text())
    data.setdefault("open", [])
    return data


def save_state(data):
    data["updated"] = now()
    STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n")
    tmp.replace(STATE)


def log(line):
    CHANGELOG.parent.mkdir(parents=True, exist_ok=True)
    with CHANGELOG.open("a") as handle:
        handle.write(f"- {now()[:10]} {line}\n")


def write_latest(title, body):
    LATEST.parent.mkdir(parents=True, exist_ok=True)
    LATEST.write_text(f"# {title}\n\n{body.strip()}\n")


def recover():
    snaps = sorted(SNAPS.glob("session-*.json"))
    if not snaps:
        save_state({"desk": "ultra", "version": "1.0.0", "focus": "recovered-empty", "open": [], "last_output": "outputs/latest.md", "updated": now()})
        log("state corrupt and no snapshot; reset session")
        return
    shutil.copy(snaps[-1], STATE)
    log(f"state corrupt; restored {snaps[-1].name}")


def cmd_status(_args):
    data = load()
    open_jobs = data.get("open") or []
    lines = [
        f"desk {data.get('version')}  focus: {data.get('focus') or 'none'}",
        f"updated: {data.get('updated')}",
        f"open jobs: {len(open_jobs)}",
    ]
    for job in open_jobs:
        lines.append(f"  - {job.get('id')}  {job.get('verb')}  {job.get('text')}")
    lines.append("files: " + ", ".join(p.name for p in sorted(ROOT.glob('*.md'))))
    text = "\n".join(lines)
    print(text)
    write_latest("Status", text)


def cmd_plan(args):
    goal = " ".join(args).strip()
    if not goal:
        print("usage: desk.py plan <goal>")
        return 2
    data = load()
    job_id = "job-" + stamp()
    steps = [
        {"role": "Lead", "step": "lock the job sentence"},
        {"role": "State", "step": "confirm file path"},
        {"role": "Operator", "step": "pick one verb"},
        {"role": "Reviewer", "step": "name the failure and the recovery"},
        {"role": "Lead", "step": "write the file and stop"},
    ]
    job = {"id": job_id, "verb": "plan", "text": goal, "steps": steps, "status": "open"}
    data["open"].append(job)
    data["focus"] = goal
    save_state(data)
    JOBS.mkdir(parents=True, exist_ok=True)
    (JOBS / f"{job_id}.json").write_text(json.dumps(job, indent=2) + "\n")
    body = "\n".join(f"{i}. {s['role']}: {s['step']}" for i, s in enumerate(steps, 1))
    write_latest(f"Plan {job_id}", f"Goal: {goal}\n\n{body}")
    log(f"planned {job_id}: {goal}")
    print(f"{job_id}\n{body}")
    return 0


def cmd_ask(args):
    text = " ".join(args).strip()
    if not text:
        print("usage: desk.py ask <question>")
        return 2
    data = load()
    job_id = "ask-" + stamp()
    data["open"].append({"id": job_id, "verb": "ask", "text": text, "status": "open"})
    save_state(data)
    write_latest(job_id, f"Question queued for the lead:\n\n{text}")
    log(f"queued {job_id}")
    print(job_id)
    return 0


def cmd_build(args):
    spec = " ".join(args).strip()
    if not spec:
        print("usage: desk.py build <spec>")
        return 2
    data = load()
    name = "build-" + stamp() + ".md"
    path = ROOT / "outputs" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"# Build\n\nSpec: {spec}\n\nStatus: recorded. Lead writes the real artifact in chat.\n")
    closed = None
    kept = []
    for job in data["open"]:
        if closed is None and job.get("verb") == "plan":
            closed = job["id"]
            continue
        kept.append(job)
    data["open"] = kept
    data["focus"] = spec
    save_state(data)
    write_latest("Build", f"Spec: {spec}\nFile: outputs/{name}\nClosed: {closed or 'none'}")
    log(f"build recorded outputs/{name}")
    print(f"outputs/{name}")
    return 0


def cmd_review(args):
    if not args:
        print("usage: desk.py review <file>")
        return 2
    target = Path(args[0])
    if not target.is_absolute():
        target = (ROOT / args[0]).resolve()
    if not target.exists():
        print(f"missing: {target}")
        return 1
    text = target.read_text(errors="replace")
    notes = []
    if len(text.strip()) < 40:
        notes.append("too short to be a deliverable")
    if "TODO" in text or "TBD" in text:
        notes.append("contains TODO/TBD")
    if not notes:
        notes.append("readable, no TODO markers, length ok")
    body = f"File: {target.name}\nLines: {text.count(chr(10)) + 1}\n" + "\n".join(f"- {n}" for n in notes)
    write_latest("Review", body)
    log(f"reviewed {target.name}")
    print(body)
    return 0


def cmd_save(_args):
    data = load()
    SNAPS.mkdir(parents=True, exist_ok=True)
    dest = SNAPS / f"session-{stamp()}.json"
    dest.write_text(json.dumps(data, indent=2) + "\n")
    snaps = sorted(SNAPS.glob("session-*.json"))
    for old in snaps[:-3]:
        old.unlink()
    log(f"snapshot {dest.name}")
    print(dest)
    return 0


def cmd_search(args):
    topic = " ".join(args).strip()
    if not topic:
        print("usage: desk.py search <topic>")
        return 2
    write_latest("Search topic", topic + "\n\nWeb search stays with the lead. This verb only records the topic.")
    log("search topic recorded")
    print(topic)
    return 0


def cmd_next(_args):
    data = load()
    open_jobs = data.get("open") or []
    if not open_jobs:
        print("no open jobs")
        return 0
    print(json.dumps(open_jobs[0], indent=2))
    return 0


def main(argv):
    if len(argv) < 2 or argv[1] not in VERBS:
        print("verbs: " + " ".join(VERBS))
        return 2
    verb = argv[1]
    args = argv[2:]
    return {
        "status": cmd_status,
        "plan": cmd_plan,
        "ask": cmd_ask,
        "build": cmd_build,
        "review": cmd_review,
        "save": cmd_save,
        "search": cmd_search,
        "next": cmd_next,
    }[verb](args)


if __name__ == "__main__":
    sys.exit(main(sys.argv) or 0)
