import { expect, test } from '@playwright/test'
import { codeFromEmail, enterCode, shortId, signIn, USERS } from './support'

/**
 * The whole life of an order, through the real screens and services:
 *
 *   admin adds a product with a photo → customer buys it → the pipeline pays and packs it → admin assigns a driver
 *   → the driver delivers it with the customer's emailed code → the customer returns one unit
 *   → admin approves → a driver collects it with a new code → admin receives it → refund and credit note.
 */
test('an order goes from the shop to delivery, and a return from pickup to refund', async ({ browser, request }) => {
  const stamp = Date.now().toString(36).toUpperCase()
  const sku = `E2E-${stamp}`
  const product = `E2E pen ${stamp}`

  const admin = await signIn(browser, USERS.admin.username)
  const customer = await signIn(browser, USERS.customer.username)
  const driver = await signIn(browser, USERS.driver.username, { phone: true })

  await test.step('admin adds a product with stock', async () => {
    const page = admin.page
    await page.goto('/admin/catalog')
    await page.getByRole('button', { name: 'New product' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('SKU').fill(sku)
    await dialog.getByLabel('HSN code').fill('9608')
    await dialog.getByLabel('Name').fill(product)
    await dialog.getByLabel('Price including GST').fill('118')
    await dialog.getByLabel('Opening stock').fill('10')
    await dialog.getByRole('button', { name: 'Create product' }).click()
    await expect(page.getByRole('heading', { name: product })).toBeVisible()
  })

  await test.step('admin adds a photo, stored in MinIO', async () => {
    const page = admin.page
    // A 600 × 400 JPEG drawn in the browser, so the test needs no picture file
    const dataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 600
      canvas.height = 400
      const g = canvas.getContext('2d')!
      g.fillStyle = '#13213f'
      g.fillRect(0, 0, 600, 400)
      g.fillStyle = '#e8590c'
      g.fillRect(150, 100, 300, 200)
      return canvas.toDataURL('image/jpeg', 0.9)
    })
    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64')
    await page.locator('input[type="file"]').setInputFiles({ name: 'pen.jpg', mimeType: 'image/jpeg', buffer })
    await expect(page.getByText('1 of 8')).toBeVisible()
    await expect(page.getByText('Main', { exact: true })).toBeVisible()
  })

  let orderId = ''
  await test.step('customer buys two and pays', async () => {
    const page = customer.page
    await page.goto('/shop')
    await page.getByRole('textbox', { name: 'Search products' }).fill(stamp)
    const card = page.locator('.mantine-Card-root', { hasText: product })
    // The photo comes from MinIO through the backend and really loads
    const photo = card.getByRole('img', { name: product })
    await expect(photo).toHaveAttribute('src', /\/api\/public\/images\/products\//)
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0)
    await card.getByRole('textbox', { name: `Quantity of ${product}` }).fill('2')
    await card.getByRole('button', { name: 'Add to cart' }).click()
    await page.goto('/cart')
    await expect(page.getByText(product)).toBeVisible()
    await page.getByRole('button', { name: 'Place order' }).click()
    await expect(page).toHaveURL(/\/orders\/ORD-/)
    orderId = decodeURIComponent(page.url().split('/orders/')[1])
    // Kafka → stock → payment → packing, shown live
    await expect(page.getByText('Ready to ship', { exact: true }).first()).toBeVisible({ timeout: 90_000 })
    await expect(page.getByText('CGST', { exact: true })).toBeVisible()
  })

  await test.step('admin gives the order to a driver', async () => {
    const page = admin.page
    await page.goto('/admin/deliveries')
    await page.getByRole('combobox', { name: `Driver for ${orderId}` }).click()
    await page.getByRole('option', { name: new RegExp(USERS.driver.name) }).click()
    await page.getByRole('button', { name: 'Assign' }).first().click()
    await expect(page.getByText('Driver assigned')).toBeVisible()
  })

  await test.step('driver collects it, sets out, and delivers with the customer’s code', async () => {
    const page = driver.page
    await page.goto('/delivery/mine')
    const card = page.locator('.mantine-Card-root', { hasText: shortId(orderId) })
    await card.getByRole('button', { name: 'I have collected it' }).click()
    const sentAfter = new Date()
    await card.getByRole('button', { name: 'Start delivery' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Start delivery' }).click()
    const code = await codeFromEmail(request, USERS.customer.email, `Your order ${orderId} is out for delivery`, sentAfter)
    await enterCode(page, code)
    await card.getByRole('button', { name: 'Confirm delivery' }).click()
    await expect(page.getByText('Delivered', { exact: true }).first()).toBeVisible()
    await expect(card).toHaveCount(0)
  })

  await test.step('customer sees it delivered and returns one', async () => {
    const page = customer.page
    await page.goto(`/orders/${encodeURIComponent(orderId)}`)
    await expect(page.getByText('Delivered', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Return items' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: `Units of ${product} to return` }).fill('1')
    await dialog.getByRole('combobox', { name: /Why are you returning it/ }).click()
    await page.getByRole('option', { name: 'Damaged or defective' }).click()
    await dialog.getByRole('button', { name: 'Request return' }).click()
    await expect(page.getByText('Return requested')).toBeVisible()
  })

  await test.step('admin approves the return', async () => {
    const page = admin.page
    await page.goto('/admin/returns')
    const card = page.locator('.mantine-Card-root', { hasText: shortId(orderId) })
    await card.getByRole('button', { name: 'Approve' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText('Return approved')).toBeVisible()
  })

  await test.step('a driver collects the return with a new code', async () => {
    const page = driver.page
    await page.goto('/delivery')
    await page
      .locator('.mantine-Card-root', { hasText: shortId(orderId) })
      .getByRole('button', { name: 'Take this pickup' })
      .click()
    await expect(page).toHaveURL(/\/delivery\/mine/)
    const card = page.locator('.mantine-Card-root', { hasText: `Return of ${shortId(orderId)}` })
    const sentAfter = new Date()
    await card.getByRole('button', { name: 'Start pickup' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Start pickup' }).click()
    const code = await codeFromEmail(request, USERS.customer.email, 'We are on the way to collect your return', sentAfter)
    await card.getByRole('checkbox', { name: /I have the items/ }).check()
    await enterCode(page, code)
    await card.getByRole('button', { name: 'Confirm pickup' }).click()
    await expect(page.getByText('Collected', { exact: true }).first()).toBeVisible()
  })

  await test.step('admin receives it at the hub, which refunds the customer', async () => {
    const page = admin.page
    await page.goto('/admin/returns?tab=PICKED_UP')
    const card = page.locator('.mantine-Card-root', { hasText: shortId(orderId) })
    await card.getByRole('button', { name: 'Goods received' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Receive and refund' }).click()
    await expect(page.getByText(/on credit note CN\//)).toBeVisible()
  })

  await test.step('customer sees the refund and the credit note', async () => {
    const page = customer.page
    await page.goto('/returns')
    await expect(
      page.locator('.mantine-Card-root', { hasText: shortId(orderId) }).getByText('Refunded', { exact: true }),
    ).toBeVisible()
    await page.goto(`/orders/${encodeURIComponent(orderId)}`)
    await expect(page.getByText(/^CN\/\d{2}-\d{2}\/\d{6}$/)).toBeVisible()
    await expect(page.getByText('Net paid')).toBeVisible()
  })

  await test.step('admin takes the test product off sale, so the shop stays clean', async () => {
    const page = admin.page
    await page.goto(`/admin/catalog/${sku}`)
    await page.getByRole('switch', { name: 'On sale in the shop' }).uncheck()
    await page.getByRole('button', { name: 'Save details' }).click()
    await expect(page.getByText('Off sale', { exact: true })).toBeVisible()
  })

  await Promise.all([admin.context.close(), customer.context.close(), driver.context.close()])
})
