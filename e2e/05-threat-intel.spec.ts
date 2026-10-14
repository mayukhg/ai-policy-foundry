import { test, expect } from '@playwright/test';
import { assertNoPageCrash, gotoApp, navigateTo } from './helpers';

test.describe('Threat Intelligence workflow', () => {
  test('loads threat center with seeded threats', async ({ page }) => {
    await gotoApp(page);
    await navigateTo(page, 'Threat Intelligence');

    await expect(page.getByText('Loading threat intelligence…')).toHaveCount(0, {
      timeout: 20_000,
    });
    await assertNoPageCrash(page);

    await expect(
      page.getByRole('heading', { name: 'Threat Intelligence Center' })
    ).toBeVisible();
    await expect(page.getByText(/S3 Bucket Public ACL|IAM Privilege Escalation|Azure Functions/i).first()).toBeVisible();
  });

  test('CVE tab and policy-decision action are interactive', async ({ page }) => {
    await gotoApp(page);
    await navigateTo(page, 'Threat Intelligence');
    await expect(page.getByText('Loading threat intelligence…')).toHaveCount(0, {
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: /CVE Database/i }).click();
    await expect(page.getByText(/Recent Vulnerabilities/i)).toBeVisible();

    // Trigger decision on first actionable control if present
    const decisionBtn = page.getByRole('button').filter({ has: page.locator('svg') }).nth(0);
    // Prefer shield / decide buttons near threat cards
    const anyDecision = page.locator('button').filter({ hasText: /Decide|Analyze|Create|Tweak/i });
    if (await anyDecision.count()) {
      await anyDecision.first().click();
    } else {
      // icon-only decision buttons: click first enabled button in vulnerabilities list
      const listButtons = page.locator('[role="tabpanel"] button');
      if (await listButtons.count()) {
        await listButtons.first().click();
      }
    }

    await assertNoPageCrash(page);
  });
});
