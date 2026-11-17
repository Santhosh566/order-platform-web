import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../router'
import { fakeBackend, type Call } from '../test/fakeBackend'
import { ALICE_ADDRESS, CATALOG, ORDER_ID, order } from '../test/fixtures'
import { fakeAuth, renderRoutes } from '../test/render'
import type { Quote, Slots } from './queries'

const CART_KEY = 'order-platform:cart:CUST-100'
const customer = () =>
  fakeAuth(['CUSTOMER'], {
    me: { userId: 'CUST-100', fullName: 'Alice Smith', email: 'a@example.com', roles: ['CUSTOMER'], defaultAddress: ALICE_ADDRESS },
  })

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

/** The quote as the server would give it: SAVE20 takes ₹20 off; COD only up to ₹200. */
function quoteFor(call: Call): { body: Quote } {
  const body = call.body as { couponCode: string | null; paymentMethod: string }
  const ok = body.couponCode === 'SAVE20'
  const discount = ok ? 20 : 0
  const total = 238 - discount
  return {
    body: {
      items: [],
      itemsTotal: 238,
      discount,
      total,
      taxTotal: 36.3,
      cgstTotal: 18.15,
      sgstTotal: 18.15,
      igstTotal: 0,
      currency: 'INR',
      couponCode: ok ? 'SAVE20' : null,
      couponError: body.couponCode && !ok ? `Coupon ${body.couponCode} is not valid` : null,
      cashOnDelivery: { available: true, reason: null, maxOrderValue: 50000 },
    },
  }
}

const SLOTS: Slots = {
  bookable: true,
  reason: null,
  standardBy: '2026-11-13',
  days: [
    {
      date: '2026-11-13',
      windows: [
        { window: 'MORNING', label: '9 AM – 1 PM', available: false, placesLeft: 0 },
        { window: 'AFTERNOON', label: '1 PM – 5 PM', available: true, placesLeft: 3 },
        { window: 'EVENING', label: '5 PM – 9 PM', available: true, placesLeft: 20 },
      ],
    },
    {
      date: '2026-11-14',
      windows: [
        { window: 'MORNING', label: '9 AM – 1 PM', available: true, placesLeft: 40 },
        { window: 'AFTERNOON', label: '1 PM – 5 PM', available: true, placesLeft: 40 },
        { window: 'EVENING', label: '5 PM – 9 PM', available: true, placesLeft: 40 },
      ],
    },
  ],
}

describe('checkout extras', () => {
  beforeEach(() => {
    window.localStorage.setItem(
      CART_KEY,
      JSON.stringify([
        { sku: 'PEN-01', name: 'Gel pen', unitPrice: 59, quantity: 2 },
        { sku: 'BOOK-01', name: 'Notebook', unitPrice: 120, quantity: 1 },
      ]),
    )
  })

  it('applies a coupon, books a delivery slot, and pays cash on delivery', async () => {
    const backend = fakeBackend({
      'GET /api/public/catalog': { body: CATALOG },
      'POST /api/checkout/quote': quoteFor,
      'GET /api/checkout/slots': { body: SLOTS },
      'GET /api/checkout/offers': { body: [{ code: 'SAVE20', description: '₹20 off', minOrderValue: 0 }] },
      'POST /api/orders': { status: 202, body: { status: 'PENDING', orderId: ORDER_ID, currency: 'INR', total: 218 } },
      [`GET /api/orders/${ORDER_ID}`]: { body: order({ status: 'PENDING' }) },
      'GET /api/returns': { body: [] },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/cart', customer())

    expect(await screen.findByLabelText('Order total')).toHaveTextContent('₹238.00')

    // A wrong code is explained; an offer applies with one click
    await user.type(screen.getByRole('textbox', { name: 'Coupon code' }), 'nope')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText('Coupon NOPE is not valid')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Apply SAVE20' }))
    expect(await screen.findByText(/applied: you save/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Order total')).toHaveTextContent('₹218.00'))

    // A day and time: the full morning cannot be picked
    await user.click(await screen.findByRole('radio', { name: /Choose a day and time/ }))
    const times = await screen.findByRole('radiogroup', { name: 'Delivery time' })
    expect(within(times).getByRole('radio', { name: /9 AM – 1 PM \(full\)/ })).toBeDisabled()
    await user.click(within(screen.getByRole('radiogroup', { name: 'Delivery day' })).getByRole('radio', { name: /14 Nov/ }))
    await user.click(within(screen.getByRole('radiogroup', { name: 'Delivery time' })).getByRole('radio', { name: /9 AM – 1 PM/ }))

    await user.click(screen.getByRole('radio', { name: /Cash on delivery/ }))
    await waitFor(() => expect(screen.getByText(/To pay on delivery/)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Place order' }))
    await waitFor(() => expect(backend.sent('POST', '/api/orders')).toHaveLength(1))
    expect(backend.sent('POST', '/api/orders')[0].body).toMatchObject({
      couponCode: 'SAVE20',
      paymentMethod: 'COD',
      deliverySlot: { date: '2026-11-14', window: 'MORNING' },
    })
    expect(await screen.findByText(/Pay ₹218.00 in cash when it arrives/)).toBeInTheDocument()
  })

  it('does not offer cash on delivery when the server says no', async () => {
    fakeBackend({
      'GET /api/public/catalog': { body: CATALOG },
      'POST /api/checkout/quote': (call: Call) => {
        const q = quoteFor(call).body
        return {
          body: {
            ...q,
            cashOnDelivery: { available: false, reason: 'Cash on delivery is for orders up to ₹200.00.', maxOrderValue: 200 },
          },
        }
      },
      'GET /api/checkout/slots': { body: SLOTS },
      'GET /api/checkout/offers': { body: [] },
    })
    renderRoutes(routes, '/cart', customer())
    expect(await screen.findByText('Cash on delivery is for orders up to ₹200.00.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Cash on delivery/ })).toBeDisabled()
  })
})

describe('coupons (admin)', () => {
  it('lists coupons with their uses and creates one', async () => {
    const backend = fakeBackend({
      'GET /api/admin/coupons': {
        body: [
          {
            code: 'WELCOME10',
            description: '10% off your first order',
            discountType: 'PERCENT',
            discountValue: 10,
            maxDiscount: 500,
            minOrderValue: 0,
            startsAt: null,
            endsAt: null,
            usageLimit: 100,
            perCustomerLimit: 1,
            firstOrderOnly: true,
            active: true,
            createdAt: '2026-11-01T10:00:00',
            createdBy: 'ADM-001',
            used: 12,
            appliesTo: [],
          },
        ],
      },
      'POST /api/admin/coupons': (call: Call) => ({ status: 201, body: { ...(call.body as object), used: 0, active: true } }),
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/coupons', fakeAuth(['ADMIN']))

    const table = await screen.findByRole('table', { name: 'Coupons' })
    expect(within(table).getByText('10% off, up to ₹500.00')).toBeInTheDocument()
    expect(within(table).getByText('12 / 100')).toBeInTheDocument()
    expect(within(table).getByText('Live')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New coupon' }))
    const dialog = await screen.findByRole('dialog', { name: 'New coupon' })
    await user.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'diwali25')
    await user.type(within(dialog).getByRole('textbox', { name: /Shown to customers/ }), '₹250 off')
    await user.click(within(dialog).getByRole('radio', { name: 'Amount off' }))
    const amount = within(dialog).getByRole('textbox', { name: /Amount/ })
    await user.clear(amount)
    await user.type(amount, '250')
    const minimum = within(dialog).getByRole('textbox', { name: /Minimum order/ })
    await user.clear(minimum)
    await user.type(minimum, '1999')
    await user.click(within(dialog).getByRole('button', { name: 'Create coupon' }))

    await waitFor(() => expect(backend.sent('POST', '/api/admin/coupons')).toHaveLength(1))
    expect(backend.sent('POST', '/api/admin/coupons')[0].body).toMatchObject({
      code: 'DIWALI25',
      discountType: 'FLAT',
      discountValue: 250,
      maxDiscount: null,
      minOrderValue: 1999,
      perCustomerLimit: 1,
    })
  })
})
