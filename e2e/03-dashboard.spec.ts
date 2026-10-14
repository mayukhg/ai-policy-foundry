import { test, expect } from '@playwright/test';
import { assertNoPageCrash, gotoApp, navigateTo } from './helpers';

test.describe('Dashboard workflow', () => {
  test('loads live stats, agents, policies, and alerts', async ({ page }) => {
    await gotoApp(page);
    await navigateTo(page, 'Dashboard');

    await expect(page.getByText('Loading dashboard…')).toHaveCount(0, { timeout: 20_000 });
    await assertNoPageCrash(page);

    await expect(page.getByText('Active Policies')).toBeVisible();
    await expect(page.getByText('Pending Reviews')).toBeVisible();
    await expect(page.getByText('Compliance Score')).toBeVisible();
    await expect(page.getByText('Threat Detections')).toBeVisible();

    // seeded overview values
    await expect(page.getByText('84%')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Agent Status' })).toBeVisible();
    await expect(page.getByText(/document ingestion/i)).toBeVisible();
    await expect(page.getByText(/Parses policy manuals and risk matrices/i)).toBeVisible();
    await expect(page.getByText(/Policy Writer/i)).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Recent Policy Activity' })).toBeVisible();
    await expect(page.getByText('AWS S3').first()).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Threat Intelligence Feed' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate Policy' })).toBeVisible();
  });

  test('does not render raw compliance objects (regression)', async ({ page }) => {
    await gotoApp(page);
    await navigateTo(page, 'Dashboard');
    await expect(page.getByText('Loading dashboard…')).toHaveCount(0, { timeout: 20_000 });
    await assertNoPageCrash(page);
    await expect(page.getByText('[object Object]')).toHaveCount(0);
  });
});
