import type { ProductFilter, ProductSort } from './catalogue'

/**
 * What the shop shows, kept in the address bar so a search can be shared or bookmarked and
 * survives a reload: /shop?q=pen&category=pens&brand=Linkr&min=100&max=900&stock=1&rating=4&sort=PRICE_LOW_HIGH&page=2
 * A promotion banner for a coupon opens /shop?offer=DIWALI20: the products that coupon is for.
 */
export interface ShopQuery {
  q: string
  categories: string[]
  brands: string[]
  min: number | null
  max: number | null
  inStock: boolean
  rating: number | null
  /** A coupon code, in capitals; '' for none */
  offer: string
  sort: ProductSort
  /** 1-based, as people count pages */
  page: number
}

const SORTS: readonly ProductSort[] = ['RELEVANCE', 'PRICE_LOW_HIGH', 'PRICE_HIGH_LOW', 'NEWEST', 'TOP_RATED']

export function readShopQuery(params: URLSearchParams): ShopQuery {
  const list = (key: string) =>
    (params.get(key) ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  const number = (key: string) => {
    const value = Number(params.get(key))
    return params.has(key) && Number.isFinite(value) && value >= 0 ? value : null
  }
  const sort = params.get('sort') as ProductSort | null
  const rating = number('rating')
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    categories: list('category'),
    brands: list('brand'),
    min: number('min'),
    max: number('max'),
    inStock: params.get('stock') === '1',
    rating: rating !== null && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
    offer: (params.get('offer') ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30),
    sort: sort && SORTS.includes(sort) ? sort : 'RELEVANCE',
    page: Math.max(1, Math.trunc(number('page') ?? 1)),
  }
}

/** Only what differs from the defaults, so plain /shop stays plain. Changing a filter goes back to page 1. */
export function writeShopQuery(query: ShopQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.q.trim()) params.set('q', query.q.trim())
  if (query.categories.length) params.set('category', query.categories.join(','))
  if (query.brands.length) params.set('brand', query.brands.join(','))
  if (query.min !== null) params.set('min', String(query.min))
  if (query.max !== null) params.set('max', String(query.max))
  if (query.inStock) params.set('stock', '1')
  if (query.rating !== null) params.set('rating', String(query.rating))
  if (query.offer) params.set('offer', query.offer)
  if (query.sort !== 'RELEVANCE') params.set('sort', query.sort)
  if (query.page > 1) params.set('page', String(query.page))
  return params
}

export function toFilter(query: ShopQuery): ProductFilter {
  return {
    text: query.q.trim() || undefined,
    categories: query.categories.length ? query.categories : undefined,
    brands: query.brands.length ? query.brands : undefined,
    minPrice: query.min ?? undefined,
    maxPrice: query.max ?? undefined,
    inStockOnly: query.inStock || undefined,
    minRating: query.rating ?? undefined,
    offer: query.offer || undefined,
  }
}

/** How many filters are on, for the "Filters (3)" button on phones. */
export function activeFilterCount(query: ShopQuery): number {
  return (
    query.categories.length +
    query.brands.length +
    (query.min !== null || query.max !== null ? 1 : 0) +
    (query.inStock ? 1 : 0) +
    (query.rating !== null ? 1 : 0) +
    (query.offer ? 1 : 0)
  )
}

export function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}
