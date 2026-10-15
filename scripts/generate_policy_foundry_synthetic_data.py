#!/usr/bin/env python3
"""
Synthetic data generator for AI Policy Foundry Mixpanel analytics.

Setup:  pip install mixpanel faker python-dotenv requests
Run:    python scripts/generate_policy_foundry_synthetic_data.py

Requires in .env (root or backend/.env):
  MIXPANEL_TOKEN (or MIXPANEL_PROJECT_TOKEN)
  MIXPANEL_SERVICE_ACCOUNT_USERNAME (or MIXPANEL_SERVICE_ACCOUNT_USER)
  MIXPANEL_SERVICE_ACCOUNT_SECRET (or MIXPANEL_SERVICE_ACCOUNT_PASS)
  MIXPANEL_PROJECT_ID
"""

from __future__ import annotations

import os
import random
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv
from faker import Faker

# Load .env from repo root and backend/
REPO_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(REPO_ROOT / ".env")
load_dotenv(REPO_ROOT / "backend" / ".env")

TOKEN = (
    os.environ.get("MIXPANEL_TOKEN")
    or os.environ.get("MIXPANEL_PROJECT_TOKEN")
    or ""
)
SA_USERNAME = (
    os.environ.get("MIXPANEL_SERVICE_ACCOUNT_USERNAME")
    or os.environ.get("MIXPANEL_SERVICE_ACCOUNT_USER")
    or ""
)
SA_SECRET = (
    os.environ.get("MIXPANEL_SERVICE_ACCOUNT_SECRET")
    or os.environ.get("MIXPANEL_SERVICE_ACCOUNT_PASS")
    or ""
)
PROJECT_ID = os.environ.get("MIXPANEL_PROJECT_ID") or ""

missing = [
    name
    for name, val in [
        ("MIXPANEL_TOKEN", TOKEN),
        ("MIXPANEL_SERVICE_ACCOUNT_USERNAME", SA_USERNAME),
        ("MIXPANEL_SERVICE_ACCOUNT_SECRET", SA_SECRET),
        ("MIXPANEL_PROJECT_ID", PROJECT_ID),
    ]
    if not val
]
if missing:
    print(f"Missing required env vars: {', '.join(missing)}", file=sys.stderr)
    print("Set them in .env or backend/.env (see .env.example).", file=sys.stderr)
    sys.exit(1)

fake = Faker()
NOW = datetime.utcnow()
NINETY_DAYS_AGO = NOW - timedelta(days=90)

# ── helpers ───────────────────────────────────────────────────────────────────

def clamp_ts(ts: datetime, latest: datetime = None) -> datetime:
    """Mixpanel rejects properties.time in the future — never emit past NOW."""
    latest = latest or NOW
    if ts > latest:
        return latest
    if ts < NINETY_DAYS_AGO:
        return NINETY_DAYS_AGO
    return ts


def rand_date(start: datetime, end: datetime) -> datetime:
    start = clamp_ts(start)
    end = clamp_ts(end)
    if end < start:
        return start
    delta = end - start
    secs = max(0, int(delta.total_seconds()))
    return start + timedelta(seconds=random.randint(0, secs))


def import_events(events: list):
    url = f"https://api.mixpanel.com/import?project_id={PROJECT_ID}&strict=1"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    auth = (SA_USERNAME, SA_SECRET)
    ok_batches = 0
    fail_batches = 0
    for i in range(0, len(events), 200):
        chunk = events[i : i + 200]
        resp = requests.post(url, json=chunk, headers=headers, auth=auth, timeout=120)
        if resp.status_code not in (200, 202):
            fail_batches += 1
            print(f"  ⚠️  Import error ({resp.status_code}): {resp.text[:200]}")
        else:
            ok_batches += 1
            print(f"  ✓  Imported batch {i // 200 + 1} ({len(chunk)} events)")
    print(f"\n   Batches: {ok_batches} ok, {fail_batches} failed")


def set_user_profile(distinct_id: str, traits: dict):
    url = "https://api.mixpanel.com/engage#profile-set"
    payload = [{"$token": TOKEN, "$distinct_id": distinct_id, "$set": traits}]
    requests.post(url, json=payload, timeout=60)


def make_event(distinct_id: str, event_name: str, props: dict, ts: datetime) -> dict:
    safe_ts = clamp_ts(ts)
    # Keep at least 60s before "now" so clock skew / processing delay never marks it future
    max_allowed = NOW - timedelta(seconds=60)
    if safe_ts > max_allowed:
        safe_ts = max_allowed
    return {
        "event": event_name,
        "properties": {
            "distinct_id": distinct_id,
            "token": TOKEN,
            "time": int(safe_ts.timestamp()),
            "$insert_id": str(uuid.uuid4()),
            "platform": "ai_policy_foundry",
            **props,
        },
    }


# ── constants ─────────────────────────────────────────────────────────────────

ROLES = ["policy_author", "policy_reviewer", "compliance_officer", "admin", "viewer"]
POLICY_CATEGORIES = [
    "data_privacy",
    "model_governance",
    "access_control",
    "bias_fairness",
    "transparency",
    "security",
    "operational",
]
FRAMEWORKS = ["gdpr", "nist_ai_rmf", "iso_42001", "eu_ai_act", "hipaa", "sox"]
ASSET_TYPES = ["model", "dataset", "pipeline", "api_endpoint"]
SEVERITIES = ["critical", "high", "medium", "low"]
ENFORCEMENT_MODES = ["hard_block", "soft_warn", "audit_only"]
SECTIONS = [
    "overview",
    "policies",
    "compliance",
    "frameworks",
    "assets",
    "exemptions",
    "audit",
    "settings",
]


# ── user journey ──────────────────────────────────────────────────────────────

def generate_user_journey(user_index: int) -> list:
    distinct_id = str(uuid.uuid4())
    role = random.choice(ROLES)
    is_churned = user_index < 6
    signup_date = rand_date(NINETY_DAYS_AGO, NOW - timedelta(days=35 if is_churned else 3))
    activity_end = (
        signup_date + timedelta(days=random.randint(10, 25)) if is_churned else NOW
    )

    set_user_profile(
        distinct_id,
        {
            "$email": fake.email(),
            "$name": fake.name(),
            "role": role,
            "department": random.choice(
                ["legal", "compliance", "security", "risk", "engineering"]
            ),
            "$created": signup_date.isoformat(),
            "platform": "ai_policy_foundry",
            "is_churned": is_churned,
        },
    )

    events = []

    events.append(
        make_event(
            distinct_id,
            "user_logged_in",
            {"method": random.choice(["email", "sso"]), "role": role},
            signup_date,
        )
    )

    num_policies = random.randint(3, 12)
    for _ in range(num_policies):
        policy_id = str(uuid.uuid4())
        category = random.choice(POLICY_CATEGORIES)
        policy_frameworks = random.sample(FRAMEWORKS, random.randint(1, 3))
        scope = random.choice(["global", "department", "asset_type", "specific_asset"])
        draft_t = rand_date(signup_date, activity_end - timedelta(days=2))
        draft_hours = random.randint(2, 72)
        revision_count = random.randint(0, 4)

        events.append(
            make_event(
                distinct_id,
                "policy_drafted",
                {
                    "policy_id": policy_id,
                    "policy_name": f"{category.replace('_', ' ').title()} Policy",
                    "policy_category": category,
                    "frameworks": policy_frameworks,
                    "scope": scope,
                    "author_role": role,
                },
                draft_t,
            )
        )

        for fw in policy_frameworks:
            events.append(
                make_event(
                    distinct_id,
                    "framework_mapped",
                    {
                        "policy_id": policy_id,
                        "framework": fw,
                        "control_count": random.randint(5, 30),
                        "mapping_completeness": random.randint(60, 100),
                    },
                    draft_t + timedelta(hours=random.randint(1, 12)),
                )
            )

        submit_t = draft_t + timedelta(hours=draft_hours)
        if submit_t >= activity_end:
            continue

        events.append(
            make_event(
                distinct_id,
                "policy_submitted_for_review",
                {
                    "policy_id": policy_id,
                    "policy_category": category,
                    "frameworks": policy_frameworks,
                    "reviewer_count": random.randint(1, 4),
                    "draft_duration_hours": draft_hours,
                },
                submit_t,
            )
        )

        events.append(
            make_event(
                distinct_id,
                "policy_review_requested",
                {
                    "policy_id": policy_id,
                    "reviewer_role": random.choice(
                        ["legal", "compliance", "security", "business"]
                    ),
                    "urgency": random.choice(["standard", "expedited"]),
                },
                submit_t + timedelta(minutes=5),
            )
        )

        review_hours = random.randint(4, 96)
        review_t = submit_t + timedelta(hours=review_hours)
        if review_t >= activity_end:
            continue

        if random.random() < 0.6:
            events.append(
                make_event(
                    distinct_id,
                    "policy_comment_added",
                    {
                        "policy_id": policy_id,
                        "comment_type": random.choice(
                            ["suggestion", "concern", "approval_note", "legal_review"]
                        ),
                        "author_role": random.choice(ROLES),
                    },
                    submit_t + timedelta(hours=random.randint(1, review_hours)),
                )
            )

        if random.random() < 0.8:
            events.append(
                make_event(
                    distinct_id,
                    "policy_approved",
                    {
                        "policy_id": policy_id,
                        "policy_category": category,
                        "frameworks": policy_frameworks,
                        "review_duration_hours": review_hours,
                        "reviewer_role": random.choice(
                            ["policy_reviewer", "compliance_officer", "admin"]
                        ),
                        "revision_count": revision_count,
                    },
                    review_t,
                )
            )

            publish_t = review_t + timedelta(hours=random.randint(1, 24))
            if publish_t >= activity_end:
                continue

            events.append(
                make_event(
                    distinct_id,
                    "policy_published",
                    {
                        "policy_id": policy_id,
                        "policy_category": category,
                        "frameworks": policy_frameworks,
                        "scope": scope,
                        "asset_types_covered": random.sample(
                            ASSET_TYPES, random.randint(1, 4)
                        ),
                        "total_lifecycle_hours": draft_hours
                        + review_hours
                        + random.randint(1, 24),
                    },
                    publish_t,
                )
            )

            if random.random() < 0.75:
                assets_in_scope = random.randint(1, 50)
                enforce_t = publish_t + timedelta(hours=random.randint(1, 48))
                if enforce_t < activity_end:
                    events.append(
                        make_event(
                            distinct_id,
                            "policy_enforced",
                            {
                                "policy_id": policy_id,
                                "policy_category": category,
                                "enforcement_mode": random.choice(ENFORCEMENT_MODES),
                                "assets_in_scope": assets_in_scope,
                            },
                            enforce_t,
                        )
                    )

                    for _ in range(min(assets_in_scope, random.randint(2, 8))):
                        asset_id = str(uuid.uuid4())
                        asset_type = random.choice(ASSET_TYPES)
                        t = rand_date(enforce_t, activity_end)
                        events.append(
                            make_event(
                                distinct_id,
                                "policy_assigned_to_asset",
                                {
                                    "policy_id": policy_id,
                                    "asset_id": asset_id,
                                    "asset_type": asset_type,
                                    "policy_category": category,
                                    "auto_assigned": random.random() < 0.6,
                                },
                                t,
                            )
                        )

                        for _ in range(random.randint(1, 3)):
                            check_id = str(uuid.uuid4())
                            check_t = rand_date(enforce_t, activity_end)
                            fw = random.choice(policy_frameworks)
                            controls = random.randint(5, 20)
                            events.append(
                                make_event(
                                    distinct_id,
                                    "compliance_check_run",
                                    {
                                        "check_id": check_id,
                                        "policy_id": policy_id,
                                        "framework": fw,
                                        "asset_id": asset_id,
                                        "asset_type": asset_type,
                                        "triggered_by": random.choice(
                                            ["scheduled", "manual", "event_triggered"]
                                        ),
                                    },
                                    check_t,
                                )
                            )

                            if random.random() < 0.7:
                                events.append(
                                    make_event(
                                        distinct_id,
                                        "compliance_check_passed",
                                        {
                                            "check_id": check_id,
                                            "policy_id": policy_id,
                                            "framework": fw,
                                            "asset_id": asset_id,
                                            "controls_checked": controls,
                                            "score": random.randint(80, 100),
                                        },
                                        check_t
                                        + timedelta(minutes=random.randint(1, 30)),
                                    )
                                )
                            else:
                                controls_failed = random.randint(1, max(1, controls // 2))
                                severity = random.choice(SEVERITIES)
                                events.append(
                                    make_event(
                                        distinct_id,
                                        "compliance_check_failed",
                                        {
                                            "check_id": check_id,
                                            "policy_id": policy_id,
                                            "framework": fw,
                                            "asset_id": asset_id,
                                            "controls_checked": controls,
                                            "controls_failed": controls_failed,
                                            "severity": severity,
                                            "score": random.randint(20, 79),
                                        },
                                        check_t
                                        + timedelta(minutes=random.randint(1, 30)),
                                    )
                                )
                                events.append(
                                    make_event(
                                        distinct_id,
                                        "policy_violation_reported",
                                        {
                                            "violation_id": str(uuid.uuid4()),
                                            "policy_id": policy_id,
                                            "asset_id": asset_id,
                                            "severity": severity,
                                            "detection_source": "compliance_check",
                                            "auto_remediated": random.random() < 0.35,
                                        },
                                        check_t
                                        + timedelta(minutes=random.randint(5, 60)),
                                    )
                                )

                    if random.random() < 0.15:
                        exemption_id = str(uuid.uuid4())
                        exempt_asset = str(uuid.uuid4())
                        duration = random.choice([30, 60, 90, 180])
                        exempt_t = rand_date(enforce_t, activity_end)
                        events.append(
                            make_event(
                                distinct_id,
                                "exemption_requested",
                                {
                                    "exemption_id": exemption_id,
                                    "policy_id": policy_id,
                                    "asset_id": exempt_asset,
                                    "reason": random.choice(
                                        [
                                            "technical_limitation",
                                            "business_need",
                                            "legacy_system",
                                            "cost_constraint",
                                            "temporary",
                                        ]
                                    ),
                                    "duration_days": duration,
                                    "requested_by_role": role,
                                },
                                exempt_t,
                            )
                        )

                        if random.random() < 0.65:
                            events.append(
                                make_event(
                                    distinct_id,
                                    "exemption_approved",
                                    {
                                        "exemption_id": exemption_id,
                                        "policy_id": policy_id,
                                        "duration_days": random.choice([30, 60, 90]),
                                        "approved_by_role": "compliance_officer",
                                        "conditions": "subject to quarterly review",
                                    },
                                    exempt_t + timedelta(hours=random.randint(4, 48)),
                                )
                            )
                            # Only emit expiry if it falls within the activity window
                            # (Mixpanel rejects future timestamps)
                            expire_t = exempt_t + timedelta(days=min(duration, 14))
                            if expire_t <= activity_end and random.random() < 0.4:
                                events.append(
                                    make_event(
                                        distinct_id,
                                        "exemption_expired",
                                        {
                                            "exemption_id": exemption_id,
                                            "policy_id": policy_id,
                                            "asset_id": exempt_asset,
                                            "auto_enforced": True,
                                        },
                                        expire_t,
                                    )
                                )
                        else:
                            events.append(
                                make_event(
                                    distinct_id,
                                    "exemption_denied",
                                    {
                                        "exemption_id": exemption_id,
                                        "policy_id": policy_id,
                                        "denial_reason": "does not meet exception criteria",
                                        "reviewed_by_role": "compliance_officer",
                                    },
                                    exempt_t + timedelta(hours=random.randint(4, 48)),
                                )
                            )

            if random.random() < 0.2:
                t = rand_date(publish_t, activity_end)
                events.append(
                    make_event(
                        distinct_id,
                        "policy_coverage_gap_detected",
                        {
                            "asset_id": str(uuid.uuid4()),
                            "asset_type": random.choice(ASSET_TYPES),
                            "missing_frameworks": random.sample(
                                FRAMEWORKS, random.randint(1, 2)
                            ),
                            "risk_level": random.choice(SEVERITIES),
                        },
                        t,
                    )
                )

            if random.random() < 0.1:
                events.append(
                    make_event(
                        distinct_id,
                        "policy_updated",
                        {
                            "policy_id": policy_id,
                            "policy_category": category,
                            "change_type": random.choice(["minor", "major"]),
                            "fields_changed": random.sample(
                                ["scope", "controls", "enforcement", "frameworks"],
                                random.randint(1, 2),
                            ),
                        },
                        rand_date(publish_t, activity_end),
                    )
                )

            if random.random() < 0.05:
                events.append(
                    make_event(
                        distinct_id,
                        "policy_deprecated",
                        {
                            "policy_id": policy_id,
                            "policy_category": category,
                            "reason": random.choice(
                                [
                                    "superseded",
                                    "regulatory_change",
                                    "business_change",
                                    "merged",
                                ]
                            ),
                            "replaced_by_policy_id": str(uuid.uuid4())
                            if random.random() < 0.5
                            else None,
                        },
                        rand_date(publish_t, activity_end),
                    )
                )

        else:
            events.append(
                make_event(
                    distinct_id,
                    "policy_rejected",
                    {
                        "policy_id": policy_id,
                        "policy_category": category,
                        "rejection_reason": random.choice(
                            [
                                "incomplete",
                                "conflict",
                                "scope_issue",
                                "legal_review",
                                "other",
                            ]
                        ),
                        "reviewer_role": random.choice(
                            ["policy_reviewer", "compliance_officer"]
                        ),
                    },
                    review_t,
                )
            )

    for _ in range(random.randint(1, 5)):
        t = rand_date(signup_date + timedelta(days=7), activity_end)
        events.append(
            make_event(
                distinct_id,
                "audit_report_generated",
                {
                    "report_id": str(uuid.uuid4()),
                    "report_type": random.choice(
                        [
                            "full_audit",
                            "framework_specific",
                            "asset_coverage",
                            "violation_summary",
                            "executive_brief",
                        ]
                    ),
                    "frameworks_included": random.sample(
                        FRAMEWORKS, random.randint(1, 3)
                    ),
                    "format": random.choice(["pdf", "csv", "json"]),
                    "time_range_days": random.choice([30, 60, 90]),
                    "triggered_by": random.choice(
                        ["scheduled", "manual", "regulator_request"]
                    ),
                },
                t,
            )
        )

    active_days = max(1, int((activity_end - signup_date).days))
    for _ in range(random.randint(8, max(8, active_days * 2))):
        t = rand_date(signup_date + timedelta(hours=1), activity_end)
        events.append(
            make_event(
                distinct_id,
                "foundry_dashboard_viewed",
                {"section": random.choice(SECTIONS)},
                t,
            )
        )

    return events


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    print("🚀 Starting AI Policy Foundry synthetic data generation...\n")
    print(f"   Token (last 4): ...{TOKEN[-4:]}")
    print(f"   Project ID:     {PROJECT_ID}")
    print(f"   Date range:     {NINETY_DAYS_AGO.date()} → {NOW.date()}\n")

    all_events = []
    for i in range(40):
        user_events = generate_user_journey(i)
        all_events.extend(user_events)
        label = "churned" if i < 6 else "active"
        print(f"   👤 User {i + 1:02d}/40 ({label}): {len(user_events)} events")

    print(f"\n📤 Importing {len(all_events)} events to Mixpanel...")
    import_events(all_events)

    print(
        f"""
✅ AI Policy Foundry synthetic data generation complete!
   Users created: 40 (6 churned, 34 active)
   Events sent:   {len(all_events)}
   Date range:    {NINETY_DAYS_AGO.date()} → {NOW.date()}
   Token:         ...{TOKEN[-4:]}
"""
    )


if __name__ == "__main__":
    main()
