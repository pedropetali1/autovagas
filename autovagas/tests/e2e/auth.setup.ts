/**
 * auth.setup.ts
 *
 * Creates a test user via Supabase Admin API (bypassing email confirmation),
 * then signs in through the UI and saves the auth cookies for subsequent tests.
 */

import { test as setup, expect } from '@playwright/test'

const TEST_EMAIL = 'playwright-test@autovagas.test'
const TEST_PASSWORD = 'Test@123456'
const TEST_NAME = 'Playwright Tester'
const AUTH_FILE = 'tests/e2e/.auth/user.json'

setup('create and authenticate test user', async ({ page, request }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ozcuomnbmwukfkwczumx.supabase.co'
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  // ── 1. Create / reset test user via Supabase Admin API ──────────────────────
  // First, try to delete existing test user
  const listRes = await request.get(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(TEST_EMAIL)}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })

  if (listRes.ok()) {
    const body = await listRes.json()
    const users = body.users ?? []
    for (const u of users) {
      if (u.email === TEST_EMAIL) {
        await request.delete(`${supabaseUrl}/auth/v1/admin/users/${u.id}`, {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        })
      }
    }
  }

  // Also delete the Prisma user record (cascades to skills, applications, etc.)
  // so that the next enforceAuth call creates a clean profile with no desiredRole/skills.
  // We do this via the Supabase REST API (PostgREST) with service role — direct DB access.
  await request.delete(`${supabaseUrl}/rest/v1/User?email=eq.${encodeURIComponent(TEST_EMAIL)}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
  })

  // Create user with email_confirmed = true (no email verification needed)
  const createRes = await request.post(`${supabaseUrl}/auth/v1/admin/users`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    data: {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name: TEST_NAME },
    },
  })

  expect(createRes.ok(), `Failed to create test user: ${await createRes.text()}`).toBeTruthy()

  // ── 2. Sign in through the UI ────────────────────────────────────────────────
  await page.goto('/sign-in')
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()

  await page.getByPlaceholder('seu@email.com').fill(TEST_EMAIL)
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()

  // Should redirect to /perfil?setup=1 (new user with incomplete profile)
  // or to /dashboard if profile is already complete (shouldn't be on fresh user)
  await page.waitForURL(/\/(dashboard|perfil)/, { timeout: 15000 })

  // ── 3. Save auth state ───────────────────────────────────────────────────────
  await page.context().storageState({ path: AUTH_FILE })
})
