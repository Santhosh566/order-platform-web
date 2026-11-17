import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../router'
import type { Quote } from '../checkout/queries'
import { fakeBackend } from '../test/fakeBackend'
import { ALICE_ADDRESS, CATALOG, ORDER_ID, order } from '../test/fixtures'
import { fakeAuth, renderRoutes } from '../test/render'
import type { GiftCard, Wallet } from './queries'
import { refundSplit } from './refundSplit'

const CART_KEY = 'order-platform:cart:CUST-100'
const customer = () =>
  fakeAuth(['CUSTOMER'], {
    me: { userId: 'CUST-100', fullName: 'Alice Smith', email: 'a@example.com', roles: ['CUSTOMER'], defaultAddress: ALICE_ADDRESS },
  })

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

const QUOTE: Quote = {
  items: [],
  itemsTotal: 238,
  discount: 0,
  total: 238,
  taxTotal: 36.3,
  cgstTotal: 18.15,
  sgstTotal: 18.15,
  igstTotal: 0,
  currency: 'INR',
  couponCode: null,
  couponError: null,
  cashOnDelivery: { available: true, reason: null, maxOrderValue: 50000 },
}

function wallet(overrides: Partial<Wallet> = {}): Wallet {
  return { customerId: 'CUST-100', balance: 100, available: 100, currency: 'INR', history: [], ...overrides }
}

function checkoutBackend(w: Wallet) {
  return fakeBackend({
    'GET /api/public/catalog': { body: CATALOG },
    'POST /api/checkout/quote': { body: QUOTE },
    'GET /api/checkout/slots': { body: { bookable: false, reason: 'x', standardBy: null, days: [] } },
    'GET /api/checkout/offers': { body: [] },
    'GET /api/wallet': { body: w },
    'POST /api/orders': { status: 202, body: { status: 'PENDING', orderId: ORDER_ID, currency: 'INR', total: 238 } },
    [`GET /api/orders/${ORDER_ID}`]: { body: order({ status: 'PENDING' }) },
    'GET /api/returns': { body: [] },
  })
}

describe('paying from the wallet at checkout', () => {
  beforeEach(() => {
    window.localStorage.setItem(
      CART_KEY,
      JSON.stringify([
        { sku: 'PEN-01', name: 'Gel pen', unitPrice: 59, quantity: 2 },
        { sku: 'BOOK-01', name: 'Notebook', unitPrice: 120, quantity: 1 },
      ]),
    )
  })

  it('uses the balance first and the card for the rest, unless unticked', async () => {
    const backend = checkoutBackend(wallet())
    const user = userEvent.setup()
    renderRoutes(routes, '/cart', customer())

    const use = await screen.findByRole('checkbox', { name: /Use my wallet balance \(₹100.00\)/ })
    expect(use).toBeChecked()
    expect(await screen.findByLabelText('To pay online')).toHaveTextContent('₹138.00')
    expect(screen.getByText('− ₹100.00')).toBeInTheDocument()

    // Cash on delivery cannot be combined with it
    await user.click(screen.getByRole('radio', { name: /Cash on delivery/ }))
    expect(screen.getByRole('checkbox', { name: /Use my wallet balance/ })).toBeDisabled()
    expect(screen.queryByLabelText('To pay online')).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Pay online/ }))

    await user.click(screen.getByRole('button', { name: 'Place order' }))
    await waitFor(() => expect(backend.sent('POST', '/api/orders')).toHaveLength(1))
    expect(backend.sent('POST', '/api/orders')[0].body).toMatchObject({ paymentMethod: 'PREPAID', useWallet: true })
    expect(await screen.findByText(/paid from your wallet and online/)).toBeInTheDocument()
  })

  it('sends no wallet when the customer unticks it', async () => {
    const backend = checkoutBackend(wallet())
    const user = userEvent.setup()
    renderRoutes(routes, '/cart', customer())
    await user.click(await screen.findByRole('checkbox', { name: /Use my wallet balance/ }))
    expect(screen.queryByLabelText('To pay online')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Place order' }))
    await waitFor(() => expect(backend.sent('POST', '/api/orders')).toHaveLength(1))
    expect(backend.sent('POST', '/api/orders')[0].body).toMatchObject({ useWallet: false })
  })

  it('pays the whole order from the wallet without a card', async () => {
    checkoutBackend(wallet({ balance: 1000, available: 1000 }))
    renderRoutes(routes, '/cart', customer())
    expect(await screen.findByText('Your wallet pays the whole order')).toBeInTheDocument()
    expect(screen.getByLabelText('To pay online')).toHaveTextContent('₹0.00')
    expect(screen.queryByRole('radio', { name: /Cash on delivery/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/test mode/)).not.toBeInTheDocument()
  })
})

describe('the wallet page', () => {
  it('shows the balance and history, and adds a gift card', async () => {
    const backend = fakeBackend({
      'GET /api/wallet': {
        body: wallet({
          balance: 250,
          available: 250,
          history: [
            {
              id: 2,
              kind: 'ORDER_REFUND',
              amount: 150,
              balanceAfter: 250,
              reference: 'WAL-0000000B',
              orderId: ORDER_ID,
              giftCardLastFour: null,
              note: 'Refund',
              createdBy: null,
              createdAt: '2026-11-17T10:00:00',
            },
            {
              id: 1,
              kind: 'ADMIN_CREDIT',
              amount: 100,
              balanceAfter: 100,
              reference: 'WAL-0000000A',
              orderId: null,
              giftCardLastFour: null,
              note: 'Sorry it was late',
              createdBy: 'ADMIN-1',
              createdAt: '2026-11-16T10:00:00',
            },
          ],
        }),
      },
      'POST /api/wallet/gift-cards': (call) =>
        (call.body as { code: string }).code === 'BAD'
          ? { status: 400, body: { status: 'REJECTED', reason: 'This gift card code is not valid. Check it and try again.' } }
          : { body: { amount: 500, lastFour: 'PQRS', balance: 750, entry: {} } },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/wallet', customer())

    expect(await screen.findByLabelText('Wallet balance')).toHaveTextContent('₹250.00')
    const history = screen.getByRole('table', { name: 'Wallet history' })
    expect(within(history).getByText('Refund')).toBeInTheDocument()
    expect(within(history).getByText('Sorry it was late')).toBeInTheDocument()
    expect(within(history).getByText('+ ₹150.00')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Gift card code' }), 'abcd-efgh-jkmn-pqrs')
    await user.click(screen.getByRole('button', { name: 'Add to wallet' }))
    await waitFor(() => expect(backend.sent('POST', '/api/wallet/gift-cards')).toHaveLength(1))
    expect(backend.sent('POST', '/api/wallet/gift-cards')[0].body).toEqual({ code: 'abcd-efgh-jkmn-pqrs' })
    expect(await screen.findByText(/₹500.00 is in your wallet/)).toBeInTheDocument()
  })
})

describe('gift cards (admin)', () => {
  const CARD: GiftCard = {
    id: 7,
    maskedCode: 'XXXX-XXXX-XXXX-WXYZ',
    amount: 500,
    currency: 'INR',
    label: 'Diwali',
    expiresAt: '2027-11-17T23:59:59',
    status: 'ACTIVE',
    redeemedBy: null,
    redeemedByName: null,
    redeemedAt: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    createdAt: '2026-11-17T10:00:00',
    createdBy: 'ADMIN-1',
  }

  it('issues cards, shows the codes once, and stops a card', async () => {
    const backend = fakeBackend({
      'GET /api/admin/gift-cards': { body: [CARD] },
      'POST /api/admin/gift-cards': {
        status: 201,
        body: {
          label: 'Diwali',
          amount: 1000,
          expiresAt: '2027-11-17T23:59:59',
          cards: [
            { id: 8, code: 'ABCD-EFGH-JKMN-PQRS', amount: 1000, expiresAt: '2027-11-17T23:59:59' },
            { id: 9, code: 'BCDE-FGHJ-KMNP-QRST', amount: 1000, expiresAt: '2027-11-17T23:59:59' },
          ],
        },
      },
      'POST /api/admin/gift-cards/7/void': { body: { ...CARD, status: 'VOID' } },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/gift-cards', fakeAuth(['ADMIN']))

    expect(await screen.findByText('XXXX-XXXX-XXXX-WXYZ')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Issue gift cards' }))
    const value = await screen.findByRole('textbox', { name: /Value of each card/ })
    await user.clear(value)
    await user.type(value, '1000')
    const count = screen.getByRole('textbox', { name: /How many/ })
    await user.clear(count)
    await user.type(count, '2')
    await user.type(screen.getByRole('textbox', { name: 'Batch name' }), 'Diwali')
    expect(screen.getByText('2 cards worth ₹2,000.00 in all.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Issue' }))

    await waitFor(() => expect(backend.sent('POST', '/api/admin/gift-cards')).toHaveLength(1))
    expect(backend.sent('POST', '/api/admin/gift-cards')[0].body).toEqual({
      amount: 1000,
      count: 2,
      expiresAt: null,
      label: 'Diwali',
    })
    const codes = await screen.findByLabelText('Gift card codes')
    expect(within(codes).getByText('ABCD-EFGH-JKMN-PQRS')).toBeInTheDocument()
    expect(screen.getByText(/cannot be shown again/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Done' }))

    await user.click(screen.getByRole('button', { name: 'Stop card XXXX-XXXX-XXXX-WXYZ' }))
    await user.type(await screen.findByRole('textbox', { name: 'Why' }), 'Lost in the post')
    await user.click(screen.getByRole('button', { name: 'Stop card' }))
    await waitFor(() => expect(backend.sent('POST', '/api/admin/gift-cards/7/void')).toHaveLength(1))
    expect(backend.sent('POST', '/api/admin/gift-cards/7/void')[0].body).toEqual({ reason: 'Lost in the post' })
  })
})

describe('refundSplit', () => {
  it('sends refunds to the card first and the wallet last, as the server does', () => {
    const paid = order({ total: 2360, walletAmount: 500, cardAmount: 1860, refundedTotal: 0, walletRefunded: 0 })
    expect(refundSplit(paid, 1180)).toEqual({ toCard: 1180, toWallet: 0 })
    const after = { ...paid, refundedTotal: 1180 }
    expect(refundSplit(after, 1180)).toEqual({ toCard: 680, toWallet: 500 })
    const walletOnly = order({ total: 118, walletAmount: 118, cardAmount: 0 })
    expect(refundSplit(walletOnly, 118)).toEqual({ toCard: 0, toWallet: 118 })
  })
})

describe('an order paid partly from the wallet', () => {
  it('shows the wallet part and the card part', async () => {
    fakeBackend({
      [`GET /api/orders/${ORDER_ID}`]: {
        body: order({ status: 'CONFIRMED', total: 118, walletAmount: 18, cardAmount: 100, refundedTotal: 0 }),
      },
      'GET /api/returns': { body: [] },
    })
    renderRoutes(routes, `/orders/${ORDER_ID}`, customer())
    expect((await screen.findByText('From wallet')).parentElement).toHaveTextContent('₹18.00')
    expect(screen.getByText('Online').parentElement).toHaveTextContent('₹100.00')
  })
})
