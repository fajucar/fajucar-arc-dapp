import { test, expect } from '@playwright/test'

test.describe('Smoke', () => {
  test('app inicia e responde na raiz', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
  })

  test('página principal tem título ou heading', async ({ page }) => {
    await page.goto('/')
    const title = await page.title()
    const hasArc = title.toLowerCase().includes('arc') || await page.locator('text=Arc').first().isVisible().catch(() => false)
    expect(title.length > 0 || hasArc).toBeTruthy()
  })

  test('swap page contém elementos da interface', async ({ page }) => {
    await page.goto('/swap')
    await page.waitForLoadState('networkidle').catch(() => {})
    const body = page.locator('body')
    await expect(body).toContainText(/.+/, { timeout: 10000 })
  })
})
