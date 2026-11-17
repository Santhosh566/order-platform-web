import {
  addLine,
  atCatalogPrices,
  cartTotal,
  itemCount,
  lineTotal,
  MAX_QUANTITY,
  parseCart,
  priceChanges,
  removeLine,
  setQuantity,
  unavailableLines,
  type CatalogEntry,
} from './cart'

const pen = { sku: 'PEN', name: 'Pen', unitPrice: 19.99 }
const book = { sku: 'BOOK', name: 'Book', unitPrice: 0.1 }

describe('cart', () => {
  it('adds to an existing line instead of repeating it', () => {
    const lines = addLine(addLine([], pen, 2), pen, 3)
    expect(lines).toEqual([{ ...pen, quantity: 5 }])
  })

  it('keeps quantities between 1 and the limit', () => {
    let lines = addLine([], pen, 100)
    expect(lines[0].quantity).toBe(MAX_QUANTITY)
    lines = setQuantity(lines, 'PEN', 0)
    expect(lines[0].quantity).toBe(1)
    lines = setQuantity(lines, 'PEN', 2.7)
    expect(lines[0].quantity).toBe(2)
  })

  it('totals in whole paise', () => {
    const lines = [
      { ...pen, quantity: 3 },
      { ...book, quantity: 3 },
    ]
    expect(lineTotal(lines[0])).toBe(59.97)
    // 0.1 * 3 is 0.30000000000000004 in floating point
    expect(cartTotal(lines)).toBe(60.27)
    expect(itemCount(lines)).toBe(6)
    expect(removeLine(lines, 'PEN')).toHaveLength(1)
  })

  it('reads back only well-formed stored lines', () => {
    expect(parseCart(null)).toEqual([])
    expect(parseCart('not json')).toEqual([])
    expect(parseCart('{"sku":"PEN"}')).toEqual([])
    expect(parseCart(JSON.stringify([{ ...pen, quantity: 2 }, { sku: 'X' }, null]))).toEqual([{ ...pen, quantity: 2 }])
  })

  it('flags lines the catalogue no longer sells or has run out of', () => {
    const lines = [
      { ...pen, quantity: 1 },
      { ...book, quantity: 1 },
      { sku: 'GONE', name: 'Gone', unitPrice: 5, quantity: 1 },
    ]
    const catalog: CatalogEntry[] = [
      { ...pen, stockStatus: 'IN_STOCK' },
      { ...book, stockStatus: 'OUT_OF_STOCK' },
    ]
    const unavailable = unavailableLines(lines, catalog)
    expect(unavailable.get('BOOK')).toBe('Out of stock')
    expect(unavailable.get('GONE')).toBe('No longer sold')
    expect(unavailable.has('PEN')).toBe(false)

    const limited = unavailableLines([{ ...pen, quantity: 3 }], [{ ...pen, stockStatus: 'IN_STOCK', maxPerOrder: 2 }])
    expect(limited.get('PEN')).toBe('At most 2 per order: lower the quantity')
  })

  it('shows and totals today’s catalogue prices, and says what changed', () => {
    const lines = [{ ...pen, quantity: 2 }]
    const catalog: CatalogEntry[] = [{ ...pen, unitPrice: 24.5, stockStatus: 'IN_STOCK' }]
    expect(priceChanges(lines, catalog)).toEqual([{ sku: 'PEN', name: 'Pen', was: 19.99, now: 24.5 }])
    expect(cartTotal(atCatalogPrices(lines, catalog))).toBe(49)
    expect(priceChanges(lines, undefined)).toEqual([])
  })
})
