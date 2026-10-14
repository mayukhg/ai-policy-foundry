import { test, expect } from '@playwright/test';
import { assertNoPageCrash, collectConsoleErrors, gotoApp, navigateTo } from './helpers';

test.describe('Navigation & shell UX', () => {
  test('app shell loads with brand and nav', async ({ page }) => {
    const errors = await collectConsoleErrors(page);
    await gotoApp(page);

    await expect(page.getByRole('button', { name: 'Executive Pitch' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Policy Generator' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Threat Intelligence' })).toBeVisible();
    await expect(page.getByText('BP Cloud Security')).toBeVisible();

    const fatal = errors.filter(
      (e) => e.includes('Objects are not valid as a React child') || e.includes('Minified React error')
    );
    expect(fatal, fatal.join('\n')).toHaveLength(0);
  });

  test('switching every page does not blank/crash', async ({ page }) => {
    await gotoApp(page);

    for (const label of [
      'Dashboard',
      'Policy Generator',
      'Threat Intelligence',
      'Executive Pitch',
    ]) {
      await navigateTo(page, label);
      await page.waitForTimeout(800);
      await assertNoPageCrash(page);
      await expect(page.getByText('This page failed to render.')).toHaveCount(0);
    }
  });
});
