/**
 * The cart's rules, kept apart from React so they can be tested on their own.
 * Prices here are what the shop showed; the backend prices the order again from the catalogue,
 * so the amount charged is always the server's.
 */

export interface CartLine {
  sku: string
  name: string
  /** Unit price including GST, as last seen in the catalogue. */
  unitPrice: number
  quantity: number
}

/** A sensible limit for one shopper; the warehouse still checks stock. */
export const MAX_QUANTITY = 20

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1
  return Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(quantity)))
}

export function addLine(lines: readonly CartLine[], item: Omit<CartLine, 'quantity'>, quantity = 1): CartLine[] {
  const existing = lines.find((line) => line.sku === item.sku)
  if (existing) {
    return lines.map((line) =>
      line.sku === item.sku
        ? { ...line, name: item.name, unitPrice: item.unitPrice, quantity: clampQuantity(line.quantity + quantity) }
        : line,
    )
  }
  return [...lines, { ...item, quantity: clampQuantity(quantity) }]
}

export function setQuantity(lines: readonly CartLine[], sku: string, quantity: number): CartLine[] {
  return lines.map((line) => (line.sku === sku ? { ...line, quantity: clampQuantity(quantity) } : line))
}

export function removeLine(lines: readonly CartLine[], sku: string): CartLine[] {
  return lines.filter((line) => line.sku !== sku)
}

export function itemCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

/** Whole paise, so 0.1 + 0.2 problems never reach a total. */
function paise(amount: number): number {
  return Math.round(amount * 100)
}

export function lineTotal(line: Pick<CartLine, 'unitPrice' | 'quantity'>): number {
  return (paise(line.unitPrice) * line.quantity) / 100
}

export function cartTotal(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + paise(line.unitPrice) * line.quantity, 0) / 100
}

/** The catalogue's view of one product, as far as the cart cares. */
export interface CatalogEntry {
  sku: string
  name: string
  unitPrice: number
  stockStatus: 'IN_STOCK' | 'FEW_LEFT' | 'OUT_OF_STOCK'
  /** The shop's limit per order for this product, if any (the backend refuses more). */
  maxPerOrder?: number | null
}

/** Lines that cannot be ordered, with the reason: gone from the catalogue or sold out. */
export function unavailableLines(lines: readonly CartLine[], products: readonly CatalogEntry[] | undefined) {
  const result = new Map<string, string>()
  if (!products) return result
  const bySku = new Map(products.map((p) => [p.sku, p]))
  for (const line of lines) {
    const product = bySku.get(line.sku)
    if (!product) result.set(line.sku, 'No longer sold')
    else if (product.stockStatus === 'OUT_OF_STOCK') result.set(line.sku, 'Out of stock')
    else if (product.maxPerOrder && line.quantity > product.maxPerOrder)
      result.set(line.sku, `At most ${product.maxPerOrder} per order: lower the quantity`)
  }
  return result
}

export interface PriceChange {
  sku: string
  name: string
  was: number
  now: number
}

/** Lines whose price in the catalogue is no longer the one the customer saw when adding them. */
export function priceChanges(lines: readonly CartLine[], products: readonly CatalogEntry[] | undefined): PriceChange[] {
  if (!products) return []
  const bySku = new Map(products.map((p) => [p.sku, p]))
  return lines.flatMap((line) => {
    const product = bySku.get(line.sku)
    return product && product.unitPrice !== line.unitPrice
      ? [{ sku: line.sku, name: product.name, was: line.unitPrice, now: product.unitPrice }]
      : []
  })
}

/** The lines at today's catalogue prices; lines the catalogue no longer has keep theirs. */
export function atCatalogPrices(lines: readonly CartLine[], products: readonly CatalogEntry[] | undefined): CartLine[] {
  if (!products) return [...lines]
  const bySku = new Map(products.map((p) => [p.sku, p]))
  return lines.map((line) => {
    const product = bySku.get(line.sku)
    return product ? { ...line, name: product.name, unitPrice: product.unitPrice } : line
  })
}

/** Reads a stored cart, dropping anything that does not look like a cart line. */
export function parseCart(text: string | null): CartLine[] {
  if (!text) return []
  try {
    const data: unknown = JSON.parse(text)
    if (!Array.isArray(data)) return []
    return data
      .filter(
        (l): l is CartLine =>
          !!l &&
          typeof l === 'object' &&
          typeof l.sku === 'string' &&
          typeof l.name === 'string' &&
          typeof l.unitPrice === 'number' &&
          typeof l.quantity === 'number',
      )
      .map((l) => ({ sku: l.sku, name: l.name, unitPrice: l.unitPrice, quantity: clampQuantity(l.quantity) }))
  } catch {
    return []
  }
}
