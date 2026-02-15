import { test, expect } from '@playwright/test'

test.describe('Carteira (Wallet)', () => {
  test('botão Connect Wallet está visível quando desconectado', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeVisible({ timeout: 10000 })
  })

  test('clicar em Connect Wallet abre o modal de conexão', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await expect(page.getByRole('heading', { name: /Connect Wallet/i })).toBeVisible({ timeout: 5000 })
  })

  test('modal de carteira pode ser fechado com Cancel', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    await expect(page.getByRole('heading', { name: /Connect Wallet/i })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /Cancel/i }).click()
    await expect(page.getByRole('heading', { name: /Connect Wallet/i })).not.toBeVisible({ timeout: 3000 })
  })

  test('header mostra link para Home na página de swap', async ({ page }) => {
    await page.goto('/swap')
    await expect(page.getByRole('link', { name: /Home/i })).toBeVisible({ timeout: 10000 })
  })
})
