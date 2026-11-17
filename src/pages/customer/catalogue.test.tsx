import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../../router'
import { fakeBackend, graphqlReplies } from '../../test/fakeBackend'
import { card, detail, productPage } from '../../test/fixtures'
import { fakeAuth, renderRoutes } from '../../test/render'

afterEach(() => vi.unstubAllGlobals())

const customer = () => fakeAuth(['CUSTOMER'])

/** The product-list requests, not the search box's suggestions. */
function productQueries(backend: ReturnType<typeof fakeBackend>) {
  return backend.sent('POST', '/graphql').filter((c) => /\bproducts\(/.test((c.body as { query: string }).query))
}

describe('shop search and filters', () => {
  it('shows photos and filter counts, and sends a chosen brand as a filter', async () => {
    const backend = fakeBackend({
      'POST /graphql': graphqlReplies({
        products: productPage([card(), card({ sku: 'LAMP', name: 'Lamp', imageKey: null, imageAlt: null, rating: { average: 4.5, count: 12 } })]),
      }),
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/shop', customer())

    expect(await screen.findByRole('img', { name: 'Gel pen, side view' })).toHaveAttribute(
      'src',
      '/api/public/images/products/PEN-01/a-400.jpg',
    )
    expect(screen.getByRole('img', { name: 'Lamp (no photo)' })).toBeInTheDocument()
    expect(screen.getByLabelText('Rated 4.5 out of 5 by 12 customers')).toBeInTheDocument()
    expect(screen.getByText('2 products')).toBeInTheDocument()

    // The full filter panel opens from the Filters button
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const panel = await screen.findByRole('dialog', { name: 'Filters' })
    await user.click(within(panel).getByRole('checkbox', { name: 'Typro (2)' }))
    await waitFor(() =>
      expect(
        backend.sent('POST', '/graphql').some((c) => {
          const v = (c.body as { variables: { filter?: { brands?: string[] } } }).variables
          return v.filter?.brands?.includes('Typro')
        }),
      ).toBe(true),
    )
    // The filter shows as a removable chip, and is in the address
    expect(await screen.findByRole('button', { name: 'Remove Typro' })).toBeInTheDocument()
  })

  it('shows categories as pictures, and a chosen one with its sub-categories', async () => {
    const tree = [
      {
        id: '1', slug: 'office', name: 'Office', imageKey: 'products/PEN-01/a-400.jpg', productCount: 3,
        children: [
          { id: '2', slug: 'pens', name: 'Pens', imageKey: null, productCount: 2 },
          { id: '3', slug: 'paper', name: 'Paper', imageKey: null, productCount: 1 },
          { id: '4', slug: 'empty', name: 'Nothing here', imageKey: null, productCount: 0 },
        ],
      },
      { id: '5', slug: 'kitchen', name: 'Kitchen', imageKey: null, productCount: 0, children: [] },
    ]
    const backend = fakeBackend({
      'POST /graphql': graphqlReplies({ products: productPage([card()]), categories: tree }),
    })
    const user = userEvent.setup()
    const { router } = renderRoutes(routes, '/shop?brand=Linkr', customer())

    const strip = await screen.findByRole('list', { name: 'Categories' })
    expect(within(strip).getByRole('listitem', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(await within(strip).findByRole('listitem', { name: 'Office' })).toHaveAttribute('aria-pressed', 'false')
    // A category with nothing on sale has no tile
    expect(within(strip).queryByRole('listitem', { name: 'Kitchen' })).not.toBeInTheDocument()

    await user.click(within(strip).getByRole('listitem', { name: 'Office' }))
    await waitFor(() => expect(router.state.location.search).toBe('?category=office'))
    expect(await screen.findByRole('heading', { name: 'Office' })).toBeInTheDocument()
    expect(within(strip).getByRole('listitem', { name: 'Office' })).toHaveAttribute('aria-pressed', 'true')

    const subs = screen.getByRole('radiogroup', { name: 'Office sub-categories' })
    expect(within(subs).queryByRole('radio', { name: /Nothing here/ })).not.toBeInTheDocument()
    await user.click(within(subs).getByRole('radio', { name: 'Pens (2)' }))
    await waitFor(() => expect(router.state.location.search).toBe('?category=pens'))
    expect(await screen.findByRole('heading', { name: 'Pens' })).toBeInTheDocument()
    // Still under Office
    expect(within(strip).getByRole('listitem', { name: 'Office' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() =>
      expect(
        productQueries(backend).some(
          (c) => (c.body as { variables: { filter: { categories?: string[] } } }).variables.filter.categories?.[0] === 'pens',
        ),
      ).toBe(true),
    )

    await user.click(within(strip).getByRole('listitem', { name: 'All' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(screen.queryByRole('radiogroup', { name: 'Office sub-categories' })).not.toBeInTheDocument()
  })

  it('reads the filters from the address', async () => {
    const backend = fakeBackend({ 'POST /graphql': graphqlReplies({ products: productPage([card()]) }) })
    renderRoutes(routes, '/shop?q=pen&category=pens&min=50&max=500&sort=PRICE_LOW_HIGH&page=2', customer())

    expect(await screen.findByRole('heading', { name: 'Results for “pen”' })).toBeInTheDocument()
    await waitFor(() => expect(productQueries(backend)).not.toHaveLength(0))
    const sent = productQueries(backend)[0].body as { variables: Record<string, unknown> }
    expect(sent.variables).toMatchObject({
      filter: { text: 'pen', categories: ['pens'], minPrice: 50, maxPrice: 500 },
      sort: 'PRICE_LOW_HIGH',
      page: 1,
      size: 24,
    })
    expect(await screen.findByRole('button', { name: 'Remove ₹50.00 – ₹500.00' })).toBeInTheDocument()
  })

  it('shows a product page with photos, specifications and related products', async () => {
    fakeBackend({ 'POST /graphql': graphqlReplies({ product: detail({ maxPerOrder: 2 }) }) })
    const user = userEvent.setup()
    renderRoutes(routes, '/shop/PEN-01', customer())

    expect(await screen.findByRole('heading', { name: 'Gel pen' })).toBeInTheDocument()
    expect(screen.getByText('Smooth gel ink.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pens' })).toHaveAttribute('href', '/shop?category=pens')
    expect(screen.getByRole('link', { name: 'Office' })).toHaveAttribute('href', '/shop?category=office')
    expect(screen.getByRole('rowheader', { name: 'Ink' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'More in Pens' })).toBeInTheDocument()
    expect(screen.getByText('Fine liner')).toBeInTheDocument()
    expect(screen.getByText('At most 2 per order.')).toBeInTheDocument()

    const gallery = screen.getByRole('list', { name: 'Photos' })
    await user.click(within(gallery).getByRole('listitem', { name: 'Photo 2: Nib' }))
    await user.click(screen.getByRole('button', { name: 'Enlarge photo: Nib' }))
    const viewer = await screen.findByRole('dialog')
    expect(within(viewer).getByText('Nib · 2 of 2')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('says so when a product is not on sale', async () => {
    fakeBackend({ 'POST /graphql': graphqlReplies({ product: null }) })
    renderRoutes(routes, '/shop/GONE', customer())
    expect(await screen.findByRole('heading', { name: 'This product is not available' })).toBeInTheDocument()
  })
})

describe('product page extras', () => {
  it('gives a delivery date for the PIN of the saved address, and remembers what was viewed', async () => {
    const backend = fakeBackend({
      'POST /graphql': graphqlReplies({
        product: detail(),
        deliveryEstimate: {
          outcome: 'DELIVERABLE',
          pin: '560038',
          district: 'Bengaluru Urban',
          state: 'Karnataka',
          earliest: '2026-11-12',
          latest: '2026-11-13',
          approximate: false,
          minutesToCutOff: 150,
          holidays: [{ date: '2026-11-11', name: 'Test festival' }],
        },
      }),
    })
    const auth = fakeAuth(['CUSTOMER'], {
      me: {
        userId: 'CUST-100',
        fullName: 'Alice Smith',
        email: 'a@example.com',
        roles: ['CUSTOMER'],
        defaultAddress: {
          recipientName: 'Alice',
          recipientPhone: '+91 98450 00101',
          line1: '12, 4th Cross',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560038',
          country: 'IN',
        },
      },
    })
    renderRoutes(routes, '/shop/PEN-01', auth)

    expect(await screen.findByText(/Delivered between 12 Nov 2026 and 13 Nov 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Bengaluru Urban, Karnataka/)).toBeInTheDocument()
    expect(screen.getByText('Order within 2 h 30 min and it leaves today.')).toBeInTheDocument()
    expect(screen.getByText('No deliveries on Test festival (11 Nov 2026).')).toBeInTheDocument()
    const delivery = backend.sent('POST', '/graphql').find((c) => /deliveryEstimate/.test((c.body as { query: string }).query))
    expect(delivery).toBeDefined()
    expect((delivery!.body as { variables: unknown }).variables).toEqual({ sku: 'PEN-01', pin: '560038' })

    expect(JSON.parse(window.localStorage.getItem('order-platform:recent:CUST-100') ?? '[]')[0].sku).toBe('PEN-01')
    window.localStorage.clear()
  })

  it('says when a PIN is unknown, and copies the link to share', async () => {
    fakeBackend({
      'POST /graphql': graphqlReplies({
        product: detail(),
        deliveryEstimate: { outcome: 'UNKNOWN_PIN', pin: '999999', district: null, state: null, earliest: null, latest: null, approximate: false, minutesToCutOff: null, holidays: [] },
      }),
    })
    // user-event provides the clipboard in tests
    const user = userEvent.setup()
    renderRoutes(routes, '/shop/PEN-01', customer())

    await user.type(await screen.findByRole('textbox', { name: 'Deliver to' }), '999999')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText(/We could not find PIN 999999/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(await screen.findByText('Link copied')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(window.location.origin + '/shop/PEN-01')
    window.localStorage.clear()
  })
})
