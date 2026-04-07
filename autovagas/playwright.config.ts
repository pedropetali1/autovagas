import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'
import path from 'path'

// Load .env.local into the Playwright process so auth.setup.ts can read
// SUPABASE_SERVICE_ROLE_KEY and other secrets (Next.js loads this for the server,
// but the Playwright runner itself is a separate node process).
config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    // Do NOT set env here — Next.js loads .env.local automatically.
    // Explicitly setting '' would OVERRIDE .env.local and break the server.
  },
  projects: [
    // Setup: create test user and authenticate
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    // Main tests use the saved auth state (authenticated tests only)
    {
      name: 'chromium',
      testMatch: '**/new-user-flow.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Tests that don't need auth (landing, sign-in, sign-up forms)
    {
      name: 'unauthenticated',
      testMatch: '**/*.noauth.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
