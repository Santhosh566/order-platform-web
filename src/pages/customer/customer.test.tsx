import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../../router'
import { fakeBackend, graphqlReplies } from '../../test/fakeBackend'
import { ALICE_ADDRESS, CATALOG, ORDER_ID, card, order, productPage } from '../../test/fixtures'
import { fakeAuth, renderRoutes } from '../../test/render'

const CART_KEY = 'order-platform:cart:CUST-100'
const customer = () =>
  fakeAuth(['CUSTOMER'], {
    me: { userId: 'CUST-100', fullName: 'Alice Smith', email: 'a@example.com', roles: ['CUSTOMER'], defaultAddress: ALICE_ADDRESS },
  })

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('shop', () => {
  it('shows prices with GST, and adds to the cart', async () => {
    fakeBackend({ 'POST /graphql': graphqlReplies({ products: productPage([card(), card({ sku: 'LAMP-01', name: 'Desk lamp', stockStatus: 'OUT_OF_STOCK' })]) }) })
    const user = userEvent.setup()
    renderRoutes(routes, '/shop', customer())

    expect(await screen.findByText('Gel pen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sold out' })).toBeDisabled()

    const card1 = screen.getByText('Gel pen').closest('.mantine-Card-root') as HTMLElement
    await user.click(within(card1).getByRole('button', { name: 'Add to cart' }))

    expect(await screen.findByRole('link', { name: 'Cart (1)' })).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(CART_KEY) ?? '[]')).toEqual([
      { sku: 'PEN-01', name: 'Gel pen', unitPrice: 59, quantity: 1 },
    ])
  })
})

describe('checkout', () => {
  beforeEach(() => {
    window.localStorage.setItem(
      CART_KEY,
      JSON.stringify([
        { sku: 'PEN-01', name: 'Gel pen', unitPrice: 59, quantity: 2 },
        { sku: 'BOOK-01', name: 'Notebook', unitPrice: 100, quantity: 1 },
      ]),
    )
  })

  it('shows today’s prices, then places the order to the saved address', async () => {
    const backend = fakeBackend({
      'GET /api/public/catalog': { body: CATALOG },
      'POST /api/orders': { status: 202, body: { status: 'PENDING', orderId: ORDER_ID, currency: 'INR', total: 238 } },
      [`GET /api/orders/${ORDER_ID}`]: { body: order({ status: 'PENDING' }) },
      'GET /api/returns': { body: [] },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/cart', customer())

    // The notebook went up from ₹100 to ₹120 since it was added
    expect(await screen.findByText(/Notebook: was ₹100.00, now ₹120.00/)).toBeInTheDocument()
    expect(screen.getAllByText('₹238.00').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Place order' }))

    expect(await screen.findByRole('heading', { name: 'Order ORD-3F2A9C1E' })).toBeInTheDocument()
    const [sent] = backend.sent('POST', '/api/orders')
    expect(sent.body).toMatchObject({
      items: [
        { sku: 'PEN-01', quantity: 2 },
        { sku: 'BOOK-01', quantity: 1 },
      ],
      shippingAddress: ALICE_ADDRESS,
    })
    expect((sent.body as { orderId: string }).orderId).toMatch(/^WEB-/)
    expect(window.localStorage.getItem(CART_KEY)).toBeNull()
  })

  it('treats a duplicate reference as an order that already went through', async () => {
    fakeBackend({
      'GET /api/public/catalog': { body: CATALOG },
      'POST /api/orders': { status: 409, body: { status: 'DUPLICATE', orderReference: 'WEB-1' } },
      'GET /api/orders': { body: [] },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/cart', customer())

    await user.click(await screen.findByRole('button', { name: 'Place order' }))

    expect(await screen.findByRole('heading', { name: 'My orders' })).toBeInTheDocument()
    expect(window.localStorage.getItem(CART_KEY)).toBeNull()
  })

  it('will not check out a sold-out item', async () => {
    window.localStorage.setItem(
      CART_KEY,
      JSON.stringify([{ sku: 'LAMP-01', name: 'Desk lamp', unitPrice: 1499, quantity: 1 }]),
    )
    fakeBackend({ 'GET /api/public/catalog': { body: CATALOG } })
    renderRoutes(routes, '/cart', customer())

    expect(await screen.findByText('Out of stock')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled()
  })
})

describe('order page', () => {
  it('shows the GST split and cancels after confirmation', async () => {
    const backend = fakeBackend({
      [`GET /api/orders/${ORDER_ID}`]: { body: order() },
      'GET /api/returns': { body: [] },
      [`POST /api/orders/${ORDER_ID}/cancel`]: {
        body: { status: 'CANCELLED', orderId: ORDER_ID, message: 'Stock restored and refund issued' },
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())

    expect(await screen.findByText('CGST')).toBeInTheDocument()
    expect(screen.queryByText('IGST')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invoice' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel order' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/₹118.00 goes back/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel order' }))

    await waitFor(() => expect(backend.sent('POST', `/api/orders/${ORDER_ID}/cancel`)).toHaveLength(1))
  })

  it('cancels some items before dispatch, and shows the credit note', async () => {
    const twoLines = order({
      status: 'READY_FOR_DISPATCH',
      invoiceNumber: 'INV/26-27/000001',
      items: [
        { ...order().items[0] },
        {
          sku: 'BOOK-01',
          quantity: 3,
          price: 112,
          productName: 'Notebook',
          hsnCode: '4820',
          gstRate: 12,
          taxableValue: 300,
          cgstAmount: 18,
          sgstAmount: 18,
          igstAmount: 0,
          discount: 0,
          lineTotal: 336,
          cancelledQuantity: 0,
          activeQuantity: 3,
        },
      ],
      total: 454,
      amountDue: 454,
    })
    const after = order({
      ...twoLines,
      refundedTotal: 224,
      cancelledTotal: 224,
      amountDue: 230,
      items: [twoLines.items[0], { ...twoLines.items[1], cancelledQuantity: 2, activeQuantity: 1 }],
    })
    let current = twoLines
    const backend = fakeBackend({
      [`GET /api/orders/${ORDER_ID}`]: () => ({ body: current }),
      'GET /api/returns': { body: [] },
      [`GET /api/returns/orders/${ORDER_ID}/credit-notes`]: {
        body: [
          {
            number: 'CN/26-27/000007',
            orderId: ORDER_ID,
            returnId: null,
            kind: 'CANCELLATION',
            currency: 'INR',
            taxableValue: 200,
            cgstAmount: 12,
            sgstAmount: 12,
            igstAmount: 0,
            total: 224,
            reason: 'Ordered too many',
            issuedAt: '2026-11-14T10:00:00',
          },
        ],
      },
      [`POST /api/orders/${ORDER_ID}/cancel-items`]: () => {
        current = after
        return {
          body: {
            order: after,
            creditNote: { number: 'CN/26-27/000007' },
            wholeOrderCancelled: false,
            refunded: 224,
          },
        }
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())

    await user.click(await screen.findByRole('button', { name: 'Cancel items' }))
    const dialog = await screen.findByRole('dialog')
    const notebooks = within(dialog).getByRole('textbox', { name: 'Units of Notebook to cancel' })
    await user.clear(notebooks)
    await user.type(notebooks, '2')
    expect(within(dialog).getByTestId('cancel-estimate')).toHaveTextContent('About ₹224.00 goes back')

    // A reason is needed
    await user.click(within(dialog).getByRole('button', { name: 'Cancel items' }))
    expect(within(dialog).getByText('Choose a reason')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('combobox', { name: /Why are you cancelling/ }))
    await user.click(await within(dialog).findByRole('option', { name: 'Ordered too many' }))
    await user.click(within(dialog).getByRole('button', { name: 'Cancel items' }))

    await waitFor(() => expect(backend.sent('POST', `/api/orders/${ORDER_ID}/cancel-items`)).toHaveLength(1))
    expect(backend.sent('POST', `/api/orders/${ORDER_ID}/cancel-items`)[0].body).toEqual({
      items: [{ sku: 'BOOK-01', quantity: 2 }],
      reason: 'Ordered too many',
    })
    expect(await screen.findByText('2 cancelled')).toBeInTheDocument()
    expect(await screen.findByText('CN/26-27/000007')).toBeInTheDocument()
    expect(screen.getByText('Cancelled items')).toBeInTheDocument()
  })

  it('warns that cancelling everything left cancels the order', async () => {
    fakeBackend({
      [`GET /api/orders/${ORDER_ID}`]: { body: order({ status: 'READY_FOR_DISPATCH' }) },
      'GET /api/returns': { body: [] },
    })
    const user = userEvent.setup()
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())

    await user.click(await screen.findByRole('button', { name: 'Cancel items' }))
    const dialog = await screen.findByRole('dialog')
    const pens = within(dialog).getByRole('textbox', { name: 'Units of Gel pen to cancel' })
    await user.clear(pens)
    await user.type(pens, '2')
    expect(within(dialog).getByText(/the whole order will be cancelled/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel order' })).toBeInTheDocument()
  })

  it('offers no partial cancel once the order has left, or with one unit left', async () => {
    fakeBackend({
      [`GET /api/orders/${ORDER_ID}`]: { body: order({ status: 'IN_TRANSIT' }) },
      'GET /api/returns': { body: [] },
    })
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())
    expect(await screen.findByText('CGST')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel items' })).not.toBeInTheDocument()
  })

  it('shows who is bringing the order once it is picked up', async () => {
    fakeBackend({
      [`GET /api/orders/${ORDER_ID}`]: { body: order({ status: 'OUT_FOR_DELIVERY' }) },
      'GET /api/returns': { body: [] },
      [`GET /api/orders/${ORDER_ID}/delivery-partner`]: {
        body: {
          orderId: ORDER_ID,
          partner: {
            name: 'Ravi S.',
            stage: 'ON_THE_WAY',
            hasPhoto: false,
            photoVersion: null,
            vehicleType: 'SCOOTER',
            vehicleNumber: 'KA05MN4321',
            rating: 4.7,
            ratingCount: 41,
            deliveries: 1280,
            pickedUpAt: '2026-11-16T09:00:00',
            deliveredAt: null,
          },
        },
      },
    })
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())

    const card = await screen.findByRole('region', { name: 'Delivery partner' })
    expect(within(card).getByText('Ravi S.')).toBeInTheDocument()
    expect(within(card).getByText('KA05MN4321')).toBeInTheDocument()
    expect(within(card).getByText('4.7 (41)')).toBeInTheDocument()
    expect(within(card).getByText('1,280 deliveries')).toBeInTheDocument()
  })

  it('shows no delivery partner before pickup', async () => {
    const backend = fakeBackend({
      [`GET /api/orders/${ORDER_ID}`]: { body: order({ status: 'READY_FOR_DISPATCH' }) },
      'GET /api/returns': { body: [] },
    })
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())
    expect(await screen.findByText('CGST')).toBeInTheDocument()
    expect(screen.queryByText('Your delivery partner')).not.toBeInTheDocument()
    expect(backend.sent('GET', `/api/orders/${ORDER_ID}/delivery-partner`)).toHaveLength(0)
  })

  it('requests a return of a recently delivered order', async () => {
    const deliveredAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const backend = fakeBackend({
      [`GET /api/orders/${ORDER_ID}`]: { body: order({ status: 'DELIVERED', deliveredAt }) },
      'GET /api/returns': { body: [] },
      'POST /api/returns': {
        status: 201,
        body: {
          returnId: 'RET-1',
          orderId: ORDER_ID,
          customerId: 'CUST-100',
          status: 'REQUESTED',
          reason: 'Damaged or defective',
          requestedAt: '2026-11-08T12:00:00',
          items: [],
        },
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())

    await user.click(await screen.findByRole('button', { name: 'Return items' }))
    const dialog = await screen.findByRole('dialog')
    const quantity = within(dialog).getByRole('textbox', { name: 'Units of Gel pen to return' })
    await user.clear(quantity)
    await user.type(quantity, '1')
    await user.click(within(dialog).getByRole('combobox', { name: /Why are you returning it/ }))
    await user.click(await within(dialog).findByRole('option', { name: 'Damaged or defective' }))
    await user.click(within(dialog).getByRole('button', { name: 'Request return' }))

    await waitFor(() => expect(backend.sent('POST', '/api/returns')).toHaveLength(1))
    expect(backend.sent('POST', '/api/returns')[0].body).toEqual({
      orderId: ORDER_ID,
      reason: 'Damaged or defective',
      items: [{ sku: 'PEN-01', quantity: 1 }],
    })
  })

  it('hides returns once the window has closed', async () => {
    fakeBackend({
      [`GET /api/orders/${ORDER_ID}`]: { body: order({ status: 'DELIVERED', deliveredAt: '2026-01-01T10:00:00' }) },
      'GET /api/returns': { body: [] },
    })
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())
    expect(await screen.findByText(/Return window closed on/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Return items' })).not.toBeInTheDocument()
  })
})

describe('address', () => {
  it('saves a new default address after checking the PIN code', async () => {
    const backend = fakeBackend({ 'PUT /api/me/address': { body: ALICE_ADDRESS } })
    const refreshMe = vi.fn(async () => {})
    const user = userEvent.setup()
    renderRoutes(routes, '/account/address', fakeAuth(['CUSTOMER'], { refreshMe }))

    await user.type(await screen.findByRole('textbox', { name: /Full name/ }), 'Alice Smith')
    await user.type(screen.getByRole('textbox', { name: /Mobile number/ }), '+91 98450 00101')
    await user.type(screen.getByRole('textbox', { name: /Flat, house no/ }), '12, 4th Cross')
    await user.type(screen.getByRole('textbox', { name: /City/ }), 'Bengaluru')
    await user.click(screen.getByRole('combobox', { name: /State/ }))
    await user.click(await screen.findByRole('option', { name: 'Karnataka' }))
    await user.type(screen.getByRole('textbox', { name: /PIN code/ }), '56003')
    await user.click(screen.getByRole('button', { name: 'Save address' }))

    expect(await screen.findByText('Enter a 6-digit PIN code')).toBeInTheDocument()
    expect(backend.sent('PUT', '/api/me/address')).toHaveLength(0)

    await user.type(screen.getByRole('textbox', { name: /PIN code/ }), '8')
    await user.click(screen.getByRole('button', { name: 'Save address' }))

    await waitFor(() => expect(refreshMe).toHaveBeenCalled())
    expect(backend.sent('PUT', '/api/me/address')[0].body).toMatchObject({
      state: 'Karnataka',
      postalCode: '560038',
      country: 'IN',
    })
  })
})

describe('my returns', () => {
  it('tells the customer the driver is on the way and to give the code after handing over', async () => {
    fakeBackend({
      'GET /api/returns': {
        body: [
          {
            returnId: 'RET-1',
            orderId: ORDER_ID,
            customerId: 'CUST-100',
            status: 'APPROVED',
            pickupStatus: 'ON_THE_WAY',
            reason: 'Damaged or defective',
            requestedAt: '2026-11-08T12:00:00',
            decidedAt: '2026-11-08T13:00:00',
            decidedBy: 'ADM-001',
            decisionNote: null,
            pickedUpAt: null,
            pickedUpBy: null,
            receivedAt: null,
            receivedBy: null,
            items: [{ orderItemId: 1, sku: 'PEN-01', quantity: 1, condition: null }],
          },
        ],
      },
    })
    renderRoutes(routes, '/returns', customer())
    expect(await screen.findByText('Driver on the way', { selector: '.mantine-Badge-label' })).toBeInTheDocument()
    expect(screen.getByText(/give it to them only after you have handed over the items/)).toBeInTheDocument()
    expect(screen.getByText('Picked up')).toBeInTheDocument()
  })
})
