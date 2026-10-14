#!/usr/bin/env python3
"""
Import synthetic Mixpanel people profiles from datasets/users.json via /engage.

Auth: project token in each request body ($token)
Batches: 50 profiles
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[3]
BACKEND_DIR = SCRIPT_DIR.parents[2]

DEFAULT_USERS_PATH = SCRIPT_DIR / "datasets" / "users.json"
ENGAGE_URL = "https://api.mixpanel.com/engage"
BATCH_SIZE = 50


def load_credentials() -> str:
    """Load Mixpanel project token from .env (backend or repo root)."""
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(REPO_ROOT / ".env")

    token = os.getenv("MIXPANEL_PROJECT_TOKEN") or os.getenv("PROJECT_TOKEN")
    if not token:
        print(
            "Missing required env var: MIXPANEL_PROJECT_TOKEN",
            file=sys.stderr,
        )
        sys.exit(1)
    return token


def profile_props(user: dict[str, Any]) -> dict[str, Any]:
    """Extract $set properties from our synthetic user shape or a flat record."""
    if isinstance(user.get("$properties"), dict):
        return dict(user["$properties"])
    if isinstance(user.get("$set"), dict):
        return dict(user["$set"])
    if isinstance(user.get("properties"), dict):
        return dict(user["properties"])

    skip = {"distinct_id", "$distinct_id", "$token", "$ip", "$ignore_time", "$set", "$properties"}
    return {k: v for k, v in user.items() if k not in skip}


def distinct_id(user: dict[str, Any]) -> str | None:
    return user.get("distinct_id") or user.get("$distinct_id")


def to_engage_record(user: dict[str, Any], token: str) -> dict[str, Any] | None:
    uid = distinct_id(user)
    if not uid:
        return None
    return {
        "$token": token,
        "$distinct_id": uid,
        "$set": profile_props(user),
        "$ip": 0,
        "$ignore_time": True,
    }


def chunked(items: list, size: int):
    for i in range(0, len(items), size):
        yield i // size + 1, items[i : i + size]


def import_batch(
    session: requests.Session,
    batch_num: int,
    total_batches: int,
    batch: list[dict[str, Any]],
) -> bool:
    params = {"verbose": "1"}
    headers = {"Content-Type": "application/json", "Accept": "text/plain"}

    try:
        resp = session.post(
            ENGAGE_URL,
            params=params,
            headers=headers,
            json=batch,
            timeout=60,
        )
    except requests.RequestException as exc:
        print(f"[batch {batch_num}/{total_batches}] REQUEST ERROR: {exc}")
        return False

    # Mixpanel engage often returns 200 with {"error":...} when verbose=1
    body_text = resp.text
    ok = 200 <= resp.status_code < 300
    error_in_body = False
    try:
        body = resp.json()
        if isinstance(body, dict) and body.get("error"):
            error_in_body = True
            ok = False
    except ValueError:
        body = None
        # Legacy engage sometimes returns "1" / "0"
        if body_text.strip() in {"0", '"0"'}:
            ok = False

    status_label = "OK" if ok else "FAIL"
    print(
        f"[batch {batch_num}/{total_batches}] {status_label} "
        f"HTTP {resp.status_code} — {len(batch)} profiles"
    )

    if not ok or error_in_body:
        print(f"  response: {body_text[:2000]}")
        if isinstance(body, dict):
            print(f"  parsed: {json.dumps(body, indent=2)[:2000]}")

    return ok


def main() -> int:
    users_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_USERS_PATH
    if not users_path.is_file():
        print(f"Users file not found: {users_path}", file=sys.stderr)
        return 1

    token = load_credentials()

    with users_path.open("r", encoding="utf-8") as f:
        users = json.load(f)

    if not isinstance(users, list):
        print("users.json must be a JSON array", file=sys.stderr)
        return 1

    records: list[dict[str, Any]] = []
    skipped = 0
    for user in users:
        if not isinstance(user, dict):
            skipped += 1
            continue
        record = to_engage_record(user, token)
        if record is None:
            skipped += 1
            continue
        records.append(record)

    total = len(records)
    total_batches = max(1, (total + BATCH_SIZE - 1) // BATCH_SIZE) if total else 0
    print(f"Loaded {len(users)} users from {users_path} → {total} engage records (skipped={skipped})")
    if total == 0:
        print("Nothing to import.")
        return 1

    print(f"Importing people in {total_batches} batch(es) of ≤{BATCH_SIZE}")

    session = requests.Session()
    succeeded = 0
    failed = 0
    for batch_num, batch in chunked(records, BATCH_SIZE):
        if import_batch(session, batch_num, total_batches, batch):
            succeeded += 1
        else:
            failed += 1

    print(f"Done. batches_ok={succeeded} batches_failed={failed} profiles={total}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
