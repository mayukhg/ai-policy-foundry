import { test, expect } from '@playwright/test';
import { API_URL, AUTH, apiGet, apiPost } from './helpers';

test.describe('Backend API regression (supporting all app flows)', () => {
  test('health endpoint', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });

  test('demo seed status populated', async ({ request }) => {
    const res = await apiGet(request, '/api/demo/status');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.counts.documents).toBeGreaterThan(0);
    expect(body.data.counts.policies).toBeGreaterThan(0);
    expect(body.data.counts.threats).toBeGreaterThan(0);
  });

  test('dashboard overview + activity + alerts', async ({ request }) => {
    const overview = await (await apiGet(request, '/api/dashboard/overview')).json();
    expect(overview.success).toBeTruthy();
    expect(overview.data.activePolicies).toBeGreaterThanOrEqual(0);
    expect(overview.data.agentStatus['policy-generator']).toBeTruthy();

    const activity = await (await apiGet(request, '/api/dashboard/recent-activity')).json();
    expect(activity.success).toBeTruthy();
    expect(Array.isArray(activity.data)).toBeTruthy();

    const alerts = await (await apiGet(request, '/api/dashboard/alerts')).json();
    expect(alerts.success).toBeTruthy();
    expect(Array.isArray(alerts.data)).toBeTruthy();
  });

  test('policies list returns string compliance (UX regression)', async ({ request }) => {
    const body = await (await apiGet(request, '/api/policies')).json();
    expect(body.success).toBeTruthy();
    expect(body.data.length).toBeGreaterThan(0);
    for (const p of body.data) {
      expect(typeof p.compliance).toBe('string');
    }
  });

  test('threats list seeded', async ({ request }) => {
    const body = await (await apiGet(request, '/api/threats')).json();
    expect(body.success).toBeTruthy();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].title).toBeTruthy();
  });

  test('policy review workflow on seeded policy', async ({ request }) => {
    const id = 'synth-policy-aws-s3-conflict';
    const res = await apiPost(request, `/api/policies/${id}/review`, {
      action: 'submit',
      comment: 'e2e regression submit',
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.policy.status).toBe('pending_review');
  });

  test('policy generate returns id + policy text', async ({ request }) => {
    test.setTimeout(180_000);
    const res = await apiPost(request, '/api/policies/generate', {
      service: 'AWS S3',
      requirements: {
        environment: 'production',
        businessUnit: 'corporate',
        compliance: 'CIS',
        additionalRequirements: 'e2e regression generate',
        policyType: 'General Security Policy',
      },
      documentId: 'synth-doc-manual-v2',
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBeTruthy();
    expect(body.data.policy).toBeTruthy();
    expect(body.data.id || body.data.metadata?.name).toBeTruthy();
    expect(body.data.rego || body.data.pipeline).toBeTruthy();
  });

  test('demo reset is idempotent', async ({ request }) => {
    const res = await apiPost(request, '/api/demo/reset', {});
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.counts.policies).toBeGreaterThan(0);
  });
});
