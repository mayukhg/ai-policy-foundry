import { test, expect } from '@playwright/test';
import {
  assertNoPageCrash,
  gotoApp,
  navigateTo,
  selectRadixOption,
} from './helpers';

test.describe('Policy Generator workflow', () => {
  test('form UX: controls visible and generate disabled without service', async ({ page }) => {
    await gotoApp(page);
    await navigateTo(page, 'Policy Generator');
    await assertNoPageCrash(page);

    await expect(
      page.getByText(/Generate tailored security policies/i)
    ).toBeVisible();
    await expect(page.getByText('Cloud Service', { exact: true })).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: 'Select a cloud service' })).toBeVisible();

    const generateBtn = page.getByRole('button', { name: 'Generate Security Policy' });
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toBeDisabled();
  });

  test('generate policy via OpenRouter and show pipeline/review affordances', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await gotoApp(page);
    await navigateTo(page, 'Policy Generator');
    await assertNoPageCrash(page);

    await selectRadixOption(page, 'Cloud Service', 'AWS S3');
    await selectRadixOption(page, 'Environment', 'Production');

    const generateBtn = page.getByRole('button', { name: 'Generate Security Policy' });
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();
    await expect(page.getByText('Generating Policy...')).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText(/Policy generated successfully|Generated Policy|Generation pipeline/i).first()
    ).toBeVisible({ timeout: 150_000 });

    await assertNoPageCrash(page);

    const submitReview = page.getByRole('button', { name: /Submit for review/i });
    if (await submitReview.isVisible().catch(() => false)) {
      await expect(page.getByRole('button', { name: /^Approve$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Reject$/i })).toBeVisible();
    }
  });
});
