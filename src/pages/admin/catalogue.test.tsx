import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ProductDetail, ProductPhoto } from '../../api/adminTypes'
import type { CategoryNode } from '../../api/types'
import { routes } from '../../router'
import { fakeBackend } from '../../test/fakeBackend'
import { fakeAuth, renderRoutes } from '../../test/render'

afterEach(() => vi.unstubAllGlobals())

const admin = () => fakeAuth(['ADMIN'])

const TREE: CategoryNode[] = [
  {
    id: 1,
    slug: 'office',
    name: 'Office',
    parentId: null,
    sortOrder: 10,
    active: true,
    productCount: 0,
    children: [{ id: 2, slug: 'pens', name: 'Pens', parentId: 1, sortOrder: 10, active: true, productCount: 3, children: [] }],
  },
]

function photo(id: number, position: number): ProductPhoto {
  return {
    id,
    sku: 'PEN-01',
    largeKey: `products/PEN-01/${id}-1200.jpg`,
    thumbKey: `products/PEN-01/${id}-400.jpg`,
    position,
    altText: null,
    width: 800,
    height: 800,
    sizeBytes: 50_000,
    uploadedBy: 'ADM-001',
    uploadedAt: '2026-11-09T10:00:00',
  }
}

const DETAIL: ProductDetail = {
  product: {
    sku: 'PEN-01',
    name: 'Gel pen',
    hsnCode: '9608',
    unitPrice: 59,
    gstRate: 18,
    currency: 'INR',
    available: 10,
    reserved: 0,
    reorderLevel: 2,
    lowStock: false,
    active: true,
    version: 4,
    updatedAt: null,
    updatedBy: null,
    description: null,
    categoryId: null,
    categoryName: null,
    brand: null,
    maxPerOrder: null,
    ratingAvg: 0,
    ratingCount: 0,
    gstRule: null,
  },
  prices: [],
  recentMovements: [],
  images: [photo(11, 0), photo(12, 1)],
  specs: [],
  suggestedSpecs: ['Ink', 'Tip'],
}

describe('categories screen', () => {
  it('adds a sub-category, and will not delete one that has products', async () => {
    const backend = fakeBackend({
      'GET /api/admin/categories': { body: TREE },
      'POST /api/admin/categories': { status: 201, body: { ...TREE[0], id: 3 } },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/categories', admin())

    expect(await screen.findByText('/shop?category=pens')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Pens' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Add a sub-category to Office' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: /Name/ }), 'Notebooks')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(backend.sent('POST', '/api/admin/categories')[0]?.body).toEqual({ name: 'Notebooks', parentId: 1 }),
    )
  })
})

describe('product photos and description', () => {
  function productBackend(extra: Parameters<typeof fakeBackend>[0] = {}) {
    return fakeBackend({
      'GET /api/admin/catalog/PEN-01': { body: DETAIL },
      'GET /api/admin/catalog/PEN-01/movements': { body: { items: [], page: 0, totalItems: 0, totalPages: 0 } },
      'GET /api/admin/categories': { body: TREE },
      ...extra,
    })
  }

  it('uploads a dropped photo, and refuses a file that is too large before sending it', async () => {
    const backend = productBackend({
      'POST /api/admin/catalog/PEN-01/images': { status: 201, body: { ...photo(13, 2), width: 200, height: 200 } },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/catalog/PEN-01', admin())

    expect(await screen.findByText('2 of 8')).toBeInTheDocument()
    expect(screen.getByText('Main')).toBeInTheDocument()
    // 800 × 800 is fine; nothing is flagged
    expect(screen.queryByText('Low resolution')).not.toBeInTheDocument()

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const small = new File([new Uint8Array(1000)], 'pen.jpg', { type: 'image/jpeg' })
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' })
    await user.upload(input, [small, big])

    await waitFor(() => expect(backend.sent('POST', '/api/admin/catalog/PEN-01/images')).toHaveLength(1))
    expect(await screen.findByText('huge.jpg not added')).toBeInTheDocument()
    // The small one was added, with advice to use a bigger picture
    expect(await screen.findByText('pen.jpg is small')).toBeInTheDocument()
  })

  it('makes the second photo the main one by moving it earlier', async () => {
    const backend = productBackend({ 'PUT /api/admin/catalog/PEN-01/images/order': { body: [] } })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/catalog/PEN-01', admin())

    await user.click(await screen.findByRole('button', { name: 'Move photo 2 earlier' }))
    await waitFor(() =>
      expect(backend.sent('PUT', '/api/admin/catalog/PEN-01/images/order')[0]?.body).toEqual({ imageIds: [12, 11] }),
    )
  })

  it('saves a category and a description with the product version', async () => {
    const backend = productBackend({ 'PATCH /api/admin/catalog/PEN-01': { body: DETAIL.product } })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/catalog/PEN-01', admin())

    await user.click(await screen.findByRole('combobox', { name: 'Category' }))
    await user.click(await screen.findByRole('option', { name: 'Office › Pens' }))
    await user.type(screen.getByRole('textbox', { name: /Description/ }), 'Smooth gel ink.')
    await user.click(screen.getByRole('button', { name: 'Save details' }))

    await waitFor(() =>
      expect(backend.sent('PATCH', '/api/admin/catalog/PEN-01')[0]?.body).toMatchObject({
        expectedVersion: 4,
        categoryId: 2,
        description: 'Smooth gel ink.',
      }),
    )
  })
})

describe('specifications, category rules and the PIN directory', () => {
  it('adds a suggested specification and saves the table', async () => {
    const backend = fakeBackend({
      'GET /api/admin/catalog/PEN-01': { body: DETAIL },
      'GET /api/admin/catalog/PEN-01/movements': { body: { items: [], page: 0, totalItems: 0, totalPages: 0 } },
      'GET /api/admin/categories': { body: TREE },
      'PUT /api/admin/catalog/PEN-01/specs': { body: [{ name: 'Ink', value: 'Gel, blue' }] },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/catalog/PEN-01', admin())

    await user.click(await screen.findByRole('checkbox', { name: 'Ink' }))
    await user.type(screen.getByRole('textbox', { name: 'Specification 1 value' }), 'Gel, blue')
    await user.click(screen.getByRole('button', { name: 'Save specifications' }))
    await waitFor(() =>
      expect(backend.sent('PUT', '/api/admin/catalog/PEN-01/specs')[0]?.body).toEqual([{ name: 'Ink', value: 'Gel, blue' }]),
    )
  })

  it('sets the clothing GST rule and suggested specifications on a category', async () => {
    const backend = fakeBackend({
      'GET /api/admin/categories': { body: TREE },
      'GET /api/admin/categories/2/spec-keys': { body: ['Ink'] },
      'PATCH /api/admin/categories/2': { body: { ...TREE[0].children[0], gstRule: 'APPAREL_2500' } },
      'PUT /api/admin/categories/2/spec-keys': { body: ['Ink', 'Tip'] },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/categories', admin())

    await user.click(await screen.findByRole('button', { name: 'Edit Pens' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('combobox', { name: /^GST/ }))
    await user.click(await screen.findByRole('option', { name: /Clothing & footwear/ }))
    const tags = within(dialog).getByRole('combobox', { name: /Suggested specifications/ })
    await user.type(tags, 'Tip{Enter}')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(backend.sent('PATCH', '/api/admin/categories/2')[0]?.body).toMatchObject({ gstRule: 'APPAREL_2500' }))
    await waitFor(() => expect(backend.sent('PUT', '/api/admin/categories/2/spec-keys')[0]?.body).toEqual(['Ink', 'Tip']))
  })

  it('imports the India Post PIN directory', async () => {
    const backend = fakeBackend({
      'GET /api/admin/pin-codes': { body: { pins: 0 } },
      'POST /api/admin/pin-codes': { body: { pins: 19100, rowsRead: 165000, rowsSkipped: 12, unknownStates: [] } },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/ops?tab=data', admin())

    expect(await screen.findByText('Not imported')).toBeInTheDocument()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File(['pincode,district,statename\n'], 'pincode.csv', { type: 'text/csv' }))
    await waitFor(() => expect(backend.sent('POST', '/api/admin/pin-codes')).toHaveLength(1))
    expect(await screen.findByText(/19,100 PIN codes from 1,65,000 rows/)).toBeInTheDocument()
  })
})
