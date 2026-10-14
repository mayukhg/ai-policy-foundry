/**
 * Deterministic Mixpanel synthetic dataset for AI Policy Foundry.
 * Produces import-ready events + people profiles + metric coverage report.
 *
 * Window: 12 weeks ending DATASET_END (default 2026-10-14).
 * Designed so every Mixpanel-recommended metric has adequate volume & variance.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRACKING_PLAN = JSON.parse(
  readFileSync(path.join(__dirname, 'tracking-plan.json'), 'utf-8')
);

/** Fixed end date so regenerations stay stable relative to product docs. */
export const DATASET_END = new Date('2026-10-14T23:59:59.000Z');
export const DATASET_WEEKS = 12;
export const USER_COUNT = 120;
export const SEED = 'ai-policy-foundry-mixpanel-v1';

const SIGNUP_METHODS = ['email', 'Google', 'SSO'];
const LOGIN_METHODS = ['email', 'Google', 'SSO'];
const PLANS = ['free', 'pro', 'enterprise'];
const COMPANY_SIZES = ['1-50', '51-200', '201-1000', '1000+'];
const ROLES = ['security_engineer', 'compliance_officer', 'platform_engineer', 'ciso', 'devops'];

const POLICY_TYPES = [
  'General Security Policy',
  'Data Privacy Policy',
  'Access Control Policy',
  'Encryption Policy',
  'Network Security Policy'
];

const CREATION_METHODS = ['from_scratch', 'template', 'AI'];
const SERVICES = [
  'AWS S3',
  'AWS IAM',
  'Azure Functions',
  'Azure Storage',
  'GCP Cloud Storage',
  'GCP BigQuery',
  'Kubernetes'
];
const COMPLIANCE = ['CIS', 'NIST', 'ISO', 'SOC2', 'PCI-DSS'];
const ENVIRONMENTS = ['production', 'staging', 'development'];
const SECTIONS = [
  'encryption',
  'access_control',
  'logging',
  'network',
  'compliance_mapping',
  'threat_mitigation'
];
const EXPORT_FORMATS = ['PDF', 'Word', 'YAML', 'Rego'];
const TEMPLATES = [
  { name: 'CIS AWS S3 Baseline', category: 'cloud_storage' },
  { name: 'NIST Encryption Controls', category: 'encryption' },
  { name: 'ISO Access Control Pack', category: 'iam' },
  { name: 'SOC2 Logging Baseline', category: 'monitoring' },
  { name: 'PCI Network Segmentation', category: 'network' }
];
const MODELS = ['gpt-4o', 'gpt-4-turbo', 'claude-3-5-sonnet'];
const SUGGESTION_TYPES = ['control_addition', 'risk_mitigation', 'rewrite', 'compliance_gap'];
const REJECTION_REASONS = [
  'too_generic',
  'wrong_framework',
  'conflicts_existing',
  'overly_restrictive',
  'incomplete'
];
const REGEN_REASONS = ['quality', 'missing_controls', 'wrong_tone', 'compliance_mismatch'];
const AI_ERROR_TYPES = ['timeout', 'rate_limit', 'invalid_prompt', 'model_unavailable', 'parse_error'];
const SHARE_METHODS = ['link', 'email', 'team'];
const VIEW_SOURCES = ['search', 'dashboard', 'shared_link', 'review_queue', 'recent'];
const SEARCH_QUERIES = [
  's3 public access',
  'encryption at rest',
  'mfa iam',
  'logging retention',
  'gcp storage',
  'azure functions auth',
  'cis benchmark',
  'network policy'
];
const FILTERS = [
  [],
  ['service:AWS S3'],
  ['status:approved'],
  ['compliance:CIS'],
  ['environment:production', 'service:AWS S3'],
  ['status:pending_review', 'compliance:NIST']
];

function mulberry32(a) {
  return function rand() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedToInt(seed) {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 8);
  return parseInt(hex, 16);
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeighted(rng, items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function daysAgo(from, days, hourFrac = 0.5) {
  const d = new Date(from.getTime() - days * 86400000);
  d.setUTCHours(Math.floor(hourFrac * 24), Math.floor((hourFrac * 24 % 1) * 60), 0, 0);
  return d;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function insertId(prefix, n) {
  // Mixpanel: ≤36 bytes, alphanumeric + hyphen
  return `${prefix}-${String(n).padStart(8, '0')}`;
}

function event(name, distinctId, time, props, seq) {
  return {
    event: name,
    properties: {
      time: time.getTime(),
      distinct_id: distinctId,
      $insert_id: insertId('mp', seq),
      ...props
    }
  };
}

function buildUsers(rng) {
  const users = [];
  for (let i = 0; i < USER_COUNT; i++) {
    const plan = pickWeighted(rng, PLANS, [0.55, 0.32, 0.13]);
    const signupMethod = pickWeighted(rng, SIGNUP_METHODS, [0.45, 0.35, 0.2]);
    // Spread signups across 12 weeks with slight front-loading
    const signupDayOffset = Math.floor(Math.pow(rng(), 0.85) * (DATASET_WEEKS * 7 - 1));
    const signupAt = daysAgo(DATASET_END, DATASET_WEEKS * 7 - 1 - signupDayOffset, 0.2 + rng() * 0.6);

    // Cohort personas for metric coverage
    const persona = pickWeighted(
      rng,
      [
        'activated_power', // full funnel + high AI + weekly retention
        'activated_casual', // create + publish, light reuse
        'created_only', // signup + create, never publish
        'onboarded_no_policy', // signup + onboard, no policy
        'signed_up_churn', // signup only / maybe login
        'ai_heavy', // many AI gens + suggestions
        'collaborator' // review/share/comment focused
      ],
      [0.18, 0.22, 0.15, 0.12, 0.1, 0.13, 0.1]
    );

    users.push({
      distinct_id: `user-${String(i + 1).padStart(3, '0')}`,
      plan,
      signup_method: signupMethod,
      login_method: signupMethod === 'email' ? 'email' : signupMethod,
      company_size: pick(rng, COMPANY_SIZES),
      role: pick(rng, ROLES),
      signup_at: signupAt,
      persona,
      // Paid flag for conversion metric
      is_paid: plan === 'pro' || plan === 'enterprise'
    });
  }
  return users;
}

function peopleProfile(user) {
  return {
    $distinct_id: user.distinct_id,
    $properties: {
      $name: `Synthetic User ${user.distinct_id}`,
      $email: `${user.distinct_id}@example.apf.local`,
      plan: user.plan,
      signup_method: user.signup_method,
      company_size: user.company_size,
      role: user.role,
      persona: user.persona,
      is_paid: user.is_paid,
      $created: user.signup_at.toISOString()
    }
  };
}

/**
 * Generate full Mixpanel synthetic dataset.
 */
export function generateMixpanelDataset(options = {}) {
  const seed = options.seed || SEED;
  const rng = mulberry32(seedToInt(seed));
  const users = buildUsers(rng);
  const events = [];
  let seq = 1;

  const push = (name, uid, time, props = {}) => {
    events.push(event(name, uid, time, props, seq++));
  };

  const policyCounter = { n: 0 };
  const nextPolicyId = () => {
    policyCounter.n += 1;
    return `pol-${String(policyCounter.n).padStart(5, '0')}`;
  };

  // Per-user activity for retention / DAU-WAU
  for (const user of users) {
    const uid = user.distinct_id;
    const signupAt = user.signup_at;

    push('Sign Up', uid, signupAt, {
      signup_method: user.signup_method,
      plan: user.plan,
      company_size: user.company_size,
      role: user.role
    });

    // Login frequency by persona (drives DAU/WAU)
    const activeDays = [];
    const daysSinceSignup = Math.max(
      0,
      Math.floor((DATASET_END - signupAt) / 86400000)
    );

    let loginCadence;
    if (user.persona === 'activated_power' || user.persona === 'ai_heavy') {
      loginCadence = 1.4; // ~every 1–2 days
    } else if (user.persona === 'activated_casual' || user.persona === 'collaborator') {
      loginCadence = 3.5;
    } else if (user.persona === 'created_only') {
      loginCadence = 7;
    } else if (user.persona === 'onboarded_no_policy') {
      loginCadence = 14;
    } else {
      loginCadence = 21; // churn
    }

    for (let d = 0; d <= daysSinceSignup; d += Math.max(1, Math.round(loginCadence * (0.7 + rng() * 0.6)))) {
      activeDays.push(d);
    }
    // Ensure at least one login shortly after signup for non-churn (or light for churn)
    if (!activeDays.includes(0)) activeDays.unshift(0);

    for (const d of activeDays) {
      const loginAt = addHours(addDays(signupAt, d), 1 + rng() * 8);
      if (loginAt > DATASET_END) continue;
      push('Login', uid, loginAt, {
        login_method: user.login_method,
        session_id: `sess-${uid}-${d}`
      });
    }

    // Onboarding
    const doesOnboard = !['signed_up_churn'].includes(user.persona) || rng() < 0.25;
    let onboardAt = null;
    if (doesOnboard) {
      const steps = pickWeighted(rng, [3, 4, 5], [0.2, 0.5, 0.3]);
      const minutes = Math.round(4 + rng() * 22);
      onboardAt = addHours(signupAt, 0.2 + rng() * 2);
      if (onboardAt <= DATASET_END) {
        push('Onboarding Completed', uid, onboardAt, {
          steps_completed: steps,
          time_to_complete: minutes * 60 // seconds
        });
      }
    }

    const createsPolicies = [
      'activated_power',
      'activated_casual',
      'created_only',
      'ai_heavy',
      'collaborator'
    ].includes(user.persona);

    if (!createsPolicies) continue;

    // Time to first policy: 0.2–14 days (skewed early for activation)
    const ttfDays = pickWeighted(
      rng,
      [0.25, 0.75, 1.5, 3, 7, 12],
      [0.2, 0.25, 0.2, 0.15, 0.12, 0.08]
    );
    let cursor = addHours(signupAt, ttfDays * 24);
    if (onboardAt && cursor < onboardAt) cursor = addHours(onboardAt, 0.5);

    const policiesOwned = [];
    let weeklyCreates;
    if (user.persona === 'activated_power' || user.persona === 'ai_heavy') {
      weeklyCreates = 1 + Math.floor(rng() * 2); // 1–2 / week
    } else if (user.persona === 'activated_casual') {
      weeklyCreates = rng() < 0.55 ? 1 : 0;
    } else if (user.persona === 'collaborator') {
      weeklyCreates = rng() < 0.4 ? 1 : 0;
    } else {
      weeklyCreates = 1; // created_only: one and done-ish
    }

    const weeksActive = Math.max(1, Math.ceil(daysSinceSignup / 7));
    const maxPolicies =
      user.persona === 'created_only'
        ? 1 + (rng() < 0.3 ? 1 : 0)
        : clamp(Math.round(weeksActive * weeklyCreates * (0.6 + rng() * 0.8)), 1, 18);

    for (let p = 0; p < maxPolicies; p++) {
      if (cursor > DATASET_END) break;

      const policyId = nextPolicyId();
      const policyType = pick(rng, POLICY_TYPES);
      const creationMethod =
        user.persona === 'ai_heavy'
          ? pickWeighted(rng, CREATION_METHODS, [0.1, 0.15, 0.75])
          : pickWeighted(rng, CREATION_METHODS, [0.25, 0.3, 0.45]);
      const service = pick(rng, SERVICES);
      const compliance = pick(rng, COMPLIANCE);
      const environment = pick(rng, ENVIRONMENTS);

      push('Policy Created', uid, cursor, {
        policy_id: policyId,
        policy_type: policyType,
        creation_method: creationMethod,
        service,
        compliance_framework: compliance,
        environment
      });

      if (creationMethod === 'template') {
        const tpl = pick(rng, TEMPLATES);
        push('Policy Template Used', uid, addHours(cursor, 0.01), {
          template_name: tpl.name,
          template_category: tpl.category,
          policy_id: policyId
        });
      }

      // AI generation path
      let aiOk = false;
      if (creationMethod === 'AI' || (user.persona === 'ai_heavy' && rng() < 0.7)) {
        const model = pick(rng, MODELS);
        const startAt = addHours(cursor, 0.02);
        push('AI Generation Started', uid, startAt, {
          policy_type: policyType,
          prompt_length: Math.round(80 + rng() * 900),
          model_used: model,
          service,
          document_id: rng() < 0.65 ? `synth-doc-manual-v${1 + Math.floor(rng() * 2)}` : null
        });

        const succeeds = rng() < 0.92; // ~92% success for metric
        if (succeeds) {
          const genMs = Math.round(2500 + rng() * 28000);
          const doneAt = new Date(startAt.getTime() + genMs);
          push('AI Generation Completed', uid, doneAt, {
            policy_id: policyId,
            generation_time_ms: genMs,
            token_count: Math.round(800 + rng() * 4200),
            model_used: model,
            extraction_mode: pickWeighted(rng, ['baseline', 'delta'], [0.4, 0.6])
          });
          aiOk = true;

          // Suggestions shown → accept/reject (acceptance ~68%)
          const suggestionCount = 1 + Math.floor(rng() * 4);
          for (let s = 0; s < suggestionCount; s++) {
            const sugType = pick(rng, SUGGESTION_TYPES);
            const section = pick(rng, SECTIONS);
            const shownAt = addHours(doneAt, 0.05 + s * 0.08);
            push('AI Suggestion Shown', uid, shownAt, {
              policy_id: policyId,
              suggestion_type: sugType,
              section
            });
            if (rng() < 0.68) {
              push('AI Suggestion Accepted', uid, addHours(shownAt, 0.02), {
                policy_id: policyId,
                suggestion_type: sugType,
                section
              });
            } else {
              push('AI Suggestion Rejected', uid, addHours(shownAt, 0.02), {
                policy_id: policyId,
                rejection_reason: pick(rng, REJECTION_REASONS),
                suggestion_type: sugType,
                section
              });
            }
          }

          if (rng() < 0.28) {
            push('AI Regeneration Requested', uid, addHours(doneAt, 0.4), {
              policy_id: policyId,
              iteration_number: 1 + Math.floor(rng() * 3),
              reason: pick(rng, REGEN_REASONS)
            });
          }
        } else {
          push('AI Generation Failed', uid, addHours(startAt, 0.05 + rng() * 0.3), {
            error_type: pick(rng, AI_ERROR_TYPES),
            policy_type: policyType,
            model_used: model
          });
        }
      }

      // Edits
      const editCount = user.persona === 'created_only' ? (rng() < 0.4 ? 1 : 0) : 1 + Math.floor(rng() * 4);
      for (let e = 0; e < editCount; e++) {
        push('Policy Edited', uid, addHours(cursor, 0.5 + e * 2 + rng()), {
          policy_id: policyId,
          section_edited: pick(rng, SECTIONS),
          edit_count: e + 1
        });
      }

      // Publish (completion rate ~58% overall by persona)
      const publishes =
        user.persona === 'created_only'
          ? false
          : user.persona === 'activated_power' || user.persona === 'ai_heavy'
            ? rng() < 0.82
            : user.persona === 'activated_casual'
              ? rng() < 0.62
              : rng() < 0.45;

      let publishedAt = null;
      if (publishes) {
        const hoursToPublish = 2 + rng() * 72;
        publishedAt = addHours(cursor, hoursToPublish);
        if (publishedAt <= DATASET_END) {
          push('Policy Published', uid, publishedAt, {
            policy_id: policyId,
            policy_type: policyType,
            time_to_publish: Math.round(hoursToPublish * 3600) // seconds
          });
        } else {
          publishedAt = null;
        }
      }

      // Export
      if ((publishedAt || aiOk) && rng() < 0.55) {
        const exportAt = addHours(publishedAt || cursor, 0.3 + rng());
        if (exportAt <= DATASET_END) {
          push('Policy Exported', uid, exportAt, {
            policy_id: policyId,
            export_format: pick(rng, EXPORT_FORMATS)
          });
        }
      }

      // Collaboration
      if (
        publishedAt &&
        (user.persona === 'collaborator' ||
          user.persona === 'activated_power' ||
          rng() < 0.35)
      ) {
        const shareAt = addHours(publishedAt, 0.2);
        if (shareAt <= DATASET_END) {
          push('Policy Shared', uid, shareAt, {
            policy_id: policyId,
            share_method: pick(rng, SHARE_METHODS)
          });
        }
        const reviewAt = addHours(publishedAt, 0.5);
        if (reviewAt <= DATASET_END && rng() < 0.7) {
          push('Review Requested', uid, reviewAt, {
            policy_id: policyId,
            reviewer_count: 1 + Math.floor(rng() * 4)
          });
          const comments = 1 + Math.floor(rng() * 3);
          for (let c = 0; c < comments; c++) {
            push('Comment Added', uid, addHours(reviewAt, 1 + c * 3), {
              policy_id: policyId,
              comment_length: Math.round(40 + rng() * 280)
            });
          }
          if (rng() < 0.65) {
            const approvalDays = 0.5 + rng() * 5;
            const approvedAt = addDays(reviewAt, approvalDays);
            if (approvedAt <= DATASET_END) {
              push('Policy Approved', uid, approvedAt, {
                policy_id: policyId,
                approval_time_days: Math.round(approvalDays * 10) / 10
              });
            }
          }
        }
      }

      // Delete some drafts / stale policies (enough volume for Policy Deleted exploration)
      if ((!publishes && rng() < 0.42) || (publishes && rng() < 0.06)) {
        const ageDays = 3 + Math.floor(rng() * 40);
        const deletedAt = addDays(cursor, ageDays);
        if (deletedAt <= DATASET_END) {
          push('Policy Deleted', uid, deletedAt, {
            policy_id: policyId,
            policy_age_days: ageDays
          });
        }
      }

      policiesOwned.push({ policyId, policyType, createdAt: cursor });

      // Next create: ~weekly for power users, longer gaps otherwise
      const gapDays =
        user.persona === 'activated_power' || user.persona === 'ai_heavy'
          ? 3 + rng() * 6
          : user.persona === 'activated_casual'
            ? 6 + rng() * 10
            : 10 + rng() * 20;
      cursor = addDays(cursor, gapDays);
    }

    // Search & discovery across active span
    const searchCount =
      user.persona === 'signed_up_churn'
        ? 0
        : 2 + Math.floor(rng() * (user.persona === 'collaborator' ? 12 : 8));
    for (let s = 0; s < searchCount; s++) {
      const day = Math.floor(rng() * Math.max(1, daysSinceSignup));
      const searchAt = addHours(addDays(signupAt, day), 2 + rng() * 10);
      if (searchAt > DATASET_END || searchAt < signupAt) continue;
      const filters = pick(rng, FILTERS);
      push('Policy Searched', uid, searchAt, {
        query: pick(rng, SEARCH_QUERIES),
        results_count: Math.floor(rng() * 18),
        filters_applied: filters
      });
    }

    // Views (including from search / dashboard)
    const viewTargets =
      policiesOwned.length > 0
        ? policiesOwned
        : [{ policyId: 'pol-00001', policyType: pick(rng, POLICY_TYPES) }];
    const viewCount = 3 + Math.floor(rng() * 15);
    for (let v = 0; v < viewCount; v++) {
      const day = Math.floor(rng() * Math.max(1, daysSinceSignup));
      const viewAt = addHours(addDays(signupAt, day), 1 + rng() * 12);
      if (viewAt > DATASET_END || viewAt < signupAt) continue;
      const target = pick(rng, viewTargets);
      push('Policy Viewed', uid, viewAt, {
        policy_id: target.policyId,
        policy_type: target.policyType,
        source: pick(rng, VIEW_SOURCES)
      });
    }
  }

  events.sort((a, b) => a.properties.time - b.properties.time);

  // Re-assign insert_ids in time order for cleaner imports
  events.forEach((e, i) => {
    e.properties.$insert_id = insertId('mp', i + 1);
  });

  const people = users.map(peopleProfile);
  const coverage = computeMetricCoverage(events, users);

  return {
    meta: {
      product: 'ai-policy-foundry',
      seed,
      generated_at: new Date().toISOString(),
      dataset_start: daysAgo(DATASET_END, DATASET_WEEKS * 7 - 1).toISOString(),
      dataset_end: DATASET_END.toISOString(),
      weeks: DATASET_WEEKS,
      user_count: users.length,
      event_count: events.length,
      tracking_plan_version: TRACKING_PLAN.version,
      event_names: TRACKING_PLAN.events.map((e) => e.name)
    },
    users: people,
    events,
    coverage
  };
}

function dayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function weekKey(ms) {
  const d = new Date(ms);
  // ISO-ish week bucket: Thursday-based year week
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function computeMetricCoverage(events, users) {
  const byName = {};
  for (const e of events) {
    byName[e.event] = byName[e.event] || [];
    byName[e.event].push(e);
  }

  const count = (name) => (byName[name] || []).length;
  const distinctUsers = (name) => new Set((byName[name] || []).map((e) => e.properties.distinct_id)).size;

  // Activation funnel
  const signedUp = new Set((byName['Sign Up'] || []).map((e) => e.properties.distinct_id));
  const created = new Set((byName['Policy Created'] || []).map((e) => e.properties.distinct_id));
  const published = new Set((byName['Policy Published'] || []).map((e) => e.properties.distinct_id));
  const activatedCreated = [...signedUp].filter((u) => created.has(u)).length;
  const activatedPublished = [...signedUp].filter((u) => created.has(u) && published.has(u)).length;

  // Time to first policy
  const firstCreateByUser = {};
  for (const e of byName['Policy Created'] || []) {
    const id = e.properties.distinct_id;
    if (!firstCreateByUser[id] || e.properties.time < firstCreateByUser[id]) {
      firstCreateByUser[id] = e.properties.time;
    }
  }
  const signupByUser = {};
  for (const e of byName['Sign Up'] || []) {
    signupByUser[e.properties.distinct_id] = e.properties.time;
  }
  const ttfpDays = [];
  for (const [uid, createTs] of Object.entries(firstCreateByUser)) {
    if (signupByUser[uid] != null) {
      ttfpDays.push((createTs - signupByUser[uid]) / 86400000);
    }
  }
  const avgTtfp =
    ttfpDays.length === 0 ? 0 : ttfpDays.reduce((a, b) => a + b, 0) / ttfpDays.length;

  // AI metrics
  const shown = count('AI Suggestion Shown');
  const accepted = count('AI Suggestion Accepted');
  const completed = count('AI Generation Completed');
  const failed = count('AI Generation Failed');

  // Active users = anyone with Login in window
  const activeUsers = distinctUsers('Login');
  const aiUsers = distinctUsers('AI Generation Started');

  // Retention: users with Policy Created in week W who also create in W+1
  const createsByUserWeek = {};
  for (const e of byName['Policy Created'] || []) {
    const uid = e.properties.distinct_id;
    const wk = weekKey(e.properties.time);
    createsByUserWeek[uid] = createsByUserWeek[uid] || new Set();
    createsByUserWeek[uid].add(wk);
  }
  const allWeeks = [...new Set(Object.values(createsByUserWeek).flatMap((s) => [...s]))].sort();
  let retainedPairs = 0;
  let eligiblePairs = 0;
  for (let i = 0; i < allWeeks.length - 1; i++) {
    const w0 = allWeeks[i];
    const w1 = allWeeks[i + 1];
    const cohort = Object.entries(createsByUserWeek)
      .filter(([, weeks]) => weeks.has(w0))
      .map(([uid]) => uid);
    eligiblePairs += cohort.length;
    retainedPairs += cohort.filter((uid) => createsByUserWeek[uid].has(w1)).length;
  }
  const weeklyRetention = eligiblePairs === 0 ? 0 : retainedPairs / eligiblePairs;

  // DAU / WAU stickiness (last 7 days of dataset)
  const windowStart = DATASET_END.getTime() - 7 * 86400000;
  const activityEvents = [
    ...(byName['Login'] || []),
    ...(byName['Policy Created'] || []),
    ...(byName['Policy Viewed'] || []),
    ...(byName['AI Generation Started'] || [])
  ].filter((e) => e.properties.time >= windowStart && e.properties.time <= DATASET_END.getTime());

  const dauByDay = {};
  const wauUsers = new Set();
  for (const e of activityEvents) {
    const d = dayKey(e.properties.time);
    dauByDay[d] = dauByDay[d] || new Set();
    dauByDay[d].add(e.properties.distinct_id);
    wauUsers.add(e.properties.distinct_id);
  }
  const dauValues = Object.values(dauByDay).map((s) => s.size);
  const avgDau = dauValues.length === 0 ? 0 : dauValues.reduce((a, b) => a + b, 0) / dauValues.length;
  const wau = wauUsers.size;
  const stickiness = wau === 0 ? 0 : avgDau / wau;

  // Policies created per user per week
  const createEvents = byName['Policy Created'] || [];
  const createUsers = distinctUsers('Policy Created');
  const policiesPerUserPerWeek =
    createUsers === 0 ? 0 : createEvents.length / createUsers / DATASET_WEEKS;

  // Completion rate
  const completionRate =
    createEvents.length === 0 ? 0 : count('Policy Published') / createEvents.length;

  // Conversion
  const paidSignups = users.filter((u) => u.is_paid).length;
  const conversionRate = users.length === 0 ? 0 : paidSignups / users.length;

  const eventCounts = {};
  for (const spec of TRACKING_PLAN.events) {
    eventCounts[spec.name] = count(spec.name);
  }

  const metrics = {
    activation_funnel: {
      sign_up: signedUp.size,
      first_policy_created: activatedCreated,
      first_policy_published: activatedPublished,
      signup_to_create_rate: signedUp.size ? activatedCreated / signedUp.size : 0,
      create_to_publish_rate: activatedCreated ? activatedPublished / activatedCreated : 0
    },
    time_to_first_policy: {
      sample_size: ttfpDays.length,
      avg_days: Math.round(avgTtfp * 100) / 100,
      p50_days: percentile(ttfpDays, 0.5),
      p90_days: percentile(ttfpDays, 0.9)
    },
    ai_acceptance_rate: {
      shown,
      accepted,
      rejected: count('AI Suggestion Rejected'),
      rate: shown ? accepted / shown : 0
    },
    ai_usage_rate: {
      ai_users: aiUsers,
      active_users: activeUsers,
      rate: activeUsers ? aiUsers / activeUsers : 0
    },
    ai_generation_success_rate: {
      completed,
      failed,
      rate: completed + failed ? completed / (completed + failed) : 0
    },
    weekly_retention_policy_created: {
      eligible_user_week_pairs: eligiblePairs,
      retained_pairs: retainedPairs,
      rate: weeklyRetention
    },
    dau_wau_stickiness: {
      avg_dau: Math.round(avgDau * 100) / 100,
      wau,
      stickiness: Math.round(stickiness * 1000) / 1000,
      window_days: Object.keys(dauByDay).length
    },
    policies_created_per_user_per_week: {
      total_created: createEvents.length,
      distinct_creators: createUsers,
      value: Math.round(policiesPerUserPerWeek * 1000) / 1000
    },
    policy_completion_rate: {
      published: count('Policy Published'),
      created: createEvents.length,
      rate: completionRate
    },
    conversion_rate: {
      paid_signups: paidSignups,
      all_signups: users.length,
      rate: conversionRate
    }
  };

  const adequacy = Object.entries(metrics).map(([id, value]) => {
    const planMetric = TRACKING_PLAN.metrics.find((m) => m.id === id);
    const required = planMetric?.required_events || [];
    const missingEvents = required.filter((n) => (eventCounts[n] || 0) === 0);
    const minVolumeOk = Object.values(eventCounts).every((c) => c > 0);
    return {
      metric_id: id,
      name: planMetric?.name || id,
      adequate: missingEvents.length === 0 && hasSignal(id, value),
      missing_events: missingEvents,
      snapshot: summarize(id, value),
      all_events_present: minVolumeOk
    };
  });

  return {
    event_counts: eventCounts,
    unique_users: users.length,
    total_events: events.length,
    metrics,
    adequacy,
    all_metrics_adequate: adequacy.every((a) => a.adequate),
    notes: [
      'AI Suggestion Shown is included so AI Acceptance Rate has a proper denominator.',
      'Personas intentionally create funnel drop-off, retention variance, and AI success/failure mix.',
      'Import events via Mixpanel /import (JSON array or NDJSON); people profiles via Engage API.'
    ]
  };
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return Math.round(sorted[idx] * 100) / 100;
}

function hasSignal(id, value) {
  switch (id) {
    case 'activation_funnel':
      return value.sign_up > 0 && value.first_policy_created > 0 && value.first_policy_published > 0;
    case 'time_to_first_policy':
      return value.sample_size >= 20;
    case 'ai_acceptance_rate':
      return value.shown >= 50 && value.accepted > 0;
    case 'ai_usage_rate':
      return value.ai_users >= 20 && value.active_users >= 50;
    case 'ai_generation_success_rate':
      return value.completed >= 30 && value.failed >= 3;
    case 'weekly_retention_policy_created':
      return value.eligible_user_week_pairs >= 30;
    case 'dau_wau_stickiness':
      return value.wau >= 15 && value.window_days >= 5;
    case 'policies_created_per_user_per_week':
      return value.total_created >= 50;
    case 'policy_completion_rate':
      return value.created >= 50 && value.published >= 20;
    case 'conversion_rate':
      return value.all_signups >= 50 && value.paid_signups >= 10;
    default:
      return true;
  }
}

function summarize(id, value) {
  if (id === 'activation_funnel') {
    return `${value.sign_up} → ${value.first_policy_created} → ${value.first_policy_published}`;
  }
  if (typeof value.rate === 'number') {
    return `rate=${(value.rate * 100).toFixed(1)}%`;
  }
  if (id === 'time_to_first_policy') {
    return `avg=${value.avg_days}d (n=${value.sample_size})`;
  }
  if (id === 'dau_wau_stickiness') {
    return `DAU=${value.avg_dau} WAU=${value.wau} stickiness=${value.stickiness}`;
  }
  if (id === 'policies_created_per_user_per_week') {
    return `${value.value} policies/user/week`;
  }
  return value;
}

export default generateMixpanelDataset;
