/**
 * Exemption management routes — instruments Mixpanel exemption lifecycle events.
 */
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getStore } from '../data/syntheticStore.js';
import { track as mpTrack } from '../utils/mixpanel.js';

const router = express.Router();

function distinctId(req) {
  return req.user?.id || 'anonymous';
}

function role(req) {
  return req.user?.role || 'policy_author';
}

// Ensure store has an exemptions map
function exemptionsMap() {
  const store = getStore();
  if (!store.exemptions) {
    store.exemptions = new Map();
  }
  return store.exemptions;
}

// POST /api/exemptions — request exemption
router.post('/', (req, res) => {
  const {
    policy_id,
    asset_id,
    reason = 'business_need',
    duration_days = 30,
  } = req.body || {};

  if (!policy_id) {
    return res.status(400).json({ success: false, error: 'policy_id required' });
  }

  const exemption = {
    id: uuidv4(),
    policy_id,
    asset_id: asset_id || uuidv4(),
    reason,
    duration_days: Number(duration_days) || 30,
    status: 'requested',
    requested_by_role: role(req),
    createdAt: new Date().toISOString(),
  };

  exemptionsMap().set(exemption.id, exemption);

  mpTrack(distinctId(req), 'exemption_requested', {
    exemption_id: exemption.id,
    policy_id: exemption.policy_id,
    asset_id: exemption.asset_id,
    reason: exemption.reason,
    duration_days: exemption.duration_days,
    requested_by_role: exemption.requested_by_role,
  });

  res.status(201).json({ success: true, data: exemption });
});

// POST /api/exemptions/:id/approve
router.post('/:id/approve', (req, res) => {
  const map = exemptionsMap();
  const exemption = map.get(req.params.id);
  if (!exemption) {
    return res.status(404).json({ success: false, error: 'Exemption not found' });
  }

  const conditions = req.body?.conditions || 'subject to quarterly review';
  exemption.status = 'approved';
  exemption.conditions = conditions;
  exemption.approved_by_role = role(req);
  map.set(exemption.id, exemption);

  mpTrack(distinctId(req), 'exemption_approved', {
    exemption_id: exemption.id,
    policy_id: exemption.policy_id,
    duration_days: exemption.duration_days,
    approved_by_role: exemption.approved_by_role,
    conditions,
  });

  res.json({ success: true, data: exemption });
});

// POST /api/exemptions/:id/deny
router.post('/:id/deny', (req, res) => {
  const map = exemptionsMap();
  const exemption = map.get(req.params.id);
  if (!exemption) {
    return res.status(404).json({ success: false, error: 'Exemption not found' });
  }

  const denial_reason = req.body?.denial_reason || 'does not meet exception criteria';
  exemption.status = 'denied';
  exemption.denial_reason = denial_reason;
  map.set(exemption.id, exemption);

  mpTrack(distinctId(req), 'exemption_denied', {
    exemption_id: exemption.id,
    policy_id: exemption.policy_id,
    denial_reason,
    reviewed_by_role: role(req),
  });

  res.json({ success: true, data: exemption });
});

// POST /api/exemptions/:id/expire
router.post('/:id/expire', (req, res) => {
  const map = exemptionsMap();
  const exemption = map.get(req.params.id);
  if (!exemption) {
    return res.status(404).json({ success: false, error: 'Exemption not found' });
  }

  const auto_enforced = req.body?.auto_enforced !== false;
  exemption.status = 'expired';
  map.set(exemption.id, exemption);

  mpTrack(distinctId(req), 'exemption_expired', {
    exemption_id: exemption.id,
    policy_id: exemption.policy_id,
    asset_id: exemption.asset_id,
    auto_enforced,
  });

  res.json({ success: true, data: exemption });
});

// GET /api/exemptions
router.get('/', (req, res) => {
  const data = [...exemptionsMap().values()];
  mpTrack(distinctId(req), 'foundry_dashboard_viewed', {
    section: 'exemptions',
    platform: 'ai_policy_foundry',
  });
  res.json({ success: true, data, count: data.length });
});

export default router;
