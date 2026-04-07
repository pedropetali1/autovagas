/**
 * new-user-flow.spec.ts
 *
 * End-to-end tests for the authenticated new-user onboarding journey:
 *   1. Redirect to /perfil?setup=1 when profile is incomplete
 *   2. Profile setup (desiredRole, skills, CV placeholder)
 *   3. Dashboard navigation and core UI
 *   4. Vagas page (empty state for new user)
 *   5. Planos page
 *   6. Schedule and automation toggle on dashboard
 *
 * Strategy: wait for concrete UI elements that only appear after data loads
 * (not waitForLoadState('networkidle') which races with React Query fetches).
 */

import { test, expect } from '@playwright/test'

// Helper: wait until the profile data is loaded (form/content visible, skeleton gone)
async function waitForProfileData(page: import('@playwright/test').Page) {
  // The "Adicionar" button only appears after isLoading becomes false
  await expect(page.getByRole('button', { name: 'Adicionar' })).toBeVisible({ timeout: 20000 })
}

// Helper: ensure profile is complete enough to reach /dashboard
async function completeProfileMinimum(page: import('@playwright/test').Page) {
  await page.goto('/perfil')
  await waitForProfileData(page)

  // Set desiredRole if empty
  const roleInput = page.getByPlaceholder('Ex: Desenvolvedor Full Stack')
  const currentRole = await roleInput.inputValue()
  if (!currentRole) {
    await roleInput.fill('Engenheiro de Software')
    await page.getByRole('button', { name: 'Salvar perfil' }).click()
    await expect(page.getByText('Perfil salvo')).toBeVisible({ timeout: 15000 })
  }

  // Add skills until we have at least 3
  const skillInput = page.getByPlaceholder('Ex: React, Node.js')
  const addBtn = page.getByRole('button', { name: 'Adicionar' })
  for (const skill of ['React', 'TypeScript', 'Node.js']) {
    const tag = page.locator('[class*="rounded-full"]').filter({ hasText: skill }).first()
    if (!(await tag.isVisible().catch(() => false))) {
      await skillInput.fill(skill)
      await addBtn.click()
      await expect(page.locator('[class*="rounded-full"]').filter({ hasText: skill }).first()).toBeVisible({ timeout: 10000 })
    }
  }
}

test.describe('New user onboarding flow', () => {
  // ── Profile setup ────────────────────────────────────────────────────────────

  test('redirects to /perfil?setup=1 because profile is incomplete', async ({ page }) => {
    await page.goto('/dashboard')
    // New user with no desiredRole → dashboard redirects to setup
    await expect(page).toHaveURL(/\/perfil\?setup=1/, { timeout: 20000 })
  })

  test('shows setup banner with missing items on /perfil?setup=1', async ({ page }) => {
    await page.goto('/perfil?setup=1')
    await waitForProfileData(page)

    await expect(page.getByText('Complete seu perfil para ativar a automação')).toBeVisible({ timeout: 15000 })
    // At least one missing item listed
    const banner = page.locator('[class*="bg-\\[#1a2a1a\\]"]').first()
    await expect(banner).toBeVisible()
  })

  test('profile page renders all sections', async ({ page }) => {
    await page.goto('/perfil')
    await expect(page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible()
    await expect(page.getByText('Dados pessoais')).toBeVisible()
    await expect(page.getByText('Habilidades')).toBeVisible()
    await expect(page.getByText('Currículo (CV)')).toBeVisible()
    await expect(page.getByText('Notificações')).toBeVisible()
    await expect(page.getByText('Filtros')).toBeVisible()
  })

  test('can fill and save personal data (desiredRole)', async ({ page }) => {
    await page.goto('/perfil')
    await waitForProfileData(page)

    const desiredRoleInput = page.getByPlaceholder('Ex: Desenvolvedor Full Stack')
    await desiredRoleInput.fill('Engenheiro de Software')

    const linkedinInput = page.getByPlaceholder('https://linkedin.com/in/...')
    await linkedinInput.fill('https://linkedin.com/in/playwright-tester')

    await page.getByRole('button', { name: 'Salvar perfil' }).click()
    await expect(page.getByText('Perfil salvo')).toBeVisible({ timeout: 15000 })
  })

  test('shows warning when fewer than 3 skills', async ({ page }) => {
    await page.goto('/perfil')
    await waitForProfileData(page)

    // Count current skills — if < 3, warning should show
    const skillTags = page.locator('span[class*="rounded-full"]').filter({ hasText: /.+/ })
    const count = await skillTags.count()
    if (count < 3) {
      await expect(page.getByText('Adicione pelo menos 3 habilidades para ativar a automação.')).toBeVisible({ timeout: 5000 })
    } else {
      test.skip(true, `User already has ${count} skills — warning won't show`)
    }
  })

  test('can add skills and warning disappears after 3rd skill', async ({ page }) => {
    await page.goto('/perfil')
    await waitForProfileData(page)

    const skillInput = page.getByPlaceholder('Ex: React, Node.js')
    const addBtn = page.getByRole('button', { name: 'Adicionar' })

    // Remove any existing skills to start clean
    const removeButtons = page.getByRole('button', { name: /Remover/ })
    while (await removeButtons.count() > 0) {
      await removeButtons.first().click()
      await page.waitForTimeout(500)
    }

    // Verify warning shows with 0 skills
    await expect(page.getByText('Adicione pelo menos 3 habilidades para ativar a automação.')).toBeVisible()

    // Add 3 skills
    for (const skill of ['React', 'TypeScript', 'Node.js']) {
      await skillInput.fill(skill)
      await addBtn.click()
      await expect(page.locator('[class*="rounded-full"]').filter({ hasText: skill }).first()).toBeVisible({ timeout: 10000 })
    }

    // Warning should be gone after 3rd skill
    await expect(page.getByText('Adicione pelo menos 3 habilidades para ativar a automação.')).not.toBeVisible()
  })

  test('can add a skill with Enter key', async ({ page }) => {
    await page.goto('/perfil')
    await waitForProfileData(page)

    const skillInput = page.getByPlaceholder('Ex: React, Node.js')
    const unique = `EnterSkill${Date.now()}`
    await skillInput.fill(unique)
    await skillInput.press('Enter')

    await expect(page.locator('[class*="rounded-full"]').filter({ hasText: unique }).first()).toBeVisible({ timeout: 10000 })
  })

  test('can remove a skill', async ({ page }) => {
    await page.goto('/perfil')
    await waitForProfileData(page)

    // Add a unique skill to remove
    const unique = `Remove${Date.now()}`
    const skillInput = page.getByPlaceholder('Ex: React, Node.js')
    await skillInput.fill(unique)
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.locator('[class*="rounded-full"]').filter({ hasText: unique }).first()).toBeVisible({ timeout: 10000 })

    // Remove it
    await page.getByRole('button', { name: `Remover ${unique}` }).click()
    await expect(page.locator('[class*="rounded-full"]').filter({ hasText: unique })).toHaveCount(0, { timeout: 5000 })
  })

  test('CV section shows "Nenhum CV enviado ainda" for new user', async ({ page }) => {
    await page.goto('/perfil')
    await waitForProfileData(page)

    // Only check if no CV is uploaded yet
    const hasCv = await page.getByText('Arquivo atual:').isVisible().catch(() => false)
    if (!hasCv) {
      await expect(page.getByText('Nenhum CV enviado ainda.')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Enviar CV')).toBeVisible()
    }
  })

  test('notification toggles work', async ({ page }) => {
    await page.goto('/perfil')
    await waitForProfileData(page)

    // Wait for toggles to render (they're after the form data loads)
    const switches = page.getByRole('switch')
    await expect(switches.first()).toBeVisible({ timeout: 15000 })

    const digestToggle = switches.first()
    const initialChecked = await digestToggle.getAttribute('aria-checked')
    await digestToggle.click()
    await expect(page.getByText('Notificações salvas')).toBeVisible({ timeout: 15000 })

    const newChecked = await digestToggle.getAttribute('aria-checked')
    expect(newChecked).not.toBe(initialChecked)

    // Restore
    await digestToggle.click()
    await expect(page.getByText('Notificações salvas')).toBeVisible({ timeout: 10000 })
  })

  test('can add and remove excluded company', async ({ page }) => {
    await page.goto('/perfil')
    await waitForProfileData(page)

    const unique = `EmpresaPW${Date.now()}`
    const companyInput = page.getByPlaceholder('Ex: Empresa XYZ')
    await companyInput.fill(unique)
    await page.getByRole('button', { name: 'Excluir' }).click()

    await expect(page.getByText(unique)).toBeVisible({ timeout: 10000 })

    // Remove it
    await page.getByRole('button', { name: `Remover ${unique}` }).click()
    await expect(page.getByText(unique)).not.toBeVisible({ timeout: 5000 })
  })

  // ── Dashboard ────────────────────────────────────────────────────────────────

  test('dashboard is accessible after profile completion', async ({ page }) => {
    await completeProfileMinimum(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 })
  })

  test('dashboard has sidebar and nav links', async ({ page }) => {
    await completeProfileMinimum(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 })

    // AppShell sidebar navigation
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Vagas' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Perfil' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Planos' })).toBeVisible()
    // Top nav elements specific to dashboard
    await expect(page.getByRole('button', { name: 'Buscar Vagas' })).toBeVisible({ timeout: 10000 })
  })

  test('dashboard shows stats cards', async ({ page }) => {
    await completeProfileMinimum(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 })

    await expect(page.getByText('Candidaturas', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Performance')).toBeVisible()
    await expect(page.getByText('Vagas Recentes')).toBeVisible()
    await expect(page.getByText('Automação', { exact: true })).toBeVisible()
    await expect(page.getByText('Agendamento', { exact: true })).toBeVisible()
  })

  test('dashboard shows empty state for new user in Vagas Recentes', async ({ page }) => {
    await completeProfileMinimum(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 })

    await expect(page.getByText('Nenhuma candidatura ainda')).toBeVisible({ timeout: 15000 })
  })

  test('automation toggle switches state', async ({ page }) => {
    await completeProfileMinimum(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 })

    const toggle = page.getByRole('switch')
    await expect(toggle).toBeVisible({ timeout: 15000 })

    const initialState = await toggle.getAttribute('aria-checked')
    await toggle.click()

    // Wait for state to flip (mutation response)
    await expect(toggle).not.toHaveAttribute('aria-checked', initialState!, { timeout: 10000 })

    // If we paused, the banner should appear
    if (initialState === 'true') {
      await expect(page.getByText('Automação pausada — nenhuma candidatura será enviada hoje.')).toBeVisible({ timeout: 5000 })
    }

    // Restore
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', initialState!, { timeout: 10000 })
  })

  test('schedule section has day toggles and time picker', async ({ page }) => {
    await completeProfileMinimum(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 })

    await expect(page.getByText('Agendamento', { exact: true })).toBeVisible({ timeout: 10000 })

    for (const day of ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) {
      await expect(page.getByRole('button', { name: day })).toBeVisible()
    }
    await expect(page.getByLabel('Horário')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvar agendamento' })).toBeVisible()
  })

  // ── Vagas page ───────────────────────────────────────────────────────────────

  test('vagas page shows empty state for new user', async ({ page }) => {
    await page.goto('/vagas')
    await expect(page.getByRole('heading', { name: 'Minhas vagas' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Nenhuma candidatura encontrada.')).toBeVisible({ timeout: 15000 })
  })

  test('vagas page has status filter select', async ({ page }) => {
    await page.goto('/vagas')
    await expect(page.getByRole('heading', { name: 'Minhas vagas' })).toBeVisible({ timeout: 10000 })

    const filter = page.getByRole('combobox')
    await expect(filter).toBeVisible({ timeout: 10000 })

    const options = await filter.locator('option').allTextContents()
    expect(options).toContain('Todas')
    expect(options).toContain('Pendente')
    expect(options).toContain('Enviada')
    expect(options).toContain('Falhou')
  })

  // ── Planos page ──────────────────────────────────────────────────────────────

  test('planos page shows 3 plan cards', async ({ page }) => {
    await page.goto('/planos')
    await expect(page.getByRole('heading', { name: 'Escolha seu plano' })).toBeVisible({ timeout: 10000 })

    // Wait for skeletons to disappear (data loaded)
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 20000 })

    // Each plan card has a quota badge with "vaga"
    const planCards = page.locator('[class*="rounded-2xl"]').filter({ hasText: '/dia' })
    await expect(planCards).toHaveCount(3)
  })

  test('planos page marks Free as current plan for new user', async ({ page }) => {
    await page.goto('/planos')
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 20000 })

    await expect(page.getByText('Seu plano', { exact: true })).toBeVisible({ timeout: 10000 })

    // Free card should have a disabled "Plano atual" button
    const freeCard = page.locator('[class*="rounded-2xl"]').filter({ hasText: 'Grátis' }).first()
    await expect(freeCard.getByRole('button', { name: 'Plano atual' })).toBeVisible()
    await expect(freeCard.getByRole('button', { name: 'Plano atual' })).toBeDisabled()
  })

  // ── Navigation ───────────────────────────────────────────────────────────────

  test('sidebar nav navigates between pages', async ({ page }) => {
    await completeProfileMinimum(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 })

    // Go to Vagas via sidebar
    await page.getByRole('link', { name: 'Vagas' }).first().click()
    await expect(page).toHaveURL('/vagas')

    // Go to Perfil via sidebar
    await page.getByRole('link', { name: 'Perfil' }).first().click()
    await expect(page).toHaveURL('/perfil')

    // Back to Dashboard via sidebar
    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await expect(page).toHaveURL('/dashboard')
  })
})
