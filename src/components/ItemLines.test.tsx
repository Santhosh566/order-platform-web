import { screen, within } from '@testing-library/react'
import { fakeBackend } from '../test/fakeBackend'
import { fakeAuth, renderWithProviders } from '../test/render'
import { ItemLines } from './ItemLines'

afterEach(() => vi.unstubAllGlobals())

describe('item lines on returns and pickups', () => {
  it('shows each product’s photo and name, fetched once for all lines', async () => {
    const backend = fakeBackend({
      'GET /api/public/thumbnails': {
        body: [
          { sku: 'PEN-01', name: 'Gel pen', imageKey: 'products/PEN-01/a-400.jpg' },
          { sku: 'OLD-1', name: 'Fountain pen', imageKey: null },
        ],
      },
    })
    renderWithProviders(
      <ItemLines
        label="To collect"
        items={[
          { sku: 'PEN-01', quantity: 2 },
          { sku: 'OLD-1', quantity: 1 },
          { sku: 'GONE', quantity: 1 },
        ]}
      />,
      fakeAuth(['CUSTOMER']),
    )

    const list = screen.getByRole('list', { name: 'To collect' })
    const pen = await within(list).findByRole('listitem', { name: 'Gel pen' })
    expect(within(pen).getByRole('img', { name: 'Gel pen' })).toHaveAttribute('src', '/api/public/images/products/PEN-01/a-400.jpg')
    expect(within(pen).getByText('PEN-01 · 2 units')).toBeInTheDocument()
    // No photo: a placeholder; unknown product: its SKU
    expect(within(list).getByRole('img', { name: 'Fountain pen (no photo)' })).toBeInTheDocument()
    expect(within(list).getByRole('listitem', { name: 'GONE' })).toBeInTheDocument()

    const calls = backend.sent('GET', '/api/public/thumbnails')
    expect(calls).toHaveLength(1)
    expect(calls[0].query).toMatchObject({ sku: expect.any(String) })
  })
})
