import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('the production exhibit has no WCAG 2.1 A/AA violations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Order Leak' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)

  for (const prepare of [
    async () => {},
    async () => { await page.getByRole('button', { name: 'Salary / ORE' }).click(); await page.getByRole('button', { name: 'Run recovery' }).click() },
    async () => { await page.getByRole('button', { name: 'Randomized control' }).click(); await page.getByRole('button', { name: 'Run recovery' }).click(); await page.getByRole('button', { name: 'Reveal sealed truth' }).click() },
    async () => { await page.locator('#row-count').selectOption('24') },
  ]) {
    await prepare()
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(scan.violations, JSON.stringify(scan.violations, null, 2)).toEqual([])
    expect(scan.incomplete, JSON.stringify(scan.incomplete, null, 2)).toEqual([])
  }
})