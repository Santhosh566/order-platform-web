import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../router'
import { fakeBackend, graphqlReplies, type Call } from '../test/fakeBackend'
import { card, detail, productPage } from '../test/fixtures'
import { fakeAuth, renderRoutes } from '../test/render'
import type { Banner, Offer, Promotion } from './queries'

afterEach(() => vi.unstubAllGlobals())

const lampOffer: Offer = {
  code: 'LAMPS20',
  description: '20% off desk lamps',
  discountType: 'PERCENT',
  discountValue: 20,
  maxDiscount: 500,
  minOrderValue: 999,
  endsAt: null,
  firstOrderOnly: false,
  targeted: true,
}

const wholeOrder: Offer = { ...lampOffer, code: 'WELCOME10', description: '10% off your first order', discountValue: 10, targeted: false, firstOrderOnly: true, minOrderValue: 0 }

function banner(overrides: Partial<Banner> = {}): Banner {
  return {
    id: 7,
    title: 'Diwali lights',
    message: 'Brighten up your home',
    callToAction: null,
    theme: 'ORANGE',
    imageKey: null,
    imageAlt: null,
    targetType: 'COUPON',
    sku: null,
    productName: null,
    categorySlug: null,
    categoryName: null,
    couponCode: 'LAMPS20',
    offer: lampOffer,
    appliesTo: ['Desk lamps'],
    ...overrides,
  }
}

describe('shop banners and offers', () => {
  it('shows banners, counts a view and a click, and opens the products a coupon is for', async () => {
    const lamp = card({ sku: 'LAMP-1', name: 'Desk lamp', offers: [lampOffer, wholeOrder] })
    const backend = fakeBackend({
      'GET /api/public/promotions': { body: [banner(), banner({ id: 8, title: 'New pens', targetType: 'PRODUCT', sku: 'PEN-01', couponCode: null, offer: null, appliesTo: [] })] },
      'POST /api/promotions/7/view': { status: 204 },
      'POST /api/promotions/7/click': { status: 204 },
      'POST /graphql': graphqlReplies({ products: productPage([lamp, card()]) }),
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/shop', fakeAuth(['CUSTOMER']))

    const carousel = await screen.findByRole('region', { name: 'Offers and promotions' })
    const slide = within(carousel).getByRole('group', { name: '1 of 2: Diwali lights' })
    expect(within(slide).getByText('20% off')).toBeInTheDocument()
    expect(within(slide).getByText('Code LAMPS20')).toBeInTheDocument()
    expect(within(slide).getByText(/On Desk lamps · up to ₹500.00/)).toBeInTheDocument()
    await waitFor(() => expect(backend.sent('POST', '/api/promotions/7/view')).toHaveLength(1))

    // The lamp's card shows its own coupon; the pen, with none, shows nothing
    expect(await screen.findByText('Extra 20% off')).toBeInTheDocument()
    expect(screen.getAllByText(/^Extra /)).toHaveLength(1)

    await user.click(within(slide).getByRole('link', { name: 'Shop the offer' }))
    expect(backend.sent('POST', '/api/promotions/7/click')).toHaveLength(1)
    expect(await screen.findByRole('heading', { name: 'Offer LAMPS20' })).toBeInTheDocument()
    const about = screen.getByLabelText('About this offer')
    expect(within(about).getByText('20% off desk lamps')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Offer LAMPS20' })).toBeInTheDocument()
    await waitFor(() =>
      expect(
        backend.sent('POST', '/graphql').some((c) => (c.body as { variables: { filter?: { offer?: string } } }).variables.filter?.offer === 'LAMPS20'),
      ).toBe(true),
    )
    // Banners belong on the plain shop, not on a filtered list
    expect(screen.queryByRole('region', { name: 'Offers and promotions' })).not.toBeInTheDocument()
  })

  it('leaves the shop as it was when there are no banners or they fail to load', async () => {
    fakeBackend({
      'GET /api/public/promotions': { status: 503, body: { status: 'UNAVAILABLE' } },
      'POST /graphql': graphqlReplies({ products: productPage([card()]) }),
    })
    renderRoutes(routes, '/shop', fakeAuth(['CUSTOMER']))
    expect(await screen.findByText('Gel pen')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Offers and promotions' })).not.toBeInTheDocument()
  })

  it('lists every offer on the product page, with the code to copy', async () => {
    fakeBackend({
      'POST /graphql': graphqlReplies({ product: { ...detail({ offers: [lampOffer, wholeOrder] }), related: [] } }),
    })
    renderRoutes(routes, '/shop/PEN-01', fakeAuth(['CUSTOMER']))

    const offers = await screen.findByRole('region', { name: 'Offers' })
    const lamp = within(offers).getByRole('listitem', { name: 'LAMPS20' })
    expect(within(lamp).getByText('On this product')).toBeInTheDocument()
    expect(within(lamp).getByText(/when you buy ₹999.00 or more of these products/)).toBeInTheDocument()
    const welcome = within(offers).getByRole('listitem', { name: 'WELCOME10' })
    expect(within(welcome).queryByText('On this product')).not.toBeInTheDocument()
    expect(within(welcome).getByText(/first order only/)).toBeInTheDocument()
    expect(within(offers).getByRole('button', { name: 'Copy LAMPS20' })).toBeInTheDocument()
  })
})

describe('admin', () => {
  const categories = [
    { id: 1, slug: 'home', name: 'Home', parentId: null, sortOrder: 0, active: true, productCount: 3, children: [
      { id: 2, slug: 'lamps', name: 'Lamps', parentId: 1, sortOrder: 0, active: true, productCount: 2, children: [] },
    ] },
  ]

  it('creates a coupon for chosen categories only', async () => {
    const backend = fakeBackend({
      'GET /api/admin/coupons': { body: [] },
      'GET /api/admin/categories': { body: categories },
      'GET /api/admin/catalog': { body: { items: [], page: 0, totalItems: 0, totalPages: 0 } },
      'POST /api/admin/coupons': (call: Call) => ({ status: 201, body: { ...(call.body as object), used: 0, active: true, appliesTo: [] } }),
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/coupons', fakeAuth(['ADMIN']))

    await user.click(await screen.findByRole('button', { name: 'New coupon' }))
    const dialog = await screen.findByRole('dialog', { name: 'New coupon' })
    await user.type(within(dialog).getByRole('textbox', { name: /^Code/ }), 'lamps20')
    await user.type(within(dialog).getByRole('textbox', { name: /Shown to customers/ }), '20% off lamps')
    await user.click(within(dialog).getByRole('radio', { name: 'Chosen products' }))
    await user.click(within(dialog).getByRole('button', { name: 'Create coupon' }))
    expect(await screen.findByText('Choose the products or categories it is for')).toBeInTheDocument()
    expect(backend.sent('POST', '/api/admin/coupons')).toHaveLength(0)

    await user.click(within(dialog).getByLabelText('Categories', { selector: 'input:not([type=hidden])' }))
    await user.click(await screen.findByRole('option', { name: 'Home › Lamps' }))
    await user.click(within(dialog).getByRole('button', { name: 'Create coupon' }))
    await waitFor(() => expect(backend.sent('POST', '/api/admin/coupons')).toHaveLength(1))
    expect(backend.sent('POST', '/api/admin/coupons')[0].body).toMatchObject({ code: 'LAMPS20', categoryIds: [2], skus: [] })
  })

  it('lists promotions with their figures, and creates one for a coupon', async () => {
    const live: Promotion = {
      id: 7, title: 'Diwali lights', message: null, callToAction: null, theme: 'ORANGE', imageKey: null, imageAlt: null,
      targetType: 'COUPON', sku: null, productName: null, categoryId: null, categoryName: null, categorySlug: null,
      couponCode: 'LAMPS20', startsAt: null, endsAt: null, priority: 10, active: true, impressions: 400, clicks: 18,
      createdAt: '2026-11-10T10:00:00', createdBy: 'ADM-001', updatedAt: '2026-11-10T10:00:00', updatedBy: 'ADM-001',
      status: 'LIVE', unavailableReason: null,
    }
    const gone: Promotion = { ...live, id: 8, title: 'Old pen', targetType: 'PRODUCT', sku: 'PEN-9', productName: 'Old pen', couponCode: null, status: 'UNAVAILABLE', unavailableReason: 'The product is not on sale', impressions: 0, clicks: 0 }
    const backend = fakeBackend({
      'GET /api/admin/promotions': { body: [live, gone] },
      'GET /api/admin/categories': { body: categories },
      'GET /api/admin/coupons': {
        body: [{ code: 'LAMPS20', description: '20% off lamps', discountType: 'PERCENT', discountValue: 20, maxDiscount: null, minOrderValue: 0, startsAt: null, endsAt: null, usageLimit: null, perCustomerLimit: 1, firstOrderOnly: false, active: true, createdAt: '2026-11-01T10:00:00', createdBy: null, used: 0, appliesTo: [{ sku: null, categoryId: 2, name: 'Lamps' }] }],
      },
      'POST /api/admin/promotions': (call: Call) => ({ status: 201, body: { ...live, ...(call.body as object), id: 9 } }),
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/promotions', fakeAuth(['ADMIN']))

    const table = await screen.findByRole('table', { name: 'Promotions' })
    const row = within(table).getByText('Diwali lights').closest('tr') as HTMLElement
    expect(within(row).getByText('4.5%')).toBeInTheDocument()
    expect(within(row).getByText('Coupon: LAMPS20')).toBeInTheDocument()
    expect(within(table).getByText('Not shown')).toBeInTheDocument()
    expect(within(table).getByText('The product is not on sale')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New promotion' }))
    const dialog = await screen.findByRole('dialog', { name: 'New promotion' })
    await user.type(within(dialog).getByRole('textbox', { name: /Headline/ }), 'Light up Diwali')
    await user.click(within(dialog).getByRole('combobox', { name: /^Coupon/ }))
    await user.click(await screen.findByRole('option', { name: /LAMPS20/ }))
    // The preview shows the coupon's terms as the shop will
    const preview = within(dialog).getByRole('group', { name: 'Preview: Light up Diwali' })
    expect(within(preview).getByText('Code LAMPS20')).toBeInTheDocument()
    expect(within(preview).getByText(/On Lamps/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Create promotion' }))
    await waitFor(() => expect(backend.sent('POST', '/api/admin/promotions')).toHaveLength(1))
    expect(backend.sent('POST', '/api/admin/promotions')[0].body).toMatchObject({
      title: 'Light up Diwali',
      targetType: 'COUPON',
      couponCode: 'LAMPS20',
      sku: null,
      categoryId: null,
      priority: 0,
      active: true,
    })
    // Kept open, now as the saved promotion, so a picture can be added
    expect(await screen.findByRole('dialog', { name: 'Change promotion' })).toBeInTheDocument()
  })
})
