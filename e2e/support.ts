import { expect, type Browser, type BrowserContext, type Page, type APIRequestContext } from '@playwright/test'
import { devices } from '@playwright/test'

/** The demo users from ops/keycloak/order-platform-realm.json. */
export const USERS = {
  customer: { username: 'alice.smith@example.com', email: 'alice.smith@example.com' },
  admin: { username: 'admin@example.com' },
  driver: { username: 'driver1@example.com', name: 'Dev Driver One' },
} as const

const PASSWORD = process.env.E2E_PASSWORD ?? 'demo1234'
const MAILPIT = process.env.E2E_MAILPIT ?? 'http://localhost:8025'

/** A browser session signed in through the real Keycloak page. Drivers get a phone screen. */
export async function signIn(
  browser: Browser,
  username: string,
  options: { phone?: boolean } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(options.phone ? { ...devices['Pixel 7'] } : {})
  const page = await context.newPage()
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Keycloak's own login form
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(PASSWORD)
  await page.locator('#kc-login').click()
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible()
  return { context, page }
}

/** "ORD-3f2a9c1e-…" → "ORD-3F2A9C1E", as the screens show it. */
export function shortId(orderId: string): string {
  return `ORD-${orderId.slice(4, 12).toUpperCase()}`
}

interface MailSummary {
  ID: string
  Subject: string
  Created: string
}

/**
 * Waits for an email to arrive in Mailpit and returns its text. Only emails newer than `since`
 * count, so an old message is never used.
 */
export async function emailText(
  request: APIRequestContext,
  to: string,
  subject: string,
  since: Date,
  accept: (text: string) => boolean = () => true,
): Promise<string> {
  let found: string | null = null
  await expect
    .poll(
      async () => {
        const search = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `to:"${to}" subject:"${subject}"`, limit: '5' },
        })
        expect(search.ok()).toBeTruthy()
        const messages = ((await search.json()) as { messages: MailSummary[] }).messages
        const fresh = messages.find((m) => new Date(m.Created) >= since)
        if (!fresh) return null
        const message = await request.get(`${MAILPIT}/api/v1/message/${fresh.ID}`)
        const text = ((await message.json()) as { Text: string }).Text
        found = accept(text) ? text : null
        return found
      },
      { message: `an email "${subject}" to ${to}`, timeout: 60_000, intervals: [1000] },
    )
    .not.toBeNull()
  return found!
}

/** The 6-digit one-time code in an email: the code a customer gives the driver. */
export async function codeFromEmail(
  request: APIRequestContext,
  to: string,
  subject: string,
  since: Date,
): Promise<string> {
  const text = await emailText(request, to, subject, since, (t) => /\b\d{6}\b/.test(t))
  return /\b(\d{6})\b/.exec(text)![1]
}

/** Types a code into Mantine's 6-box PIN input. */
export async function enterCode(page: Page, code: string): Promise<void> {
  await page.locator('input[inputmode="numeric"]').first().click()
  await page.keyboard.type(code)
}
