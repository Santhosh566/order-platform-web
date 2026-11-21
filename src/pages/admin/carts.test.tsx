import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CartPage, CartStats } from '../../admin/carts'
import { routes } from '../../router'
import { fakeBackend } from '../../test/fakeBackend'
import { fakeAuth, renderRoutes } from '../../test/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

const STATS: CartStats = {
  from: '2026-10-23',
  to: '2026-11-21',
  started: 40,
  ordered: 22,
  reminded: 12,
  recovered: 3,
  recoveryRate: 0.25,
  recoveredRevenue: 4599,
  emptied: 4,
  expired: 2,
  couponsSent: 5,
  couponsUsed: 2,
  open: 9,
  openValue: 18250.5,
}

const PAGE: CartPage = {
  items: [
    {
      cartId: 7,
      customerId: 'CUST-100',
      customerName: 'Alice Smith',
      customerEmail: 'alice@example.com',
      status: 'RECOVERED',
      itemCount: 3,
      value: 1400,
      createdAt: '2026-11-19T10:00:00',
      updatedAt: '2026-11-19T10:05:00',
      remindersSent: 2,
      lastRemindedAt: '2026-11-20T10:05:00',
      reminderCoupon: 'CARTX7K2QP',
      orderId: 'ORD-1',
      items: [
        { sku: 'KET-1', name: 'Kettle', quantity: 1 },
        { sku: 'MUG-1', name: 'Mug', quantity: 2 },
      ],
    },
  ],
  totalItems: 1,
  page: 0,
  size: 25,
}

describe('abandoned carts', () => {
  it('shows how many reminded carts came back, and lists carts by status', async () => {
    const backend = fakeBackend({
      'GET /api/admin/carts/stats': { body: STATS },
      'GET /api/admin/carts': { body: PAGE },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/carts', fakeAuth(['ADMIN']))

    expect(await screen.findByRole('group', { name: 'Recovered' })).toHaveTextContent('25%3 of 12 reminded carts ordered')
    expect(screen.getByRole('group', { name: 'Recovered sales' })).toHaveTextContent('₹4,599.00')
    expect(screen.getByText('1 × Kettle, 2 × Mug')).toBeInTheDocument()
    expect(screen.getByText('Coupon CARTX7K2QP')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View order' })).toHaveAttribute('href', '/admin/orders/ORD-1')

    await user.click(screen.getByRole('radio', { name: 'Recovered' }))
    await waitFor(() => expect(backend.sent('GET', '/api/admin/carts').at(-1)?.query).toMatchObject({ status: 'RECOVERED' }))
  })
})
