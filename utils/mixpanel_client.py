"""
Mixpanel client helpers for AI Policy Foundry scripts / Python tooling.
Reads credentials from environment — never hardcode secrets.
"""

import os
from mixpanel import Mixpanel

_token = (
    os.environ.get("MIXPANEL_TOKEN")
    or os.environ.get("MIXPANEL_PROJECT_TOKEN")
    or ""
)

mp = Mixpanel(_token) if _token else None


def track(distinct_id, event, props=None):
    if not mp:
        return
    payload = {"platform": "ai_policy_foundry", **(props or {})}
    mp.track(distinct_id, event, payload)


def set_user(distinct_id, traits):
    if not mp:
        return
    mp.people_set(distinct_id, {"platform": "ai_policy_foundry", **traits})
