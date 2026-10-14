import { expect, type Page, type APIRequestContext } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
export const AUTH = {
  Authorization: 'Bearer demo-token',
  'x-e2e-bypass': '1',
};

export async function gotoApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AI Policy Foundry' }).first()).toBeVisible();
}

export async function navigateTo(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
}

export async function assertNoPageCrash(page: Page) {
  await expect(page.getByText('This page failed to render.')).toHaveCount(0);
  const main = page.locator('main');
  await expect(main).toBeVisible();
  const text = (await main.innerText()).trim();
  expect(text.length).toBeGreaterThan(20);
}

export async function selectRadixOption(page: Page, labelText: string, optionLabel: string) {
  const field = page.locator('div.space-y-2').filter({ has: page.getByText(labelText, { exact: true }) });
  await field.getByRole('combobox').click();
  await page.getByRole('option', { name: optionLabel, exact: true }).click();
}

export async function apiGet(request: APIRequestContext, path: string) {
  const res = await request.get(`${API_URL}${path}`, { headers: AUTH });
  return res;
}

export async function apiPost(request: APIRequestContext, path: string, data?: unknown) {
  const res = await request.post(`${API_URL}${path}`, {
    headers: { ...AUTH, 'Content-Type': 'application/json' },
    data,
  });
  return res;
}

export async function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}
