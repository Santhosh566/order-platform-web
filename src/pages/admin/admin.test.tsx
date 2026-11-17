import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ProductDetail } from '../../api/adminTypes'
import type { ReturnRequest } from '../../api/types'
import { routes } from '../../router'
import { fakeBackend } from '../../test/fakeBackend'
import { ORDER_ID, order } from '../../test/fixtures'
import { fakeAuth, renderRoutes } from '../../test/render'

const admin = () => fakeAuth(['ADMIN'])

afterEach(() => vi.unstubAllGlobals())

const COUNTS = Object.fromEntries(
  [
    'PENDING',
    'INVENTORY_RESERVED',
    'CONFIRMED',
    'SHIPPED',
    'READY_FOR_DISPATCH',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERY_FAILED',
    'DELIVERED',
    'RETURNED',
    'CANCELLED',
    'OUT_OF_STOCK',
    'PAYMENT_FAILED',
    'FULFILLMENT_FAILED',
    'FRAUD_REJECTED',
  ].map((s) => [s, 0]),
)

const DRIVERS = [
  { userId: 'DEL-001', fullName: 'Ravi Kumar', phone: null, activeDeliveries: 2 },
  { userId: 'DEL-002', fullName: 'Meena Iyer', phone: null, activeDeliveries: 0 },
]

const RETURN: ReturnRequest = {
  returnId: 'RET-1',
  orderId: ORDER_ID,
  customerId: 'CUST-100',
  status: 'REQUESTED',
  reason: 'Damaged or defective',
  requestedAt: '2026-11-08T12:00:00',
  decidedAt: null,
  decidedBy: null,
  decisionNote: null,
  receivedAt: null,
  receivedBy: null,
  items: [{ orderItemId: 1, sku: 'PEN-01', quantity: 1, condition: null }],
}

describe('dashboard', () => {
  it('shows the headline numbers, flags waiting work, and breaks orders down by status', async () => {
    fakeBackend({
      'GET /api/admin/metrics': {
        body: {
          totalOrders: 42,
          totalRevenue: 123456.5,
          currency: 'INR',
          dlqQuarantinedCount: 0,
          activeRoutesCount: 30,
          totalRoutesCount: 31,
          connectedUiClients: 1,
        },
      },
      'GET /api/admin/orders/status-counts': { body: { ...COUNTS, DELIVERED: 30, CANCELLED: 12 } },
      'GET /api/admin/returns': { body: [RETURN] },
      'GET /api/admin/delivery/waiting': { body: [] },
      'GET /api/admin/catalog': { body: { items: [], page: 0, totalItems: 0, totalPages: 0 } },
    })
    renderRoutes(routes, '/admin', admin())

    expect(await screen.findByText('₹1,23,456.50')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Delivered' })).toHaveAttribute('href', '/admin/orders?status=DELIVERED')
    expect(screen.getByRole('link', { name: 'Cancelled' })).toBeInTheDocument()
    // Statuses with no orders are left out
    expect(screen.queryByRole('link', { name: 'Out of stock' })).not.toBeInTheDocument()
    // One return to review: flagged in words, not only by colour
    expect(screen.getAllByText('Needs attention')).toHaveLength(1)
  })
})

describe('admin orders', () => {
  it('reads the status filter from the URL and searches as the admin types', async () => {
    const backend = fakeBackend({
      'GET /api/admin/orders': {
        body: {
          items: [
            {
              orderId: ORDER_ID,
              customerId: 'CUST-100',
              recipientName: 'Alice Smith',
              city: 'Bengaluru',
              state: 'Karnataka',
              status: 'CANCELLED',
              orderType: 'STANDARD',
              currency: 'INR',
              total: 118,
              refundedTotal: 118,
              itemCount: 2,
              fraudStatus: null,
              returnStatus: 'NONE',
              invoiceNumber: null,
              externalReference: null,
              createdAt: '2026-11-08T10:00:00',
              statusChangedAt: '2026-11-08T10:05:00',
            },
          ],
          page: 0,
          totalItems: 1,
          totalPages: 1,
        },
      },
      'GET /api/admin/orders/status-counts': { body: COUNTS },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/orders?status=CANCELLED', admin())

    // (The header also shows the signed-in user's name, so wait for the row itself)
    expect(await screen.findByText('− ₹118.00 refunded')).toBeInTheDocument()
    expect(screen.getByText('Bengaluru, Karnataka')).toBeInTheDocument()
    expect(backend.sent('GET', '/api/admin/orders')[0].query).toMatchObject({ status: 'CANCELLED', page: '0' })

    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'cust-100')
    await waitFor(() =>
      expect(backend.sent('GET', '/api/admin/orders').some((c) => c.query.q === 'cust-100')).toBe(true),
    )
  })
})

describe('admin order page', () => {
  it('limits a goodwill refund to what is left, then issues it', async () => {
    const backend = fakeBackend({
      [`GET /api/orders/${ORDER_ID}`]: {
        body: { ...order({ status: 'DELIVERED', deliveredAt: '2026-11-07T10:00:00', refundedTotal: 18 }), fraudStatus: null },
      },
      'GET /api/admin/returns': { body: [] },
      [`GET /api/returns/orders/${ORDER_ID}/credit-notes`]: { body: [] },
      [`GET /api/admin/delivery/orders/${ORDER_ID}/attempts`]: { body: [] },
      [`POST /api/admin/orders/${ORDER_ID}/refunds`]: {
        body: { number: 'CN/26-27/000001', total: 50, currency: 'INR' },
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, `/admin/orders/${ORDER_ID}`, admin())

    await user.click(await screen.findByRole('button', { name: 'Goodwill refund' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Up to ₹100.00 can still be refunded/)).toBeInTheDocument()

    const amount = within(dialog).getByRole('textbox', { name: /Amount/ })
    await user.type(amount, '150')
    await user.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'Arrived late')
    await user.click(within(dialog).getByRole('button', { name: 'Refund' }))
    expect(within(dialog).getByText('At most ₹100.00')).toBeInTheDocument()
    expect(backend.sent('POST', `/api/admin/orders/${ORDER_ID}/refunds`)).toHaveLength(0)

    await user.clear(amount)
    await user.type(amount, '50')
    await user.click(within(dialog).getByRole('button', { name: 'Refund' }))
    await waitFor(() =>
      expect(backend.sent('POST', `/api/admin/orders/${ORDER_ID}/refunds`)[0]?.body).toEqual({
        amount: 50,
        reason: 'Arrived late',
      }),
    )
  })

  it('offers the least busy driver first for an order waiting for one', async () => {
    const backend = fakeBackend({
      [`GET /api/orders/${ORDER_ID}`]: { body: order({ status: 'READY_FOR_DISPATCH' }) },
      'GET /api/admin/returns': { body: [] },
      [`GET /api/returns/orders/${ORDER_ID}/credit-notes`]: { body: [] },
      [`GET /api/admin/delivery/orders/${ORDER_ID}/attempts`]: { body: [] },
      'GET /api/admin/delivery/drivers': { body: DRIVERS },
      [`POST /api/admin/delivery/orders/${ORDER_ID}/assign`]: { body: {} },
    })
    const user = userEvent.setup()
    renderRoutes(routes, `/admin/orders/${ORDER_ID}`, admin())

    await user.click(await screen.findByRole('combobox', { name: `Driver for ${ORDER_ID}` }))
    const options = await screen.findAllByRole('option')
    expect(options[0]).toHaveTextContent('Meena Iyer · 0 in hand')
    await user.click(options[0])
    await user.click(screen.getByRole('button', { name: 'Assign' }))

    await waitFor(() =>
      expect(backend.sent('POST', `/api/admin/delivery/orders/${ORDER_ID}/assign`)[0]?.body).toEqual({
        deliveryUserId: 'DEL-002',
      }),
    )
  })
})

const PRODUCT: ProductDetail = {
  product: {
    sku: 'PEN-01',
    name: 'Gel pen',
    hsnCode: '9608',
    unitPrice: 59,
    gstRate: 18,
    currency: 'INR',
    available: 3,
    reserved: 1,
    reorderLevel: 5,
    lowStock: true,
    active: true,
    version: 7,
    updatedAt: '2026-11-08T09:00:00',
    updatedBy: 'admin',
    description: null,
    categoryId: null,
    categoryName: null,
    brand: null,
    maxPerOrder: null,
    ratingAvg: 0,
    ratingCount: 0,
    gstRule: null,
  },
  prices: [
    {
      id: 11,
      unitPrice: 65,
      gstRate: 18,
      effectiveFrom: '2999-01-01T00:00:00',
      state: 'SCHEDULED',
      reason: 'New year',
      createdBy: 'admin',
      createdAt: '2026-11-08T09:00:00',
    },
  ],
  recentMovements: [],
  images: [],
  specs: [],
  suggestedSpecs: [],
}

describe('product page', () => {
  function productBackend(extra: Parameters<typeof fakeBackend>[0] = {}) {
    return fakeBackend({
      'GET /api/admin/catalog/PEN-01': { body: PRODUCT },
      'GET /api/admin/catalog/PEN-01/movements': {
        body: {
          items: [
            {
              id: 1,
              sku: 'PEN-01',
              type: 'RESERVE',
              availableChange: -1,
              reservedChange: 1,
              availableAfter: 3,
              reservedAfter: 1,
              orderId: ORDER_ID,
              reason: null,
              createdBy: 'system',
              createdAt: '2026-11-08T10:00:00',
            },
          ],
          page: 0,
          totalItems: 1,
          totalPages: 1,
        },
      },
      ...extra,
    })
  }

  it('schedules a price with the version it was opened at', async () => {
    const backend = productBackend({
      'POST /api/admin/catalog/PEN-01/prices': {
        body: { product: PRODUCT.product, price: { ...PRODUCT.prices[0], id: 12, unitPrice: 69 } },
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/catalog/PEN-01', admin())

    expect(await screen.findByText('Reserved for order')).toBeInTheDocument()
    const price = screen.getByRole('textbox', { name: /Price including GST/ })
    await user.clear(price)
    await user.type(price, '69')
    await user.click(screen.getByRole('radio', { name: 'From a later time' }))
    const when = screen.getByLabelText(/Takes effect at/)
    await user.type(when, '2999-06-01T09:30')
    await user.click(screen.getByRole('button', { name: 'Schedule price' }))

    await waitFor(() =>
      expect(backend.sent('POST', '/api/admin/catalog/PEN-01/prices')[0]?.body).toEqual({
        expectedVersion: 7,
        unitPrice: 69,
        gstRate: 18,
        effectiveFrom: '2999-06-01T09:30:00',
      }),
    )
  })

  it('asks for a reason before writing stock off', async () => {
    const backend = productBackend({ 'POST /api/admin/catalog/PEN-01/stock': { status: 201, body: {} } })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/catalog/PEN-01', admin())

    await user.click(await screen.findByRole('combobox', { name: 'What happened' }))
    await user.click(await screen.findByRole('option', { name: 'Write-off (damaged, lost)' }))
    await user.type(screen.getByRole('textbox', { name: /Units/ }), '2')
    await user.click(screen.getByRole('button', { name: 'Record' }))

    expect(await screen.findByText(/Say why/)).toBeInTheDocument()
    expect(backend.sent('POST', '/api/admin/catalog/PEN-01/stock')).toHaveLength(0)
  })
})

describe('returns queue', () => {
  it('will not reject without a note for the customer', async () => {
    const backend = fakeBackend({
      'GET /api/admin/returns': { body: [RETURN] },
      'POST /api/admin/returns/RET-1/reject': { body: { ...RETURN, status: 'REJECTED' } },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/returns', admin())

    await user.click(await screen.findByRole('button', { name: 'Reject' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    expect(within(dialog).getByText('Tell the customer why')).toBeInTheDocument()

    await user.type(within(dialog).getByRole('textbox', { name: /Why it is rejected/ }), 'Used item')
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    await waitFor(() =>
      expect(backend.sent('POST', '/api/admin/returns/RET-1/reject')[0]?.body).toEqual({ note: 'Used item' }),
    )
  })

  it('receives the goods with their condition', async () => {
    const backend = fakeBackend({
      'GET /api/admin/returns': {
        body: [{ ...RETURN, status: 'PICKED_UP', pickedUpAt: '2026-11-09T10:00:00', pickedUpBy: 'DEL-001' }],
      },
      'POST /api/admin/returns/RET-1/receive': { body: { number: 'CN/26-27/000002', total: 59, currency: 'INR' } },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/returns?tab=PICKED_UP', admin())

    expect(await screen.findByText(/Picked up .* by DEL-001/)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Goods received' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('radio', { name: 'Damaged' }))
    await user.click(within(dialog).getByRole('button', { name: 'Receive and refund' }))

    await waitFor(() =>
      expect(backend.sent('POST', '/api/admin/returns/RET-1/receive')[0]?.body).toEqual({
        conditions: { 'PEN-01': 'DAMAGED' },
      }),
    )
  })
})

describe('returns awaiting pickup', () => {
  it('says how the pickup is going and offers to receive it another way', async () => {
    fakeBackend({ 'GET /api/admin/returns': { body: [{ ...RETURN, status: 'APPROVED', pickupStatus: 'ON_THE_WAY' }] } })
    renderRoutes(routes, '/admin/returns?tab=APPROVED', admin())
    expect(await screen.findByText('Driver on the way')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See pickup' })).toHaveAttribute('href', '/admin/deliveries')
    expect(screen.getByRole('button', { name: 'Received without pickup' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Goods received' })).not.toBeInTheDocument()
  })
})

describe('delivery board', () => {
  it('lists return pickups and assigns them to a driver', async () => {
    const backend = fakeBackend({
      'GET /api/admin/delivery/waiting': { body: [] },
      'GET /api/admin/delivery/in-progress': { body: [] },
      'GET /api/admin/delivery/drivers': { body: DRIVERS },
      'GET /api/admin/pickups/waiting': {
        body: [
          {
            returnId: 'RET-1',
            orderId: ORDER_ID,
            city: 'Bengaluru',
            state: 'Karnataka',
            postalCode: '560038',
            itemCount: 1,
            approvedAt: '2026-11-09T09:00:00',
            attempts: 1,
          },
        ],
      },
      'GET /api/admin/pickups/in-progress': { body: [] },
      'POST /api/admin/pickups/RET-1/assign': { body: {} },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/deliveries', admin())

    // ("Waiting for a driver" is also the orders section's heading, so wait for the pickup row)
    expect(await screen.findByText(/1 failed try/)).toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: 'Driver for RET-1' }))
    await user.click(await screen.findByRole('option', { name: /Meena Iyer/ }))
    await user.click(screen.getByRole('button', { name: 'Assign' }))
    await waitFor(() =>
      expect(backend.sent('POST', '/api/admin/pickups/RET-1/assign')[0]?.body).toEqual({ deliveryUserId: 'DEL-002' }),
    )
  })

  it('lets the admin reassign only deliveries not yet collected', async () => {
    fakeBackend({
      'GET /api/admin/delivery/waiting': { body: [] },
      'GET /api/admin/delivery/drivers': { body: DRIVERS },
      'GET /api/admin/delivery/in-progress': {
        body: [
          {
            orderId: ORDER_ID,
            status: 'READY_FOR_DISPATCH',
            deliveryStatus: 'ASSIGNED',
            attempt: 1,
            deliveryUserId: 'DEL-001',
            deliveryUserName: 'Ravi Kumar',
            assignedAt: '2026-11-08T10:00:00',
            pickedUpAt: null,
            city: 'Bengaluru',
            state: 'Karnataka',
            postalCode: '560038',
          },
          {
            orderId: 'ORD-bbbbbbbb-1111-2222-3333-444455556666',
            status: 'IN_TRANSIT',
            deliveryStatus: 'PICKED_UP',
            attempt: 2,
            deliveryUserId: 'DEL-002',
            deliveryUserName: 'Meena Iyer',
            assignedAt: '2026-11-08T09:00:00',
            pickedUpAt: '2026-11-08T09:30:00',
            city: 'Mumbai',
            state: 'Maharashtra',
            postalCode: '400002',
          },
        ],
      },
    })
    renderRoutes(routes, '/admin/deliveries', admin())

    expect(await screen.findByText('Not collected yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reassign' })).toBeInTheDocument()
    expect(screen.getByText('With the driver')).toBeInTheDocument()
    expect(screen.getByText('Attempt 2')).toBeInTheDocument()
    expect(screen.getByText('Nothing is waiting.')).toBeInTheDocument()
  })
})
