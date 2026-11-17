import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against the real platform: backend, Keycloak, Kafka, Postgres and Mailpit all
 * running (see README). They place real orders in that database, so run them on a development
 * stack, never on production.
 *
 *   E2E_BASE_URL   the app (default http://localhost:9091, served by the backend; or :5173 with npm run dev)
 *   E2E_MAILPIT    Mailpit's web address, where the one-time codes are read (default http://localhost:8025)
 */
export default defineConfig({
  testDir: './e2e',
  // One story, step by step, on shared data
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 8 * 60_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  outputDir: 'e2e-results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:9091',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
})
