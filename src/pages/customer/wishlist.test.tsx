import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../../router'
import { fakeBackend, graphqlReplies, type Call } from '../../test/fakeBackend'
import { card, detail, productPage } from '../../test/fixtures'
import { fakeAuth, renderRoutes } from '../../test/render'
import type { WishlistEntry } from '../../wishlist/queries'

const customer = () => fakeAuth(['CUSTOMER'])

function entry(overrides: Partial<WishlistEntry> = {}): WishlistEntry {
  return {
    sku: 'PEN-01',
    name: 'Gel pen',
    product: card(),
    addedAt: '2026-11-01T10:00:00',
    notifyWhenAvailable: false,
    notifiedAt: null,
    ...overrides,
  }
}

/** PUT /api/wishlist/{sku} answered as the backend would. */
function savesAs(call: Call) {
  const sku = decodeURIComponent(call.path.split('/').pop()!)
  const notify = (call.body as { notifyWhenAvailable?: boolean } | undefined)?.notifyWhenAvailable
  return { body: entry({ sku, name: sku === 'PEN-01' ? 'Gel pen' : sku, notifyWhenAvailable: notify ?? false }) }
}

describe('wishlist', () => {
  it('saves a product from the shop with the heart, and takes it off again', async () => {
    const backend = fakeBackend({
      'POST /graphql': graphqlReplies({ products: productPage([card()]) }),
      'GET /api/wishlist': { body: [] },
      'PUT /api/wishlist/PEN-01': savesAs,
      'DELETE /api/wishlist/PEN-01': { status: 204 },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/shop', customer())

    const heart = await screen.findByRole('button', { name: 'Save Gel pen to wishlist' })
    expect(heart).toHaveAttribute('aria-pressed', 'false')
    await user.click(heart)
    const saved = await screen.findByRole('button', { name: 'Remove Gel pen from wishlist' })
    expect(saved).toHaveAttribute('aria-pressed', 'true')
    expect(backend.sent('PUT', '/api/wishlist/PEN-01')).toHaveLength(1)

    await user.click(saved)
    expect(await screen.findByRole('button', { name: 'Save Gel pen to wishlist' })).toBeInTheDocument()
    expect(backend.sent('DELETE', '/api/wishlist/PEN-01')).toHaveLength(1)
  })

  it('lists saved products with today’s price, adds one to the cart, and removes another', async () => {
    const backend = fakeBackend({
      'GET /api/wishlist': {
        body: [
          entry(),
          entry({ sku: 'LAMP-9', name: 'Desk lamp', product: card({ sku: 'LAMP-9', name: 'Desk lamp', stockStatus: 'OUT_OF_STOCK' }) }),
          entry({ sku: 'OLD-1', name: 'Fountain pen', product: null }),
        ],
      },
      'DELETE /api/wishlist/OLD-1': { status: 204 },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/wishlist', customer())

    const list = await screen.findByRole('list', { name: 'Wishlist' })
    const pen = within(list).getByRole('listitem', { name: 'Gel pen' })
    expect(within(pen).getByText('₹59.00')).toBeInTheDocument()
    await user.click(within(pen).getByRole('button', { name: 'Add to cart' }))
    expect(await screen.findByText('Added to cart')).toBeInTheDocument()

    const lamp = within(list).getByRole('listitem', { name: 'Desk lamp' })
    expect(within(lamp).queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument()
    expect(within(lamp).getByRole('button', { name: 'Email me when it is back' })).toBeInTheDocument()

    const gone = within(list).getByRole('listitem', { name: 'Fountain pen' })
    expect(within(gone).getByText('No longer sold')).toBeInTheDocument()
    await user.click(within(gone).getByRole('button', { name: 'Remove Fountain pen' }))
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Fountain pen' })).not.toBeInTheDocument())
    expect(backend.sent('DELETE', '/api/wishlist/OLD-1')).toHaveLength(1)
  })

  it('says so when the wishlist is empty', async () => {
    fakeBackend({ 'GET /api/wishlist': { body: [] } })
    renderRoutes(routes, '/wishlist', customer())
    expect(await screen.findByText(/Your wishlist is empty/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse the shop' })).toHaveAttribute('href', '/shop')
  })

  it('asks for the back-in-stock email on a sold-out product, and can cancel it', async () => {
    const backend = fakeBackend({
      'POST /graphql': graphqlReplies({ product: detail({ stockStatus: 'OUT_OF_STOCK' }) }),
      'GET /api/wishlist': { body: [] },
      'PUT /api/wishlist/PEN-01': savesAs,
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/shop/PEN-01', customer())

    expect(await screen.findByRole('button', { name: 'Sold out' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Email me when it is back' }))
    expect(await screen.findByText('We will email you when it is back.')).toBeInTheDocument()
    expect(backend.sent('PUT', '/api/wishlist/PEN-01')[0].body).toEqual({ notifyWhenAvailable: true })
    // Asking also saved it
    expect(screen.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByRole('button', { name: 'Email me when it is back' })).toBeInTheDocument()
    expect(backend.sent('PUT', '/api/wishlist/PEN-01')[1].body).toEqual({ notifyWhenAvailable: false })
  })

  it('tells the shopper when it was emailed and the product sold out again', async () => {
    fakeBackend({
      'POST /graphql': graphqlReplies({ product: detail({ stockStatus: 'OUT_OF_STOCK' }) }),
      'GET /api/wishlist': {
        body: [entry({ notifyWhenAvailable: true, notifiedAt: '2026-11-05T09:00:00', product: card({ stockStatus: 'OUT_OF_STOCK' }) })],
      },
    })
    renderRoutes(routes, '/shop/PEN-01', customer())
    expect(await screen.findByText(/We emailed you on .* it has sold out again/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Email me when it is back' })).toBeInTheDocument()
  })
})
