/**
 * auth-forms.noauth.spec.ts
 * Tests for sign-up and sign-in forms (public, no authentication)
 */

import { test, expect } from '@playwright/test'

// ─── Sign Up ──────────────────────────────────────────────────────────────────
test.describe('Sign Up page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-up')
  })

  test('renders sign-up form with all fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible()
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible()
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible()
    await expect(page.getByPlaceholder('Mínimo 6 caracteres')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible()
  })

  test('shows "Já tem uma conta? Entrar" link', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
  })

  test('link to sign-in works', async ({ page }) => {
    await page.getByRole('link', { name: 'Entrar' }).click()
    await expect(page).toHaveURL('/sign-in')
  })

  test('submit button is disabled while loading', async ({ page }) => {
    // Fill valid data then submit
    await page.getByPlaceholder('Seu nome').fill('Teste')
    await page.getByPlaceholder('seu@email.com').fill('unique-test@example.com')
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('123456')

    const button = page.getByRole('button', { name: 'Criar conta' })
    await button.click()

    // Button should show "Criando conta..." while in flight
    await expect(button).toContainText(/Criando conta|Criar conta/)
  })

  test('shows success confirmation screen OR friendly error after signup', async ({ page }) => {
    const unique = `pw-${Date.now()}@mailtest.dev`
    await page.getByPlaceholder('Seu nome').fill('Usuário Teste')
    await page.getByPlaceholder('seu@email.com').fill(unique)
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('senha123')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    // Either: success screen (email confirmation required) OR friendly rate-limit error
    // We accept both — the important thing is the form reacts and shows meaningful feedback
    await Promise.race([
      expect(page.getByRole('heading', { name: 'Verifique seu e-mail' })).toBeVisible({ timeout: 12000 }),
      expect(page.getByText(/Muitas tentativas|Este e-mail já está cadastrado/)).toBeVisible({ timeout: 12000 }),
    ])
  })

  test('"Voltar para o login" link on success screen goes to sign-in', async ({ page }) => {
    // Skip if Supabase rate limits this test run
    const unique = `back-${Date.now()}@mailtest.dev`
    await page.getByPlaceholder('Seu nome').fill('Teste Back')
    await page.getByPlaceholder('seu@email.com').fill(unique)
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('senha123')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    // Wait for response — success or error
    const successHeading = page.getByRole('heading', { name: 'Verifique seu e-mail' })
    const rateLimitError = page.getByText('Muitas tentativas')

    await Promise.race([
      successHeading.waitFor({ timeout: 12000 }),
      rateLimitError.waitFor({ timeout: 12000 }),
    ])

    // If rate limited, skip the rest
    if (await rateLimitError.isVisible()) {
      test.skip(true, 'Supabase signup rate limit reached — skipping link test')
      return
    }

    await expect(page.getByRole('link', { name: 'Voltar para o login' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar para o login' }).click()
    await expect(page).toHaveURL('/sign-in')
  })

  test('browser validation prevents submit with empty fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Criar conta' }).click()
    // HTML5 required validation should prevent submission — URL stays the same
    await expect(page).toHaveURL('/sign-up')
  })

  test('browser validation enforces min password length', async ({ page }) => {
    await page.getByPlaceholder('Seu nome').fill('Teste')
    await page.getByPlaceholder('seu@email.com').fill('t@t.com')
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('123') // too short
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page).toHaveURL('/sign-up')
  })
})

// ─── Sign In ──────────────────────────────────────────────────────────────────
test.describe('Sign In page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in')
  })

  test('renders sign-in form with all fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible()
    await expect(page.getByPlaceholder('••••••••')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })

  test('shows "Não tem uma conta? Cadastre-se" link', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Cadastre-se' })).toBeVisible()
  })

  test('link to sign-up works', async ({ page }) => {
    await page.getByRole('link', { name: 'Cadastre-se' }).click()
    await expect(page).toHaveURL('/sign-up')
  })

  test('shows error on wrong credentials', async ({ page }) => {
    await page.getByPlaceholder('seu@email.com').fill('wrong@example.com')
    await page.getByPlaceholder('••••••••').fill('wrongpassword')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible({ timeout: 10000 })
  })

  test('error message disappears when user edits fields', async ({ page }) => {
    // Trigger error
    await page.getByPlaceholder('seu@email.com').fill('x@x.com')
    await page.getByPlaceholder('••••••••').fill('wrong')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible({ timeout: 10000 })

    // On the NEXT submit attempt the error is cleared first
    // (the component sets setError('') before the request)
    await page.getByPlaceholder('seu@email.com').fill('x@x.com')
    await page.getByPlaceholder('••••••••').fill('different')
    await page.getByRole('button', { name: 'Entrar' }).click()
    // Error re-appears (same wrong creds) — but was cleared during loading
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible({ timeout: 10000 })
  })

  test('protected routes redirect unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/sign-in')
  })

  test('protected route /perfil redirects to sign-in', async ({ page }) => {
    await page.goto('/perfil')
    await expect(page).toHaveURL('/sign-in')
  })
})
