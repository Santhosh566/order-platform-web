import type { CartLine } from './cart'

/** GET/PUT /api/cart: the customer's cart as the server keeps it, priced from today's catalogue. */
export interface ServerCart {
  lines: ServerCartLine[]
  itemCount: number
  /** What the lines that can be bought cost now, GST included */
  total: number
  updatedAt: string | null
}

export interface ServerCartLine {
  sku: string
  name: string
  quantity: number
  /** The price when it was put in the cart */
  priceSeen: number
  /** null when the product is no longer sold */
  product: { sku: string; name: string; price: number; stockStatus: string } | null
  available: boolean
  priceDropped: boolean
}

/**
 * The server's lines as the shop's cart holds them, at the price the customer saw when they put each in, so the
 * cart page can tell them it changed. A product no longer sold keeps its name; the cart page flags it.
 */
export function fromServer(cart: ServerCart): CartLine[] {
  return cart.lines.map((line) => ({
    sku: line.sku,
    name: line.product?.name ?? line.name,
    unitPrice: line.priceSeen,
    quantity: line.quantity,
  }))
}

/**
 * What PUT /api/cart and POST /api/cart/merge take. priceSeen tells the server the customer has seen this price;
 * it keeps it only when it is today's catalogue price.
 */
export function toServer(lines: readonly CartLine[]): Array<{ sku: string; quantity: number; priceSeen: number }> {
  return lines.map((line) => ({ sku: line.sku, quantity: line.quantity, priceSeen: line.unitPrice }))
}
