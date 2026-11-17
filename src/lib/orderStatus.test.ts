import {
  canRequestReturn,
  hasInvoice,
  isCancellable,
  progressStep,
  returnableUnits,
  shortOrderId,
} from './orderStatus'

describe('order status rules', () => {
  it('allows cancelling only before the goods leave the warehouse', () => {
    expect(isCancellable('CONFIRMED')).toBe(true)
    expect(isCancellable('READY_FOR_DISPATCH')).toBe(true)
    expect(isCancellable('IN_TRANSIT')).toBe(false)
    expect(isCancellable('DELIVERED')).toBe(false)
  })

  it('places each status on the progress bar, and ended orders off it', () => {
    expect(progressStep('PENDING')).toBe(0)
    expect(progressStep('OUT_FOR_DELIVERY')).toBe(4)
    expect(progressStep('CANCELLED')).toBeNull()
  })

  it('accepts returns for 7 days after delivery', () => {
    const order = { status: 'DELIVERED' as const, deliveredAt: '2026-11-01T10:00:00' }
    expect(canRequestReturn(order, new Date('2026-11-07T10:00:00'))).toBe(true)
    expect(canRequestReturn(order, new Date('2026-11-08T10:00:01'))).toBe(false)
    expect(canRequestReturn({ status: 'IN_TRANSIT', deliveredAt: null })).toBe(false)
  })

  it('counts units still returnable, ignoring rejected returns', () => {
    const order = {
      items: [
        { sku: 'PEN', quantity: 3 },
        { sku: 'PEN', quantity: 1 },
        { sku: 'BOOK', quantity: 1 },
      ],
    } as Parameters<typeof returnableUnits>[0]
    const left = returnableUnits(order, [
      { status: 'APPROVED', items: [{ sku: 'PEN', quantity: 2 }] },
      { status: 'REJECTED', items: [{ sku: 'BOOK', quantity: 1 }] },
      { status: 'REFUNDED', items: [{ sku: 'BOOK', quantity: 1 }] },
    ])
    expect(left.get('PEN')).toBe(2)
    expect(left.get('BOOK')).toBe(0)
  })

  it('offers an invoice once the order is paid', () => {
    expect(hasInvoice({ status: 'PENDING', paymentTransactionId: null })).toBe(false)
    expect(hasInvoice({ status: 'CONFIRMED', paymentTransactionId: null })).toBe(true)
    expect(hasInvoice({ status: 'CANCELLED', paymentTransactionId: 'TX-1' })).toBe(true)
  })

  it('shortens server order ids', () => {
    expect(shortOrderId('ORD-3f2a9c1e-1111-2222-3333-444455556666')).toBe('ORD-3F2A9C1E')
    expect(shortOrderId('LEGACY-7')).toBe('LEGACY-7')
  })
})
