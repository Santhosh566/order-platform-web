import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export type TargetType = 'PRODUCT' | 'CATEGORY' | 'COUPON'
export type Theme = 'BLUE' | 'GREEN' | 'ORANGE' | 'GRAPE' | 'RED' | 'DARK'
export type PromotionStatus = 'LIVE' | 'SCHEDULED' | 'ENDED' | 'OFF' | 'UNAVAILABLE'

/** A coupon on offer, as the shop shows it on products and banners. */
export interface Offer {
  code: string
  description: string
  discountType: 'PERCENT' | 'FLAT'
  discountValue: number
  maxDiscount: number | null
  minOrderValue: number
  endsAt: string | null
  firstOrderOnly: boolean
  /** True: for chosen products or categories only */
  targeted: boolean
}

/** GET /api/public/promotions: a banner in the shop. */
export interface Banner {
  id: number
  title: string
  message: string | null
  callToAction: string | null
  theme: Theme
  imageKey: string | null
  imageAlt: string | null
  targetType: TargetType
  sku: string | null
  productName: string | null
  categorySlug: string | null
  categoryName: string | null
  couponCode: string | null
  /** A coupon banner's terms */
  offer: Offer | null
  /** A coupon banner: what the coupon is for; empty for any order */
  appliesTo: string[]
}

/** A promotion as admins see it. */
export interface Promotion {
  id: number
  title: string
  message: string | null
  callToAction: string | null
  theme: Theme
  imageKey: string | null
  imageAlt: string | null
  targetType: TargetType
  sku: string | null
  productName: string | null
  categoryId: number | null
  categoryName: string | null
  categorySlug: string | null
  couponCode: string | null
  startsAt: string | null
  endsAt: string | null
  priority: number
  active: boolean
  impressions: number
  clicks: number
  createdAt: string
  createdBy: string | null
  updatedAt: string
  updatedBy: string | null
  status: PromotionStatus
  /** Why an UNAVAILABLE promotion is not shown */
  unavailableReason: string | null
}

export interface PromotionRequest {
  title: string
  message: string | null
  callToAction: string | null
  theme: Theme
  imageAlt: string | null
  targetType: TargetType
  sku: string | null
  categoryId: number | null
  couponCode: string | null
  startsAt: string | null
  endsAt: string | null
  priority: number
  active: boolean
}

/** Where a banner takes the shopper. */
export function bannerLink(banner: Pick<Banner, 'targetType' | 'sku' | 'categorySlug' | 'couponCode'>): string {
  switch (banner.targetType) {
    case 'PRODUCT':
      return `/shop/${encodeURIComponent(banner.sku ?? '')}`
    case 'CATEGORY':
      return `/shop?category=${encodeURIComponent(banner.categorySlug ?? '')}`
    case 'COUPON':
      return `/shop?offer=${encodeURIComponent(banner.couponCode ?? '')}`
  }
}

// ── Shop ─────────────────────────────────────────────────────────────────

export function useBanners() {
  return useQuery({
    queryKey: ['promotions', 'banners'],
    queryFn: ({ signal }) => api<Banner[]>('/api/public/promotions', { signal, anonymous: true }),
    staleTime: 5 * 60_000,
    // An ad that fails to load is left out; the shop works without it
    retry: false,
  })
}

/** Views and clicks for the admin's figures; a failure is not the shopper's problem. */
export function reportBanner(id: number, event: 'view' | 'click') {
  api(`/api/promotions/${id}/${event}`, { method: 'POST' }).catch(() => {})
}

// ── Admin ────────────────────────────────────────────────────────────────

const ADMIN_KEY = ['admin', 'promotions'] as const

export function usePromotions() {
  return useQuery({
    queryKey: ADMIN_KEY,
    queryFn: ({ signal }) => api<Promotion[]>('/api/admin/promotions', { signal }),
  })
}

function useRefresh() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: ADMIN_KEY })
    void client.invalidateQueries({ queryKey: ['promotions'] })
  }
}

export function useSavePromotion() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, request }: { id: number | null; request: PromotionRequest }) =>
      id === null
        ? api<Promotion>('/api/admin/promotions', { method: 'POST', body: request })
        : api<Promotion>(`/api/admin/promotions/${id}`, { method: 'PUT', body: request }),
    onSuccess: refresh,
  })
}

export function useSetPromotionActive() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api<Promotion>(`/api/admin/promotions/${id}`, { method: 'PATCH', body: { active } }),
    onSuccess: refresh,
  })
}

export function useDeletePromotion() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/admin/promotions/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  })
}

export function usePromotionImage() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File | null }) => {
      if (!file) return api<Promotion>(`/api/admin/promotions/${id}/image`, { method: 'DELETE' })
      const form = new FormData()
      form.append('file', file)
      return api<Promotion>(`/api/admin/promotions/${id}/image`, { method: 'POST', body: form })
    },
    onSuccess: refresh,
  })
}
