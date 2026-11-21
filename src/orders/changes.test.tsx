import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ShippingAddress } from '../api/types'
import { routes } from '../router'
import { fakeBackend } from '../test/fakeBackend'
import { ALICE_ADDRESS, CATALOG, ORDER_ID, order } from '../test/fixtures'
import { fakeAuth, renderRoutes } from '../test/render'
import { canAddItems, canChangeDelivery, type OrderChange } from './changes'

const CHENNAI: ShippingAddress = {
  recipientName: 'Alice Smith',
  recipientPhone: '+91-98450-00101',
  line1: '7, Anna Salai',
  line2: null,
  city: 'Chennai',
  state: 'Tamil Nadu',
  postalCode: '600002',
  country: 'IN',
}

const customer = (defaultAddress: ShippingAddress = ALICE_ADDRESS) =>
  fakeAuth(['CUSTOMER'], {
    me: { userId: 'CUST-100', fullName: 'Alice Smith', email: 'a@example.com', roles: ['CUSTOMER'], defaultAddress },
  })

const SLOTS = {
  bookable: true,
  reason: null,
  standardBy: '2026-11-20',
  days: [
    {
      date: '2026-11-21',
      windows: [
        { window: 'MORNING', label: '9 AM – 1 PM', available: true, placesLeft: 30 },
        { window: 'AFTERNOON', label: '1 PM – 5 PM', available: true, placesLeft: 30 },
        { window: 'EVENING', label: '5 PM – 9 PM', available: true, placesLeft: 30 },
      ],
    },
  ],
}

function orderPage(o: ReturnType<typeof order>, extra: Record<string, unknown> = {}) {
  return fakeBackend({
    [`GET /api/orders/${ORDER_ID}`]: { body: o },
    [`GET /api/orders/${ORDER_ID}/changes`]: { body: [] },
    'GET /api/returns': { body: [] },
    'GET /api/public/catalog': { body: CATALOG },
    'GET /api/checkout/slots': { body: SLOTS },
    ...(extra as Record<string, { body: unknown }>),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('what can still be changed', () => {
  it('follows the order: delivery until a driver takes it, items until it is packed', () => {
    expect(canAddItems(order({ status: 'SHIPPED', invoiceNumber: null }))).toBe(true)
    expect(canAddItems(order({ status: 'SHIPPED', invoiceNumber: 'INV-1' }))).toBe(false)
    expect(canAddItems(order({ status: 'READY_FOR_DISPATCH' }))).toBe(false)
    expect(canChangeDelivery(order({ status: 'READY_FOR_DISPATCH' }))).toBe(true)
    expect(canChangeDelivery(order({ status: 'DELIVERY_FAILED' }))).toBe(true)
    expect(canChangeDelivery(order({ status: 'IN_TRANSIT' }))).toBe(false)
    expect(canChangeDelivery(order({ status: 'PENDING' }))).toBe(false)
  })
})

describe('adding items', () => {
  it('pays from the wallet first and the card the rest, on the version the customer saw', async () => {
    const backend = orderPage(order({ status: 'SHIPPED' }), {
      'GET /api/wallet': { body: { customerId: 'CUST-100', balance: 50, available: 50, currency: 'INR', history: [] } },
      [`POST /api/orders/${ORDER_ID}/items`]: {
        body: {
          order: order({ status: 'SHIPPED', total: 236 }),
          changes: [],
          payment: { byCard: 68, fromWallet: 50, cashOnDelivery: 0 },
        },
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())

    await user.click(await screen.findByRole('button', { name: 'Change order' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Add items' }))
    await user.click(await screen.findByRole('combobox', { name: 'Add a product' }))
    // Sold out products are not offered
    expect(screen.queryByRole('option', { name: /Desk lamp/ })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('option', { name: /Gel pen/ }))
    const units = screen.getByRole('textbox', { name: 'Units of Gel pen to add' })
    await user.clear(units)
    await user.type(units, '2')

    expect(screen.getByLabelText('Added amount')).toHaveTextContent('₹118.00')
    expect(screen.getByRole('checkbox', { name: /Use my wallet balance \(₹50.00\)/ })).toBeChecked()
    expect(screen.getByText('₹50.00 from your wallet and ₹68.00 charged to your card now.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add for ₹118.00' }))
    await waitFor(() => expect(backend.sent('POST', `/api/orders/${ORDER_ID}/items`)).toHaveLength(1))
    const sent = backend.sent('POST', `/api/orders/${ORDER_ID}/items`)[0]
    expect(sent.body).toEqual({ items: [{ sku: 'PEN-01', quantity: 2 }], useWallet: true })
    expect(sent.headers['If-Match']).toBe('"4"')
    expect(await screen.findByText(/₹50.00 from the wallet and ₹68.00 charged to the card/)).toBeInTheDocument()
  })

  it('adds to the cash due on a cash-on-delivery order', async () => {
    orderPage(order({ status: 'CONFIRMED', paymentMethod: 'COD', paymentTransactionId: null }))
    const user = userEvent.setup()
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())
    await user.click(await screen.findByRole('button', { name: 'Change order' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Add items' }))
    await user.click(await screen.findByRole('combobox', { name: 'Add a product' }))
    await user.click(await screen.findByRole('option', { name: /Notebook/ }))
    expect(screen.getByText(/Added to the cash due at the door: about ₹238.00 in all/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /wallet/ })).not.toBeInTheDocument()
  })
})

describe('the delivery', () => {
  it('cannot take more items once packed, but the day can still move', async () => {
    const backend = orderPage(
      order({ status: 'READY_FOR_DISPATCH', invoiceNumber: 'INV-1', deliveryDate: '2026-11-21', deliveryWindow: 'MORNING' }),
      { [`POST /api/orders/${ORDER_ID}/delivery-slot`]: { body: { order: order(), changes: [], payment: null } } },
    )
    const user = userEvent.setup()
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())

    await user.click(await screen.findByRole('button', { name: 'Change order' }))
    expect(await screen.findByRole('menuitem', { name: 'Delivery address' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Add items' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Delivery day and time' }))

    const save = await screen.findByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    await user.click(await screen.findByRole('radio', { name: /Standard delivery/ }))
    await user.click(save)
    await waitFor(() => expect(backend.sent('POST', `/api/orders/${ORDER_ID}/delivery-slot`)).toHaveLength(1))
    expect(backend.sent('POST', `/api/orders/${ORDER_ID}/delivery-slot`)[0].body).toEqual({ date: null, window: null })
  })

  it('goes to the saved address, keeping the booked day, and says GST moves', async () => {
    const backend = orderPage(order({ status: 'SHIPPED', deliveryDate: '2026-11-21', deliveryWindow: 'MORNING' }), {
      [`POST /api/orders/${ORDER_ID}/address`]: {
        body: { order: order({ shippingAddress: CHENNAI }), changes: [], payment: null },
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer(CHENNAI))

    await user.click(await screen.findByRole('button', { name: 'Change order' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delivery address' }))
    await user.click(await screen.findByRole('button', { name: 'Use it' }))

    expect(await screen.findByText(/GST is worked out again for Tamil Nadu. The total stays the same./)).toBeInTheDocument()
    expect(await screen.findByRole('radio', { name: /Choose a day and time/ })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Deliver here' }))
    await waitFor(() => expect(backend.sent('POST', `/api/orders/${ORDER_ID}/address`)).toHaveLength(1))
    expect(backend.sent('POST', `/api/orders/${ORDER_ID}/address`)[0].body).toEqual({
      address: CHENNAI,
      deliverySlot: { date: '2026-11-21', window: 'MORNING' },
    })
  })

  it('offers no changes once the parcel is on its way', async () => {
    orderPage(order({ status: 'IN_TRANSIT' }))
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())
    expect(await screen.findByText('CGST')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change order' })).not.toBeInTheDocument()
  })
})

describe('change history', () => {
  const CHANGES: OrderChange[] = [
    {
      id: 1,
      kind: 'DELIVERY_SLOT',
      before: 'Standard delivery',
      after: 'Sat 21 Nov, 9 AM – 1 PM',
      amount: null,
      note: null,
      changedBy: null,
      byStaff: true,
      createdAt: '2026-11-18T10:00:00',
    },
    {
      id: 2,
      kind: 'ITEMS_ADDED',
      before: null,
      after: '2 × Gel pen',
      amount: 118,
      note: '₹118.00 was charged to your card',
      changedBy: 'CUST-100',
      byStaff: false,
      createdAt: '2026-11-18T11:00:00',
    },
  ]

  it('shows who changed what, without naming support staff to the customer', async () => {
    orderPage(order({ status: 'SHIPPED' }), { [`GET /api/orders/${ORDER_ID}/changes`]: { body: CHANGES } })
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())
    const history = await screen.findByLabelText('Changes to this order')
    expect(within(history).getByText('Standard delivery')).toBeInTheDocument()
    expect(within(history).getByText(/Our support team/)).toBeInTheDocument()
    expect(within(history).getByText(/^You ·/)).toBeInTheDocument()
    expect(within(history).getByText('₹118.00')).toBeInTheDocument()
  })
})
