import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../router'
import { fakeBackend, graphqlReplies, type Call } from '../test/fakeBackend'
import { detail } from '../test/fixtures'
import { fakeAuth, renderRoutes } from '../test/render'
import type { Review } from './queries'

afterEach(() => vi.unstubAllGlobals())

function review(overrides: Partial<Review> = {}): Review {
  return {
    id: 7,
    sku: 'PEN-01',
    productName: 'Gel pen',
    customerId: 'CUST-100',
    author: 'Alice S.',
    orderId: 'ORD-3f2a9c1e-1111-2222-3333-444455556666',
    rating: 4,
    title: 'Writes smoothly',
    body: 'No blots so far.',
    status: 'PENDING',
    createdAt: '2026-11-08T10:00:00',
    updatedAt: null,
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    ...overrides,
  }
}

const published = {
  rating: { average: 4.5, count: 4, distribution: [0, 0, 0, 2, 2], reviewCount: 1 },
  reviews: {
    totalItems: 1,
    totalPages: 1,
    page: 0,
    size: 5,
    items: [
      {
        id: '3',
        author: 'Ravi K.',
        rating: 5,
        title: 'Best pen I own',
        body: 'Lasts for months.',
        createdAt: '2026-11-02T09:00:00',
        edited: false,
        verifiedPurchase: true,
      },
    ],
  },
}

describe('reviews on the product page', () => {
  it('shows the breakdown and published reviews, and lets a buyer write one', async () => {
    const backend = fakeBackend({
      'POST /graphql': graphqlReplies({ product: detail(), reviews: published }),
      'GET /api/wishlist': { body: [] },
      'GET /api/reviews/PEN-01': { body: { canReview: true, review: null } },
      'PUT /api/reviews/PEN-01': (call: Call) => ({ body: review({ ...(call.body as object), status: 'PENDING' }) }),
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/shop/PEN-01', fakeAuth(['CUSTOMER']))

    const section = await screen.findByRole('region', { name: 'Ratings and reviews' })
    expect(await within(section).findByRole('listitem', { name: '5 stars: 2' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: '1 stars: 0' })).toBeInTheDocument()
    const ravi = within(section).getByRole('listitem', { name: 'Ravi K., 5 stars' })
    expect(within(ravi).getByText('Best pen I own')).toBeInTheDocument()
    expect(within(ravi).getByText('Verified purchase')).toBeInTheDocument()

    await user.click(await within(section).findByRole('button', { name: 'Write a review' }))
    const dialog = await screen.findByRole('dialog', { name: 'Review this product' })
    // Stars are required
    await user.click(within(dialog).getByRole('button', { name: 'Submit review' }))
    expect(within(dialog).getByText('Choose from 1 to 5 stars')).toBeInTheDocument()
    expect(backend.sent('PUT', '/api/reviews/PEN-01')).toHaveLength(0)

    // Chosen with the keyboard: the stars are radios
    within(dialog).getByRole('radio', { name: '4' }).focus()
    await user.keyboard('{Enter}')
    expect(within(dialog).getByText('Good')).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Writes smoothly')
    // Words mean the team reads it first, and the dialog says so
    expect(within(dialog).getByText(/read by our team before they appear/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Submit review' }))

    await waitFor(() => expect(backend.sent('PUT', '/api/reviews/PEN-01')).toHaveLength(1))
    expect(backend.sent('PUT', '/api/reviews/PEN-01')[0].body).toEqual({ rating: 4, title: 'Writes smoothly', body: null })
    expect(await screen.findByText(/once our team has read it/)).toBeInTheDocument()
  })

  it('does not offer a review to a customer who has not received the product', async () => {
    fakeBackend({
      'POST /graphql': graphqlReplies({ product: detail() }),
      'GET /api/wishlist': { body: [] },
      'GET /api/reviews/PEN-01': { body: { canReview: false, review: null } },
    })
    renderRoutes(routes, '/shop/PEN-01', fakeAuth(['CUSTOMER']))
    const section = await screen.findByRole('region', { name: 'Ratings and reviews' })
    expect(await within(section).findByText(/No reviews yet/)).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: 'Write a review' })).not.toBeInTheDocument()
  })
})

describe('my reviews', () => {
  it('lists products to rate and reviews with their status, including why one was rejected', async () => {
    fakeBackend({
      'GET /api/reviews': {
        body: {
          toReview: [{ sku: 'LAMP-9', name: 'Desk lamp', deliveredAt: '2026-11-07T12:00:00' }],
          reviews: [
            review(),
            review({ id: 8, sku: 'MUG-1', productName: 'Mug', status: 'REJECTED', decisionNote: 'No phone numbers.' }),
          ],
        },
      },
      'GET /api/public/thumbnails': { body: [] },
    })
    renderRoutes(routes, '/reviews', fakeAuth(['CUSTOMER']))

    const waiting = await screen.findByRole('list', { name: 'Waiting for your review' })
    expect(within(waiting).getByRole('button', { name: 'Rate Desk lamp' })).toBeInTheDocument()
    const mine = screen.getByRole('list', { name: 'Your reviews' })
    expect(within(within(mine).getByRole('listitem', { name: 'Gel pen' })).getByText('Waiting for approval')).toBeInTheDocument()
    const mug = within(mine).getByRole('listitem', { name: 'Mug' })
    expect(within(mug).getByText('Not published')).toBeInTheDocument()
    expect(within(mug).getByText(/No phone numbers\./)).toBeInTheDocument()
  })
})

describe('moderating reviews', () => {
  it('publishes one and rejects another with a note for the customer', async () => {
    const backend = fakeBackend({
      'GET /api/admin/reviews': {
        body: [review(), review({ id: 8, author: 'Bob J.', customerId: 'CUST-101', title: 'Call me', body: 'Ring 98450 00000' })],
      },
      'GET /api/public/thumbnails': { body: [] },
      'POST /api/admin/reviews/7/approve': { body: review({ status: 'APPROVED' }) },
      'POST /api/admin/reviews/8/reject': { body: review({ id: 8, status: 'REJECTED' }) },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/reviews', fakeAuth(['ADMIN']))

    const alice = await screen.findByRole('listitem', { name: 'Alice S. on Gel pen' })
    await user.click(within(alice).getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(backend.sent('POST', '/api/admin/reviews/7/approve')).toHaveLength(1))

    const bob = screen.getByRole('listitem', { name: 'Bob J. on Gel pen' })
    await user.click(within(bob).getByRole('button', { name: 'Reject' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reject review' })
    await user.click(within(dialog).getByRole('button', { name: 'Reject review' }))
    expect(within(dialog).getByText(/they are emailed this note/)).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: 'Note to the customer' }), 'No phone numbers.')
    await user.click(within(dialog).getByRole('button', { name: 'Reject review' }))
    await waitFor(() => expect(backend.sent('POST', '/api/admin/reviews/8/reject')).toHaveLength(1))
    expect(backend.sent('POST', '/api/admin/reviews/8/reject')[0].body).toEqual({ note: 'No phone numbers.' })
  })
})
