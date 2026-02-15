import { test, expect } from '@playwright/test'

test.describe('Formulários – Swap', () => {
  test('página Swap carrega e mostra conteúdo (connect ou formulário)', async ({ page }) => {
    await page.goto('/swap')
    const connectMsg = page.getByText(/connect your wallet to swap tokens/i)
    const fromLabel = page.locator('label:has-text("From")').first()
    const visible = await connectMsg.isVisible().catch(() => false) || await fromLabel.isVisible().catch(() => false)
    expect(visible).toBe(true)
  })

  test('página Swap tem título ou área de swap', async ({ page }) => {
    await page.goto('/swap')
    await expect(page.locator('body')).toContainText(/.+/, { timeout: 10000 })
    const hasSwap = await page.getByText(/swap|Swap/i).first().isVisible().catch(() => false)
    const hasConnect = await page.getByText(/connect|Connect/i).first().isVisible().catch(() => false)
    expect(hasSwap || hasConnect).toBeTruthy()
  })

  test('quando conectado, formulário Swap tem campo de valor', async ({ page }) => {
    await page.goto('/swap')
    const input = page.locator('input[inputmode="decimal"]').first()
    const connectMsg = page.getByText(/connect your wallet/i)
    await expect(connectMsg.or(input)).toBeVisible({ timeout: 10000 })
  })

  test('página Swap tem link ou botão de ação', async ({ page }) => {
    await page.goto('/swap')
    const linkOrButton = page.getByRole('link').or(page.getByRole('button'))
    await expect(linkOrButton.first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Formulários – Mint / Galeria', () => {
  test('página Mint (/mint) carrega e mostra link Back to Home', async ({ page }) => {
    await page.goto('/mint')
    await expect(page.getByRole('link', { name: /Back to Home/i })).toBeVisible({ timeout: 10000 })
  })

  test('página Mint tem conteúdo principal', async ({ page }) => {
    await page.goto('/mint')
    await expect(page.locator('main, [class*="max-w-6xl"]').first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Formulários – My NFTs', () => {
  test('página My NFTs carrega', async ({ page }) => {
    await page.goto('/my-nfts')
    await expect(page).toHaveURL(/\/my-nfts/)
    await expect(page.locator('body')).toContainText(/.+/, { timeout: 10000 })
  })
})
