import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../../router'
import { fakeBackend } from '../../test/fakeBackend'
import { fakeAuth, renderRoutes, renderWithProviders } from '../../test/render'
import type { Warehouse, WarehouseSummary } from '../../warehouses/queries'
import { ShipsFrom } from '../../warehouses/ShipsFrom'

// jsdom cannot lay out a Leaflet map; the points it would draw are enough
vi.mock('../../tracking/TrackingMap', () => ({
  default: ({ points }: { points: Array<{ label: string; kind: string }> }) => (
    <div data-testid="map">{points.map((p) => `${p.kind}:${p.label}`).join(' | ')}</div>
  ),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

const BLR: Warehouse = {
  id: 1,
  code: 'BLR',
  name: 'Bengaluru fulfilment centre',
  address: '80 Feet Road, Koramangala, Bengaluru',
  pin: '560034',
  stateCode: '29',
  gstin: '29AABCO1234F1Z5',
  latitude: 12.9352,
  longitude: 77.6245,
  cutoffTime: '14:00:00',
  active: true,
  isDefault: true,
  invoicePrefix: 'INV',
  creditNotePrefix: 'CN',
}

const GGN: Warehouse = {
  ...BLR,
  id: 2,
  code: 'GGN',
  name: 'Gurugram fulfilment centre',
  address: 'Sector 37, Gurugram',
  pin: '122001',
  stateCode: '06',
  gstin: '06AABCO1234F1Z9',
  latitude: 28.4595,
  longitude: 77.0266,
  cutoffTime: '16:30:00',
  isDefault: false,
  invoicePrefix: 'GGI',
  creditNotePrefix: 'GGC',
}

const LIST: WarehouseSummary[] = [
  { warehouse: BLR, products: 160, available: 4200, reserved: 35 },
  { warehouse: GGN, products: 12, available: 300, reserved: 0 },
]

describe('warehouses page', () => {
  it('shows each warehouse on the map and in the table, with its registration and cut-off', async () => {
    fakeBackend({ 'GET /api/admin/warehouses': { body: LIST } })
    renderRoutes(routes, '/admin/warehouses', fakeAuth(['ADMIN']))

    const table = await screen.findByRole('table', { name: 'Warehouses' })
    expect(within(table).getByText('06AABCO1234F1Z9')).toBeInTheDocument()
    expect(within(table).getByText('Haryana')).toBeInTheDocument()
    expect(within(table).getByText('Default')).toBeInTheDocument()
    expect(within(table).getByText('Invoices GGI/…, credit notes GGC/…')).toBeInTheDocument()
    expect(await screen.findByTestId('map')).toHaveTextContent(
      'warehouse:BLR · Bengaluru fulfilment centre | warehouse:GGN · Gurugram fulfilment centre',
    )
  })

  it('opens a warehouse with its GSTIN, and moves stock between two', async () => {
    const backend = fakeBackend({
      'GET /api/admin/warehouses': { body: LIST },
      'POST /api/admin/warehouses': { status: 201, body: { ...GGN, id: 3, code: 'CCU', name: 'Kolkata centre' } },
      'POST /api/admin/warehouses/transfers': {
        status: 201,
        body: { out: { sku: 'PEN-01', availableAfter: 8 }, in: { sku: 'PEN-01', availableAfter: 2 } },
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/warehouses', fakeAuth(['ADMIN']))
    await screen.findByRole('table', { name: 'Warehouses' })

    await user.click(screen.getByRole('button', { name: 'Add warehouse' }))
    const form = await screen.findByRole('dialog', { name: 'Add a warehouse' })
    await user.type(within(form).getByRole('textbox', { name: /^Code/ }), 'ccu')
    await user.type(within(form).getByRole('textbox', { name: /^Name/ }), 'Kolkata centre')
    await user.type(within(form).getByRole('textbox', { name: /^Address/ }), 'Dankuni, Hooghly')
    await user.type(within(form).getByRole('textbox', { name: /^PIN code/ }), '712311')
    await user.type(within(form).getByRole('textbox', { name: /^GSTIN/ }), '19aabco1234f1z3')
    expect(within(form).getByText('Registered in West Bengal')).toBeInTheDocument()
    await user.type(within(form).getByRole('textbox', { name: /^Invoice prefix/ }), 'kli')
    await user.type(within(form).getByRole('textbox', { name: /^Credit note prefix/ }), 'klc')
    await user.click(within(form).getByRole('button', { name: 'Open warehouse' }))

    await waitFor(() => expect(backend.sent('POST', '/api/admin/warehouses')).toHaveLength(1))
    expect(backend.sent('POST', '/api/admin/warehouses')[0].body).toEqual({
      code: 'CCU',
      name: 'Kolkata centre',
      address: 'Dankuni, Hooghly',
      pin: '712311',
      gstin: '19AABCO1234F1Z3',
      invoicePrefix: 'KLI',
      creditNotePrefix: 'KLC',
      cutoffTime: '14:00',
      active: true,
    })

    await user.click(screen.getByRole('button', { name: 'Move stock' }))
    const move = await screen.findByRole('dialog', { name: 'Move stock between warehouses' })
    await user.type(within(move).getByRole('textbox', { name: /Product SKU/ }), 'PEN-01')
    await user.type(within(move).getByRole('textbox', { name: /Units/ }), '2')
    await user.click(within(move).getByRole('button', { name: 'Move' }))
    await waitFor(() => expect(backend.sent('POST', '/api/admin/warehouses/transfers')).toHaveLength(1))
    expect(backend.sent('POST', '/api/admin/warehouses/transfers')[0].body).toEqual({
      sku: 'PEN-01',
      fromWarehouseId: 1,
      toWarehouseId: 2,
      quantity: 2,
    })
  })
})

describe('ships from', () => {
  it('names the warehouse an order ships from', async () => {
    fakeBackend({ 'GET /api/public/warehouses': { body: [{ id: 2, code: 'GGN', name: 'Gurugram fulfilment centre' }] } })
    renderWithProviders(<ShipsFrom warehouseId={2} />, fakeAuth(['CUSTOMER']))
    expect(await screen.findByText('Ships from Gurugram fulfilment centre')).toBeInTheDocument()
  })
})
