import type { ProductCard } from './catalogue'

/**
 * The last products a shopper opened, kept in this browser (per signed-in user) and shown on the
 * shop and product pages. Only what a card needs is stored; prices may be a little out of date and
 * are refreshed when the product is opened again.
 */
const MAX = 10

function key(userId: string): string {
  return `order-platform:recent:${userId}`
}

export function readRecent(userId: string): ProductCard[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key(userId)) ?? '[]')
    return Array.isArray(parsed) ? (parsed as ProductCard[]).filter((p) => p && typeof p.sku === 'string') : []
  } catch {
    return []
  }
}

export function rememberViewed(userId: string, product: ProductCard): ProductCard[] {
  const card: ProductCard = {
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    price: product.price,
    gstRate: product.gstRate,
    currency: product.currency,
    stockStatus: product.stockStatus,
    imageKey: product.imageKey,
    imageAlt: product.imageAlt,
    rating: product.rating,
    maxPerOrder: product.maxPerOrder,
    // Offers change; a remembered one could have ended, so none are kept
    offers: [],
  }
  const next = [card, ...readRecent(userId).filter((p) => p.sku !== product.sku)].slice(0, MAX)
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(next))
  } catch {
    // Storage full or blocked: nothing is remembered this time
  }
  return next
}
