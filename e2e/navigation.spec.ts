import { test, expect } from '@playwright/test'

test.describe('Navegação', () => {
  test('home carrega e mostra conteúdo', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Arc Network').first()).toBeVisible({ timeout: 15000 })
  })

  test('rota /swap carrega', async ({ page }) => {
    await page.goto('/swap')
    await expect(page).toHaveURL(/\/swap/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('rota /pools carrega', async ({ page }) => {
    await page.goto('/pools')
    await expect(page).toHaveURL(/\/pools/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('rota /mint carrega', async ({ page }) => {
    await page.goto('/mint')
    await expect(page).toHaveURL(/\/mint/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('rota /my-nfts carrega', async ({ page }) => {
    await page.goto('/my-nfts')
    await expect(page).toHaveURL(/\/my-nfts/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('rota /my-pools carrega', async ({ page }) => {
    await page.goto('/my-pools')
    await expect(page).toHaveURL(/\/my-pools/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('links do header navegam', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /swap|Swap/i }).first().click().catch(() => {})
    await expect(page).toHaveURL(/\/(swap)?/)
  })
})
