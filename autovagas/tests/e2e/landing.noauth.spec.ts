/**
 * landing.noauth.spec.ts
 * Tests for the public landing page (no authentication required)
 */

import { test, expect } from '@playwright/test'

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders hero section with correct content', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Candidate-se a vagas no LinkedIn enquanto você dorme.')
    await expect(page.getByRole('link', { name: 'Começar grátis' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Como funciona' })).toBeVisible()
  })

  test('nav has login and signup links', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Começar grátis' }).first()).toBeVisible()
  })

  test('renders stats section', async ({ page }) => {
    await expect(page.getByText('10.000+')).toBeVisible()
    await expect(page.getByText('50.000+')).toBeVisible()
    await expect(page.getByText('2.500+')).toBeVisible()
  })

  test('renders "Como funciona" steps', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Como funciona' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Busca vagas' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Analisa compatibilidade' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Candidata automaticamente' })).toBeVisible()
  })

  test('renders pricing section with 3 plans', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Planos simples e transparentes' })).toBeVisible()
    const planCards = page.locator('section').filter({ hasText: 'Planos simples' }).getByRole('link', { name: 'Começar grátis' })
    await expect(planCards).toHaveCount(3)
  })

  test('clicking "Começar grátis" navigates to sign-up', async ({ page }) => {
    await page.getByRole('link', { name: 'Começar grátis' }).first().click()
    await expect(page).toHaveURL('/sign-up')
  })

  test('clicking "Entrar" navigates to sign-in', async ({ page }) => {
    await page.getByRole('link', { name: 'Entrar' }).click()
    await expect(page).toHaveURL('/sign-in')
  })
})
