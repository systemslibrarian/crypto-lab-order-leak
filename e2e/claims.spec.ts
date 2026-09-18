import { expect, test } from '@playwright/test'

test('dense OPE sorting recovers every age and reports the computed total', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Age / order' }).click()
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
  await expect(page.locator('[data-score]')).toHaveAttribute('data-score', '240/240')
  await expect(page.getByText('240 MATCHED · 0 MISMATCHED · 0 AMBIGUOUS')).toBeVisible()
})

test('the randomized control cannot query or recover values', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Randomized control' }).click()
  await page.getByRole('button', { name: 'Try a query' }).click()
  await expect(page.getByRole('status')).toContainText('Cannot sort ciphertexts')
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
  await expect(page.locator('[data-score]')).toHaveAttribute('data-score', '0/240')
  await expect(page.getByText('NOTHING RECOVERED', { exact: true })).toBeVisible()
})

test('authenticated deterministic ciphertexts can still be recovered', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Authenticated, never decrypted, and recovered' })).toBeVisible()
  await expect(page.getByText('TAGS VERIFIED')).toBeVisible()
  await expect(page.getByText('The server holds no key')).toBeVisible()
  await page.getByRole('button', { name: 'Run query on ciphertexts' }).click()
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
  await expect(page.locator('[data-score]')).not.toHaveAttribute('data-score', '0/240')
})