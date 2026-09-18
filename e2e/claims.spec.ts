import { expect, test } from '@playwright/test'

test('dense OPE sorting recovers every age and reports the computed total', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Age / order' }).click()
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
  const verdict = await page.locator('[data-score]').textContent()
  const counts = verdict!.match(/(\d+) MATCHED · (\d+) MISMATCHED · (\d+) AMBIGUOUS/)!.slice(1).map(Number)
  expect(counts.reduce((sum, count) => sum + count, 0)).toBe(240)
  expect(counts).toEqual([240, 0, 0])
})

test('changing auxiliary data retires recovery while a no-op scheme selection does not', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Department / equality' }).click()
  await expect(page.getByRole('button', { name: 'Reveal sealed truth' })).toBeEnabled()
  await page.getByLabel('Public population').selectOption('shifted')
  await expect(page.getByRole('status')).toContainText('Previous recovery retired')
  await expect(page.getByRole('button', { name: 'Reveal sealed truth' })).toBeDisabled()
})

test('tiny datasets warn and hidden content stays unpainted', async ({ page }) => {
  await page.goto('/')
  await page.locator('#row-count').selectOption('24')
  await expect(page.getByText('SAMPLE WARNING', { exact: false })).toBeVisible()
  await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.id = 'hidden-probe'
    probe.hidden = true
    document.body.append(probe)
  })
  await expect(page.locator('#hidden-probe')).toBeHidden()
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
  await expect(page.getByText('The query module holds no key')).toBeVisible()
  await page.getByRole('button', { name: 'Run query on ciphertexts' }).click()
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
  await expect(page.locator('[data-score]')).not.toHaveAttribute('data-score', '0/240')
})

test('pairwise MSDB tree and cumulative matching recover salary but shifted statistics degrade it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Salary / ORE' }).click()
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await expect(page.getByRole('status')).toContainText('28,680 pairwise CLWW comparisons')
  await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
  await expect(page.locator('[data-score]')).toHaveAttribute('data-score', '240/240')

  await page.getByLabel('Public population').selectOption('shifted')
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
  await expect(page.locator('[data-score]')).not.toHaveAttribute('data-score', '240/240')
})

test('mismatched auxiliary support is named and recovery fails closed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Salary / ORE' }).click()
  await page.getByLabel('Public population').selectOption('mismatch')
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await expect(page.getByRole('status')).toContainText('RECOVERY REJECTED: Auxiliary support mismatch')
  await expect(page.getByRole('button', { name: 'Reveal sealed truth' })).toBeDisabled()
})