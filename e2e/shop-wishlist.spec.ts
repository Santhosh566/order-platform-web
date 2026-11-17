import { expect, test, type Page } from '@playwright/test'
import { emailText, signIn, USERS } from './support'

/**
 * The shop, through the real screens and services:
 *
 *   admin adds two products, one sold out → customer searches and filters by price and stock
 *   → asks to be emailed when the sold-out one is back (which also saves it to the wishlist)
 *   → admin receives stock → the "Back in stock" email arrives with a link → the customer buys it
 *   from the wishlist and the order goes through payment and packing.
 */
test('search, filter, wishlist, back-in-stock email, and buying from the wishlist', async ({ browser, request }) => {
  const stamp = Date.now().toString(36).toUpperCase()
  const lamp = { sku: `E2E-L-${stamp}`, name: `E2E lamp ${stamp}`, price: '4321', stock: '0' }
  const bulb = { sku: `E2E-B-${stamp}`, name: `E2E bulb ${stamp}`, price: '118', stock: '10' }

  const admin = await signIn(browser, USERS.admin.username)
  const customer = await signIn(browser, USERS.customer.username)

  await test.step('admin adds a lamp (sold out) and a bulb (in stock)', async () => {
    for (const p of [lamp, bulb]) {
      await createProduct(admin.page, p)
    }
  })

  await test.step('customer finds both by search, then narrows by price and stock', async () => {
    const page = customer.page
    await page.goto('/shop')
    await page.getByRole('textbox', { name: 'Search products' }).fill(stamp)
    await page.getByRole('textbox', { name: 'Search products' }).press('Enter')
    await expect(card(page, lamp.name)).toBeVisible()
    await expect(card(page, bulb.name)).toBeVisible()
    await expect(card(page, lamp.name).getByText('Out of stock')).toBeVisible()

    // The filter panel opens from the Filters button. Price from ₹1,000: only the lamp; the filter is
    // kept in the address
    await page.getByRole('button', { name: 'Filters' }).click()
    const filters = page.getByRole('dialog', { name: 'Filters' })
    const lowest = filters.getByRole('textbox', { name: 'Lowest price' })
    await lowest.fill('1000')
    await lowest.blur()
    await expect(page).toHaveURL(/min=1000/)
    await expect(card(page, bulb.name)).toHaveCount(0)
    await expect(card(page, lamp.name)).toBeVisible()

    // In stock only: the sold-out lamp goes too
    await filters.getByRole('checkbox', { name: 'In stock only' }).check()
    await expect(card(page, lamp.name)).toHaveCount(0)
    await filters.getByRole('checkbox', { name: 'In stock only' }).uncheck()
    await expect(card(page, lamp.name)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(filters).toBeHidden()
  })

  await test.step('customer asks to be emailed when the lamp is back', async () => {
    const page = customer.page
    await card(page, lamp.name).getByRole('link', { name: lamp.name }).click()
    await expect(page.getByRole('heading', { name: lamp.name })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sold out' })).toBeDisabled()
    await page.getByRole('button', { name: 'Email me when it is back' }).click()
    await expect(page.getByText('We will email you when it is back.')).toBeVisible()
    // Asking saved it too
    await expect(page.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('link', { name: 'Wishlist' }).click()
    const row = page.getByRole('listitem', { name: lamp.name })
    await expect(row.getByText('Out of stock')).toBeVisible()
    await expect(row.getByText('We will email you when it is back.')).toBeVisible()
  })

  const restocked = new Date(Date.now() - 2000)
  await test.step('admin receives 5 lamps', async () => {
    const page = admin.page
    await page.goto(`/admin/catalog/${encodeURIComponent(lamp.sku)}`)
    await page.getByRole('textbox', { name: 'Units' }).fill('5')
    await page.getByRole('textbox', { name: 'Reason' }).fill(`Supplier invoice ${stamp}`)
    await page.getByRole('button', { name: 'Record' }).click()
    await expect(page.getByText('Received').first()).toBeVisible()
  })

  await test.step('the customer is emailed, with a link to the lamp', async () => {
    const text = await emailText(request, USERS.customer.email, `Back in stock: ${lamp.name}`, restocked)
    expect(text).toContain(`/shop/${lamp.sku}`)
  })

  await test.step('customer buys the lamp from the wishlist', async () => {
    const page = customer.page
    await page.goto('/wishlist')
    const row = page.getByRole('listitem', { name: lamp.name })
    await expect(row.getByText('Only a few left')).toBeVisible()
    await row.getByRole('button', { name: 'Add to cart' }).click()
    await page.goto('/cart')
    await expect(page.getByText(lamp.name)).toBeVisible()
    await page.getByRole('button', { name: 'Place order' }).click()
    await expect(page).toHaveURL(/\/orders\/ORD-/)
    await expect(page.getByText('Ready to ship', { exact: true }).first()).toBeVisible({ timeout: 90_000 })

    // Done with it: off the wishlist
    await page.goto('/wishlist')
    await page.getByRole('button', { name: `Remove ${lamp.name}` }).click()
    await expect(page.getByRole('listitem', { name: lamp.name })).toHaveCount(0)
  })

  await admin.context.close()
  await customer.context.close()
})

function card(page: Page, name: string) {
  return page.locator('.mantine-Card-root', { hasText: name })
}

async function createProduct(page: Page, p: { sku: string; name: string; price: string; stock: string }) {
  await page.goto('/admin/catalog')
  await page.getByRole('button', { name: 'New product' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('SKU').fill(p.sku)
  await dialog.getByLabel('HSN code').fill('9405')
  await dialog.getByLabel('Name').fill(p.name)
  await dialog.getByLabel('Price including GST').fill(p.price)
  await dialog.getByLabel('Opening stock').fill(p.stock)
  await dialog.getByRole('button', { name: 'Create product' }).click()
  await expect(page.getByRole('heading', { name: p.name })).toBeVisible()
}
