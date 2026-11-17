import { newProductSchema, priceChangeSchema, stockChangeSchema, toServerDateTime } from './catalogSchema'

const product = {
  sku: 'pen-02',
  name: 'Fountain pen',
  hsnCode: '9608',
  unitPrice: 249.5,
  gstRate: '18',
  openingStock: 10,
  reorderLevel: 3,
}

describe('catalogue form rules', () => {
  it('accepts a product and upper-cases its SKU', () => {
    expect(newProductSchema.parse(product).sku).toBe('PEN-02')
  })

  it('refuses a bad HSN code, a GST rate that is not a slab, and fractions of a paisa', () => {
    expect(newProductSchema.safeParse({ ...product, hsnCode: '96081' }).success).toBe(false)
    expect(newProductSchema.safeParse({ ...product, gstRate: '15' }).success).toBe(false)
    expect(newProductSchema.safeParse({ ...product, unitPrice: 10.005 }).success).toBe(false)
    expect(newProductSchema.safeParse({ ...product, unitPrice: 19.99 }).success).toBe(true)
  })

  it('needs a future time for a scheduled price', () => {
    const base = { unitPrice: 100, gstRate: '18', reason: '' }
    expect(priceChangeSchema.safeParse({ ...base, when: 'now', effectiveFrom: '' }).success).toBe(true)
    expect(priceChangeSchema.safeParse({ ...base, when: 'later', effectiveFrom: '2020-01-01T00:00' }).success).toBe(false)
    expect(priceChangeSchema.safeParse({ ...base, when: 'later', effectiveFrom: '2999-01-01T09:30' }).success).toBe(true)
    expect(toServerDateTime('2999-01-01T09:30')).toBe('2999-01-01T09:30:00')
  })

  it('needs a reason for anything but goods received, and a non-zero correction', () => {
    expect(stockChangeSchema.safeParse({ type: 'RECEIPT', quantity: 5, reason: '' }).success).toBe(true)
    expect(stockChangeSchema.safeParse({ type: 'WRITE_OFF', quantity: 2, reason: '' }).success).toBe(false)
    expect(stockChangeSchema.safeParse({ type: 'ADJUSTMENT', quantity: -3, reason: 'Count' }).success).toBe(true)
    expect(stockChangeSchema.safeParse({ type: 'ADJUSTMENT', quantity: 0, reason: 'Count' }).success).toBe(false)
    expect(stockChangeSchema.safeParse({ type: 'RECEIPT', quantity: -1, reason: '' }).success).toBe(false)
  })
})
