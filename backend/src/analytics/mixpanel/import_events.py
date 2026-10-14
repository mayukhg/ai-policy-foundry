#!/usr/bin/env python3
"""
Import synthetic Mixpanel events from datasets/events.json via the REST /import API.

Auth: HTTP Basic (service account user + secret)
Batches: 2000 events
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[3]  # .../ai-policy-foundry-7
BACKEND_DIR = SCRIPT_DIR.parents[2]  # .../backend

DEFAULT_EVENTS_PATH = SCRIPT_DIR / "datasets" / "events.json"
IMPORT_URL = "https://api.mixpanel.com/import"
BATCH_SIZE = 2000


def load_credentials() -> tuple[str, str, str]:
    """Load Mixpanel service-account credentials from .env (backend or repo root)."""
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(REPO_ROOT / ".env")

    user = os.getenv("MIXPANEL_SERVICE_ACCOUNT_USER") or os.getenv("SERVICE_ACCOUNT_USER")
    password = os.getenv("MIXPANEL_SERVICE_ACCOUNT_PASS") or os.getenv("SERVICE_ACCOUNT_PASS")
    project_id = os.getenv("MIXPANEL_PROJECT_ID") or os.getenv("PROJECT_ID")

    missing = [
        name
        for name, val in [
            ("MIXPANEL_SERVICE_ACCOUNT_USER", user),
            ("MIXPANEL_SERVICE_ACCOUNT_PASS", password),
            ("MIXPANEL_PROJECT_ID", project_id),
        ]
        if not val
    ]
    if missing:
        print(f"Missing required env vars: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    return user, password, project_id


def chunked(items: list, size: int):
    for i in range(0, len(items), size):
        yield i // size + 1, items[i : i + size]


def import_batch(
    session: requests.Session,
    batch_num: int,
    total_batches: int,
    batch: list,
    project_id: str,
) -> bool:
    params = {"strict": "1", "project_id": project_id}
    headers = {"Content-Type": "application/json", "Accept": "application/json"}

    try:
        resp = session.post(
            IMPORT_URL,
            params=params,
            headers=headers,
            json=batch,
            timeout=120,
        )
    except requests.RequestException as exc:
        print(f"[batch {batch_num}/{total_batches}] REQUEST ERROR: {exc}")
        return False

    ok = 200 <= resp.status_code < 300
    status_label = "OK" if ok else "FAIL"
    print(
        f"[batch {batch_num}/{total_batches}] {status_label} "
        f"HTTP {resp.status_code} — {len(batch)} events"
    )

    if resp.status_code == 400:
        print(f"  400 detail (raw): {resp.text[:4000]}")
        try:
            body = resp.json()
            print(f"  400 detail (json): {json.dumps(body, indent=2)[:4000]}")
            # Mixpanel often returns failed records under these keys
            for key in ("failed_records", "error", "errors", "code", "num_records_imported"):
                if key in body:
                    print(f"  · {key}: {body[key]}")
        except ValueError:
            pass
    elif not ok:
        print(f"  response: {resp.text[:2000]}")

    return ok


def main() -> int:
    events_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_EVENTS_PATH
    if not events_path.is_file():
        print(f"Events file not found: {events_path}", file=sys.stderr)
        return 1

    user, password, project_id = load_credentials()

    with events_path.open("r", encoding="utf-8") as f:
        events = json.load(f)

    if not isinstance(events, list):
        print("events.json must be a JSON array", file=sys.stderr)
        return 1

    total = len(events)
    total_batches = max(1, (total + BATCH_SIZE - 1) // BATCH_SIZE)
    print(f"Loaded {total} events from {events_path}")
    print(f"Importing to project_id={project_id} in {total_batches} batch(es) of ≤{BATCH_SIZE}")

    session = requests.Session()
    session.auth = (user, password)

    succeeded = 0
    failed = 0
    for batch_num, batch in chunked(events, BATCH_SIZE):
        if import_batch(session, batch_num, total_batches, batch, project_id):
            succeeded += 1
        else:
            failed += 1

    print(f"Done. batches_ok={succeeded} batches_failed={failed} events={total}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
