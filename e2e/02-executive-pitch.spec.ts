import { test, expect } from '@playwright/test';
import { assertNoPageCrash, gotoApp, navigateTo } from './helpers';

test.describe('Executive Pitch workflow', () => {
  test('shows briefing hero, summary, ROI, and CTAs', async ({ page }) => {
    await gotoApp(page);
    await navigateTo(page, 'Executive Pitch');
    await assertNoPageCrash(page);

    await expect(page.getByText('Executive Briefing • Confidential')).toBeVisible();
    await expect(
      page.getByText(/Transform BP's Cloud Security Posture/i)
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Executive Summary' })).toBeVisible();
    await expect(page.getByText(/312%/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request Executive Demo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download ROI Analysis' })).toBeVisible();
  });
});
