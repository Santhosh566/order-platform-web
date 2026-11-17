import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fakeBackend } from '../test/fakeBackend'
import { fakeAuth, renderWithProviders } from '../test/render'
import { RateDelivery, type DeliveryRatingStatus } from './RateDelivery'

afterEach(() => vi.unstubAllGlobals())

const OPEN: DeliveryRatingStatus = {
  orderId: 'ORD-1',
  canRate: true,
  reason: null,
  driverName: 'Ravi',
  deliveredAt: '2026-11-12T15:00:00',
  closesAt: '2026-11-26T15:00:00',
  rating: null,
  comment: null,
}

describe('rating a delivery', () => {
  it('sends the stars and a comment, then shows what was sent', async () => {
    const user = userEvent.setup()
    const backend = fakeBackend({
      'GET /api/delivery-ratings/ORD-1': { body: OPEN },
      'PUT /api/delivery-ratings/ORD-1': (call) => ({ body: { ...OPEN, ...(call.body as object) } }),
    })
    renderWithProviders(<RateDelivery orderId="ORD-1" />, fakeAuth(['CUSTOMER']))

    expect(await screen.findByText('How was the delivery by Ravi?')).toBeInTheDocument()
    screen.getByRole('radio', { name: '5' }).focus()
    await user.keyboard('{Enter}')
    await user.type(screen.getByRole('textbox', { name: /Anything to add/ }), 'Polite')
    await user.click(screen.getByRole('button', { name: 'Send rating' }))

    await waitFor(() => expect(backend.sent('PUT', '/api/delivery-ratings/ORD-1')).toHaveLength(1))
    expect(backend.sent('PUT', '/api/delivery-ratings/ORD-1')[0].body).toEqual({ rating: 5, comment: 'Polite' })
    expect(await screen.findByLabelText('You rated 5 out of 5')).toBeInTheDocument()
    expect(screen.getByText('“Polite”')).toBeInTheDocument()
  })

  it('shows nothing for an order a courier delivered', async () => {
    const backend = fakeBackend({
      'GET /api/delivery-ratings/ORD-1': { body: { ...OPEN, canRate: false, driverName: null, reason: 'Only orders our own drivers delivered can be rated' } },
    })
    const { container } = renderWithProviders(<RateDelivery orderId="ORD-1" />, fakeAuth(['CUSTOMER']))
    await waitFor(() => expect(backend.calls).toHaveLength(1))
    expect(container.textContent).not.toContain('Your delivery')
  })
})
