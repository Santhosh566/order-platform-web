/**
 * The GraphQL catalogue as the shop uses it: the queries, their result types, and the hooks.
 * The queries are checked against the server's schema in catalogue.test.ts, so a renamed field
 * fails a test instead of a page.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { graphql } from '../api/graphql'
import type { Offer } from '../promotions/queries'

export type StockStatus = 'IN_STOCK' | 'FEW_LEFT' | 'OUT_OF_STOCK'
export type ProductSort = 'RELEVANCE' | 'PRICE_LOW_HIGH' | 'PRICE_HIGH_LOW' | 'NEWEST' | 'TOP_RATED'

export interface ProductFilter {
  text?: string
  categories?: string[]
  brands?: string[]
  minPrice?: number
  maxPrice?: number
  inStockOnly?: boolean
  minRating?: number
  /** A coupon code: only the products it takes money off */
  offer?: string
}

export interface ProductCard {
  sku: string
  name: string
  brand: string | null
  price: number
  gstRate: number
  currency: string
  stockStatus: StockStatus
  imageKey: string | null
  imageAlt: string | null
  rating: { average: number; count: number }
  maxPerOrder: number | null
  /** Live coupons for it: ones for chosen products first */
  offers: Offer[]
}

export interface Facets {
  categories: Array<{ slug: string; name: string; parentSlug: string | null; count: number }>
  brands: Array<{ brand: string; count: number }>
  price: { min: number; max: number } | null
}

export interface ProductPage {
  items: ProductCard[]
  totalItems: number
  totalPages: number
  page: number
  size: number
  facets: Facets
}

export interface CategoryRef {
  slug: string
  name: string
  parentSlug: string | null
  parentName: string | null
}

export interface ProductDetail extends ProductCard {
  description: string | null
  category: CategoryRef | null
  specs: Array<{ name: string; value: string }>
  images: Array<{ id: string; largeKey: string; thumbKey: string; altText: string | null; width: number; height: number }>
  related: ProductCard[]
}

export interface Suggestion {
  kind: 'PRODUCT' | 'CATEGORY' | 'BRAND'
  label: string
  sku: string | null
  slug: string | null
}

const CARD = `sku name brand price gstRate currency stockStatus imageKey imageAlt rating { average count } maxPerOrder
  offers { code description discountType discountValue maxDiscount minOrderValue endsAt firstOrderOnly targeted }`

export const PRODUCTS_QUERY = `
  query Products($filter: ProductFilter, $sort: ProductSort, $page: Int, $size: Int) {
    products(filter: $filter, sort: $sort, page: $page, size: $size) {
      totalItems totalPages page size
      items { ${CARD} }
      facets {
        categories { slug name parentSlug count }
        brands { brand count }
        price { min max }
      }
    }
  }`

export const PRODUCT_QUERY = `
  query Product($sku: ID!) {
    product(sku: $sku) {
      ${CARD}
      description
      category { slug name parentSlug parentName }
      specs { name value }
      images { id largeKey thumbKey altText width height }
      related(limit: 8) { ${CARD} }
    }
  }`

export const SUGGESTIONS_QUERY = `
  query Suggestions($text: String!) {
    suggestions(text: $text, limit: 8) { kind label sku slug }
  }`

/** A category in the tile strip: a photo of its best product and how many are on sale. */
export interface CategoryTile {
  id: string
  slug: string
  name: string
  imageKey: string | null
  productCount: number | null
  children: CategoryTile[]
}

export const CATEGORY_TREE_QUERY = `
  query CategoryTree {
    categories {
      id slug name imageKey productCount
      children { id slug name imageKey productCount }
    }
  }`

/** Main categories with their sub-categories; children of each are [] when it has none. */
export function useCategoryTree() {
  return useQuery<CategoryTile[]>({
    queryKey: ['catalogue', 'category-tree'],
    queryFn: ({ signal }) =>
      graphql<{ categories: CategoryTile[] }>(CATEGORY_TREE_QUERY, {}, signal).then((d) =>
        d.categories.map((c) => ({ ...c, children: c.children.map((sub) => ({ ...sub, children: [] })) })),
      ),
    staleTime: 5 * 60_000,
  })
}

export const PAGE_SIZE = 24

export function useProducts(filter: ProductFilter, sort: ProductSort, page: number) {
  return useQuery<ProductPage>({
    queryKey: ['catalogue', 'products', filter, sort, page],
    queryFn: ({ signal }) =>
      graphql<{ products: ProductPage }>(PRODUCTS_QUERY, { filter, sort, page, size: PAGE_SIZE }, signal).then(
        (d) => d.products,
      ),
    // The list keeps showing while the next filter loads, instead of flashing empty
    placeholderData: keepPreviousData,
  })
}

export function useProductDetail(sku: string) {
  return useQuery<ProductDetail | null>({
    queryKey: ['catalogue', 'product', sku],
    queryFn: ({ signal }) =>
      graphql<{ product: ProductDetail | null }>(PRODUCT_QUERY, { sku }, signal).then((d) => d.product),
  })
}

export function useSuggestions(text: string) {
  const q = text.trim()
  return useQuery<Suggestion[]>({
    queryKey: ['catalogue', 'suggestions', q],
    queryFn: ({ signal }) =>
      graphql<{ suggestions: Suggestion[] }>(SUGGESTIONS_QUERY, { text: q }, signal).then((d) => d.suggestions),
    enabled: q.length >= 2,
    staleTime: 60_000,
  })
}

export interface DeliveryEstimate {
  outcome: 'DELIVERABLE' | 'UNKNOWN_PIN' | 'INVALID_PIN' | 'OUT_OF_STOCK'
  pin: string
  district: string | null
  state: string | null
  earliest: string | null
  latest: string | null
  approximate: boolean
  minutesToCutOff: number | null
  /** Public holidays the dates skip, from today to the latest day */
  holidays: Array<{ date: string; name: string }>
}

export const DELIVERY_QUERY = `
  query Delivery($sku: ID!, $pin: String!) {
    deliveryEstimate(sku: $sku, pin: $pin) {
      outcome pin district state earliest latest approximate minutesToCutOff holidays { date name }
    }
  }`

export function useDeliveryEstimate(sku: string, pin: string | null) {
  return useQuery<DeliveryEstimate>({
    queryKey: ['catalogue', 'delivery', sku, pin],
    queryFn: ({ signal }) =>
      graphql<{ deliveryEstimate: DeliveryEstimate }>(DELIVERY_QUERY, { sku, pin }, signal).then((d) => d.deliveryEstimate),
    enabled: !!pin && /^[1-9][0-9]{5}$/.test(pin),
    // The cut-off countdown moves, so ask again now and then
    staleTime: 60_000,
  })
}
