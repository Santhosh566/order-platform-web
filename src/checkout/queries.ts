import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ShippingAddress } from '../api/types'
import type { DeliveryWindow, PaymentMethod } from './labels'

export interface QuoteRequest {
  items: Array<{ sku: string; quantity: number }>
  shippingAddress: ShippingAddress
  couponCode: string | null
  paymentMethod: PaymentMethod
}

/** POST /api/checkout/quote: the server's price for the cart, with the coupon and GST. */
export interface Quote {
  items: Array<{
    sku: string
    name: string
    quantity: number
    unitPrice: number
    listAmount: number
    discount: number
    lineTotal: number
    gstRate: number
  }>
  itemsTotal: number
  discount: number
  total: number
  taxTotal: number
  cgstTotal: number
  sgstTotal: number
  igstTotal: number
  currency: string
  /** The coupon applied, or null */
  couponCode: string | null
  /** Why the coupon asked for was not applied */
  couponError: string | null
  cashOnDelivery: { available: boolean; reason: string | null; maxOrderValue: number }
  /** The warehouse it ships from: the nearest that has everything; null when none has */
  shipsFrom?: { code: string; name: string; stateCode: string } | null
  /** Everything is in stock, but not in one warehouse: the order would be refused, so the customer splits it */
  shippingProblem?: string | null
}

export interface SlotWindow {
  window: DeliveryWindow
  label: string
  available: boolean
  placesLeft: number
}

export interface Slots {
  bookable: boolean
  reason: string | null
  /** The standard delivery's latest date */
  standardBy: string | null
  days: Array<{ date: string; windows: SlotWindow[] }>
}

export interface Offer {
  code: string
  description: string
  minOrderValue: number
  /** Names of the products and categories it is for; empty for the whole order */
  appliesTo: string[]
}

export function useQuote(request: QuoteRequest | null) {
  return useQuery({
    queryKey: ['checkout', 'quote', request],
    queryFn: ({ signal }) => api<Quote>('/api/checkout/quote', { method: 'POST', body: request, signal }),
    enabled: request !== null && request.items.length > 0,
    // The summary keeps its figures while the next quote loads
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useSlots(pin: string | null) {
  return useQuery({
    queryKey: ['checkout', 'slots', pin],
    queryFn: ({ signal }) => api<Slots>(`/api/checkout/slots?pin=${encodeURIComponent(pin ?? '')}`, { signal }),
    enabled: !!pin,
    staleTime: 60_000,
  })
}

export function useOffers() {
  return useQuery({
    queryKey: ['checkout', 'offers'],
    queryFn: ({ signal }) => api<Offer[]>('/api/checkout/offers', { signal }),
    staleTime: 5 * 60_000,
  })
}

// ── Admin ────────────────────────────────────────────────────────────────

export interface Coupon {
  code: string
  description: string
  discountType: 'PERCENT' | 'FLAT'
  discountValue: number
  maxDiscount: number | null
  minOrderValue: number
  startsAt: string | null
  endsAt: string | null
  usageLimit: number | null
  perCustomerLimit: number
  firstOrderOnly: boolean
  active: boolean
  createdAt: string
  createdBy: string | null
  /** The last change to its products, end or on/off; null if never changed */
  updatedAt: string | null
  updatedBy: string | null
  /** Orders that used it and did not end unfulfilled */
  used: number
  /** The products (sku) and categories (categoryId) it is for; empty for the whole order */
  appliesTo: Array<{ sku: string | null; categoryId: number | null; name: string }>
}

export type NewCoupon = Omit<Coupon, 'active' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'used' | 'appliesTo'> & {
  /** With categoryIds: only these products; both empty for the whole order */
  skus: string[]
  categoryIds: number[]
}

export function useCoupons() {
  return useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: ({ signal }) => api<Coupon[]>('/api/admin/coupons', { signal }),
  })
}

export function useCreateCoupon() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (coupon: NewCoupon) => api<Coupon>('/api/admin/coupons', { method: 'POST', body: coupon }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  })
}

/**
 * What can change once a coupon exists; a field left out stays as it is. skus and categoryIds go
 * together and replace what it is for (both empty: the whole order). The code, discount and limits
 * cannot change: customers have been told them.
 */
export interface CouponChange {
  code: string
  active?: boolean
  endsAt?: string
  /** Removes the end, so it runs until switched off */
  clearEndsAt?: boolean
  skus?: string[]
  categoryIds?: number[]
}

export function useChangeCoupon() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ code, ...change }: CouponChange) =>
      api<Coupon>(`/api/admin/coupons/${encodeURIComponent(code)}`, { method: 'PATCH', body: change }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  })
}
